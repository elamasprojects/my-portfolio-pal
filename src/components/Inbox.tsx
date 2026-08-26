import { useCallback } from "react";
import { Bell, Trash2 } from "lucide-react";
import { useNotifications } from "@/hooks/useNotifications";
import { useLanguage } from "@/i18n";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

export function Inbox() {
  const { notifications, unreadCount, markAllAsRead, clearAll } = useNotifications();
  const { t } = useLanguage();

  // Collect actor IDs to fetch profiles
  const actorIds = [...new Set(notifications.map((n) => n.actor_id).filter(Boolean))] as string[];
  const { data: actorProfiles = [] } = useQuery({
    queryKey: ["profiles-for-notifications", actorIds],
    queryFn: async () => {
      if (actorIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, username")
        .in("id", actorIds);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: actorIds.length > 0,
  });

  const getProfile = (id: string | null) => actorProfiles.find((p) => p.id === id);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (open && unreadCount > 0) {
        markAllAsRead.mutate();
      }
    },
    [unreadCount, markAllAsRead]
  );

  return (
    <Popover onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-semibold text-sm">{t("social.inbox")}</h4>
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
              onClick={() => clearAll.mutate(undefined, { onSuccess: () => toast.success(t("social.clearAll")) })}
              disabled={clearAll.isPending}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              {t("social.clearAll")}
            </Button>
          )}
        </div>
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("social.noRequests")}</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {notifications.map((notif) => {
              const profile = getProfile(notif.actor_id);
              const isRead = notif.read;

              return (
                <div key={notif.id} className={`flex items-center gap-3 ${isRead ? "opacity-60" : ""}`}>
                  <Avatar className="h-8 w-8">
                    {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                    <AvatarFallback className="text-xs">
                      {(profile?.username || profile?.display_name || "?").slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {profile?.username || profile?.display_name || t("social.unknownUser")}
                    </p>
                    <p className="text-xs text-muted-foreground">Notificación</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
