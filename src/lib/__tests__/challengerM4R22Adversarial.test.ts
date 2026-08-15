import { describe, it, expect } from "vitest";
import {
  auditClosedTrade,
  calculateAggregateAuditMetrics,
  runBatchGameReview,
  ClosedTradeAuditInput,
} from "@/lib/gameReview";
import {
  calculateAggregateMetricsFromAudits,
  resolveAssetCategory,
} from "@/lib/gameReviewMetrics";
import { adjustTradeForSplit } from "@/lib/corporateActions";

describe("Empirical Challenger R2_2 — Category Edge USD, Ticker Resolution & Batch DB Execution", () => {
  // =========================================================================
  // 1. Category Edge USD Across Edge Cases & Datasets
  // =========================================================================
  describe("1. Category Edge USD Calculations", () => {
    it("1.1 Empty batch returns empty categoryEdgeUSD object and zeros", async () => {
      const metrics = await calculateAggregateAuditMetrics([]);
      expect(metrics.totalClosedTrades).toBe(0);
      expect(metrics.blunderCount).toBe(0);
      expect(metrics.blunderRatePercent).toBe(0.0);
      expect(metrics.totalNetCostUSD).toBe(0.0);
      expect(metrics.categoryEdgeUSD).toEqual({});
    });

    it("1.2 Single trade with positive return and positive edge", async () => {
      const trade: ClosedTradeAuditInput = {
        tradeId: "single-pos-1",
        symbol: "AAPL",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 2000,
        quantity: 10,
        holdingPriceAtSellDateARS: 1200,
        cclReturnPct: 1000.0,
      };

      const audit = await auditClosedTrade(trade);
      const metrics = calculateAggregateMetricsFromAudits([trade], [audit]);

      // actualReturn = (2000 - 1000) * 10 = 10000 ARS
      // doNothingReturn = (1200 - 1000) * 10 = 2000 ARS
      // edgeARS = 10000 - 2000 = 8000 ARS
      // edgeUSD = 8000 / 1000 = 8.00 USD
      expect(metrics.totalClosedTrades).toBe(1);
      expect(metrics.categoryEdgeUSD["CEDEARs"]).toBe(8.0);
    });

    it("1.3 Single trade with negative return and negative edge (Panic Loss)", async () => {
      const trade: ClosedTradeAuditInput = {
        tradeId: "single-neg-1",
        symbol: "GGAL",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 500,
        quantity: 10,
        holdingPriceAtSellDateARS: 1500,
        cclReturnPct: 1000.0,
      };

      const audit = await auditClosedTrade(trade);
      const metrics = calculateAggregateMetricsFromAudits([trade], [audit]);

      // actualReturn = (500 - 1000) * 10 = -5000 ARS
      // doNothingReturn = (1500 - 1000) * 10 = 5000 ARS
      // edgeARS = -5000 - 5000 = -10000 ARS
      // edgeUSD = -10000 / 1000 = -10.00 USD
      expect(metrics.categoryEdgeUSD["Acciones Local"]).toBe(-10.0);
    });

    it("1.4 Negative return but POSITIVE edge (Avoided total asset collapse)", async () => {
      const trade: ClosedTradeAuditInput = {
        tradeId: "avoided-collapse-1",
        symbol: "AL30",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 600,
        quantity: 10,
        holdingPriceAtSellDateARS: 0, // Asset went to 0 after trade exit
      };

      // The ARS/USD rate is a separate argument. It used to be read from cclReturnPct, which is
      // a percentage return, so passing 1200 there meant both "1200% vs CCL" and "1200 ARS/USD".
      const audit = await auditClosedTrade(trade, 1200);
      const metrics = calculateAggregateMetricsFromAudits([trade], [audit], 1200);

      // actualReturn = (600 - 1000) * 10 = -4000 ARS
      // doNothingReturn = (0 - 1000) * 10 = -10000 ARS
      // edgeARS = -4000 - (-10000) = +6000 ARS
      // edgeUSD = 6000 / 1200 = 5.00 USD
      expect(metrics.categoryEdgeUSD["Bonds"]).toBe(5.0);
    });

    it("1.5 Large multi-symbol dataset (2,000 trades) aggregates correctly per category", async () => {
      const symbols = [
        { sym: "BTC", cat: "Crypto" },
        { sym: "GGAL.BA", cat: "Acciones Local" },
        { sym: "AL30D", cat: "Bonds" },
        { sym: "NVDA", cat: "CEDEARs" },
      ];

      const trades: ClosedTradeAuditInput[] = Array.from({ length: 2000 }, (_, i) => {
        const item = symbols[i % 4];
        return {
          tradeId: `batch-${i}`,
          symbol: item.sym,
          buyDate: "2024-01-01",
          sellDate: "2024-06-01",
          buyPriceARS: 1000,
          sellPriceARS: i % 2 === 0 ? 1500 : 800,
          quantity: 10,
          holdingPriceAtSellDateARS: i % 2 === 0 ? 1200 : 600,
          cclReturnPct: 1000.0,
        };
      });

      const metrics = await calculateAggregateAuditMetrics(trades);

      expect(metrics.totalClosedTrades).toBe(2000);
      expect(Object.keys(metrics.categoryEdgeUSD)).toEqual(
        expect.arrayContaining(["Crypto", "Acciones Local", "Bonds", "CEDEARs"])
      );

      // Verify no NaN or Infinity in outputs
      Object.values(metrics.categoryEdgeUSD).forEach((val) => {
        expect(Number.isNaN(val)).toBe(false);
        expect(Number.isFinite(val)).toBe(true);
      });
      expect(Number.isNaN(metrics.totalNetCostUSD)).toBe(false);
      expect(Number.isNaN(metrics.blunderRatePercent)).toBe(false);
    });
  });

  // =========================================================================
  // 2. Ticker Resolution & Category Casing Normalization
  // =========================================================================
  describe("2. Ticker Resolution and Casing Normalization", () => {
    it("2.1 Normalizes category casing from declared categories", () => {
      expect(resolveAssetCategory("AAPL", "crypto")).toBe("Crypto");
      expect(resolveAssetCategory("AAPL", "Crypto")).toBe("Crypto");
      expect(resolveAssetCategory("AAPL", "CRYPTO")).toBe("Crypto");
      expect(resolveAssetCategory("AAPL", "  crypto  ")).toBe("Crypto");
      expect(resolveAssetCategory("GGAL", "bonds")).toBe("Bonds");
      expect(resolveAssetCategory("GGAL", "BONDS")).toBe("Bonds");
      expect(resolveAssetCategory("GGAL", "bonos")).toBe("Bonds");
      expect(resolveAssetCategory("AL30", "acciones local")).toBe("Acciones Local");
      expect(resolveAssetCategory("AL30", "acciones")).toBe("Acciones Local");
      expect(resolveAssetCategory("AL30", "cedears")).toBe("CEDEARs");
      expect(resolveAssetCategory("AL30", "cedear")).toBe("CEDEARs");
      expect(resolveAssetCategory("XYZ", "custom category")).toBe("Custom category");
    });

    it("2.2 Strips .BA exchange suffix for ticker resolution", () => {
      expect(resolveAssetCategory("GGAL.BA")).toBe("Acciones Local");
      expect(resolveAssetCategory("YPF.BA")).toBe("Acciones Local");
      expect(resolveAssetCategory("PAMP.BA")).toBe("Acciones Local");
      expect(resolveAssetCategory("AL30.BA")).toBe("Bonds");
      expect(resolveAssetCategory("GD30.BA")).toBe("Bonds");
      expect(resolveAssetCategory("AAPL.BA")).toBe("CEDEARs");
    });

    it("2.3 Resolves D and C settlement codes for local stocks and bonds", () => {
      expect(resolveAssetCategory("AL30D")).toBe("Bonds");
      expect(resolveAssetCategory("AL30C")).toBe("Bonds");
      expect(resolveAssetCategory("GD30D")).toBe("Bonds");
      expect(resolveAssetCategory("GGALD")).toBe("Acciones Local");
      expect(resolveAssetCategory("GGALC")).toBe("Acciones Local");
      expect(resolveAssetCategory("YPFD")).toBe("Acciones Local");
      expect(resolveAssetCategory("PAMPD")).toBe("Acciones Local");
      expect(resolveAssetCategory("BMAD")).toBe("Acciones Local");
    });

    it("2.4 Resolves Crypto tickers accurately", () => {
      expect(resolveAssetCategory("BTC")).toBe("Crypto");
      expect(resolveAssetCategory("btc")).toBe("Crypto");
      expect(resolveAssetCategory("BTCUSDT")).toBe("Crypto");
      expect(resolveAssetCategory("ETH")).toBe("Crypto");
      expect(resolveAssetCategory("SOL")).toBe("Crypto");
      expect(resolveAssetCategory("USDT")).toBe("Crypto");
      expect(resolveAssetCategory("ADA")).toBe("Crypto");
      expect(resolveAssetCategory("DOT")).toBe("Crypto");
    });
  });

  // =========================================================================
  // 3. Batch Database Execution Verification
  // =========================================================================
  describe("3. Batch Database Execution & Error Handling", () => {
    it("3.1 Correctly audits trades from Supabase and upserts game_reviews", async () => {
      let upsertCalled = false;
      let insertedPayload: any[] = [];

      const mockDb = {
        from: (table: string) => {
          if (table === "trades") {
            return {
              select: () => ({
                eq: (field: string, val: string) => {
                  expect(field).toBe("status");
                  expect(val).toBe("closed");
                  return Promise.resolve({
                    data: [
                      {
                        id: "trade-uuid-0",
                        symbol: "GGAL.BA",
                        trade_type: "buy",
                        trade_date: "2024-01-01",
                        price_per_unit: 20,
                        quantity: 50,
                      },
                      {
                        id: "trade-uuid-1",
                        symbol: "GGAL.BA",
                        trade_type: "sell",
                        trade_date: "2024-06-01",
                        price_per_unit: 30,
                        quantity: 50,
                        split_factor: 1.0,
                        target_price_ars: 1800,
                        invalidation_price_ars: 800,
                        is_planned_exit: true,
                      },
                    ],
                    error: null,
                  });
                },
              }),
            };
          }
          if (table === "game_reviews") {
            return {
              upsert: (rows: any[], options: any) => {
                upsertCalled = true;
                insertedPayload = rows;
                expect(options).toEqual({ onConflict: "trade_id" });
                return Promise.resolve({ error: null });
              },
            };
          }
          return {};
        },
      };

      const result = await runBatchGameReview(mockDb, {
        holdPricesUSD: new Map([["GGAL.BA", 25]]),
        userId: "user-1",
      });

      // Only the sell is audited; the buy that funds it is cost basis, not a decision outcome.
      expect(result.totalAudited).toBe(1);
      expect(result.skippedNoPrice).toBe(0);
      expect(upsertCalled).toBe(true);
      expect(insertedPayload).toHaveLength(1);
      expect(insertedPayload[0].trade_id).toBe("trade-uuid-1");
      expect(insertedPayload[0].user_id).toBe("user-1");
      expect(insertedPayload[0].outcome_classification).toBeDefined();
    });

    it("3.2 Handles database connection failure gracefully without throwing", async () => {
      const failingDb = {
        from: () => ({
          select: () => ({
            eq: () => Promise.resolve({ data: null, error: new Error("DB down") }),
          }),
        }),
      };

      const result = await runBatchGameReview(failingDb);
      expect(result).toEqual({ totalAudited: 0, skippedNoPrice: 0, blunderRatePercent: 0, totalNetCostUSD: 0 });
    });

    it("3.3 Handles upsert failure gracefully", async () => {
      const failingUpsertDb = {
        from: (table: string) => {
          if (table === "trades") {
            return {
              select: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: "t-1",
                        symbol: "BTC",
                        buy_price_ars: 100,
                        sell_price_ars: 200,
                        quantity: 1,
                      },
                    ],
                    error: null,
                  }),
              }),
            };
          }
          return {
            upsert: () => Promise.resolve({ error: { message: "Permission denied" } }),
          };
        },
      };

      const result = await runBatchGameReview(failingUpsertDb);
      expect(result).toEqual({ totalAudited: 0, skippedNoPrice: 0, blunderRatePercent: 0, totalNetCostUSD: 0 });
    });
  });
});
