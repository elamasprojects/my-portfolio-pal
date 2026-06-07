import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarClock,
  ChevronDown,
  Eye,
  Plus,
  Scale,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDemo } from "../DemoContext";
import { MetricTile } from "../components/MetricTile";
import { HoldingRowCard } from "../components/HoldingRowCard";
import { DonutAllocation } from "../components/DonutAllocation";
import { SectionCard } from "../components/SectionCard";
import { EmptyState } from "../components/EmptyState";
import { StatPill } from "../components/StatPill";
import { computeAllocationByType, sortHoldingsByValue } from "../data/allocation";
import type { DemoScreenId } from "../data/types";

const FEATURE_SHORTCUTS: { id: DemoScreenId; label: string; Icon: typeof Bell }[] = [
  { id: "alerts", label: "Alerts", Icon: Bell },
  { id: "benchmark", label: "Benchmark", Icon: Scale },
  { id: "watchlist", label: "Watchlist", Icon: Eye },
  { id: "dividends", label: "Dividends", Icon: CalendarClock },
];

export function DashboardScreen() {
  const { data, fmt, isPhone, openAsset, setScreen } = useDemo();
  const [dailyOpen, setDailyOpen] = useState(false);

  const allocationByType = useMemo(
    () => computeAllocationByType(data.holdings, data.prices, data.cash),
    [data.holdings, data.prices, data.cash],
  );

  const chartData = useMemo(
    () => data.cumulativePnL.map((p) => ({ date: p.date, value: fmt.cx(p.net_pnl ?? p.cumulative_pnl) })),
    [data.cumulativePnL, fmt],
  );

  if (data.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data.hasData) {
    return (
      <EmptyState
        icon={Plus}
        title="No trades yet"
        description="Add your first trade to see your portfolio come to life."
        actionLabel="Add a trade"
        onAction={() => setScreen("addTrade")}
      />
    );
  }

  const up = data.totalPnl >= 0;
  const dayUp = data.dailyChange >= 0;

  return (
    <div className={cn("space-y-4", !isPhone && "pb-16")}>
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-card to-accent/20 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Portfolio value</p>
            {data.pricesLoading ? (
              <Skeleton className="mt-1 h-9 w-40" />
            ) : (
              <p className="mt-1 font-mono text-3xl font-bold md:text-4xl">{fmt.fmt(fmt.cx(data.totalPortfolioValue))}</p>
            )}
            <div className="mt-1 flex items-center gap-1.5">
              {up ? <ArrowUpRight className="h-4 w-4 text-gain" /> : <ArrowDownRight className="h-4 w-4 text-loss" />}
              <span className={cn("font-mono text-sm font-semibold", up ? "text-gain" : "text-loss")}>
                {up ? "+" : ""}
                {fmt.fmt(fmt.cx(data.totalPnl))} ({up ? "+" : ""}
                {data.totalPnlPct.toFixed(1)}%)
              </span>
            </div>
          </div>
          {!isPhone && (
            <div className="flex shrink-0 items-center gap-6 text-sm text-muted-foreground">
              <div>
                <p className="text-xs uppercase tracking-wider">Cost basis</p>
                <p className="font-mono font-semibold text-foreground">{fmt.fmt(fmt.cx(data.performance.total_cost_basis))}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider">Dividends</p>
                <p className="font-mono font-semibold text-gain">{fmt.fmt(fmt.cx(data.performance.total_dividends))}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider">Trades</p>
                <p className="font-mono font-semibold text-foreground">{data.totalTrades}</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today's performance */}
      {!data.pricesLoading && data.dailyBreakdown.length > 0 && (
        <div className={cn("overflow-hidden rounded-xl border-l-4 bg-card", dayUp ? "border-l-gain" : "border-l-loss")}>
          <button
            type="button"
            onClick={() => setDailyOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 p-4 text-left"
          >
            <div className="flex items-center gap-3">
              <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", dayUp ? "bg-gain/10" : "bg-loss/10")}>
                {dayUp ? <TrendingUp className="h-5 w-5 text-gain" /> : <TrendingDown className="h-5 w-5 text-loss" />}
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Today</p>
                <p className={cn("font-mono text-lg font-bold", dayUp ? "text-gain" : "text-loss")}>
                  {dayUp ? "+" : ""}
                  {fmt.fmt(fmt.cx(data.dailyChange))}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatPill positive={dayUp}>
                {dayUp ? "+" : ""}
                {data.dailyChangePct.toFixed(2)}%
              </StatPill>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", dailyOpen && "rotate-180")} />
            </div>
          </button>
          {dailyOpen && (
            <div className="grid grid-cols-1 gap-2 border-t border-border/50 bg-accent/5 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.dailyBreakdown.map((b) => {
                const bUp = b.amountChange >= 0;
                return (
                  <div key={b.symbol} className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <span className="font-mono text-sm font-bold">{b.symbol}</span>
                    <div className="text-right">
                      <p className={cn("font-mono text-sm font-semibold", bUp ? "text-gain" : "text-loss")}>
                        {bUp ? "+" : ""}
                        {fmt.fmt(fmt.cx(b.amountChange))}
                      </p>
                      <p className={cn("font-mono text-xs", bUp ? "text-gain" : "text-loss")}>
                        {bUp ? "+" : ""}
                        {b.pctChange.toFixed(2)}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* KPI tiles — horizontal scroll on phone, grid on desktop */}
      {isPhone ? (
        <div className="demo-scroll -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1">
          <MetricTile
            className="w-40 shrink-0 snap-start"
            label="Realized P&L"
            value={`${data.performance.total_realized_pnl >= 0 ? "+" : ""}${fmt.fmtCompact(fmt.cx(data.performance.total_realized_pnl))}`}
            tone={data.performance.total_realized_pnl >= 0 ? "gain" : "loss"}
            icon={data.performance.total_realized_pnl >= 0 ? TrendingUp : TrendingDown}
          />
          <MetricTile
            className="w-40 shrink-0 snap-start"
            label="Unrealized P&L"
            value={`${data.unrealizedPnl >= 0 ? "+" : ""}${fmt.fmtCompact(fmt.cx(data.unrealizedPnl))}`}
            tone={data.unrealizedPnl >= 0 ? "gain" : "loss"}
            icon={data.unrealizedPnl >= 0 ? TrendingUp : TrendingDown}
          />
          <MetricTile
            className="w-40 shrink-0 snap-start"
            label="Win rate"
            value={data.performance.total_sells > 0 ? `${data.performance.win_rate.toFixed(0)}%` : "—"}
            sub={`${data.performance.winning_sells}/${data.performance.total_sells} realized`}
            icon={Target}
          />
          <MetricTile
            className="w-40 shrink-0 snap-start"
            label="Cash"
            value={fmt.fmtCompact(fmt.cx(data.cash))}
            icon={Wallet}
          />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricTile
            label="Realized P&L"
            value={`${data.performance.total_realized_pnl >= 0 ? "+" : ""}${fmt.fmtCompact(fmt.cx(data.performance.total_realized_pnl))}`}
            tone={data.performance.total_realized_pnl >= 0 ? "gain" : "loss"}
            icon={data.performance.total_realized_pnl >= 0 ? TrendingUp : TrendingDown}
          />
          <MetricTile
            label="Unrealized P&L"
            value={`${data.unrealizedPnl >= 0 ? "+" : ""}${fmt.fmtCompact(fmt.cx(data.unrealizedPnl))}`}
            tone={data.unrealizedPnl >= 0 ? "gain" : "loss"}
            icon={data.unrealizedPnl >= 0 ? TrendingUp : TrendingDown}
          />
          <MetricTile
            label="Win rate"
            value={data.performance.total_sells > 0 ? `${data.performance.win_rate.toFixed(0)}%` : "—"}
            sub={`${data.performance.winning_sells}/${data.performance.total_sells} realized`}
            icon={Target}
          />
          <MetricTile label="Cash" value={fmt.fmtCompact(fmt.cx(data.cash))} icon={Wallet} />
        </div>
      )}

      {/* Holdings + allocation */}
      <div className={cn(!isPhone && "grid grid-cols-3 gap-4")}>
        <SectionCard
          title="Holdings"
          className={cn(!isPhone && "col-span-2")}
          action={
            <span className="text-xs text-muted-foreground">{data.holdings.length} positions</span>
          }
          bodyClassName="space-y-2"
        >
          {data.holdings.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No open positions.</p>
          ) : (
            sortHoldingsByValue(data.holdings, data.prices).map((h) => (
              <HoldingRowCard key={h.symbol} holding={h} onClick={() => openAsset(h.symbol)} />
            ))
          )}
        </SectionCard>

        <SectionCard title="Allocation" className={cn(isPhone && "mt-4")}>
          <DonutAllocation data={allocationByType} />
        </SectionCard>
      </div>

      {/* P&L over time */}
      {chartData.length > 1 && (
        <SectionCard title="P&L over time">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="demoPnl" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={["auto", "auto"]} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number) => fmt.fmt(v)}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#demoPnl)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>
      )}

      {/* Feature shortcuts */}
      <div className="grid grid-cols-4 gap-2">
        {FEATURE_SHORTCUTS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setScreen(id)}
            className="flex min-h-11 flex-col items-center justify-center gap-1.5 rounded-xl border bg-card p-3 text-muted-foreground transition-colors hover:bg-accent/30 hover:text-foreground"
          >
            <Icon className="h-5 w-5" />
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
