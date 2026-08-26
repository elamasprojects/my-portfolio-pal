import { describe, it, expect } from "vitest";
import {
  toInflationPoints,
  selectInflationWindow,
  INFLATION_PERIODS,
} from "@/lib/inflationHistory";
import type { MonthlyInflationRecord } from "@/types/marketData";

function record(month: string, rate: number | null): MonthlyInflationRecord {
  return {
    month,
    index_value: 100,
    monthly_rate: rate as number,
    source: "argentinadatos_indec",
  };
}

describe("toInflationPoints", () => {
  it("sorts chronologically regardless of the order the API returns", () => {
    const points = toInflationPoints([
      record("2026-03-01", 2.1),
      record("2026-01-01", 2.5),
      record("2026-02-01", 1.8),
    ]);

    expect(points.map((p) => p.month)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
  });

  it("drops records with no usable rate instead of reading them as zero", () => {
    const points = toInflationPoints([
      record("2026-01-01", 2.5),
      record("2026-02-01", null),
      record("2026-03-01", 2.1),
    ]);

    // A missing month is absent, not a 0% month — 0% would show as a real reading of no inflation.
    expect(points.map((p) => p.month)).toEqual(["2026-01-01", "2026-03-01"]);
  });
});

describe("selectInflationWindow", () => {
  const twelve = Array.from({ length: 12 }, (_, i) =>
    record(`2026-${String(i + 1).padStart(2, "0")}-01`, 5)
  );

  it("compounds the monthly rates rather than adding them", () => {
    const { accumulatedPct } = selectInflationWindow(toInflationPoints(twelve), 12);

    // 1.05^12 - 1 = 79.6%, not 12 * 5 = 60%.
    expect(accumulatedPct).toBe(79.6);
  });

  it("takes the most recent months, not the earliest", () => {
    const points = toInflationPoints([
      record("2026-01-01", 100),
      record("2026-02-01", 1),
      record("2026-03-01", 2),
    ]);

    const { points: window, accumulatedPct } = selectInflationWindow(points, 2);

    expect(window.map((p) => p.month)).toEqual(["2026-02-01", "2026-03-01"]);
    // 1.01 * 1.02 - 1 = 3.02% — the 100% month is outside the window.
    expect(accumulatedPct).toBe(3);
  });

  it("handles deflation without flipping the sign of the accumulation", () => {
    const points = toInflationPoints([record("2026-01-01", -2), record("2026-02-01", -3)]);
    const { accumulatedPct } = selectInflationWindow(points, 2);

    // 0.98 * 0.97 - 1 = -4.94%
    expect(accumulatedPct).toBe(-4.9);
  });

  it("reports no data as null rather than as 0%", () => {
    const { points, accumulatedPct } = selectInflationWindow([], 12);

    expect(points).toEqual([]);
    expect(accumulatedPct).toBeNull();
  });

  it("returns everything available when the window exceeds the series", () => {
    const points = toInflationPoints(twelve);
    const { points: window } = selectInflationWindow(points, 36);

    expect(window).toHaveLength(12);
  });
});

describe("INFLATION_PERIODS", () => {
  it("covers exactly the four windows the page reports", () => {
    expect(INFLATION_PERIODS.map((p) => p.months)).toEqual([1, 3, 12, 36]);
  });
});
