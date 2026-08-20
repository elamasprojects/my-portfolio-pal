import { useState, useMemo, useRef, useEffect } from "react";
import { useTransactions, useCategories, useFinancialAccounts, usePaymentMethods } from "@/hooks/useFinance";
import { useTrades } from "@/hooks/usePortfolio";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { supabase } from "@/integrations/supabase/client";
import { normalizeToUnifiedEvents, UnifiedEventItem, UnifiedEventType } from "@/lib/unifiedEvents";
import { AudioQuickRecorder } from "@/components/finance/AudioQuickRecorder";
import { AddTradeDialog } from "@/components/trades/AddTradeDialog";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  Download,
  ArrowUpDown,
  Check,
  RotateCcw,
  Sparkles,
} from "lucide-react";

export function MovimientosView() {
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

  // Omnibar State
  const [omnibarText, setOmnibarText] = useState("");
  const [addTradeOpen, setAddTradeOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtering States
  const [filterReviewOnly, setFilterReviewOnly] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Count of pending review items
  const reviewQueueCount = reviewQueue.length;

  // ══════════════════════════════════════════════════════════════════════
  // FREQUENT EXPENSES PRESETS (Repetidos > 4 veces Y en los últimos 14 días)
  // Máximo 3 en una sola fila
  // ══════════════════════════════════════════════════════════════════════
  const frequentPresets = useMemo(() => {
    const now = Date.now();
    const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

    const map = new Map<
      string,
      { name: string; amount: number; currency: string; count: number; latestDate: Date }
    >();

    for (const t of transactions) {
      if (!t.name || t.deleted_at) continue;
      const cleanName = t.name.trim();
      const origAmount = Number(t.original_amount || t.amount_usd || 0);
      const key = `${cleanName.toLowerCase()}_${origAmount}`;
      const txDate = new Date(t.transaction_date || t.created_at || now);

      const curr = map.get(key);
      if (curr) {
        curr.count += 1;
        if (txDate > curr.latestDate) {
          curr.latestDate = txDate;
        }
      } else {
        map.set(key, {
          name: cleanName,
          amount: origAmount,
          currency: t.original_currency || "ARS",
          count: 1,
          latestDate: txDate,
        });
      }
    }

    // Must be > 4 occurrences AND occurred within the last 14 days
    const qualified = Array.from(map.values()).filter((item) => {
      const isRepeated = item.count > 4;
      const isRecent = now - item.latestDate.getTime() <= FOURTEEN_DAYS_MS;
      return isRepeated && isRecent;
    });

    // Maximum 3 presets
    return qualified.sort((a, b) => b.count - a.count).slice(0, 3);
  }, [transactions]);

  // ══════════════════════════════════════════════════════════════════════
  // AUTOMATIC OCR / AI EXTRACTION ON FILE OR CLIPBOARD IMAGE
  // ══════════════════════════════════════════════════════════════════════
  const handleAutoProcessFile = async (file: File) => {
    setIsSubmitting(true);
    const toastId = toast.loading("Analizando comprobante automáticamente con IA...");

    try {
      const imageBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("extract-finance-input", {
        body: {
          image: imageBase64,
          userCategories: categories,
          userPaymentMethods: paymentMethods,
          userAccounts: accounts,
        },
      });

      if (error) throw error;

      const extracted = data?.transactions?.[0];
      if (extracted) {
        await addTransaction.mutateAsync({
          name: extracted.name || "Comprobante Extraído",
          amount_usd: extracted.amount_usd,
          original_amount: extracted.original_amount,
          original_currency: extracted.original_currency || "ARS",
          fx_rate: extracted.fx_rate,
          category_id: extracted.category_id,
          payment_method_id: extracted.payment_method_id,
          transaction_date: extracted.transaction_date || new Date().toISOString().split("T")[0],
          confidence: extracted.confidence || "high",
          needs_review: true,
          source: "screenshot",
        });

        toast.success(`✓ Movimiento registrado: ${extracted.name} ($${extracted.original_amount || extracted.amount_usd})`, {
          id: toastId,
        });
      } else {
        toast.error("No se detectó el monto en la imagen. Intenta con texto directo.", { id: toastId });
      }
    } catch (err: any) {
      console.warn("AI extraction fallback:", err);
      toast.error("Error al procesar la imagen con IA.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ══════════════════════════════════════════════════════════════════════
  // CLIPBOARD PASTE HANDLER (Detects Image or Text Automatically)
  // ══════════════════════════════════════════════════════════════════════
  const handlePasteFromClipboard = async () => {
    try {
      if (navigator.clipboard?.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          const imageType = item.types.find((t) => t.startsWith("image/"));
          if (imageType) {
            const blob = await item.getType(imageType);
            const file = new File([blob], `comprobante_${Date.now()}.png`, { type: imageType });
            await handleAutoProcessFile(file);
            return;
          }
        }
      }

      // Text clipboard
      const text = await navigator.clipboard.readText();
      if (text?.trim()) {
        setOmnibarText(text.trim());
        toast.info("Texto pegado. Presiona Registrar o Enter.");
      } else {
        toast.info("Portapapeles vacío");
      }
    } catch (err) {
      toast.info("Usa Ctrl+V para pegar directamente tu texto o captura");
    }
  };

  // Submit Text Input
  const handleSubmitOmnibar = async (overrideText?: string) => {
    const textToSubmit = (overrideText !== undefined ? overrideText : omnibarText).trim();
    if (!textToSubmit) return;

    setIsSubmitting(true);
    try {
      // 1. Try AI Extractor
      const { data, error } = await supabase.functions.invoke("extract-finance-input", {
        body: {
          text: textToSubmit,
          userCategories: categories,
          userPaymentMethods: paymentMethods,
          userAccounts: accounts,
        },
      });

      if (!error && data?.transactions?.length > 0) {
        const extracted = data.transactions[0];
        await addTransaction.mutateAsync({
          name: extracted.name || textToSubmit,
          amount_usd: extracted.amount_usd,
          original_amount: extracted.original_amount,
          original_currency: extracted.original_currency || "ARS",
          fx_rate: extracted.fx_rate,
          category_id: extracted.category_id,
          payment_method_id: extracted.payment_method_id,
          confidence: extracted.confidence || "high",
          needs_review: false,
          source: "text",
        });
        toast.success(`✓ Movimiento registrado: ${extracted.name}`);
        setOmnibarText("");
        return;
      }

      // 2. Fallback Local parsing
      const numMatch = textToSubmit.match(/(\d+[\d\s.,]*)/);
      const rawAmount = numMatch ? parseFloat(numMatch[1].replace(/\s/g, "").replace(",", ".")) : 0;
      const isARS = !textToSubmit.toLowerCase().includes("usd") && rawAmount > 500;
      const effectiveRate = mepRate && mepRate > 0 ? mepRate : 1200;
      const amountUSD = isARS ? rawAmount / effectiveRate : rawAmount;

      if (rawAmount > 0) {
        await addTransaction.mutateAsync({
          name: textToSubmit.replace(/(\d+[\d\s.,]*)/, "").trim() || "Gasto Rápido",
          amount_usd: amountUSD,
          original_amount: rawAmount,
          original_currency: isARS ? "ARS" : "USD",
          fx_rate: isARS ? effectiveRate : 1,
          confidence: "medium",
          needs_review: true,
          source: "text",
        });
        toast.success(`✓ Movimiento registrado: $${rawAmount}`);
        setOmnibarText("");
      } else {
        toast.error("Monto no detectado. Ej: 'Coto 15000'");
      }
    } catch (err: any) {
      toast.error("Error al registrar movimiento");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inline Approval
  const handleApproveTransaction = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await updateTransaction.mutateAsync({
        id,
        updates: { needs_review: false },
      });
      toast.success("✓ Movimiento aprobado");
    } catch (err: any) {
      toast.error("Error al aprobar movimiento");
    }
  };

  // Filtered Events
  const filteredEvents = useMemo(() => {
    return unifiedEvents.filter((item) => {
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
  }, [unifiedEvents, filterReviewOnly, selectedTypeFilter, searchQuery]);

  // Bulk Actions
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredEvents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredEvents.map((e) => e.id)));
    }
  };

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

  const isTyping = omnibarText.trim().length > 0;

  return (
    <div className="space-y-6 pb-24">
      {/* 1. SIMPLE & CLEAN INPUT CARD */}
      <Card className="bg-card border border-border/80 shadow-md">
        <CardContent className="p-4 sm:p-5 space-y-3">
          {/* Main Input Row: Text Input + Audio Recorder with dynamic disappearance */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Ingresa un gasto o movimiento... (ej: Coto 45000, Uber 15 usd)"
                value={omnibarText}
                onChange={(e) => setOmnibarText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitOmnibar();
                  }
                }}
                className="h-12 text-sm font-medium px-4 bg-background/90 border-border/80 rounded-xl shadow-inner font-sans"
              />
            </div>

            {/* Audio Recorder: Has high hierarchy and disappears when typing */}
            <AnimatePresence>
              {!isTyping && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.15 }}
                  className="shrink-0"
                >
                  <AudioQuickRecorder
                    // The prop is `onRecordedText`; passing `onTranscriptReady` meant the
                    // recorder had no callback and every transcription was dropped.
                    onRecordedText={(transcript) => {
                      setOmnibarText(transcript.trim());
                      handleSubmitOmnibar(transcript.trim());
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Hidden File Input for Auto OCR */}
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                handleAutoProcessFile(f);
                e.target.value = "";
              }
            }}
          />

          {/* Action Buttons: Pegar & Subir Captura (with Auto Analysis) */}
          <div className="grid grid-cols-2 gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={handlePasteFromClipboard}
              disabled={isSubmitting}
              className="h-11 text-xs font-bold rounded-xl border-border/80 bg-background/60 hover:bg-muted gap-2"
            >
              <ClipboardPaste className="h-4 w-4 text-primary" />
              <span>Pegar</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSubmitting}
              className="h-11 text-xs font-bold rounded-xl border-border/80 bg-background/60 hover:bg-muted gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Upload className="h-4 w-4 text-primary" />
              )}
              <span>Subir Captura</span>
            </Button>
          </div>

          {/* If typing: Show Register Movement Button */}
          {isTyping && (
            <Button
              onClick={() => handleSubmitOmnibar()}
              disabled={isSubmitting}
              className="w-full h-11 text-xs font-bold rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-md gap-2"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              <span>Registrar Movimiento</span>
            </Button>
          )}

          {/* Frequent Expenses Presets (Max 3 in single row) */}
          {frequentPresets.length > 0 && (
            <div className="pt-2 border-t border-border/40 space-y-1.5">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                Gastos Frecuentes Recientes (últimos 14 días)
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {frequentPresets.map((p) => (
                  <Button
                    key={`${p.name}_${p.amount}`}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const text = `${p.name} ${p.amount}`;
                      setOmnibarText(text);
                      handleSubmitOmnibar(text);
                    }}
                    className="h-8 text-xs bg-background/60 hover:bg-secondary border-border/60 rounded-xl px-2.5 font-medium flex items-center justify-between truncate"
                  >
                    <span className="truncate">{p.name}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-1.5">
                      <span className="font-mono text-muted-foreground font-bold">
                        ${p.amount.toLocaleString("es-AR")}
                      </span>
                      <Badge variant="secondary" className="text-[9px] px-1 py-0 h-4 font-mono bg-primary/10 text-primary">
                        {p.count}x
                      </Badge>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

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
            <CardDescription className="text-xs">Historial cronológico ordenado.</CardDescription>
          </div>
          {/* The omnibar above captures expenses and income; trades need their own entry point. */}
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => setAddTradeOpen(true)}>
            <TrendingUp className="h-4 w-4 mr-1" />
            Operación
          </Button>
        </CardHeader>
        <CardContent>
          {txLoading || tradesLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Cargando historial...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent text-xs">
                  <TableHead className="w-[36px]">
                    <Checkbox
                      checked={selectedIds.size === filteredEvents.length && filteredEvents.length > 0}
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
                {filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      No se encontraron movimientos.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((item) => {
                    const isSelected = selectedIds.has(item.id);

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
                        <TableCell className="font-semibold text-foreground text-sm">{item.title}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold whitespace-nowrap">
                          US$ {item.amountUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.subtitle || "—"}</TableCell>
                        <TableCell className="text-center">
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
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AddTradeDialog open={addTradeOpen} onOpenChange={setAddTradeOpen} />
    </div>
  );
}
