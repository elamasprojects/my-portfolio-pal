import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Minus, SlidersHorizontal, X } from "lucide-react";
import type { Transaction } from "@/types/finance";
import type { Trip, TripEntry, TripItem, TripItemMode } from "@/lib/tripSummary";
import { usd, shortDate } from "./tripChartTheme";

/**
 * Las excepciones del viaje, a la vista y reversibles.
 *
 * El total de un viaje sale de una ventana de fechas más un puñado de correcciones a mano. Si
 * esas correcciones no se muestran, la cifra de arriba es imposible de auditar: no hay forma
 * de saber si el vuelo está contado dos veces o si falta. Acá se ven las dos listas con su
 * motivo, y cada una se deshace de a una.
 */

/** Cuánto alrededor del viaje se ofrece para traer a mano. */
const WINDOW_DAYS = 120;

function shift(date: string, days: number): string {
  const t = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(t)) return date;
  return new Date(t + days * 86_400_000).toISOString().slice(0, 10);
}

interface Props {
  trip: Trip;
  entries: TripEntry[];
  items: TripItem[];
  transactions: Transaction[];
  onSet: (args: { transactionId: string; mode: TripItemMode; reason?: string }) => void;
  onClear: (transactionId: string) => void;
  isBusy?: boolean;
}

export function TripAdjustments({
  trip,
  entries,
  items,
  transactions,
  onSet,
  onClear,
  isBusy,
}: Props) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");

  const byId = useMemo(() => new Map(transactions.map((t) => [t.id, t])), [transactions]);
  const inTrip = useMemo(() => new Set(entries.map((e) => e.transaction.id)), [entries]);
  const overrideOf = useMemo(
    () => new Map(items.map((i) => [i.transaction_id, i])),
    [items]
  );

  const included = items.filter((i) => i.mode === "include");
  const excluded = items.filter((i) => i.mode === "exclude");

  /**
   * Candidatas a mover. Se acota a los meses alrededor del viaje porque la lista entera son
   * cientos de filas de años anteriores, y ninguna de ésas se va a traer a este viaje.
   */
  const candidates = useMemo(() => {
    const from = shift(trip.start_date, -WINDOW_DAYS);
    const to = shift(trip.end_date, WINDOW_DAYS);
    const needle = filter.trim().toLowerCase();
    return transactions
      .filter((t) => !t.deleted_at)
      .filter((t) => t.type === "expense" || t.type === "income")
      .filter((t) => t.transaction_date >= from && t.transaction_date <= to)
      .filter((t) => (needle ? t.name.toLowerCase().includes(needle) : true))
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
      .slice(0, 120);
  }, [transactions, trip.start_date, trip.end_date, filter]);

  /**
   * Un solo gesto por fila, simétrico: si está adentro la saca, si está afuera la trae. Cuál
   * de las dos operaciones toca —poner una excepción o quitar la que ya había— depende de si
   * la ventana de fechas la incluía por su cuenta.
   */
  const toggle = (tx: Transaction) => {
    const isIn = inTrip.has(tx.id);
    const mode = overrideOf.get(tx.id)?.mode ?? null;
    if (isIn) {
      if (mode === "include") onClear(tx.id);
      else onSet({ transactionId: tx.id, mode: "exclude", reason: "Marcado a mano" });
    } else {
      if (mode === "exclude") onClear(tx.id);
      else onSet({ transactionId: tx.id, mode: "include", reason: "Marcado a mano" });
    }
  };

  const renderException = (item: TripItem) => {
    const tx = byId.get(item.transaction_id);
    return (
      <li
        key={item.id}
        className="flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-medium text-foreground">
            {tx?.name ?? "Movimiento eliminado"}
          </span>
          <span className="block truncate text-[10px] text-muted-foreground">
            {tx ? `${shortDate(tx.transaction_date)} · ${usd(Math.abs(tx.amount_usd))}` : "—"}
            {item.reason ? ` · ${item.reason}` : ""}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onClear(item.transaction_id)}
          disabled={isBusy}
          aria-label={`Deshacer la excepción de ${tx?.name ?? "este movimiento"}`}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-40"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </li>
    );
  };

  return (
    <>
      <Card className="border border-border/70 bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Qué entra y qué no</CardTitle>
          <CardDescription className="text-xs">
            Cuenta todo lo gastado entre el {shortDate(trip.start_date)} y el{" "}
            {shortDate(trip.end_date)}, más estas correcciones.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {included.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Plus className="h-3 w-3" /> Traídas al viaje ({included.length})
              </p>
              <ul className="space-y-1.5">{included.map(renderException)}</ul>
            </div>
          )}

          {excluded.length > 0 && (
            <div className="space-y-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                <Minus className="h-3 w-3" /> Sacadas del viaje ({excluded.length})
              </p>
              <ul className="space-y-1.5">{excluded.map(renderException)}</ul>
            </div>
          )}

          {items.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Sin correcciones: el viaje es exactamente lo que cayó entre esas dos fechas.
            </p>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="w-full gap-2 text-xs"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Ajustar qué entra
          </Button>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 rounded-2xl border border-border/60 bg-card p-0">
          <DialogHeader className="space-y-1 border-b border-border/50 px-4 py-3">
            <DialogTitle className="font-serif text-lg text-primary">Ajustar qué entra</DialogTitle>
            <DialogDescription className="text-xs">
              Tocá un movimiento para traerlo al viaje o sacarlo. Se muestran los meses
              alrededor del viaje.
            </DialogDescription>
          </DialogHeader>

          <div className="border-b border-border/50 px-4 py-2.5">
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar por nombre…"
              className="h-9 text-sm"
            />
          </div>

          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-3">
            {candidates.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Ningún movimiento coincide.
              </p>
            )}

            {candidates.map((tx) => {
              const isIn = inTrip.has(tx.id);
              const mode = overrideOf.get(tx.id)?.mode ?? null;
              return (
                <button
                  key={tx.id}
                  type="button"
                  onClick={() => toggle(tx)}
                  disabled={isBusy}
                  aria-pressed={isIn}
                  className={`flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors disabled:opacity-40 ${
                    isIn
                      ? "border-primary/50 bg-primary/10"
                      : "border-border/50 bg-muted/10 hover:bg-muted/30"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-foreground">
                      {tx.name}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {shortDate(tx.transaction_date)} · {usd(Math.abs(tx.amount_usd))}
                      {tx.type === "income" ? " · ingreso" : ""}
                    </span>
                  </span>
                  {mode && (
                    <Badge variant="outline" className="shrink-0 text-[9px]">
                      {mode === "include" ? "traída" : "sacada"}
                    </Badge>
                  )}
                  <span
                    className={`shrink-0 text-[10px] font-semibold ${
                      isIn ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {isIn ? "en el viaje" : "afuera"}
                  </span>
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
