// Real, DB-backed watchlist (per-user, RLS-protected `public.watchlist` table).
//
// Backend setup is documented in WATCHLIST_BACKEND.md + supabase/migrations/*_create_watchlist.sql.
// Until that table exists the queries no-op gracefully (empty list); once it's applied this
// works with no further code changes. Mirrors the useTags React Query CRUD pattern.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface WatchItem {
  id: string;
  symbol: string;
  name: string;
}

export function useWatchlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["watchlist", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("watchlist" as any)
        .select("id, symbol, name, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data as unknown as WatchItem[]) ?? [];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async ({ symbol, name }: { symbol: string; name?: string }) => {
      const sym = symbol.trim().toUpperCase();
      const { error } = await supabase
        .from("watchlist" as any)
        .insert({ user_id: user!.id, symbol: sym, name: (name || sym).trim() });
      // 23505 = unique_violation → already on the list, treat as success
      if (error && (error as { code?: string }).code !== "23505") throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  const removeMutation = useMutation({
    mutationFn: async (symbol: string) => {
      const { error } = await supabase
        .from("watchlist" as any)
        .delete()
        .eq("user_id", user!.id)
        .eq("symbol", symbol.trim().toUpperCase());
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["watchlist"] }),
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    add: (symbol: string, name?: string) => addMutation.mutateAsync({ symbol, name }),
    remove: (symbol: string) => removeMutation.mutate(symbol),
    isAdding: addMutation.isPending,
  };
}
