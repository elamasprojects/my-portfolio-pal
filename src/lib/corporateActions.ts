/**
 * Corporate Actions & Stock Split Adjustment Module
 * Project: Chess (Milestone M4 / Requirement R2)
 */

import { ClosedTradeAuditInput, CorporateActionSplit } from "@/types/gameReview";

/**
 * Calculates the cumulative split multiplier factor for a given symbol
 * based on corporate action split events occurring strictly AFTER the trade date.
 */
export function calculateCumulativeSplitFactor(
  symbol: string,
  tradeDate: string,
  splits: CorporateActionSplit[]
): number {
  if (!splits || splits.length === 0) return 1.0;

  const relevantSplits = splits.filter(
    (s) => s.symbol.toUpperCase() === symbol.toUpperCase() && s.splitDate > tradeDate
  );

  if (relevantSplits.length === 0) return 1.0;

  return relevantSplits.reduce((acc, s) => acc * (s.ratio > 0 ? s.ratio : 1.0), 1.0);
}

/**
 * Adjusts a closed trade audit input by applying split scaling factors:
 * Quantity: Q_adj = Q * S
 * Buy Price: P_adj = P / S
 * Preserves total capital outlay (Q_adj * P_adj = Q * P).
 */
export function adjustTradeForSplit<T extends ClosedTradeAuditInput>(
  trade: T,
  overrideSplitFactor?: number
): T {
  const splitFactor = overrideSplitFactor ?? trade.splitFactor ?? 1.0;

  if (splitFactor === 1.0 || splitFactor <= 0) {
    return { ...trade, splitFactor: 1.0 };
  }

  const adjQuantity = trade.quantity * splitFactor;
  const adjBuyPrice = trade.buyPriceARS / splitFactor;
  const adjTargetPrice = trade.targetPriceARS ? trade.targetPriceARS / splitFactor : undefined;
  const adjInvalidationPrice = trade.invalidationPriceARS
    ? trade.invalidationPriceARS / splitFactor
    : undefined;
  const adjHoldingPrice = trade.holdingPriceAtSellDateARS
    ? trade.holdingPriceAtSellDateARS / splitFactor
    : undefined;

  return {
    ...trade,
    quantity: adjQuantity,
    buyPriceARS: adjBuyPrice,
    targetPriceARS: adjTargetPrice,
    invalidationPriceARS: adjInvalidationPrice,
    holdingPriceAtSellDateARS: adjHoldingPrice,
    splitFactor: 1.0, // Reset to 1.0 after applying adjustment
  };
}

/**
 * Applies corporate action split adjustments to a trade log before FIFO lot matching.
 */
export function applyCorporateActionsToTrades<
  T extends {
    symbol: string;
    trade_date?: string;
    buyDate?: string;
    quantity: number | string;
    price_per_unit?: number | string;
    buyPriceARS?: number;
    split_factor_applied?: number;
  }
>(trades: T[], splits: CorporateActionSplit[]): T[] {
  if (!splits || splits.length === 0) return trades;

  return trades.map((trade) => {
    const tradeDate = trade.trade_date || trade.buyDate || "";
    const cumulativeFactor = calculateCumulativeSplitFactor(trade.symbol, tradeDate, splits);

    if (cumulativeFactor === 1.0) return trade;

    const currentQty = Number(trade.quantity);
    const currentPrice =
      trade.price_per_unit !== undefined ? Number(trade.price_per_unit) : Number(trade.buyPriceARS);

    const updated: any = {
      ...trade,
      quantity: currentQty * cumulativeFactor,
      split_factor_applied: cumulativeFactor,
    };

    if (trade.price_per_unit !== undefined) {
      updated.price_per_unit = currentPrice / cumulativeFactor;
    }
    if (trade.buyPriceARS !== undefined) {
      updated.buyPriceARS = currentPrice / cumulativeFactor;
    }

    return updated;
  });
}
