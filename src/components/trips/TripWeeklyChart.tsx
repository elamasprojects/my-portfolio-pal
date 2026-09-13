import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TripSummary } from "@/lib/tripSummary";
import { SPEND, AXIS, GRID, TOOLTIP_STYLE, usd, usdShort, shortDate } from "./tripChartTheme";

/**
 * El ritmo del viaje, por tramos de siete días.
 *
 * Por semana y no por día porque a 77 barras en un teléfono cada una mide tres píxeles y el
 * gráfico deja de decir nada. El detalle diario ya lo lleva la curva acumulada.
 */
export function TripWeeklyChart({ summary }: { summary: TripSummary }) {
  const data = summary.byWeek.map((w) => ({
    ...w,
    label: `S${w.index}`,
    rango: `${shortDate(w.start)} – ${shortDate(w.end)}`,
  }));

  return (
    <Card className="border border-border/70 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">El ritmo, semana a semana</CardTitle>
        <CardDescription className="text-xs">
          Sólo el gasto hecho en destino. Lo prepago no tiene semana.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="h-[200px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <CartesianGrid stroke={GRID} strokeOpacity={0.5} vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: AXIS, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={usdShort}
                tick={{ fill: AXIS, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                cursor={{ fill: "hsl(var(--muted))", fillOpacity: 0.35 }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                labelFormatter={(_v, payload: Array<{ payload?: { rango?: string } }>) =>
                  payload?.[0]?.payload?.rango ?? ""
                }
                formatter={(value: number) => [usd(value), "Gasto"]}
              />
              <Bar
                dataKey="spend"
                fill={SPEND}
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
