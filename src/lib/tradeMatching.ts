import { Trade } from "@/hooks/usePortfolio";

export interface ClosedTrade {
  buyDate: string;
  buyPrice: number;
  sellDate: string;
  sellPrice: number;
  quantity: number;
  pnl: number;
  returnPct: number;
}

export interface TradeMatchingResult {
  closedTrades: ClosedTrade[];
  openLots: { date: string; price: number; remainingQty: number }[];
}

export function matchTradesFIFO(trades: Trade[]): TradeMatchingResult {
  const sorted = [...trades]
    .filter((t) => t.trade_type === "buy" || t.trade_type === "sell")
    .sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());

  const openLots: { date: string; price: number; remainingQty: number }[] = [];
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
