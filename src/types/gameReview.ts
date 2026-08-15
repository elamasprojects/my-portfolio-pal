/**
 * Retroactive Game Review Engine & Counterfactual Audit System Types
 * Project: Chess (Milestone M4 / Requirement R2)
 */

export type TradeOutcome = 'Brillante' | 'Correcta' | 'Imprecision' | 'Blunder';

/**
 * Benchmark returns over the trade's holding period, as percentages.
 *
 * `null` means "we do not have this series for this period" — it is not zero and not a
 * neutral value. These used to default to invented constants (15% SPY, 20% CCL, and a
 * 110% TNA plazo fijo compounded daily), which made every comparison a comparison against
 * a number nobody measured.
 */
export interface BenchmarkReturns {
  spyReturn: number | null;
  cclReturn: number | null;
  fixedDepositReturn: number | null;
}

export interface CounterfactualMetrics {
  doNothingReturnARS: number;
  benchmarkReturns: BenchmarkReturns;
  outcomeClassification: TradeOutcome;
  netCostOfTradingUSD: number;
}

export interface ClosedTradeAuditInput {
  tradeId: string;
  symbol: string;
  buyDate: string;
  sellDate: string;
  buyPriceARS: number;
  sellPriceARS: number;
  quantity: number;
  splitFactor?: number;
  targetPriceARS?: number;
  invalidationPriceARS?: number;
  holdingPriceAtSellDateARS?: number;
  spyReturnPct?: number;
  cclReturnPct?: number;
  fixedDepositReturnPct?: number;
  assetCategory?: string;
  isPlannedExit?: boolean;
  unplannedRationale?: string;
}

export interface AggregateAuditMetrics {
  totalClosedTrades: number;
  blunderCount: number;
  blunderRatePercent: number;
  totalNetCostUSD: number;
  categoryEdgeUSD: Record<string, number>;
}

export interface GameReviewDatabaseRow {
  id: string;
  user_id: string | null;
  trade_id: string;
  do_nothing_return_ars: number | null;
  spy_return: number | null;
  ccl_return: number | null;
  fixed_deposit_return: number | null;
  outcome_classification: TradeOutcome;
  net_cost_usd: number | null;
  audited_at: string;
  created_at: string;
}

export interface CorporateActionSplit {
  symbol: string;
  splitDate: string; // ISO date YYYY-MM-DD (ex-date)
  ratio: number;     // Split multiplier factor S (e.g. 2.0 for 2:1 split, 0.2 for 1:5 reverse split)
}
