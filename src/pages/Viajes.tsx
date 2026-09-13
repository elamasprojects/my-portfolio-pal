import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Luggage, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useTransactions, useCategories, usePaymentMethods } from "@/hooks/useFinance";
import { useTrips, useAllTripItems } from "@/hooks/useTrips";
import { summariseTrip } from "@/lib/tripSummary";
import { usd, shortDate } from "@/components/trips/tripChartTheme";

/**
 * Los viajes, con lo que costó cada uno.
 *
 * El total de la tarjeta sale del mismo `summariseTrip` que la pantalla de detalle, sobre las
 * mismas excepciones. Calcularlo acá "rápido" con un filtro por fechas daría una cifra
 * distinta a la de adentro, que es peor que no mostrar ninguna.
 */
export default function Viajes() {
  const { trips, isLoading: loadingTrips, addTrip } = useTrips();
  const { items, isLoading: loadingItems } = useAllTripItems();
  const { transactions, isLoading: loadingTx } = useTransactions();
  const { categories } = useCategories();
  const { paymentMethods } = usePaymentMethods();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", destination: "", start_date: "", end_date: "" });

  const isLoading = loadingTrips || loadingItems || loadingTx;

  const rows = useMemo(
    () =>
      trips.map((trip) => ({
        trip,
        summary: summariseTrip(
          trip,
          transactions,
          items.filter((i) => i.trip_id === trip.id),
          categories,
          paymentMethods
        ),
      })),
    [trips, transactions, items, categories, paymentMethods]
  );

  const canSave =
    form.name.trim() !== "" &&
    form.start_date !== "" &&
    form.end_date !== "" &&
    form.end_date >= form.start_date &&
    !addTrip.isPending;

  const save = () => {
    if (!canSave) return;
    addTrip.mutate(
      {
        name: form.name.trim(),
        destination: form.destination.trim() || null,
        start_date: form.start_date,
        end_date: form.end_date,
      },
      {
        onSuccess: () => {
          setOpen(false);
          setForm({ name: "", destination: "", start_date: "", end_date: "" });
        },
      }
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">Viajes</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Lo que costó cada viaje, con lo prepago incluido.
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)} className="shrink-0 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Nuevo
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : rows.length === 0 ? (
        <Card className="border border-border/70 bg-card">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Luggage className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Todavía no cargaste ningún viaje.</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Un viaje es un rango de fechas. Después le traés a mano lo que pagaste antes de
              salir y le sacás lo que era de casa.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2.5">
          {rows.map(({ trip, summary }) => (
            <li key={trip.id}>
              <Link
                to={`/viajes/${trip.id}`}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3.5 transition-colors hover:border-primary/50 hover:bg-muted/30"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {trip.name}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {shortDate(trip.start_date)} – {shortDate(trip.end_date)} · {summary.days} días
                    {trip.destination ? ` · ${trip.destination}` : ""}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-sm font-semibold tabular-nums text-foreground">
                    {usd(summary.net)}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">
                    {usd(summary.perDay)} por día
                  </span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-border/60 bg-card">
          <DialogHeader>
            <DialogTitle className="font-serif text-lg text-primary">Nuevo viaje</DialogTitle>
            <DialogDescription className="text-xs">
              Con el rango alcanza para empezar: las excepciones se ajustan después.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="trip-name" className="text-xs">
                Nombre
              </Label>
              <Input
                id="trip-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Europa 2026"
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="trip-dest" className="text-xs">
                Destino <span className="text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="trip-dest"
                value={form.destination}
                onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                placeholder="España, Italia, Reino Unido"
                className="h-9 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="trip-from" className="text-xs">
                  Desde
                </Label>
                <Input
                  id="trip-from"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="trip-to" className="text-xs">
                  Hasta
                </Label>
                <Input
                  id="trip-to"
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            {form.start_date !== "" && form.end_date !== "" && form.end_date < form.start_date && (
              <p className="text-xs text-destructive">La vuelta no puede ser antes de la salida.</p>
            )}

            <Button onClick={save} disabled={!canSave} className="w-full">
              {addTrip.isPending ? "Creando…" : "Crear viaje"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
