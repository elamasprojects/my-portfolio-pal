/**
 * Types for 3-Column Real Returns Engine & External API Ingestion Pipeline.
 * Project: Chess (Milestone M1)
 */

export interface RealReturnColumns {
  /** Face value in ARS */
  nominalARS: number;
  /** Inflation-adjusted value in ARS (deflated by IPC index ratio) */
  realVsIPC: number;
  /** Converted to USD at CCL exchange rate (amountARS / cclRate) */
  usdVsCCL: number;
}

export interface CalculateRealReturnParams {
  /** Monetary amount in ARS to calculate returns for */
  amountARS: number;
  /** Start date in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ) */
  startDate: string;
  /** End date in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ) */
  endDate: string;
}

export interface RealReturnOptions {
  /** Optional pre-fetched IPC index value at start date */
  ipcStart?: number;
  /** Optional pre-fetched IPC index value at end date */
  ipcEnd?: number;
  /** Optional pre-fetched CCL exchange rate at end date */
  cclRate?: number;
  /** Deflation direction: 'to_end_date' (default: amount * IPC_end / IPC_start) or 'to_start_date' (amount * IPC_start / IPC_end) */
  deflateDirection?: 'to_end_date' | 'to_start_date';
}

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

export interface IngestionResult<T> {
  success: boolean;
  data: T[];
  count: number;
  fromCache: boolean;
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
