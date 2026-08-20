import { supabase } from "@/integrations/supabase/client";
import type {
  MonthlyInflationRecord,
  DailyFxRateRecord,
  IngestionResult,
} from "@/types/marketData";

/**
 * Parses a 'YYYY-MM-DD' string as a LOCAL calendar date.
 *
 * `new Date("2025-03-01")` parses as UTC midnight, but getFullYear/getMonth/getDate read local
 * time. In Argentina (UTC-3) that made every date resolve to the previous day, so a March 1
 * valuation was interpolated against February's IPC pair with dayOfMonth 28-of-28 instead of
 * 1-of-31 — nearly a full month of inflation applied instead of nearly none.
 */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return new Date(NaN);
  return new Date(y, m - 1, d);
}

/**
 * Resolved series are memoised for the page session. Beyond avoiding a full table scan (or a
 * full HTTP fetch of the entire series) on every single date lookup, this guarantees that
 * ipcStart and ipcEnd for one calculation always come from the SAME series. Resolving each
 * lookup independently could mix a DB-cached live series (based at its earliest record) with
 * the mock series (based at Dec 2023), producing a meaningless ipcEnd/ipcStart ratio.
 */
let inflationSeriesPromise: Promise<IngestionResult<MonthlyInflationRecord>> | null = null;
let fxSeriesPromise: Promise<IngestionResult<DailyFxRateRecord>> | null = null;

export function resetIngestionCache(): void {
  inflationSeriesPromise = null;
  fxSeriesPromise = null;
}

export function getInflationSeries(): Promise<IngestionResult<MonthlyInflationRecord>> {
  if (!inflationSeriesPromise) {
    inflationSeriesPromise = fetchAndCacheInflationIndex().catch((err) => {
      inflationSeriesPromise = null;
      throw err;
    });
  }
  return inflationSeriesPromise;
}

export function getFxSeries(): Promise<IngestionResult<DailyFxRateRecord>> {
  if (!fxSeriesPromise) {
    fxSeriesPromise = fetchAndCacheFxRates().catch((err) => {
      fxSeriesPromise = null;
      throw err;
    });
  }
  return fxSeriesPromise;
}

// ==========================================
// 1. DETERMINISTIC MOCK DATASETS (TIER 3)
// ==========================================

export function getMockInflationData(): MonthlyInflationRecord[] {
  return [
    { month: "2023-12-01", index_value: 100.0, monthly_rate: 25.5, source: "mock" },
    { month: "2024-01-01", index_value: 120.6, monthly_rate: 20.6, source: "mock" },
    { month: "2024-02-01", index_value: 136.5192, monthly_rate: 13.2, source: "mock" },
    { month: "2024-03-01", index_value: 151.5363, monthly_rate: 11.0, source: "mock" },
    { month: "2024-04-01", index_value: 164.8745, monthly_rate: 8.8, source: "mock" },
    { month: "2024-05-01", index_value: 171.7992, monthly_rate: 4.2, source: "mock" },
    { month: "2024-06-01", index_value: 179.7020, monthly_rate: 4.6, source: "mock" },
    { month: "2024-07-01", index_value: 186.8901, monthly_rate: 4.0, source: "mock" },
    { month: "2024-08-01", index_value: 194.7395, monthly_rate: 4.2, source: "mock" },
    { month: "2024-09-01", index_value: 201.5554, monthly_rate: 3.5, source: "mock" },
    { month: "2024-10-01", index_value: 206.9974, monthly_rate: 2.7, source: "mock" },
    { month: "2024-11-01", index_value: 212.9933, monthly_rate: 2.9, source: "mock" },
    { month: "2024-12-01", index_value: 218.7441, monthly_rate: 2.7, source: "mock" },
    { month: "2025-01-01", index_value: 224.2127, monthly_rate: 2.5, source: "mock" },
    { month: "2025-02-01", index_value: 229.3696, monthly_rate: 2.3, source: "mock" },
    { month: "2025-03-01", index_value: 234.4151, monthly_rate: 2.2, source: "mock" },
    { month: "2025-04-01", index_value: 239.1034, monthly_rate: 2.0, source: "mock" },
    { month: "2025-05-01", index_value: 243.8855, monthly_rate: 2.0, source: "mock" },
    { month: "2025-06-01", index_value: 248.7632, monthly_rate: 2.0, source: "mock" },
    { month: "2025-07-01", index_value: 253.7385, monthly_rate: 2.0, source: "mock" },
    { month: "2025-08-01", index_value: 258.8132, monthly_rate: 2.0, source: "mock" },
    { month: "2025-09-01", index_value: 263.9895, monthly_rate: 2.0, source: "mock" },
    { month: "2025-10-01", index_value: 269.2693, monthly_rate: 2.0, source: "mock" },
    { month: "2025-11-01", index_value: 274.6547, monthly_rate: 2.0, source: "mock" },
    { month: "2025-12-01", index_value: 280.1478, monthly_rate: 2.0, source: "mock" },
    { month: "2026-01-01", index_value: 285.7507, monthly_rate: 2.0, source: "mock" },
    { month: "2026-02-01", index_value: 291.4657, monthly_rate: 2.0, source: "mock" },
    { month: "2026-03-01", index_value: 297.2950, monthly_rate: 2.0, source: "mock" },
    { month: "2026-04-01", index_value: 303.2409, monthly_rate: 2.0, source: "mock" },
    { month: "2026-05-01", index_value: 309.3057, monthly_rate: 2.0, source: "mock" },
    { month: "2026-06-01", index_value: 315.4919, monthly_rate: 2.0, source: "mock" },
    { month: "2026-07-01", index_value: 321.8017, monthly_rate: 2.0, source: "mock" },
    { month: "2026-08-01", index_value: 328.2377, monthly_rate: 2.0, source: "mock" },
  ];
}

export function getMockFxRatesData(): DailyFxRateRecord[] {
  const dates = [
    { date: "2024-01-02", ccl: 975.0, mep: 950.0, oficial: 820.0 },
    { date: "2024-01-15", ccl: 1135.0, mep: 1100.0, oficial: 835.0 },
    { date: "2024-02-01", ccl: 1240.0, mep: 1200.0, oficial: 845.0 },
    { date: "2024-03-01", ccl: 1070.0, mep: 1040.0, oficial: 860.0 },
    { date: "2024-04-01", ccl: 1085.0, mep: 1050.0, oficial: 875.0 },
    { date: "2024-05-01", ccl: 1140.0, mep: 1110.0, oficial: 890.0 },
    { date: "2024-06-01", ccl: 1260.0, mep: 1230.0, oficial: 910.0 },
    { date: "2024-07-01", ccl: 1400.0, mep: 1370.0, oficial: 930.0 },
    { date: "2024-08-01", ccl: 1310.0, mep: 1280.0, oficial: 950.0 },
    { date: "2024-09-01", ccl: 1260.0, mep: 1230.0, oficial: 970.0 },
    { date: "2024-10-01", ccl: 1190.0, mep: 1160.0, oficial: 990.0 },
    { date: "2024-11-01", ccl: 1150.0, mep: 1120.0, oficial: 1010.0 },
    { date: "2024-12-01", ccl: 1120.0, mep: 1090.0, oficial: 1030.0 },
    { date: "2025-01-01", ccl: 1180.0, mep: 1150.0, oficial: 1050.0 },
    { date: "2025-03-01", ccl: 1220.0, mep: 1190.0, oficial: 1080.0 },
    { date: "2025-06-01", ccl: 1250.0, mep: 1220.0, oficial: 1120.0 },
    { date: "2025-09-01", ccl: 1280.0, mep: 1250.0, oficial: 1160.0 },
    { date: "2025-12-01", ccl: 1300.0, mep: 1270.0, oficial: 1200.0 },
    { date: "2026-01-01", ccl: 1310.0, mep: 1280.0, oficial: 1220.0 },
    { date: "2026-06-01", ccl: 1350.0, mep: 1320.0, oficial: 1260.0 },
    { date: "2026-08-14", ccl: 1380.0, mep: 1350.0, oficial: 1280.0 },
  ];

  return dates.map((d) => ({
    rate_date: d.date,
    ccl_rate: d.ccl,
    mep_rate: d.mep,
    oficial_rate: d.oficial,
    source: "mock",
  }));
}

// ==========================================
// 2. INGESTION & CACHING PIPELINE
// ==========================================

/**
 * Fetch and cache monthly IPC inflation index from ArgentinaDatos.
 * Implements 3-tier fallback strategy (DB -> Live API -> Deterministic Mock).
 */
export async function fetchAndCacheInflationIndex(
  forceRefresh = false
): Promise<IngestionResult<MonthlyInflationRecord>> {
  // Tier 1: Query DB cache
  if (!forceRefresh) {
    try {
      const { data, error } = await supabase
        .from("inflation_index")
        .select("month, index_value, monthly_rate, source, created_at")
        .order("month", { ascending: true });

      if (!error && data && data.length > 0) {
        return {
          success: true,
          data: data as MonthlyInflationRecord[],
          count: data.length,
          fromCache: true,
          provenance: "db-cache",
          isEstimated: false,
        };
      }
    } catch {
      // Ignore cache check errors, proceed to Tier 2
    }
  }

  // Tier 2: Fetch Live Public API
  try {
    const res = await fetch("https://api.argentinadatos.com/v1/finanzas/indices/inflacionMensual");
    if (res.ok) {
      const rawData: Array<{ fecha: string; valor: number }> = await res.json();
      if (Array.isArray(rawData) && rawData.length > 0) {
        // Sort chronologically
        rawData.sort((a, b) => a.fecha.localeCompare(b.fecha));

        // Compute cumulative inflation index (Base 100.0 at Dec 2023 or earliest point)
        let currentIndex = 100.0;
        const records: MonthlyInflationRecord[] = rawData.map((item, idx) => {
          if (idx === 0) {
            currentIndex = 100.0;
          } else {
            currentIndex = currentIndex * (1 + item.valor / 100);
          }

          const monthIso = item.fecha.length === 7 ? `${item.fecha}-01` : item.fecha.slice(0, 10);
          return {
            month: monthIso,
            index_value: Math.round(currentIndex * 10000) / 10000,
            monthly_rate: item.valor,
            source: "argentinadatos_indec",
          };
        });

        // Insert-only: RLS lets a signed-in user extend the shared series but never rewrite
        // a month somebody already recorded, so conflicts are skipped rather than updated.
        // The result was previously discarded entirely, which hid the fact that every write
        // was being rejected and the Tier-1 cache never filled.
        try {
          const { error: cacheError } = await supabase.from("inflation_index").upsert(
            records.map((r) => ({
              month: r.month,
              index_value: r.index_value,
              monthly_rate: r.monthly_rate ?? null,
              source: r.source,
            })),
            { onConflict: "month", ignoreDuplicates: true }
          );
          if (cacheError) {
            console.warn("inflation_index cache write failed:", cacheError.message);
          }
        } catch (e) {
          console.warn("inflation_index cache write threw:", e);
        }

        return {
          success: true,
          data: records,
          count: records.length,
          fromCache: false,
          provenance: "live-api",
          isEstimated: false,
        };
      }
    }
  } catch {
    // API fetch failed, proceed to Tier 3
  }

  // Tier 3: synthetic series. Flagged so callers never present it as measured inflation.
  const mockData = getMockInflationData();
  return {
    success: false,
    data: mockData,
    count: mockData.length,
    fromCache: false,
    provenance: "mock",
    isEstimated: true,
    error: "No INDEC inflation data available (DB cache empty and live API unreachable)",
  };
}

/**
 * Fetch and cache daily CCL, MEP, and Oficial FX rates from ArgentinaDatos & DolarAPI.
 * Implements 3-tier fallback strategy (DB -> Live API -> Deterministic Mock).
 */
export async function fetchAndCacheFxRates(
  startDate?: string,
  endDate?: string,
  forceRefresh = false
): Promise<IngestionResult<DailyFxRateRecord>> {
  // Tier 1: Query DB cache
  if (!forceRefresh) {
    try {
      let query = supabase
        .from("fx_rates")
        .select("rate_date, ccl_rate, mep_rate, oficial_rate, source, created_at")
        .order("rate_date", { ascending: true });

      if (startDate) {
        query = query.gte("rate_date", startDate);
      }
      if (endDate) {
        query = query.lte("rate_date", endDate);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return {
          success: true,
          data: data as DailyFxRateRecord[],
          count: data.length,
          fromCache: true,
          provenance: "db-cache",
          isEstimated: false,
        };
      }
    } catch {
      // Ignore cache check errors, proceed to Tier 2
    }
  }

  // Tier 2: Fetch Live Public APIs
  try {
    const cclRes = await fetch(
      "https://api.argentinadatos.com/v1/cotizaciones/dolares/contadoconliqui"
    );
    if (cclRes.ok) {
      const cclData: Array<{ fecha: string; venta: number }> = await cclRes.json();
      if (Array.isArray(cclData) && cclData.length > 0) {
        const records: DailyFxRateRecord[] = cclData.map((item) => ({
          rate_date: item.fecha.slice(0, 10),
          ccl_rate: item.venta,
          source: "argentinadatos",
        }));

        // Insert-only, same rationale as inflation_index above.
        try {
          const { error: cacheError } = await supabase.from("fx_rates").upsert(
            records.map((r) => ({
              rate_date: r.rate_date,
              ccl_rate: r.ccl_rate,
              mep_rate: r.mep_rate ?? null,
              oficial_rate: r.oficial_rate ?? null,
              source: r.source,
            })),
            { onConflict: "rate_date", ignoreDuplicates: true }
          );
          if (cacheError) {
            console.warn("fx_rates cache write failed:", cacheError.message);
          }
        } catch (e) {
          console.warn("fx_rates cache write threw:", e);
        }

        return {
          success: true,
          data: records,
          count: records.length,
          fromCache: false,
          provenance: "live-api",
          isEstimated: false,
        };
      }
    }
  } catch {
    // API fetch failed, proceed to Tier 3
  }

  // Tier 3: synthetic series. Flagged so callers never present it as measured FX.
  const mockData = getMockFxRatesData();
  return {
    success: false,
    data: mockData,
    count: mockData.length,
    fromCache: false,
    provenance: "mock",
    isEstimated: true,
    error: "No CCL data available (DB cache empty and live API unreachable)",
  };
}

// ==========================================
// 3. FX RATE RESOLUTION ENGINE
// ==========================================

/**
 * Retrieves the daily CCL exchange rate for a target date, walking backwards over weekends
 * and holidays to the most recent published rate.
 *
 * Resolves against the memoised series so that every date in one calculation is read from the
 * same source. Previously this hit the DB directly, never consulted the live API, and fell
 * through to the synthetic table with no signal — so a DB-cached start date could be paired
 * with a fabricated end date.
 */
export async function getFxRatesForDate(
  targetDate: string,
  fxRecords?: DailyFxRateRecord[]
): Promise<DailyFxRateRecord> {
  const cleanDate = targetDate.slice(0, 10);

  const records = fxRecords ?? (await getFxSeries()).data;
  const sorted = [...records].sort((a, b) => b.rate_date.localeCompare(a.rate_date));
  const matched = sorted.find((r) => r.rate_date <= cleanDate && r.ccl_rate > 0);

  if (matched) return matched;

  // Target predates the whole series: use its earliest point rather than inventing a rate.
  const earliest = sorted[sorted.length - 1];
  if (earliest) return earliest;

  return {
    rate_date: cleanDate,
    ccl_rate: 0,
    source: "unavailable",
  };
}

/**
 * CCL return over a holding period, as a percentage — the "bought dollars and slept" benchmark.
 * Returns null when the series is synthetic or the endpoints cannot be resolved, so callers
 * report "no data" instead of a made-up figure.
 */
export async function getCclReturnPct(
  startDate: string,
  endDate: string
): Promise<number | null> {
  const series = await getFxSeries();
  if (series.isEstimated) return null;

  const [start, end] = await Promise.all([
    getFxRatesForDate(startDate),
    getFxRatesForDate(endDate),
  ]);

  if (!start?.ccl_rate || !end?.ccl_rate || start.ccl_rate <= 0) return null;

  return Math.round(((end.ccl_rate - start.ccl_rate) / start.ccl_rate) * 10000) / 100;
}
