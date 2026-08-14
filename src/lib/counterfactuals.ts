/**
 * Counterfactual Audit Engine (Do-Nothing, Benchmarks, Strategy Adherence)
 * Project: Chess (Milestone M4 / Requirement R2)
 */

import { ClosedTradeAuditInput, BenchmarkReturns } from "@/types/gameReview";
import { adjustTradeForSplit } from "./corporateActions";

export interface CounterfactualCalculationResult {
  actualTotalReturnARS: number;
  actualReturnPct: number;
  doNothingReturnARS: number;
  doNothingReturnPct: number;
  opportunityCostARS: number;
  netCostUSD: number;
  benchmarkReturns: BenchmarkReturns;
  alphas: {
    spyAlpha: number;
    cclAlpha: number;
    fixedDepositAlpha: number;
  };
  strategyAdherence: {
    targetHit: boolean;
    targetProximityRatio: number;
    invalidationHit: boolean;
    isPlannedExit: boolean;
  };
}

/**
 * Calculates (a) Do-Nothing counterfactual, (b) Benchmarks & Alpha, and (c) Strategy Adherence.
 */
export function calculateCounterfactuals(
  trade: ClosedTradeAuditInput,
  cclRateAtSell = 1000.0
): CounterfactualCalculationResult {
  const adjTrade = adjustTradeForSplit(trade);
  const adjQuantity = adjTrade.quantity;
  const adjBuyPrice = adjTrade.buyPriceARS;

  // Actual realized return ARS and percentage
  const actualTotalReturnARS = (adjTrade.sellPriceARS - adjBuyPrice) * adjQuantity;
  const actualReturnPct =
    adjBuyPrice > 0 ? ((adjTrade.sellPriceARS - adjBuyPrice) / adjBuyPrice) * 100 : 0;

  // (a) Do Nothing counterfactual: Valuation of holding original asset until sell date
  const currentHoldPrice = adjTrade.holdingPriceAtSellDateARS ?? adjTrade.sellPriceARS;
  const doNothingReturnARS = (currentHoldPrice - adjBuyPrice) * adjQuantity;
  const doNothingReturnPct =
    adjBuyPrice > 0 ? ((currentHoldPrice - adjBuyPrice) / adjBuyPrice) * 100 : 0;

  // Opportunity cost of trading vs holding (ARS & USD)
  const opportunityCostARS = Math.max(0, doNothingReturnARS - actualTotalReturnARS);
  const effectiveCclRate = cclRateAtSell > 0 ? cclRateAtSell : 1000.0;
  const netCostUSD = Math.round((opportunityCostARS / effectiveCclRate) * 100) / 100;

  // (b) Multi-Benchmark returns & Alpha calculation
  const spyReturn = adjTrade.spyReturnPct ?? 15.0;
  const cclReturn = adjTrade.cclReturnPct ?? 20.0;

  // Compute compounding Plazo Fijo return if buy & sell dates available, else fallback
  let fixedDepositReturn = adjTrade.fixedDepositReturnPct ?? 5.0;
  if (!adjTrade.fixedDepositReturnPct && adjTrade.buyDate && adjTrade.sellDate) {
    const buyTime = new Date(adjTrade.buyDate).getTime();
    const sellTime = new Date(adjTrade.sellDate).getTime();
    if (!isNaN(buyTime) && !isNaN(sellTime)) {
      const days = Math.max(1, Math.round((sellTime - buyTime) / (1000 * 60 * 60 * 24)));
      // Annual Nominal Rate TNA = 110%
      const dailyRate = 1.10 / 365;
      fixedDepositReturn = Math.round((Math.pow(1 + dailyRate, days) - 1) * 10000) / 100;
    }
  }
  if (isNaN(fixedDepositReturn)) {
    fixedDepositReturn = 5.0;
  }

  const benchmarkReturns: BenchmarkReturns = {
    spyReturn,
    cclReturn,
    fixedDepositReturn,
  };

  const alphas = {
    spyAlpha: Math.round((actualReturnPct - spyReturn) * 100) / 100,
    cclAlpha: Math.round((actualReturnPct - cclReturn) * 100) / 100,
    fixedDepositAlpha: Math.round((actualReturnPct - fixedDepositReturn) * 100) / 100,
  };

  // (c) Strategy Adherence
  const targetHit = adjTrade.targetPriceARS ? adjTrade.sellPriceARS >= adjTrade.targetPriceARS * 0.95 : false;
  const targetProximityRatio = adjTrade.targetPriceARS ? adjTrade.sellPriceARS / adjTrade.targetPriceARS : 1.0;
  const invalidationHit = adjTrade.invalidationPriceARS
    ? adjTrade.sellPriceARS <= adjTrade.invalidationPriceARS
    : false;
  const isPlannedExit = adjTrade.isPlannedExit ?? true;

  return {
    actualTotalReturnARS: Math.round(actualTotalReturnARS * 100) / 100,
    actualReturnPct: Math.round(actualReturnPct * 100) / 100,
    doNothingReturnARS: Math.round(doNothingReturnARS * 100) / 100,
    doNothingReturnPct: Math.round(doNothingReturnPct * 100) / 100,
    opportunityCostARS: Math.round(opportunityCostARS * 100) / 100,
    netCostUSD,
    benchmarkReturns,
    alphas,
    strategyAdherence: {
      targetHit,
      targetProximityRatio: Math.round(targetProximityRatio * 10000) / 10000,
      invalidationHit,
      isPlannedExit,
    },
  };
}
