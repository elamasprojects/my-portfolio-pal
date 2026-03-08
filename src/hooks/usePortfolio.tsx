import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Trade {
  id: string;
  portfolio_id: string;
  user_id: string;
  symbol: string;
  asset_name: string;
  asset_type: "stock" | "etf" | "crypto" | "bond" | "other";
  trade_type: "buy" | "sell";
  quantity: number;
  price_per_unit: number;
  total_amount: number;
  trade_date: string;
  notes: string | null;
  created_at: string;
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

export function useDefaultPortfolio() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["portfolio", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolios")
        .select("*")
        .eq("user_id", user!.id)
        .limit(1)
        .single();
      if (error) throw error;
      return data as Portfolio;
    },
    enabled: !!user,
  });
}

export function useTrades() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["trades", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", user!.id)
        .order("trade_date", { ascending: false });
      if (error) throw error;
      return data as Trade[];
    },
    enabled: !!user,
  });
}

export function computeHoldings(trades: Trade[]): Holding[] {
  const map = new Map<string, { buys: number; buyQty: number; sells: number; sellQty: number; asset_name: string; asset_type: string }>();

  for (const t of trades) {
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
