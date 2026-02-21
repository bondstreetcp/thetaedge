import { cacheGet, cacheSet, cacheStatus } from "../../../../lib/cache";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/**
 * Earnings Call YouTube Resolver
 * 
 * Auto-finds earnings call videos on YouTube via Data API v3.
 * Falls back to search URL if no API key or no results.
 * Caches results for 7 days (video IDs don't change).
 * 
 * GET /api/earnings/audio?ticker=NVDA&year=2025&quarter=4
 * POST /api/earnings/audio  { ticker, year, quarter, videoUrl }
 */

const YT_API = "https://www.googleapis.com/youtube/v3/search";
const YT_KEY = process.env.YOUTUBE_API_KEY || "";

// Company names for better YouTube search queries
const COMPANY_NAMES = {
  AAPL: "Apple", MSFT: "Microsoft", GOOGL: "Alphabet Google", AMZN: "Amazon",
  META: "Meta", NVDA: "NVIDIA", TSLA: "Tesla", AVGO: "Broadcom",
  ORCL: "Oracle", CRM: "Salesforce", AMD: "AMD", INTC: "Intel",
  QCOM: "Qualcomm", JPM: "JPMorgan", V: "Visa", MA: "Mastercard",
  BAC: "Bank of America", GS: "Goldman Sachs", UNH: "UnitedHealth",
  LLY: "Eli Lilly", JNJ: "Johnson Johnson", ABBV: "AbbVie", MRK: "Merck",
  PFE: "Pfizer", COST: "Costco", WMT: "Walmart", HD: "Home Depot",
  MCD: "McDonalds", NKE: "Nike", XOM: "ExxonMobil", CVX: "Chevron",
  NFLX: "Netflix", DIS: "Disney", PYPL: "PayPal", UBER: "Uber",
  ABNB: "Airbnb", COIN: "Coinbase", SHOP: "Shopify", BA: "Boeing",
  CAT: "Caterpillar", GE: "GE", PANW: "Palo Alto Networks", SNOW: "Snowflake",
  ADBE: "Adobe", NOW: "ServiceNow", PLTR: "Palantir", CRWD: "CrowdStrike",
  SQ: "Block Square", SOFI: "SoFi", ROKU: "Roku", SNAP: "Snap",
  SPOT: "Spotify", NET: "Cloudflare", DDOG: "Datadog", ZS: "Zscaler",
  TEAM: "Atlassian", TTD: "Trade Desk", MNDY: "monday.com",
};

function buildSearchQuery(ticker, year, quarter) {
  const name = COMPANY_NAMES[ticker] || ticker;
  return `${name} Q${quarter} ${year} earnings call`;
}

function youtubeSearchUrl(ticker, year, quarter) {
  const q = buildSearchQuery(ticker, year, quarter);
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

// Search YouTube Data API v3 for earnings call video
async function searchYouTube(ticker, year, quarter) {
  if (!YT_KEY) return null;

  const q = buildSearchQuery(ticker, year, quarter);
  const params = new URLSearchParams({
    part: "snippet",
    q,
    type: "video",
    maxResults: "3",
    order: "relevance",
    key: YT_KEY,
  });

  try {
    const res = await fetch(`${YT_API}?${params}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();

    if (!data.items?.length) return null;

    // Pick the best match — prefer videos with "earnings" in title
    const best = data.items.find(v =>
      /earnings|quarterly|Q\d/i.test(v.snippet?.title)
    ) || data.items[0];

    return {
      videoId: best.id?.videoId,
      title: best.snippet?.title,
      channel: best.snippet?.channelTitle,
      thumbnail: best.snippet?.thumbnails?.medium?.url || best.snippet?.thumbnails?.default?.url,
      publishedAt: best.snippet?.publishedAt,
    };
  } catch (e) {
    console.error("YouTube API error:", e.message);
    return null;
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");

  if (!ticker) {
    return Response.json({ error: "ticker required" }, { status: 400 });
  }

  const tk = ticker.toUpperCase();
  const now = new Date();
  const year = searchParams.get("year") || now.getFullYear().toString();
  const quarter = searchParams.get("quarter") || Math.ceil((now.getMonth() + 1) / 3).toString();

  const cacheKey = `yt:${tk}:${year}:Q${quarter}`;

  // Check cache first (user-pasted URLs or previous API results)
  const cached = await cacheGet(cacheKey);
  if (cached?.videoId || cached?.videoUrl) {
    return Response.json({
      ticker: tk, year, quarter: parseInt(quarter),
      ...cached,
      source: cached.source || "cached",
      searchUrl: youtubeSearchUrl(tk, year, quarter),
      cache: cacheStatus(),
    });
  }

  // Try YouTube Data API
  const ytResult = await searchYouTube(tk, year, quarter);

  if (ytResult?.videoId) {
    const result = {
      videoId: ytResult.videoId,
      title: ytResult.title,
      channel: ytResult.channel,
      thumbnail: ytResult.thumbnail,
      source: "youtube_api",
    };
    // Cache for 7 days
    await cacheSet(cacheKey, result, 604800);

    return Response.json({
      ticker: tk, year, quarter: parseInt(quarter),
      ...result,
      searchUrl: youtubeSearchUrl(tk, year, quarter),
      cache: cacheStatus(),
    });
  }

  // No API key or no results — return search URL for manual finding
  return Response.json({
    ticker: tk, year, quarter: parseInt(quarter),
    videoId: null,
    source: "none",
    hasApiKey: !!YT_KEY,
    searchUrl: youtubeSearchUrl(tk, year, quarter),
    cache: cacheStatus(),
  });
}

// POST: User pastes a YouTube URL manually
export async function POST(request) {
  try {
    const body = await request.json();
    const { ticker, year, quarter, videoUrl } = body;

    if (!ticker || !videoUrl) {
      return Response.json({ error: "ticker and videoUrl required" }, { status: 400 });
    }

    // Extract YouTube video ID
    const videoId = extractYouTubeId(videoUrl);
    if (!videoId) {
      return Response.json({ error: "Could not extract YouTube video ID from URL" }, { status: 400 });
    }

    const tk = ticker.toUpperCase();
    const yr = year || new Date().getFullYear().toString();
    const q = quarter || Math.ceil((new Date().getMonth() + 1) / 3).toString();
    const cacheKey = `yt:${tk}:${yr}:Q${q}`;

    const result = { videoId, videoUrl, source: "manual" };
    await cacheSet(cacheKey, result, 604800);

    return Response.json({
      success: true, ticker: tk, year: yr, quarter: parseInt(q),
      ...result,
      searchUrl: youtubeSearchUrl(tk, yr, q),
    });
  } catch (e) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}

function extractYouTubeId(url) {
  if (!url) return null;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}
