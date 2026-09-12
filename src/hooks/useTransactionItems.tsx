import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { signReceipt } from "@/lib/receipts";
import type { TransactionItem } from "@/types/finance";

/**
 * Los renglones de UN ticket. Se piden recien cuando la fila se despliega: el feed carga
 * cientos de movimientos y casi ninguno se abre.
 */
export function useTransactionItems(transactionId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transaction_items", transactionId],
    queryFn: async () => {
      if (!user || !transactionId) return [];
      const { data, error } = await supabase
        .from("transaction_items" as any)
        .select("*")
        .eq("transaction_id", transactionId)
        .order("position", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as TransactionItem[];
    },
    enabled: !!user && !!transactionId,
  });
}

/**
 * Cuantos renglones tiene cada transaccion, para poder marcar en el feed cual es un ticket
 * SIN abrir una consulta por fila. Trae solo la columna del FK, que es lo mas barato que hay
 * que traer para contar; agrupar en el cliente evita tener que sostener una vista o un RPC.
 */
export function useTransactionItemCounts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["transaction_item_counts", user?.id],
    queryFn: async () => {
      if (!user) return new Map<string, number>();
      const { data, error } = await supabase
        .from("transaction_items" as any)
        .select("transaction_id")
        .eq("user_id", user.id);

      if (error) throw error;

      const counts = new Map<string, number>();
      for (const row of (data || []) as unknown as { transaction_id: string }[]) {
        counts.set(row.transaction_id, (counts.get(row.transaction_id) ?? 0) + 1);
      }
      return counts;
    },
    enabled: !!user,
  });
}

/**
 * La URL firmada de la foto del ticket. Se re-pide sola antes de que venza: el bucket es
 * privado y la firma dura una hora, asi que una pestaña abierta toda la tarde se quedaba con
 * un <img> roto.
 */
export function useReceiptUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["receipt_signed_url", path],
    queryFn: async () => (path ? await signReceipt(path) : null),
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    refetchInterval: 50 * 60 * 1000,
  });
}
