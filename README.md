# ThetaEdge — Options Screener for Theta Gang

Live S&P 500 options screener for bull put spreads and iron condors. AI-powered trade pitches via Gemini, earnings dashboard, cached with Upstash Redis.

## Tabs

- **Screener** — 65 S&P 500 tickers with live quotes, IV, HV, IV rank, signal scoring, spread pricing
- **News** — Finnhub market/company news, earnings calendar, movers (Yahoo quotes)
- **Earnings** — Full earnings dashboard: calendar, historical EPS, price moves, implied vs realized vol, analyst consensus, transcripts
- **Research** — Gemini AI trade pitches with news context injection, technical analysis, position sizing

## Stack
- **Next.js 14** — App Router, API routes
- **Yahoo Finance** — Live quotes, options chains, historical data, implied moves
- **Finnhub** — Market news, company news, earnings calendar, EPS history, analyst consensus, price targets, transcripts
- **Gemini Pro** — AI research reports (3.0 Pro → 2.5 Pro → 2.0 Pro → Flash fallback chain)
- **Upstash Redis** — Persistent cache layer (optional, falls back to in-memory)

## Setup

```bash
npm install
```

### Environment Variables

Create `.env.local`:

```env
# Required — powers AI research tab
GEMINI_API_KEY=AIzaSy_your_key_here

# Optional — powers news tab (market news, company news, earnings)
FINNHUB_API_KEY=your_finnhub_key_here

# Optional — persistent Redis cache (highly recommended for production)
UPSTASH_REDIS_REST_URL=https://your-db.upstash.io
UPSTASH_REDIS_REST_TOKEN=AXxx_your_token_here
```

### Getting Upstash Redis (free tier = 10K commands/day)

1. Go to [console.upstash.com](https://console.upstash.com)
2. Create a new Redis database (pick the region closest to your Vercel deployment)
3. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` from the dashboard
4. Add them to your `.env.local` (or Vercel environment variables)

Without Upstash, the app still works — it falls back to an in-memory cache that survives ~15 min in warm Vercel instances. But Redis gives you persistent cache across cold starts and all serverless invocations.

### Cache TTLs

| Route | TTL (market hours) | TTL (after hours) | Key pattern |
|-------|-------|-------|-------------|
| `/api/stocks` | 2 min | 15 min | `stock:{TICKER}` |
| `/api/news` | 5 min | 5 min | `news:full` |
| `/api/history` | 1 hour | 1 hour | `hist:{TICKER}:{months}m` |
| `/api/research` | 30 min | 30 min | `research:{TICKER}:{date}:{news\|manual}` |
| `/api/earnings` (calendar) | 10 min | 10 min | `earnings:calendar` |
| `/api/earnings` (detail) | 30 min | 30 min | `earnings:{TICKER}:{date}` |
| `/api/earnings` (sub-data) | 1 hour | 1 hour | `ephist:`, `analysts:`, `transcripts:`, etc. |

### Run locally

```bash
npm run dev
# Open http://localhost:3000
```

### Deploy to Vercel

```bash
git init && git add . && git commit -m "ThetaEdge v1"
# Push to GitHub, import in Vercel, add env vars, deploy
```

### Health Check

Hit `/api/health` to verify cache and API key status:

```json
{
  "status": "ok",
  "cache": { "redis": true, "memEntries": 4, "roundTrip": true },
  "env": { "gemini": true, "finnhub": true, "upstash": true }
}
```

## Architecture

```
Browser → Next.js API Routes → Cache Layer → Yahoo Finance / Finnhub / Gemini
                                    ↓
                          Upstash Redis (persistent)
                          + In-memory Map (L1 fallback)
```

Every API call goes through `cacheFetch()` which checks Redis first, then in-memory, then calls the upstream API. Cache writes are fire-and-forget so they never slow down responses.

## Earnings Dashboard

The Earnings tab provides:

- **Calendar** — Upcoming and recent earnings for all 65 watchlist tickers, grouped by date
- **Implied vs Realized Move** — ATM straddle pricing from Yahoo options vs historical average earnings-day moves. When implied > realized, it flags "SELL PREMIUM"
- **Analyst Consensus** — Buy/Hold/Sell breakdown with price targets (Finnhub)
- **Forward Estimates** — Next 4 quarters EPS and revenue consensus (Finnhub)
- **EPS History** — Interactive chart showing actual vs estimate for last 12 quarters with beat/miss highlighting
- **Post-Earnings Price Moves** — Bar chart of historical next-day moves, colored by beat/miss
- **Earnings Call Transcripts** — Clickable list of past earnings calls with expandable transcript content (Finnhub)

Click any ticker in the calendar → full detail panel. "⚡ Gemini Analysis" button bridges to the Research tab.
