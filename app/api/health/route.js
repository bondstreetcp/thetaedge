import { cacheGet, cacheSet, cacheStatus } from "../../../lib/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  // Test cache round-trip
  const testKey = "health:ping";
  const testVal = { ok: true, ts: Date.now() };
  let cacheOk = false;
  try {
    await cacheSet(testKey, testVal, 60);
    const read = await cacheGet(testKey);
    cacheOk = read?.ok === true;
  } catch (e) {
    cacheOk = false;
  }

  return Response.json({
    status: "ok",
    cache: {
      ...cacheStatus(),
      roundTrip: cacheOk,
    },
    env: {
      gemini: !!process.env.GEMINI_API_KEY,
      finnhub: !!process.env.FINNHUB_API_KEY,
      upstash: !!process.env.UPSTASH_REDIS_REST_URL,
    },
    timestamp: new Date().toISOString(),
  });
}
