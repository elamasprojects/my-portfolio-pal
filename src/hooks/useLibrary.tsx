import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { LibraryItem, LibraryItemInput } from "@/lib/library";

/**
 * La biblioteca personal (libros, cursos, mentores, negocios).
 *
 * `pf_library_items` es nueva y `integrations/supabase/types.ts` (generado) todavía no la
 * conoce; el escape de tipos va una sola vez acá, con el motivo, igual que en `useTrips`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (table: string) => (supabase as any).from(table);

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function useLibrary() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["pf_library_items"] });

  const query = useQuery({
    queryKey: ["pf_library_items", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await fromTable("pf_library_items")
        .select("*")
        .eq("user_id", user.id)
        .order("title", { ascending: true });
      if (error) throw error;
      return (data || []) as LibraryItem[];
    },
    enabled: !!user,
  });

  const addItem = useMutation({
    mutationFn: async (item: Partial<LibraryItemInput> & Pick<LibraryItemInput, "kind" | "title">) => {
      if (!user) throw new Error("No user");
      const { error } = await fromTable("pf_library_items").insert({
        ...item,
        title: item.title.trim(),
        user_id: user.id,
        source_path: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Agregado a la biblioteca");
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "No se pudo agregar")),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<LibraryItemInput> & { id: string }) => {
      const { error } = await fromTable("pf_library_items")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Guardado");
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "No se pudo guardar")),
  });

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await fromTable("pf_library_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Eliminado");
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "No se pudo eliminar")),
  });

  return {
    items: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    addItem,
    updateItem,
    deleteItem,
  };
}
