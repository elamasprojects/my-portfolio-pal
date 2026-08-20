/**
 * Types for the external market-data ingestion pipeline (inflation series and FX rates).
 *
 * This file used to also carry the 3-column real-returns contract, which deflated portfolio
 * figures by the IPC index. That engine is gone: inflation is no longer applied to any personal
 * number. The monthly series below survives only to feed the standalone inflation chart, which
 * reads no portfolio data at all.
 */

export interface MonthlyInflationRecord {
  /** ISO date string 'YYYY-MM-01' */
  month: string;
  /** Cumulative inflation index level (base 100.0 at Dec 2023) */
  index_value: number;
  /** Monthly % inflation rate (e.g. 20.6 for 20.6%) */
  monthly_rate?: number;
  /** Data source identifier */
  source: string;
  /** Creation timestamp */
  created_at?: string;
}

export interface DailyFxRateRecord {
  /** ISO date string 'YYYY-MM-DD' */
  rate_date: string;
  /** Contado con Liqui rate (ARS / USD) */
  ccl_rate: number;
  /** Dólar MEP rate (ARS / USD) */
  mep_rate?: number;
  /** Dólar Oficial rate (ARS / USD) */
  oficial_rate?: number;
  /** Data source identifier */
  source: string;
  /** Creation timestamp */
  created_at?: string;
}

/**
 * Where a series actually came from.
 *
 * `mock` is synthetic data — an invented series that projects a flat 2%/month. It exists so
 * unit tests are deterministic and so the UI can degrade instead of crashing, but anything
 * derived from it is an estimate, not a measurement. Callers must check this before
 * presenting a number as fact: the result used to report `success: true` with no way to tell
 * INDEC data apart from fabricated data.
 */
export type IngestionProvenance = 'db-cache' | 'live-api' | 'mock';

export interface IngestionResult<T> {
  success: boolean;
  data: T[];
  count: number;
  fromCache: boolean;
  /** Real provenance of `data`. Treat 'mock' as "no data available". */
  provenance: IngestionProvenance;
  /** True when `data` is synthetic and must not be presented as measured. */
  isEstimated: boolean;
  error?: string;
}

export interface IPCIndexPoint {
  month: string;
  indexValue: number;
}

export interface FxRatePoint {
  date: string;
  cclRate: number;
  mepRate?: number;
  oficialRate?: number;
}
