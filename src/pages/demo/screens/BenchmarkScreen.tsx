import { useMemo, useState } from "react";
import { Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Scale } from "lucide-react";
import { useDemo } from "../DemoContext";
import { useIndexHistory } from "../data/useBenchmarkSeries";
import { makeSyntheticIndexCurve } from "../data/mockData";
import { MetricTile } from "../components/MetricTile";
import { SectionCard } from "../components/SectionCard";
import { Chip } from "../components/Chip";
import { EmptyState } from "../components/EmptyState";

const INDICES = [
  { id: "SPY", label: "S&P 500" },
  { id: "QQQ", label: "Nasdaq" },
  { id: "^MERV", label: "Merval" },
];
const round2 = (v: number) => Math.round(v * 100) / 100;

export function BenchmarkScreen() {
  const { data, setScreen } = useDemo();
  const [idx, setIdx] = useState("SPY");
  const { data: candles, isLoading } = useIndexHistory(idx, "1Y");

  const series = useMemo(() => {
    const cost = data.performance.total_cost_basis || 1;
    const portPts = data.cumulativePnL.map((p) => ({ date: p.date, pct: ((p.net_pnl ?? p.cumulative_pnl) / cost) * 100 }));

    let idxPts: { date: string; close: number }[] = [];
    if (candles && candles.length) {
      const step = Math.max(1, Math.floor(candles.length / 40));
      idxPts = candles
        .filter((_, i) => i % step === 0)
        .map((c) => ({ date: new Date(c.time * 1000).toISOString().split("T")[0], close: c.close }));
    }

    if (!idxPts.length) {
      if (!portPts.length) return [];
      const synth = makeSyntheticIndexCurve(portPts.map((p) => ({ date: p.date, pct: p.pct })));
      return portPts.map((p, i) => ({ date: p.date, portfolioPct: round2(p.pct), indexPct: synth[i]?.pct ?? 0 }));
    }

    const idxStart = idxPts[0].close || 1;
    return idxPts.map((ip) => {
      const indexPct = (ip.close / idxStart - 1) * 100;
      const last = [...portPts].reverse().find((pp) => pp.date <= ip.date);
      return { date: ip.date, indexPct: round2(indexPct), portfolioPct: round2(last ? last.pct : 0) };
    });
  }, [candles, data.cumulativePnL, data.performance.total_cost_basis]);

  if (!data.hasData) {
    return (
      <EmptyState
        icon={Scale}
        title="Nothing to benchmark yet"
        description="Add trades to compare your performance against the market."
        actionLabel="Add a trade"
        onAction={() => setScreen("addTrade")}
      />
    );
  }

  const indexPct = series.length ? series[series.length - 1].indexPct : 0;
  const myPct = data.totalPnlPct;
  const alpha = myPct - indexPct;
  const label = INDICES.find((i) => i.id === idx)?.label ?? idx;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Are you beating the market?</p>
      <div className="flex gap-2">
        {INDICES.map((i) => (
          <Chip key={i.id} active={idx === i.id} onClick={() => setIdx(i.id)}>
            {i.label}
          </Chip>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <MetricTile label="You" value={`${myPct >= 0 ? "+" : ""}${myPct.toFixed(1)}%`} tone={myPct >= 0 ? "gain" : "loss"} />
        <MetricTile label={label} value={`${indexPct >= 0 ? "+" : ""}${indexPct.toFixed(1)}%`} />
        <MetricTile label="Alpha" value={`${alpha >= 0 ? "+" : ""}${alpha.toFixed(1)}%`} tone={alpha >= 0 ? "gain" : "loss"} />
      </div>

      <SectionCard title={`Portfolio vs ${label} (1Y)`}>
        {isLoading ? (
          <div className="h-56 animate-pulse rounded-lg bg-muted/50" />
        ) : series.length < 2 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">Not enough history to plot a curve yet.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <XAxis dataKey="date" hide />
                <YAxis hide domain={["auto", "auto"]} />
                <ReferenceLine y={0} stroke="hsl(var(--border))" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number, name: string) => [`${v.toFixed(1)}%`, name === "portfolioPct" ? "You" : label]}
                />
                <Legend
                  formatter={(value) => (value === "portfolioPct" ? "You" : label)}
                  wrapperStyle={{ fontSize: 12 }}
                />
                <Line type="monotone" dataKey="portfolioPct" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="indexPct" stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </SectionCard>
    </div>
  );
}
