"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import TechChart from "./TechChart";
import Bullets from "./Bullets";
import EarningsDash from "./EarningsDash";

const TICKERS = [
  // Mega-cap Tech
  "AAPL","MSFT","GOOGL","AMZN","META","NVDA","TSLA","AVGO","ORCL","CRM",
  // Semis & Hardware
  "AMD","INTC","QCOM","TXN","AMAT","MU","LRCX","ADI",
  // Financials
  "JPM","V","MA","BAC","GS","MS","BLK","C","AXP","SCHW",
  // Healthcare
  "UNH","LLY","JNJ","ABBV","MRK","PFE","TMO","ABT","AMGN","BMY",
  // Consumer / Retail
  "COST","WMT","HD","MCD","NKE","SBUX","TGT","LOW",
  // Energy & Industrials
  "XOM","CVX","COP","CAT","BA","GE","RTX","UNP","HON",
  // Media & Comms
  "NFLX","DIS","CMCSA","TMUS",
  // Fintech / Crypto
  "PYPL","SQ","COIN",
  // Other Large-Cap
  "SHOP","UBER","ABNB","SNOW","PANW",
];

// ===== PRICING MODELS =====
function putSp(p, otm, w, iv, dte) {
  if (!p || !iv) return null;
  const sh = Math.round(p * (1 - otm / 100)), lo = sh - w, sig = iv / 100, t = dte / 365;
  const raw = Math.max(0.08, w * 0.18 * (sig / 0.25) * Math.sqrt(t / (30 / 365)));
  const pr = Math.min(raw, w * 0.95); // cap at 95% of width — can't collect more than the spread
  const ml = w - pr;
  return { sh, lo, prem: pr, ml, roc: ml > 0 ? (pr / ml) * 100 : 0, pop: Math.round(Math.min(95, Math.max(55, 82 + (otm - 10) * 1.4 - (sig - 0.25) * 18))) };
}
function icSp(p, otm, w, iv, dte) {
  if (!p || !iv) return null;
  const pS = Math.round(p * (1 - otm / 100)), pL = pS - w, cS = Math.round(p * (1 + otm / 100)), cL = cS + w;
  const sig = iv / 100, t = dte / 365;
  const pp = Math.max(0.06, w * 0.16 * (sig / 0.25) * Math.sqrt(t / (30 / 365)));
  const cp = Math.max(0.05, w * 0.14 * (sig / 0.25) * Math.sqrt(t / (30 / 365)));
  const tot = Math.min(pp + cp, w * 0.95); // cap at 95% of width
  const ml = w - tot;
  return { putSh: pS, putLo: pL, callSh: cS, callLo: cL, prem: tot, ml, roc: ml > 0 ? (tot / ml) * 100 : 0, pop: Math.round(Math.min(90, Math.max(45, 75 + (otm - 10) * 1.2 - (sig - 0.25) * 15))) };
}
function calcSig(s) {
  if (!s.iv) return 0; let sc = 0, r = s.ivRank || 0;
  if (r >= 70) sc += 3; else if (r >= 55) sc += 2; else if (r >= 40) sc += 1;
  const d = s.iv - (s.hv || s.iv); if (d > 8) sc += 3; else if (d > 5) sc += 2; else if (d > 2) sc += 1;
  if ((s.change || 0) <= -5) sc += 2; else if ((s.change || 0) <= -3) sc += 1;
  if (r >= 50 && d > 3) sc += 1; return Math.min(sc, 10);
}

const Dots = ({ n }) => {
  const c = n >= 8 ? "#22c55e" : n >= 6 ? "#eab308" : n >= 4 ? "#f59e0b" : "#ef4444";
  return (<div style={{ display: "flex", alignItems: "center", gap: 2 }}>
    {[...Array(10)].map((_, i) => <div key={i} style={{ width: 5, height: 15, borderRadius: 2, background: i < n ? c : "#1a2030" }} />)}
    <span style={{ marginLeft: 5, fontSize: 13, fontWeight: 700, color: c }}>{n}</span>
  </div>);
};

const vCol = v => {
  if (!v || typeof v !== "string") return "#94a3b8"; const u = v.toUpperCase();
  if (u.includes("STRONG SELL")) return "#22c55e"; if (u.includes("SELL")) return "#4ade80";
  if (u.includes("NEUTRAL")) return "#eab308"; if (u.includes("STRONG AVOID")) return "#ef4444";
  if (u.includes("AVOID")) return "#f97316"; return "#94a3b8";
};

// ===== PRE-LOADED EXAMPLES =====
const AMZN_RESEARCH = {
  verdict: "SELL PUTS", icVerdict: "NEUTRAL", confidence: 8,
  catalyst: "Post-earnings selloff of 4-6% driven by $100B+ 2025 capex guidance for AI infrastructure. Revenue and AWS both beat expectations.",
  thesis: "THE SETUP:\n• AMZN reported Q4 — $187.8B revenue (+10% YoY), AWS $24.2B (+19%), operating income beat by $2B\n• Stock sold off 4-6% entirely on 2025 capex guidance: $100B+ (up from $75B), almost all AI/AWS infrastructure\n• Market is pricing this as margin destruction — it's not. AWS margins EXPANDED to 37% last quarter\n\nWHY THE MARKET IS WRONG:\n• This is OFFENSIVE capex, not defensive — AWS backlog is $157B and growing, they literally cannot build capacity fast enough\n• Every hyperscaler (MSFT, GOOG, META) is in the same AI capex arms race — AMZN isn't an outlier, they're just being transparent\n• The $100B number scared people, but on $640B revenue run-rate, that's 15.6% capex-to-revenue — LOWER than GOOG (16.2%) and META (28%+)\n• AWS is the #1 cloud provider with 31% market share — this spend deepens the moat, not erodes it\n• Prior capex scares (2022 fulfillment buildout) saw AMZN recover 100% within 60 days once Street modeled the ROI\n\nTHE VOLATILITY EDGE:\n• IV spiked to 72nd percentile post-earnings — this is fear premium we can harvest\n• 20-day realized vol is only 28% — that's a 7-point IV-HV spread, meaning options are significantly overpriced\n• We're PAST the earnings binary event — we get elevated IV without the event risk\n• Post-earnings IV crush typically normalizes within 10-15 trading days — our theta decay window\n• At 45 DTE, we're in the optimal theta decay zone (21-45 DTE) where daily premium decay accelerates\n\nFUNDAMENTAL FLOOR:\n• 35 of 42 analysts rate Buy, consensus target $240 (21% upside from here)\n• Avg target actually INCREASED post-earnings — Street sees through the capex noise\n• Free cash flow still $38B+ annually — this is not a cash-strapped company overextending\n• Retail + advertising + Prime ecosystem provides earnings diversification beyond just AWS\n• No debt concerns — $86B cash on hand vs $58B total debt",
  technicalAnalysis: "• 50-Day MA: $203.40 — broke below on earnings, now acting as overhead resistance\n• 100-Day MA: $192.10 — HELD as support during selloff, bounced twice here\n• 200-Day MA: $186.50 — major fortress, hasn't closed below since March 2024\n• RSI (14): 38 — approaching oversold. Last time RSI hit 38 was March 2024, stock rallied 12% in 30 days\n• MACD: Bearish crossover 3 days ago but histogram flattening — momentum shift incoming\n• Bollinger Bands: Price at lower band ($194). Reverts to mean within 10-15 days 75% of the time\n• Volume: Post-earnings 2.8x average, but follow-through only 0.6x — no institutional capitulation\n• Support zones: $192 (100-DMA), $186.50 (200-DMA), $178 (Oct 2024 low)\n• Resistance zones: $203 (50-DMA), $210 (pre-earnings high)\n\nBOTTOM LINE: Short put at $175 sits 12% OTM, $11 below the 200-DMA, $3 below Oct 2024 low. Three layers of support to breach. RSI + volume signal selloff is exhausting.",
  putSpreadPitch: "• Sell $175 / Buy $170 put spread at 45 DTE\n• Credit: ~$1.15 per spread ($115 per contract)\n• Short strike 12% OTM, below 200-DMA ($186.50) and Oct low ($178)\n• ROC: 23% on $5 wide spread\n• BTC target: $0.58 (50% profit) — achievable in 15-20 days as IV normalizes",
  ironCondorPitch: "• Put side is solid — same thesis as above\n• Call side is DANGEROUS — one positive AWS data point sends AMZN to $215+\n• 50-DMA at $203 right above, reclaim triggers momentum buyers\n• If forced: $175/$170 puts + $225/$230 calls for ~$1.85 combined\n• Recommendation: lean put spread only — you want upside exposure, not neutrality",
  positionSizing: "• Conservative (2% risk): On a $100K account, max loss = $2,000. At $3.85 max loss per spread, that's 5 contracts ($575 credit, $1,925 max risk)\n• Moderate (3% risk): 7 contracts ($805 credit, $2,695 max risk)\n• Aggressive (5% risk): 12 contracts ($1,380 credit, $4,620 max risk)\n• Buying power used: $2,500 per 5 contracts ($5 wide) — only 2.5% of a $100K account\n• Kelly Criterion estimate: With ~80% PoP and 0.30 credit/risk ratio, optimal bet size is ~15% of bankroll — but NEVER size above 5% per trade\n• Scale-in approach: Open 60% of target size now, add remaining 40% if stock retests $192 (100-DMA)\n• Correlation warning: If also running V or MA put spreads, reduce all payment/tech positions by 30% — correlated risk",
  risks: "1) Broad market selloff on tariff/macro drags AMZN below 200-DMA ($186)\n2) Analyst downgrades on capex — currently 35/42 Buy, avg target $240\n3) AWS growth deceleration in next data release\n4) FTC regulatory action on marketplace practices",
  earningsDate: "Late April 2026", analystTarget: "$240 consensus (82% Buy)",
  movingAverages: { sma50: 203.40, sma100: 192.10, sma200: 186.50, rsi: 38, trend: "Below 50-DMA, above 100-DMA" },
  supportResistance: [
    { level: 178, type: "support", label: "Oct 2024 Low", strength: 4 },
    { level: 186.5, type: "support", label: "200-DMA", strength: 5 },
    { level: 192, type: "support", label: "100-DMA", strength: 4 },
    { level: 203, type: "resistance", label: "50-DMA", strength: 3 },
    { level: 210, type: "resistance", label: "Pre-Earnings", strength: 4 },
  ],
  news: ["Q4 rev $187.8B beats, AWS +19%", "$100B capex guidance spooks Street", "AWS backlog $157.4B record", "35/42 analysts Buy, avg $240", "IV rank 72nd pctile — 7pt spread over HV"],
  ts: "Pre-loaded example"
};

const V_RESEARCH = {
  verdict: "STRONG SELL PUTS", icVerdict: "SELL", confidence: 9,
  catalyst: "Visa dropped 5.2% on Credit Card Competition Act reintroduction. Same bill failed in 2022, 2023, and 2024 — never left committee.",
  thesis: "THE SETUP:\n• Visa dropped 5.2% on headlines that a bipartisan Senate bill (Credit Card Competition Act) would cap interchange fees\n• Q4 was excellent: payment volume +8%, cross-border transactions +15%, net revenue +12%, operating margin 67%\n• $600B market cap duopoly (V+MA control 80%+ of card network volume globally)\n\nWHY THE MARKET IS WRONG:\n• This EXACT bill was introduced in 2022, 2023, and 2024 — never made it out of the Senate Banking Committee\n• The payments lobby (V, MA, bank partners) spent $180M last election cycle fighting interchange regulation\n• Even IF the bill passes (which it won't), the estimated revenue impact is 3-4% — the stock dropped as if it's losing 20%\n• The bill targets interchange fees, not network fees — Visa's network fees (which are higher margin) are untouched\n• Precedent: the Durbin Amendment (2010) capped debit interchange — Visa's stock recovered within 6 months and network fees actually INCREASED\n• Political reality: 2026 midterms make controversial financial regulation nearly impossible to advance\n\nTHE VOLATILITY EDGE:\n• IV spiked to 82nd percentile — the HIGHEST since the 2023 regional banking crisis\n• HV20 is only 18% — that's a 10+ point IV-HV spread, one of the fattest premium overpricing events of the year\n• Visa's historical IV rank averages 35-40% — we're 2 standard deviations above normal\n• All three prior interchange scares (2022, 2023, 2024) saw IV normalize within 20-30 days — textbook mean reversion\n• At 45 DTE, we capture the full IV crush cycle plus accelerating theta decay\n\nFUNDAMENTAL FLOOR:\n• 90% of analysts rate Buy, consensus target $365 (17% upside from current)\n• V trades at 28x forward earnings — a DISCOUNT to its 5-year average of 32x\n• Cross-border transactions (highest margin segment) growing 15% — secular tailwind from travel recovery + e-commerce globalization\n• $16B in annual share buybacks + $4B dividends — massive capital return program supports the stock\n• Zero credit risk — Visa doesn't lend money, they just clip the transaction fee. Recession-resistant business model\n• Network effects are the strongest moat in fintech — every new merchant/cardholder makes the network more valuable",
  technicalAnalysis: "• 50-Day MA: $318.20 — broke below on the news, now first resistance\n• 100-Day MA: $308.50 — stock sitting RIGHT ON this level, held 4x in past year\n• 200-Day MA: $295.80 — fortress, hasn't closed below since Oct 2023\n• RSI (14): 32 — OVERSOLD. Last time RSI was 32: March 2024, rallied 12% in 30 days\n• MACD: Sharp bearish crossover, identical pattern to 2023 & 2024 interchange scares — both V-shaped recoveries\n• Bollinger Bands: Price touched lower band at $306 — 78% mean-reversion probability within 10-15 days\n• Volume: Selloff at 3.2x average — institutional de-risking. Dark pool prints show net buying at $308-310\n• Fibonacci: 38.2% retracement of 2024 rally at $304, 50% at $292\n• Support: $308 (100-DMA current), $296 (200-DMA), $285 (2024 low)\n• Resistance: $318 (50-DMA), $328 (pre-selloff)\n\nBOTTOM LINE: RSI 32 (oversold) + sitting on 100-DMA + lower Bollinger Band = textbook mean reversion. All 3 prior interchange scares recovered in 30-45 days. Short put at $280 is $16 below 200-DMA.",
  putSpreadPitch: "• Sell $280 / Buy $275 put spread at 45 DTE\n• Credit: ~$1.35 per spread ($135 per contract)\n• 11% OTM, $16 below 200-DMA ($296), $5 below 2024 low ($285)\n• FOUR layers of technical support between price and strike\n• ROC: 27% on $5 wide — historical: 2023 scare saw V recover 100% in 28 days\n• BTC target: $0.68 (50% profit) within 15-20 days",
  ironCondorPitch: "• IC works WELL here — Visa is range-bound during regulatory clouds\n• Bulls won't chase until bill dies, bears can't push below 200-DMA\n• Sell $280/$275 puts + $340/$345 calls for ~$2.20 combined credit\n• Call side at $340 is above ATH — no new highs under regulatory cloud\n• ROC: 44% annualized — actually prefer the IC over naked put spread here",
  positionSizing: "• Conservative (2% risk): On a $100K account, max loss = $2,000. At $3.65 max loss per spread, that's 5 contracts ($675 credit, $1,825 max risk)\n• Moderate (3% risk): 8 contracts ($1,080 credit, $2,920 max risk)\n• Aggressive (5% risk): 13 contracts ($1,755 credit, $4,745 max risk)\n• Iron Condor sizing: At $2.80 max loss per IC, conservative = 7 contracts ($1,540 credit, $1,960 max risk)\n• Buying power: $2,500 per 5 contracts (put spread) or $3,500 per 7 contracts (IC) — 2.5-3.5% of $100K\n• Kelly estimate: With ~85% PoP and 0.37 credit/risk ratio, Kelly says ~20% — cap at 5% always\n• Scale-in: Open 70% now at $308 (100-DMA), add 30% if it touches $296 (200-DMA)\n• Portfolio heat: If running AMZN + V + MA spreads simultaneously, total premium-selling exposure should not exceed 15% of portfolio",
  risks: "1) Bill gains unexpected bipartisan momentum — monitor Senate Banking Committee\n2) Mastercard reports weak cross-border, reigniting sector fear\n3) DOJ antitrust inquiry on card network fees (low prob, high impact)\n4) FedNow adoption narrative accelerates",
  earningsDate: "Late April 2026", analystTarget: "$365 consensus (90% Buy)",
  movingAverages: { sma50: 318.20, sma100: 308.50, sma200: 295.80, rsi: 32, trend: "On 100-DMA, RSI oversold" },
  supportResistance: [
    { level: 285, type: "support", label: "2024 Low", strength: 4 },
    { level: 296, type: "support", label: "200-DMA", strength: 5 },
    { level: 308, type: "support", label: "100-DMA", strength: 4 },
    { level: 318, type: "resistance", label: "50-DMA", strength: 3 },
    { level: 328, type: "resistance", label: "Pre-Selloff", strength: 4 },
  ],
  news: ["CCCA reintroduced — V drops 5.2%", "Bill failed 2022, 2023, 2024", "Q4: Payments +8%, cross-border +15%", "Payments lobby $180M fighting reg", "IV rank 82nd pctile — 10pt over HV"],
  ts: "Pre-loaded example"
};

// ===== MAIN COMPONENT =====
export default function ThetaEdge() {
  const [stocks, setStocks] = useState([]);
  const [news, setNews] = useState({ sections: {}, all: [], sources: {} });
  const [loading, setLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);
  const [sel, setSel] = useState(null);
  const [otm, setOtm] = useState(12);
  const [width, setWidth] = useState(5);
  const [dte, setDte] = useState(45);
  const [sector, setSector] = useState("All");
  const [minIV, setMinIV] = useState(0);
  const [strat, setStrat] = useState("put");
  const [research, setResearch] = useState({ AMZN: AMZN_RESEARCH, V: V_RESEARCH });
  const [rLoad, setRLoad] = useState({});
  const [rError, setRError] = useState({});
  const [tab, setTab] = useState("research");
  const [ticker, setTicker] = useState("");
  const [exTk, setExTk] = useState("AMZN");
  const [newsTab, setNewsTab] = useState("all");
  const [historyData, setHistoryData] = useState({});
  const histLoadedRef = useRef({});

  // Fetch stocks from Yahoo Finance API route
  const fetchStocks = useCallback(async (tickers) => {
    try {
      const res = await fetch(`/api/stocks?tickers=${encodeURIComponent(tickers.join(","))}`);
      const data = await res.json();
      return data.stocks || [];
    } catch (e) { console.error("Stock fetch error:", e); return []; }
  }, []);

  // Fetch news from API route
  const fetchNews = useCallback(async () => {
    try {
      const res = await fetch("/api/news");
      const data = await res.json();
      return data || { sections: {}, all: [], sources: {} };
    } catch (e) { console.error("News fetch error:", e); return { sections: {}, all: [], sources: {} }; }
  }, []);

  // Fetch historical price data for chart
  const fetchHistory = useCallback(async (tk) => {
    if (histLoadedRef.current[tk]) return;
    histLoadedRef.current[tk] = true;
    try {
      const res = await fetch(`/api/history?ticker=${encodeURIComponent(tk)}&months=12`);
      const data = await res.json();
      if (data.data) setHistoryData(p => ({ ...p, [tk]: data.data }));
    } catch (e) {
      console.error("History fetch error:", e);
      histLoadedRef.current[tk] = false; // allow retry on error
    }
  }, []);

  // Run Gemini research — newsCtx is optional array of headlines
  const analyze = useCallback(async (tk, newsCtx) => {
    const s = stocks.find(x => x.ticker === tk);
    if (!s) {
      setRError(p => ({ ...p, [tk]: "Stock data still loading — try again in a moment" }));
      return;
    }
    setRLoad(p => ({ ...p, [tk]: true }));
    setRError(p => ({ ...p, [tk]: null }));
    try {
      // Gather news headlines for this ticker from all sources
      const headlines = newsCtx || [];
      if (!headlines.length) {
        // Auto-gather from news state
        const movers = (news.sections?.movers || []).filter(n => n.ticker === tk).map(n => `${n.title} — ${n.summary}`);
        const company = (news.sections?.company || []).filter(n => n.ticker === tk).map(n => n.title);
        const market = (news.sections?.market || []).filter(n => (n.title || "").includes(tk)).map(n => n.title);
        headlines.push(...movers, ...company, ...market);
      }

      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: tk, name: s.name, price: s.price, iv: s.iv, ivRank: s.ivRank, change: s.change,
          newsHeadlines: headlines.length ? headlines.slice(0, 5) : undefined,
        }),
      });
      const data = await res.json();
      if (data.error) {
        console.error("Research error:", data.error);
        setRError(p => ({ ...p, [tk]: data.error }));
      } else {
        setResearch(p => ({ ...p, [tk]: { ...data, ts: new Date().toLocaleTimeString() } }));
      }
    } catch (e) {
      console.error("Research error:", e);
      setRError(p => ({ ...p, [tk]: e.message || "Network error — check your Gemini API key" }));
    }
    setRLoad(p => ({ ...p, [tk]: false }));
  }, [stocks, news]);

  // Initial load — batch tickers sequentially to avoid Yahoo rate limits
  const load = useCallback(async () => {
    setLoading(true);
    const batchSize = 10;
    const batches = [];
    for (let i = 0; i < TICKERS.length; i += batchSize) batches.push(TICKERS.slice(i, i + batchSize));
    const allResults = [];
    for (const batch of batches) {
      const results = await fetchStocks(batch);
      allResults.push(...results);
      // Update progressively so user sees stocks appearing
      const valid = allResults.filter(s => s.price);
      if (valid.length) {
        const enriched = valid.map(s => ({ ...s, sig: calcSig(s), ps: putSp(s.price, otm, width, s.iv || 25, dte), ic: icSp(s.price, otm, width, s.iv || 25, dte) }));
        setStocks(enriched);
        if (!sel) { const a = enriched.find(s => s.ticker === exTk); if (a) setSel(a); }
      }
    }
    setLoading(false);
  }, [fetchStocks, otm, width, dte, exTk]);

  const loadNews = useCallback(async () => {
    setNewsLoading(true);
    const data = await fetchNews();
    if (data) setNews(data);
    setNewsLoading(false);
  }, [fetchNews]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); loadNews(); }, []);
  useEffect(() => { setStocks(p => p.map(s => ({ ...s, ps: putSp(s.price, otm, width, s.iv || 25, dte), ic: icSp(s.price, otm, width, s.iv || 25, dte) }))); }, [otm, width, dte]);

  // Load chart data when selecting a ticker for research
  useEffect(() => {
    const tk = sel?.ticker || exTk;
    if (tk) fetchHistory(tk);
  }, [sel, exTk, fetchHistory]);

  const addTicker = async () => {
    const t = ticker.toUpperCase().trim().replace(/[^A-Z0-9.]/g, "");
    if (!t || stocks.find(s => s.ticker === t)) { setTicker(""); return; }
    setLoading(true);
    const data = await fetchStocks([t]);
    if (data.length && data[0].price) {
      const s = data[0];
      setStocks(p => [...p, { ...s, sig: calcSig(s), ps: putSp(s.price, otm, width, s.iv || 25, dte), ic: icSp(s.price, otm, width, s.iv || 25, dte) }]);
    }
    setTicker("");
    setLoading(false);
  };

  const secs = ["All", ...new Set(stocks.map(s => s.sector).filter(Boolean))];
  const list = stocks
    .filter(s => sector === "All" || s.sector === sector)
    .filter(s => (s.ivRank || 0) >= minIV)
    .sort((a, b) => (b.sig || 0) - (a.sig || 0));

  // Design tokens
  const BG = "#0a0e1a", C1 = "#0f1320", C2 = "#141825", BD = "#1e293b", TX = "#f1f5f9", T2 = "#cbd5e1", MU = "#8892a8", AC = "#818cf8";
  const F = { fontFamily: "'Segoe UI', system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif" };
  const inp = { background: "#1a2030", border: `1px solid #293040`, padding: "8px 12px", borderRadius: 5, fontSize: 14, color: TX, ...F };

  const curR = research[sel?.ticker || exTk];
  const curPrice = sel?.price || (exTk === "AMZN" ? 198.5 : 312.4);
  const curShort = curPrice ? Math.round(curPrice * (1 - otm / 100)) : (exTk === "AMZN" ? 175 : 280);
  const curTk = sel?.ticker || exTk;

  return (
    <div style={{ ...F, background: BG, color: TX, minHeight: "100vh", fontSize: 14, lineHeight: 1.6 }}>
      {/* HEADER */}
      <div style={{ background: C1, borderBottom: `1px solid ${BD}`, padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, zIndex: 100, flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: loading ? "#eab308" : "#22c55e", boxShadow: `0 0 10px ${loading ? "#eab30860" : "#22c55e60"}` }} />
          <span style={{ fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: "-0.02em" }}>ThetaEdge</span>
          <span style={{ fontSize: 11, color: MU, background: "#1a2030", padding: "2px 8px", borderRadius: 3 }}>LIVE · S&P 500 Large-Cap ({stocks.length || TICKERS.length} tickers) · Finnhub + Yahoo + Gemini</span>
        </div>
        <div style={{ display: "flex", gap: 3 }}>
          {[["screener", "Screener"], ["news", "News"], ["earnings", "Earnings"], ["research", "Research"]].map(([k, l]) => (
            <button key={k} onClick={() => setTab(k)} style={{ background: tab === k ? AC : "transparent", color: tab === k ? "#fff" : MU, border: `1px solid ${tab === k ? AC : BD}`, padding: "8px 20px", borderRadius: 5, cursor: "pointer", fontSize: 14, fontWeight: 600, ...F }}>{l}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", background: "#1a2030", borderRadius: 5, border: `1px solid ${BD}`, overflow: "hidden" }}>
            {[["put", "Put Spread"], ["ic", "Iron Condor"]].map(([k, l]) => (
              <button key={k} onClick={() => setStrat(k)} style={{ background: strat === k ? AC : "transparent", color: strat === k ? "#fff" : MU, border: "none", padding: "7px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, ...F }}>{l}</button>
            ))}
          </div>
          <button onClick={() => { load(); loadNews(); }} style={{ background: "#1a2030", border: `1px solid ${BD}`, padding: "8px 16px", borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: 600, color: TX, ...F }}>↻ Refresh</button>
        </div>
      </div>

      {/* TICKER BAR */}
      {news.sections?.movers?.length > 0 && (
        <div style={{ background: "#080c16", borderBottom: `1px solid ${BD}`, padding: "8px 24px", display: "flex", alignItems: "center", gap: 16, overflowX: "auto" }}>
          <span style={{ fontSize: 11, color: "#eab308", fontWeight: 700, letterSpacing: 1.5, flexShrink: 0 }}>LIVE</span>
          <div style={{ display: "flex", gap: 24 }}>{news.sections.movers.map((h, i) => (
            <span key={i} style={{ fontSize: 14, color: T2, whiteSpace: "nowrap", cursor: "pointer" }} onClick={() => { const s = stocks.find(x => x.ticker === h.ticker); if (s) { setSel(s); setExTk(s.ticker); setTab("research"); } }}>
              <b style={{ color: (h.change || 0) < 0 ? "#ef4444" : "#22c55e", marginRight: 6 }}>{h.ticker} {h.change > 0 ? "+" : ""}{h.change}%</b>{h.title?.replace(/^.*?\d+%/, "").trim()}
            </span>
          ))}</div>
        </div>
      )}

      <div style={{ padding: "20px 24px" }}>
        {/* ===== SCREENER TAB ===== */}
        {tab === "screener" && (
          <div>
            <div style={{ display: "flex", gap: 14, marginBottom: 16, flexWrap: "wrap", alignItems: "center", background: C1, padding: "14px 18px", borderRadius: 6, border: `1px solid ${BD}` }}>
              {[
                ["Sector", <select key="sec" value={sector} onChange={e => setSector(e.target.value)} style={inp}>{secs.map(s => <option key={s} style={{ background: "#1a2030" }}>{s}</option>)}</select>],
                ["Min IVR", <span key="ivr" style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="range" min={0} max={90} value={minIV} onChange={e => setMinIV(+e.target.value)} style={{ width: 70, accentColor: AC }} /><span style={{ fontSize: 14, fontWeight: 700, color: AC }}>{minIV}%</span></span>],
                ["OTM %", <span key="otm" style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="range" min={5} max={25} value={otm} onChange={e => setOtm(+e.target.value)} style={{ width: 70, accentColor: AC }} /><span style={{ fontSize: 14, fontWeight: 700, color: AC }}>{otm}%</span></span>],
                ["DTE", <select key="dte" value={dte} onChange={e => setDte(+e.target.value)} style={inp}>{[21, 30, 45, 60].map(d => <option key={d} value={d} style={{ background: "#1a2030" }}>{d}d</option>)}</select>],
                ["Width", <select key="w" value={width} onChange={e => setWidth(+e.target.value)} style={inp}>{[2.5, 5, 10, 15, 20].map(w => <option key={w} value={w} style={{ background: "#1a2030" }}>${w}</option>)}</select>],
              ].map(([l, el]) => <div key={l} style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 13, color: T2, fontWeight: 600 }}>{l}</span>{el}</div>)}
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }}>
                <input value={ticker} onChange={e => setTicker(e.target.value.toUpperCase())} onKeyDown={e => e.key === "Enter" && addTicker()} placeholder="Add ticker..." style={{ ...inp, width: 100 }} />
                <button onClick={addTicker} style={{ background: AC, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 5, cursor: "pointer", fontSize: 14, fontWeight: 700, ...F }}>+</button>
              </div>
            </div>

            {loading && !stocks.length ? (
              <div style={{ textAlign: "center", padding: 80 }}><div style={{ fontSize: 16, fontWeight: 600, color: TX }}>Fetching Yahoo Finance data...</div><div style={{ fontSize: 14, color: MU, marginTop: 8 }}>Loading {TICKERS.length} tickers with live quotes and options IV</div></div>
            ) : (
              <>
              {loading && <div style={{ background: `${AC}10`, border: `1px solid ${AC}30`, borderRadius: 5, padding: "8px 16px", marginBottom: 10, fontSize: 13, color: AC, fontWeight: 600 }}>⟳ Loading... {stocks.length}/{TICKERS.length} tickers fetched</div>}
              <div style={{ borderRadius: 6, border: `1px solid ${BD}`, background: C1, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, ...F }}>
                  <thead><tr>{["Signal", "Ticker", "Price", "Chg%", "IV", "HV", "IV-HV", "IVR", ...(strat === "put" ? ["Sell", "Buy"] : ["Puts", "Calls"]), "Credit", "Loss", "ROC", "PoP", ""].map(h => (
                    <th key={h} style={{ padding: "11px 8px", textAlign: "left", color: T2, fontWeight: 700, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.02em", borderBottom: `2px solid ${BD}`, background: "#080c16" }}>{h}</th>
                  ))}</tr></thead>
                  <tbody>{list.map(s => {
                    const sp = strat === "put" ? s.ps : s.ic;
                    const ivd = s.iv && s.hv ? (s.iv - s.hv).toFixed(1) : "—";
                    return (
                      <tr key={s.ticker} onClick={() => { setSel(s); setExTk(s.ticker); setTab("research"); }} style={{ cursor: "pointer", borderBottom: `1px solid ${BD}20` }} onMouseEnter={e => e.currentTarget.style.background = "#1a203040"} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                        <td style={{ padding: "10px 8px" }}><Dots n={s.sig || 0} /></td>
                        <td style={{ padding: "10px 8px" }}><div style={{ fontWeight: 700, fontSize: 15, color: "#fff" }}>{s.ticker}</div><div style={{ fontSize: 12, color: MU }}>{s.name}</div></td>
                        <td style={{ padding: "10px 8px", fontWeight: 600, fontSize: 15 }}>${s.price?.toFixed(2) || "—"}</td>
                        <td style={{ padding: "10px 8px", fontWeight: 700, fontSize: 15, color: (s.change || 0) < -3 ? "#ef4444" : (s.change || 0) < 0 ? "#f97316" : "#22c55e" }}>{s.change != null ? `${s.change > 0 ? "+" : ""}${s.change.toFixed(1)}%` : "—"}</td>
                        <td style={{ padding: "10px 8px", fontWeight: 600 }}>{s.iv ? `${s.iv}%` : "—"}</td>
                        <td style={{ padding: "10px 8px", color: MU }}>{s.hv ? `${s.hv}%` : "—"}</td>
                        <td style={{ padding: "10px 8px", fontWeight: 700, color: parseFloat(ivd) > 8 ? "#22c55e" : parseFloat(ivd) > 4 ? "#eab308" : MU }}>{ivd !== "—" ? `${parseFloat(ivd) >= 0 ? "+" : ""}${ivd}` : "—"}</td>
                        <td style={{ padding: "10px 8px" }}>{s.ivRank != null ? <div style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 42, height: 5, background: "#1a2030", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${s.ivRank}%`, height: "100%", borderRadius: 3, background: s.ivRank >= 70 ? "#22c55e" : s.ivRank >= 50 ? "#eab308" : "#ef4444" }} /></div><span style={{ fontWeight: 700, fontSize: 13, color: s.ivRank >= 70 ? "#22c55e" : s.ivRank >= 50 ? "#eab308" : "#ef4444" }}>{s.ivRank}</span></div> : "—"}</td>
                        {strat === "put" ? (<>
                          <td style={{ padding: "10px 8px", fontWeight: 700, color: "#f59e0b" }}>{sp ? `$${sp.sh}` : "—"}</td>
                          <td style={{ padding: "10px 8px", fontWeight: 600, color: "#3b82f6" }}>{sp ? `$${sp.lo}` : "—"}</td>
                        </>) : (<>
                          <td style={{ padding: "10px 8px", fontSize: 13, fontWeight: 600, color: "#f59e0b" }}>{sp ? `${sp.putSh}/${sp.putLo}` : "—"}</td>
                          <td style={{ padding: "10px 8px", fontSize: 13, fontWeight: 600, color: "#3b82f6" }}>{sp ? `${sp.callSh}/${sp.callLo}` : "—"}</td>
                        </>)}
                        <td style={{ padding: "10px 8px", fontWeight: 700, color: "#22c55e", fontSize: 15 }}>{sp ? `$${sp.prem.toFixed(2)}` : "—"}</td>
                        <td style={{ padding: "10px 8px", fontWeight: 600, color: "#ef4444" }}>{sp ? `$${sp.ml.toFixed(2)}` : "—"}</td>
                        <td style={{ padding: "10px 8px", fontWeight: 700, fontSize: 15, color: sp?.roc >= 18 ? "#22c55e" : sp?.roc >= 10 ? "#eab308" : MU }}>{sp ? `${sp.roc.toFixed(1)}%` : "—"}</td>
                        <td style={{ padding: "10px 8px", fontWeight: 600 }}>{sp ? `${sp.pop}%` : "—"}</td>
                        <td style={{ padding: "10px 8px" }}>
                          <button onClick={e => { e.stopPropagation(); setSel(s); setExTk(s.ticker); setTab("research"); analyze(s.ticker); }} style={{ background: research[s.ticker] ? "#22c55e18" : `${AC}18`, border: `1px solid ${research[s.ticker] ? "#22c55e40" : `${AC}40`}`, color: research[s.ticker] ? "#22c55e" : AC, padding: "6px 14px", borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: 600, ...F }}>
                            {rLoad[s.ticker] ? "⟳" : research[s.ticker] ? "✓ Done" : "⚡ Analyze"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
              </>
            )}
          </div>
        )}

        {/* ===== NEWS TAB ===== */}
        {tab === "news" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>Market News & Theta Opportunities</h2>
                <div style={{ fontSize: 12, color: MU, marginTop: 4 }}>
                  Sources: {news.sources?.finnhub ? "Finnhub ✓" : "Finnhub ✗ (add FINNHUB_API_KEY)"} · Yahoo Finance ✓
                  {news.updatedAt && ` · Updated ${new Date(news.updatedAt).toLocaleTimeString()}`}
                </div>
              </div>
              <button onClick={loadNews} style={{ background: AC, color: "#fff", border: "none", padding: "9px 20px", borderRadius: 5, cursor: "pointer", fontSize: 14, fontWeight: 600, ...F }}>{newsLoading ? "⟳ Loading..." : "↻ Refresh"}</button>
            </div>

            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: `1px solid ${BD}`, paddingBottom: 8 }}>
              {[
                ["all", `All (${news.all?.length || 0})`],
                ["movers", `Movers (${news.sections?.movers?.length || 0})`],
                ["market", `Market News (${news.sections?.market?.length || 0})`],
                ["company", `Company (${news.sections?.company?.length || 0})`],
                ["earnings", `Earnings (${news.sections?.earnings?.length || 0})`],
              ].map(([k, l]) => (
                <button key={k} onClick={() => setNewsTab(k)} style={{
                  background: newsTab === k ? AC : "transparent",
                  color: newsTab === k ? "#fff" : MU,
                  border: `1px solid ${newsTab === k ? AC : "transparent"}`,
                  padding: "6px 14px", borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: 600, ...F
                }}>{l}</button>
              ))}
            </div>

            {newsLoading && !news.all?.length ? (
              <div style={{ textAlign: "center", padding: 80, color: MU }}>Scanning Finnhub + Yahoo Finance...</div>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {/* MOVERS SECTION */}
                {(newsTab === "all" || newsTab === "movers") && news.sections?.movers?.length > 0 && (
                  <>
                    {newsTab === "all" && <div style={{ fontSize: 13, fontWeight: 700, color: "#ef4444", letterSpacing: "0.05em", marginTop: 8, marginBottom: 4 }}>🔥 TODAY&apos;S MOVERS — PREMIUM SELLING OPPORTUNITIES</div>}
                    {news.sections.movers.map((h, i) => (
                      <div key={h.id || i} onClick={() => { const s = stocks.find(x => x.ticker === h.ticker); if (s) { setSel(s); setExTk(s.ticker); setTab("research"); analyze(s.ticker); } }}
                        style={{ background: C2, border: `1px solid ${BD}`, borderRadius: 6, padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 16, borderLeft: `4px solid ${(h.change || 0) < -3 ? "#ef4444" : (h.change || 0) > 3 ? "#22c55e" : AC}` }}
                        onMouseEnter={e => e.currentTarget.style.background = "#1a203060"} onMouseLeave={e => e.currentTarget.style.background = C2}>
                        <div style={{ minWidth: 72, textAlign: "center" }}>
                          <div style={{ fontSize: 17, fontWeight: 700, color: "#fff" }}>{h.ticker}</div>
                          <div style={{ fontSize: 16, fontWeight: 700, color: (h.change || 0) < 0 ? "#ef4444" : "#22c55e" }}>{h.change > 0 ? "+" : ""}{h.change}%</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 2 }}>{h.title}</div>
                          <div style={{ fontSize: 13, color: T2 }}>{h.summary}</div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                          {h.type === "selloff" && <span style={{ background: "#ef444420", color: "#ef4444", padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, border: "1px solid #ef444440" }}>SELL PREMIUM</span>}
                          {h.type === "rally" && <span style={{ background: "#22c55e20", color: "#22c55e", padding: "4px 10px", borderRadius: 4, fontSize: 11, fontWeight: 700, border: "1px solid #22c55e40" }}>RALLY</span>}
                          <span style={{ color: AC, fontSize: 12, fontWeight: 600 }}>Analyze →</span>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* MARKET NEWS */}
                {(newsTab === "all" || newsTab === "market") && news.sections?.market?.length > 0 && (
                  <>
                    {newsTab === "all" && <div style={{ fontSize: 13, fontWeight: 700, color: "#3b82f6", letterSpacing: "0.05em", marginTop: 16, marginBottom: 4 }}>📰 MARKET NEWS</div>}
                    {news.sections.market.slice(0, newsTab === "all" ? 5 : 15).map((a, i) => (
                      <div key={a.id || i} onClick={() => { if (a.url) window.open(a.url, "_blank", "noopener,noreferrer"); }}
                        style={{ background: C2, border: `1px solid ${BD}`, borderRadius: 6, padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start", cursor: a.url ? "pointer" : "default" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#1a203060"} onMouseLeave={e => e.currentTarget.style.background = C2}>
                        {a.image && <img src={a.image} alt="" style={{ width: 80, height: 56, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} onError={e => e.target.style.display = "none"} />}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 3, lineHeight: 1.4 }}>{a.title}</div>
                          <div style={{ fontSize: 13, color: T2, lineHeight: 1.5 }}>{a.summary}</div>
                          <div style={{ fontSize: 11, color: MU, marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>{a.source} · {a.timeAgo}</span>
                            {a.url && <span style={{ color: AC, fontWeight: 600 }}>Read article →</span>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* COMPANY NEWS */}
                {(newsTab === "all" || newsTab === "company") && news.sections?.company?.length > 0 && (
                  <>
                    {newsTab === "all" && <div style={{ fontSize: 13, fontWeight: 700, color: "#eab308", letterSpacing: "0.05em", marginTop: 16, marginBottom: 4 }}>🏢 WATCHLIST COMPANY NEWS</div>}
                    {news.sections.company.slice(0, newsTab === "all" ? 6 : 20).map((a, i) => (
                      <div key={a.id || i} onClick={() => { if (a.url) window.open(a.url, "_blank", "noopener,noreferrer"); }}
                        style={{ background: C2, border: `1px solid ${BD}`, borderRadius: 6, padding: "14px 18px", cursor: a.url ? "pointer" : "default", display: "flex", gap: 14, alignItems: "flex-start" }}
                        onMouseEnter={e => e.currentTarget.style.background = "#1a203060"} onMouseLeave={e => e.currentTarget.style.background = C2}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                            {a.ticker && <span style={{ background: `${AC}20`, color: AC, padding: "2px 8px", borderRadius: 3, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{a.ticker}</span>}
                            <span style={{ fontSize: 15, fontWeight: 600, color: "#fff", lineHeight: 1.4 }}>{a.title}</span>
                          </div>
                          <div style={{ fontSize: 13, color: T2, lineHeight: 1.5 }}>{a.summary}</div>
                          <div style={{ fontSize: 11, color: MU, marginTop: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span>{a.source} · {a.timeAgo}</span>
                            <div style={{ display: "flex", gap: 12 }}>
                              {a.url && <span style={{ color: AC, fontWeight: 600 }}>Read article →</span>}
                              {a.ticker && <span style={{ color: "#eab308", fontWeight: 600 }} onClick={e2 => { e2.stopPropagation(); const s = stocks.find(x => x.ticker === a.ticker); if (s) { setSel(s); setExTk(s.ticker); setTab("research"); analyze(s.ticker); } }}>⚡ Analyze</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* EARNINGS CALENDAR */}
                {(newsTab === "all" || newsTab === "earnings") && news.sections?.earnings?.length > 0 && (
                  <>
                    {newsTab === "all" && <div style={{ fontSize: 13, fontWeight: 700, color: "#a78bfa", letterSpacing: "0.05em", marginTop: 16, marginBottom: 4 }}>📅 UPCOMING EARNINGS — IV CRUSH PLAYS</div>}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 8 }}>
                      {news.sections.earnings.map((e, i) => (
                        <div key={e.id || i} onClick={() => { if (e.ticker) { const s = stocks.find(x => x.ticker === e.ticker); if (s) { setSel(s); setExTk(s.ticker); setTab("research"); analyze(s.ticker); } } }}
                          style={{ background: C2, border: `1px solid ${BD}`, borderRadius: 6, padding: "14px 16px", cursor: "pointer", borderLeft: "4px solid #a78bfa" }}
                          onMouseEnter={e2 => e2.currentTarget.style.background = "#1a203060"} onMouseLeave={e2 => e2.currentTarget.style.background = C2}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>{e.ticker}</span>
                            <span style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600 }}>{e.timeAgo}</span>
                          </div>
                          <div style={{ fontSize: 13, color: T2 }}>{e.summary}</div>
                          <div style={{ fontSize: 11, color: AC, fontWeight: 600, marginTop: 6 }}>⚡ Pre-earnings analysis →</div>
                        </div>
                      ))}
                    </div>
                  </>
                )}


                {/* Empty state */}
                {!news.all?.length && !newsLoading && (
                  <div style={{ padding: 60, textAlign: "center", color: MU }}>
                    <div style={{ fontSize: 16, fontWeight: 600, color: TX, marginBottom: 8 }}>No news yet</div>
                    <div>Add FINNHUB_API_KEY to your Vercel environment variables for real-time market news, company news, and earnings calendar.</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ===== EARNINGS TAB ===== */}
        {tab === "earnings" && (
          <EarningsDash
            stocks={stocks}
            onAnalyze={(tk) => {
              const s = stocks.find(x => x.ticker === tk);
              if (s) { setSel(s); setExTk(s.ticker); }
              setTab("research");
              analyze(tk);
            }}
          />
        )}

        {/* ===== RESEARCH TAB ===== */}
        {tab === "research" && (
          <div>
            <div style={{ marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 13, color: "#eab308", fontWeight: 700 }}>EXAMPLES:</span>
              {["AMZN", "V"].map(t => (
                <button key={t} onClick={() => { setExTk(t); const s = stocks.find(x => x.ticker === t); if (s) setSel(s); }} style={{ background: exTk === t ? "#eab30818" : "transparent", border: `1px solid ${exTk === t ? "#eab30860" : BD}`, color: exTk === t ? "#eab308" : T2, padding: "7px 18px", borderRadius: 5, cursor: "pointer", fontSize: 14, fontWeight: 600, ...F }}>{t} {t === "AMZN" ? "(Capex Selloff)" : "(Interchange Bill)"}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 5, marginBottom: 14, flexWrap: "wrap", maxHeight: 80, overflowY: "auto" }}>
              {(stocks.length ? stocks : TICKERS.map(t => ({ ticker: t }))).map(s => (
                <button key={s.ticker} onClick={() => { if (stocks.length) { const st = stocks.find(x => x.ticker === s.ticker); if (st) { setSel(st); setExTk(st.ticker); analyze(st.ticker); } } }} style={{ background: research[s.ticker] ? "#22c55e10" : sel?.ticker === s.ticker ? `${AC}15` : "transparent", border: `1px solid ${research[s.ticker] ? "#22c55e40" : sel?.ticker === s.ticker ? `${AC}40` : BD}`, color: TX, padding: "5px 12px", borderRadius: 5, cursor: "pointer", fontSize: 13, fontWeight: 600, ...F }}>
                  {rLoad[s.ticker] && <span style={{ marginRight: 4 }}>⟳</span>}
                  {s.ticker}
                  {research[s.ticker] && <span style={{ color: "#22c55e", marginLeft: 4 }}>✓</span>}
                </button>
              ))}
            </div>

            {/* CHART */}
            <div style={{ marginBottom: 20 }}>
              <TechChart
                price={curPrice}
                ticker={curTk}
                supportResistance={curR?.supportResistance}
                shortStrike={curShort}
                histData={historyData[curTk]}
              />
            </div>

            {/* REPORT */}
            <div style={{ background: C2, border: `1px solid ${BD}`, borderRadius: 6, padding: "24px 28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: "#fff", margin: 0 }}>Trade Pitch — {curTk}</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 12, color: AC, background: `${AC}15`, padding: "4px 12px", borderRadius: 5, fontWeight: 600 }}>GEMINI + YAHOO FINANCE</span>
                  <button onClick={() => curTk && analyze(curTk)} disabled={rLoad[curTk]} style={{ background: rLoad[curTk] ? "#1a2030" : AC, color: rLoad[curTk] ? MU : "#fff", border: "none", padding: "7px 18px", borderRadius: 5, cursor: "pointer", fontSize: 14, fontWeight: 600, ...F }}>
                    {rLoad[curTk] ? "⟳ Researching..." : "⚡ Run LIVE Analysis"}
                  </button>
                </div>
              </div>

              {rLoad[curTk] ? (
                <div style={{ padding: 60, textAlign: "center" }}>
                  <div style={{ fontSize: 16, color: AC, fontWeight: 600 }}>Gemini is researching {curTk}...</div>
                  <div style={{ fontSize: 14, color: MU, marginTop: 8 }}>Pulling technicals, building thesis, sizing position</div>
                </div>
              ) : curR ? (
                <div>
                  {/* Show error banner if last attempt failed but we have prior data */}
                  {rError[curTk] && (
                    <div style={{ background: "#ef444415", border: "1px solid #ef444440", borderRadius: 5, padding: "10px 16px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "#ef4444" }}>⚠️ Live refresh failed: {rError[curTk]} — showing previous data</span>
                      <button onClick={() => analyze(curTk)} style={{ background: AC, color: "#fff", border: "none", padding: "5px 14px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600, ...F }}>Retry</button>
                    </div>
                  )}
                  {/* Verdicts */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 24 }}>
                    {[{ l: "PUT SPREAD", v: curR.verdict }, { l: "IRON CONDOR", v: curR.icVerdict }].map(d => {
                      const c = vCol(d.v);
                      return <div key={d.l} style={{ padding: 16, borderRadius: 6, background: `${c}10`, border: `2px solid ${c}30` }}><div style={{ fontSize: 12, color: MU, fontWeight: 600, marginBottom: 4 }}>{d.l}</div><div style={{ fontSize: 22, fontWeight: 700, color: c }}>{d.v}</div></div>;
                    })}
                    <div style={{ padding: 16, borderRadius: 6, background: "#1a2030" }}>
                      <div style={{ fontSize: 12, color: MU, fontWeight: 600, marginBottom: 8 }}>CONFIDENCE {curR.confidence}/10</div>
                      <div style={{ display: "flex", gap: 3 }}>{[...Array(10)].map((_, i) => <div key={i} style={{ flex: 1, height: 7, borderRadius: 3, background: i < curR.confidence ? vCol(curR.verdict) : "#1a2030", border: "1px solid #293040" }} />)}</div>
                    </div>
                  </div>

                  {/* Content sections */}
                  <div style={{ display: "grid", gap: 16 }}>
                    {[
                      { l: "CATALYST", v: curR.catalyst, c: "#eab308", icon: "⚡" },
                      { l: "THESIS — PM PITCH", v: curR.thesis, c: AC, icon: "📊", span: true },
                      { l: "TECHNICAL ANALYSIS", v: curR.technicalAnalysis, c: "#06b6d4", icon: "📐", span: true },
                      { l: "PUT SPREAD TRADE", v: curR.putSpreadPitch, c: "#22c55e", icon: "🟢" },
                      { l: "IRON CONDOR TRADE", v: curR.ironCondorPitch, c: "#3b82f6", icon: "🔵" },
                      { l: "POSITION SIZING — $100K ACCOUNT", v: curR.positionSizing, c: "#a78bfa", icon: "📏", span: true },
                      { l: "KEY RISKS", v: curR.risks, c: "#ef4444", icon: "⚠️", span: true },
                    ].map(s => (
                      <div key={s.l} style={{ padding: "18px 20px", background: "#0a0e1a", borderRadius: 6, borderLeft: `3px solid ${s.c}`, gridColumn: s.span ? "1 / -1" : "auto" }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: s.c, marginBottom: 10, display: "flex", alignItems: "center", gap: 8, letterSpacing: "0.02em" }}>
                          <span>{s.icon}</span> {s.l}
                        </div>
                        <Bullets text={s.v} color={s.c} />
                      </div>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
                    {curR.earningsDate && <div style={{ padding: "8px 14px", background: "#eab30810", borderRadius: 5, border: "1px solid #eab30830", fontSize: 14, color: "#eab308", fontWeight: 600 }}>📅 Earnings: {curR.earningsDate}</div>}
                    {curR.analystTarget && <div style={{ padding: "8px 14px", background: `${AC}10`, borderRadius: 5, border: `1px solid ${AC}30`, fontSize: 14, color: AC, fontWeight: 600 }}>🎯 Target: {curR.analystTarget}</div>}
                  </div>

                  {curR.news?.length > 0 && (
                    <div style={{ padding: "16px 18px", background: "#0a0e1a", borderRadius: 6, marginTop: 16 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: MU, marginBottom: 10 }}>KEY HEADLINES</div>
                      {curR.news.map((n, i) => <div key={i} style={{ fontSize: 14, color: T2, padding: "5px 0", borderBottom: i < curR.news.length - 1 ? `1px solid ${BD}` : "none", lineHeight: 1.6 }}>📰 {n}</div>)}
                    </div>
                  )}

                  <div style={{ marginTop: 14, fontSize: 12, color: MU }}>⚠️ Not financial advice · {curR.ts}</div>
                </div>
              ) : rError[curTk] ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 16, color: "#ef4444", fontWeight: 600, marginBottom: 8 }}>⚠️ Research failed for {curTk}</div>
                  <div style={{ fontSize: 14, color: MU, marginBottom: 14 }}>{rError[curTk]}</div>
                  <button onClick={() => analyze(curTk)} style={{ background: AC, color: "#fff", border: "none", padding: "8px 20px", borderRadius: 5, cursor: "pointer", fontSize: 14, fontWeight: 600, ...F }}>⚡ Retry</button>
                </div>
              ) : (
                <div style={{ padding: 60, textAlign: "center", color: MU }}>Select an example or click ⚡ Analyze on any stock</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
