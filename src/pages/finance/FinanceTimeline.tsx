import { useState, useMemo } from "react";
import { useTransactions, useCategories, usePaymentMethods } from "@/hooks/useFinance";
import { useProfile } from "@/hooks/useProfile";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { makeFormatters } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  Pencil,
  Trash2,
  Filter,
  ArrowDownRight,
  ArrowUpRight,
  TrendingDown,
  Calendar,
  CreditCard,
  Tag,
  AlertCircle,
} from "lucide-react";
import { OmnibarFinance } from "@/components/finance/OmnibarFinance";
import { EditTransactionDialog } from "@/components/finance/EditTransactionDialog";
import { Transaction } from "@/types/finance";

export default function FinanceTimeline() {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [omnibarOpen, setOmnibarOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const { transactions, isLoading, softDeleteTransaction } = useTransactions();
  const { categories } = useCategories();
  const { paymentMethods } = usePaymentMethods();

  const { profile } = useProfile();
  const { mepRate } = useDolarMEP();
  const displayCurrency = profile?.default_currency === "ARS" ? "ARS" : "USD";
  const { cx, fmtUSD, currencySymbol } = makeFormatters(displayCurrency, mepRate);

  const filtered = useMemo(() => {
    return transactions.filter((t) => {
      if (t.deleted_at) return false;
      if (selectedType !== "all" && t.type !== selectedType) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = t.name ? t.name.toLowerCase().includes(q) : false;
        const matchMerchant = t.raw_merchant ? t.raw_merchant.toLowerCase().includes(q) : false;
        const matchNotes = t.notes ? t.notes.toLowerCase().includes(q) : false;
        const matchCat = t.category?.name ? t.category.name.toLowerCase().includes(q) : false;
        const matchPm = t.payment_method?.name ? t.payment_method.name.toLowerCase().includes(q) : false;
        if (!matchName && !matchMerchant && !matchNotes && !matchCat && !matchPm) return false;
      }
      return true;
    });
  }, [transactions, selectedType, search]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-foreground">
            Timeline de Movimientos
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Registro cronológico de todos tus gastos, ingresos y transferencias personales.
          </p>
        </div>

        <Button
          onClick={() => setOmnibarOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
          size="sm"
        >
          <span>+ Nuevo Movimiento</span>
        </Button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por comercio, categoría o medio de pago..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 font-mono text-xs sm:text-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {["all", "expense", "income", "investment"].map((type) => (
            <Button
              key={type}
              variant={selectedType === type ? "default" : "outline"}
              size="sm"
              className="h-9 text-xs capitalize font-medium rounded-full"
              onClick={() => setSelectedType(type)}
            >
              {type === "all" ? "Todos" : type === "expense" ? "Gastos" : type === "income" ? "Ingresos" : "Inversiones"}
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground">Cargando transacciones...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed p-12 text-center text-muted-foreground text-sm">
            No se encontraron movimientos registrados
          </div>
        ) : (
          filtered.map((tx) => {
            const isIncome = tx.type === "income";
            const isInvestment = tx.type === "investment";
            const amtUSD = Number(tx.amount_usd) || 0;

            return (
              <div
                key={tx.id}
                className="flex items-center justify-between p-3.5 sm:p-4 rounded-xl border bg-card hover:bg-accent/15 transition-colors group shadow-sm"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                      isIncome
                        ? "bg-emerald-500/10 text-emerald-500"
                        : isInvestment
                        ? "bg-purple-500/10 text-purple-400"
                        : "bg-rose-500/10 text-rose-500"
                    }`}
                  >
                    {isIncome ? (
                      <ArrowUpRight className="h-5 w-5" />
                    ) : isInvestment ? (
                      <Tag className="h-5 w-5" />
                    ) : (
                      <ArrowDownRight className="h-5 w-5" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate text-foreground">
                        {tx.name}
                      </span>
                      {tx.needs_review && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                          <AlertCircle className="h-3 w-3" />
                          Revisar
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground font-mono mt-0.5">
                      <span>{tx.transaction_date}</span>
                      <span>·</span>
                      <span className="text-primary/80">{tx.category?.name || "Sin categoría"}</span>
                      <span>·</span>
                      <span className="text-foreground/90 font-medium">🏦 {tx.account?.name || tx.payment_method?.name || "Cuenta"}</span>
                      {tx.original_currency && tx.original_currency !== "USD" && (
                        <>
                          <span>·</span>
                          <span className="text-muted-foreground/70">
                            {tx.original_currency} {tx.original_amount?.toLocaleString()}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right font-mono">
                    <p
                      className={`text-sm sm:text-base font-bold ${
                        isIncome ? "text-emerald-500" : isInvestment ? "text-purple-400" : "text-rose-500"
                      }`}
                    >
                      {isIncome ? "+" : "-"}
                      {currencySymbol}
                      {cx(amtUSD).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-sans capitalize">{tx.source}</p>
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-primary hover:bg-primary/10"
                    onClick={() => setEditing(tx)}
                    title="Editar movimiento"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive hover:bg-destructive/10"
                    onClick={() => softDeleteTransaction.mutate(tx.id)}
                    title="Eliminar movimiento"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <OmnibarFinance open={omnibarOpen} onOpenChange={setOmnibarOpen} />

      <EditTransactionDialog
        transaction={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  );
}
