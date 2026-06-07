import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { useDemo } from "../../DemoContext";
import { MetricTile } from "../../components/MetricTile";
import { SectionCard } from "../../components/SectionCard";
import { CHART_COLORS } from "../../data/chartColors";
import { enrichHoldings } from "../../data/portfolioMetrics";

const RAD = Math.PI / 180;
// Only label slices at/above this share — hides tickers on the many tiny slices so they don't overlap.
const TICKER_MIN_PCT = 0.04; // 4%

const renderSliceLabel = (props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
  name?: string;
}) => {
  const { cx, cy, midAngle, outerRadius, percent, name } = props;
  if (cx == null || cy == null || midAngle == null || outerRadius == null || percent == null) return null;
  if (percent < TICKER_MIN_PCT) return null;
  const r = outerRadius + 12;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  const isLeft = x < cx;
  return (
    <text
      x={x}
      y={y}
      fill="hsl(var(--foreground))"
      fontSize={11}
      fontWeight={600}
      stroke="hsl(var(--card))"
      strokeWidth={3}
      paintOrder="stroke"
      textAnchor={isLeft ? "end" : "start"}
      dominantBaseline="central"
      style={{ fontFamily: "monospace" }}
    >
      {name}
    </text>
  );
};

/** V4 — Allocation-first: a big donut-hero with value in the center + weight bars. Composition over P&L. */
export function PortfolioV4() {
  const { data, fmt } = useDemo();
  const { items } = enrichHoldings(data.holdings, data.prices, data.previousCloses);
  const pieData = items.map((h) => ({ name: h.symbol, value: h.mktVal }));
  const topWeight = items[0]?.weight ?? 0;
  const assetTypes = new Set(items.map((i) => i.assetType)).size;

  return (
    <div className="space-y-4">
      <SectionCard title="Composition">
        <div className="relative h-72">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="52%"
                outerRadius="74%"
                paddingAngle={1}
                isAnimationActive={false}
                label={renderSliceLabel}
                labelLine={false}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="hsl(var(--card))" strokeWidth={1} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="font-mono text-2xl font-bold">{fmt.fmtCompact(fmt.cx(data.totalPortfolioValue))}</p>
            <p className="text-[11px] text-muted-foreground">{items.length} positions</p>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-3 gap-3">
        <MetricTile label="Positions" value={String(items.length)} />
        <MetricTile label="Top weight" value={`${topWeight.toFixed(0)}%`} tone={topWeight > 25 ? "loss" : "neutral"} />
        <MetricTile label="Asset types" value={String(assetTypes)} />
      </div>

      <SectionCard title="Weights" bodyClassName="space-y-2.5">
        {items.map((h, i) => (
          <div key={h.symbol} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                <span className="font-mono font-semibold">{h.symbol}</span>
                <span className="truncate text-xs text-muted-foreground">{h.name}</span>
              </span>
              <span className="shrink-0 font-mono text-muted-foreground">{h.weight.toFixed(1)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted">
              <div className="h-1.5 rounded-full" style={{ width: `${Math.min(100, h.weight)}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
            </div>
          </div>
        ))}
      </SectionCard>
    </div>
  );
}
