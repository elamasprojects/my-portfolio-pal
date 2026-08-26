import { Trade, chronoCompare } from "@/hooks/usePortfolio";

export interface ClosedTrade {
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
  quantity: number;
  pnl: number;
  returnPct: number;
  /**
   * The sell that consumed this lot. Callers grouping lots back onto their exit must key on
   * this, not on `sellDate`: two sells of the same symbol on one day share a date, and matching
   * by date hands each of them every lot closed that day — doubling quantity and P&L.
   */
  sellTradeId: string;
}

export interface OpenLot {
  date: string;
  price: number;
  remainingQty: number;
}

export interface TradeMatchingResult {
  closedTrades: ClosedTrade[];
  openLots: OpenLot[];
}

export function matchTradesFIFO(trades: Trade[]): TradeMatchingResult {
  // `chronoCompare` breaks a same-timestamp tie by putting buys before sells. Sorting on
  // `trade_date` alone let a same-day sell be replayed before the buy that funded it, which
  // consumed older lots and left the newer buy sitting open.
  const sorted = [...trades]
    .filter((t) => t.trade_type === "buy" || t.trade_type === "sell")
    .sort(chronoCompare);

  const openLots: OpenLot[] = [];
  const closedTrades: ClosedTrade[] = [];

  for (const trade of sorted) {
    if (trade.trade_type === "buy") {
      openLots.push({
        date: trade.trade_date,
        price: Number(trade.price_per_unit),
        remainingQty: Number(trade.quantity),
      });
    } else {
      let sellQtyLeft = Number(trade.quantity);
      const sellPrice = Number(trade.price_per_unit);

      while (sellQtyLeft > 0 && openLots.length > 0) {
        const lot = openLots[0];
        const consumed = Math.min(lot.remainingQty, sellQtyLeft);

        closedTrades.push({
          buyDate: lot.date,
          buyPrice: lot.price,
          sellDate: trade.trade_date,
          sellPrice,
          quantity: consumed,
          pnl: (sellPrice - lot.price) * consumed,
          returnPct: lot.price > 0 ? ((sellPrice - lot.price) / lot.price) * 100 : 0,
          sellTradeId: trade.id,
        });

        lot.remainingQty -= consumed;
        sellQtyLeft -= consumed;

        if (lot.remainingQty <= 0) {
          openLots.shift();
        }
      }
    }
  }

  return { closedTrades, openLots };
}

export interface ConsumedLots {
  /** How much was actually taken from the open lots. */
  quantity: number;
  /** Quantity-weighted cost of exactly the shares being sold. */
  weightedBuyPrice: number;
  /**
   * Purchase date of the oldest lot this sale consumes — the point the shares being sold were
   * actually acquired. Null when there are no open lots to consume.
   */
  earliestBuyDate: string | null;
  /** The lots touched, oldest first. */
  lots: { date: string; price: number; quantity: number }[];
}

/**
 * Walks `openLots` oldest-first and takes `quantity` out of them, without mutating the input.
 *
 * This is what a sale actually consumes. Reading "the first buy of this symbol" instead — as the
 * closed-position summary did — dates a position back to a purchase that was sold off months
 * ago: a stock bought and sold four times over reports the holding period of the very first
 * entry rather than of the shares just sold.
 */
export function consumeOpenLotsFIFO(openLots: OpenLot[], quantity: number): ConsumedLots {
  const lots: ConsumedLots["lots"] = [];
  let remaining = Number(quantity);
  let costTotal = 0;
  let taken = 0;

  for (const lot of openLots) {
    if (remaining <= 0) break;
    const consumed = Math.min(lot.remainingQty, remaining);
    if (consumed <= 0) continue;

    lots.push({ date: lot.date, price: lot.price, quantity: consumed });
    costTotal += lot.price * consumed;
    taken += consumed;
    remaining -= consumed;
  }

  const earliest = lots.reduce<string | null>(
    (acc, l) => (acc === null || l.date < acc ? l.date : acc),
    null
  );

  return {
    quantity: taken,
    weightedBuyPrice: taken > 0 ? costTotal / taken : 0,
    earliestBuyDate: earliest,
    lots,
  };
}

export interface ExitSummary {
  symbol: string;
  sellDate: string;
  quantity: number;
  /** Realised P&L of the whole exit, across every lot it consumed. */
  pnl: number;
}

/**
 * One entry per realised exit, across the whole ledger.
 *
 * Two things this gets right that reading `matchTradesFIFO(allTrades).closedTrades` does not:
 * the replay is run per symbol, because `matchTradesFIFO` keeps a single lot queue and would
 * otherwise let a sale of one ticker consume another ticker's buys; and the per-lot rows are
 * folded back into the sale that produced them, so an exit spanning three lots counts once
 * rather than three times.
 */
export function summariseExitsFIFO(trades: Trade[]): ExitSummary[] {
  const bySymbol = new Map<string, Trade[]>();
  for (const t of trades) {
    if (t.trade_type !== "buy" && t.trade_type !== "sell") continue;
    const key = t.symbol.toUpperCase();
    const arr = bySymbol.get(key) ?? [];
    arr.push(t);
    bySymbol.set(key, arr);
  }

  const exits = new Map<string, ExitSummary>();
  for (const [symbol, symbolTrades] of bySymbol) {
    for (const lot of matchTradesFIFO(symbolTrades).closedTrades) {
      // Keyed on the sell that consumed the lot, not its date. Two sells of one symbol on the
      // same day merged into a single exit, which skewed "top trade of the month" and the win
      // streak — the same mistake `ClosedTrade.sellTradeId` exists to prevent.
      const key = `${symbol}|${lot.sellTradeId}`;
      const existing = exits.get(key);
      if (existing) {
        existing.quantity += lot.quantity;
        existing.pnl += lot.pnl;
      } else {
        exits.set(key, {
          symbol,
          sellDate: lot.sellDate,
          quantity: lot.quantity,
          pnl: lot.pnl,
        });
      }
    }
  }

  return [...exits.values()].sort(
    (a, b) => new Date(a.sellDate).getTime() - new Date(b.sellDate).getTime()
  );
}
