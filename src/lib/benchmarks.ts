/**
 * Benchmark series for the Game Review counterfactuals.
 *
 * Every function here returns `null` when the underlying series is unavailable for the
 * requested period. That is deliberate: these numbers used to be literal constants (15% for
 * the S&P 500, 20% for CCL) applied identically to a three-day trade and a two-year one, so
 * "beat the benchmark" meant nothing. A null propagates through to "—" in the UI.
 */

import { supabase } from "@/integrations/supabase/client";
import { getCclReturnPct } from "./apiIngestion";

export interface BenchmarkReturnsForPeriod {
  spyReturnPct: number | null;
  cclReturnPct: number | null;
  /** No historical plazo fijo series is wired up yet, so this is always null for now. */
  fixedDepositReturnPct: number | null;
}

interface Candle {
  time: number;
  close: number | null;
}

/** SPY daily closes, fetched once per session. */
let spyCandlesPromise: Promise<Candle[]> | null = null;

export function resetBenchmarkCache(): void {
  spyCandlesPromise = null;
}

async function fetchSpyCandles(): Promise<Candle[]> {
  const { data, error } = await supabase.functions.invoke("stock-history", {
    body: { symbol: "SPY", range: "ALL" },
  });
  if (error || !data?.candles?.length) return [];
  return (data.candles as Candle[]).filter((c) => typeof c.close === "number" && c.close! > 0);
}

function getSpyCandles(): Promise<Candle[]> {
  if (!spyCandlesPromise) {
    // An empty result is a failure, not an answer. Memoising it pinned the whole session to a
    // missing SPY series, and with no benchmark to beat no trade could ever be graded
    // Brillante. Clear the cache so the next caller retries.
    spyCandlesPromise = fetchSpyCandles()
      .then((candles) => {
        if (candles.length === 0) spyCandlesPromise = null;
        return candles;
      })
      .catch(() => {
        spyCandlesPromise = null;
        return [];
      });
  }
  return spyCandlesPromise;
}

/** Most recent close at or before `dateStr`, or null if the series does not reach back that far. */
function closeOnOrBefore(candles: Candle[], dateStr: string): number | null {
  const target = Date.parse(`${dateStr.slice(0, 10)}T23:59:59Z`) / 1000;
  if (Number.isNaN(target)) return null;

  let best: Candle | null = null;
  for (const c of candles) {
    if (c.time <= target && (!best || c.time > best.time)) best = c;
  }
  return best?.close ?? null;
}

/**
 * S&P 500 (SPY) total price return over the holding period, as a percentage.
 * Null when the series does not cover both endpoints.
 */
export async function getSpyReturnPct(
  startDate: string,
  endDate: string
): Promise<number | null> {
  const candles = await getSpyCandles();
  if (candles.length === 0) return null;

  const start = closeOnOrBefore(candles, startDate);
  const end = closeOnOrBefore(candles, endDate);
  if (!start || !end || start <= 0) return null;

  return Math.round(((end - start) / start) * 10000) / 100;
}

/**
 * Resolves every benchmark for one holding period. Each field is independent: a missing SPY
 * series does not suppress a valid CCL figure.
 */
export async function getBenchmarkReturnsForPeriod(
  startDate: string,
  endDate: string
): Promise<BenchmarkReturnsForPeriod> {
  const [spyReturnPct, cclReturnPct] = await Promise.all([
    getSpyReturnPct(startDate, endDate).catch(() => null),
    getCclReturnPct(startDate, endDate).catch(() => null),
  ]);

  return { spyReturnPct, cclReturnPct, fixedDepositReturnPct: null };
}
