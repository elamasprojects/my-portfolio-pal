import { describe, it, expect } from "vitest";
import {
  calculateRealReturnsCore,
  calculateRealReturns,
  calculateRealReturnsBatch,
  getIPCIndex,
  getCCLRate,
} from "@/lib/realReturns";

describe("3-Column Real Returns Engine", () => {
  describe("calculateRealReturnsCore (Pure Financial Math)", () => {
    it("returns zero columns when amountARS is 0", () => {
      const res = calculateRealReturnsCore(0, 100, 150, 1200);
      expect(res).toEqual({ nominalARS: 0, realVsIPC: 0, usdVsCCL: 0 });
    });

    it("handles identical start and end dates (IPC ratio = 1.0)", () => {
      const res = calculateRealReturnsCore(100000, 150, 150, 1000);
      expect(res.nominalARS).toBe(100000);
      expect(res.realVsIPC).toBe(100000);
      expect(res.usdVsCCL).toBe(100);
    });

    it("correctly inflates ARS amount under 50% inflation (IPC start 100 -> end 150)", () => {
      // 1,000 ARS invested at start becomes 1,500 ARS in end-date purchasing power
      const res = calculateRealReturnsCore(1000, 100, 150, 1000);
      expect(res.nominalARS).toBe(1000);
      expect(res.realVsIPC).toBe(1500);
      expect(res.usdVsCCL).toBe(1);
    });

    it("correctly converts ARS to USD using CCL exchange rate", () => {
      const res = calculateRealReturnsCore(1250000, 100, 100, 1250);
      expect(res.nominalARS).toBe(1250000);
      expect(res.realVsIPC).toBe(1250000);
      expect(res.usdVsCCL).toBe(1000);
    });

    it("handles negative amounts (expenses / trading losses)", () => {
      const res = calculateRealReturnsCore(-50000, 100, 120, 1000);
      expect(res.nominalARS).toBe(-50000);
      expect(res.realVsIPC).toBe(-60000);
      expect(res.usdVsCCL).toBe(-50);
    });

    it("safely handles zero or negative CCL rate without throwing DivisionByZero error", () => {
      const resZero = calculateRealReturnsCore(10000, 100, 100, 0);
      expect(resZero.usdVsCCL).toBe(0);

      const resNeg = calculateRealReturnsCore(10000, 100, 100, -500);
      expect(resNeg.usdVsCCL).toBe(0);
    });

    it("safely handles missing/invalid IPC index (ipcStart = 0 or ipcEnd = 0)", () => {
      const res = calculateRealReturnsCore(10000, 0, 150, 1000);
      expect(res.realVsIPC).toBe(10000); // Falls back to nominal
    });

    it("supports 'to_start_date' deflation direction", () => {
      // 1,500 ARS at end date deflated to start date purchasing power (50% inflation) = 1,000 ARS
      const res = calculateRealReturnsCore(1500, 100, 150, 1000, "to_start_date");
      expect(res.realVsIPC).toBe(1000);
    });
  });

  describe("calculateRealReturns (Async & Options Injection)", () => {
    it("calculates real returns using injected options (bypassing DB)", async () => {
      const params = {
        amountARS: 500000,
        startDate: "2026-01-01",
        endDate: "2026-06-01",
      };
      const res = await calculateRealReturns(params, {
        ipcStart: 100,
        ipcEnd: 200,
        cclRate: 1250,
      });

      expect(res.nominalARS).toBe(500000);
      expect(res.realVsIPC).toBe(1000000);
      expect(res.usdVsCCL).toBe(400);
    });

    it("processes batch requests correctly", async () => {
      const batchParams = [
        { amountARS: 100000, startDate: "2026-01-01", endDate: "2026-01-01" },
        { amountARS: 200000, startDate: "2026-01-01", endDate: "2026-06-01" },
      ];
      const results = await calculateRealReturnsBatch(batchParams, {
        ipcStart: 100,
        ipcEnd: 150,
        cclRate: 1000,
      });

      expect(results).toHaveLength(2);
      expect(results[0].realVsIPC).toBe(150000);
      expect(results[1].realVsIPC).toBe(300000);
    });

    it("resolves default index and rate lookups when options are omitted", async () => {
      const params = {
        amountARS: 100000,
        startDate: "2024-01-01",
        endDate: "2024-06-01",
      };
      const res = await calculateRealReturns(params);
      expect(res.nominalARS).toBe(100000);
      expect(res.realVsIPC).toBeGreaterThan(100000);
      expect(res.usdVsCCL).toBeGreaterThan(0);
    });

    it("resolves getIPCIndex and getCCLRate helper functions", async () => {
      const ipc = await getIPCIndex("2024-01-15");
      expect(ipc).toBeGreaterThan(100);

      const ccl = await getCCLRate("2024-01-15");
      expect(ccl).toBeGreaterThan(500);
    });
  });
});
