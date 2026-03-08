import { useState } from "react";
import { Users, UserPlus, Check, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useFollows } from "@/hooks/useFollows";
import { useLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

export default function Players() {
  const { user } = useAuth();
  const { sentRequests, sendRequest } = useFollows();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const { data: results = [], isLoading } = useQuery({
    queryKey: ["player-search", search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, username")
        .or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
        .neq("id", user?.id || "")
        .limit(20);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: search.length >= 2,
  });

  const { data: connections = [], isLoading: loadingConnections } = useQuery({
    queryKey: ["my-connections", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("follow_requests")
        .select("requester_id, target_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${user.id},target_id.eq.${user.id}`);
      if (error) throw error;

      const otherIds = data.map((r) =>
        r.requester_id === user.id ? r.target_id : r.requester_id
      );
      if (otherIds.length === 0) return [];

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, username")
        .in("id", otherIds);
      if (pErr) throw pErr;
      return profiles as Profile[];
    },
    enabled: !!user,
  });

  const getRequestStatus = (targetId: string) => {
    const req = sentRequests.find((r) => r.target_id === targetId);
    return req?.status || null;
  };

  const handleRequest = (targetId: string) => {
    sendRequest.mutate(targetId, {
      onSuccess: () => toast.success(t("social.requestSent")),
      onError: (err: any) => toast.error(err.message),
    });
  };

  const renderPlayerCard = (p: Profile, showActions = true) => {
    const status = getRequestStatus(p.id);
    return (
      <Card key={p.id}>
        <CardContent className="flex items-center gap-3 p-4">
          <Avatar
            className="h-10 w-10 cursor-pointer"
            onClick={() => p.username && navigate(`/player/${p.username}`)}
          >
            {p.avatar_url && <AvatarImage src={p.avatar_url} />}
            <AvatarFallback className="text-xs">
              {(p.username || p.display_name || "?").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{p.username || p.display_name}</p>
            {p.username && p.display_name && (
              <p className="text-xs text-muted-foreground truncate">{p.display_name}</p>
            )}
          </div>
          {showActions && (
            status === "accepted" ? (
              <Button size="sm" variant="secondary" disabled>
                <Check className="h-4 w-4 mr-1" /> {t("social.connected")}
              </Button>
            ) : status === "pending" ? (
              <Button size="sm" variant="outline" disabled>
                <Clock className="h-4 w-4 mr-1" /> {t("social.pending")}
              </Button>
            ) : (
              <Button size="sm" onClick={() => handleRequest(p.id)}>
                <UserPlus className="h-4 w-4 mr-1" /> {t("social.requestAccess")}
              </Button>
            )
          )}
          {!showActions && (
            <Button size="sm" variant="secondary" disabled>
              <Check className="h-4 w-4 mr-1" /> {t("social.connected")}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl chess-title flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          {t("social.playersTitle")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("social.playersSubtitle")}</p>
      </div>

      <Tabs defaultValue="connections">
        <TabsList className="w-full">
          <TabsTrigger value="connections" className="flex-1">{t("social.myConnections")}</TabsTrigger>
          <TabsTrigger value="search" className="flex-1">{t("social.search")}</TabsTrigger>
        </TabsList>

        <TabsContent value="connections">
          {loadingConnections ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("common.loading")}</p>
          ) : connections.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("social.noConnections")}</p>
          ) : (
            <div className="space-y-2">{connections.map((p) => renderPlayerCard(p, false))}</div>
          )}
        </TabsContent>

        <TabsContent value="search">
          <Input
            placeholder={t("social.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4"
          />
          {search.length < 2 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("social.typeToSearch")}</p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("common.loading")}</p>
          ) : results.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("social.noPlayersFound")}</p>
          ) : (
            <div className="space-y-2">{results.map((p) => renderPlayerCard(p))}</div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
