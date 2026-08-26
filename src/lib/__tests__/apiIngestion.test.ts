import { describe, it, expect } from "vitest";
import {
  getMockInflationData,
  getMockFxRatesData,
  getFxRatesForDate,
  fetchAndCacheInflationIndex,
  fetchAndCacheFxRates,
} from "@/lib/apiIngestion";

describe("API Ingestion (inflation series & FX rates)", () => {
  describe("Mock Data Generators", () => {
    it("returns valid mock inflation series", () => {
      const inflation = getMockInflationData();
      expect(inflation.length).toBeGreaterThan(10);
      expect(inflation[0]).toHaveProperty("month");
      expect(inflation[0]).toHaveProperty("index_value");
      expect(inflation[0].index_value).toBe(100.0);
    });

    it("returns valid mock FX rates series", () => {
      const fxRates = getMockFxRatesData();
      expect(fxRates.length).toBeGreaterThan(10);
      expect(fxRates[0]).toHaveProperty("rate_date");
      expect(fxRates[0]).toHaveProperty("ccl_rate");
      expect(fxRates[0].ccl_rate).toBeGreaterThan(0);
    });
  });

  describe("FX Rate Resolution & Backward Fallback", () => {
    // The series is passed explicitly so these assertions describe the resolution logic
    // rather than whatever the live ArgentinaDatos endpoint happens to return today.
    it("resolves exact daily FX rate when available", async () => {
      const rate = await getFxRatesForDate("2024-01-15", getMockFxRatesData());
      expect(rate.rate_date).toBe("2024-01-15");
      expect(rate.ccl_rate).toBe(1135.0);
    });

    it("falls back to nearest prior date for weekend or missing date", async () => {
      // 2024-01-16 is not in the series, so it should fall back to 2024-01-15
      const rate = await getFxRatesForDate("2024-01-16", getMockFxRatesData());
      expect(rate.rate_date).toBe("2024-01-15");
      expect(rate.ccl_rate).toBe(1135.0);
    });
  });

  describe("Ingestion Strategy & Provenance", () => {
    /**
     * `success` now means "this is measured data", not "the call returned something".
     * A synthetic fallback series must never report success, or callers cannot tell INDEC
     * figures apart from an invented 2%/month projection.
     */
    it("reports inflation provenance and never labels synthetic data as measured", async () => {
      const result = await fetchAndCacheInflationIndex();

      expect(result.data.length).toBeGreaterThan(0);
      expect(["db-cache", "live-api", "mock"]).toContain(result.provenance);
      expect(result.isEstimated).toBe(result.provenance === "mock");
      expect(result.success).toBe(!result.isEstimated);
      if (result.isEstimated) expect(result.error).toBeTruthy();
    });

    it("reports FX provenance and never labels synthetic data as measured", async () => {
      const result = await fetchAndCacheFxRates();

      expect(result.data.length).toBeGreaterThan(0);
      expect(["db-cache", "live-api", "mock"]).toContain(result.provenance);
      expect(result.isEstimated).toBe(result.provenance === "mock");
      expect(result.success).toBe(!result.isEstimated);
      if (result.isEstimated) expect(result.error).toBeTruthy();
    });
  });
});
