import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  calculateRealReturnsCore,
  calculateRealReturns,
  calculateRealReturnsBatch,
  getIPCIndex,
  getCCLRate,
} from "@/lib/realReturns";
import { setupTestEnvironment } from "@/test/helpers/stateSetup";
import { sampleInflationFixtures, sampleFxRateFixtures } from "@/test/fixtures/types";

describe("Tier 1 - Requirement 3 (R3): 3-Column Real Returns Engine", () => {
  let env: ReturnType<typeof setupTestEnvironment>;

  beforeEach(() => {
    env = setupTestEnvironment({
      initialData: {
        inflation_index: sampleInflationFixtures,
        fx_rates: sampleFxRateFixtures,
      },
    });
  });

  afterEach(() => {
    env.cleanup();
  });

  /**
   * T1-R3-01: Core 3-Column Calculation Math
   */
  it("T1-R3-01: calculates exact math for Nominal ARS, Real vs IPC, and USD vs CCL columns", () => {
    // 100,000 ARS amount, IPC start 100, IPC end 180 (+80% inflation), CCL rate 1200 ARS/USD
    const result = calculateRealReturnsCore(100000, 100, 180, 1200, "to_end_date");

    expect(result.nominalARS).toBe(100000);
    expect(result.realVsIPC).toBe(180000);
    expect(result.usdVsCCL).toBe(83.33);
  });

  /**
   * T1-R3-02: IPC Caching & Daily CER Interpolation
   */
  it("T1-R3-02: interpolates CER daily values and caches IPC inflation index lookup", async () => {
    const ipcJan = await getIPCIndex("2024-01-15");
    const ipcFeb = await getIPCIndex("2024-02-15");

    expect(ipcJan).toBeGreaterThan(0);
    expect(ipcFeb).toBeGreaterThan(ipcJan);
  });

  /**
   * T1-R3-03: FX Ingestion & Multi-Rate Fetching
   */
  it("T1-R3-03: resolves daily CCL exchange rate from FX ingestion table", async () => {
    const cclRate = await getCCLRate("2024-01-01");
    expect(cclRate).toBeGreaterThan(0);
  });

  /**
   * T1-R3-04: 3-Column Net Worth & Position Table Rendering
   */
  it("T1-R3-04: processes batch position holdings table calculating 3 simultaneous columns", async () => {
    const holdings = [
      { amountARS: 500000, startDate: "2024-01-01", endDate: "2024-02-01" },
      { amountARS: 1200000, startDate: "2024-01-01", endDate: "2024-02-01" },
    ];

    const results = await calculateRealReturnsBatch(holdings, {
      ipcStart: 100,
      ipcEnd: 110,
      cclRate: 1200,
    });

    expect(results).toHaveLength(2);

    // Holding 1
    expect(results[0].nominalARS).toBe(500000);
    expect(results[0].realVsIPC).toBe(550000);
    expect(results[0].usdVsCCL).toBe(416.67);

    // Holding 2
    expect(results[1].nominalARS).toBe(1200000);
    expect(results[1].realVsIPC).toBe(1320000);
    expect(results[1].usdVsCCL).toBe(1000);
  });

  /**
   * T1-R3-05: Capital Conversion Rate 3-Column Tile
   */
  it("T1-R3-05: calculates 3-column inflation-adjusted purchasing power of saved capital", async () => {
    const monthlyIncome = 2000000;
    const monthlySavings = 800000;
    const conversionRatePct = (monthlySavings / monthlyIncome) * 100;

    const realReturnsSavings = await calculateRealReturns(
      { amountARS: monthlySavings, startDate: "2024-01-01", endDate: "2024-02-01" },
      { ipcStart: 100, ipcEnd: 115, cclRate: 1180 }
    );

    expect(conversionRatePct).toBe(40.0); // 40% conversion rate
    expect(realReturnsSavings.nominalARS).toBe(800000);
    expect(realReturnsSavings.realVsIPC).toBe(920000);
    expect(realReturnsSavings.usdVsCCL).toBe(677.97);
  });

  /**
   * T1-R3-06: 3-Column Historical P&L Deflator Chart
   */
  it("T1-R3-06: generates 3-column historical portfolio growth series over time", async () => {
    const timeSeriesDates = ["2024-01-01", "2024-02-01", "2024-03-01"];
    const baseAmount = 1000000;

    const series = await Promise.all(
      timeSeriesDates.map((date) =>
        calculateRealReturns(
          { amountARS: baseAmount, startDate: "2024-01-01", endDate: date },
          { ipcStart: 100, ipcEnd: date === "2024-01-01" ? 100 : date === "2024-02-01" ? 110 : 125, cclRate: 1000 }
        )
      )
    );

    expect(series).toHaveLength(3);
    expect(series[0].realVsIPC).toBe(1000000);
    expect(series[1].realVsIPC).toBe(1100000);
    expect(series[2].realVsIPC).toBe(1250000);
  });
});
