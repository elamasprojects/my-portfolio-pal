import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  auditClosedTrade,
  calculateAggregateAuditMetrics,
  runBatchGameReview,
  ClosedTradeAuditInput,
} from "@/lib/gameReview";
import { setupTestEnvironment } from "@/test/helpers/stateSetup";
import { sampleTradeFixtures } from "@/test/fixtures/types";

describe("Tier 1 - Requirement 2 (R2): Retroactive Game Review Engine", () => {
  let env: ReturnType<typeof setupTestEnvironment>;

  beforeEach(() => {
    env = setupTestEnvironment({
      initialData: {
        trades: sampleTradeFixtures,
      },
    });
  });

  afterEach(() => {
    env.cleanup();
  });

  /**
   * T1-R2-01: "Do Nothing" Counterfactual Calculation
   */
  it("T1-R2-01: calculates 'Do Nothing' counterfactual return and trading opportunity cost", async () => {
    const tradeInput: ClosedTradeAuditInput = {
      tradeId: "trade-aapl-01",
      symbol: "AAPL",
      buyDate: "2024-01-01",
      sellDate: "2024-06-01",
      buyPriceARS: 1000,
      sellPriceARS: 1500,
      quantity: 100,
      holdingPriceAtSellDateARS: 1800, // Holding original asset yielded 1800
    };

    const audit = await auditClosedTrade(tradeInput);

    // Selling at 1500 yielded 50,000 ARS gain; holding until sell date would yield (1800 - 1000) * 100 = 80,000 ARS gain
    expect(audit.doNothingReturnARS).toBe(80000);
    expect(audit.netCostOfTradingUSD).toBeGreaterThan(0);
  });

  /**
   * T1-R2-02: Multi-Benchmark Comparison (CCL, S&P 500, Plazo Fijo)
   */
  it("T1-R2-02: compares trade returns against SPY, CCL, and Fixed Deposit benchmarks", async () => {
    const tradeInput: ClosedTradeAuditInput = {
      tradeId: "trade-bench-01",
      symbol: "NVDA",
      buyDate: "2024-01-01",
      sellDate: "2024-06-01",
      buyPriceARS: 1000,
      sellPriceARS: 1600,
      quantity: 50,
      spyReturnPct: 12.0,
      cclReturnPct: 25.0,
      fixedDepositReturnPct: 6.0,
    };

    const audit = await auditClosedTrade(tradeInput);

    expect(audit.benchmarkReturns).toBeDefined();
    expect(audit.benchmarkReturns.spyReturn).toBe(12.0);
    expect(audit.benchmarkReturns.cclReturn).toBe(25.0);
    expect(audit.benchmarkReturns.fixedDepositReturn).toBe(6.0);
  });

  /**
   * T1-R2-03: Trade Outcome Taxonomy Classification
   */
  it("T1-R2-03: classifies trades into Brillante, Correcta, Imprecision, and Blunder taxonomy", async () => {
    // 1. Brillante: Outperforms SPY and CCL, target hit
    const brillanteAudit = await auditClosedTrade({
      tradeId: "t1",
      symbol: "NVDA",
      buyDate: "2024-01-01",
      sellDate: "2024-06-01",
      buyPriceARS: 1000,
      sellPriceARS: 2000, // +100%
      quantity: 10,
      targetPriceARS: 1800,
      spyReturnPct: 15.0,
      cclReturnPct: 20.0,
    });
    expect(brillanteAudit.outcomeClassification).toBe("Brillante");

    // 2. Correcta: Positive return, beats fixed deposit
    const correctaAudit = await auditClosedTrade({
      tradeId: "t2",
      symbol: "GGAL",
      buyDate: "2024-01-01",
      sellDate: "2024-06-01",
      buyPriceARS: 1000,
      sellPriceARS: 1100, // +10%
      quantity: 10,
      fixedDepositReturnPct: 5.0,
    });
    expect(correctaAudit.outcomeClassification).toBe("Correcta");

    // 3. Blunder: Exited early at loss while holding would yield gain
    const blunderAudit = await auditClosedTrade({
      tradeId: "t3",
      symbol: "YPF",
      buyDate: "2024-01-01",
      sellDate: "2024-06-01",
      buyPriceARS: 1000,
      sellPriceARS: 700, // -30% panic loss
      quantity: 10,
      holdingPriceAtSellDateARS: 1500, // held would yield +50%
      targetPriceARS: 1600,
    });
    expect(blunderAudit.outcomeClassification).toBe("Blunder");
  });

  /**
   * T1-R2-04: Corporate Action & Stock Split Adjustment
   */
  it("T1-R2-04: applies split factor scaling S = 2 without distorting audit calculations", async () => {
    // 2:1 split: pre-split 100 shares @ $200 -> post-split 200 shares @ $100
    const splitTradeInput: ClosedTradeAuditInput = {
      tradeId: "trade-split-01",
      symbol: "AAPL",
      buyDate: "2024-01-01",
      sellDate: "2024-06-01",
      buyPriceARS: 200,
      sellPriceARS: 120, // Sold at 120 post-split (equivalent to 240 pre-split)
      quantity: 100,
      splitFactor: 2.0,
    };

    const audit = await auditClosedTrade(splitTradeInput);

    // Adjusted buy price = 200 / 2 = 100 ARS per post-split share.
    // Selling @ 120 gives positive gain (+20%), not -40% loss artifact
    expect(audit.doNothingReturnARS).toBeGreaterThanOrEqual(0);
    expect(audit.outcomeClassification).not.toBe("Blunder");
  });

  /**
   * T1-R2-05: Aggregate Audit Metrics Summarizer
   */
  it("T1-R2-05: computes blunder rate %, net cost USD, and category edge summary", async () => {
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
        symbol: "GGAL",
        buyDate: "2024-01-01",
        sellDate: "2024-02-01",
        buyPriceARS: 1000,
        sellPriceARS: 700,
        quantity: 10,
        holdingPriceAtSellDateARS: 1400,
      },
    ];

    const metrics = await calculateAggregateAuditMetrics(trades);

    expect(metrics.totalClosedTrades).toBe(2);
    expect(metrics.blunderCount).toBe(1);
    expect(metrics.blunderRatePercent).toBe(50.0);
    expect(metrics.totalNetCostUSD).toBeGreaterThan(0);
  });

  /**
   * T1-R2-06: Historical Batch Execution Engine
   */
  it("T1-R2-06: executes batch game review engine over database closed trade records", async () => {
    const batchResult = await runBatchGameReview(env.mockSupabase);

    expect(batchResult.totalAudited).toBeGreaterThan(0);
    expect(batchResult.blunderRatePercent).toBeGreaterThanOrEqual(0);
    expect(batchResult.totalNetCostUSD).toBeGreaterThanOrEqual(0);
  });
});
