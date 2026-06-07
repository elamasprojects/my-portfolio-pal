import { useMemo } from "react";
import { Briefcase, Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDemo } from "../DemoContext";
import { computeAllocationByType, sortHoldingsByValue } from "../data/allocation";
import { MetricTile } from "../components/MetricTile";
import { HoldingRowCard } from "../components/HoldingRowCard";
import { DonutAllocation } from "../components/DonutAllocation";
import { SectionCard } from "../components/SectionCard";
import { EmptyState } from "../components/EmptyState";

export function PortfolioScreen() {
  const { data, fmt, isPhone, openAsset, setScreen } = useDemo();

  const allocationByType = useMemo(
    () => computeAllocationByType(data.holdings, data.prices, data.cash),
    [data.holdings, data.prices, data.cash],
  );

  const sortedHoldings = useMemo(
    () => sortHoldingsByValue(data.holdings, data.prices),
    [data.holdings, data.prices],
  );

  if (data.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data.hasData) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Your portfolio is empty"
        description="Add a trade to start building your portfolio."
        actionLabel="Add a trade"
        onAction={() => setScreen("addTrade")}
      />
    );
  }

  const up = data.totalPnl >= 0;

  return (
    <div className={cn("space-y-4", !isPhone && "pb-10")}>
      <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-card to-accent/20 p-5">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Total value</p>
        <p className="mt-1 font-mono text-3xl font-bold">{fmt.fmt(fmt.cx(data.totalPortfolioValue))}</p>
        <p className={cn("mt-1 font-mono text-sm font-semibold", up ? "text-gain" : "text-loss")}>
          {up ? "+" : ""}
          {fmt.fmt(fmt.cx(data.totalPnl))} ({up ? "+" : ""}
          {data.totalPnlPct.toFixed(1)}%)
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <MetricTile label="Cost basis" value={fmt.fmtCompact(fmt.cx(data.performance.total_cost_basis))} />
        <MetricTile label="Dividends" value={fmt.fmtCompact(fmt.cx(data.performance.total_dividends))} tone="gain" />
      </div>

      <div className={cn(!isPhone && "grid grid-cols-3 gap-4")}>
        <SectionCard title="Allocation">
          <DonutAllocation data={allocationByType} />
        </SectionCard>
        <SectionCard
          title="Holdings"
          className={cn(!isPhone && "col-span-2")}
          action={<span className="text-xs text-muted-foreground">{data.holdings.length} positions</span>}
          bodyClassName={cn("space-y-2", !isPhone && "grid grid-cols-2 gap-2 space-y-0")}
        >
          {sortedHoldings.map((h) => (
            <HoldingRowCard key={h.symbol} holding={h} onClick={() => openAsset(h.symbol)} />
          ))}
        </SectionCard>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="h-11 flex-1" onClick={() => toast.success("Prototype — PDF export coming soon.")}>
          <Download className="mr-1.5 h-4 w-4" /> Export PDF
        </Button>
        <Button className="h-11 flex-1" onClick={() => toast.success("Prototype — share coming soon.")}>
          <Share2 className="mr-1.5 h-4 w-4" /> Share
        </Button>
      </div>
    </div>
  );
}
