import { Bell, Check, X } from "lucide-react";
import { useFollows } from "@/hooks/useFollows";
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
  const { incomingRequests, respondToRequest } = useFollows();
  const { t } = useLanguage();

  // Fetch profiles for requesters
  const requesterIds = incomingRequests.map((r) => r.requester_id);
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-for-inbox", requesterIds],
    queryFn: async () => {
      if (requesterIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, username")
        .in("id", requesterIds);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: requesterIds.length > 0,
  });

  const getProfile = (id: string) => profiles.find((p) => p.id === id);

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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4 text-muted-foreground" />
          {incomingRequests.length > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center">
              {incomingRequests.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80">
        <h4 className="font-semibold text-sm mb-3">{t("social.inbox")}</h4>
        {incomingRequests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">{t("social.noRequests")}</p>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {incomingRequests.map((req) => {
              const profile = getProfile(req.requester_id);
              return (
                <div key={req.id} className="flex items-center gap-3">
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
                  <div className="flex gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-emerald-500 hover:text-emerald-600"
                      onClick={() => handleRespond(req.id, "accepted")}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleRespond(req.id, "declined")}
                    >
                      <X className="h-4 w-4" />
                    </Button>
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
