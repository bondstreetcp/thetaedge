import YahooFinance from "yahoo-finance2";
import { cacheGet, cacheSet, cacheStatus } from "../../../lib/cache";

const yahooFinance = new YahooFinance();

export const dynamic = "force-dynamic";
export const maxDuration = 45;

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

function timeAgo(ts) {
  const diff = Date.now() - ts;
  if (diff < 0) {
    const d = Math.ceil(Math.abs(diff) / 86400000);
    return d <= 1 ? "tomorrow" : `in ${d}d`;
  }
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ===== AD / SPAM FILTERS =====
const AD_TITLE_PATTERNS = [
  /^ad:/i,
  /sponsored/i,
  /partner content/i,
  /advertis(ement|ing|er)/i,
  /promoted/i,
  /\bpick(s)?\b.*\bstock(s)?\b/i,
  /\bbest\s+(stock|etf|fund)s?\s+to\s+buy/i,
  /\bmotley\s+fool/i,
  /\bzacks\b.*\b(rank|buy|strong buy)\b/i,
  /unlock\b.*\bpremium/i,
  /sign\s+up\s+(now|today|free)/i,
  /\bsubscribe\b.*\b(now|today|newsletter)/i,
  /\bjoin\s+(now|today|free)/i,
  /\bfree\s+report/i,
  /\b(top|best)\s+\d+\s+(stock|pick|investment)/i,
  /\byou\s+won'?t\s+believe/i,
  /\bsecret\b.*\bstock/i,
  /\bone\s+stock\b.*\byou\s+need/i,
  /\bbargain\s+stock/i,
  /\b(buy|sell)\s+alert/i,
  /\bmarket\s+newsletter/i,
];
const AD_SUMMARY_PATTERNS = [
  /click\s+here/i,
  /sign\s+up/i,
  /limited\s+time/i,
  /free\s+trial/i,
  /exclusive\s+offer/i,
  /subscribe\s+(now|today)/i,
  /unlock\s+(full|premium)/i,
];

function isAdContent(article) {
  const title = article.headline || "";
  const summary = article.summary || "";
  const source = (article.source || "").toLowerCase();
  if (source.includes("partner content") || source.includes("sponsored")) return true;
  if (AD_TITLE_PATTERNS.some(rx => rx.test(title))) return true;
  if (AD_SUMMARY_PATTERNS.some(rx => rx.test(summary))) return true;
  if (title.length < 15) return true;
  return false;
}

async function getMarketNews() {
  const data = await fhFetch("/news", { category: "general", minId: 0 });
  if (!Array.isArray(data)) return [];
  return data
    .filter(a => !isAdContent(a))
    .slice(0, 15)
    .map(a => ({
      id: a.id, type: "market", category: a.category || "general",
      title: a.headline, summary: (a.summary || "").slice(0, 200),
      source: a.source, url: a.url, image: a.image,
      time: new Date(a.datetime * 1000).toISOString(),
      timeAgo: timeAgo(a.datetime * 1000), ticker: null,
    }));
}

async function getCompanyNews(tickers) {
  const today = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0];
  const results = [];
  const PRIORITY = ["NVDA","TSLA","AMZN","META","AAPL","GOOGL","V","COIN","AMD","BA","MSFT","NFLX","DIS","MA","CRM"];
  const toFetch = PRIORITY.filter(t => tickers.includes(t)).slice(0, 15);
  const promises = toFetch.map(ticker =>
    fhFetch("/company-news", { symbol: ticker, from, to: today }).then(data => {
      if (!Array.isArray(data)) return;
      data
        .filter(a => !isAdContent(a))
        .slice(0, 3)
        .forEach(a => results.push({
          id: a.id, type: "company", category: "company news",
          title: a.headline, summary: (a.summary || "").slice(0, 200),
          source: a.source, url: a.url, image: a.image,
          time: new Date(a.datetime * 1000).toISOString(),
          timeAgo: timeAgo(a.datetime * 1000), ticker,
        }));
    })
  );
  await Promise.all(promises);
  return results;
}

async function getEarnings() {
  const today = new Date().toISOString().split("T")[0];
  const next = new Date(Date.now() + 14 * 86400000).toISOString().split("T")[0];
  const data = await fhFetch("/calendar/earnings", { from: today, to: next });
  if (!data?.earningsCalendar) return [];
  return data.earningsCalendar
    .filter(e => WATCHLIST.includes(e.symbol) || (e.revenueEstimate && e.revenueEstimate > 1e9))
    .slice(0, 10)
    .map(e => ({
      id: `earn-${e.symbol}-${e.date}`, type: "earnings", category: "earnings",
      title: `${e.symbol} reports ${e.date}`,
      summary: `EPS est: $${e.epsEstimate?.toFixed(2) || "?"} · Rev est: $${e.revenueEstimate ? (e.revenueEstimate / 1e9).toFixed(1) + "B" : "?"} · ${e.hour === "bmo" ? "Pre-market" : e.hour === "amc" ? "After close" : ""}`,
      source: "Earnings Calendar", time: new Date(e.date).toISOString(),
      timeAgo: timeAgo(new Date(e.date).getTime()), ticker: e.symbol,
    }));
}

async function getMovers() {
  const headlines = [];
  const MOVER_CHECK = [
    "AAPL","MSFT","GOOGL","AMZN","META","NVDA","TSLA","AVGO",
    "AMD","INTC","MU","COIN","V","MA","JPM","GS","BA",
    "NFLX","DIS","NKE","PYPL","SQ","SHOP","UBER","CRM",
  ];
  try {
    for (let i = 0; i < MOVER_CHECK.length; i += 8) {
      const batch = MOVER_CHECK.slice(i, i + 8);
      const quotes = await Promise.all(batch.map(t => yahooFinance.quote(t).catch(() => null)));
      quotes.filter(Boolean).forEach(q => {
        const chg = q.regularMarketChangePercent;
        if (!chg || Math.abs(chg) < 2) return;
        headlines.push({
          id: `mv-${q.symbol}`, type: chg < -3 ? "selloff" : chg > 3 ? "rally" : "mover",
          category: chg < -3 ? "SELL PREMIUM" : chg > 3 ? "Rally" : "Mover",
          title: `${q.shortName || q.symbol} ${chg > 0 ? "+" : ""}${chg.toFixed(1)}%`,
          summary: `$${q.regularMarketPrice?.toFixed(2)} · Vol: ${q.regularMarketVolume ? (q.regularMarketVolume / 1e6).toFixed(1) + "M" : "?"} · ${chg < -3 ? "IV likely elevated — premium selling opp" : chg > 3 ? "Momentum — watch for continuation" : "Notable move"}`,
          source: "Yahoo Finance", ticker: q.symbol, change: parseFloat(chg.toFixed(2)),
          price: q.regularMarketPrice, time: new Date().toISOString(), timeAgo: "today",
        });
      });
    }
  } catch (e) { console.error("Movers error:", e.message); }
  return headlines.sort((a, b) => Math.abs(b.change || 0) - Math.abs(a.change || 0));
}

const NEWS_TTL = 300;

// ===== SEEKING ALPHA RSS =====
// SA provides public RSS feeds — no API key needed
// Per-ticker: https://seekingalpha.com/api/sa/combined/{TICKER}.xml
// Market news: https://seekingalpha.com/market_currents.xml
// Wall St Breakfast: https://seekingalpha.com/tag/wall-st-breakfast.xml

function parseRSSItems(xml) {
  const items = [];
  // Match each <item>...</item> block
  const itemBlocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const block of itemBlocks) {
    const get = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1").trim() : "";
    };
    const title = get("title").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
    const desc = get("description").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#x27;/g, "'").replace(/&quot;/g, '"').slice(0, 250);
    const link = get("link") || get("guid");
    const pubDate = get("pubDate");
    // Extract tickers from <category> tags
    const cats = block.match(/<category[^>]*>([^<]+)<\/category>/gi) || [];
    const tickers = cats.map(c => c.replace(/<[^>]+>/g, "").trim()).filter(t => /^[A-Z]{1,5}$/.test(t));
    if (title) {
      items.push({ title, description: desc, url: link, pubDate, tickers });
    }
  }
  return items;
}

async function fetchRSS(url) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "ThetaEdge/1.0 (RSS Reader)", "Accept": "application/rss+xml, application/xml, text/xml" },
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    const xml = await res.text();
    return parseRSSItems(xml);
  } catch (e) {
    console.error("SA RSS error:", url, e.message);
    return [];
  }
}

async function getSeekingAlphaNews() {
  const results = [];
  const seenTitles = new Set();

  // 1. Market-wide news feed (market currents = breaking headlines)
  const [marketItems, breakfastItems] = await Promise.all([
    fetchRSS("https://seekingalpha.com/market_currents.xml"),
    fetchRSS("https://seekingalpha.com/tag/wall-st-breakfast.xml"),
  ]);

  // 2. Per-ticker feeds for high-priority watchlist (top movers / most-followed)
  const SA_PRIORITY = ["NVDA","TSLA","AMZN","META","AAPL","GOOGL","MSFT","V","AMD","COIN","BA","NFLX"];
  const tickerFeeds = await Promise.all(
    SA_PRIORITY.slice(0, 8).map(tk =>
      fetchRSS(`https://seekingalpha.com/api/sa/combined/${tk}.xml`).then(items =>
        items.map(item => ({ ...item, feedTicker: tk }))
      )
    )
  );

  // Process market currents
  for (const item of [...marketItems, ...breakfastItems].slice(0, 20)) {
    const key = item.title.toLowerCase().slice(0, 60);
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    const ts = item.pubDate ? new Date(item.pubDate) : new Date();
    // Try to find a watchlist ticker mentioned in the title
    const titleTicker = WATCHLIST.find(tk => item.title.includes(tk) || item.tickers.includes(tk));
    results.push({
      id: `sa-mkt-${Date.now()}-${results.length}`,
      type: "seekingalpha",
      category: "SA Market News",
      title: item.title,
      summary: item.description,
      source: "Seeking Alpha",
      url: item.url,
      time: ts.toISOString(),
      timeAgo: timeAgo(ts.getTime()),
      ticker: titleTicker || null,
    });
  }

  // Process per-ticker feeds (analysis articles, earnings recaps, etc.)
  for (const items of tickerFeeds) {
    for (const item of items.slice(0, 3)) { // max 3 per ticker
      const key = item.title.toLowerCase().slice(0, 60);
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      const ts = item.pubDate ? new Date(item.pubDate) : new Date();
      results.push({
        id: `sa-tk-${item.feedTicker}-${results.length}`,
        type: "seekingalpha",
        category: "SA Analysis",
        title: item.title,
        summary: item.description,
        source: "Seeking Alpha",
        url: item.url,
        time: ts.toISOString(),
        timeAgo: timeAgo(ts.getTime()),
        ticker: item.feedTicker,
      });
    }
  }

  return results.sort((a, b) => new Date(b.time) - new Date(a.time));
}

export async function GET() {
  const cached = await cacheGet("news:full");
  if (cached) return Response.json({ ...cached, fromCache: true });

  const hasFH = !!process.env.FINNHUB_API_KEY;
  const [market, company, earnings, movers, seekingAlpha] = await Promise.all([
    hasFH ? getMarketNews() : [],
    hasFH ? getCompanyNews(WATCHLIST) : [],
    hasFH ? getEarnings() : [],
    getMovers(),
    getSeekingAlphaNews(),
  ]);

  const seen = new Set();
  const dedupCo = company.filter(a => { const k = a.title.toLowerCase().slice(0, 50); if (seen.has(k)) return false; seen.add(k); return true; });

  // Dedup SA against Finnhub/Yahoo (avoid duplicate headlines)
  const allTitles = new Set([...market, ...dedupCo].map(a => a.title.toLowerCase().slice(0, 50)));
  const dedupSA = seekingAlpha.filter(a => {
    const k = a.title.toLowerCase().slice(0, 50);
    if (allTitles.has(k)) return false;
    allTitles.add(k);
    return true;
  });

  const result = {
    sections: {
      movers: movers.slice(0, 10),
      market: market.slice(0, 15),
      company: dedupCo.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 20),
      earnings: earnings.slice(0, 10),
      seekingAlpha: dedupSA.slice(0, 20),
    },
    all: [...movers, ...market, ...dedupCo, ...earnings, ...dedupSA]
      .sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 60),
    sources: { finnhub: hasFH, yahoo: true, seekingAlpha: dedupSA.length > 0 },
    updatedAt: new Date().toISOString(),
    cache: cacheStatus(),
  };

  cacheSet("news:full", result, NEWS_TTL).catch(() => {});

  return Response.json(result);
}
