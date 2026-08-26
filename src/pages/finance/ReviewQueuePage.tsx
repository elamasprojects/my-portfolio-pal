import { useState } from "react";
import { useTransactions, useCategories, usePaymentMethods } from "@/hooks/useFinance";
import { useProfile } from "@/hooks/useProfile";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { makeFormatters } from "@/lib/format";
import { Transaction } from "@/types/finance";
import { Button } from "@/components/ui/button";
import {
  Check,
  Pencil,
  Copy,
  Trash2,
  Sparkles,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Tag,
  CreditCard,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { EditTransactionDialog } from "@/components/finance/EditTransactionDialog";

export default function ReviewQueuePage() {
  const { reviewQueue, updateTransaction, softDeleteTransaction, isLoading } = useTransactions();
  const [editing, setEditing] = useState<Transaction | null>(null);
  const { categories, addCategory } = useCategories();
  const { paymentMethods } = usePaymentMethods();

  const { profile } = useProfile();
  const { mepRate } = useDolarMEP();
  const displayCurrency = profile?.default_currency === "ARS" ? "ARS" : "USD";
  const { cx, currencySymbol } = makeFormatters(displayCurrency, mepRate);

  const handleApprove = async (tx: Transaction) => {
    await updateTransaction.mutateAsync({
      id: tx.id,
      updates: { needs_review: false },
    });
    toast.success(`Aprobado: ${tx.name}`);
  };

  const handleUpdateCategory = async (tx: Transaction, catId: string) => {
    await updateTransaction.mutateAsync({
      id: tx.id,
      updates: { category_id: catId, needs_review: false },
    });
    toast.success("Categoría actualizada");
  };

  const handleCreateSuggestedCategory = async (tx: Transaction, suggestedName: string) => {
    try {
      const newCat = await addCategory.mutateAsync({
        name: suggestedName,
        type: tx.type === "income" ? "income" : "expense",
        color: "#3b82f6",
        icon: "Tag",
        keywords: [tx.name.toLowerCase()],
      });
      await updateTransaction.mutateAsync({
        id: tx.id,
        updates: { category_id: newCat.id, needs_review: false },
      });
      toast.success(`Categoría '${suggestedName}' creada y asignada`);
    } catch {
      toast.error("Error al crear categoría sugerida");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-foreground">
          Cola de Revisión ({reviewQueue.length})
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Movimientos capturados automáticamente que requieren confirmación de categoría o medio de pago.
        </p>
      </div>

      {/* Review Cards */}
      {reviewQueue.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground space-y-2">
          <ShieldCheck className="h-10 w-10 text-emerald-500 mx-auto" />
          <h3 className="font-semibold text-base text-foreground">¡Todo al día!</h3>
          <p className="text-xs">No hay transacciones pendientes de revisión.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reviewQueue.map((tx) => {
            // Extract suggested category from notes if any
            const suggestedMatch = tx.notes?.match(/Sugerencia: Crear categoría '([^']+)'/);
            const suggestedCatName = suggestedMatch?.[1];

            const isPossibleDuplicate = Boolean(
              (tx.extracted_fields as Record<string, unknown> | undefined)?.possible_duplicate_of,
            );

            return (
              <div
                key={tx.id}
                className="p-4 sm:p-5 rounded-2xl border bg-card shadow-sm space-y-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-foreground">{tx.name}</h3>
                      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                        {tx.confidence} confidence
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">
                      {tx.transaction_date} · {tx.payment_method?.name || "Sin medio"} · Fuente: {tx.source}
                    </p>
                  </div>

                  <div className="text-right font-mono">
                    <p className="text-lg font-black text-rose-500">
                      {currencySymbol}
                      {cx(Number(tx.amount_usd) || 0).toFixed(2)}
                    </p>
                    {tx.original_currency && tx.original_currency !== "USD" && (
                      <p className="text-[11px] text-muted-foreground">
                        {tx.original_currency} {tx.original_amount?.toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {/* Aviso de posible duplicado contra una carga manual. Se importa
                    igual y se avisa: descartarlo solo perderia el gasto cuando el
                    parecido es casualidad. */}
                {isPossibleDuplicate && (
                  <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 p-2.5 text-xs">
                    <div className="flex items-center gap-2 text-amber-500 font-semibold">
                      <Copy className="h-4 w-4 shrink-0" />
                      <span>Posible duplicado de una carga manual</span>
                    </div>
                    {tx.notes && (
                      <p className="text-muted-foreground mt-1 leading-relaxed">{tx.notes}</p>
                    )}
                  </div>
                )}

                {/* 1-Tap Category Suggestion Banner */}
                {suggestedCatName && (
                  <div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 p-2.5 text-xs">
                    <div className="flex items-center gap-2 text-primary font-medium">
                      <Sparkles className="h-4 w-4" />
                      <span>Sugerencia IA: Crear nueva categoría '{suggestedCatName}'</span>
                    </div>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-primary text-primary-foreground font-semibold gap-1"
                      onClick={() => handleCreateSuggestedCategory(tx, suggestedCatName)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Crear en 1 tap</span>
                    </Button>
                  </div>
                )}

                {/* Quick Category Selector Pills */}
                <div>
                  <span className="text-[11px] text-muted-foreground block font-medium mb-1">
                    Seleccionar o confirmar categoría:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {categories.slice(0, 8).map((cat) => {
                      const isSelected = tx.category_id === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => handleUpdateCategory(tx, cat.id)}
                          className={`rounded-full px-2.5 py-1 text-xs font-mono font-medium transition-all ${
                            isSelected
                              ? "bg-primary text-primary-foreground font-bold ring-2 ring-primary/40"
                              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                          }`}
                        >
                          {cat.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center justify-end gap-2 border-t border-border/40 pt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-destructive hover:bg-destructive/10 gap-1"
                    onClick={() => softDeleteTransaction.mutate(tx.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Descartar</span>
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs hover:bg-primary/10 hover:text-primary gap-1"
                    onClick={() => setEditing(tx)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Editar</span>
                  </Button>

                  <Button
                    size="sm"
                    className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1"
                    onClick={() => handleApprove(tx)}
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Confirmar</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <EditTransactionDialog
        transaction={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  );
}
