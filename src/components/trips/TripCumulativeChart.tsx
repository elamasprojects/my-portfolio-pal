import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TripSummary } from "@/lib/tripSummary";
import { SPEND, PREPAID, AXIS, GRID, TOOLTIP_STYLE, usd, usdShort, shortDate } from "./tripChartTheme";

/**
 * Cuánto llevaba gastado el viaje, día por día.
 *
 * Arranca en lo prepago y no en cero: el día que salió, el viaje ya costaba el vuelo y dos
 * hospedajes. La línea de referencia deja ver esa ventaja de arranque, que es la que hace que
 * la curva no empiece pegada al eje.
 */
export function TripCumulativeChart({ summary }: { summary: TripSummary }) {
  const { daily, prepaid } = summary;

  return (
    <Card className="border border-border/70 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Cómo se fue acumulando</CardTitle>
        <CardDescription className="text-xs">
          {prepaid > 0
            ? `Empieza en ${usd(prepaid)}: lo que el viaje ya costaba antes de salir.`
            : "Gasto acumulado desde el primer día."}
        </CardDescription>
      </CardHeader>

      <CardContent>
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
              <defs>
                <linearGradient id="tripCumFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SPEND} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={SPEND} stopOpacity={0.02} />
                </linearGradient>
              </defs>

              <CartesianGrid stroke={GRID} strokeOpacity={0.5} vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={shortDate}
                tick={{ fill: AXIS, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                minTickGap={44}
              />
              <YAxis
                tickFormatter={usdShort}
                tick={{ fill: AXIS, fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                width={56}
              />
              <Tooltip
                cursor={{ stroke: GRID, strokeWidth: 1 }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                labelFormatter={(v: string) => shortDate(v)}
                formatter={(value: number, _name, item: { payload?: { spend?: number } }) => {
                  const del = item?.payload?.spend ?? 0;
                  return [`${usd(value)}${del > 0 ? ` · ese día ${usd(del)}` : ""}`, "Acumulado"];
                }}
              />

              {prepaid > 0 && (
                <ReferenceLine
                  y={prepaid}
                  stroke={PREPAID}
                  strokeDasharray="4 4"
                  strokeWidth={2}
                  label={{
                    value: "prepago",
                    position: "insideTopLeft",
                    fill: AXIS,
                    fontSize: 10,
                  }}
                />
              )}

              <Area
                type="monotone"
                dataKey="cumulative"
                stroke={SPEND}
                strokeWidth={2}
                fill="url(#tripCumFill)"
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
