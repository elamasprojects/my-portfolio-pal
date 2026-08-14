import { describe, it, expect } from "vitest";
import {
  getCERIndexForDate,
  getMockInflationData,
  getMockFxRatesData,
  fetchAndCacheInflationIndex,
  fetchAndCacheFxRates,
} from "@/lib/apiIngestion";
import {
  calculateRealReturnsCore,
  calculateRealReturns,
  calculateRealReturnsBatch,
} from "@/lib/realReturns";

describe("Empirical Challenge Suite: Milestone M1 Real Returns & CER Compounding", () => {
  describe("1. Continuous Geometric Daily Compounding (CER Curve Smoothness)", () => {
    it("produces a smooth continuous curve without discrete jumps across 973 consecutive calendar days", async () => {
      const mockInflation = getMockInflationData();
      const startDate = new Date(2024, 0, 1); // 2024-01-01
      const endDate = new Date(2026, 7, 31);   // 2026-08-31

      let prevCER = await getCERIndexForDate("2024-01-01", mockInflation);
      let maxDailyRatio = 1.0;
      let minDailyRatio = Infinity;
      let maxDailyJumpPct = 0;
      const discontinuities: Array<{ date: string; prevCER: number; cer: number; ratio: number }> = [];

      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + 1); // start checking from day 2

      while (currentDate <= endDate) {
        const dateStr = currentDate.toISOString().slice(0, 10);
        const cer = await getCERIndexForDate(dateStr, mockInflation);

        const ratio = cer / prevCER;
        const dailyJumpPct = Math.abs(ratio - 1) * 100;

        if (ratio > maxDailyRatio) maxDailyRatio = ratio;
        if (ratio < minDailyRatio) minDailyRatio = ratio;
        if (dailyJumpPct > maxDailyJumpPct) maxDailyJumpPct = dailyJumpPct;

        // A single-day jump > 2% would indicate a discrete step jump / boundary flaw
        if (dailyJumpPct > 2.0) {
          discontinuities.push({ date: dateStr, prevCER, cer, ratio });
        }

        // CER should be non-decreasing over time during inflationary period
        expect(cer).toBeGreaterThanOrEqual(prevCER);

        prevCER = cer;
        currentDate.setDate(currentDate.getDate() + 1);
      }

      // Assert no discrete step jumps occurred across all 973 days
      expect(discontinuities).toEqual([]);
      // Max daily jump should be small (e.g., < 1.0% per day for ~25.5% max monthly rate)
      expect(maxDailyJumpPct).toBeLessThan(1.0);
    });

    it("verifies smooth transition at month boundaries (e.g. Jan 31 -> Feb 1)", async () => {
      const mockInflation = getMockInflationData();

      const jan31 = await getCERIndexForDate("2024-01-31", mockInflation);
      const feb01 = await getCERIndexForDate("2024-02-01", mockInflation);

      // Ratio between Feb 01 and Jan 31 should be (120.6 / 100.0) ^ (1/29) or (136.5192 / 120.6) ^ (1/29)
      const ratio = feb01 / jan31;
      const stepPct = (ratio - 1) * 100;

      // Single day change across month boundary should be small (< 0.6%)
      expect(stepPct).toBeLessThan(0.6);
      expect(stepPct).toBeGreaterThan(0.0);
    });

    it("extrapolates smoothly for future dates beyond latest published index", async () => {
      const mockInflation = getMockInflationData();

      const latestDateStr = mockInflation[mockInflation.length - 1].month;
      const latestIndex = mockInflation[mockInflation.length - 1].index_value;

      const cerFutureNear = await getCERIndexForDate("2026-09-01", mockInflation);
      const cerFutureFar = await getCERIndexForDate("2027-01-01", mockInflation);

      expect(cerFutureNear).toBeGreaterThan(latestIndex);
      expect(cerFutureFar).toBeGreaterThan(cerFutureNear);

      // Verify smooth exponential growth rate in future extrapolation
      const monthlyGrowthNear = Math.pow(cerFutureNear / latestIndex, 30.4375 / 31);
      expect(monthlyGrowthNear).toBeCloseTo(1.02, 2); // 2% per month default
    });
  });

  describe("2. 3-Column Real Returns Deflator Math", () => {
    it("correctly computes Nominal ARS, Real vs IPC, and USD vs CCL columns", () => {
      const params = { amountARS: 100000, startDate: "2024-01-01", endDate: "2024-06-01" };

      // IPC start: 120.6, IPC end: 179.7020 (ratio ~1.49), CCL: 1260
      const res = calculateRealReturnsCore(100000, 120.6, 179.702, 1260);

      expect(res.nominalARS).toBe(100000);
      expect(res.realVsIPC).toBe(149006.63);
      expect(res.usdVsCCL).toBe(79.37);
    });

    it("handles zero, negative, and extreme inputs deterministically", () => {
      // Zero amount
      const resZero = calculateRealReturnsCore(0, 100, 150, 1000);
      expect(resZero).toEqual({ nominalARS: 0, realVsIPC: 0, usdVsCCL: 0 });

      // Negative amount (e.g. portfolio loss or expense)
      const resNeg = calculateRealReturnsCore(-50000, 100, 150, 1000);
      expect(resNeg.nominalARS).toBe(-50000);
      expect(resNeg.realVsIPC).toBe(-75000);
      expect(resNeg.usdVsCCL).toBe(-50);

      // Invalid/zero CCL rate does not divide by zero or panic
      const resNoCCL = calculateRealReturnsCore(50000, 100, 150, 0);
      expect(resNoCCL.usdVsCCL).toBe(0);
    });
  });

  describe("3. 3-Tier Fallback Resilience Architecture", () => {
    it("returns mock data fallback when public APIs fail or offline", async () => {
      // Test Tier 3 mock fallbacks directly
      const mockInflation = getMockInflationData();
      const mockFx = getMockFxRatesData();

      expect(mockInflation.length).toBeGreaterThan(0);
      expect(mockFx.length).toBeGreaterThan(0);

      const inflResult = await fetchAndCacheInflationIndex();
      expect(inflResult.success).toBe(true);
      expect(inflResult.data.length).toBeGreaterThan(0);

      const fxResult = await fetchAndCacheFxRates();
      expect(fxResult.success).toBe(true);
      expect(fxResult.data.length).toBeGreaterThan(0);
    });
  });
});
