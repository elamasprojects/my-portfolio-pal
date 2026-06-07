// Shared day-over-day P&L helpers (used by the dashboard-style screens and the watch view).
// Lifted from src/pages/Index.tsx so demo + production can reuse the same logic.
import type { Holding } from "@/hooks/usePortfolio";

export interface DailyBreakdownItem {
  symbol: string;
  amountChange: number;
  pctChange: number;
  portfolioContribPct: number;
  net_quantity: number;
  currentPrice: number;
  prevClose: number;
}

export function computeDailyChange(
  holdings: Holding[],
  prices: Map<string, number>,
  previousCloses: Map<string, number>,
): number {
  return holdings.reduce((s, h) => {
    const price = prices.get(h.symbol.toUpperCase());
    const prevClose = previousCloses.get(h.symbol.toUpperCase());
    if (!price || !prevClose) return s;
    return s + (price - prevClose) * h.net_quantity;
  }, 0);
}

export function computeDailyBreakdown(
  holdings: Holding[],
  prices: Map<string, number>,
  previousCloses: Map<string, number>,
  totalPortfolioValue: number,
  dailyChange: number,
): DailyBreakdownItem[] {
  const prevTotal = totalPortfolioValue - dailyChange;
  const list = holdings
    .map((h) => {
      const price = prices.get(h.symbol.toUpperCase());
      if (!price) return null;
      // No previous close (partial quote) → treat as flat today so the holding still
      // appears in "all stocks" lists instead of silently disappearing.
      const prevClose = previousCloses.get(h.symbol.toUpperCase()) ?? price;
      const changePerShare = price - prevClose;
      const amountChange = changePerShare * h.net_quantity;
      const pctChange = prevClose > 0 ? (changePerShare / prevClose) * 100 : 0;
      const portfolioContribPct = prevTotal > 0 ? (amountChange / prevTotal) * 100 : 0;
      return {
        symbol: h.symbol,
        amountChange,
        pctChange,
        portfolioContribPct,
        net_quantity: h.net_quantity,
        currentPrice: price,
        prevClose,
      } as DailyBreakdownItem;
    })
    .filter(Boolean) as DailyBreakdownItem[];
  return list.sort((a, b) => Math.abs(b.amountChange) - Math.abs(a.amountChange));
}
