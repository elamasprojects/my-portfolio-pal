/**
 * Pre-Trade Thesis & Friction Inversion Contract Types
 * Project: Chess (Requirement R4)
 */

export interface PreTradeThesis {
  /** Entry reasoning / thesis (min 10 chars) */
  entryThesis: string;
  /** Target price in ARS (must be > 0) */
  targetPriceARS: number;
  /** Invalidation condition for stop-loss / exit (min 10 chars) */
  invalidationCondition: string;
}

export interface SellExecutionRequest {
  /** Target trade ID */
  tradeId: string;
  /** Quantity to sell (must be > 0) */
  sellQuantity: number;
  /** Price in ARS at sell execution */
  sellPriceARS: number;
  /** Whether the exit matches target/invalidation strategy */
  isPlannedExit: boolean;
  /** Mandatory rationale if !isPlannedExit (min 20 chars) */
  unplannedRationale?: string;
  /** Cooling off duration in seconds (default 60s for unplanned) */
  coolingOffDurationSeconds?: number;
}

export interface CandidateWatchlistItem {
  id: string;
  symbol: string;
  assetCategory: 'equity' | 'bond' | 'cedear' | 'crypto';
  targetEntryPriceARS: number;
  targetExitPriceARS: number;
  invalidationPriceARS: number;
  entryThesis: string;
  invalidationCondition: string;
  created_at: string;
}
