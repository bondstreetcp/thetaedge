import YahooFinance from "yahoo-finance2";
import { cacheFetch } from "../../../lib/cache";

const yahooFinance = new YahooFinance();

export const dynamic = "force-dynamic";
export const maxDuration = 15;

// 1 hour TTL — historical data barely changes intraday
const HISTORY_TTL = 3600;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get("ticker");
  const months = parseInt(searchParams.get("months") || "12");

  if (!ticker) return Response.json({ error: "No ticker" }, { status: 400 });

  try {
    const data = await cacheFetch(
      `hist:${ticker.toUpperCase()}:${months}m`,
      HISTORY_TTL,
      async () => {
        const period1 = new Date(Date.now() - months * 30 * 86400000).toISOString().split("T")[0];
        const period2 = new Date().toISOString().split("T")[0];

        const hist = await yahooFinance.historical(ticker, {
          period1, period2, interval: "1d",
        });

        return hist
          .filter(d => d.date && d.open != null && d.close != null && d.high != null && d.low != null)
          .map(d => ({
            date: d.date instanceof Date ? d.date.toISOString().split("T")[0] : String(d.date).split("T")[0],
            o: parseFloat(Number(d.open).toFixed(2)),
            h: parseFloat(Number(d.high).toFixed(2)),
            l: parseFloat(Number(d.low).toFixed(2)),
            c: parseFloat(Number(d.close).toFixed(2)),
            v: d.volume || 0,
          }));
      }
    );

    return Response.json({ ticker, data });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
