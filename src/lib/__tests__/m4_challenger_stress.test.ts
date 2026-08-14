import { describe, it, expect } from "vitest";
import {
  adjustTradeForSplit,
  calculateCumulativeSplitFactor,
  applyCorporateActionsToTrades,
} from "@/lib/corporateActions";
import { calculateCounterfactuals } from "@/lib/counterfactuals";
import { classifyTradeOutcome } from "@/lib/gameReviewClassifier";
import {
  calculateAggregateMetricsFromAudits,
  resolveAssetCategory,
} from "@/lib/gameReviewMetrics";
import {
  auditClosedTrade,
  calculateAggregateAuditMetrics,
  ClosedTradeAuditInput,
  CorporateActionSplit,
} from "@/lib/gameReview";

describe("Milestone M4 Challenger Stress Tests & Adversarial Vectors", () => {
  // =========================================================================
  // Vector 1: Split Factor Invariance under Extreme & Boundary Values
  // =========================================================================
  describe("Vector 1: Split Factor Invariance ($Q_{adj} \\times P_{adj} = Q \\times P$)", () => {
    it("maintains outlay invariance under extreme 100:1 forward split", () => {
      const trade: ClosedTradeAuditInput = {
        tradeId: "t-ex-100",
        symbol: "TECH",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 5000,
        sellPriceARS: 60, // Post split price
        quantity: 50,
        splitFactor: 100.0,
      };

      const adj = adjustTradeForSplit(trade);
      const originalOutlay = trade.quantity * trade.buyPriceARS; // 50 * 5000 = 250,000
      const adjustedOutlay = adj.quantity * adj.buyPriceARS; // (50 * 100) * (5000 / 100) = 5000 * 50 = 250,000

      expect(adj.quantity).toBe(5000);
      expect(adj.buyPriceARS).toBe(50);
      expect(adjustedOutlay).toBeCloseTo(originalOutlay, 6);
    });

    it("maintains outlay invariance under extreme 1:1000 reverse split", () => {
      const trade: ClosedTradeAuditInput = {
        tradeId: "t-ex-rev-1000",
        symbol: "PENNY",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 0.5,
        sellPriceARS: 600,
        quantity: 100000,
        splitFactor: 0.001, // 1:1000 reverse split
      };

      const adj = adjustTradeForSplit(trade);
      const originalOutlay = trade.quantity * trade.buyPriceARS; // 100000 * 0.5 = 50,000
      const adjustedOutlay = adj.quantity * adj.buyPriceARS; // 100 * 500 = 50,000

      expect(adj.quantity).toBe(100);
      expect(adj.buyPriceARS).toBe(500);
      expect(adjustedOutlay).toBeCloseTo(originalOutlay, 6);
    });

    it("handles zero or negative split factors gracefully", () => {
      const tradeZero: ClosedTradeAuditInput = {
        tradeId: "t-zero-split",
        symbol: "TEST",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 100,
        sellPriceARS: 120,
        quantity: 10,
        splitFactor: 0,
      };

      const adjZero = adjustTradeForSplit(tradeZero);
      expect(adjZero.splitFactor).toBe(1.0);
      expect(adjZero.quantity).toBe(10);
      expect(adjZero.buyPriceARS).toBe(100);

      const tradeNeg: ClosedTradeAuditInput = {
        ...tradeZero,
        splitFactor: -5.0,
      };

      const adjNeg = adjustTradeForSplit(tradeNeg);
      expect(adjNeg.splitFactor).toBe(1.0);
    });

    it("evaluates cumulative split composition under multiple sequential extreme splits", () => {
      const splits: CorporateActionSplit[] = [
        { symbol: "VOLT", splitDate: "2024-02-01", ratio: 50.0 }, // 50:1
        { symbol: "VOLT", splitDate: "2024-04-01", ratio: 0.002 }, // 1:500 reverse split
      ];

      const factorBeforeAll = calculateCumulativeSplitFactor("VOLT", "2024-01-01", splits);
      expect(factorBeforeAll).toBeCloseTo(0.1, 6); // 50 * 0.002 = 0.1

      const factorBetween = calculateCumulativeSplitFactor("VOLT", "2024-03-01", splits);
      expect(factorBetween).toBe(0.002);
    });

    it("verifies split factor idempotency under sequential adjustments (S=2.0 followed by S=5.0)", () => {
      const initialTrade: ClosedTradeAuditInput = {
        tradeId: "t-seq-split",
        symbol: "NVDA",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 1500,
        quantity: 10,
        splitFactor: 2.0,
      };

      // Step 1: Apply initial split factor S=2.0
      const step1 = adjustTradeForSplit(initialTrade);
      expect(step1.quantity).toBe(20);
      expect(step1.buyPriceARS).toBe(500);
      expect(step1.splitFactor).toBe(1.0);
      expect(step1.quantity * step1.buyPriceARS).toBe(10000);

      // Re-running adjustTradeForSplit on step1 without override must be idempotent (no double scaling)
      const reRun1 = adjustTradeForSplit(step1);
      expect(reRun1.quantity).toBe(20);
      expect(reRun1.buyPriceARS).toBe(500);
      expect(reRun1.splitFactor).toBe(1.0);
      expect(reRun1.quantity * reRun1.buyPriceARS).toBe(10000);

      // Step 2: Apply subsequent split factor S=5.0 via override
      const step2 = adjustTradeForSplit(step1, 5.0);
      expect(step2.quantity).toBe(100);
      expect(step2.buyPriceARS).toBe(100);
      expect(step2.splitFactor).toBe(1.0);
      expect(step2.quantity * step2.buyPriceARS).toBe(10000);

      // Re-running adjustTradeForSplit on step2 without override must also be idempotent
      const reRun2 = adjustTradeForSplit(step2);
      expect(reRun2.quantity).toBe(100);
      expect(reRun2.buyPriceARS).toBe(100);
      expect(reRun2.splitFactor).toBe(1.0);
      expect(reRun2.quantity * reRun2.buyPriceARS).toBe(10000);
    });
  });

  // =========================================================================
  // Vector 2: Counterfactual Math Stress (Volatility, Zero/Neg Prices, FX Swings)
  // =========================================================================
  describe("Vector 2: Counterfactual Math Stress & Boundary Behavior", () => {
    it("stress tests counterfactual math when buyPriceARS is 0 (Airdrops/Bonus shares)", () => {
      const trade: ClosedTradeAuditInput = {
        tradeId: "t-free-airdrop",
        symbol: "CRYPTO",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 0,
        sellPriceARS: 500,
        quantity: 100,
      };

      const cf = calculateCounterfactuals(trade);

      expect(cf.actualTotalReturnARS).toBe(50000);
      expect(Number.isNaN(cf.actualReturnPct)).toBe(false);
      expect(Number.isFinite(cf.actualReturnPct)).toBe(true);
    });

    it("stress tests counterfactual math under extreme FX rates (CCL = 0 or negative)", () => {
      const trade: ClosedTradeAuditInput = {
        tradeId: "t-fx-swing",
        symbol: "CEDEAR",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 1200,
        quantity: 10,
        holdingPriceAtSellDateARS: 2000,
      };

      const cfZeroFx = calculateCounterfactuals(trade, 0); // CCL rate = 0
      expect(cfZeroFx.netCostUSD).toBe(8.0); // Should fallback to 1000 CCL (8000 ARS / 1000)

      const cfNegFx = calculateCounterfactuals(trade, -500); // Negative CCL rate
      expect(cfNegFx.netCostUSD).toBe(8.0);
    });

    it("stress tests Plazo Fijo compounding math when buyDate or sellDate is invalid", () => {
      const tradeInvalidDate: ClosedTradeAuditInput = {
        tradeId: "t-invalid-date",
        symbol: "LOCAL",
        buyDate: "invalid-date-str",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 1200,
        quantity: 10,
      };

      const cf = calculateCounterfactuals(tradeInvalidDate);
      expect(typeof cf.benchmarkReturns.fixedDepositReturn).toBe("number");
    });

    it("audits aggregate category edge calculation accuracy", () => {
      const trades: ClosedTradeAuditInput[] = [
        {
          tradeId: "t-edge-1",
          symbol: "AAPL",
          buyDate: "2024-01-01",
          sellDate: "2024-06-01",
          buyPriceARS: 1000,
          sellPriceARS: 1200,
          quantity: 10,
          holdingPriceAtSellDateARS: 1500,
        },
      ];

      const metrics = calculateAggregateMetricsFromAudits(trades, [
        {
          doNothingReturnARS: 5000,
          benchmarkReturns: { spyReturn: 10, cclReturn: 10, fixedDepositReturn: 10 },
          outcomeClassification: "Correcta",
          netCostOfTradingUSD: 3,
        },
      ]);

      expect(metrics.categoryEdgeUSD["CEDEARs"]).toBeDefined();
    });
  });

  // =========================================================================
  // Vector 3: Outcome Taxonomy Classifier Resilience & Matrix Coverage
  // =========================================================================
  describe("Vector 3: Taxonomy Classifier Resilience", () => {
    it("verifies exact boundary condition for Target Met (95% threshold)", () => {
      const trade94_9: ClosedTradeAuditInput = {
        tradeId: "t-bound-94",
        symbol: "BOFA",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 1899, // 94.95% of 2000 target
        quantity: 10,
        targetPriceARS: 2000,
        spyReturnPct: 10,
        cclReturnPct: 10,
      };

      const cf94 = calculateCounterfactuals(trade94_9);
      const outcome94 = classifyTradeOutcome(trade94_9, cf94);
      expect(outcome94).toBe("Correcta");

      const trade95_0: ClosedTradeAuditInput = {
        ...trade94_9,
        sellPriceARS: 1900, // Exactly 95.0% of 2000 target
      };

      const cf95 = calculateCounterfactuals(trade95_0);
      const outcome95 = classifyTradeOutcome(trade95_0, cf95);
      expect(outcome95).toBe("Brillante");
    });

    it("verifies classification matrix across all outcome tiers", () => {
      const tradeCatastrophic: ClosedTradeAuditInput = {
        tradeId: "t-cat",
        symbol: "HIGH_RISK",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 700, // -30%
        quantity: 10,
      };
      const cfCat = calculateCounterfactuals(tradeCatastrophic);
      expect(classifyTradeOutcome(tradeCatastrophic, cfCat)).toBe("Blunder");

      const tradePremature: ClosedTradeAuditInput = {
        tradeId: "t-pre",
        symbol: "EARLY",
        buyDate: "2024-01-01",
        sellDate: "2024-06-01",
        buyPriceARS: 1000,
        sellPriceARS: 1100, // +10%
        quantity: 10,
        targetPriceARS: 2000,
        spyReturnPct: 5,
        cclReturnPct: 5,
        fixedDepositReturnPct: 2,
      };
      const cfPre = calculateCounterfactuals(tradePremature);
      expect(classifyTradeOutcome(tradePremature, cfPre)).toBe("Imprecision");
    });
  });
});
