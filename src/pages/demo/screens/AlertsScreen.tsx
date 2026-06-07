import { useMemo, useState } from "react";
import { Activity, Bell, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useDemo } from "../DemoContext";
import { makeAlerts } from "../data/mockData";
import { SectionCard } from "../components/SectionCard";
import { EmptyState } from "../components/EmptyState";

export function AlertsScreen() {
  const { data, fmt, setScreen } = useDemo();
  const base = useMemo(() => makeAlerts(data.holdings), [data.holdings]);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  if (data.holdings.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No alerts yet"
        description="Own a position to set price or movement alerts."
        actionLabel="Add a trade"
        onAction={() => setScreen("addTrade")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Get notified on price targets and big moves.</p>
        <Button size="sm" className="h-10 shrink-0" onClick={() => toast.success("Prototype — alert builder coming soon.")}>
          <Plus className="mr-1 h-4 w-4" /> New
        </Button>
      </div>

      <SectionCard title="Active alerts" bodyClassName="space-y-2">
        {base.map((a) => {
          const active = overrides[a.id] ?? a.active;
          const price = data.prices.get(a.symbol.toUpperCase());
          const Icon = a.condition === "above" ? TrendingUp : a.condition === "below" ? TrendingDown : Activity;
          let condText = "";
          let away: number | null = null;
          if (a.condition === "above") {
            condText = `Above ${fmt.fmt(fmt.cx(a.target))}`;
            away = price ? ((a.target - price) / price) * 100 : null;
          } else if (a.condition === "below") {
            condText = `Below ${fmt.fmt(fmt.cx(a.target))}`;
            away = price ? ((price - a.target) / price) * 100 : null;
          } else {
            condText = `Moves ±${a.target}% in a day`;
          }
          return (
            <div key={a.id} className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-semibold">{a.symbol}</p>
                <p className="text-xs text-muted-foreground">{condText}</p>
              </div>
              <div className="shrink-0 text-right">
                {price ? (
                  <p className="font-mono text-xs text-muted-foreground">{fmt.fmt(fmt.cx(price))}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">—</p>
                )}
                {away !== null && (
                  <p className={cn("font-mono text-xs font-semibold", away <= 0 ? "text-gain" : "text-muted-foreground")}>
                    {away <= 0 ? "triggered" : `${Math.abs(away).toFixed(1)}% away`}
                  </p>
                )}
              </div>
              <Switch
                checked={active}
                onCheckedChange={() => setOverrides((o) => ({ ...o, [a.id]: !active }))}
                className="ml-1 shrink-0"
              />
            </div>
          );
        })}
      </SectionCard>
      <p className="text-center text-xs text-muted-foreground">
        Prototype — alerts are illustrative; current prices are live.
      </p>
    </div>
  );
}
