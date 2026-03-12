import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useState, useEffect, useCallback } from "react";

export interface Trade {
  id: string;
  portfolio_id: string;
  user_id: string;
  symbol: string;
  asset_name: string;
  asset_type: "stock" | "etf" | "crypto" | "bond" | "other";
  trade_type: "buy" | "sell" | "dividend";
  quantity: number;
  price_per_unit: number;
  total_amount: number;
  trade_date: string;
  notes: string | null;
  created_at: string;
  strategy_id: string | null;
  original_currency: string;
  original_price: number | null;
  broker_id: string | null;
  commission_pct: number;
  commission_amount: number;
  mep_rate: number | null;
}

export interface Portfolio {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface Holding {
  symbol: string;
  asset_name: string;
  asset_type: string;
  net_quantity: number;
  avg_cost: number;
  total_invested: number;
}

// --- Performance interfaces ---
export interface SymbolPerformance {
  symbol: string;
  asset_name: string;
  realized_pnl: number;
  dividends_received: number;
  total_return: number;
  winning_sells: number;
  total_sells: number;
  open_quantity: number;
  avg_cost: number;
  cost_basis: number;
}

export interface PortfolioPerformance {
  total_realized_pnl: number;
  total_dividends: number;
  total_return: number;
  total_cost_basis: number;
  win_rate: number;
  winning_sells: number;
  total_sells: number;
  by_symbol: SymbolPerformance[];
}

// --- Active portfolio management ---
const ACTIVE_PORTFOLIO_KEY = "activePortfolioId";

function getStoredPortfolioId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_PORTFOLIO_KEY);
  } catch {
    return null;
  }
}

function setStoredPortfolioId(id: string) {
  try {
    localStorage.setItem(ACTIVE_PORTFOLIO_KEY, id);
  } catch {}
}

export function usePortfolios() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["portfolios", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolios")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Portfolio[];
    },
    enabled: !!user,
  });
}

export function useActivePortfolio() {
  const { data: portfolios = [], isLoading } = usePortfolios();
  const [activeId, setActiveId] = useState<string | null>(getStoredPortfolioId);

  // Validate stored ID against actual portfolios
  useEffect(() => {
    if (portfolios.length === 0) return;
    const match = portfolios.find((p) => p.id === activeId);
    if (!match) {
      setActiveId(portfolios[0].id);
      setStoredPortfolioId(portfolios[0].id);
    }
  }, [portfolios, activeId]);

  const setActive = useCallback((id: string) => {
    setActiveId(id);
    setStoredPortfolioId(id);
  }, []);

  const portfolio = portfolios.find((p) => p.id === activeId) || portfolios[0] || null;

  return { portfolio, portfolios, setActive, activeId: portfolio?.id || null, isLoading };
}

export function useCreatePortfolio() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase
        .from("portfolios")
        .insert({ user_id: user!.id, name })
        .select()
        .single();
      if (error) throw error;
      return data as Portfolio;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
    },
  });
}

export function useRenamePortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("portfolios").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
    },
  });
}

export function useDeletePortfolio() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portfolios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolios"] });
      queryClient.invalidateQueries({ queryKey: ["trades"] });
    },
  });
}

// Legacy hook — redirects to active portfolio
export function useDefaultPortfolio() {
  const { portfolio, isLoading } = useActivePortfolio();
  return { data: portfolio, isLoading };
}

export function useTrades(portfolioId?: string) {
  const { user } = useAuth();
  const { activeId } = useActivePortfolio();
  const pid = portfolioId || activeId;

  return useQuery({
    queryKey: ["trades", user?.id, pid],
    queryFn: async () => {
      let query = supabase
        .from("trades")
        .select("*")
        .eq("user_id", user!.id)
        .order("trade_date", { ascending: false });

      if (pid) {
        query = query.eq("portfolio_id", pid);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Trade[];
    },
    enabled: !!user && !!pid,
  });
}

export function computeHoldings(trades: Trade[]): Holding[] {
  const map = new Map<string, { buys: number; buyQty: number; sells: number; sellQty: number; asset_name: string; asset_type: string }>();

  for (const t of trades) {
    // Exclude dividend trades from holdings calculation
    if (t.trade_type === "dividend") continue;

    const entry = map.get(t.symbol) || { buys: 0, buyQty: 0, sells: 0, sellQty: 0, asset_name: t.asset_name, asset_type: t.asset_type };
    if (t.trade_type === "buy") {
      entry.buys += t.quantity * t.price_per_unit;
      entry.buyQty += t.quantity;
    } else {
      entry.sells += t.quantity * t.price_per_unit;
      entry.sellQty += t.quantity;
    }
    entry.asset_name = t.asset_name;
    entry.asset_type = t.asset_type;
    map.set(t.symbol, entry);
  }

  return Array.from(map.entries())
    .map(([symbol, e]) => {
      const net_quantity = e.buyQty - e.sellQty;
      const avg_cost = e.buyQty > 0 ? e.buys / e.buyQty : 0;
      return {
        symbol,
        asset_name: e.asset_name,
        asset_type: e.asset_type,
        net_quantity,
        avg_cost,
        total_invested: avg_cost * net_quantity,
      };
    })
    .filter((h) => h.net_quantity > 0);
}

// --- Realized P&L computation (average cost method) ---
export function computePerformance(trades: Trade[]): PortfolioPerformance {
  // Group trades by symbol, sorted chronologically
  const bySymbol = new Map<string, Trade[]>();
  for (const t of trades) {
    const arr = bySymbol.get(t.symbol) || [];
    arr.push(t);
    bySymbol.set(t.symbol, arr);
  }

  const symbolPerfs: SymbolPerformance[] = [];
  let totalRealizedPnl = 0;
  let totalDividends = 0;
  let totalCostBasis = 0;
  let totalWinningSells = 0;
  let totalSells = 0;

  for (const [symbol, symbolTrades] of bySymbol.entries()) {
    // Sort ascending by date
    const sorted = [...symbolTrades].sort(
      (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
    );

    let qty = 0;
    let avgCost = 0;
    let realizedPnl = 0;
    let dividends = 0;
    let winningSells = 0;
    let sellCount = 0;
    let assetName = sorted[0].asset_name;

    for (const t of sorted) {
      assetName = t.asset_name;

      if (t.trade_type === "buy") {
        // Update weighted average cost
        const totalCost = avgCost * qty + t.price_per_unit * t.quantity;
        qty += t.quantity;
        avgCost = qty > 0 ? totalCost / qty : 0;
      } else if (t.trade_type === "sell") {
        const pnl = (t.price_per_unit - avgCost) * t.quantity;
        realizedPnl += pnl;
        if (pnl > 0) winningSells++;
        sellCount++;
        qty -= t.quantity;
        if (qty <= 0) {
          qty = 0;
          avgCost = 0;
        }
      } else if (t.trade_type === "dividend") {
        dividends += Number(t.total_amount) || t.price_per_unit * t.quantity;
      }
    }

    const costBasis = avgCost * qty;
    totalRealizedPnl += realizedPnl;
    totalDividends += dividends;
    totalCostBasis += costBasis;
    totalWinningSells += winningSells;
    totalSells += sellCount;

    symbolPerfs.push({
      symbol,
      asset_name: assetName,
      realized_pnl: realizedPnl,
      dividends_received: dividends,
      total_return: realizedPnl + dividends,
      winning_sells: winningSells,
      total_sells: sellCount,
      open_quantity: qty,
      avg_cost: avgCost,
      cost_basis: costBasis,
    });
  }

  return {
    total_realized_pnl: totalRealizedPnl,
    total_dividends: totalDividends,
    total_return: totalRealizedPnl + totalDividends,
    total_cost_basis: totalCostBasis,
    win_rate: totalSells > 0 ? (totalWinningSells / totalSells) * 100 : 0,
    winning_sells: totalWinningSells,
    total_sells: totalSells,
    by_symbol: symbolPerfs,
  };
}

// --- Cumulative P&L over time ---
export interface CumulativePnLPoint {
  date: string;
  cumulative_pnl: number;
}

export function computeCumulativePnL(trades: Trade[]): CumulativePnLPoint[] {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
  );

  const positions = new Map<string, { qty: number; avgCost: number }>();
  const points: CumulativePnLPoint[] = [];
  let cumulative = 0;

  for (const t of sorted) {
    const pos = positions.get(t.symbol) || { qty: 0, avgCost: 0 };

    if (t.trade_type === "buy") {
      const totalCost = pos.avgCost * pos.qty + t.price_per_unit * t.quantity;
      pos.qty += t.quantity;
      pos.avgCost = pos.qty > 0 ? totalCost / pos.qty : 0;
      positions.set(t.symbol, pos);
    } else if (t.trade_type === "sell") {
      const pnl = (t.price_per_unit - pos.avgCost) * t.quantity;
      cumulative += pnl;
      pos.qty -= t.quantity;
      if (pos.qty <= 0) { pos.qty = 0; pos.avgCost = 0; }
      positions.set(t.symbol, pos);
      points.push({ date: t.trade_date.split("T")[0], cumulative_pnl: Math.round(cumulative * 100) / 100 });
    } else if (t.trade_type === "dividend") {
      cumulative += Number(t.total_amount) || t.price_per_unit * t.quantity;
      points.push({ date: t.trade_date.split("T")[0], cumulative_pnl: Math.round(cumulative * 100) / 100 });
    }
  }

  return points;
}
