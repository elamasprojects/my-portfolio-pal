import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Broker {
  id: string;
  name: string;
  country: string;
  category: string;
  display_order: number;
}

export interface UserBroker {
  id: string;
  user_id: string;
  broker_id: string;
  commission_pct: number;
  is_default: boolean;
  created_at: string;
  broker?: Broker;
}

export function useBrokers() {
  return useQuery({
    queryKey: ["brokers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("brokers")
        .select("*")
        .order("country")
        .order("display_order");
      if (error) throw error;
      return data as Broker[];
    },
  });
}

export function useUserBrokers() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user_brokers", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("user_brokers")
        .select("*, broker:brokers(*)")
        .eq("user_id", user.id)
        .order("created_at");
      if (error) throw error;
      return (data || []).map((ub: any) => ({
        ...ub,
        broker: ub.broker as Broker,
      })) as UserBroker[];
    },
    enabled: !!user,
  });
}

export function useDefaultBroker() {
  const { data: userBrokers } = useUserBrokers();
  return userBrokers?.find((ub) => ub.is_default) || null;
}

export function useAddUserBroker() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ brokerId, commissionPct = 0, isDefault = false }: { brokerId: string; commissionPct?: number; isDefault?: boolean }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("user_brokers").insert({
        user_id: user.id,
        broker_id: brokerId,
        commission_pct: commissionPct,
        is_default: isDefault,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_brokers"] });
    },
  });
}

export function useUpdateUserBroker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, commissionPct, isDefault }: { id: string; commissionPct?: number; isDefault?: boolean }) => {
      const updates: any = {};
      if (commissionPct !== undefined) updates.commission_pct = commissionPct;
      if (isDefault !== undefined) updates.is_default = isDefault;
      const { error } = await supabase.from("user_brokers").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_brokers"] });
    },
  });
}

export function useRemoveUserBroker() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_brokers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_brokers"] });
    },
  });
}
