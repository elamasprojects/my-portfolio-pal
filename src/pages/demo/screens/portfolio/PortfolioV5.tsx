import { cn } from "@/lib/utils";
import { useDemo } from "../../DemoContext";
import { SectionCard } from "../../components/SectionCard";
import { StatPill } from "../../components/StatPill";
import { enrichHoldings, type EnrichedHolding } from "../../data/portfolioMetrics";

/** V5 — Highlights: editorial "today" hero + standout cards, then a rich holdings feed with day bars. */
export function PortfolioV5() {
  const { data, fmt, openAsset } = useDemo();
  const { items } = enrichHoldings(data.holdings, data.prices, data.previousCloses);
  const withDay = items.filter((h) => h.dayPct !== null);
  const withPnl = items.filter((h) => h.uPnlPct !== null);
  const topMover = withDay.length ? withDay.reduce((a, b) => (b.dayPct! > a.dayPct! ? b : a)) : null;
  const worst = withDay.length ? withDay.reduce((a, b) => (b.dayPct! < a.dayPct! ? b : a)) : null;
  const best = withPnl.length ? withPnl.reduce((a, b) => (b.uPnlPct! > a.uPnlPct! ? b : a)) : null;
  const biggest = items[0] ?? null;
  const dayUp = data.dailyChange >= 0;

  const Highlight = ({ label, h, metric }: { label: string; h: EnrichedHolding | null; metric: "day" | "total" | "weight" }) => {
    if (!h) return null;
    const val = metric === "day" ? h.dayPct : metric === "total" ? h.uPnlPct : h.weight;
    const pos = (val ?? 0) >= 0;
    const colored = metric !== "weight";
    return (
      <button
        onClick={() => openAsset(h.symbol)}
        className="rounded-xl border bg-card p-3.5 text-left transition-colors hover:bg-accent/30"
      >
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-1 truncate font-mono text-base font-bold text-primary">{h.symbol}</p>
        <p className={cn("font-mono text-sm font-semibold", !colored ? "text-foreground" : pos ? "text-gain" : "text-loss")}>
          {metric === "weight" ? `${(val ?? 0).toFixed(1)}% weight` : `${pos ? "+" : ""}${(val ?? 0).toFixed(1)}%`}
        </p>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      <div className={cn("rounded-2xl border-l-4 bg-card p-5", dayUp ? "border-l-gain" : "border-l-loss")}>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Today</p>
        <p className={cn("font-mono text-3xl font-bold", dayUp ? "text-gain" : "text-loss")}>
          {dayUp ? "+" : ""}
          {fmt.fmt(fmt.cx(data.dailyChange))}
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {fmt.fmt(fmt.cx(data.totalPortfolioValue))} total · {data.totalPnlPct >= 0 ? "+" : ""}
          {data.totalPnlPct.toFixed(1)}% all-time
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Highlight label="Top mover today" h={topMover} metric="day" />
        <Highlight label="Worst today" h={worst} metric="day" />
        <Highlight label="Best performer" h={best} metric="total" />
        <Highlight label="Biggest position" h={biggest} metric="weight" />
      </div>

      <SectionCard title="All holdings" bodyClassName="space-y-2">
        {items.map((h) => {
          const dUp = (h.dayPct ?? 0) >= 0;
          return (
            <button
              key={h.symbol}
              onClick={() => openAsset(h.symbol)}
              className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent/30"
            >
              <div className="flex w-6 shrink-0 justify-center">
                <div
                  className={cn("h-9 w-1.5 rounded-full", dUp ? "bg-gain" : "bg-loss")}
                  style={{ opacity: Math.min(1, 0.35 + Math.abs(h.dayPct ?? 0) / 10) }}
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-semibold">{h.symbol}</p>
                <p className="truncate text-xs text-muted-foreground">{h.name}</p>
              </div>
              <div className="shrink-0 space-y-0.5 text-right">
                <p className="font-mono text-sm font-semibold">{fmt.fmtCompact(fmt.cx(h.mktVal))}</p>
                <StatPill positive={(h.uPnlPct ?? 0) >= 0}>
                  {(h.uPnlPct ?? 0) >= 0 ? "+" : ""}
                  {(h.uPnlPct ?? 0).toFixed(1)}%
                </StatPill>
              </div>
            </button>
          );
        })}
      </SectionCard>
    </div>
  );
}
