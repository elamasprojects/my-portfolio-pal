import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, ReceiptText, ImageOff } from "lucide-react";
import { useTransactionItems, useReceiptUrl } from "@/hooks/useTransactionItems";
import type { ReceiptMeta, Transaction } from "@/types/finance";

/**
 * El ticket completo: que se compro, a que precio, y la foto de donde salio.
 *
 * Los renglones estan en la moneda del ticket y se muestran asi, sin pasar a dolares. Convertir
 * cada producto al MEP daria una columna de numeros que no figura en ningun papel y que nadie
 * puede verificar; el equivalente en USD es uno solo, el de la compra, y esta en el encabezado.
 */
export function TicketDetailDialog({
  transaction,
  open,
  onOpenChange,
}: {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [photoOpen, setPhotoOpen] = useState(false);
  const { data: items = [], isLoading } = useTransactionItems(open ? transaction?.id ?? null : null);
  const { data: photoUrl } = useReceiptUrl(open ? transaction?.receipt_url : null);

  const meta = (transaction?.extracted_fields as { receipt?: ReceiptMeta } | undefined)?.receipt;
  const currency = items[0]?.currency || transaction?.original_currency || "ARS";

  const sum = useMemo(
    () => items.reduce((acc, it) => acc + (Number(it.line_total) || 0), 0),
    [items],
  );

  if (!transaction) return null;

  const money = (n: number) =>
    n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[88vh] w-[calc(100%-1.5rem)] max-w-md flex-col gap-0 rounded-2xl border border-border/60 bg-card p-0">
          <DialogHeader className="space-y-1 border-b border-border/50 px-4 py-3">
            <DialogTitle className="flex items-center gap-2 font-serif text-base text-primary">
              <ReceiptText className="h-4 w-4 shrink-0" />
              <span className="min-w-0 truncate">{transaction.name}</span>
            </DialogTitle>
            <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-0.5 pl-6 text-xs">
              <span>{transaction.transaction_date}</span>
              <span className="font-mono tabular-nums">
                US$ {money(Number(transaction.amount_usd) || 0)}
              </span>
              {transaction.original_currency &&
                transaction.original_currency !== "USD" &&
                transaction.original_amount != null && (
                  <span className="font-mono tabular-nums text-muted-foreground">
                    · {transaction.original_currency} {money(Number(transaction.original_amount))}
                  </span>
                )}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando el detalle…
              </div>
            ) : items.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Este movimiento no tiene detalle de productos.
              </p>
            ) : (
              <ul className="space-y-1.5">
                {items.map((it) => (
                  <li
                    key={it.id}
                    className="flex items-baseline gap-2 border-b border-border/40 pb-1.5 last:border-0 text-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-foreground">{it.description}</p>
                      {/* Lo que decia el papel, por si la normalizacion leyo cualquier cosa. */}
                      {it.raw_description && it.raw_description !== it.description && (
                        <p className="truncate font-mono text-[10px] text-muted-foreground">
                          {it.raw_description}
                        </p>
                      )}
                    </div>
                    {it.quantity != null && (
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                        {Number(it.quantity)}
                        {it.unit ? ` ${it.unit}` : "×"}
                        {it.unit_price != null && (
                          <> {money(Number(it.unit_price))}</>
                        )}
                      </span>
                    )}
                    <span className="shrink-0 font-mono text-sm tabular-nums">
                      {money(Number(it.line_total) || 0)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1 border-t border-border/50 px-4 py-2.5 text-xs">
            {items.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  Suma de {items.length} {items.length === 1 ? "producto" : "productos"}
                </span>
                <span className="font-mono tabular-nums">
                  {currency} {money(sum)}
                </span>
              </div>
            )}
            {meta?.discounts_total ? (
              <div className="flex items-center justify-between text-emerald-500">
                <span>Descuentos del ticket</span>
                <span className="font-mono tabular-nums">−{money(meta.discounts_total)}</span>
              </div>
            ) : null}
            {meta?.printed_total ? (
              <div className="flex items-center justify-between font-semibold">
                <span>Total impreso</span>
                <span className="font-mono tabular-nums">{money(meta.printed_total)}</span>
              </div>
            ) : null}
            {meta?.is_truncated && (
              <p className="text-amber-500">
                La foto cortaba antes del TOTAL: lo cargado es la suma de lo que se veía.
              </p>
            )}

            {transaction.receipt_url ? (
              <button
                type="button"
                onClick={() => setPhotoOpen(true)}
                className="mt-1 w-full rounded-lg border border-border/60 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
              >
                Ver la foto del ticket
              </button>
            ) : (
              <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
                <ImageOff className="h-3 w-3" /> Sin foto adjunta
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* La foto en su propio dialogo: dentro del anterior competia con la lista por el alto. */}
      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg rounded-2xl border border-border/60 bg-card p-3">
          <DialogHeader className="sr-only">
            <DialogTitle>Foto del ticket de {transaction.name}</DialogTitle>
            <DialogDescription>Comprobante original de la compra</DialogDescription>
          </DialogHeader>
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={`Ticket de ${transaction.name}`}
              className="max-h-[78vh] w-full rounded-lg object-contain"
            />
          ) : (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Abriendo el comprobante…
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
