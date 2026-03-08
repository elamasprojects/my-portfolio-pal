import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface FollowRequest {
  id: string;
  requester_id: string;
  target_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  updated_at: string;
}

export function useFollows() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: incomingRequests = [] } = useQuery({
    queryKey: ["follow-requests-incoming", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("follow_requests")
        .select("*")
        .eq("target_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FollowRequest[];
    },
    enabled: !!user,
  });

  const { data: sentRequests = [] } = useQuery({
    queryKey: ["follow-requests-sent", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("follow_requests")
        .select("*")
        .eq("requester_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as FollowRequest[];
    },
    enabled: !!user,
  });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: acceptedSentRequests = [] } = useQuery({
    queryKey: ["follow-requests-accepted-sent", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("follow_requests")
        .select("*")
        .eq("requester_id", user.id)
        .eq("status", "accepted")
        .gte("updated_at", sevenDaysAgo)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as FollowRequest[];
    },
    enabled: !!user,
  });

  const sendRequest = useMutation({
    mutationFn: async (targetId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("follow_requests")
        .insert({ requester_id: user.id, target_id: targetId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-requests-sent"] });
    },
  });

  const respondToRequest = useMutation({
    mutationFn: async ({ requestId, status }: { requestId: string; status: "accepted" | "declined" }) => {
      const { error } = await supabase
        .from("follow_requests")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", requestId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["follow-requests-incoming"] });
      queryClient.invalidateQueries({ queryKey: ["follow-requests-sent"] });
    },
  });

  return { incomingRequests, sentRequests, sendRequest, respondToRequest };
}
