import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Strategy {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_default: boolean;
  created_at: string;
}

export function useStrategies() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["strategies", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategies")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Strategy[];
    },
  });
}

export function useDefaultStrategy() {
  const { data: strategies } = useStrategies();
  return strategies?.find((s) => s.is_default) ?? null;
}

export function useCreateStrategy() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; description?: string; icon?: string; is_default?: boolean }) => {
      const { error } = await supabase.from("strategies").insert({
        user_id: user!.id,
        name: input.name,
        description: input.description || null,
        icon: input.icon || "TrendingUp",
        is_default: input.is_default ?? false,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies"] }),
  });
}

export function useUpdateStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; name?: string; description?: string; icon?: string }) => {
      const { error } = await supabase
        .from("strategies")
        .update({ name: input.name, description: input.description, icon: input.icon })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies"] }),
  });
}

export function useDeleteStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("strategies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies"] }),
  });
}

export function useSetDefaultStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // The DB trigger handles unsetting others
      const { error } = await supabase
        .from("strategies")
        .update({ is_default: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["strategies"] }),
  });
}
