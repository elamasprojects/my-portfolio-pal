/**
 * Shared accessors for the pre-trade thesis attached to a buy.
 *
 * Three views used to read the thesis independently and disagreed with each other: each picked
 * `symbolTrades[symbolTrades.length - 1]` as "the latest buy" while `useTrades` returns rows
 * newest-first, so all three showed the thesis of the *oldest* purchase; and each interpreted
 * the stored target in a different currency. Both readings now live here.
 */

import type { Trade } from "@/hooks/usePortfolio";

/** A trade row carrying the thesis columns, without requiring the full `Trade` shape. */
export type ThesisTrade = Pick<
  Trade,
  "symbol" | "trade_type" | "trade_date" | "entry_thesis" | "target_price_usd"
> &
  Partial<Pick<Trade, "invalidation_condition" | "invalidation_price_usd">>;

export interface SymbolThesis {
  entryThesis: string | null;
  /** Exit target, normalised to USD like `price_per_unit`. */
  targetPriceUSD: number | null;
  invalidationCondition: string | null;
  /** Numeric stop level, normalised to USD. Null when only a written condition was given. */
  invalidationPriceUSD: number | null;
  /** ISO date of the buy the thesis was taken from. */
  tradeDate: string | null;
}

const EMPTY_THESIS: SymbolThesis = {
  entryThesis: null,
  targetPriceUSD: null,
  invalidationCondition: null,
  invalidationPriceUSD: null,
  tradeDate: null,
};

/**
 * The most recent buy of `symbol`, by trade date.
 *
 * Sorts explicitly rather than trusting the order the caller's query happened to use, so a
 * change to `useTrades`'s `.order(...)` cannot silently flip this to the oldest buy again.
 */
export function latestBuyForSymbol<T extends ThesisTrade>(
  trades: readonly T[],
  symbol: string
): T | null {
  const target = symbol.toUpperCase();
  let latest: T | null = null;
  let latestTime = -Infinity;

  for (const trade of trades) {
    if (trade.trade_type !== "buy") continue;
    if (String(trade.symbol ?? "").toUpperCase() !== target) continue;

    const time = new Date(trade.trade_date).getTime();
    if (!Number.isFinite(time)) continue;
    if (time > latestTime) {
      latestTime = time;
      latest = trade;
    }
  }

  return latest;
}

/** The thesis declared on the most recent buy of `symbol`, or empty when none was recorded. */
export function thesisForSymbol(trades: readonly ThesisTrade[], symbol: string): SymbolThesis {
  const buy = latestBuyForSymbol(trades, symbol);
  if (!buy) return { ...EMPTY_THESIS };

  const target = Number(buy.target_price_usd);
  const invalidation = Number(buy.invalidation_price_usd);

  return {
    entryThesis: buy.entry_thesis ?? null,
    targetPriceUSD: Number.isFinite(target) && target > 0 ? target : null,
    invalidationCondition: buy.invalidation_condition ?? null,
    invalidationPriceUSD: Number.isFinite(invalidation) && invalidation > 0 ? invalidation : null,
    tradeDate: buy.trade_date ?? null,
  };
}
