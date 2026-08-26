import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Sincronizacion de gastos desde una tarjeta de Mercury.
 *
 * La extraccion esta acotada a las tarjetas que figuran en `mercury_card_links`.
 * No hay forma de pedir "todo Mercury" desde aca: si no hay vinculo activo, la
 * funcion no trae nada.
 */

export interface MercuryCardLink {
  id: string;
  user_id: string;
  mercury_card_id: string;
  label: string;
  payment_method_id: string | null;
  account_id: string | null;
  is_active: boolean;
  lookback_days: number;
  last_synced_at: string | null;
}

export interface MercuryImportedRow {
  mercury_id: string;
  type: "expense" | "income";
  name: string;
  amount: number;
  transaction_date: string;
  category: string | null;
  needs_review: boolean;
}

export interface MercuryLinkResult {
  link: string;
  startDate?: string;
  endDate?: string;
  imported: MercuryImportedRow[];
  skipped: Array<{ mercury_id: string; reason: string; status?: string }>;
  reverted: Array<{ mercury_id: string; status: string }>;
  error?: string;
}

export interface MercurySyncResult {
  results: MercuryLinkResult[];
  totalImported: number;
  totalReverted: number;
  totalNeedsReview: number;
  totalAmount: number;
  failed?: number;
  message?: string;
}

export function useMercuryCardLinks() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["mercury_card_links", user?.id],
    queryFn: async () => {
      if (!user) return [];
      // `as any` como el resto del modulo de finanzas (16 usos iguales en
      // useFinance.tsx): `integrations/supabase/types.ts` es generado y todavia
      // no conoce estas tablas. El arreglo de fondo es regenerarlo, no castear
      // caso por caso -- pero eso toca las 16 y va aparte.
      const { data, error } = await supabase
        .from("mercury_card_links" as any)
        .select("*")
        .eq("user_id", user.id)
        .order("label", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as MercuryCardLink[];
    },
    enabled: !!user,
  });
}

export function useMercurySync() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: { cardId?: string; startDate?: string; endDate?: string } = {}) => {
      const { data, error } = await supabase.functions.invoke("mercury-personal-import", {
        body: params,
      });
      // `invoke` marca error para cualquier status !== 2xx, pero el cuerpo con el
      // detalle igual viene en `error.context`. Sin leerlo, un 500 con causa
      // concreta ("MERCURY_API_TOKEN no esta configurado") llegaria al usuario
      // como un generico "Edge Function returned a non-2xx status code".
      if (error) {
        let detail = error.message || "Error de la edge function";
        try {
          const body = await (error as { context?: Response }).context?.json();
          if (body?.error) {
            detail = body.error;
          } else if (Array.isArray(body?.results)) {
            // Cuando fallan *todos* los vinculos la funcion responde 502, pero la
            // causa no viaja en `error` de nivel raiz: cada vinculo trae la suya en
            // `results[].error`. Sin leerlas, el 502 llegaba como el generico
            // "Edge Function returned a non-2xx status code".
            const reasons = (body.results as MercuryLinkResult[])
              .filter((r) => r.error)
              .map((r) => `${r.link}: ${r.error}`);
            if (reasons.length > 0) detail = reasons.join(" · ");
          }
        } catch {
          // el cuerpo no era JSON: nos quedamos con el mensaje original
        }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);
      return data as MercurySyncResult;
    },
    onSuccess: (res) => {
      // Todo lo que toca el import mueve saldos y listados: se invalida todo el
      // arbol de finanzas, no solo las transacciones.
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] });
      queryClient.invalidateQueries({ queryKey: ["mercury_card_links"] });

      if (res?.message) {
        toast.info(res.message);
        return;
      }

      const parts: string[] = [];
      if (res.totalImported > 0) {
        parts.push(`${res.totalImported} importado(s) · USD ${res.totalAmount.toFixed(2)}`);
      }
      if (res.totalNeedsReview > 0) parts.push(`${res.totalNeedsReview} a revisar`);
      if (res.totalReverted > 0) parts.push(`${res.totalReverted} revertido(s)`);

      // Si un vinculo falla y otro anda, la funcion responde 200 y este `onSuccess`
      // corre igual. Mirando solo los totales, una tarjeta caida se anunciaba como
      // "nada nuevo para importar": el usuario leia que estaba al dia justo cuando
      // le faltaban movimientos.
      const failedLinks = (res?.results ?? []).filter((r) => r.error);
      if (failedLinks.length > 0) {
        const detail = failedLinks.map((r) => `${r.link}: ${r.error}`).join(" · ");
        toast.error(
          parts.length > 0
            ? `Mercury (parcial): ${parts.join(" · ")}. Fallo ${detail}`
            : `Mercury: fallo la sincronizacion. ${detail}`
        );
        return;
      }

      if (parts.length === 0) {
        toast.info("Mercury: nada nuevo para importar");
      } else {
        toast.success(`Mercury: ${parts.join(" · ")}`);
      }
    },
    onError: (err: Error) => {
      toast.error(`Error al sincronizar Mercury: ${err.message}`);
    },
  });
}
