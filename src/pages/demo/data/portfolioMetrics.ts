// Per-holding derived metrics shared by the portfolio-page variations.
import type { Holding } from "@/hooks/usePortfolio";

export interface EnrichedHolding {
  symbol: string;
  name: string;
  assetType: string;
  qty: number;
  avgCost: number;
  price: number | null;
  mktVal: number;
  weight: number; // % of total market value
  uPnl: number | null;
  uPnlPct: number | null;
  dayAmount: number | null;
  dayPct: number | null;
}

export function enrichHoldings(
  holdings: Holding[],
  prices: Map<string, number>,
  previousCloses: Map<string, number>,
): { items: EnrichedHolding[]; totalMktVal: number } {
  const raw = holdings.map((h) => {
    const price = prices.get(h.symbol.toUpperCase()) ?? null;
    const mktVal = price ? price * h.net_quantity : h.total_invested;
    const prev = previousCloses.get(h.symbol.toUpperCase()) ?? null;
    return {
      h,
      price,
      mktVal,
      uPnl: price ? (price - h.avg_cost) * h.net_quantity : null,
      uPnlPct: price && h.avg_cost > 0 ? ((price - h.avg_cost) / h.avg_cost) * 100 : null,
      dayAmount: price && prev ? (price - prev) * h.net_quantity : null,
      dayPct: price && prev ? ((price - prev) / prev) * 100 : null,
    };
  });
  const totalMktVal = raw.reduce((s, r) => s + r.mktVal, 0);
  const items: EnrichedHolding[] = raw
    .map((r) => ({
      symbol: r.h.symbol,
      name: r.h.asset_name,
      assetType: r.h.asset_type,
      qty: r.h.net_quantity,
      avgCost: r.h.avg_cost,
      price: r.price,
      mktVal: r.mktVal,
      weight: totalMktVal > 0 ? (r.mktVal / totalMktVal) * 100 : 0,
      uPnl: r.uPnl,
      uPnlPct: r.uPnlPct,
      dayAmount: r.dayAmount,
      dayPct: r.dayPct,
    }))
    .sort((a, b) => b.mktVal - a.mktVal);
  return { items, totalMktVal };
}
