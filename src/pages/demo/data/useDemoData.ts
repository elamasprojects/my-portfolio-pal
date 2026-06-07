// Single data source for the demo: real account data via existing hooks → pure compute fns.
import { useMemo } from "react";
import {
  useTrades,
  computeHoldings,
  computePerformance,
  computeCash,
  computeCumulativePnLWithUnrealized,
} from "@/hooks/usePortfolio";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { computeDailyBreakdown, computeDailyChange } from "./computeDailyBreakdown";
import type { DemoData } from "./types";

export function useDemoData(): DemoData {
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { venta: mepRate } = useDolarMEP();

  const holdings = useMemo(() => computeHoldings(trades), [trades]);
  const performance = useMemo(() => computePerformance(trades), [trades]);
  const cash = useMemo(() => computeCash(trades), [trades]);

  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const { prices, previousCloses, isLoading: pricesLoading } = useMarketPrices(symbols);

  const marketValue = useMemo(
    () =>
      holdings.reduce((s, h) => {
        const p = prices.get(h.symbol.toUpperCase());
        return s + (p ? p * h.net_quantity : h.total_invested);
      }, 0),
    [holdings, prices],
  );

  const unrealizedPnl = useMemo(
    () =>
      holdings.reduce((s, h) => {
        const p = prices.get(h.symbol.toUpperCase());
        if (!p) return s;
        return s + (p - h.avg_cost) * h.net_quantity;
      }, 0),
    [holdings, prices],
  );

  const totalPortfolioValue = marketValue + cash;
  const totalPnl = performance.total_realized_pnl + unrealizedPnl + performance.total_dividends;
  const totalPnlPct = performance.total_cost_basis > 0 ? (totalPnl / performance.total_cost_basis) * 100 : 0;

  const dailyChange = useMemo(
    () => computeDailyChange(holdings, prices, previousCloses),
    [holdings, prices, previousCloses],
  );
  const dailyChangePct = totalPortfolioValue - dailyChange > 0 ? (dailyChange / (totalPortfolioValue - dailyChange)) * 100 : 0;
  const dailyBreakdown = useMemo(
    () => computeDailyBreakdown(holdings, prices, previousCloses, totalPortfolioValue, dailyChange),
    [holdings, prices, previousCloses, totalPortfolioValue, dailyChange],
  );

  const cumulativePnL = useMemo(() => computeCumulativePnLWithUnrealized(trades, prices), [trades, prices]);

  const totalTrades = trades.filter((t) => t.trade_type !== "dividend").length;

  return {
    trades,
    holdings,
    performance,
    cash,
    prices,
    previousCloses,
    marketValue,
    unrealizedPnl,
    totalPortfolioValue,
    totalPnl,
    totalPnlPct,
    dailyChange,
    dailyChangePct,
    dailyBreakdown,
    cumulativePnL,
    mepRate,
    totalTrades,
    hasData: holdings.length > 0 || trades.length > 0,
    loading: tradesLoading,
    pricesLoading,
  };
}
