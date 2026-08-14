/**
 * Retroactive Game Review Engine & Counterfactual Audit System (Main Façade)
 * Project: Chess (Milestone M4 / Requirement R2)
 */

import { supabase } from "@/integrations/supabase/client";
import {
  TradeOutcome,
  BenchmarkReturns,
  CounterfactualMetrics,
  ClosedTradeAuditInput,
  AggregateAuditMetrics,
  GameReviewDatabaseRow,
  CorporateActionSplit,
} from "@/types/gameReview";
import { adjustTradeForSplit } from "./corporateActions";
import { calculateCounterfactuals } from "./counterfactuals";
import { classifyTradeOutcome } from "./gameReviewClassifier";
import { calculateAggregateMetricsFromAudits } from "./gameReviewMetrics";

// Re-export domain interfaces for backward compatibility and clean external module consumption
export type {
  TradeOutcome,
  BenchmarkReturns,
  CounterfactualMetrics,
  ClosedTradeAuditInput,
  AggregateAuditMetrics,
  GameReviewDatabaseRow,
  CorporateActionSplit,
};

/**
 * Audits a single closed position against counterfactual scenarios.
 */
export async function auditClosedTrade(
  trade: ClosedTradeAuditInput
): Promise<CounterfactualMetrics> {
  // 1. Apply split scaling adjustment if splitFactor is provided
  const adjustedTrade = adjustTradeForSplit(trade);

  // 2. Compute counterfactual returns (Do-Nothing, Benchmarks, Strategy Adherence)
  const cf = calculateCounterfactuals(adjustedTrade);

  // 3. Classify outcome into taxonomy (Brillante, Correcta, Imprecisión, Blunder)
  const outcomeClassification = classifyTradeOutcome(adjustedTrade, cf);

  return {
    doNothingReturnARS: cf.doNothingReturnARS,
    benchmarkReturns: cf.benchmarkReturns,
    outcomeClassification,
    netCostOfTradingUSD: cf.netCostUSD,
  };
}

/**
 * Summarizes aggregate performance and blunder metrics across a collection of closed trades.
 */
export async function calculateAggregateAuditMetrics(
  trades: ClosedTradeAuditInput[]
): Promise<AggregateAuditMetrics> {
  if (!trades || trades.length === 0) {
    return {
      totalClosedTrades: 0,
      blunderCount: 0,
      blunderRatePercent: 0.0,
      totalNetCostUSD: 0.0,
      categoryEdgeUSD: {},
    };
  }

  const audits: CounterfactualMetrics[] = [];
  for (const trade of trades) {
    const audit = await auditClosedTrade(trade);
    audits.push(audit);
  }

  return calculateAggregateMetricsFromAudits(trades, audits);
}

/**
 * Batch execution engine auditing closed trades stored in Supabase table `trades`
 * and persisting outcome audits to `game_reviews` table.
 */
export async function runBatchGameReview(dbClient?: any): Promise<{
  totalAudited: number;
  blunderRatePercent: number;
  totalNetCostUSD: number;
}> {
  const client = dbClient ?? supabase;

  if (!client) {
    return { totalAudited: 0, blunderRatePercent: 0, totalNetCostUSD: 0 };
  }

  try {
    const { data: trades, error } = await client
      .from("trades")
      .select("*")
      .eq("status", "closed");

    if (error || !trades || trades.length === 0) {
      return { totalAudited: 0, blunderRatePercent: 0, totalNetCostUSD: 0 };
    }

    const mappedInputs: ClosedTradeAuditInput[] = trades.map((t: any) => ({
      tradeId: t.id,
      symbol: t.symbol,
      buyDate: t.buy_date || t.created_at || "2024-01-01",
      sellDate: t.sell_date || t.buy_date || "2024-06-01",
      buyPriceARS: Number(t.buy_price_ars || t.price_per_unit || 1000),
      sellPriceARS: Number(t.sell_price_ars || t.price_per_unit || 1000),
      quantity: Number(t.quantity || 1),
      splitFactor: Number(t.split_factor || 1.0),
      targetPriceARS: t.target_price_ars !== undefined && t.target_price_ars !== null ? Number(t.target_price_ars) : undefined,
      invalidationPriceARS: t.invalidation_price_ars !== undefined && t.invalidation_price_ars !== null
        ? Number(t.invalidation_price_ars)
        : (t.invalidation_price ? Number(t.invalidation_price) : undefined),
      isPlannedExit: t.is_planned_exit !== undefined ? Boolean(t.is_planned_exit) : true,
      unplannedRationale: t.unplanned_rationale,
    }));

    const metrics = await calculateAggregateAuditMetrics(mappedInputs);

    // Persist reviews to Supabase `game_reviews` table
    try {
      const rowsToInsert = await Promise.all(
        mappedInputs.map(async (trade) => {
          const audit = await auditClosedTrade(trade);
          return {
            trade_id: trade.tradeId,
            do_nothing_return_ars: audit.doNothingReturnARS,
            spy_return: audit.benchmarkReturns.spyReturn,
            ccl_return: audit.benchmarkReturns.cclReturn,
            fixed_deposit_return: audit.benchmarkReturns.fixedDepositReturn,
            outcome_classification: audit.outcomeClassification,
            net_cost_usd: audit.netCostOfTradingUSD,
            audited_at: new Date().toISOString(),
          };
        })
      );

      const { error: upsertError } = await client.from("game_reviews").upsert(rowsToInsert, { onConflict: "trade_id" });
      if (upsertError) {
        console.error("Supabase game_reviews upsert error:", upsertError);
        return { totalAudited: 0, blunderRatePercent: 0, totalNetCostUSD: 0 };
      }
    } catch {
      // Non-blocking write error in offline/mock mode
    }

    return {
      totalAudited: metrics.totalClosedTrades,
      blunderRatePercent: metrics.blunderRatePercent,
      totalNetCostUSD: metrics.totalNetCostUSD,
    };
  } catch {
    return { totalAudited: 0, blunderRatePercent: 0, totalNetCostUSD: 0 };
  }
}
