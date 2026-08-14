import { describe, it, expect } from "vitest";
import {
  getMockInflationData,
  getMockFxRatesData,
  getCERIndexForDate,
  getFxRatesForDate,
  fetchAndCacheInflationIndex,
  fetchAndCacheFxRates,
} from "@/lib/apiIngestion";

describe("API Ingestion & CER Daily Inflation Engine", () => {
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

  describe("CER Geometric Inflation Daily Interpolation", () => {
    it("matches month-start index value", async () => {
      const mockInflation = getMockInflationData();
      // Dec 1, 2023 index is 100.0
      const cerDec = await getCERIndexForDate("2023-12-01", mockInflation);
      expect(cerDec).toBeCloseTo(100.0, 2);
    });

    it("geometrically interpolates mid-month CER index (Jan 15, 2024)", async () => {
      const mockInflation = getMockInflationData();
      // Dec 2023: 100.0, Jan 2024: 120.6 (31 days in Jan)
      // Jan 15 CER = 100 * (120.6 / 100) ^ (15 / 31) = 100 * (1.206)^(15/31) ≈ 109.503
      const cerJan15 = await getCERIndexForDate("2024-01-15", mockInflation);
      expect(cerJan15).toBeGreaterThan(100.0);
      expect(cerJan15).toBeLessThan(120.6);
      expect(cerJan15).toBeCloseTo(109.503, 1);
    });

    it("matches month-end index value (Jan 31, 2024)", async () => {
      const mockInflation = getMockInflationData();
      // Jan 31 exponent is 31/31 = 1, so CER equals Jan index (120.6)
      const cerJan31 = await getCERIndexForDate("2024-01-31", mockInflation);
      expect(cerJan31).toBeCloseTo(120.6, 2);
    });

    it("extrapolates continuously for future dates past latest record", async () => {
      const mockInflation = getMockInflationData();
      // Query a date far in the future
      const cerFuture = await getCERIndexForDate("2027-01-01", mockInflation);
      const latestMockIndex = mockInflation[mockInflation.length - 1].index_value;
      expect(cerFuture).toBeGreaterThan(latestMockIndex);
    });

    it("safely handles invalid date format", async () => {
      const cerInvalid = await getCERIndexForDate("invalid-date");
      expect(cerInvalid).toBe(100.0);
    });
  });

  describe("FX Rate Resolution & Backward Fallback", () => {
    it("resolves exact daily FX rate when available", async () => {
      const rate = await getFxRatesForDate("2024-01-15");
      expect(rate.rate_date).toBe("2024-01-15");
      expect(rate.ccl_rate).toBe(1135.0);
    });

    it("falls back to nearest prior date for weekend or missing date", async () => {
      // 2024-01-16 is not in mock dates, should fall back to 2024-01-15
      const rate = await getFxRatesForDate("2024-01-16");
      expect(rate.rate_date).toBe("2024-01-15");
      expect(rate.ccl_rate).toBe(1135.0);
    });
  });

  describe("Ingestion Strategy & Cache Fallbacks", () => {
    it("fetches inflation index and returns success result", async () => {
      const result = await fetchAndCacheInflationIndex();
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it("fetches FX rates and returns success result", async () => {
      const result = await fetchAndCacheFxRates();
      expect(result.success).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });
  });
});
