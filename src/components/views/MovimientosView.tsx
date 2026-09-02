import { useState, useMemo, useRef, useEffect } from "react";
import { useTransactions, useCategories, useFinancialAccounts, usePaymentMethods } from "@/hooks/useFinance";
import { useTrades } from "@/hooks/usePortfolio";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { resolveTransactionAmountUSD } from "@/lib/fxConversion";
import { supabase } from "@/integrations/supabase/client";
import { normalizeToUnifiedEvents, UnifiedEventItem, UnifiedEventType } from "@/lib/unifiedEvents";
import { EditTransactionDialog } from "@/components/finance/EditTransactionDialog";
import { Transaction } from "@/types/finance";
import { AudioQuickRecorder } from "@/components/finance/AudioQuickRecorder";
import { AddTradeDialog } from "@/components/trades/AddTradeDialog";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useIngest } from "@/hooks/useIngest";
import { parseTransactionLocalDate } from "@/lib/financialMath";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChessBadge } from "@/components/ui/ChessBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { motion, AnimatePresence } from "motion/react";
import {
  Search,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  ClipboardPaste,
  Upload,
  Trash2,
  Pencil,
  Copy,
  Download,
  ArrowUpDown,
  Check,
  RotateCcw,
  Sparkles,
  Plus,
} from "lucide-react";

const PAGE_SIZE = 50;

type DateWindow = "30d" | "90d" | "365d" | "all";

const DATE_WINDOWS: { value: DateWindow; label: string; days: number | null }[] = [
  { value: "30d", label: "Últimos 30 días", days: 30 },
  { value: "90d", label: "Últimos 3 meses", days: 90 },
  { value: "365d", label: "Último año", days: 365 },
  { value: "all", label: "Todo el historial", days: null },
];

export function MovimientosView() {
  const { openPicker } = useIngest();
  // Data hooks
  const { transactions, reviewQueue, updateTransaction, softDeleteTransaction, addTransaction, isLoading: txLoading } = useTransactions();
  const { categories } = useCategories();
  const { accounts = [] } = useFinancialAccounts();
  const { paymentMethods } = usePaymentMethods();
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  // useDolarMEP exposes the rate as `venta`; destructuring `mepRate` yielded undefined, so
  // an ARS amount skipped conversion and was stored as if it were dollars.
  const { venta: mepRate = 0 } = useDolarMEP();

  // Categories Map
  const categoriesMap = useMemo(() => {
    const map = new Map();
    for (const c of categories) map.set(c.id, c);
    return map;
  }, [categories]);

  // Unified Event Stream
  const unifiedEvents = useMemo(() => {
    return normalizeToUnifiedEvents(transactions, trades, categoriesMap);
  }, [transactions, trades, categoriesMap]);

  const reviewQueueCount = reviewQueue.length;

  // Filtros y selección del feed.
  const [filterReviewOnly, setFilterReviewOnly] = useState(false);
  // 554 movimientos y 214 operaciones entran al mismo feed y se dibujaban todos, siempre.
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // El historial completo casi nunca es lo que uno viene a mirar.
  const [dateWindow, setDateWindow] = useState<DateWindow>("30d");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Transaction | null>(null);

  /*
    Acá vivían el estado y los manejadores de la captura propia de esta vista —texto,
    portapapeles, archivo, presets—. Al pasar a una sola entrada quedaron sin nadie que los
    llamara, y eso es peor que código de más: era un camino de escritura que iba derecho a la
    base salteándose la revisión que ahora decide qué se guarda.
  */

  // Inline Approval
  const handleApproveTransaction = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // Aprobar ES la resolución del posible duplicado, así que la marca se va
      // con ella. Si sólo se limpiara `needs_review`, el chip ámbar quedaría en
      // la fila para siempre: nada más en la app lo saca.
      const existing = transactions.find((t) => t.id === id)?.extracted_fields as
        | Record<string, unknown>
        | null
        | undefined;
      const updates: Record<string, unknown> = { needs_review: false };
      if (existing?.possible_duplicate_of) {
        const { possible_duplicate_of: _dropped, ...kept } = existing;
        updates.extracted_fields = kept;
      }

      await updateTransaction.mutateAsync({ id, updates });
      toast.success("✓ Movimiento aprobado");
    } catch (err: any) {
      toast.error("Error al aprobar movimiento");
    }
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    // Con "Pendientes" activo la ventana no aplica: el badge cuenta toda la cola, y un
    // movimiento de hace dos meses esperando aprobación tiene que poder aprobarse.
    const days = filterReviewOnly
      ? null
      : DATE_WINDOWS.find((w) => w.value === dateWindow)?.days ?? null;
    const floor = days === null ? null : Date.now() - days * 86400000;
    return unifiedEvents.filter((item) => {
      if (floor !== null) {
        const t = parseTransactionLocalDate(item.date).getTime();
        // Una fecha ilegible no se esconde: se muestra para que se vea que está mal.
        if (Number.isFinite(t) && t < floor) return false;
      }
      if (filterReviewOnly && !item.needsReview) return false;
      if (selectedTypeFilter !== "all" && item.type !== selectedTypeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = item.title.toLowerCase().includes(q);
        const matchesSubtitle = item.subtitle?.toLowerCase().includes(q) || false;
        const matchesSymbol = item.symbol?.toLowerCase().includes(q) || false;
        if (!matchesTitle && !matchesSubtitle && !matchesSymbol) return false;
      }
      return true;
    });
  }, [unifiedEvents, filterReviewOnly, selectedTypeFilter, searchQuery, dateWindow]);

  // Bulk Actions

  const toggleSelectId = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleBulkApprove = async () => {
    for (const id of selectedIds) {
      if (id.startsWith("tx_")) {
        const rawId = id.replace("tx_", "");
        await updateTransaction.mutateAsync({ id: rawId, updates: { needs_review: false } });
      }
    }
    toast.success(`✓ ${selectedIds.size} movimientos aprobados`);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    for (const id of selectedIds) {
      if (id.startsWith("tx_")) {
        const rawId = id.replace("tx_", "");
        await softDeleteTransaction.mutateAsync(rawId);
      }
    }
    toast.success(`✓ ${selectedIds.size} movimientos eliminados`);
    setSelectedIds(new Set());
  };

  // Format date as Day/Month (DD/MM)
  const formatDayMonth = (dateStr: string) => {
    if (!dateStr) return "—";
    const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const [, , mm, dd] = match;
      return `${dd}/${mm}`;
    }
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      return `${day}/${month}`;
    } catch {
      return dateStr;
    }
  };

  // Cambiar un filtro devuelve a la primera página: seguir en la 4 de otra lista no significa nada.
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    // Y se suelta la selección: lo marcado en otra lista no es lo que está en pantalla.
    setSelectedIds(new Set());
  }, [filterReviewOnly, selectedTypeFilter, searchQuery, dateWindow]);

  const visibleEvents = filteredEvents.slice(0, visibleCount);

  /**
   * Sólo lo que está en pantalla. Abarcar `filteredEvents` marcaba las 554 filas que la
   * paginación todavía no dibujó, y el botón de al lado las borra.
   */
  const toggleSelectAll = () => {
    if (selectedIds.size === visibleEvents.length && visibleEvents.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleEvents.map((e) => e.id)));
    }
  };

  return (
    <div className="space-y-6 pb-24">
      {/*
        Una sola puerta. Esta vista tenía seis accesos a lo mismo —campo de texto, Pegar, Subir
        Captura, presets, el botón Operación del feed y el + de la barra—, todos hacia dos
        destinos. El + de la barra ya pregunta qué se registra y hace de entrada única; acá queda
        el atajo, que abre ese mismo flujo.
      */}
      <button
        type="button"
        onClick={openPicker}
        className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-border/70 bg-card/60 p-3.5 text-left transition-colors hover:border-primary/60 hover:bg-card focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Plus className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">Registrar algo</span>
          <span className="block truncate text-xs text-muted-foreground">
            Un gasto, un ingreso o una operación — con comprobante o escrito
          </span>
        </span>
      </button>

      {/* 2. FEED TABLE CONTROLS & REVIEW QUEUE BADGE */}
      <Card className="bg-card border border-border/80">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[180px] flex-1 sm:flex-initial">
                <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-8 bg-background/80"
                />
              </div>

              <Select value={dateWindow} onValueChange={(v) => setDateWindow(v as DateWindow)}>
                <SelectTrigger className="h-8 w-[150px] text-xs bg-background/80">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATE_WINDOWS.map((w) => (
                    <SelectItem key={w.value} value={w.value}>
                      {w.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
                <SelectTrigger className="w-[140px] text-xs h-8 bg-background/80">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="expense">Gastos</SelectItem>
                  <SelectItem value="income">Ingresos</SelectItem>
                  <SelectItem value="buy">Compras</SelectItem>
                  <SelectItem value="sell">Ventas</SelectItem>
                  <SelectItem value="dividend">Dividendos</SelectItem>
                </SelectContent>
              </Select>

              {reviewQueueCount > 0 && (
                <Button
                  variant={filterReviewOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterReviewOnly(!filterReviewOnly)}
                  className="rounded-full h-8 px-3 bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold"
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1 text-amber-400" />
                  Pendientes ({reviewQueueCount})
                </Button>
              )}
            </div>

            {/* Bulk actions */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 bg-muted/80 p-1 rounded-md border border-border/60">
                <span className="text-xs text-muted-foreground font-medium px-2">{selectedIds.size} elegidos</span>
                <Button variant="ghost" size="sm" onClick={handleBulkApprove} className="h-7 text-xs text-gain">
                  <Check className="h-3.5 w-3.5 mr-1" />
                  Aprobar
                </Button>
                <Button variant="ghost" size="sm" onClick={handleBulkDelete} className="h-7 text-xs text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  Borrar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 3. UNIFIED EVENT FEED TABLE */}
      <Card className="bg-card border border-border/80">
        <CardHeader className="pb-2 flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base font-semibold">Feed Unificado de Eventos ({filteredEvents.length})</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {txLoading || tradesLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Cargando historial...</div>
          ) : (
            <>
            {/*
              Abajo de md la tabla medía 756 px dentro de una caja de 308: los importes existían
              pero caían fuera del recorte, así que había que barrer de costado para ver cuánto
              fue cada movimiento. La tabla queda para el ancho donde entra.
            */}
            <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent text-xs">
                  <TableHead className="w-[36px]">
                    <Checkbox
                      checked={selectedIds.size === visibleEvents.length && visibleEvents.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[65px]">Fecha</TableHead>
                  <TableHead className="w-[100px]">Tipo</TableHead>
                  <TableHead>Descripción / Activo</TableHead>
                  <TableHead className="text-right">Monto (USD)</TableHead>
                  <TableHead>Categoría / Subtítulo</TableHead>
                  <TableHead className="text-center">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      No se encontraron movimientos.
                    </TableCell>
                  </TableRow>
                ) : (
                  visibleEvents.map((item) => {
                    const isSelected = selectedIds.has(item.id);
                    // `normalizeToUnifiedEvents` ya adjunta la fila entera en
                    // `rawRecord`; rearmarla desde otro lado agregaba una segunda
                    // fuente de verdad que podía quedar desfasada de lo que se
                    // está renderizando.
                    const editable =
                      item.sourceTable === "transactions"
                        ? (item.rawRecord as Transaction)
                        : null;
                    // El import marca asi lo que se parece a algo que ya cargaste a
                    // mano. Sin mostrarlo, el aviso queda solo en la nota y el
                    // duplicado se aprueba sin querer.
                    const isPossibleDuplicate = Boolean(
                      (editable?.extracted_fields as Record<string, unknown> | undefined)
                        ?.possible_duplicate_of,
                    );

                    return (
                      <TableRow key={item.id} className={item.needsReview ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-muted/40"}>
                        <TableCell>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectId(item.id)} />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                          {formatDayMonth(item.date)}
                        </TableCell>
                        <TableCell>
                          <ChessBadge eventType={item.type} size="sm" />
                        </TableCell>
                        <TableCell className="font-semibold text-foreground text-sm">
                          <span className="flex items-center gap-1.5">
                            {item.title}
                            {isPossibleDuplicate && (
                              <span
                                title={editable?.notes ?? "Posible duplicado de una carga manual"}
                                className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-500 whitespace-nowrap"
                              >
                                <Copy className="h-2.5 w-2.5" />
                                Posible duplicado
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold whitespace-nowrap">
                          US$ {item.amountUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.subtitle || "—"}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {item.needsReview ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleApproveTransaction(item.rawId, e)}
                                className="h-6 text-[11px] px-2 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400 font-semibold"
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Aprobar
                              </Button>
                            ) : (
                              <span className="text-[11px] text-muted-foreground flex items-center justify-center gap-1">
                                <Check className="h-3 w-3 text-emerald-400" />
                                Confirmado
                              </span>
                            )}

                            {/* Solo los gastos son editables: una operacion se edita
                                por su propio flujo, con su cantidad y precio. */}
                            {editable && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditing(editable)}
                                title="Editar movimiento"
                                className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
            </div>

            {/* Y en el teléfono, una tarjeta por movimiento con el monto a la vista. */}
            {visibleEvents.length === 0 && (
              <p className="py-12 text-center text-sm text-muted-foreground md:hidden">
                No se encontraron movimientos.
              </p>
            )}
            <ul className="space-y-2 md:hidden">
              {visibleEvents.map((item) => {
                const editable =
                  item.sourceTable === "transactions" ? (item.rawRecord as Transaction) : null;
                const isPossibleDuplicate = Boolean(
                  (editable?.extracted_fields as Record<string, unknown> | undefined)
                    ?.possible_duplicate_of,
                );
                return (
                  <li
                    key={item.id}
                    className={`rounded-xl border p-3 ${
                      item.needsReview
                        ? "border-amber-500/40 bg-amber-500/5"
                        : "border-border/60 bg-background/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {item.title}
                        </p>
                        <div className="mt-1 flex items-center gap-1.5">
                          <ChessBadge eventType={item.type} size="sm" />
                          <span className="min-w-0 truncate text-xs text-muted-foreground">
                            <span className="font-mono">{formatDayMonth(item.date)}</span>
                            {item.subtitle ? ` · ${item.subtitle}` : ""}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-right font-mono text-sm font-bold tabular-nums">
                          US$ {item.amountUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </span>
                        {editable && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setEditing(editable)}
                            title="Editar movimiento"
                            className="h-7 w-7 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Sólo cuando hay algo que resolver: en el resto, la tarjeta es una línea. */}
                    {(item.needsReview || isPossibleDuplicate) && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {isPossibleDuplicate && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-500">
                            <Copy className="h-2.5 w-2.5" />
                            Posible duplicado
                          </span>
                        )}
                        {item.needsReview && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleApproveTransaction(item.rawId, e)}
                            className="ml-auto h-7 border-amber-500/30 bg-amber-500/10 px-2 text-[11px] font-semibold text-amber-400 hover:bg-amber-500/20"
                          >
                            <CheckCircle2 className="mr-1 h-3 w-3" />
                            Aprobar
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>

            {/* Cargar de a 50: el historial entero son unas 160 pantallas de teléfono. */}
            {filteredEvents.length > visibleCount && (
              <div className="pt-4 text-center">
                <Button
                  variant="outline"
                  onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                  className="h-9 text-xs font-semibold"
                >
                  Ver {Math.min(PAGE_SIZE, filteredEvents.length - visibleCount)} más
                  <span className="ml-1.5 font-mono text-muted-foreground">
                    ({visibleCount} de {filteredEvents.length})
                  </span>
                </Button>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      <EditTransactionDialog
        transaction={editing}
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
    </div>
  );
}
