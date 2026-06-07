import { useMemo, useState } from "react";
import { Activity, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { useTrades, computeHoldings } from "@/hooks/usePortfolio";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { useProfile } from "@/hooks/useProfile";
import { makeFormatters } from "@/lib/format";
import { makeAlerts } from "@/lib/alerts";
import { useLanguage } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const Alerts = () => {
  const { t } = useLanguage();
  const { data: trades = [], isLoading } = useTrades();
  const { profile } = useProfile();
  const { venta: mepRate } = useDolarMEP();

  const holdings = useMemo(() => computeHoldings(trades), [trades]);
  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const { prices } = useMarketPrices(symbols);
  const fmt = makeFormatters((profile?.default_currency as "USD" | "ARS") || "USD", mepRate);
  const base = useMemo(() => makeAlerts(holdings), [holdings]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl chess-title">{t("alerts.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("alerts.subtitle")}</p>
        </div>
        <Button size="sm" className="shrink-0" onClick={() => toast.success(t("alerts.comingSoon"))}>
          <Plus className="mr-1 h-4 w-4" />
          {t("alerts.new")}
        </Button>
      </div>

      {isLoading ? (
        <p className="animate-pulse py-12 text-center text-sm text-muted-foreground">{t("common.loading")}</p>
      ) : holdings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">{t("alerts.empty")}</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {base.map((a) => {
              const active = overrides[a.id] ?? a.active;
              const price = prices.get(a.symbol.toUpperCase());
              const Icon = a.condition === "above" ? TrendingUp : a.condition === "below" ? TrendingDown : Activity;
              let cond = "";
              let away: number | null = null;
              if (a.condition === "above") {
                cond = `${t("alerts.above")} ${fmt.fmt(fmt.cx(a.target))}`;
                away = price ? ((a.target - price) / price) * 100 : null;
              } else if (a.condition === "below") {
                cond = `${t("alerts.below")} ${fmt.fmt(fmt.cx(a.target))}`;
                away = price ? ((price - a.target) / price) * 100 : null;
              } else {
                cond = `${t("alerts.moves")} ±${a.target}%`;
              }
              return (
                <div key={a.id} className="flex items-center gap-3 p-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold">{a.symbol}</p>
                    <p className="text-xs text-muted-foreground">{cond}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    {price ? (
                      <p className="font-mono text-xs text-muted-foreground">{fmt.fmt(fmt.cx(price))}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">—</p>
                    )}
                    {away !== null && (
                      <p className={cn("font-mono text-xs font-semibold", away <= 0 ? "text-gain" : "text-muted-foreground")}>
                        {away <= 0 ? t("alerts.triggered") : `${Math.abs(away).toFixed(1)}% ${t("alerts.away")}`}
                      </p>
                    )}
                  </div>
                  <Switch checked={active} onCheckedChange={() => setOverrides((o) => ({ ...o, [a.id]: !active }))} />
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
      <p className="text-center text-xs text-muted-foreground">{t("alerts.prototypeNote")}</p>
    </div>
  );
};

export default Alerts;
