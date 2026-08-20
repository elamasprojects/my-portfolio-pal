import { useMemo } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { useInflationHistory } from "@/hooks/useInflationHistory";
import { INFLATION_PERIODS, selectInflationWindow } from "@/lib/inflationHistory";

/**
 * Published monthly inflation, shown on its own.
 *
 * This is the only place inflation appears in the app, and it is context — no portfolio figure
 * is read here and none is adjusted by it.
 */

/**
 * Single series, so one hue carries it and no legend is needed — the title names the series.
 * Validated against the dark card surface (#1B1D22) for the OKLCH lightness band, the chroma
 * floor and ≥3:1 contrast; the app's raw primary sat above the band and read as glare.
 */
const SERIES = "#BF8A28";

/** 'YYYY-MM-01' → 'ene 24', in the local Spanish month names the rest of the app uses. */
function formatMonth(month: string): string {
  const [year, m] = month.split("-");
  const date = new Date(Number(year), Number(m) - 1, 1);
  return `${date.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")} ${year.slice(2)}`;
}

function formatPct(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
}

export function InflationChart() {
  const { data, isLoading, isError } = useInflationHistory();

  // Memoised so the empty fallback is not a fresh array on every render, which would
  // invalidate the two memos below each time.
  const points = useMemo(() => data?.points ?? [], [data]);

  // Every window the summary reports, computed once.
  const summaries = useMemo(
    () =>
      INFLATION_PERIODS.map((period) => ({
        ...period,
        ...selectInflationWindow(points, period.months),
      })),
    [points]
  );

  // The chart spans the widest window asked for, so it contains every figure above it.
  const chartData = useMemo(
    () =>
      selectInflationWindow(points, 36).points.map((p) => ({
        month: p.month,
        label: formatMonth(p.month),
        rate: p.monthlyRate,
      })),
    [points]
  );

  return (
    <Card className="bg-card border border-border/70">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Inflación mensual (IPC)</CardTitle>
        <CardDescription className="text-xs">
          Dato de referencia del INDEC. No se aplica a tus posiciones ni a tus resultados.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {isLoading ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {INFLATION_PERIODS.map((p) => (
                <Skeleton key={p.id} className="h-16" />
              ))}
            </div>
            <Skeleton className="h-[260px]" />
          </>
        ) : isError || points.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No hay datos de inflación disponibles en este momento.
          </p>
        ) : (
          <>
            {data?.isEstimated && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>
                  Serie estimada: no se pudo leer el dato publicado, así que esto es una
                  proyección, no una medición.
                </span>
              </div>
            )}

            {/* Accumulated figures. Rates compound, so these are not the sum of the bars. */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {summaries.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5"
                >
                  <span className="block text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {s.label}
                  </span>
                  <span className="mt-0.5 block font-mono text-xl font-bold tabular-nums text-foreground">
                    {formatPct(s.accumulatedPct)}
                  </span>
                </div>
              ))}
            </div>

            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  {/* Recessive grid: horizontal only, so the bars carry the reading. */}
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="hsl(var(--border))"
                    strokeOpacity={0.5}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    interval={Math.max(0, Math.floor(chartData.length / 8))}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v: number) => `${v}%`}
                    width={44}
                  />
                  {/* Deflationary months point down; the sign is read from direction, not colour. */}
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value: number) => [formatPct(value), "Inflación"]}
                  />
                  <Bar
                    dataKey="rate"
                    fill={SERIES}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={18}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <p className="text-[10px] font-mono text-muted-foreground">
              Fuente: {data?.source ?? "INDEC"} · {chartData.length} meses
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
