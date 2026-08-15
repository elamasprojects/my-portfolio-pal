import { describe, it, expect } from "vitest";
import {
  auditClosedTrade,
  calculateAggregateAuditMetrics,
  runBatchGameReview,
  ClosedTradeAuditInput,
  CorporateActionSplit,
} from "@/lib/gameReview";
import {
  calculateCumulativeSplitFactor,
  adjustTradeForSplit,
  applyCorporateActionsToTrades,
} from "@/lib/corporateActions";
import { calculateCounterfactuals } from "@/lib/counterfactuals";
import { classifyTradeOutcome } from "@/lib/gameReviewClassifier";
import { calculateAggregateMetricsFromAudits, resolveAssetCategory } from "@/lib/gameReviewMetrics";

describe("Retroactive Game Review Engine & Counterfactual Audit System (Unit Tests)", () => {
  // =========================================================================
  // 1. Corporate Actions & Stock Split Adjustments
  // =========================================================================
  describe("1. Corporate Actions & Stock Splits", () => {
    it("preserves total capital outlay across split adjustment (Q_adj * P_adj === Q * P)", () => {
      const input: ClosedTradeAuditInput = {
        tradeId: "t-split-1",
        symbol: "AAPL",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 200,
        sellPriceARS: 120,
        quantity: 100,
        splitFactor: 2.0, // 2:1 split
      };

      const adjusted = adjustTradeForSplit(input);

      expect(adjusted.quantity).toBe(200);
      expect(adjusted.buyPriceARS).toBe(100);
      expect(adjusted.quantity * adjusted.buyPriceARS).toBe(100 * 200);
    });

    it("calculates cumulative split factors across multiple corporate action events", () => {
      const splits: CorporateActionSplit[] = [
        { symbol: "NVDA", splitDate: "2024-03-01", ratio: 2.0 },
        { symbol: "NVDA", splitDate: "2024-05-01", ratio: 5.0 },
      ];

      // Trade executed before both splits -> cumulative factor = 2.0 * 5.0 = 10.0
      const factorBeforeBoth = calculateCumulativeSplitFactor("NVDA", "2024-01-01", splits);
      expect(factorBeforeBoth).toBe(10.0);

      // Trade executed between splits -> factor = 5.0
      const factorBetween = calculateCumulativeSplitFactor("NVDA", "2024-04-01", splits);
      expect(factorBetween).toBe(5.0);

      // Trade executed after all splits -> factor = 1.0
      const factorAfterAll = calculateCumulativeSplitFactor("NVDA", "2024-06-01", splits);
      expect(factorAfterAll).toBe(1.0);
    });

    it("pre-adjusts trade log entries prior to FIFO matching", () => {
      const rawTrades = [
        { symbol: "AAPL", buyDate: "2024-01-01", quantity: 10, buyPriceARS: 100 },
        { symbol: "AAPL", buyDate: "2024-06-01", quantity: 20, buyPriceARS: 50 },
      ];

      const splits: CorporateActionSplit[] = [
        { symbol: "AAPL", splitDate: "2024-03-01", ratio: 2.0 },
      ];

      const adjustedTrades = applyCorporateActionsToTrades(rawTrades, splits);

      // Trade 1 (before split): qty scaled x 2 = 20, price scaled / 2 = 50
      expect(adjustedTrades[0].quantity).toBe(20);
      expect(adjustedTrades[0].buyPriceARS).toBe(50);

      // Trade 2 (after split): unchanged
      expect(adjustedTrades[1].quantity).toBe(20);
      expect(adjustedTrades[1].buyPriceARS).toBe(50);
    });
  });

  // =========================================================================
  // 2. Counterfactual Calculations (Do-Nothing, Benchmarks, Strategy Adherence)
  // =========================================================================
  describe("2. Counterfactual Calculations", () => {
    it("calculates 'Do Nothing' counterfactual return and net trading opportunity cost", () => {
      const tradeInput: ClosedTradeAuditInput = {
        tradeId: "t-dn-1",
        symbol: "MSFT",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 1400,
        quantity: 50,
        holdingPriceAtSellDateARS: 1800,
      };

      const cf = calculateCounterfactuals(tradeInput, 1000.0);

      // Actual realized return: (1400 - 1000) * 50 = 20,000 ARS
      expect(cf.actualTotalReturnARS).toBe(20000);

      // Do-Nothing return: (1800 - 1000) * 50 = 40,000 ARS
      expect(cf.doNothingReturnARS).toBe(40000);

      // Opportunity cost: 40,000 - 20,000 = 20,000 ARS = $20.00 USD @ 1000 CCL
      expect(cf.opportunityCostARS).toBe(20000);
      expect(cf.netCostUSD).toBe(20.0);
    });

    it("computes relative alpha vs SPY, CCL, and compounding Plazo Fijo", () => {
      const tradeInput: ClosedTradeAuditInput = {
        tradeId: "t-bench-1",
        symbol: "CEDEAR",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 1500, // +50% actual return
        quantity: 10,
        spyReturnPct: 15.0,
        cclReturnPct: 20.0,
        fixedDepositReturnPct: 10.0,
      };

      const cf = calculateCounterfactuals(tradeInput);

      expect(cf.actualReturnPct).toBe(50.0);
      expect(cf.alphas.spyAlpha).toBe(35.0); // 50 - 15
      expect(cf.alphas.cclAlpha).toBe(30.0); // 50 - 20
      expect(cf.alphas.fixedDepositAlpha).toBe(40.0); // 50 - 10
    });

    it("evaluates strategy adherence against target price and invalidation stop", () => {
      const tradeInput: ClosedTradeAuditInput = {
        tradeId: "t-strat-1",
        symbol: "MELI",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 1950,
        quantity: 10,
        targetPriceARS: 2000, // Sold at 1950 (97.5% of target)
        invalidationPriceARS: 800,
        isPlannedExit: true,
      };

      const cf = calculateCounterfactuals(tradeInput);

      expect(cf.strategyAdherence.targetHit).toBe(true);
      expect(cf.strategyAdherence.invalidationHit).toBe(false);
      expect(cf.strategyAdherence.isPlannedExit).toBe(true);
    });
  });

  // =========================================================================
  // 3. Outcome Taxonomy Classifier Rules
  // =========================================================================
  describe("3. Outcome Taxonomy Classifier", () => {
    it("classifies trade as 'Brillante' when outperforming SPY & CCL and reaching target", () => {
      const trade: ClosedTradeAuditInput = {
        tradeId: "t-brillante",
        symbol: "NVDA",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 2000, // +100%
        quantity: 10,
        targetPriceARS: 1800,
        spyReturnPct: 15.0,
        cclReturnPct: 20.0,
      };

      const cf = calculateCounterfactuals(trade);
      const outcome = classifyTradeOutcome(trade, cf);

      expect(outcome).toBe("Brillante");
    });

    it("classifies trade as 'Correcta' when yielding positive return above Plazo Fijo", () => {
      const trade: ClosedTradeAuditInput = {
        tradeId: "t-correcta",
        symbol: "GGAL",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 1100, // +10%
        quantity: 10,
        fixedDepositReturnPct: 5.0,
        spyReturnPct: 15.0,
      };

      const cf = calculateCounterfactuals(trade);
      const outcome = classifyTradeOutcome(trade, cf);

      expect(outcome).toBe("Correcta");
    });

    it("classifies trade as 'Imprecision' when premature exit occurs below target price", () => {
      const trade: ClosedTradeAuditInput = {
        tradeId: "t-imprecision",
        symbol: "PAMP",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 1050, // +5%
        quantity: 10,
        targetPriceARS: 1800, // Target was 1800, sold prematurely at 1050 (<85% of target)
        spyReturnPct: 15.0,
      };

      const cf = calculateCounterfactuals(trade);
      const outcome = classifyTradeOutcome(trade, cf);

      expect(outcome).toBe("Imprecision");
    });

    it("classifies trade as 'Blunder' when panic selling at loss while holding would yield profit", () => {
      const trade: ClosedTradeAuditInput = {
        tradeId: "t-blunder",
        symbol: "YPF",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 700, // -30% panic loss
        quantity: 10,
        holdingPriceAtSellDateARS: 1500, // Holding would yield +50%
      };

      const cf = calculateCounterfactuals(trade);
      const outcome = classifyTradeOutcome(trade, cf);

      expect(outcome).toBe("Blunder");
    });

    it("classifies trade as 'Blunder' when unplanned exit violates invalidation stop", () => {
      const trade: ClosedTradeAuditInput = {
        tradeId: "t-blunder-stop",
        symbol: "BMA",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 750,
        quantity: 10,
        invalidationPriceARS: 850,
        isPlannedExit: false,
      };

      const cf = calculateCounterfactuals(trade);
      const outcome = classifyTradeOutcome(trade, cf);

      expect(outcome).toBe("Blunder");
    });
  });

  // =========================================================================
  // 4. Aggregate Audit Metrics Engine
  // =========================================================================
  describe("4. Aggregate Audit Metrics", () => {
    it("computes blunder rate %, total net cost USD, and asset category breakdown", async () => {
      const trades: ClosedTradeAuditInput[] = [
        {
          tradeId: "t1",
          symbol: "AAPL",
          buyDate: "2024-01-01",
          sellDate: "2024-02-01",
          buyPriceARS: 1000,
          sellPriceARS: 1500,
          quantity: 10,
        },
        {
          tradeId: "t2",
          symbol: "BTCUSDT",
          buyDate: "2024-01-01",
          sellDate: "2024-02-01",
          buyPriceARS: 1000,
          sellPriceARS: 600, // Blunder
          quantity: 10,
          holdingPriceAtSellDateARS: 1400,
        },
      ];

      const metrics = await calculateAggregateAuditMetrics(trades);

      expect(metrics.totalClosedTrades).toBe(2);
      expect(metrics.blunderCount).toBe(1);
      expect(metrics.blunderRatePercent).toBe(50.0);
      expect(metrics.totalNetCostUSD).toBeGreaterThan(0);
      expect(metrics.categoryEdgeUSD).toBeDefined();
      expect(resolveAssetCategory("BTCUSDT")).toBe("Crypto");
      expect(resolveAssetCategory("AAPL")).toBe("CEDEARs");
    });

    it("handles empty trade sets gracefully without division-by-zero errors", async () => {
      const metrics = await calculateAggregateAuditMetrics([]);

      expect(metrics.totalClosedTrades).toBe(0);
      expect(metrics.blunderCount).toBe(0);
      expect(metrics.blunderRatePercent).toBe(0.0);
      expect(metrics.totalNetCostUSD).toBe(0.0);
      expect(metrics.categoryEdgeUSD).toEqual({});
    });
  });

  // =========================================================================
  // 5. Batch Engine & Façade Integration
  // =========================================================================
  describe("5. Batch Engine & Façade Integration", () => {
    it("audits closed trade through high-level façade", async () => {
      const tradeInput: ClosedTradeAuditInput = {
        tradeId: "t-facade-1",
        symbol: "SPY",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 1300,
        quantity: 20,
      };

      const audit = await auditClosedTrade(tradeInput);

      expect(audit.doNothingReturnARS).toBe(6000);
      expect(audit.benchmarkReturns).toBeDefined();
      expect(audit.outcomeClassification).toBeDefined();
      expect(audit.netCostOfTradingUSD).toBeGreaterThanOrEqual(0);
    });

    it("runs batch review over mock database interface", async () => {
      const mockTrades = [
        {
          id: "trade-0",
          symbol: "AAPL",
          trade_type: "buy",
          trade_date: "2024-01-01",
          price_per_unit: 20,
          quantity: 10,
        },
        {
          id: "trade-1",
          symbol: "AAPL",
          trade_type: "sell",
          trade_date: "2024-06-01",
          price_per_unit: 30,
          quantity: 10,
        },
      ];

      const mockDb = {
        from: (table: string) => {
          if (table === "trades") {
            return {
              select: () => ({
                eq: () => Promise.resolve({ data: mockTrades, error: null }),
              }),
            };
          }
          return {
            upsert: () => Promise.resolve({ error: null }),
          };
        },
      };

      // Hold price (35) above the exit price (30) means holding would have been better, so the
      // cost of trading is positive. Bought at 20, sold at 30, 10 units.
      const result = await runBatchGameReview(mockDb, {
        holdPricesUSD: new Map([["AAPL", 35]]),
      });

      expect(result.totalAudited).toBe(1);
      expect(result.skippedNoPrice).toBe(0);
      expect(result.blunderRatePercent).toBe(0.0);
      expect(result.totalNetCostUSD).toBeGreaterThan(0);
    });
  });
});
