import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { Trip, TripItem, TripItemMode } from "@/lib/tripSummary";

/**
 * Viajes y sus excepciones.
 *
 * Las transacciones no se piden acá: se reusa `useTransactions`, que ya las tiene en caché
 * para las otras vistas.
 */

/**
 * `integrations/supabase/types.ts` está generado y quedó atrás — no conoce ninguna de las
 * tablas de finanzas, ni las de viajes —, así que el cliente tipado rechaza sus nombres. El
 * resto de `useFinance` lo resuelve con un cast en cada llamada; acá se hace una sola vez,
 * para que el escape de tipos esté en un lugar con el motivo escrito y no repartido por todo
 * el archivo. Se va cuando se regeneren los tipos.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fromTable = (table: string) => (supabase as any).from(table);

/** Mensaje de error para el toast, sin tener que tipar el error como `any`. */
function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function useTrips() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pf_trips", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await fromTable("pf_trips")
        .select("*")
        .eq("user_id", user.id)
        .order("start_date", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as Trip[];
    },
    enabled: !!user,
  });

  const addTrip = useMutation({
    mutationFn: async (trip: Omit<Trip, "id" | "user_id">) => {
      if (!user) throw new Error("No user");
      const { data, error } = await fromTable("pf_trips")
        .insert({
          user_id: user.id,
          name: trip.name?.trim(),
          destination: trip.destination?.trim() || null,
          start_date: trip.start_date,
          end_date: trip.end_date,
          notes: trip.notes || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Trip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pf_trips"] });
      toast.success("Viaje creado");
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "No se pudo crear el viaje")),
  });

  const deleteTrip = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No user");
      const { error } = await fromTable("pf_trips")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pf_trips"] });
      // Borrar el viaje no toca ninguna transacción: las excepciones caen con él por cascada.
      toast.success("Viaje eliminado");
    },
    onError: (err: unknown) => toast.error(errorMessage(err, "No se pudo eliminar el viaje")),
  });

  return {
    trips: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    addTrip,
    deleteTrip,
  };
}

/**
 * Todas las excepciones del usuario, de todos sus viajes.
 *
 * La usa el listado: para mostrar el total de cada viaje hay que resolver su pertenencia, y
 * eso necesita sus excepciones. Una consulta para todas en vez de una por viaje.
 */
export function useAllTripItems() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["pf_trip_items", user?.id, "all"],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await fromTable("pf_trip_items")
        .select("*")
        .eq("user_id", user.id);

      if (error) throw error;
      return (data || []) as unknown as TripItem[];
    },
    enabled: !!user,
  });

  return { items: query.data || [], isLoading: query.isLoading };
}

/** Las excepciones de un viaje, y las dos formas de moverlas. */
export function useTripItems(tripId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pf_trip_items", user?.id, tripId],
    queryFn: async () => {
      if (!user || !tripId) return [];
      const { data, error } = await fromTable("pf_trip_items")
        .select("*")
        .eq("user_id", user.id)
        .eq("trip_id", tripId);

      if (error) throw error;
      return (data || []) as unknown as TripItem[];
    },
    enabled: !!user && !!tripId,
  });

  // Se invalida el prefijo, no la clave exacta: `useAllTripItems` cuelga del mismo prefijo con
  // "all" al final, y con la clave completa el listado de viajes se quedaba con los totales
  // viejos hasta recargar.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["pf_trip_items", user?.id] });

  /**
   * Marca una transacción como parte del viaje o fuera de él.
   *
   * Va por `upsert` sobre (trip_id, transaction_id): sin eso, cambiar de opinión sobre una
   * fila dejaba las dos marcas conviviendo y el total pasaba a depender del orden en que
   * volvían las filas.
   */
  const setItem = useMutation({
    mutationFn: async (args: { transactionId: string; mode: TripItemMode; reason?: string }) => {
      if (!user || !tripId) throw new Error("No user or trip");
      const { error } = await fromTable("pf_trip_items").upsert(
        {
          user_id: user.id,
          trip_id: tripId,
          transaction_id: args.transactionId,
          mode: args.mode,
          reason: args.reason || null,
        },
        { onConflict: "trip_id,transaction_id" }
      );
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (err: unknown) => toast.error(errorMessage(err, "No se pudo actualizar el viaje")),
  });

  /** Saca la excepción y devuelve la fila a lo que diga la ventana de fechas. */
  const clearItem = useMutation({
    mutationFn: async (transactionId: string) => {
      if (!user || !tripId) throw new Error("No user or trip");
      const { error } = await fromTable("pf_trip_items")
        .delete()
        .eq("user_id", user.id)
        .eq("trip_id", tripId)
        .eq("transaction_id", transactionId);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (err: unknown) => toast.error(errorMessage(err, "No se pudo actualizar el viaje")),
  });

  return {
    items: query.data || [],
    isLoading: query.isLoading,
    setItem,
    clearItem,
  };
}
