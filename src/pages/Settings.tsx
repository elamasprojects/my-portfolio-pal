import { useState } from "react";
import { Settings as SettingsIcon, Upload, Star, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useProfile } from "@/hooks/useProfile";
import { useBrokers, useUserBrokers, useAddUserBroker, useUpdateUserBroker, useRemoveUserBroker } from "@/hooks/useBrokers";
import { useLanguage } from "@/i18n";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import { toast } from "sonner";

export default function Settings() {
  const { profile, isLoading, updateProfile, uploadAvatar } = useProfile();
  const { t } = useLanguage();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState<"USD" | "ARS">("USD");
  const [initialized, setInitialized] = useState(false);

  // Brokers
  const { data: allBrokers } = useBrokers();
  const { data: userBrokers } = useUserBrokers();
  const addUserBroker = useAddUserBroker();
  const updateUserBroker = useUpdateUserBroker();
  const removeUserBroker = useRemoveUserBroker();
  const [addBrokerId, setAddBrokerId] = useState("");
  const [commissionOverrides, setCommissionOverrides] = useState<Record<string, number>>({});

  if (profile && !initialized) {
    setUsername(profile.username || "");
    setDisplayName(profile.display_name || "");
    setDefaultCurrency((profile.default_currency as "USD" | "ARS") || "USD");
    setInitialized(true);
  }

  const handleSave = () => {
    updateProfile.mutate(
      { username: username || null, display_name: displayName || null, default_currency: defaultCurrency },
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

  const handleToggleBrokers = (enabled: boolean) => {
    updateProfile.mutate({ brokers_enabled: enabled });
  };

  const handleAddBroker = () => {
    if (!addBrokerId) return;
    addUserBroker.mutate(
      { brokerId: addBrokerId, isDefault: !userBrokers || userBrokers.length === 0 },
      {
        onSuccess: () => {
          toast.success(t("settings.brokerAdded"));
          setAddBrokerId("");
        },
        onError: (err: any) => toast.error(err.message),
      }
    );
  };

  const handleSetDefault = (id: string) => {
    updateUserBroker.mutate({ id, isDefault: true }, {
      onSuccess: () => toast.success(t("settings.brokerUpdated")),
    });
  };

  const handleCommissionChange = (id: string, value: number) => {
    updateUserBroker.mutate({ id, commissionPct: value });
  };

  const handleRemoveBroker = (id: string) => {
    removeUserBroker.mutate(id, {
      onSuccess: () => toast.success(t("settings.brokerRemoved")),
    });
  };

  // Filter out already-added brokers from the picker
  const availableBrokers = allBrokers?.filter(
    (b) => !userBrokers?.some((ub) => ub.broker_id === b.id)
  );

  const arBrokers = availableBrokers?.filter((b) => b.country === "AR") || [];
  const usBrokers = availableBrokers?.filter((b) => b.country === "US") || [];

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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("settings.defaultCurrency")}</CardTitle>
          <CardDescription className="text-xs">{t("settings.currencyHelper")}</CardDescription>
        </CardHeader>
        <CardContent>
          <CurrencyToggle value={defaultCurrency} onChange={setDefaultCurrency} />
        </CardContent>
      </Card>

      {/* Brokers */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{t("settings.brokers")}</CardTitle>
              <CardDescription className="text-xs mt-1">{t("settings.brokersEnabledDesc")}</CardDescription>
            </div>
            <Switch
              checked={profile?.brokers_enabled || false}
              onCheckedChange={handleToggleBrokers}
            />
          </div>
        </CardHeader>
        {profile?.brokers_enabled && (
          <CardContent className="space-y-4">
            {/* User's brokers list */}
            {userBrokers && userBrokers.length > 0 ? (
              <div className="space-y-3">
                {userBrokers.map((ub) => (
                  <div key={ub.id} className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{ub.broker?.name}</span>
                        {ub.is_default && (
                          <Star className="h-3.5 w-3.5 text-primary fill-primary" />
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {!ub.is_default && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleSetDefault(ub.id)}
                          >
                            <Star className="h-3 w-3 mr-1" />
                            {t("settings.defaultBroker")}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() => handleRemoveBroker(ub.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-muted-foreground">{t("settings.commission")}</Label>
                        <span className="text-xs font-mono font-bold">{ub.commission_pct.toFixed(1)}%</span>
                      </div>
                      <Slider
                        value={[ub.commission_pct]}
                        min={0}
                        max={1.5}
                        step={0.1}
                        onValueCommit={(val) => handleCommissionChange(ub.id, val[0])}
                        className="w-full"
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>0%</span>
                        <span>1.5%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("settings.noBrokers")}</p>
            )}

            <Separator />

            {/* Add broker picker */}
            <div className="flex gap-2">
              <Select value={addBrokerId} onValueChange={setAddBrokerId}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder={t("settings.addBroker")} />
                </SelectTrigger>
                <SelectContent>
                  {arBrokers.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{t("brokers.argentina")}</div>
                      {arBrokers.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </>
                  )}
                  {usBrokers.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{t("brokers.us")}</div>
                      {usBrokers.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
              <Button
                size="sm"
                onClick={handleAddBroker}
                disabled={!addBrokerId || addUserBroker.isPending}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <Button onClick={handleSave} disabled={updateProfile.isPending} className="w-full">
        {updateProfile.isPending ? t("common.loading") : t("common.save")}
      </Button>
    </div>
  );
}
