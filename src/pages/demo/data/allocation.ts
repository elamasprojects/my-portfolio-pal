// Shared allocation/sort helpers for the demo screens (Dashboard + Portfolio).
import type { Holding } from "@/hooks/usePortfolio";

const marketValue = (h: Holding, prices: Map<string, number>) => {
  const price = prices.get(h.symbol.toUpperCase());
  return price ? price * h.net_quantity : h.total_invested;
};

export function computeAllocationByType(
  holdings: Holding[],
  prices: Map<string, number>,
  cash: number,
): { name: string; value: number }[] {
  const acc: { name: string; value: number }[] = [];
  for (const h of holdings) {
    const val = marketValue(h, prices);
    const ex = acc.find((a) => a.name === h.asset_type);
    if (ex) ex.value += val;
    else acc.push({ name: h.asset_type, value: val });
  }
  if (cash > 0) acc.push({ name: "cash", value: cash });
  return acc.sort((a, b) => b.value - a.value);
}

export function sortHoldingsByValue(holdings: Holding[], prices: Map<string, number>): Holding[] {
  return holdings.slice().sort((a, b) => marketValue(b, prices) - marketValue(a, prices));
}
