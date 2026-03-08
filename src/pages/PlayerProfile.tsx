import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "lucide-react";

export default function PlayerProfile() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const { t } = useLanguage();

  const { data: summary, isLoading, error } = useQuery({
    queryKey: ["player-summary", username],
    queryFn: async () => {
      if (!user || !username) return null;
      const { data, error } = await supabase.rpc("get_player_summary", {
        _requester_id: user.id,
        _target_username: username,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!user && !!username,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground">{t("common.loading")}</div>;
  }

  if (summary?.error) {
    return (
      <div className="max-w-lg mx-auto text-center py-12">
        <User className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <p className="text-muted-foreground">
          {summary.error === "Not authorized" ? t("social.notAuthorized") : t("social.userNotFound")}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {summary?.avatar_url && <AvatarImage src={summary.avatar_url} />}
          <AvatarFallback className="text-lg">
            {(summary?.username || "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{summary?.username}</h1>
          {summary?.display_name && (
            <p className="text-muted-foreground text-sm">{summary.display_name}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">{t("social.totalTrades")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">{summary?.total_trades || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">{t("social.totalInvested")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">${Number(summary?.total_invested || 0).toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs text-muted-foreground font-normal">{t("social.holdingsCount")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold font-mono">{summary?.holdings_count || 0}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
