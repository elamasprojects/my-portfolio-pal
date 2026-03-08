import { useCallback } from "react";
import { Bell, Check, X, UserCheck, Trash2 } from "lucide-react";
import { useFollows } from "@/hooks/useFollows";
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
  const { notifications, unreadCount, markAllAsRead } = useNotifications();
  const { respondToRequest } = useFollows();
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

  // Collect reference_ids for pending follow requests to check current status
  const followRequestIds = notifications
    .filter((n) => n.type === "follow_request_received" && n.reference_id)
    .map((n) => n.reference_id!) as string[];

  const { data: followRequests = [] } = useQuery({
    queryKey: ["follow-requests-for-inbox", followRequestIds],
    queryFn: async () => {
      if (followRequestIds.length === 0) return [];
      const { data, error } = await supabase
        .from("follow_requests")
        .select("id, status")
        .in("id", followRequestIds);
      if (error) throw error;
      return data as { id: string; status: string }[];
    },
    enabled: followRequestIds.length > 0,
  });

  const getProfile = (id: string | null) => actorProfiles.find((p) => p.id === id);
  const getFollowStatus = (refId: string | null) =>
    followRequests.find((r) => r.id === refId)?.status;

  const handleRespond = (requestId: string, status: "accepted" | "declined") => {
    respondToRequest.mutate(
      { requestId, status },
      {
        onSuccess: () => {
          toast.success(status === "accepted" ? t("social.requestAccepted") : t("social.requestDeclined"));
        },
      }
    );
  };

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
        <h4 className="font-semibold text-sm mb-3">{t("social.inbox")}</h4>
        {notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("social.noRequests")}</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {notifications.map((notif) => {
              const profile = getProfile(notif.actor_id);
              const isRead = notif.read;

              if (notif.type === "follow_request_received") {
                const status = getFollowStatus(notif.reference_id);
                const isPending = status === "pending";
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
                      <p className="text-xs text-muted-foreground">{t("social.wantsToView")}</p>
                    </div>
                    {isPending && notif.reference_id && (
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-emerald-500 hover:text-emerald-600"
                          onClick={() => handleRespond(notif.reference_id!, "accepted")}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => handleRespond(notif.reference_id!, "declined")}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              }

              if (notif.type === "follow_request_accepted") {
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
                      <p className="text-xs text-emerald-500 flex items-center gap-1">
                        <UserCheck className="h-3 w-3" />
                        {t("social.acceptedYourRequest")}
                      </p>
                    </div>
                  </div>
                );
              }

              return null;
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
