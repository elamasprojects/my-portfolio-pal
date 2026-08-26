import { describe, it, expect } from "vitest";
import {
  getMockInflationData,
  getMockFxRatesData,
  fetchAndCacheInflationIndex,
  fetchAndCacheFxRates,
} from "@/lib/apiIngestion";

describe("Market-data ingestion", () => {
  describe("3-Tier Fallback Resilience Architecture", () => {
    it("returns mock data fallback when public APIs fail or offline", async () => {
      // Test Tier 3 mock fallbacks directly
      const mockInflation = getMockInflationData();
      const mockFx = getMockFxRatesData();

      expect(mockInflation.length).toBeGreaterThan(0);
      expect(mockFx.length).toBeGreaterThan(0);

      // Tier 3 still yields a usable series so the UI degrades instead of crashing, but it is
      // flagged as an estimate: `success` tracks "measured", not "returned something".
      const inflResult = await fetchAndCacheInflationIndex();
      expect(inflResult.data.length).toBeGreaterThan(0);
      expect(inflResult.success).toBe(!inflResult.isEstimated);
      expect(inflResult.isEstimated).toBe(inflResult.provenance === "mock");

      const fxResult = await fetchAndCacheFxRates();
      expect(fxResult.data.length).toBeGreaterThan(0);
      expect(fxResult.success).toBe(!fxResult.isEstimated);
      expect(fxResult.isEstimated).toBe(fxResult.provenance === "mock");
    });
  });
});
