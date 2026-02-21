import yahooFinance from "yahoo-finance2";
import { cacheFetch, cacheGet, cacheSet, cacheStatus } from "../../../lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const FINNHUB_BASE = "https://finnhub.io/api/v1";
const WATCHLIST = [
  "AAPL","MSFT","GOOGL","AMZN","META","NVDA","TSLA","AVGO","ORCL","CRM",
  "AMD","INTC","QCOM","TXN","AMAT","MU","LRCX","ADI",
  "JPM","V","MA","BAC","GS","MS","BLK","C","AXP","SCHW",
  "UNH","LLY","JNJ","ABBV","MRK","PFE","TMO","ABT","AMGN","BMY",
  "COST","WMT","HD","MCD","NKE","SBUX","TGT","LOW",
  "XOM","CVX","COP","CAT","BA","GE","RTX","UNP","HON",
  "NFLX","DIS","CMCSA","TMUS",
  "PYPL","SQ","COIN",
  "SHOP","UBER","ABNB","SNOW","PANW",
];

async function fhFetch(endpoint, params = {}) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) return null;
  const url = new URL(`${FINNHUB_BASE}${endpoint}`);
  url.searchParams.set("token", key);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  try {
    const res = await fetch(url.toString(), { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) { return null; }
}

// ===== CALENDAR: Upcoming earnings for watchlist =====
async function getCalendar() {
  const today = new Date();
  const from = new Date(today.getTime() - 7 * 86400000).toISOString().split("T")[0]; // include recent
  const to = new Date(today.getTime() + 45 * 86400000).toISOString().split("T")[0]; // 45 days ahead
  const data = await fhFetch("/calendar/earnings", { from, to });
  if (!data?.earningsCalendar) return [];

  return data.earningsCalendar
    .filter(e => WATCHLIST.includes(e.symbol))
    .map(e => {
      const dateObj = new Date(e.date);
      const daysUntil = Math.ceil((dateObj - today) / 86400000);
      return {
        ticker: e.symbol,
        date: e.date,
        daysUntil,
        hour: e.hour === "bmo" ? "Pre-Market" : e.hour === "amc" ? "After Close" : e.hour || "TBD",
        epsEstimate: e.epsEstimate,
        epsActual: e.epsActual,
        revenueEstimate: e.revenueEstimate,
        revenueActual: e.revenueActual,
        reported: daysUntil < 0 && e.epsActual != null,
        beat: e.epsActual != null && e.epsEstimate != null ? e.epsActual > e.epsEstimate : null,
        surprise: e.epsActual != null && e.epsEstimate != null && e.epsEstimate !== 0
          ? ((e.epsActual - e.epsEstimate) / Math.abs(e.epsEstimate) * 100)
          : null,
      };
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ===== DETAIL: Full earnings data for a single ticker =====

// Historical EPS beats/misses (Finnhub) — past only (actual reported)
async function getEarningsHistory(ticker) {
  const data = await fhFetch("/stock/earnings", { symbol: ticker, limit: 12 });
  if (!Array.isArray(data)) return [];
  return data
    .filter(e => e.actual != null) // exclude upcoming quarters with no actual
    .map(e => ({
      period: e.period,
      actual: e.actual,
      estimate: e.estimate,
      surprise: e.surprise,
      surprisePct: e.surprisePercent,
      beat: e.actual != null && e.estimate != null ? e.actual > e.estimate : null,
    })).reverse(); // oldest first for charting
}

// Analyst consensus (Finnhub recommendation trends)
async function getAnalystConsensus(ticker) {
  const data = await fhFetch("/stock/recommendation", { symbol: ticker });
  if (!Array.isArray(data) || !data.length) return null;
  const latest = data[0]; // most recent month
  return {
    period: latest.period,
    strongBuy: latest.strongBuy || 0,
    buy: latest.buy || 0,
    hold: latest.hold || 0,
    sell: latest.sell || 0,
    strongSell: latest.strongSell || 0,
    total: (latest.strongBuy || 0) + (latest.buy || 0) + (latest.hold || 0) + (latest.sell || 0) + (latest.strongSell || 0),
    history: data.slice(0, 6).reverse().map(d => ({
      period: d.period,
      strongBuy: d.strongBuy || 0,
      buy: d.buy || 0,
      hold: d.hold || 0,
      sell: d.sell || 0,
      strongSell: d.strongSell || 0,
    })),
  };
}

// Price target consensus (Finnhub)
async function getPriceTargets(ticker) {
  const data = await fhFetch("/stock/price-target", { symbol: ticker });
  if (!data) return null;
  return {
    high: data.targetHigh,
    low: data.targetLow,
    mean: data.targetMean,
    median: data.targetMedian,
    count: data.lastUpdated ? 1 : 0,
  };
}

// Earnings call transcript list (Finnhub) — past calls only
async function getTranscripts(ticker) {
  const data = await fhFetch("/stock/transcripts/list", { symbol: ticker });
  if (!data?.transcripts) return [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

  return data.transcripts
    .filter(t => {
      // Filter by time if available
      if (t.time) {
        const callDate = new Date(t.time);
        if (callDate > now) return false;
      }
      // Also filter by year/quarter for entries without time
      if (t.year && t.quarter) {
        if (t.year > currentYear) return false;
        if (t.year === currentYear && t.quarter > currentQuarter) return false;
        // Even current quarter might not have happened yet
        if (t.year === currentYear && t.quarter === currentQuarter) {
          // Only include if we have a time in the past, otherwise exclude
          if (!t.time) return false;
        }
      }
      return true;
    })
    .slice(0, 8)
    .map(t => ({
      id: t.id,
      title: t.title,
      time: t.time,
      year: t.year,
      quarter: t.quarter,
    }));
}

// Single transcript content (Finnhub)
async function getTranscriptContent(id) {
  const data = await fhFetch("/stock/transcripts", { id });
  if (!data?.transcript) return null;
  // Return full transcript — all sections, full speech text
  const sections = data.transcript.map(s => ({
    name: s.name,
    role: s.role || "",
    speech: s.speech || "",
  }));
  return {
    title: data.title,
    time: data.time,
    participants: data.participant || [],
    sections,
    sectionCount: sections.length,
  };
}

// Historical price moves around earnings dates (Yahoo Finance)
async function getHistoricalMoves(ticker, earningsHistory) {
  if (!earningsHistory.length) return [];
  try {
    // Get 2 years of daily data
    const period1 = new Date(Date.now() - 730 * 86400000).toISOString().split("T")[0];
    const period2 = new Date().toISOString().split("T")[0];
    const hist = await yahooFinance.historical(ticker, { period1, period2, interval: "1d" });
    if (!hist.length) return [];

    // For each earnings date, find the price move
    return earningsHistory.map(e => {
      if (!e.period) return { ...e, move: null };
      const eDate = new Date(e.period);
      // Find the trading day on or just after earnings
      let afterIdx = -1;
      let beforeIdx = -1;
      for (let i = 0; i < hist.length; i++) {
        const d = hist[i].date instanceof Date ? hist[i].date : new Date(hist[i].date);
        if (d >= eDate && afterIdx === -1) afterIdx = i;
        if (d < eDate) beforeIdx = i;
      }
      if (beforeIdx < 0 || afterIdx < 0) return { ...e, move: null };

      const closeBefore = hist[beforeIdx].close;
      const closeAfter = hist[afterIdx].close;
      const highAfter = hist[afterIdx].high;
      const lowAfter = hist[afterIdx].low;

      if (!closeBefore || !closeAfter) return { ...e, move: null };

      const move = ((closeAfter - closeBefore) / closeBefore * 100);
      const maxUp = ((highAfter - closeBefore) / closeBefore * 100);
      const maxDown = ((lowAfter - closeBefore) / closeBefore * 100);

      return {
        ...e,
        move: parseFloat(move.toFixed(2)),
        maxUp: parseFloat(maxUp.toFixed(2)),
        maxDown: parseFloat(maxDown.toFixed(2)),
        closeBefore: parseFloat(closeBefore.toFixed(2)),
        closeAfter: parseFloat(closeAfter.toFixed(2)),
      };
    }).filter(e => e.move != null);
  } catch (err) {
    console.error("Historical moves error:", err.message);
    return [];
  }
}

// Current implied move from options (Yahoo Finance)
async function getImpliedMove(ticker) {
  try {
    const quote = await yahooFinance.quote(ticker);
    const options = await yahooFinance.options(ticker);
    if (!options?.options?.[0] || !quote?.regularMarketPrice) return null;

    const price = quote.regularMarketPrice;
    const chain = options.options[0];
    const expDate = chain.expirationDate;

    // Find ATM straddle
    const calls = chain.calls || [];
    const puts = chain.puts || [];
    if (!calls.length || !puts.length) return null;

    // Find closest-to-ATM strikes
    const sortedCalls = [...calls].sort((a, b) => Math.abs(a.strike - price) - Math.abs(b.strike - price));
    const sortedPuts = [...puts].sort((a, b) => Math.abs(a.strike - price) - Math.abs(b.strike - price));
    const atmCall = sortedCalls[0];
    const atmPut = sortedPuts[0];

    if (!atmCall || !atmPut) return null;

    const straddle = (atmCall.lastPrice || 0) + (atmPut.lastPrice || 0);
    const impliedMovePct = (straddle / price * 100);

    // Calculate DTE
    let dte = null;
    let expiration = null;
    if (expDate) {
      try {
        const exp = expDate instanceof Date ? expDate : new Date(typeof expDate === "number" && expDate < 1e12 ? expDate * 1000 : expDate);
        if (!isNaN(exp.getTime())) {
          dte = Math.ceil((exp - new Date()) / 86400000);
          expiration = exp.toISOString().split("T")[0];
        }
      } catch (e) { /* bad date format */ }
    }

    // IV from ATM options
    const atmIV = ((atmCall.impliedVolatility || 0) + (atmPut.impliedVolatility || 0)) / 2 * 100;

    return {
      price: parseFloat(price.toFixed(2)),
      straddle: parseFloat(straddle.toFixed(2)),
      impliedMovePct: parseFloat(impliedMovePct.toFixed(1)),
      impliedMoveUp: parseFloat((price + straddle).toFixed(2)),
      impliedMoveDown: parseFloat((price - straddle).toFixed(2)),
      atmStrike: atmCall.strike,
      callPrice: atmCall.lastPrice,
      putPrice: atmPut.lastPrice,
      atmIV: parseFloat(atmIV.toFixed(1)),
      dte,
      expiration,
    };
  } catch (err) {
    console.error("Implied move error:", err.message);
    return null;
  }
}

// Revenue estimates (Finnhub)
async function getRevenueEstimates(ticker) {
  const data = await fhFetch("/stock/revenue-estimate", { symbol: ticker, freq: "quarterly" });
  if (!data?.data) return null;
  return data.data.slice(0, 4).map(d => ({
    period: d.period,
    avgEstimate: d.revenueAvg,
    highEstimate: d.revenueHigh,
    lowEstimate: d.revenueLow,
    analysts: d.numberAnalysts,
  }));
}

// EPS estimates (Finnhub)
async function getEPSEstimates(ticker) {
  const data = await fhFetch("/stock/eps-estimate", { symbol: ticker, freq: "quarterly" });
  if (!data?.data) return null;
  return data.data.slice(0, 4).map(d => ({
    period: d.period,
    avgEstimate: d.epsAvg,
    highEstimate: d.epsHigh,
    lowEstimate: d.epsLow,
    analysts: d.numberAnalysts,
  }));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");
  const transcriptId = searchParams.get("transcript");

  // Single transcript fetch
  if (transcriptId) {
    const content = await cacheFetch(
      `transcript:${transcriptId}`,
      3600, // 1 hour cache
      () => getTranscriptContent(transcriptId)
    );
    return Response.json({ transcript: content });
  }

  // Calendar mode: no ticker, return upcoming earnings for watchlist
  if (!ticker) {
    const calendar = await cacheFetch("earnings:calendar", 600, getCalendar); // 10 min cache
    return Response.json({ calendar, cache: cacheStatus() });
  }

  // Detail mode: full earnings analysis for a single ticker
  const today = new Date().toISOString().split("T")[0];
  const cacheKey = `earnings:${ticker.toUpperCase()}:${today}`;

  const cached = await cacheGet(cacheKey);
  if (cached) return Response.json({ ...cached, fromCache: true });

  const hasFH = !!process.env.FINNHUB_API_KEY;

  // Fetch everything in parallel
  const [
    earningsHistory,
    analysts,
    priceTargets,
    transcripts,
    impliedMove,
    revenueEst,
    epsEst,
  ] = await Promise.all([
    hasFH ? cacheFetch(`ephist:${ticker}`, 3600, () => getEarningsHistory(ticker)) : [],
    hasFH ? cacheFetch(`analysts:${ticker}`, 3600, () => getAnalystConsensus(ticker)) : null,
    hasFH ? cacheFetch(`ptarget:${ticker}`, 3600, () => getPriceTargets(ticker)) : null,
    hasFH ? cacheFetch(`transcripts:${ticker}`, 3600, () => getTranscripts(ticker)) : [],
    cacheFetch(`implmv:${ticker}`, 300, () => getImpliedMove(ticker)),
    hasFH ? cacheFetch(`revest:${ticker}`, 3600, () => getRevenueEstimates(ticker)) : null,
    hasFH ? cacheFetch(`epsest:${ticker}`, 3600, () => getEPSEstimates(ticker)) : null,
  ]);

  // Calculate historical moves from Yahoo data
  const historicalMoves = await cacheFetch(
    `hmoves:${ticker}`,
    3600,
    () => getHistoricalMoves(ticker, earningsHistory || [])
  );

  // Compute stats from historical moves
  let moveStats = null;
  if (historicalMoves.length >= 2) {
    const absMoves = historicalMoves.map(m => Math.abs(m.move));
    const avgMove = absMoves.reduce((a, b) => a + b, 0) / absMoves.length;
    const maxMove = Math.max(...absMoves);
    const beats = historicalMoves.filter(m => m.beat === true).length;
    const positiveMoves = historicalMoves.filter(m => m.move > 0).length;
    moveStats = {
      avgAbsMove: parseFloat(avgMove.toFixed(2)),
      maxAbsMove: parseFloat(maxMove.toFixed(2)),
      beatRate: Math.round(beats / historicalMoves.length * 100),
      positiveRate: Math.round(positiveMoves / historicalMoves.length * 100),
      count: historicalMoves.length,
    };
  }

  const result = {
    ticker: ticker.toUpperCase(),
    earningsHistory,
    historicalMoves,
    moveStats,
    impliedMove,
    analysts,
    priceTargets,
    revenueEstimates: revenueEst,
    epsEstimates: epsEst,
    transcripts,
    sources: { finnhub: hasFH, yahoo: true },
    cache: cacheStatus(),
  };

  // Cache the full result for 30 min
  cacheSet(cacheKey, result, 1800).catch(() => {});

  return Response.json(result);
}
