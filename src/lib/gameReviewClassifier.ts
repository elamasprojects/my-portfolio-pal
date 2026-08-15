/**
 * Outcome Taxonomy Classifier Engine
 * Project: Chess (Milestone M4 / Requirement R2)
 */

import { ClosedTradeAuditInput, TradeOutcome } from "@/types/gameReview";
import { CounterfactualCalculationResult } from "./counterfactuals";

/**
 * Classifies a closed trade into outcome taxonomy: Brillante, Correcta, Imprecisión, or Blunder.
 */
export function classifyTradeOutcome(
  trade: ClosedTradeAuditInput,
  cf: CounterfactualCalculationResult
): TradeOutcome {
  const actualReturnPct = cf.actualReturnPct;
  const doNothingReturnARS = cf.doNothingReturnARS;
  const actualTotalReturnARS = cf.actualTotalReturnARS;
  const spyReturn = cf.benchmarkReturns.spyReturn;
  const cclReturn = cf.benchmarkReturns.cclReturn;
  const fixedDepositReturn = cf.benchmarkReturns.fixedDepositReturn;
  const isPlannedExit = trade.isPlannedExit ?? true;

  // 1. BRILLANTE RULES (Masterful Trade / Outperformed Benchmarks or Avoided Catastrophic Hold Loss)
  //
  // A null benchmark means the series was unavailable, so the comparison is unknown rather
  // than passed. Treating null as a beaten benchmark is how a nominal ARS return used to clear
  // a hardcoded 20% "CCL" and land in Brillante under any inflation.
  const beatsSpyAndCcl =
    spyReturn !== null &&
    cclReturn !== null &&
    actualReturnPct > spyReturn &&
    actualReturnPct > cclReturn;
  const targetMetOrNoTarget = trade.targetPriceARS
    ? trade.sellPriceARS >= trade.targetPriceARS * 0.95
    : true;

  // Exited asset before complete collapse (holding value dropped to 0)
  if (trade.holdingPriceAtSellDateARS === 0 && actualTotalReturnARS > doNothingReturnARS) {
    return 'Brillante';
  }

  if (beatsSpyAndCcl && targetMetOrNoTarget && (actualReturnPct > 0 || actualTotalReturnARS > doNothingReturnARS)) {
    return 'Brillante';
  }

  // 2. BLUNDER RULES (Severe Discipline Failure or Unmanaged Panic Loss)
  // B1: Panic exit violating invalidation stop condition
  if (!isPlannedExit && trade.invalidationPriceARS && trade.sellPriceARS < trade.invalidationPriceARS) {
    return 'Blunder';
  }

  // B2: Panic sell at a loss where holding would have yielded a profit or superior result
  if (
    actualReturnPct < 0 &&
    actualTotalReturnARS < doNothingReturnARS &&
    (trade.holdingPriceAtSellDateARS !== undefined || doNothingReturnARS > 0)
  ) {
    return 'Blunder';
  }

  // B3: Catastrophic unmanaged loss (> 25% loss) when holding did NOT collapse even worse
  if (actualReturnPct < -25.0 && actualTotalReturnARS <= doNothingReturnARS) {
    return 'Blunder';
  }

  // 3. IMPRECISIÓN RULES (Premature Exit or Suboptimal vs Benchmarks)
  if (actualReturnPct > 0 && trade.targetPriceARS && trade.sellPriceARS < trade.targetPriceARS * 0.85) {
    return 'Imprecision';
  }

  const underperformedSpy = spyReturn !== null && actualReturnPct < spyReturn;
  const missedTargetAtALoss = Boolean(
    trade.targetPriceARS && trade.sellPriceARS < trade.targetPriceARS && actualReturnPct < 0
  );

  if (underperformedSpy || missedTargetAtALoss) {
    const underperformedFixedDeposit =
      fixedDepositReturn !== null && actualReturnPct < fixedDepositReturn;
    if (underperformedFixedDeposit && actualTotalReturnARS <= doNothingReturnARS) {
      return 'Imprecision';
    }
  }

  // 4. CORRECTA RULES (Solid, Plan-Compliant or Superior Relative Performance)
  if (actualReturnPct >= 0 || beatsSpyAndCcl || actualTotalReturnARS > doNothingReturnARS) {
    return 'Correcta';
  }

  return actualReturnPct >= 0 ? 'Correcta' : 'Imprecision';
}
