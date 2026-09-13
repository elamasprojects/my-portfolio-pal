import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { TripBucket } from "@/lib/tripSummary";
import { SPEND, usd } from "./tripChartTheme";

/**
 * Un reparto ordenado de mayor a menor, en barras planas de HTML.
 *
 * No va por Recharts a propósito: acá la etiqueta y el monto tienen que leerse siempre, y un
 * gráfico de barras horizontales en 360px de ancho o recorta los nombres o los tira afuera.
 * Con el valor escrito al lado no hace falta tooltip, y un solo tono alcanza porque lo que se
 * compara es tamaño, no identidad — el nombre ya está a la izquierda de cada barra.
 */
export function TripBreakdownBars({
  title,
  description,
  buckets,
  emptyLabel = "Todavía no hay gastos para repartir.",
}: {
  title: string;
  description?: string;
  buckets: TripBucket[];
  emptyLabel?: string;
}) {
  const max = buckets.reduce((m, b) => Math.max(m, b.total), 0);

  return (
    <Card className="border border-border/70 bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>

      <CardContent>
        {buckets.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          <ul className="space-y-3">
            {buckets.map((b) => (
              <li key={b.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="min-w-0 truncate font-medium text-foreground">{b.name}</span>
                  <span className="shrink-0 font-mono tabular-nums text-foreground">
                    {usd(b.total)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div
                    className="h-2 flex-1 overflow-hidden rounded-full bg-muted/40"
                    role="img"
                    aria-label={`${b.name}: ${usd(b.total)}, ${Math.round(b.share * 100)} por ciento`}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: max > 0 ? `${Math.max((b.total / max) * 100, 1.5)}%` : "0%",
                        backgroundColor: SPEND,
                      }}
                    />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                    {(b.share * 100).toFixed(1)}% · {b.count}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
