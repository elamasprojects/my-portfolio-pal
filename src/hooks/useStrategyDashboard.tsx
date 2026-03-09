import { useMemo } from "react";
import { Trade } from "@/hooks/usePortfolio";
import { useStrategies, Strategy } from "@/hooks/useStrategies";

export interface StrategyDashboardStats {
  strategyId: string;
  strategyName: string;
  strategyIcon: string;
  isDefault: boolean;
  totalTrades: number;
  buys: number;
  sells: number;
  dividendTrades: number;
  winningSells: number;
  winRate: number;
  realizedPnl: number;
  avgReturnPerSell: number;
  dividends: number;
  totalReturn: number;
}

function computeForGroup(trades: Trade[]) {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
  );

  const positions = new Map<string, { qty: number; avgCost: number }>();
  let realizedPnl = 0;
  let dividends = 0;
  let winningSells = 0;
  let sells = 0;
  let buys = 0;
  let dividendTrades = 0;

  for (const t of sorted) {
    const pos = positions.get(t.symbol) || { qty: 0, avgCost: 0 };

    if (t.trade_type === "buy") {
      const totalCost = pos.avgCost * pos.qty + t.price_per_unit * t.quantity;
      pos.qty += t.quantity;
      pos.avgCost = pos.qty > 0 ? totalCost / pos.qty : 0;
      positions.set(t.symbol, pos);
      buys++;
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
      dividendTrades++;
    }
  }

  return { realizedPnl, dividends, winningSells, sells, buys, dividendTrades };
}

export function useStrategyDashboard(trades: Trade[]): { data: StrategyDashboardStats[]; isLoading: boolean } {
  const { data: strategies = [], isLoading } = useStrategies();

  const data = useMemo(() => {
    if (strategies.length === 0) return [];

    const strategyMap = new Map<string, Strategy>();
    for (const s of strategies) strategyMap.set(s.id, s);

    // Group trades by strategy_id
    const groups = new Map<string, Trade[]>();
    for (const t of trades) {
      if (!t.strategy_id) continue;
      const arr = groups.get(t.strategy_id) || [];
      arr.push(t);
      groups.set(t.strategy_id, arr);
    }

    const results: StrategyDashboardStats[] = [];

    for (const strategy of strategies) {
      const groupTrades = groups.get(strategy.id) || [];
      const { realizedPnl, dividends, winningSells, sells, buys, dividendTrades } = computeForGroup(groupTrades);

      results.push({
        strategyId: strategy.id,
        strategyName: strategy.name,
        strategyIcon: strategy.icon || "TrendingUp",
        isDefault: strategy.is_default,
        totalTrades: groupTrades.length,
        buys,
        sells,
        dividendTrades,
        winningSells,
        winRate: sells > 0 ? Math.round((winningSells / sells) * 100) : 0,
        realizedPnl: Math.round(realizedPnl * 100) / 100,
        avgReturnPerSell: sells > 0 ? Math.round((realizedPnl / sells) * 100) / 100 : 0,
        dividends: Math.round(dividends * 100) / 100,
        totalReturn: Math.round((realizedPnl + dividends) * 100) / 100,
      });
    }

    return results.sort((a, b) => b.totalReturn - a.totalReturn);
  }, [trades, strategies]);

  return { data, isLoading };
}
