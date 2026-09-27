import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { BarChart3, ChevronDown, LineChart as LineIcon, PieChart as PieIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Category, Transaction } from "@/types/finance";
import {
  buildPeriodSeries,
  categoryBreakdown,
  flowTotals,
  previousPeriod,
  previousPeriodLabel,
  resolvePeriod,
  PERIOD_LABELS,
  type CategorySlice,
  type FinancePeriod,
  type SeriesPoint,
} from "@/lib/financePeriods";
import { AXIS, GRID, TOOLTIP_STYLE, usd, usdShort } from "@/components/trips/tripChartTheme";

/**
 * Ingresos, egresos y margen del período que ya eligió el filtro del feed.
 *
 * Cerrada por defecto: el feed es a lo que se viene a esta pantalla, y los tres totales en la
 * cabecera ya responden "¿cómo vengo?" sin abrir nada. Abierta muestra el porqué.
 *
 * Los colores de las tres series son los del Sankey (verde entra, rosa sale, violeta queda)
 * para que el mismo concepto tenga el mismo color en /finance y en /movements. Nunca conviven
 * en un mismo gráfico —uno por serie—, así que el par verde/rosa no depende de distinguirse
 * bajo daltonismo: el título de cada panel dice qué es.
 */

const SERIES = {
  income: { title: "Ingresos", color: "#10b981" },
  expense: { title: "Egresos", color: "#f43f5e" },
  margin: { title: "Margen", color: "#a855f7" },
} as const;

type SeriesKey = keyof typeof SERIES;

/** La línea del período anterior: gris y punteada, recesiva — es contexto, no el dato. */
const PREV_COLOR = "hsl(var(--muted-foreground))";

/**
 * Porciones de la torta: la paleta categórica validada para superficie oscura, en orden fijo.
 * Seis como máximo — lo demás va a "Resto", en gris, para que no parezca una categoría más.
 */
const SLICE_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#9085e9"];
const REST_COLOR = "#6b7280";

type Mode = "line" | "pie";

export function FlowChartsCard({
  transactions,
  categories,
  period,
}: {
  transactions: Transaction[];
  categories: Category[];
  period: FinancePeriod;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("line");

  const range = useMemo(() => resolvePeriod(period), [period]);
  const prevRange = useMemo(() => previousPeriod(period), [period]);
  const totals = useMemo(() => flowTotals(transactions, range), [transactions, range]);
  const prevTotals = useMemo(
    () => (prevRange ? flowTotals(transactions, prevRange) : null),
    [transactions, prevRange],
  );
  // Lo pesado sólo se calcula abierto: cerrada, la tarjeta no dibuja ningún gráfico.
  const series = useMemo(
    () => (open ? buildPeriodSeries(transactions, period) : null),
    [open, transactions, period],
  );
  const slices = useMemo(() => {
    if (!open || mode !== "pie") return null;
    return {
      income: categoryBreakdown(transactions, categories, range, "income"),
      expense: categoryBreakdown(transactions, categories, range, "expense"),
    };
  }, [open, mode, transactions, categories, range]);

  const prevLabel = previousPeriodLabel(period);

  return (
    <Card className="bg-card border border-border/80">
      <CardContent className="p-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full flex-col gap-3 p-4 text-left md:flex-row md:items-center md:justify-between"
        >
          <span className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Gráficos del período</span>
            <span className="text-xs text-muted-foreground">· {PERIOD_LABELS[period]}</span>
            <ChevronDown
              className={cn(
                "ml-auto h-4 w-4 text-muted-foreground transition-transform md:hidden",
                open && "rotate-180",
              )}
            />
          </span>
          <span className="grid grid-cols-3 gap-3 md:flex md:items-center md:gap-6">
            {(Object.keys(SERIES) as SeriesKey[]).map((k) => (
              <Kpi
                key={k}
                label={SERIES[k].title}
                color={SERIES[k].color}
                value={totals[k]}
                prev={prevTotals ? prevTotals[k] : null}
                // Que los egresos suban es malo: el color del cambio sigue al significado.
                upIsGood={k !== "expense"}
              />
            ))}
            <ChevronDown
              className={cn(
                "hidden h-4 w-4 text-muted-foreground transition-transform md:block",
                open && "rotate-180",
              )}
            />
          </span>
        </button>

        {open && (
          <div className="space-y-3 border-t border-border/60 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div
                role="radiogroup"
                aria-label="Tipo de gráfico"
                className="inline-flex items-center gap-0.5 rounded-lg border border-border/70 bg-background/80 p-0.5"
              >
                {(
                  [
                    { v: "line", label: "Línea", Icon: LineIcon },
                    { v: "pie", label: "Torta", Icon: PieIcon },
                  ] as const
                ).map(({ v, label, Icon }) => (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={mode === v}
                    onClick={() => setMode(v)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                      mode === v
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>
              {mode === "line" && (
                <span className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <span className="h-0.5 w-4 rounded bg-foreground" /> Acumulado
                  </span>
                  {prevLabel && (
                    <span className="flex items-center gap-1.5">
                      <span className="w-4 border-t-2 border-dashed border-muted-foreground" />
                      {prevLabel}
                    </span>
                  )}
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {mode === "line" && series
                ? (Object.keys(SERIES) as SeriesKey[]).map((k) => (
                    <Panel key={k} title={SERIES[k].title} total={totals[k]}>
                      <FlowLine points={series.points} k={k} prevLabel={prevLabel} />
                    </Panel>
                  ))
                : slices && (
                    <>
                      <Panel title="Ingresos por categoría" total={totals.income}>
                        <CategoryPie data={slices.income} />
                      </Panel>
                      <Panel title="Egresos por categoría" total={totals.expense}>
                        <CategoryPie data={slices.expense} />
                      </Panel>
                      <Panel title="Margen" total={totals.margin}>
                        <MarginPie income={totals.income} expense={totals.expense} />
                      </Panel>
                    </>
                  )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function axisTick(v: number): string {
  return Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v));
}

function Kpi({
  label,
  color,
  value,
  prev,
  upIsGood,
}: {
  label: string;
  color: string;
  value: number;
  prev: number | null;
  upIsGood: boolean;
}) {
  // Sin base no hay porcentaje: un "+∞%" contra un mes vacío no dice nada.
  const delta = prev !== null && Math.abs(prev) > 0.005 ? ((value - prev) / Math.abs(prev)) * 100 : null;
  const good = delta !== null && (delta >= 0) === upIsGood;
  return (
    <span className="min-w-0">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
        {label}
      </span>
      <span className="block truncate font-mono text-sm font-bold tabular-nums text-foreground">
        {usdShort(value)}
      </span>
      {delta !== null && (
        <span className={cn("block font-mono text-[10px] tabular-nums", good ? "text-emerald-400" : "text-rose-400")}>
          {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(0)}%
        </span>
      )}
    </span>
  );
}

function Panel({ title, total, children }: { title: string; total: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">{title}</span>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{usd(total)}</span>
      </div>
      {children}
    </div>
  );
}

function FlowLine({ points, k, prevLabel }: { points: SeriesPoint[]; k: SeriesKey; prevLabel: string | null }) {
  const prevKey = k === "income" ? "prevIncome" : k === "expense" ? "prevExpense" : "prevMargin";
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={points} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: AXIS, fontSize: 10 }} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis
            tick={{ fill: AXIS, fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={40}
            // Sin "US$": en el eje partía el rótulo en dos renglones, y el panel ya dice la moneda.
            tickFormatter={axisTick}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(v: number, name: string) => [usd(v), name]}
          />
          {prevLabel && (
            <Line
              type="monotone"
              dataKey={prevKey}
              name={prevLabel}
              stroke={PREV_COLOR}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              dot={false}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}
          <Line
            type="monotone"
            dataKey={k}
            name={SERIES[k].title}
            stroke={SERIES[k].color}
            strokeWidth={2}
            dot={false}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function Donut({ data, colors, center }: { data: CategorySlice[]; colors: string[]; center?: string }) {
  return (
    <div className="relative h-36">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="60%"
            outerRadius="90%"
            // Hueco de superficie entre porciones: se separan sin depender sólo del color.
            stroke="hsl(var(--card))"
            strokeWidth={2}
            isAnimationActive={false}
          >
            {data.map((d, i) => (
              <Cell key={d.name} fill={colors[i]} />
            ))}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v: number, name: string) => [usd(v), name]} />
        </PieChart>
      </ResponsiveContainer>
      {center && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono text-sm font-bold tabular-nums text-foreground">
          {center}
        </span>
      )}
    </div>
  );
}

function Legend({ data, colors }: { data: CategorySlice[]; colors: string[] }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  return (
    <ul className="mt-2 space-y-1">
      {data.map((d, i) => (
        <li key={d.name} className="flex items-center gap-2 text-[11px]">
          <span className="h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: colors[i] }} />
          <span className="min-w-0 flex-1 truncate text-foreground">{d.name}</span>
          <span className="font-mono tabular-nums text-muted-foreground">
            {usdShort(d.value)} · {Math.round((d.value / total) * 100)}%
          </span>
        </li>
      ))}
    </ul>
  );
}

function Empty() {
  return <p className="flex h-36 items-center justify-center text-xs text-muted-foreground">Sin movimientos en el período</p>;
}

function CategoryPie({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) return <Empty />;
  const colors = data.map((d, i) => (d.name === "Resto" ? REST_COLOR : SLICE_COLORS[i % SLICE_COLORS.length]));
  return (
    <>
      <Donut data={data} colors={colors} />
      <Legend data={data} colors={colors} />
    </>
  );
}

/**
 * El margen no tiene categorías: la torta muestra en qué se fue el ingreso — cuánto se gastó
 * y cuánto quedó. Con déficit, el ingreso y lo que faltó para cubrir el gasto.
 */
function MarginPie({ income, expense }: { income: number; expense: number }) {
  if (income <= 0 && expense <= 0) return <Empty />;
  const surplus = income - expense;
  const data: CategorySlice[] =
    surplus >= 0
      ? [
          { name: "Gastado", value: expense },
          { name: "Ahorrado", value: surplus },
        ]
      : [
          { name: "Cubierto por ingresos", value: income },
          { name: "Déficit", value: -surplus },
        ];
  const colors = surplus >= 0 ? [SERIES.expense.color, SERIES.margin.color] : [SERIES.income.color, SERIES.expense.color];
  const rate = income > 0 ? Math.round((surplus / income) * 100) : null;
  return (
    <>
      <Donut data={data} colors={colors} center={rate !== null ? `${rate}%` : undefined} />
      <Legend data={data} colors={colors} />
    </>
  );
}
