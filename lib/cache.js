/**
 * ThetaEdge Cache Layer
 * 
 * Uses Upstash Redis on Vercel (persistent across invocations)
 * Falls back to in-memory Map for local dev (persists within warm instances)
 * 
 * Every operation is wrapped in try/catch — cache failures
 * silently fall through to fresh Yahoo/Finnhub fetches.
 */

let redis = null;

function getRedis() {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    try {
      const { Redis } = require("@upstash/redis");
      redis = new Redis({ url, token });
      return redis;
    } catch (e) {
      console.warn("Upstash Redis init failed, using in-memory cache:", e.message);
    }
  }
  return null;
}

// In-memory fallback (survives ~15min in warm Vercel instances)
const mem = new Map();

function memGet(key) {
  const entry = mem.get(key);
  if (!entry) return null;
  if (Date.now() > entry.exp) { mem.delete(key); return null; }
  return entry.val;
}

function memSet(key, val, ttlSec) {
  // Cap in-memory cache at 500 entries to avoid memory leaks
  if (mem.size > 500) {
    const first = mem.keys().next().value;
    mem.delete(first);
  }
  mem.set(key, { val, exp: Date.now() + ttlSec * 1000 });
}

/**
 * Get a cached value by key.
 * Returns parsed JSON or null.
 */
export async function cacheGet(key) {
  try {
    const r = getRedis();
    if (r) {
      const val = await r.get(key);
      return val != null ? val : null;
    }
    return memGet(key);
  } catch (e) {
    // Redis read failed — try memory, never crash
    const fallback = memGet(key);
    if (fallback) return fallback;
    return null;
  }
}

/**
 * Set a cached value with TTL in seconds.
 * Stores in both Redis and memory (memory serves as L1 cache).
 */
export async function cacheSet(key, val, ttlSec) {
  try {
    // Always set in memory as L1 (instant reads within same instance)
    memSet(key, val, ttlSec);

    const r = getRedis();
    if (r) {
      await r.set(key, val, { ex: ttlSec });
    }
  } catch (e) {
    // Redis write failed — memory still has it, no crash
    console.warn("Cache set failed:", e.message);
  }
}

/**
 * Cache-through helper: get from cache, or call fetcher and cache result.
 * Optional shouldCache predicate — if provided, only cache when it returns true.
 * 
 * Usage:
 *   const data = await cacheFetch("stocks:AAPL", 120, () => fetchFromYahoo("AAPL"));
 *   const data = await cacheFetch("stocks:AAPL", 120, () => fetchFromYahoo("AAPL"), (v) => !v.error);
 */
export async function cacheFetch(key, ttlSec, fetcher, shouldCache) {
  const cached = await cacheGet(key);
  if (cached != null) return cached;

  const fresh = await fetcher();
  if (fresh != null && (!shouldCache || shouldCache(fresh))) {
    // Don't await — fire-and-forget cache write to avoid blocking response
    cacheSet(key, fresh, ttlSec).catch(() => {});
  }
  return fresh;
}

/**
 * Cache status — for debugging / health checks
 */
export function cacheStatus() {
  return {
    redis: !!getRedis(),
    memEntries: mem.size,
  };
}
