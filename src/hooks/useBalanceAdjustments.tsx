import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { PlannedAdjustment } from "@/lib/balanceAdjustment";

/**
 * Ajustes de saldo: el historial y la acción de ajustar.
 *
 * `types.ts` está generado y no conoce ni la tabla ni la función, así que el cliente tipado
 * rechaza sus nombres. El escape va una sola vez, acá, con el motivo escrito; se va cuando se
 * regeneren los tipos.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface BalanceAdjustment {
  id: string;
  account_id: string;
  balance_before: number;
  balance_after: number;
  delta: number;
  currency: string;
  note: string | null;
  created_at: string;
}

export function useBalanceAdjustments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pf_balance_adjustments", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await db
        .from("pf_balance_adjustments")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as BalanceAdjustment[];
    },
    enabled: !!user,
  });

  // El más reciente por cuenta: la lista ya viene ordenada, así que gana el primero que aparece.
  const lastByAccount = useMemo(() => {
    const m = new Map<string, BalanceAdjustment>();
    for (const a of query.data ?? []) if (!m.has(a.account_id)) m.set(a.account_id, a);
    return m;
  }, [query.data]);

  /**
   * Una llamada por cuenta, en serie. Si una falla, las anteriores ya quedaron (cada una es
   * atómica en la base) y el error dice cuántas entraron: reintentar todo de nuevo
   * re-ajustaría las que ya estaban bien a su mismo valor, que es inofensivo.
   */
  const adjust = useMutation({
    mutationFn: async ({ plan, note }: { plan: PlannedAdjustment[]; note?: string }) => {
      let done = 0;
      for (const p of plan) {
        const { error } = await db.rpc("adjust_account_balance", {
          p_account_id: p.accountId,
          p_real_balance: p.after,
          p_note: note ?? null,
        });
        if (error) {
          throw new Error(
            done > 0
              ? `Se ajustaron ${done} de ${plan.length} cuentas. Falló una: ${error.message}`
              : error.message,
          );
        }
        done++;
      }
      return done;
    },
    // En los dos casos: si falló a la mitad, las que entraron ya movieron el saldo.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["pf_balance_adjustments"] });
    },
  });

  return { adjustments: query.data ?? [], lastByAccount, isLoading: query.isLoading, adjust };
}
