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
  /** Null wherever the corresponding benchmark series is unavailable for this period. */
  alphas: {
    spyAlpha: number | null;
    cclAlpha: number | null;
    fixedDepositAlpha: number | null;
  };
  strategyAdherence: {
    targetHit: boolean;
    targetProximityRatio: number;
    invalidationHit: boolean;
    isPlannedExit: boolean;
  };
}

/**
 * Last-resort ARS/USD rate, used only when no caller supplies a live one. Callers in the
 * app always pass the rate from useDolarMEP; this exists so pure unit tests stay deterministic.
 */
export const DEFAULT_CCL_RATE = 1000.0;

function numberOrNull(value: number | undefined | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function alphaOrNull(actualReturnPct: number, benchmark: number | null): number | null {
  if (benchmark === null) return null;
  return Math.round((actualReturnPct - benchmark) * 100) / 100;
}

/**
 * Calculates (a) Do-Nothing counterfactual, (b) Benchmarks & Alpha, and (c) Strategy Adherence.
 */
export function calculateCounterfactuals(
  trade: ClosedTradeAuditInput,
  cclRateAtSell: number = DEFAULT_CCL_RATE
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

  // Cost of trading vs holding, signed: positive means holding would have been better,
  // negative means the exit beat holding. Clamping this at zero made it impossible for the
  // audit to ever report that a sale was the right call.
  const opportunityCostARS = doNothingReturnARS - actualTotalReturnARS;
  const effectiveCclRate = cclRateAtSell > 0 ? cclRateAtSell : DEFAULT_CCL_RATE;
  const netCostUSD = Math.round((opportunityCostARS / effectiveCclRate) * 100) / 100;

  // (b) Multi-Benchmark returns & Alpha calculation.
  //
  // These come from real series measured over this trade's holding period, or they are null.
  // They used to fall back to literal constants — 15% for the S&P 500, 20% for CCL, and a
  // 110% TNA plazo fijo compounded daily (an effective ~200% annual, and a rate that has not
  // been current for years). A trade held three days and one held two years were compared
  // against the identical figure.
  const spyReturn = numberOrNull(adjTrade.spyReturnPct);
  const cclReturn = numberOrNull(adjTrade.cclReturnPct);
  const fixedDepositReturn = numberOrNull(adjTrade.fixedDepositReturnPct);

  const benchmarkReturns: BenchmarkReturns = {
    spyReturn,
    cclReturn,
    fixedDepositReturn,
  };

  const alphas = {
    spyAlpha: alphaOrNull(actualReturnPct, spyReturn),
    cclAlpha: alphaOrNull(actualReturnPct, cclReturn),
    fixedDepositAlpha: alphaOrNull(actualReturnPct, fixedDepositReturn),
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
