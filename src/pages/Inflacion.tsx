import { InflationChart } from "@/components/InflationChart";

/**
 * Standalone inflation reference.
 *
 * Kept on its own route, out of the main navigation, and deliberately holding nothing else:
 * no position, no P&L, no net worth. Inflation is a number to glance at here, not an
 * adjustment applied anywhere else in the app.
 */
export default function Inflacion() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">Inflación</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Contexto macro, separado de tu cartera.
        </p>
      </div>

      <InflationChart />
    </div>
  );
}
