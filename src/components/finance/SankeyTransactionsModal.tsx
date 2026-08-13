import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Transaction } from "@/types/finance";
import {
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Calendar,
  AlertCircle,
  Building,
  Receipt,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  Clock,
  Check,
} from "lucide-react";

type SortOption = "expensive" | "cheap" | "newest" | "oldest";

interface SankeyTransactionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  segmentTitle: string;
  segmentType: "income" | "expense" | "net" | "spine";
  segmentColor?: string;
  segmentTotalUSD: number;
  segmentPct?: number;
  transactions: Transaction[];
  displayCurrency: "USD" | "ARS";
  currencySymbol: string;
  cx: (val: number) => number;
}

export function SankeyTransactionsModal({
  open,
  onOpenChange,
  segmentTitle,
  segmentType,
  segmentColor = "#10b981",
  segmentTotalUSD,
  segmentPct,
  transactions,
  displayCurrency,
  currencySymbol,
  cx,
}: SankeyTransactionsModalProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("expensive");

  const filteredAndSortedTransactions = useMemo(() => {
    let result = [...transactions];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter((t) => {
        const matchName = (t.name || "").toLowerCase().includes(q);
        const matchRaw = (t.raw_merchant || "").toLowerCase().includes(q);
        const matchNotes = (t.notes || "").toLowerCase().includes(q);
        const matchAccount = (t.account?.name || t.payment_method?.name || "").toLowerCase().includes(q);
        const matchCategory = (t.category?.name || "").toLowerCase().includes(q);
        const matchAmount = (t.amount_usd || 0).toString().includes(q);
        return matchName || matchRaw || matchNotes || matchAccount || matchCategory || matchAmount;
      });
    }

    result.sort((a, b) => {
      const amtA = Number(a.amount_usd) || 0;
      const amtB = Number(b.amount_usd) || 0;
      if (sortBy === "expensive") return amtB - amtA;
      if (sortBy === "cheap") return amtA - amtB;
      if (sortBy === "oldest") return a.transaction_date.localeCompare(b.transaction_date);
      // default: newest
      return b.transaction_date.localeCompare(a.transaction_date);
    });

    return result;
  }, [transactions, searchQuery, sortBy]);

  const totalFilteredUSD = useMemo(() => {
    return filteredAndSortedTransactions.reduce((acc, t) => acc + (Number(t.amount_usd) || 0), 0);
  }, [filteredAndSortedTransactions]);

  const isIncome = segmentType === "income";
  const isNet = segmentType === "net";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 bg-card border border-border/60 shadow-2xl overflow-hidden rounded-2xl">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-border/40 bg-muted/20 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-md shrink-0"
                style={{ backgroundColor: segmentColor }}
              >
                {isIncome ? (
                  <ArrowUpRight className="h-5 w-5" />
                ) : isNet ? (
                  <Sparkles className="h-5 w-5" />
                ) : (
                  <ArrowDownRight className="h-5 w-5" />
                )}
              </div>
              <div>
                <DialogTitle className="font-serif text-xl sm:text-2xl text-foreground font-bold tracking-tight">
                  {segmentTitle}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
                  <span className="capitalize font-medium">
                    {segmentType === "income"
                      ? "Fuente de Ingreso"
                      : segmentType === "expense"
                      ? "Categoría de Gasto"
                      : segmentType === "net"
                      ? "Resultado Neto Ahorro / Inversión"
                      : "Flujo Total Recaudado"}
                  </span>
                  {segmentPct !== undefined && (
                    <>
                      <span>·</span>
                      <span className="font-mono text-primary font-semibold">
                        {segmentPct}% del total
                      </span>
                    </>
                  )}
                </DialogDescription>
              </div>
            </div>

            {/* Total KPI Card */}
            <div className="text-right">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-mono block">
                Total Segmento
              </span>
              <p
                className="text-xl sm:text-2xl font-black font-mono tracking-tight"
                style={{ color: segmentColor }}
              >
                {currencySymbol}
                {cx(segmentTotalUSD).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            </div>
          </div>

          {/* Quick Search & Count Filter */}
          <div className="flex items-center gap-3 pt-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por concepto, comercio o monto..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 pl-8 font-mono text-xs bg-background/80"
              />
            </div>
            <span className="text-[11px] font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-md border shrink-0">
              {filteredAndSortedTransactions.length}{" "}
              {filteredAndSortedTransactions.length === 1 ? "movimiento" : "movimientos"}
            </span>
          </div>

          {/* Sort Buttons Toolbar */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[11px] font-mono text-muted-foreground mr-1">Ordenar por:</span>
            
            <Button
              type="button"
              variant={sortBy === "expensive" ? "default" : "outline"}
              size="sm"
              className={`h-7 text-xs rounded-full px-3 font-medium gap-1.5 shadow-sm transition-all ${
                sortBy === "expensive" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setSortBy("expensive")}
            >
              <ArrowDownWideNarrow className="h-3.5 w-3.5" />
              <span>💰 Más caros</span>
              {sortBy === "expensive" && <Check className="h-3 w-3 ml-0.5" />}
            </Button>

            <Button
              type="button"
              variant={sortBy === "cheap" ? "default" : "outline"}
              size="sm"
              className={`h-7 text-xs rounded-full px-3 font-medium gap-1.5 shadow-sm transition-all ${
                sortBy === "cheap" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setSortBy("cheap")}
            >
              <ArrowUpNarrowWide className="h-3.5 w-3.5" />
              <span>🪙 Más baratos</span>
              {sortBy === "cheap" && <Check className="h-3 w-3 ml-0.5" />}
            </Button>

            <Button
              type="button"
              variant={sortBy === "newest" ? "default" : "outline"}
              size="sm"
              className={`h-7 text-xs rounded-full px-3 font-medium gap-1.5 shadow-sm transition-all ${
                sortBy === "newest" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setSortBy("newest")}
            >
              <Calendar className="h-3.5 w-3.5" />
              <span>📅 Más recientes</span>
              {sortBy === "newest" && <Check className="h-3 w-3 ml-0.5" />}
            </Button>

            <Button
              type="button"
              variant={sortBy === "oldest" ? "default" : "outline"}
              size="sm"
              className={`h-7 text-xs rounded-full px-3 font-medium gap-1.5 shadow-sm transition-all ${
                sortBy === "oldest" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setSortBy("oldest")}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>⏳ Más antiguos</span>
              {sortBy === "oldest" && <Check className="h-3 w-3 ml-0.5" />}
            </Button>
          </div>
        </div>

        {/* Transactions List Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-2.5 divide-y divide-border/20">
          {filteredAndSortedTransactions.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground space-y-1.5">
              <Receipt className="h-8 w-8 mx-auto text-muted-foreground/50" />
              <p className="text-sm font-medium">No se encontraron transacciones</p>
              <p className="text-xs text-muted-foreground/75">
                Prueba buscando con otro término o cambia el criterio de ordenamiento.
              </p>
            </div>
          ) : (
            filteredAndSortedTransactions.map((tx) => {
              const txAmount = Number(tx.amount_usd) || 0;
              const accountName = tx.account?.name || tx.payment_method?.name || "Cuenta";
              const isTxIncome = tx.type === "income";

              return (
                <div
                  key={tx.id}
                  className="pt-2.5 first:pt-0 flex items-center justify-between gap-3 group hover:bg-muted/15 p-2 rounded-xl transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm truncate text-foreground">
                        {tx.name}
                      </span>
                      {tx.needs_review && (
                        <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.2 text-[9px] font-bold text-amber-500 shrink-0">
                          <AlertCircle className="h-2.5 w-2.5" />
                          Revisar
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground font-mono mt-0.5">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-muted-foreground/70" />
                        {tx.transaction_date}
                      </span>
                      <span>·</span>
                      <span className="text-foreground/90 font-medium flex items-center gap-1">
                        <Building className="h-3 w-3 text-emerald-400" />
                        {accountName}
                      </span>
                      {tx.category?.name && (
                        <>
                          <span>·</span>
                          <span className="text-primary/90">{tx.category.name}</span>
                        </>
                      )}
                      {tx.notes && (
                        <>
                          <span>·</span>
                          <span className="text-muted-foreground/75 truncate max-w-[200px]">
                            {tx.notes}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`font-mono font-bold text-sm sm:text-base ${
                        isTxIncome ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {isTxIncome ? "+" : "-"}
                      {currencySymbol}
                      {cx(txAmount).toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </p>
                    {tx.original_currency && tx.original_currency !== "USD" && (
                      <p className="text-[10px] font-mono text-muted-foreground/70">
                        {tx.original_currency} {Number(tx.original_amount || 0).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-border/40 bg-muted/10 flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span>
            Mostrando {filteredAndSortedTransactions.length} transacciones (Orden:{" "}
            {sortBy === "expensive"
              ? "Más caros"
              : sortBy === "cheap"
              ? "Más baratos"
              : sortBy === "newest"
              ? "Más recientes"
              : "Más antiguos"}
            )
          </span>
          <span className="font-bold text-foreground">
            Suma: {currencySymbol}
            {cx(totalFilteredUSD).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
