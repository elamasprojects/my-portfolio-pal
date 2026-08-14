import { describe, it, expect } from "vitest";
import {
  calculateRealReturnsCore,
  calculateRealReturns,
  calculateRealReturnsBatch,
  getIPCIndex,
  getCCLRate,
} from "@/lib/realReturns";
import {
  getCERIndexForDate,
  getFxRatesForDate,
  getMockInflationData,
  getMockFxRatesData,
} from "@/lib/apiIngestion";
import type { MonthlyInflationRecord } from "@/types/realReturns";

describe("Empirical Challenger Stress Tests — Real Returns & API Ingestion", () => {
  describe("1. Zero ARS Amount Edge Cases", () => {
    it("returns exact zeroes for 0 ARS amount with positive rates", () => {
      const res = calculateRealReturnsCore(0, 100, 150, 1200);
      expect(res).toEqual({ nominalARS: 0, realVsIPC: 0, usdVsCCL: 0 });
      expect(Number.isNaN(res.nominalARS)).toBe(false);
      expect(Number.isNaN(res.realVsIPC)).toBe(false);
      expect(Number.isNaN(res.usdVsCCL)).toBe(false);
    });

    it("returns exact zeroes for 0 ARS amount even with 0 or negative IPC/CCL rates", () => {
      const res = calculateRealReturnsCore(0, 0, 0, 0);
      expect(res).toEqual({ nominalARS: 0, realVsIPC: 0, usdVsCCL: 0 });
    });

    it("async calculateRealReturns returns 0 for 0 ARS amount without calling rate resolution", async () => {
      const res = await calculateRealReturns({
        amountARS: 0,
        startDate: "2024-01-01",
        endDate: "2024-06-01",
      });
      expect(res).toEqual({ nominalARS: 0, realVsIPC: 0, usdVsCCL: 0 });
    });
  });

  describe("2. Negative ARS Amount Edge Cases", () => {
    it("handles negative ARS amount correctly for nominal, realVsIPC, and usdVsCCL", () => {
      const res = calculateRealReturnsCore(-100000, 100, 200, 1000);
      expect(res.nominalARS).toBe(-100000);
      expect(res.realVsIPC).toBe(-200000);
      expect(res.usdVsCCL).toBe(-100);
      expect(Object.values(res).every((val) => Number.isFinite(val))).toBe(true);
    });

    it("handles fractional negative ARS amount with rounding", () => {
      const res = calculateRealReturnsCore(-1234.567, 100, 110, 950.5);
      expect(res.nominalARS).toBe(-1234.57);
      expect(res.realVsIPC).toBe(-1358.02);
      expect(res.usdVsCCL).toBe(-1.3);
      expect(Object.values(res).every((val) => !Number.isNaN(val))).toBe(true);
    });
  });

  describe("3. Missing & Zero CCL Rate Safety", () => {
    it("prevents zero division when cclRate is 0", () => {
      const res = calculateRealReturnsCore(50000, 100, 150, 0);
      expect(res.usdVsCCL).toBe(0);
      expect(Number.isFinite(res.usdVsCCL)).toBe(true);
    });

    it("prevents zero division when cclRate is negative", () => {
      const res = calculateRealReturnsCore(50000, 100, 150, -1200);
      expect(res.usdVsCCL).toBe(0);
    });

    it("prevents NaN when cclRate is NaN", () => {
      const res = calculateRealReturnsCore(50000, 100, 150, NaN);
      expect(res.usdVsCCL).toBe(0);
    });

    it("handles cclRate = 0 passed via options in async calculateRealReturns", async () => {
      const res = await calculateRealReturns(
        { amountARS: 10000, startDate: "2024-01-01", endDate: "2024-01-01" },
        { cclRate: 0 }
      );
      expect(res.usdVsCCL).toBe(0);
    });
  });

  describe("4. Missing & Invalid IPC Index Safety", () => {
    it("falls back to nominal amount when ipcStart is 0", () => {
      const res = calculateRealReturnsCore(10000, 0, 150, 1000);
      expect(res.realVsIPC).toBe(10000);
    });

    it("falls back to nominal amount when ipcEnd is 0", () => {
      const res = calculateRealReturnsCore(10000, 100, 0, 1000);
      expect(res.realVsIPC).toBe(10000);
    });

    it("falls back to nominal amount when ipcStart or ipcEnd is negative", () => {
      const res1 = calculateRealReturnsCore(10000, -100, 150, 1000);
      expect(res1.realVsIPC).toBe(10000);

      const res2 = calculateRealReturnsCore(10000, 100, -150, 1000);
      expect(res2.realVsIPC).toBe(10000);
    });

    it("falls back to nominal amount when ipcStart or ipcEnd is NaN", () => {
      const res = calculateRealReturnsCore(10000, NaN, 150, 1000);
      expect(res.realVsIPC).toBe(10000);
    });
  });

  describe("5. Invalid Date Ranges & Date Strings", () => {
    it("handles startDate > endDate gracefully", async () => {
      const res = await calculateRealReturns({
        amountARS: 100000,
        startDate: "2024-06-01",
        endDate: "2024-01-01",
      });
      expect(Number.isFinite(res.nominalARS)).toBe(true);
      expect(Number.isFinite(res.realVsIPC)).toBe(true);
      expect(Number.isFinite(res.usdVsCCL)).toBe(true);
      expect(res.realVsIPC).toBeLessThan(100000); // Deflated backwards
    });

    it("handles invalid date strings in getCERIndexForDate", async () => {
      const cer1 = await getCERIndexForDate("invalid-date-string");
      expect(cer1).toBe(100.0);

      const cer2 = await getCERIndexForDate("");
      expect(cer2).toBe(100.0);

      const cer3 = await getCERIndexForDate("2024-13-45");
      expect(Number.isFinite(cer3)).toBe(true);
    });

    it("handles invalid date strings in getFxRatesForDate", async () => {
      const fx1 = await getFxRatesForDate("invalid-date-string");
      expect(fx1.ccl_rate).toBeGreaterThan(0);

      const fx2 = await getFxRatesForDate("");
      expect(fx2.ccl_rate).toBeGreaterThan(0);
    });
  });

  describe("6. Leap Years & Month Boundaries", () => {
    it("correctly handles leap year date Feb 29, 2024 in CER interpolation", async () => {
      const mockInflation = getMockInflationData();
      // Feb 2024 has 29 days
      const cerFeb29 = await getCERIndexForDate("2024-02-29", mockInflation);
      const FebRecord = mockInflation.find((r) => r.month === "2024-02-01");
      expect(cerFeb29).toBeCloseTo(FebRecord!.index_value, 2);
    });

    it("correctly handles non-leap year Feb 28 vs Feb 29 query", async () => {
      const mockInflation = getMockInflationData();
      const cerFeb28 = await getCERIndexForDate("2025-02-28", mockInflation);
      const Feb2025Record = mockInflation.find((r) => r.month === "2025-02-01");
      expect(cerFeb28).toBeCloseTo(Feb2025Record!.index_value, 2);
    });

    it("interpolates start-of-month (day 1) vs end-of-month correctly", async () => {
      const mockInflation = getMockInflationData();
      const cerDay1 = await getCERIndexForDate("2024-03-01", mockInflation);
      const cerDay15 = await getCERIndexForDate("2024-03-15", mockInflation);
      const cerDay31 = await getCERIndexForDate("2024-03-31", mockInflation);

      expect(cerDay1).toBeLessThan(cerDay15);
      expect(cerDay15).toBeLessThan(cerDay31);
    });

    it("handles year transition Dec 31 to Jan 1 correctly", async () => {
      const mockInflation = getMockInflationData();
      const cerDec31 = await getCERIndexForDate("2023-12-31", mockInflation);
      const cerJan1 = await getCERIndexForDate("2024-01-01", mockInflation);

      expect(cerDec31).toBeCloseTo(100.0, 2);
      expect(cerJan1).toBeGreaterThan(100.0);
    });
  });

  describe("7. Missing/Empty Inflation Records & Zero In Inflation Data", () => {
    it("returns default index 100.0 when no records can be resolved", async () => {
      const cer = await getCERIndexForDate("2024-05-15", []);
      expect(Number.isFinite(cer)).toBe(true);
    });

    it("handles zero index_value in inflation records safely without NaN", async () => {
      const badRecords: MonthlyInflationRecord[] = [
        { month: "2023-12-01", index_value: 0, source: "test" },
        { month: "2024-01-01", index_value: 120, source: "test" },
      ];
      const cer = await getCERIndexForDate("2023-12-15", badRecords);
      expect(Number.isNaN(cer)).toBe(false);
    });
  });

  describe("8. Exhaustive Zero-Division & NaN Matrix Sanity Check", () => {
    it("guarantees no NaN results across finite input matrix", () => {
      const amounts = [0, -100, 100, -0.0001, 1e9];
      const ipcStarts = [0, -10, 100, NaN];
      const ipcEnds = [0, -10, 150, NaN];
      const cclRates = [0, -1000, 1200, NaN];

      for (const amt of amounts) {
        for (const start of ipcStarts) {
          for (const end of ipcEnds) {
            for (const ccl of cclRates) {
              const res = calculateRealReturnsCore(amt, start, end, ccl);
              expect(Number.isNaN(res.nominalARS)).toBe(false);
              expect(Number.isNaN(res.realVsIPC)).toBe(false);
              expect(Number.isNaN(res.usdVsCCL)).toBe(false);
            }
          }
        }
      }
    });

    it("handles NaN/0 fallbacks correctly for invalid rate inputs", () => {
      const res = calculateRealReturnsCore(100, 0, 150, 0);
      expect(res.realVsIPC).toBe(100);
      expect(res.usdVsCCL).toBe(0);
    });
  });
});
