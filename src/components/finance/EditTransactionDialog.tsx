import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTransactions, useCategories, usePaymentMethods } from "@/hooks/useFinance";
import { Transaction } from "@/types/finance";
import { Landmark, Loader2 } from "lucide-react";

/** Sentinela para "sin categoría": Radix Select no acepta un value vacío. */
const NONE = "__none__";

interface EditTransactionDialogProps {
  transaction: Transaction | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Edición manual de un movimiento — el monto incluido.
 *
 * El monto es editable a propósito y es el motivo por el que este diálogo
 * existe: cuando pagás 200 por varias personas y te devuelven 190, tu gasto
 * real es 10, y lo que cobró el banco no es el número que querés en tus
 * finanzas. Para las filas importadas se muestra el monto que cobró Mercury
 * como referencia de solo lectura, así corregir el tuyo no borra el dato de
 * cuánto salió de la cuenta.
 */
export function EditTransactionDialog({
  transaction,
  open,
  onOpenChange,
}: EditTransactionDialogProps) {
  const { updateTransaction } = useTransactions();
  const { categories } = useCategories();
  const { paymentMethods } = usePaymentMethods();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [categoryId, setCategoryId] = useState<string>(NONE);
  const [paymentMethodId, setPaymentMethodId] = useState<string>(NONE);
  const [notes, setNotes] = useState("");

  // Re-sembrar cada vez que cambia la fila: el diálogo se monta una sola vez y
  // se reusa para todas, así que sin esto la segunda edición abriría con los
  // valores de la primera.
  useEffect(() => {
    if (!transaction) return;
    setName(transaction.name ?? "");
    setAmount(String(transaction.amount_usd ?? ""));
    setDate(transaction.transaction_date ?? "");
    setCategoryId(transaction.category_id ?? NONE);
    setPaymentMethodId(transaction.payment_method_id ?? NONE);
    setNotes(transaction.notes ?? "");
  }, [transaction]);

  if (!transaction) return null;

  const bankAmount = (transaction.extracted_fields as Record<string, unknown> | undefined)
    ?.mercury_amount;
  const bankCharged = typeof bankAmount === "number" ? Math.abs(bankAmount) : null;

  const parsedAmount = Number(amount);
  const amountIsValid = amount.trim() !== "" && Number.isFinite(parsedAmount) && parsedAmount > 0;
  const canSave = amountIsValid && name.trim() !== "" && date !== "";

  const handleSave = async () => {
    if (!canSave) return;
    await updateTransaction.mutateAsync({
      id: transaction.id,
      updates: {
        name: name.trim(),
        amount_usd: parsedAmount,
        transaction_date: date,
        category_id: categoryId === NONE ? null : categoryId,
        payment_method_id: paymentMethodId === NONE ? null : paymentMethodId,
        notes: notes.trim() || null,
        // Tocarla a mano es exactamente la señal de que ya no hay nada que
        // revisar: el usuario acaba de decidir.
        needs_review: false,
        confidence: "high",
      },
    });
    onOpenChange(false);
  };

  const relevantCategories = categories.filter(
    (c) => c.type === transaction.type || c.type === "both",
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-2rem)] sm:w-full sm:max-w-lg max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Editar movimiento</DialogTitle>
          <DialogDescription>
            Ajustá el monto a lo que gastaste de verdad. Si pagaste por otra persona y te
            devolvieron la diferencia, va acá el neto tuyo.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="edit-tx-amount">Monto (USD)</Label>
            <Input
              id="edit-tx-amount"
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono text-lg"
              autoFocus
            />
            {bankCharged !== null && (
              <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                <Landmark className="h-3 w-3 shrink-0" />
                Mercury cobró USD {bankCharged.toFixed(2)}
                {Math.abs(bankCharged - parsedAmount) > 0.005 && amountIsValid && (
                  <span className="text-amber-500">
                    · diferencia USD {(bankCharged - parsedAmount).toFixed(2)}
                  </span>
                )}
              </p>
            )}
            {!amountIsValid && amount.trim() !== "" && (
              <p className="text-[11px] text-rose-500">Tiene que ser un número mayor a 0.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-tx-name">Nombre</Label>
            <Input
              id="edit-tx-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-tx-date">Fecha</Label>
              <Input
                id="edit-tx-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Categoría</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Sin categoría</SelectItem>
                  {relevantCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Medio de pago</Label>
            <Select value={paymentMethodId} onValueChange={setPaymentMethodId}>
              <SelectTrigger>
                <SelectValue placeholder="Sin medio de pago" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin medio de pago</SelectItem>
                {paymentMethods.map((pm) => (
                  <SelectItem key={pm.id} value={pm.id}>
                    {pm.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-tx-notes">Notas</Label>
            <Textarea
              id="edit-tx-notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: pagué por 4 personas, me transfirieron 190"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!canSave || updateTransaction.isPending}>
            {updateTransaction.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
