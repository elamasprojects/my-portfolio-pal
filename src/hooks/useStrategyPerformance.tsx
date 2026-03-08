import { useMemo } from "react";
import { Trade } from "@/hooks/usePortfolio";
import { useTags, useTradeTagAssignments } from "@/hooks/useTags";

export interface StrategyStats {
  tagId: string;
  tagName: string;
  tagColor: string;
  totalTrades: number;
  sells: number;
  winningSells: number;
  winRate: number;
  realizedPnl: number;
  dividends: number;
  totalReturn: number;
}

function computeForGroup(trades: Trade[]): { realizedPnl: number; dividends: number; winningSells: number; sells: number } {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
  );

  const positions = new Map<string, { qty: number; avgCost: number }>();
  let realizedPnl = 0;
  let dividends = 0;
  let winningSells = 0;
  let sells = 0;

  for (const t of sorted) {
    const pos = positions.get(t.symbol) || { qty: 0, avgCost: 0 };

    if (t.trade_type === "buy") {
      const totalCost = pos.avgCost * pos.qty + t.price_per_unit * t.quantity;
      pos.qty += t.quantity;
      pos.avgCost = pos.qty > 0 ? totalCost / pos.qty : 0;
      positions.set(t.symbol, pos);
    } else if (t.trade_type === "sell") {
      const pnl = (t.price_per_unit - pos.avgCost) * t.quantity;
      realizedPnl += pnl;
      if (pnl > 0) winningSells++;
      sells++;
      pos.qty -= t.quantity;
      if (pos.qty <= 0) { pos.qty = 0; pos.avgCost = 0; }
      positions.set(t.symbol, pos);
    } else if (t.trade_type === "dividend") {
      dividends += Number(t.total_amount) || t.price_per_unit * t.quantity;
    }
  }

  return { realizedPnl, dividends, winningSells, sells };
}

export function useStrategyPerformance(trades: Trade[]): { data: StrategyStats[]; isLoading: boolean } {
  const { data: tags = [], isLoading: tagsLoading } = useTags();
  const tradeIds = useMemo(() => trades.map((t) => t.id), [trades]);
  const { data: assignments = [], isLoading: assignmentsLoading } = useTradeTagAssignments(tradeIds);

  const data = useMemo(() => {
    if (tags.length === 0 || assignments.length === 0) return [];

    const tradeMap = new Map(trades.map((t) => [t.id, t]));

    // Group trade IDs by tag
    const tagTradeIds = new Map<string, Set<string>>();
    for (const a of assignments) {
      const set = tagTradeIds.get(a.tag_id) || new Set();
      set.add(a.trade_id);
      tagTradeIds.set(a.tag_id, set);
    }

    const results: StrategyStats[] = [];

    for (const tag of tags) {
      const ids = tagTradeIds.get(tag.id);
      if (!ids || ids.size === 0) continue;

      const groupTrades = Array.from(ids)
        .map((id) => tradeMap.get(id))
        .filter(Boolean) as Trade[];

      if (groupTrades.length === 0) continue;

      const { realizedPnl, dividends, winningSells, sells } = computeForGroup(groupTrades);

      results.push({
        tagId: tag.id,
        tagName: tag.name,
        tagColor: tag.color,
        totalTrades: groupTrades.length,
        sells,
        winningSells,
        winRate: sells > 0 ? Math.round((winningSells / sells) * 100) : 0,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        dividends: Math.round(dividends * 100) / 100,
        totalReturn: Math.round((realizedPnl + dividends) * 100) / 100,
      });
    }

    return results.sort((a, b) => b.totalReturn - a.totalReturn);
  }, [trades, tags, assignments]);

  return { data, isLoading: tagsLoading || assignmentsLoading };
}
