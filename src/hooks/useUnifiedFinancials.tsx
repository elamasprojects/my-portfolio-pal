import { useMemo } from "react";
import { useFinancialAccounts, usePaymentMethods, useTransactions, useCategories } from "@/hooks/useFinance";
import { useTrades, useActivePortfolio, computeHoldings, computePerformance } from "@/hooks/usePortfolio";
import { computeUnifiedNetWorth, buildPersonalSankeyData } from "@/lib/financialMath";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useDolarMEP } from "@/hooks/useDolarMEP";

export function useUnifiedFinancials(filterRange?: { start?: Date; end?: Date }) {
  const { accounts: financialAccounts, isLoading: accLoading } = useFinancialAccounts();
  const { paymentMethods, isLoading: pmLoading } = usePaymentMethods();
  const { transactions, reviewQueue, isLoading: txLoading } = useTransactions();
  const { categories, isLoading: catLoading } = useCategories();
  const { portfolio: activePortfolio, isLoading: pfLoading } = useActivePortfolio();
  const { data: trades = [], isLoading: tradesLoading } = useTrades(activePortfolio?.id);

  const holdings = useMemo(() => computeHoldings(trades), [trades]);
  const portfolioPerformance = useMemo(() => computePerformance(trades), [trades]);

  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const { prices, previousCloses, isLoading: pricesLoading } = useMarketPrices(symbols);
  const { venta: arsPerUsd = 0 } = useDolarMEP();

  const netWorthMetrics = useMemo(() => {
    return computeUnifiedNetWorth(
      financialAccounts,
      transactions,
      holdings,
      portfolioPerformance,
      prices,
      trades,
      arsPerUsd
    );
  }, [financialAccounts, transactions, holdings, portfolioPerformance, prices, trades, arsPerUsd]);

  const sankeyData = useMemo(() => {
    return buildPersonalSankeyData(transactions, categories, filterRange);
  }, [transactions, categories, filterRange]);

  return {
    netWorthMetrics,
    sankeyData,
    reviewQueue,
    financialAccounts,
    paymentMethods,
    transactions,
    categories,
    holdings,
    portfolioPerformance,
    activePortfolio,
    isLoading: accLoading || pmLoading || txLoading || catLoading || pfLoading || tradesLoading || pricesLoading,
  };
}
