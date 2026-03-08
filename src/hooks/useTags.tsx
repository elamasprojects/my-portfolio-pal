import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface TradeTag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export function useTags() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["trade_tags", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_tags" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("name");
      if (error) throw error;
      return data as unknown as TradeTag[];
    },
    enabled: !!user,
  });
}

export function useTradeTagAssignments(tradeIds: string[]) {
  return useQuery({
    queryKey: ["trade_tag_assignments", tradeIds],
    queryFn: async () => {
      if (tradeIds.length === 0) return [];
      const { data, error } = await supabase
        .from("trade_tag_assignments" as any)
        .select("trade_id, tag_id")
        .in("trade_id", tradeIds);
      if (error) throw error;
      return data as unknown as { trade_id: string; tag_id: string }[];
    },
    enabled: tradeIds.length > 0,
  });
}

export function useCreateTag() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, color }: { name: string; color?: string }) => {
      const { data, error } = await supabase
        .from("trade_tags" as any)
        .insert({ user_id: user!.id, name, color: color || "#3b82f6" })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TradeTag;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade_tags"] });
    },
  });
}

export function useAssignTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tradeId, tagId }: { tradeId: string; tagId: string }) => {
      const { error } = await supabase
        .from("trade_tag_assignments" as any)
        .insert({ trade_id: tradeId, tag_id: tagId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade_tag_assignments"] });
    },
  });
}

export function useRemoveTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ tradeId, tagId }: { tradeId: string; tagId: string }) => {
      const { error } = await supabase
        .from("trade_tag_assignments" as any)
        .delete()
        .eq("trade_id", tradeId)
        .eq("tag_id", tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade_tag_assignments"] });
    },
  });
}

export function useDeleteTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tagId: string) => {
      const { error } = await supabase
        .from("trade_tags" as any)
        .delete()
        .eq("id", tagId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade_tags"] });
      queryClient.invalidateQueries({ queryKey: ["trade_tag_assignments"] });
    },
  });
}
