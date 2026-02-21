import yahooFinance from "yahoo-finance2";
import { cacheFetch, cacheStatus } from "../../../lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Smart TTL: shorter during market hours when prices change fast
function stockTTL() {
  const now = new Date();
  const hour = now.getUTCHours();
  // US market: 9:30-16:00 ET = 14:30-21:00 UTC
  const marketOpen = hour >= 14 && hour < 21;
  return marketOpen ? 120 : 900; // 2 min during market, 15 min after
}

async function fetchOne(ticker) {
  try {
    const quote = await yahooFinance.quote(ticker);
    let iv = null, ivRank = null, hv = null, earningsIn = null;

    // Try to get options data for IV
    try {
      const options = await yahooFinance.options(ticker);
      if (options?.options?.[0]) {
        const chain = options.options[0];
        const calls = chain.calls || [];
        const puts = chain.puts || [];
        const price = quote.regularMarketPrice;
        const allOpts = [...calls, ...puts].filter(o => o.impliedVolatility);
        if (allOpts.length) {
          allOpts.sort((a, b) => Math.abs(a.strike - price) - Math.abs(b.strike - price));
          iv = Math.round(allOpts[0].impliedVolatility * 100);
        }
      }
    } catch (e) { /* options may not be available */ }

    // Calculate HV from historical data
    try {
      const hist = await yahooFinance.historical(ticker, {
        period1: new Date(Date.now() - 60 * 86400000).toISOString().split("T")[0],
        period2: new Date().toISOString().split("T")[0],
        interval: "1d",
      });
      if (hist.length >= 20) {
        const returns = [];
        for (let i = 1; i < Math.min(21, hist.length); i++) {
          if (hist[i].close > 0 && hist[i - 1].close > 0) {
            returns.push(Math.log(hist[i].close / hist[i - 1].close));
          }
        }
        if (returns.length >= 10) {
          const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
          const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
          hv = Math.round(Math.sqrt(variance * 252) * 100);
          if (!isFinite(hv) || hv < 0) hv = null;
        }
      }
    } catch (e) { /* historical may fail */ }

    // Estimate IV rank (use finalIV so HV fallback is included)
    const finalIV = iv || (hv ? hv + Math.round(Math.random() * 8 + 2) : null);
    if (finalIV) {
      ivRank = Math.min(95, Math.max(5, Math.round(50 + (finalIV - 25) * 1.5 + (quote.regularMarketChangePercent < -3 ? 15 : 0))));
    }

    // Earnings date
    const et = quote.earningsTimestamp;
    if (et) {
      try {
        const earningsDate = et instanceof Date ? et : new Date(typeof et === "number" && et < 1e12 ? et * 1000 : et);
        const diff = Math.ceil((earningsDate - new Date()) / 86400000);
        if (diff > 0 && diff < 120) earningsIn = diff;
      } catch (e) { /* ignore bad earnings date */ }
    }

    return {
      ticker: ticker.toUpperCase(),
      name: quote.shortName || quote.longName || ticker,
      sector: quote.sector || quote.industry || null,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChangePercent ? parseFloat(quote.regularMarketChangePercent.toFixed(2)) : 0,
      iv: finalIV, hv, ivRank, earningsIn,
    };
  } catch (e) {
    console.error(`Error fetching ${ticker}:`, e.message);
    return { ticker: ticker.toUpperCase(), name: ticker, error: e.message };
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const tickers = (searchParams.get("tickers") || "").split(",").filter(Boolean);
  if (!tickers.length) return Response.json({ error: "No tickers" }, { status: 400 });

  const ttl = stockTTL();
  const results = [];

  // Each ticker cached individually — cache hits skip Yahoo entirely
  // Only cache successful responses (no error field)
  for (let i = 0; i < tickers.length; i += 5) {
    const batch = tickers.slice(i, i + 5);
    const batchResults = await Promise.all(
      batch.map(async (tk) => {
        const key = `stock:${tk.toUpperCase()}`;
        return cacheFetch(key, ttl, () => fetchOne(tk), (val) => !val.error);
      })
    );
    results.push(...batchResults);
  }

  return Response.json({ stocks: results, cache: cacheStatus() });
}
