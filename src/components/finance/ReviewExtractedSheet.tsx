import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Trash2, Undo2, ArrowLeft, AlertTriangle } from "lucide-react";
import { resolveTransactionAmountUSD } from "@/lib/fxConversion";
import type { Category, FinancialAccount, PaymentMethod } from "@/types/finance";

/**
 * Revisión previa a guardar.
 *
 * El extractor devuelve varios movimientos de una sola captura y antes se escribían todos
 * directo: un monto mal leído o una categoría equivocada ya estaba en la base, moviendo saldos
 * por trigger, y había que ir a buscarla para arreglarla. Acá se ven, se corrigen y se
 * descartan las que no van; recién el botón del pie escribe.
 */

export interface ReviewRow {
  /** Sólo para React y para el descarte; no viaja a la base. */
  key: string;
  name: string;
  /** Monto en su moneda original, tal como lo leyó el extractor. */
  amount: string;
  currency: string;
  type: "expense" | "income";
  transactionDate: string;
  categoryId: string | null;
  accountId: string | null;
  paymentMethodId: string | null;
  rawMerchant?: string | null;
  confidence?: string;
  /** La cuenta no se pudo identificar y quedó la primera de la lista. */
  accountWasGuessed?: boolean;
  suggestedCategory?: string | null;
}

interface ReviewExtractedSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: ReviewRow[];
  categories: Category[];
  accounts: FinancialAccount[];
  paymentMethods: PaymentMethod[];
  /** ARS por USD. Sin esto, un monto en pesos no se puede convertir y la fila se bloquea. */
  mepRate: number;
  isSaving: boolean;
  onConfirm: (rows: ReviewRow[]) => void;
  /** Volver a la captura sin perder lo que se había subido. */
  onBack: () => void;
}

const DISCARD_AT = 96;

const money = (n: number) =>
  n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function ReviewExtractedSheet({
  open,
  onOpenChange,
  rows,
  categories,
  accounts,
  paymentMethods,
  mepRate,
  isSaving,
  onConfirm,
  onBack,
}: ReviewExtractedSheetProps) {
  const [draft, setDraft] = useState<ReviewRow[]>(rows);
  const [discarded, setDiscarded] = useState<ReviewRow[]>([]);

  // Cada apertura arranca de lo que se acaba de extraer. Sin esto, la segunda captura de la
  // sesión mostraba las filas de la primera: el diálogo no se desmonta.
  useEffect(() => {
    if (open) {
      setDraft(rows);
      setDiscarded([]);
    }
  }, [open, rows]);

  const patch = (key: string, field: Partial<ReviewRow>) =>
    setDraft((prev) => prev.map((r) => (r.key === key ? { ...r, ...field } : r)));

  const discard = (key: string) =>
    setDraft((prev) => {
      const row = prev.find((r) => r.key === key);
      if (row) setDiscarded((d) => [...d, row]);
      return prev.filter((r) => r.key !== key);
    });

  const undoDiscard = () =>
    setDiscarded((prev) => {
      const last = prev[prev.length - 1];
      if (last) setDraft((d) => [...d, last]);
      return prev.slice(0, -1);
    });

  /** Un monto que no se puede convertir no se guarda: iría a la columna de dólares en pesos. */
  const converted = useMemo(
    () =>
      draft.map((r) =>
        resolveTransactionAmountUSD({
          amount: Number(r.amount),
          currency: r.currency,
          arsPerUsd: mepRate,
        })
      ),
    [draft, mepRate]
  );

  const blocked = converted.filter((c) => c.status !== "ok").length;
  const total = converted.reduce((s, c) => (c.status === "ok" ? s + c.amountUSD : s), 0);
  const canSave = draft.length > 0 && blocked === 0 && !isSaving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-1.5rem)] max-w-lg flex-col gap-0 rounded-2xl border border-border/60 bg-card p-0 shadow-2xl">
        <DialogHeader className="space-y-1 border-b border-border/50 px-4 py-3 sm:px-5">
          <DialogTitle className="flex items-center gap-2 font-serif text-lg text-primary">
            <button
              type="button"
              onClick={onBack}
              className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              aria-label="Volver a la captura"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <span className="min-w-0 truncate">Revisá antes de guardar</span>
          </DialogTitle>
          <DialogDescription className="pl-8 text-xs">
            {draft.length === 1
              ? "Se detectó 1 movimiento. Corregí lo que haga falta."
              : `Se detectaron ${draft.length} movimientos. Deslizá una tarjeta hacia la izquierda para descartarla.`}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto px-4 py-3 sm:px-5">
          {draft.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Descartaste todos los movimientos.
            </p>
          )}

          {draft.map((row, i) => (
            <SwipeableRow
              key={row.key}
              row={row}
              conversion={converted[i]}
              categories={categories}
              accounts={accounts}
              paymentMethods={paymentMethods}
              onPatch={(f) => patch(row.key, f)}
              onDiscard={() => discard(row.key)}
            />
          ))}

          {discarded.length > 0 && (
            <button
              type="button"
              onClick={undoDiscard}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Recuperar el último descartado ({discarded.length}{" "}
              {discarded.length === 1 ? "descartado" : "descartados"})
            </button>
          )}
        </div>

        <div className="space-y-2 border-t border-border/50 px-4 py-3 sm:px-5">
          {blocked > 0 && (
            <p className="flex items-start gap-2 text-xs text-amber-500">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>
                {blocked === 1 ? "Un movimiento no se puede" : `${blocked} movimientos no se pueden`}{" "}
                convertir a dólares. Corregí la moneda o el monto — guardar el número en pesos
                dentro de la columna de dólares es justo lo que no queremos.
              </span>
            </p>
          )}
          <Button
            onClick={() => onConfirm(draft)}
            disabled={!canSave}
            className="w-full gap-2 font-semibold"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Guardando…
              </>
            ) : (
              <>
                Registrar {draft.length}{" "}
                {draft.length === 1 ? "movimiento" : "movimientos"} · US$ {money(total)}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */

function SwipeableRow({
  row,
  conversion,
  categories,
  accounts,
  paymentMethods,
  onPatch,
  onDiscard,
}: {
  row: ReviewRow;
  conversion: ReturnType<typeof resolveTransactionAmountUSD>;
  categories: Category[];
  accounts: FinancialAccount[];
  paymentMethods: PaymentMethod[];
  onPatch: (f: Partial<ReviewRow>) => void;
  onDiscard: () => void;
}) {
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const start = useRef<number | null>(null);
  const card = useRef<HTMLDivElement>(null);
  // El desplazamiento también en un ref: `setDx` no es inmediato, así que un flick rápido
  // —el `pointerup` en el mismo frame que el `move`— llegaba a soltar leyendo el 0 anterior
  // y la tarjeta volvía a su lugar en vez de descartarse.
  const dxRef = useRef(0);

  const catsForType = categories.filter((c) => c.type === row.type);

  const onPointerDown = (e: React.PointerEvent) => {
    // Arrastrar sobre un campo tiene que dejar seleccionar texto y mover el cursor, no barrer
    // la tarjeta. El gesto sólo agarra desde el cuerpo de la tarjeta.
    if ((e.target as HTMLElement).closest("input, select, button, [role='combobox']")) return;
    start.current = e.clientX;
    card.current?.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (start.current === null) return;
    // Sólo hacia la izquierda: hacia la derecha no hay ninguna acción que revelar.
    const next = Math.min(0, e.clientX - start.current);
    dxRef.current = next;
    setDx(next);
  };

  const end = () => {
    if (start.current === null) return;
    start.current = null;
    const travelled = dxRef.current;
    dxRef.current = 0;
    if (travelled <= -DISCARD_AT) {
      setLeaving(true);
      window.setTimeout(onDiscard, 160);
    } else {
      setDx(0);
    }
  };

  const armed = dx <= -DISCARD_AT;

  return (
    <div className="relative overflow-hidden rounded-xl">
      {/* Lo que el gesto revela por debajo */}
      <div
        className={`absolute inset-0 flex items-center justify-end rounded-xl pr-5 transition-colors ${
          armed ? "bg-destructive" : "bg-destructive/35"
        }`}
        aria-hidden="true"
      >
        <Trash2 className="h-5 w-5 text-destructive-foreground" />
      </div>

      <div
        ref={card}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={end}
        onPointerCancel={end}
        style={{
          transform: `translateX(${leaving ? -400 : dx}px)`,
          transition: start.current === null ? "transform .18s ease-out" : "none",
          touchAction: "pan-y",
        }}
        className="relative space-y-2 rounded-xl border border-border/60 bg-card p-3"
      >
        <div className="flex items-start gap-2">
          <Input
            value={row.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder="Nombre del movimiento"
            aria-label="Nombre del movimiento"
            className="h-8 flex-1 border-transparent bg-muted/40 px-2 text-sm font-medium focus-visible:border-border"
          />
          {/* El swipe no puede ser el único camino: con teclado o mouse, este botón. */}
          <button
            type="button"
            onClick={onDiscard}
            aria-label={`Descartar ${row.name || "movimiento"}`}
            className="mt-0.5 shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={row.type}
            onValueChange={(v) =>
              // Cambiar de gasto a ingreso deja la categoría anterior fuera de su tipo.
              onPatch({ type: v as ReviewRow["type"], categoryId: null })
            }
          >
            <SelectTrigger className="h-8 w-[104px] text-xs" aria-label="Tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Gasto</SelectItem>
              <SelectItem value="income">Ingreso</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={row.categoryId ?? "none"}
            onValueChange={(v) => onPatch({ categoryId: v === "none" ? null : v })}
          >
            <SelectTrigger className="h-8 min-w-[130px] flex-1 text-xs" aria-label="Categoría">
              <SelectValue placeholder="Sin categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin categoría</SelectItem>
              {catsForType.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={row.amount}
            onChange={(e) => onPatch({ amount: e.target.value })}
            aria-label="Monto"
            className="h-8 w-[112px] font-mono text-sm tabular-nums"
          />
          <Select value={row.currency} onValueChange={(v) => onPatch({ currency: v })}>
            <SelectTrigger className="h-8 w-[86px] text-xs" aria-label="Moneda">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="USD">USD</SelectItem>
              <SelectItem value="ARS">ARS</SelectItem>
              <SelectItem value="EUR">EUR</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={row.transactionDate}
            onChange={(e) => onPatch({ transactionDate: e.target.value })}
            aria-label="Fecha"
            className="h-8 w-[138px] font-mono text-xs"
          />
        </div>

        <div className="flex items-center justify-between gap-2 pt-0.5">
          <Select
            value={row.accountId ?? "none"}
            onValueChange={(v) =>
              onPatch({ accountId: v === "none" ? null : v, accountWasGuessed: false })
            }
          >
            <SelectTrigger
              className={`h-7 min-w-0 flex-1 text-[11px] ${
                row.accountWasGuessed ? "border-amber-500/60 text-amber-500" : ""
              }`}
              aria-label="Cuenta"
            >
              <SelectValue placeholder="Sin cuenta" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin cuenta</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <span className="shrink-0 font-mono text-xs tabular-nums">
            {conversion.status === "ok" ? (
              <span className="text-muted-foreground">
                US$ <span className="font-medium text-foreground">{money(conversion.amountUSD)}</span>
              </span>
            ) : (
              <span className="text-amber-500">sin cotización</span>
            )}
          </span>
        </div>

        {row.accountWasGuessed && (
          <p className="text-[11px] text-amber-500">
            No se reconoció la cuenta; quedó la primera de la lista. El saldo se mueve donde
            digas acá.
          </p>
        )}
        {row.suggestedCategory && (
          <p className="text-[11px] text-muted-foreground">
            Sugerencia del extractor: crear la categoría «{row.suggestedCategory}».
          </p>
        )}
      </div>
    </div>
  );
}
