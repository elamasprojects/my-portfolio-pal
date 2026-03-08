import { useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { Trade, Portfolio, computePerformance } from "./usePortfolio";
import { toast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";

export interface AchievementDef {
  key: string;
  title: string;
  description: string;
  emoji: string;
  check: (ctx: AchievementContext) => boolean;
}

interface AchievementContext {
  trades: Trade[];
  portfolios: Portfolio[];
  tagAssignmentCount: number;
}

export interface AchievementStatus {
  key: string;
  title: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  unlockedAt: string | null;
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    key: "first_trade",
    title: "First Steps",
    description: "Log your first trade",
    emoji: "🚀",
    check: (ctx) => ctx.trades.length >= 1,
  },
  {
    key: "ten_trades",
    title: "Getting Serious",
    description: "Log 10 trades",
    emoji: "📈",
    check: (ctx) => ctx.trades.length >= 10,
  },
  {
    key: "hundred_trades",
    title: "Centurion",
    description: "Log 100 trades",
    emoji: "💯",
    check: (ctx) => ctx.trades.length >= 100,
  },
  {
    key: "first_sell",
    title: "Closing Time",
    description: "Complete your first sell",
    emoji: "🔔",
    check: (ctx) => ctx.trades.some((t) => t.trade_type === "sell"),
  },
  {
    key: "first_profit",
    title: "In the Green",
    description: "Make a profitable sell",
    emoji: "💰",
    check: (ctx) => {
      const perf = computePerformance(ctx.trades);
      return perf.winning_sells > 0;
    },
  },
  {
    key: "first_dividend",
    title: "Passive Income",
    description: "Receive your first dividend",
    emoji: "🏦",
    check: (ctx) => ctx.trades.some((t) => t.trade_type === "dividend"),
  },
  {
    key: "diversified_3",
    title: "Spreading Out",
    description: "Hold 3 different assets",
    emoji: "🌱",
    check: (ctx) => new Set(ctx.trades.map((t) => t.symbol)).size >= 3,
  },
  {
    key: "diversified_5",
    title: "Well Diversified",
    description: "Trade 5 different assets",
    emoji: "🌳",
    check: (ctx) => new Set(ctx.trades.map((t) => t.symbol)).size >= 5,
  },
  {
    key: "multi_asset",
    title: "Asset Explorer",
    description: "Trade across 3 asset types",
    emoji: "🧭",
    check: (ctx) => new Set(ctx.trades.map((t) => t.asset_type)).size >= 3,
  },
  {
    key: "profitable_month",
    title: "Monthly Win",
    description: "Have a month with positive P&L",
    emoji: "🏆",
    check: (ctx) => {
      const sorted = [...ctx.trades].sort(
        (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
      );
      const positions = new Map<string, { qty: number; avgCost: number }>();
      const monthPnl = new Map<string, number>();
      for (const t of sorted) {
        const d = new Date(t.trade_date);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const pos = positions.get(t.symbol) || { qty: 0, avgCost: 0 };
        if (t.trade_type === "buy") {
          const tc = pos.avgCost * pos.qty + t.price_per_unit * t.quantity;
          pos.qty += t.quantity;
          pos.avgCost = pos.qty > 0 ? tc / pos.qty : 0;
          positions.set(t.symbol, pos);
        } else if (t.trade_type === "sell") {
          const pnl = (t.price_per_unit - pos.avgCost) * t.quantity;
          monthPnl.set(key, (monthPnl.get(key) || 0) + pnl);
          pos.qty -= t.quantity;
          if (pos.qty <= 0) { pos.qty = 0; pos.avgCost = 0; }
          positions.set(t.symbol, pos);
        } else if (t.trade_type === "dividend") {
          const amt = Number(t.total_amount) || t.price_per_unit * t.quantity;
          monthPnl.set(key, (monthPnl.get(key) || 0) + amt);
        }
      }
      return Array.from(monthPnl.values()).some((v) => v > 0);
    },
  },
  {
    key: "tagged_trade",
    title: "Strategist",
    description: "Tag your first trade",
    emoji: "🏷️",
    check: (ctx) => ctx.tagAssignmentCount > 0,
  },
  {
    key: "multi_portfolio",
    title: "Portfolio Pro",
    description: "Create a second portfolio",
    emoji: "📂",
    check: (ctx) => ctx.portfolios.length >= 2,
  },
];

function useUnlockedAchievements() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["achievements", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("achievements" as any)
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data as unknown as { id: string; user_id: string; achievement_key: string; unlocked_at: string }[];
    },
    enabled: !!user,
  });
}

function useUnlockAchievement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { error } = await supabase
        .from("achievements" as any)
        .insert({ user_id: user!.id, achievement_key: key });
      if (error && !error.message.includes("duplicate")) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["achievements"] });
    },
  });
}

export function useAchievements(trades: Trade[], portfolios: Portfolio[], tagAssignmentCount: number) {
  const { data: unlocked = [], isLoading } = useUnlockedAchievements();
  const unlock = useUnlockAchievement();
  const processedRef = useRef(new Set<string>());

  const ctx: AchievementContext = useMemo(
    () => ({ trades, portfolios, tagAssignmentCount }),
    [trades, portfolios, tagAssignmentCount]
  );

  const unlockedKeys = useMemo(() => new Set(unlocked.map((a) => a.achievement_key)), [unlocked]);

  const statuses: AchievementStatus[] = useMemo(() => {
    return ACHIEVEMENT_DEFS.map((def) => {
      const record = unlocked.find((a) => a.achievement_key === def.key);
      return {
        key: def.key,
        title: def.title,
        description: def.description,
        emoji: def.emoji,
        unlocked: !!record,
        unlockedAt: record?.unlocked_at || null,
      };
    });
  }, [unlocked]);

  // Check for newly earned achievements and unlock them
  useEffect(() => {
    if (isLoading || trades.length === 0) return;

    for (const def of ACHIEVEMENT_DEFS) {
      if (unlockedKeys.has(def.key)) continue;
      if (processedRef.current.has(def.key)) continue;

      if (def.check(ctx)) {
        processedRef.current.add(def.key);
        unlock.mutate(def.key);

        // Celebrate!
        setTimeout(() => {
          toast({
            title: `${def.emoji} Achievement Unlocked!`,
            description: `${def.title} — ${def.description}`,
          });
          confetti({
            particleCount: 80,
            spread: 60,
            origin: { y: 0.7 },
          });
        }, 500);
      }
    }
  }, [ctx, unlockedKeys, isLoading]);

  const progress = statuses.filter((s) => s.unlocked).length;

  return { statuses, progress, total: ACHIEVEMENT_DEFS.length, isLoading };
}
