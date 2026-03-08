import { useState } from "react";
import { Settings as SettingsIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProfile } from "@/hooks/useProfile";
import { useLanguage } from "@/i18n";
import { toast } from "sonner";

export default function Settings() {
  const { profile, isLoading, updateProfile, uploadAvatar } = useProfile();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [initialized, setInitialized] = useState(false);

  if (profile && !initialized) {
    setUsername(profile.username || "");
    setDisplayName(profile.display_name || "");
    setInitialized(true);
  }

  const handleSave = () => {
    updateProfile.mutate(
      { username: username || null, display_name: displayName || null },
      {
        onSuccess: () => toast.success(t("settings.saved")),
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadAvatar.mutate(file, {
      onSuccess: () => toast.success(t("settings.avatarUpdated")),
      onError: (err: any) => toast.error(err.message),
    });
  };

  if (isLoading) {
    return <div className="flex items-center justify-center p-12 text-muted-foreground">{t("common.loading")}</div>;
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <h1 className="text-2xl chess-title flex items-center gap-2">
          <SettingsIcon className="h-6 w-6 text-primary" />
          {t("settings.title")}
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{t("settings.subtitle")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.profilePhoto")}</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Avatar className="h-16 w-16">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="text-lg">
              {(profile?.username || profile?.display_name || "U").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <label className="cursor-pointer">
            <Button variant="outline" size="sm" asChild>
              <span>
                <Upload className="h-4 w-4 mr-1" />
                {t("settings.uploadPhoto")}
              </span>
            </Button>
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.accountInfo")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("settings.username")}</Label>
            <Input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={t("settings.usernamePlaceholder")}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.displayName")}</Label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("settings.displayNamePlaceholder")}
            />
          </div>
          <Button onClick={handleSave} disabled={updateProfile.isPending}>
            {updateProfile.isPending ? t("common.loading") : t("common.save")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
