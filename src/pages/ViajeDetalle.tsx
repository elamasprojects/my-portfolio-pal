import { useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CalendarDays, MapPin, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactions, useCategories, usePaymentMethods } from "@/hooks/useFinance";
import { useTrips, useTripItems } from "@/hooks/useTrips";
import { summariseTrip } from "@/lib/tripSummary";
import { TripCumulativeChart } from "@/components/trips/TripCumulativeChart";
import { TripWeeklyChart } from "@/components/trips/TripWeeklyChart";
import { TripBreakdownBars } from "@/components/trips/TripBreakdownBars";
import { TripAdjustments } from "@/components/trips/TripAdjustments";
import { usd, shortDate } from "@/components/trips/tripChartTheme";

/**
 * El resumen de un viaje.
 *
 * Todo lo que se muestra sale de `summariseTrip`, que es la única que decide qué transacción
 * pertenece al viaje. La pantalla no filtra nada por su cuenta: si la cifra de arriba y la
 * lista de abajo pudieran discrepar, el resumen dejaría de servir para auditar.
 */

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function ViajeDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { trips, isLoading: loadingTrips, isError: tripsFailed, deleteTrip } = useTrips();
  const { items, isLoading: loadingItems, setItem, clearItem } = useTripItems(id);
  const { transactions, isLoading: loadingTx, isError: txFailed } = useTransactions();
  const { categories, isLoading: loadingCats, isError: catsFailed } = useCategories();
  const { paymentMethods, isLoading: loadingPm, isError: pmFailed } = usePaymentMethods();

  const trip = trips.find((t) => t.id === id);
  // Las cuatro consultas cuentan. Sin las categorías y los medios de pago el desglose se
  // dibuja entero como "Sin categoría" / "Sin medio de pago", que parece un dato y no lo es.
  const isLoading = loadingTrips || loadingItems || loadingTx || loadingCats || loadingPm;
  const failed = tripsFailed || txFailed || catsFailed || pmFailed;

  const summary = useMemo(
    () => (trip ? summariseTrip(trip, transactions, items, categories, paymentMethods) : null),
    [trip, transactions, items, categories, paymentMethods]
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[240px] w-full" />
      </div>
    );
  }

  /*
    Una consulta caída no puede caer en el mismo camino que "no hay datos": con las
    transacciones sin traer, el titular de una pantalla que existe para auditar diría
    "US$ 0,00 gastados", que es una cifra, no un error.
  */
  if (failed || !trip || !summary) {
    return (
      <div className="space-y-4">
        <Link
          to="/viajes"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Viajes
        </Link>
        <p className="py-12 text-center text-sm text-muted-foreground">
          {failed
            ? "No pudimos traer los datos del viaje. Probá de nuevo en unos segundos."
            : "No encontramos ese viaje."}
        </p>
      </div>
    );
  }

  const { spend, refunds, net, prepaid, onTrip, after, days, perDay, daysWithSpend, quietDays } =
    summary;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Link
          to="/viajes"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Viajes
        </Link>

        <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">
          {trip.name}
        </h1>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {trip.destination && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {trip.destination}
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5" />
            {shortDate(trip.start_date)} – {shortDate(trip.end_date)}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {days} días
          </Badge>
        </div>

        {/* Un viaje con el rango mal puesto no se puede corregir desde acá; borrarlo y volver
            a crearlo sí. Borra el viaje y sus excepciones, nunca una transacción. */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground transition-colors hover:text-destructive"
            >
              <Trash2 className="h-3 w-3" /> Eliminar viaje
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar «{trip.name}»?</AlertDialogTitle>
              <AlertDialogDescription>
                Se borra el viaje y sus {items.length} correcciones. Los movimientos quedan
                donde están: esto no toca tus gastos.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() =>
                  deleteTrip.mutate(trip.id, { onSuccess: () => navigate("/viajes") })
                }
              >
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* El titular es el neto: lo que el viaje costó de verdad, ya descontados los reembolsos. */}
      <Card className="border border-border/70 bg-card">
        <CardContent className="p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            Lo que costó el viaje
          </p>
          <p className="mt-1 font-mono text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
            {usd(net)}
          </p>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {usd(spend)} gastados
            {refunds > 0 ? `, menos ${usd(refunds)} que volvieron como reembolso` : ""}.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tile
          label="Prepago"
          value={usd(prepaid)}
          hint={prepaid > 0 ? "pagado antes de salir" : "nada pagado por adelantado"}
        />
        <Tile label="En destino" value={usd(onTrip)} hint={`${daysWithSpend} días con gasto`} />
        <Tile label="Por día" value={usd(perDay)} hint="del gasto en destino" />
        <Tile
          label="Días en cero"
          value={String(quietDays)}
          hint={quietDays > 0 ? "sin un solo gasto" : "gastaste todos los días"}
        />
      </div>

      {after !== 0 && (
        <p className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          {after > 0
            ? `${usd(after)} impactaron después de volver y están contados igual: el gasto es del viaje aunque el cargo haya llegado tarde.`
            : `${usd(-after)} volvieron como reembolso después de volver, y ya están descontados acá.`}
        </p>
      )}

      <TripCumulativeChart summary={summary} />
      <TripWeeklyChart summary={summary} />

      <div className="grid gap-4 lg:grid-cols-2">
        <TripBreakdownBars
          title="En qué se fue"
          description="Sobre el gasto bruto. Los reembolsos no arman su propia categoría."
          buckets={summary.byCategory}
        />
        <TripBreakdownBars
          title="Con qué se pagó"
          description="Cada medio de pago, sobre el mismo gasto bruto."
          buckets={summary.byPaymentMethod}
        />
      </div>

      {summary.topExpenses.length > 0 && (
        <Card className="border border-border/70 bg-card">
          <CardContent className="p-4 sm:p-5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Los diez más caros
            </p>
            <ul className="mt-3 space-y-2">
              {summary.topExpenses.map((e) => (
                <li key={e.transaction.id} className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-foreground">
                      {e.transaction.name}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {shortDate(e.transaction.transaction_date)}
                      {e.isPrepaid ? " · prepago" : ""}
                      {e.isAfter ? " · impactó después" : ""}
                    </span>
                  </span>
                  <span className="shrink-0 font-mono text-xs tabular-nums text-foreground">
                    {usd(e.signedUSD)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <TripAdjustments
        trip={trip}
        entries={summary.entries}
        items={items}
        transactions={transactions}
        onSet={(args) => setItem.mutate(args)}
        onClear={(txId) => clearItem.mutate(txId)}
        isBusy={setItem.isPending || clearItem.isPending}
      />

      <p className="pb-2 text-center text-[10px] font-mono text-muted-foreground">
        {summary.entries.length} movimientos · todo en dólares, como el resto del ledger
      </p>
    </div>
  );
}
