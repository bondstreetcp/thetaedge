import { GoogleGenerativeAI } from "@google/generative-ai";
import { cacheGet, cacheSet } from "../../../lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Cache Gemini output for 30 min — keyed by ticker + today's date
// so same-day re-analyses are instant, but next day gets fresh analysis
const RESEARCH_TTL = 1800;

export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  let ticker, name, price, iv, ivRank, change, sma50, sma100, sma200, rsi, newsHeadlines;
  try {
    ({ ticker, name, price, iv, ivRank, change, sma50, sma100, sma200, rsi, newsHeadlines } = await request.json());
  } catch (e) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!ticker) return Response.json({ error: "Ticker required" }, { status: 400 });

  // Check cache: key includes today's date so stale pitches expire daily
  const today = new Date().toISOString().split("T")[0];
  const hasNews = Array.isArray(newsHeadlines) && newsHeadlines.length > 0;
  const cacheKey = `research:${ticker}:${today}:${hasNews ? "news" : "manual"}`;

  const cached = await cacheGet(cacheKey);
  if (cached) return Response.json({ ...cached, fromCache: true });

  const genAI = new GoogleGenerativeAI(apiKey);

  const newsBlock = hasNews
    ? `\nTODAY'S NEWS CONTEXT FOR ${ticker}:\n${newsHeadlines.slice(0, 5).map(h => `• ${h}`).join("\n")}\n\nUSE THESE HEADLINES as your primary catalyst. Explain why this specific news creates a volatility-selling opportunity (or why it doesn't). Your thesis should directly address these events.\n`
    : "";

  const prompt = `You are a senior volatility analyst at Citadel Securities pitching a trade idea to your portfolio manager. Be razor-sharp, data-driven, and decisive.

TICKER: ${ticker} (${name})
PRICE: ~$${price} | IV: ${iv || "?"}% | IV RANK: ${ivRank || "?"}% | TODAY: ${change || "?"}%
${sma50 ? `50-DMA: $${sma50} | 100-DMA: $${sma100} | 200-DMA: $${sma200} | RSI: ${rsi}` : ""}
${newsBlock}

You have access to your Bloomberg terminal. Use your knowledge of:
- Current market conditions and recent news for ${ticker}
- Historical price action and technical levels
- Options pricing and volatility surface
- Analyst consensus and fundamental metrics

FORMAT ALL SECTIONS AS BULLET POINTS starting with • for readability.

The PM PITCH (thesis) must be DETAILED with 4 subsections:
- THE SETUP: What happened, the event, key numbers (4-5 bullets)
- WHY THE MARKET IS WRONG: 5-6 bullets on why the selloff is overdone, precedents, fundamental counter-arguments
- THE VOLATILITY EDGE: IV rank, IV-HV spread, how overpriced options are, normalization timeline, theta window
- FUNDAMENTAL FLOOR: Analyst consensus, valuation, cash flow, moat, capital returns

TECHNICAL ANALYSIS must include: 50/100/200 DMA with exact prices, RSI, MACD, Bollinger Bands, volume, support/resistance zones, and a BOTTOM LINE on how technicals inform strike selection.

POSITION SIZING: Calculate for $100K account at 2%, 3%, 5% risk. Exact contract counts, credits, max risk. Kelly Criterion estimate. Scale-in strategy. Correlation warnings.

Respond ONLY in this JSON format. No markdown. No backticks. No explanation outside JSON:
{"verdict":"SELL PUTS","icVerdict":"NEUTRAL","confidence":8,"catalyst":"Brief catalyst","thesis":"THE SETUP:\\n• bullet\\n\\nWHY THE MARKET IS WRONG:\\n• bullet\\n\\nTHE VOLATILITY EDGE:\\n• bullet\\n\\nFUNDAMENTAL FLOOR:\\n• bullet","technicalAnalysis":"• 50-Day MA: $X — desc\\n• 100-Day MA: $X — desc\\n• 200-Day MA: $X — desc\\n• RSI: X — desc\\n• MACD: desc\\n• Bollinger: desc\\n• Volume: desc\\n• Support: levels\\n• Resistance: levels\\n\\nBOTTOM LINE: summary","putSpreadPitch":"• Sell/Buy strikes\\n• Credit\\n• ROC\\n• Rationale","ironCondorPitch":"• Wings\\n• Credit\\n• Assessment","positionSizing":"• Conservative (2%): X contracts, $X credit, $X risk\\n• Moderate (3%): X contracts\\n• Aggressive (5%): X contracts\\n• Kelly estimate\\n• Scale-in plan\\n• Correlation note","risks":"1) Risk\\n2) Risk\\n3) Risk","earningsDate":"Date","analystTarget":"$XXX","movingAverages":{"sma50":0,"sma100":0,"sma200":0,"rsi":0,"trend":"desc"},"supportResistance":[{"level":0,"type":"support","label":"desc","strength":5}],"news":["headline 1","headline 2","headline 3"]}

Verdicts: STRONG SELL, SELL, NEUTRAL, AVOID, STRONG AVOID (separate for put spread and IC)`;

  try {
    let result;
    // Best model first, graceful fallback chain
    // 20s per-model timeout ensures one hanging model can't exhaust the 60s function limit
    const MODELS = ["gemini-3.0-pro-preview", "gemini-2.5-pro-preview-05-06", "gemini-2.0-pro", "gemini-2.0-flash"];
    const MODEL_TIMEOUT = 20000; // 20 seconds per model attempt

    for (const modelName of MODELS) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const raceResult = await Promise.race([
          model.generateContent(prompt),
          new Promise((_, reject) => setTimeout(() => reject(new Error(`${modelName} timed out after ${MODEL_TIMEOUT / 1000}s`)), MODEL_TIMEOUT)),
        ]);
        result = raceResult;
        break;
      } catch (modelErr) {
        console.warn(`Model ${modelName} failed:`, modelErr.message);
        if (modelName === MODELS[MODELS.length - 1]) throw modelErr;
      }
    }
    const text = result.response.text();

    // Parse JSON from response
    const match = text.match(/\{[\s\S]*"verdict"[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]);
        // Cache successful Gemini response
        cacheSet(cacheKey, parsed, RESEARCH_TTL).catch(() => {});
        return Response.json(parsed);
      } catch (parseErr) {
        const cleaned = match[0]
          .replace(/[\x00-\x1F\x7F]/g, " ")
          .replace(/,\s*}/g, "}")
          .replace(/,\s*]/g, "]");
        try {
          const parsed = JSON.parse(cleaned);
          cacheSet(cacheKey, parsed, RESEARCH_TTL).catch(() => {});
          return Response.json(parsed);
        } catch (e) {
          return Response.json({ verdict: "PARSE_ERROR", confidence: 0, catalyst: "Failed to parse Gemini response", thesis: text.slice(0, 1000), technicalAnalysis: "N/A", putSpreadPitch: "N/A", ironCondorPitch: "N/A", positionSizing: "N/A", risks: "N/A", news: [] });
        }
      }
    }

    return Response.json({ verdict: "NO_JSON", confidence: 0, catalyst: "Gemini did not return JSON", thesis: text.slice(0, 1000), technicalAnalysis: "N/A", putSpreadPitch: "N/A", ironCondorPitch: "N/A", positionSizing: "N/A", risks: "N/A", news: [] });
  } catch (e) {
    console.error("Gemini error:", e);
    return Response.json({ error: e.message }, { status: 500 });
  }
}
