import { useState } from "react";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";
import { useDemo } from "../../DemoContext";
import { Chip } from "../../components/Chip";
import { enrichHoldings } from "../../data/portfolioMetrics";

function pnlColor(pct: number): string {
  const m = Math.min(1, Math.abs(pct) / 12); // saturate at ±12%
  const sat = Math.round(22 + m * 48); // 22%..70% — bigger move = more saturated
  return pct >= 0 ? `hsl(152, ${sat}%, 40%)` : `hsl(0, ${sat}%, 50%)`;
}

// Recharts Treemap custom tile — colored by P&L %, labeled with symbol + %.
const HeatTile = (props: {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
  pct?: number;
}) => {
  const { x = 0, y = 0, width = 0, height = 0, name = "", pct } = props;
  if (width <= 0 || height <= 0) return null;
  const value = typeof pct === "number" ? pct : 0;
  const showText = width > 38 && height > 26;
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill={pnlColor(value)} stroke="hsl(var(--background))" strokeWidth={2} />
      {showText && (
        <>
          <text x={x + 6} y={y + 18} fill="#fff" fontSize={Math.min(15, width / 3.5)} fontWeight={700} style={{ fontFamily: "monospace" }}>
            {name}
          </text>
          {height > 42 && (
            <text x={x + 6} y={y + 34} fill="rgba(255,255,255,0.88)" fontSize={11} style={{ fontFamily: "monospace" }}>
              {value >= 0 ? "+" : ""}
              {value.toFixed(1)}%
            </text>
          )}
        </>
      )}
    </g>
  );
};

/** V3 — Heatmap: a treemap where tile size = position size and color = P&L (day or total). */
export function PortfolioV3() {
  const { data, fmt } = useDemo();
  const { items } = enrichHoldings(data.holdings, data.prices, data.previousCloses);
  const [mode, setMode] = useState<"total" | "day">("total");
  const treeData = items.map((h) => ({
    name: h.symbol,
    size: Math.max(1, h.mktVal),
    pct: (mode === "total" ? h.uPnlPct : h.dayPct) ?? 0,
    mktVal: h.mktVal,
  }));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-lg font-bold">{fmt.fmt(fmt.cx(data.totalPortfolioValue))}</p>
          <p className="text-[11px] text-muted-foreground">
            Tile = position size · color = {mode === "total" ? "total" : "today's"} P&L
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          <Chip active={mode === "total"} onClick={() => setMode("total")}>
            Total
          </Chip>
          <Chip active={mode === "day"} onClick={() => setMode("day")}>
            Today
          </Chip>
        </div>
      </div>

      <div className="h-[420px] w-full overflow-hidden rounded-xl border bg-card">
        <ResponsiveContainer width="100%" height="100%">
          <Treemap
            data={treeData}
            dataKey="size"
            aspectRatio={1}
            stroke="hsl(var(--background))"
            content={<HeatTile />}
            isAnimationActive={false}
          >
            <Tooltip
              content={({ active, payload }: { active?: boolean; payload?: { payload: { name: string; pct: number; mktVal: number } }[] }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload;
                return (
                  <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-lg">
                    <p className="font-mono font-bold">{p.name}</p>
                    <p className="text-muted-foreground">{fmt.fmt(fmt.cx(p.mktVal))}</p>
                    <p className={p.pct >= 0 ? "text-gain" : "text-loss"}>
                      {p.pct >= 0 ? "+" : ""}
                      {p.pct.toFixed(2)}%
                    </p>
                  </div>
                );
              }}
            />
          </Treemap>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{ background: pnlColor(-12) }} /> Loss
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{ background: pnlColor(0) }} /> Flat
        </span>
        <span className="flex items-center gap-1">
          <span className="h-3 w-3 rounded-sm" style={{ background: pnlColor(12) }} /> Gain
        </span>
      </div>
    </div>
  );
}
