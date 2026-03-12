import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useActivePortfolio } from "./usePortfolio";

export interface PortfolioPosition {
  user_id: string;
  portfolio_id: string;
  symbol: string;
  quantity: number;
  avg_cost: number;
  cost_basis: number;
  updated_at: string;
}

export function usePortfolioPositions(portfolioId?: string) {
  const { user } = useAuth();
  const { activeId } = useActivePortfolio();
  const pid = portfolioId || activeId;

  return useQuery({
    queryKey: ["portfolio_positions", user?.id, pid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_positions" as any)
        .select("*")
        .eq("user_id", user!.id)
        .eq("portfolio_id", pid!);
      if (error) throw error;
      return (data as any[]).map((d) => ({
        ...d,
        quantity: Number(d.quantity),
        avg_cost: Number(d.avg_cost),
        cost_basis: Number(d.cost_basis),
      })) as PortfolioPosition[];
    },
    enabled: !!user && !!pid,
  });
}
