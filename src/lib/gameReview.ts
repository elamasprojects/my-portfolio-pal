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
import { calculateCounterfactuals, DEFAULT_CCL_RATE } from "./counterfactuals";
import { classifyTradeOutcome } from "./gameReviewClassifier";
import { calculateAggregateMetricsFromAudits } from "./gameReviewMetrics";
import { matchTradesFIFO } from "./tradeMatching";
import { getBenchmarkReturnsForPeriod } from "./benchmarks";

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
  trade: ClosedTradeAuditInput,
  cclRateAtSell?: number
): Promise<CounterfactualMetrics> {
  // 1. Apply split scaling adjustment if splitFactor is provided
  const adjustedTrade = adjustTradeForSplit(trade);

  // 2. Compute counterfactual returns (Do-Nothing, Benchmarks, Strategy Adherence)
  const cf = calculateCounterfactuals(adjustedTrade, cclRateAtSell);

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
  trades: ClosedTradeAuditInput[],
  cclRateAtSell?: number
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
    const audit = await auditClosedTrade(trade, cclRateAtSell);
    audits.push(audit);
  }

  return calculateAggregateMetricsFromAudits(trades, audits, cclRateAtSell);
}

/**
 * Batch execution engine auditing closed trades stored in Supabase table `trades`
 * and persisting outcome audits to `game_reviews` table.
 */
export interface BatchGameReviewOptions {
  /**
   * Current market price per symbol, in USD. This is what the "do nothing" counterfactual is
   * built from: what the position would be worth today had it never been sold. Sells whose
   * symbol has no live price are reported under `skippedNoPrice` rather than audited.
   */
  holdPricesUSD?: Map<string, number>;
  /** Live ARS/USD rate used to express ARS figures. Falls back to DEFAULT_CCL_RATE. */
  cclRate?: number;
  /** Owner of the persisted rows. Resolved from the active session when omitted. */
  userId?: string;
}

export interface BatchGameReviewResult {
  totalAudited: number;
  /** Sells that could not be audited because no live price was available for the symbol. */
  skippedNoPrice: number;
  blunderRatePercent: number;
  totalNetCostUSD: number;
}

const EMPTY_BATCH_RESULT: BatchGameReviewResult = {
  totalAudited: 0,
  skippedNoPrice: 0,
  blunderRatePercent: 0,
  totalNetCostUSD: 0,
};

export async function runBatchGameReview(
  dbClient?: any,
  options: BatchGameReviewOptions = {}
): Promise<BatchGameReviewResult> {
  const client = dbClient ?? supabase;

  if (!client) return { ...EMPTY_BATCH_RESULT };

  const holdPricesUSD = options.holdPricesUSD ?? new Map<string, number>();
  const cclRate = options.cclRate && options.cclRate > 0 ? options.cclRate : DEFAULT_CCL_RATE;

  try {
    let allTrades: any[] = [];
    try {
      const query = client.from("trades").select("*");
      if (typeof query.order === "function") {
        const { data, error } = await query.order("trade_date", { ascending: true });
        if (!error && data) allTrades = data;
      } else if (typeof query.eq === "function") {
        const { data, error } = await query.eq("status", "closed");
        if (!error && data) allTrades = data;
      } else {
        const { data, error } = await query;
        if (!error && data) allTrades = data;
      }
    } catch {
      allTrades = [];
    }

    if (!allTrades || allTrades.length === 0) return { ...EMPTY_BATCH_RESULT };

    // Only realised exits can be audited. There is deliberately no fallback to "audit
    // everything": treating an open buy as a closed position invents an outcome for a
    // decision the user has not made yet.
    const sellTrades = allTrades.filter((t: any) => t.trade_type === "sell");
    if (sellTrades.length === 0) return { ...EMPTY_BATCH_RESULT };

    // FIFO lot matching gives the real cost basis per exit, including the case where a symbol
    // was sold more than once. Averaging every prior buy (the previous approach) overstates
    // cost basis on the second and later sells.
    const fifoBySymbol = new Map<string, ReturnType<typeof matchTradesFIFO>>();
    for (const symbol of new Set(allTrades.map((t: any) => String(t.symbol ?? "").toUpperCase()))) {
      if (!symbol) continue;
      const symbolTrades = allTrades.filter(
        (t: any) => String(t.symbol ?? "").toUpperCase() === symbol
      );
      fifoBySymbol.set(symbol, matchTradesFIFO(symbolTrades as any));
    }

    let skippedNoPrice = 0;
    const mappedInputs: ClosedTradeAuditInput[] = [];

    for (const t of sellTrades) {
      const tradeId = t.id;
      const symbol = t.symbol ? String(t.symbol).toUpperCase() : "";
      const sellDate = t.trade_date || t.created_at;
      const sellPriceUSD = Number(t.price_per_unit);
      const quantity = Number(t.quantity);

      // A row missing any of these cannot be audited truthfully, and substituting a
      // placeholder symbol or price would silently fabricate a result.
      if (!tradeId || !symbol || !sellDate) continue;
      if (!Number.isFinite(sellPriceUSD) || !Number.isFinite(quantity) || quantity <= 0) continue;

      const holdPriceUSD = holdPricesUSD.get(symbol);
      if (!holdPriceUSD || holdPriceUSD <= 0) {
        skippedNoPrice++;
        continue;
      }

      // Match this exit to its FIFO lots to recover the true average cost and entry date.
      const matched = fifoBySymbol.get(symbol)?.closedTrades.filter((c) => c.sellDate === sellDate) ?? [];
      const matchedQty = matched.reduce((sum, c) => sum + c.quantity, 0);
      if (matchedQty <= 0) continue;

      const avgBuyPriceUSD =
        matched.reduce((sum, c) => sum + c.buyPrice * c.quantity, 0) / matchedQty;
      const buyDate = matched.reduce(
        (earliest, c) => (c.buyDate < earliest ? c.buyDate : earliest),
        matched[0].buyDate
      );

      // Benchmarks measured over this trade's own holding period, or absent. Never constants.
      const benchmarks = await getBenchmarkReturnsForPeriod(buyDate, sellDate);

      // price_per_unit is stored normalised to USD across this codebase, so a single rate
      // converts every leg consistently.
      mappedInputs.push({
        tradeId,
        symbol,
        buyDate,
        sellDate,
        spyReturnPct: benchmarks.spyReturnPct ?? undefined,
        cclReturnPct: benchmarks.cclReturnPct ?? undefined,
        fixedDepositReturnPct: benchmarks.fixedDepositReturnPct ?? undefined,
        buyPriceARS: avgBuyPriceUSD * cclRate,
        sellPriceARS: sellPriceUSD * cclRate,
        holdingPriceAtSellDateARS: holdPriceUSD * cclRate,
        quantity: matchedQty,
        splitFactor: Number(t.split_factor) || 1.0,
        targetPriceARS:
          t.target_price_ars !== undefined && t.target_price_ars !== null
            ? Number(t.target_price_ars)
            : undefined,
        invalidationPriceARS:
          t.invalidation_price_ars !== undefined && t.invalidation_price_ars !== null
            ? Number(t.invalidation_price_ars)
            : undefined,
        isPlannedExit: t.is_planned_exit !== undefined ? Boolean(t.is_planned_exit) : true,
        unplannedRationale: t.unplanned_rationale,
      });
    }

    if (mappedInputs.length === 0) {
      return { ...EMPTY_BATCH_RESULT, skippedNoPrice };
    }

    // Audit once and reuse: the aggregate metrics and the persisted rows are both derived
    // from this single pass.
    const audits: CounterfactualMetrics[] = [];
    for (const input of mappedInputs) {
      audits.push(await auditClosedTrade(input, cclRate));
    }
    const metrics = calculateAggregateMetricsFromAudits(mappedInputs, audits, cclRate);

    // Every row must carry its owner: `game_reviews` RLS scopes on user_id, and rows written
    // without one used to land in a bucket readable by every authenticated user.
    let userId = options.userId;
    if (!userId && client === supabase) {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id;
    }

    try {
      const auditedAt = new Date().toISOString();
      const rowsToInsert = mappedInputs.map((trade, i) => ({
        ...(userId ? { user_id: userId } : {}),
        trade_id: trade.tradeId,
        do_nothing_return_ars: audits[i].doNothingReturnARS,
        spy_return: audits[i].benchmarkReturns.spyReturn,
        ccl_return: audits[i].benchmarkReturns.cclReturn,
        fixed_deposit_return: audits[i].benchmarkReturns.fixedDepositReturn,
        outcome_classification: audits[i].outcomeClassification,
        net_cost_usd: audits[i].netCostOfTradingUSD,
        audited_at: auditedAt,
      }));

      const { error: upsertError } = await client
        .from("game_reviews")
        .upsert(rowsToInsert, { onConflict: "trade_id" });
      if (upsertError) return { ...EMPTY_BATCH_RESULT, skippedNoPrice };
    } catch {
      return { ...EMPTY_BATCH_RESULT, skippedNoPrice };
    }

    return {
      totalAudited: metrics.totalClosedTrades,
      skippedNoPrice,
      blunderRatePercent: metrics.blunderRatePercent,
      totalNetCostUSD: metrics.totalNetCostUSD,
    };
  } catch {
    return { ...EMPTY_BATCH_RESULT };
  }
}
