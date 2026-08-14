/**
 * Pure Domain Logic for Pre-Trade Discipline & Friction Inversion
 * Project: Chess (Requirement R4)
 */

import { PreTradeThesis, SellExecutionRequest, CandidateWatchlistItem } from "@/types/thesis";

export type { PreTradeThesis, SellExecutionRequest, CandidateWatchlistItem };

/**
 * Unplanned Sell Rationale Validator (R4)
 * Enforces mandatory written rationale (min 20 characters) when selling an unplanned position.
 */
export function validateUnplannedSellRationale(
  rationale: string,
  isPlannedExit: boolean
): { valid: boolean; error?: string } {
  if (isPlannedExit) return { valid: true };
  if (!rationale || rationale.trim().length < 20) {
    return { valid: false, error: "Rationale must be at least 20 characters" };
  }
  return { valid: true };
}

/**
 * Validates and processes Sell Execution Requests under Friction Inversion rules (R4).
 * Planned exits execute instantly (coolingOffApplied: false).
 * Unplanned exits enforce 60s cooling period and min 20-char written rationale.
 */
export function processSellExecution(
  request: SellExecutionRequest
): { success: boolean; error?: string; coolingOffApplied: boolean } {
  if (request.isPlannedExit) {
    return { success: true, coolingOffApplied: false };
  }

  const elapsed = request.coolingOffDurationSeconds ?? 0;
  if (elapsed < 60) {
    return { success: false, error: "Cooling-off period of 60s has not elapsed", coolingOffApplied: true };
  }
  if (!request.unplannedRationale || request.unplannedRationale.trim().length < 20) {
    return { success: false, error: "Rationale must be at least 20 characters", coolingOffApplied: true };
  }

  return { success: true, coolingOffApplied: true };
}

/**
 * Evaluates whether current market price hits Target Price or Invalidation Price (R4).
 */
export function checkTargetOrInvalidationHit(
  currentPriceARS: number,
  targetPriceARS?: number,
  invalidationPriceARS?: number
): { isTargetHit: boolean; isInvalidationHit: boolean; status: "target_met" | "invalidation_hit" | "active" } {
  const isTargetHit = typeof targetPriceARS === "number" && targetPriceARS > 0 && currentPriceARS >= targetPriceARS;
  const isInvalidationHit = typeof invalidationPriceARS === "number" && invalidationPriceARS > 0 && currentPriceARS <= invalidationPriceARS;

  let status: "target_met" | "invalidation_hit" | "active" = "active";
  if (isTargetHit) {
    status = "target_met";
  } else if (isInvalidationHit) {
    status = "invalidation_hit";
  }

  return { isTargetHit, isInvalidationHit, status };
}
