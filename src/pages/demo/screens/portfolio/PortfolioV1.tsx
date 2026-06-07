import { cn } from "@/lib/utils";
import { useDemo } from "../../DemoContext";
import { MetricTile } from "../../components/MetricTile";
import { SectionCard } from "../../components/SectionCard";
import { DonutAllocation } from "../../components/DonutAllocation";
import { computeAllocationByType } from "../../data/allocation";
import { enrichHoldings } from "../../data/portfolioMetrics";

/** V1 — Classic: hero value, KPI tiles, allocation donut, holdings list with weight bars. */
export function PortfolioV1() {
  const { data, fmt, openAsset } = useDemo();
  const { items } = enrichHoldings(data.holdings, data.prices, data.previousCloses);
  const allocation = computeAllocationByType(data.holdings, data.prices, data.cash);
  const up = data.totalPnl >= 0;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-card to-accent/20 p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Total value</p>
        <p className="mt-1 font-mono text-3xl font-bold">{fmt.fmt(fmt.cx(data.totalPortfolioValue))}</p>
        <p className={cn("mt-1 font-mono text-sm font-semibold", up ? "text-gain" : "text-loss")}>
          {up ? "+" : ""}
          {fmt.fmt(fmt.cx(data.totalPnl))} ({up ? "+" : ""}
          {data.totalPnlPct.toFixed(1)}%)
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MetricTile
          label="Today"
          value={`${data.dailyChange >= 0 ? "+" : ""}${fmt.fmtCompact(fmt.cx(data.dailyChange))}`}
          tone={data.dailyChange >= 0 ? "gain" : "loss"}
        />
        <MetricTile
          label="Realized"
          value={fmt.fmtCompact(fmt.cx(data.performance.total_realized_pnl))}
          tone={data.performance.total_realized_pnl >= 0 ? "gain" : "loss"}
        />
        <MetricTile
          label="Unrealized"
          value={fmt.fmtCompact(fmt.cx(data.unrealizedPnl))}
          tone={data.unrealizedPnl >= 0 ? "gain" : "loss"}
        />
      </div>

      <SectionCard title="Allocation">
        <DonutAllocation data={allocation} />
      </SectionCard>

      <SectionCard title="Holdings" action={<span className="text-xs text-muted-foreground">{items.length} positions</span>} bodyClassName="space-y-2">
        {items.map((h) => (
          <button
            key={h.symbol}
            onClick={() => openAsset(h.symbol)}
            className="flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-accent/30"
          >
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-semibold text-primary">{h.symbol}</p>
              <p className="truncate text-xs text-muted-foreground">{h.name}</p>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                <div className="h-1.5 rounded-full bg-primary/60" style={{ width: `${Math.min(100, h.weight)}%` }} />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-sm font-semibold">{fmt.fmtCompact(fmt.cx(h.mktVal))}</p>
              {h.uPnlPct !== null && (
                <p className={cn("font-mono text-xs font-semibold", (h.uPnl ?? 0) >= 0 ? "text-gain" : "text-loss")}>
                  {(h.uPnl ?? 0) >= 0 ? "+" : ""}
                  {h.uPnlPct.toFixed(1)}%
                </p>
              )}
              <p className="text-[11px] text-muted-foreground">{h.weight.toFixed(1)}%</p>
            </div>
          </button>
        ))}
      </SectionCard>
    </div>
  );
}
