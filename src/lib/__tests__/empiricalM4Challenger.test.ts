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

describe("Adversarial Challenger 2 — Milestone M4 Empirical Verification", () => {
  // =========================================================================
  // 1. Large Trade Batches Stress Test (5,000 trades)
  // =========================================================================
  describe("1. Large Trade Batches (5,000 trades)", () => {
    it("handles 5,000 trades without timeout, memory leak, or NaN pollution", async () => {
      const largeBatch: ClosedTradeAuditInput[] = Array.from({ length: 5000 }, (_, i) => ({
        tradeId: `trade-${i}`,
        symbol: i % 4 === 0 ? "BTC" : i % 4 === 1 ? "GGAL" : i % 4 === 2 ? "AL30" : "AAPL",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: i % 10 === 0 ? 500 : 1500,
        quantity: 10,
        holdingPriceAtSellDateARS: i % 10 === 0 ? 1800 : 1200,
      }));

      const startTime = performance.now();
      const metrics = await calculateAggregateAuditMetrics(largeBatch);
      const duration = performance.now() - startTime;

      expect(metrics.totalClosedTrades).toBe(5000);
      expect(metrics.blunderCount).toBe(500);
      expect(metrics.blunderRatePercent).toBe(10.0);
      // Cost of trading is signed: the 4,500 winning exits each beat holding by 3,000 ARS
      // (-3.00 USD at the 1000 default rate) and the 500 blunders each cost 13,000 ARS
      // (+13.00 USD), so the batch nets out negative — selling was the right call overall.
      // Clamping this at zero would hide every good exit and only ever report a cost.
      expect(metrics.totalNetCostUSD).toBeCloseTo(4500 * -3 + 500 * 13, 1);
      expect(metrics.totalNetCostUSD).toBeLessThan(0);
      expect(Number.isNaN(metrics.blunderRatePercent)).toBe(false);
      expect(Number.isNaN(metrics.totalNetCostUSD)).toBe(false);
      expect(duration).toBeLessThan(5000);
    });
  });

  // =========================================================================
  // 2. Empty Batches Edge Case Test
  // =========================================================================
  describe("2. Empty Batches Edge Case", () => {
    it("returns clean zero metrics for empty array without division-by-zero or NaN", async () => {
      const metrics = await calculateAggregateAuditMetrics([]);
      expect(metrics).toEqual({
        totalClosedTrades: 0,
        blunderCount: 0,
        blunderRatePercent: 0.0,
        totalNetCostUSD: 0.0,
        categoryEdgeUSD: {},
      });

      const metricsFromAudits = calculateAggregateMetricsFromAudits([], []);
      expect(metricsFromAudits).toEqual({
        totalClosedTrades: 0,
        blunderCount: 0,
        blunderRatePercent: 0.0,
        totalNetCostUSD: 0.0,
        categoryEdgeUSD: {},
      });
    });
  });

  // =========================================================================
  // 3. Single Trade Batch Edge Case Test
  // =========================================================================
  describe("3. Single Trade Batch", () => {
    it("calculates exact single-trade metrics (100% or 0% blunder rate)", async () => {
      const singleTrade: ClosedTradeAuditInput[] = [
        {
          tradeId: "t-single-1",
          symbol: "AAPL",
          buyDate: "2024-01-01",
          sellDate: "2024-06-01",
          buyPriceARS: 1000,
          sellPriceARS: 600,
          quantity: 10,
          holdingPriceAtSellDateARS: 1500,
        },
      ];

      const metrics = await calculateAggregateAuditMetrics(singleTrade);
      expect(metrics.totalClosedTrades).toBe(1);
      expect(metrics.blunderCount).toBe(1);
      expect(metrics.blunderRatePercent).toBe(100.0);
      expect(Object.keys(metrics.categoryEdgeUSD)).toHaveLength(1);
    });
  });

  // =========================================================================
  // 4. Mismatched Asset Categories & Category Edge Audit
  // =========================================================================
  describe("4. Mismatched Asset Categories & Symbol Resolution", () => {
    it("evaluates category resolution for mixed case, ticker variations, and declared categories", () => {
      expect(resolveAssetCategory("btc")).toBe("Crypto");
      expect(resolveAssetCategory("BTCUSDT")).toBe("Crypto");
      expect(resolveAssetCategory("ggal")).toBe("Acciones Local");
      expect(resolveAssetCategory("GGAL.BA")).toBe("Acciones Local");
      expect(resolveAssetCategory("AL30D")).toBe("Bonds");
      expect(resolveAssetCategory("AAPL", "crypto")).toBe("Crypto");
    });

    it("AUDIT FINDING: Checks category edge calculation logic in gameReviewMetrics.ts", async () => {
      const trades: ClosedTradeAuditInput[] = [
        {
          tradeId: "t1",
          symbol: "AAPL",
          buyDate: "2024-01-01",
          sellDate: "2024-06-01",
          buyPriceARS: 1000,
          sellPriceARS: 1500,
          quantity: 10,
          holdingPriceAtSellDateARS: 2000,
        },
      ];

      const audits = [await auditClosedTrade(trades[0])];
      const metrics = calculateAggregateMetricsFromAudits(trades, audits);

      // Category Edge value check (genuine Category Edge calculation: actual (5000) - doNothing (10000) = -5000 ARS / 1000 CCL = -5 USD)
      expect(metrics.categoryEdgeUSD["CEDEARs"]).toBe(-5);
    });
  });

  // =========================================================================
  // 5. Supabase game_reviews Upsert Behavior & Payload Consistency
  // =========================================================================
  describe("5. Supabase game_reviews Upsert & Payload Consistency", () => {
    it("verifies upsert payload shape matches database table columns", async () => {
      let capturedTable = "";
      let capturedRows: any[] = [];
      let capturedOptions: any = null;

      const mockDb = {
        from: (table: string) => {
          capturedTable = table;
          if (table === "trades") {
            return {
              select: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        id: "00000000-0000-0000-0000-0000000000b1",
                        symbol: "AAPL",
                        trade_type: "buy",
                        trade_date: "2024-01-01",
                        price_per_unit: 20,
                        quantity: 10,
                      },
                      {
                        id: "11111111-1111-1111-1111-111111111111",
                        symbol: "AAPL",
                        trade_type: "sell",
                        trade_date: "2024-06-01",
                        price_per_unit: 30,
                        quantity: 10,
                        target_price_ars: 1800,
                        invalidation_condition: "Price below 800",
                        is_planned_exit: true,
                      },
                    ],
                    error: null,
                  }),
              }),
            };
          }
          return {
            upsert: (rows: any[], options: any) => {
              capturedRows = rows;
              capturedOptions = options;
              return Promise.resolve({ data: rows, error: null });
            },
          };
        },
      };

      const result = await runBatchGameReview(mockDb, {
        holdPricesUSD: new Map([["AAPL", 35]]),
        userId: "user-1",
      });

      expect(result.totalAudited).toBe(1);
      expect(capturedRows).toHaveLength(1);
      // Only the sell is audited, and it must carry its owner: game_reviews RLS scopes on user_id.
      expect(capturedRows[0].trade_id).toBe("11111111-1111-1111-1111-111111111111");
      expect(capturedRows[0].user_id).toBe("user-1");
      expect(capturedOptions).toEqual({ onConflict: "trade_id" });

      const payload = capturedRows[0];

      expect(payload).toHaveProperty("trade_id");
      expect(payload).toHaveProperty("do_nothing_return_ars");
      expect(payload).toHaveProperty("spy_return");
      expect(payload).toHaveProperty("ccl_return");
      expect(payload).toHaveProperty("fixed_deposit_return");
      expect(payload).toHaveProperty("outcome_classification");
      expect(payload).toHaveProperty("net_cost_usd");
      expect(payload).toHaveProperty("audited_at");

      expect(payload.trade_id).toBe("11111111-1111-1111-1111-111111111111");
    });

    it("verifies error handling when Supabase query or upsert fails with database error", async () => {
      const errorDb = {
        from: (table: string) => {
          if (table === "trades") {
            return {
              select: () => ({
                eq: () => Promise.resolve({ data: null, error: { message: "Database connection failed" } }),
              }),
            };
          }
          return {
            upsert: () => Promise.resolve({ data: null, error: { message: "RLS violation" } }),
          };
        },
      };

      const result = await runBatchGameReview(errorDb);
      expect(result).toEqual({ totalAudited: 0, skippedNoPrice: 0, blunderRatePercent: 0, totalNetCostUSD: 0 });
    });
  });
});
