// Live data for the /watch route — reuses the portfolio compute fns + shared daily-breakdown.
import { useMemo } from "react";
import { useTrades, computeHoldings, computeCash } from "@/hooks/usePortfolio";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { useProfile } from "@/hooks/useProfile";
import { computeDailyBreakdown, computeDailyChange, type DailyBreakdownItem } from "@/lib/dailyBreakdown";

export interface WatchData {
  loading: boolean;
  pricesLoading: boolean;
  hasData: boolean;
  dailyChange: number;
  dailyChangePct: number;
  breakdown: DailyBreakdownItem[];
  totalPortfolioValue: number;
  currency: "USD" | "ARS";
  mepRate: number;
}

export function useWatchData(): WatchData {
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { profile } = useProfile();
  const { venta: mepRate } = useDolarMEP();

  const holdings = useMemo(() => computeHoldings(trades), [trades]);
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
  const totalPortfolioValue = marketValue + cash;
  const dailyChange = useMemo(
    () => computeDailyChange(holdings, prices, previousCloses),
    [holdings, prices, previousCloses],
  );
  const dailyChangePct = totalPortfolioValue - dailyChange > 0 ? (dailyChange / (totalPortfolioValue - dailyChange)) * 100 : 0;
  const breakdown = useMemo(
    () => computeDailyBreakdown(holdings, prices, previousCloses, totalPortfolioValue, dailyChange),
    [holdings, prices, previousCloses, totalPortfolioValue, dailyChange],
  );

  return {
    loading: tradesLoading,
    pricesLoading,
    hasData: holdings.length > 0,
    dailyChange,
    dailyChangePct,
    breakdown,
    totalPortfolioValue,
    currency: (profile?.default_currency as "USD" | "ARS") || "USD",
    mepRate,
  };
}
