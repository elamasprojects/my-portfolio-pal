/**
 * Historical inflation, as a standalone reference figure.
 *
 * Deliberately reads nothing about the portfolio. Inflation is not applied to any personal
 * number anywhere in this app — the engine that deflated P&L by the IPC index was removed — so
 * everything here is context to look at, never an adjustment to what the user holds.
 */

import type { MonthlyInflationRecord } from "@/types/marketData";

export type InflationPeriod = "1m" | "3m" | "12m" | "36m";

export const INFLATION_PERIODS: { id: InflationPeriod; label: string; months: number }[] = [
  { id: "1m", label: "Último mes", months: 1 },
  { id: "3m", label: "Últimos 3 meses", months: 3 },
  { id: "12m", label: "Último año", months: 12 },
  { id: "36m", label: "Últimos 3 años", months: 36 },
];

export interface InflationPoint {
  /** ISO 'YYYY-MM-01'. */
  month: string;
  /** Month-over-month inflation, as a percentage (7.2 means 7.2%). */
  monthlyRate: number;
}

export interface InflationWindow {
  points: InflationPoint[];
  /**
   * Compounded inflation across the window, as a percentage. Rates compound — they are not
   * summed — so twelve 5% months are 79.6%, not 60%.
   */
  accumulatedPct: number | null;
}

/** Chronological monthly rates, dropping records that carry no usable rate. */
export function toInflationPoints(records: MonthlyInflationRecord[]): InflationPoint[] {
  return records
    .filter((r) => {
      if (!r || typeof r.month !== "string") return false;
      // `Number(null)` is 0 and `Number(undefined)` is NaN, so a null rate would otherwise
      // survive as a measured 0% month. A month with no published rate is dropped, not zeroed.
      if (r.monthly_rate === null || r.monthly_rate === undefined) return false;
      return Number.isFinite(Number(r.monthly_rate));
    })
    .map((r) => ({ month: r.month.slice(0, 10), monthlyRate: Number(r.monthly_rate) }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

/**
 * The last `months` published months, with their compounded total.
 *
 * Returns `accumulatedPct: null` — not 0 — when the window holds no data, so the caller can say
 * "sin datos" instead of showing a measured-looking zero.
 */
export function selectInflationWindow(
  points: InflationPoint[],
  months: number
): InflationWindow {
  const window = points.slice(-Math.max(1, months));

  if (window.length === 0) {
    return { points: [], accumulatedPct: null };
  }

  const compounded = window.reduce((acc, p) => acc * (1 + p.monthlyRate / 100), 1);

  return {
    points: window,
    accumulatedPct: Math.round((compounded - 1) * 100 * 10) / 10,
  };
}
