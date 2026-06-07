import { useMemo, useState } from "react";
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BarChart3 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemo } from "../DemoContext";
import { MetricTile } from "../components/MetricTile";
import { SectionCard } from "../components/SectionCard";
import { Chip } from "../components/Chip";
import { EmptyState } from "../components/EmptyState";

export function AnalysisScreen() {
  const { data, fmt, setScreen } = useDemo();
  const [tab, setTab] = useState<"performance" | "byAsset">("performance");

  const chartData = useMemo(
    () => data.cumulativePnL.map((p) => ({ date: p.date, value: fmt.cx(p.net_pnl ?? p.cumulative_pnl) })),
    [data.cumulativePnL, fmt],
  );
  const byAsset = useMemo(
    () => [...data.performance.by_symbol].filter((s) => s.total_return !== 0).sort((a, b) => b.total_return - a.total_return),
    [data.performance],
  );
  const maxAbs = Math.max(1, ...byAsset.map((s) => Math.abs(s.total_return)));

  if (!data.hasData) {
    return (
      <EmptyState
        icon={BarChart3}
        title="Nothing to analyze yet"
        description="Log a few trades and your performance analytics will appear here."
        actionLabel="Add a trade"
        onAction={() => setScreen("addTrade")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Chip active={tab === "performance"} onClick={() => setTab("performance")}>
          Performance
        </Chip>
        <Chip active={tab === "byAsset"} onClick={() => setTab("byAsset")}>
          By asset
        </Chip>
      </div>

      {tab === "performance" ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <MetricTile
              label="Total return"
              value={`${data.totalPnl >= 0 ? "+" : ""}${fmt.fmtCompact(fmt.cx(data.totalPnl))}`}
              sub={`${data.totalPnlPct >= 0 ? "+" : ""}${data.totalPnlPct.toFixed(1)}%`}
              tone={data.totalPnl >= 0 ? "gain" : "loss"}
            />
            <MetricTile
              label="Realized"
              value={`${data.performance.total_realized_pnl >= 0 ? "+" : ""}${fmt.fmtCompact(fmt.cx(data.performance.total_realized_pnl))}`}
              tone={data.performance.total_realized_pnl >= 0 ? "gain" : "loss"}
            />
            <MetricTile label="Dividends" value={fmt.fmtCompact(fmt.cx(data.performance.total_dividends))} tone="gain" />
            <MetricTile
              label="Win rate"
              value={data.performance.total_sells > 0 ? `${data.performance.win_rate.toFixed(0)}%` : "—"}
              sub={`${data.performance.winning_sells}/${data.performance.total_sells} realized`}
            />
          </div>
          {chartData.length > 1 && (
            <SectionCard title="Cumulative P&L">
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="demoAnalysis" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" hide />
                    <YAxis hide domain={["auto", "auto"]} />
                    <ReferenceLine y={0} stroke="hsl(var(--border))" />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number) => fmt.fmt(v)}
                    />
                    <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#demoAnalysis)" isAnimationActive={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          )}
        </>
      ) : (
        <SectionCard title="Return by asset" bodyClassName="space-y-3">
          {byAsset.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No realized returns yet.</p>
          ) : (
            byAsset.map((s) => {
              const pos = s.total_return >= 0;
              const w = Math.min(100, (Math.abs(s.total_return) / maxAbs) * 100);
              return (
                <div key={s.symbol} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-mono font-semibold">{s.symbol}</span>
                    <span className={cn("font-mono font-semibold", pos ? "text-gain" : "text-loss")}>
                      {pos ? "+" : ""}
                      {fmt.fmt(fmt.cx(s.total_return))}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted">
                    <div className={cn("h-2 rounded-full", pos ? "bg-gain" : "bg-loss")} style={{ width: `${w}%` }} />
                  </div>
                </div>
              );
            })
          )}
        </SectionCard>
      )}
    </div>
  );
}
