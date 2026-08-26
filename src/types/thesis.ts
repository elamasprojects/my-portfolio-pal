/**
 * Pre-Trade Thesis & Friction Inversion Contract Types
 * Project: Chess (Requirement R4)
 */

export interface PreTradeThesis {
  /** Entry reasoning / thesis (min 10 chars) */
  entryThesis: string;
  /**
   * Exit target, normalised to USD like `trades.price_per_unit` (must be > 0). Stored
   * unconverted, this was read back as pesos and tripped "target reached" immediately.
   */
  targetPriceUSD: number;
  /** Invalidation condition for stop-loss / exit (min 10 chars) */
  invalidationCondition: string;
}

export interface SellExecutionRequest {
  /**
   * Identity of the exit. Optional because the friction rules are also evaluated at the write
   * path, before the row exists and therefore before it has an id.
   */
  tradeId?: string;
  /** Quantity to sell (must be > 0) */
  sellQuantity?: number;
  /** Price in ARS at sell execution */
  sellPriceARS?: number;
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
