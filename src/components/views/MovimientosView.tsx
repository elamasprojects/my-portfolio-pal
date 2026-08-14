import { useState, useMemo, useRef, useEffect } from "react";
import { useTransactions, useCategories, useFinancialAccounts, usePaymentMethods } from "@/hooks/useFinance";
import { useTrades } from "@/hooks/usePortfolio";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { supabase } from "@/integrations/supabase/client";
import { normalizeToUnifiedEvents, UnifiedEventItem, UnifiedEventType } from "@/lib/unifiedEvents";
import { AudioQuickRecorder } from "@/components/finance/AudioQuickRecorder";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChessBadge } from "@/components/ui/ChessBadge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Sparkles,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  ClipboardPaste,
  Upload,
  Trash2,
  Download,
  ArrowUpDown,
  Tag,
  DollarSign,
  ShoppingCart,
  Utensils,
  Car,
  Pizza,
  Check,
} from "lucide-react";

export function MovimientosView() {
  // Data hooks
  const { transactions, reviewQueue, updateTransaction, softDeleteTransaction, addTransaction, isLoading: txLoading } = useTransactions();
  const { categories } = useCategories();
  const { accounts } = useFinancialAccounts();
  const { paymentMethods } = usePaymentMethods();
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { mepRate } = useDolarMEP();

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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filtering States
  const [filterReviewOnly, setFilterReviewOnly] = useState(false);
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Count of pending review items
  const reviewQueueCount = reviewQueue.length;

  // Preset Buttons definition
  const PRESETS = [
    { label: "🛒 Super 35k", text: "Supermercado 35000" },
    { label: "🍔 Cena $25", text: "Cena 25 usd" },
    { label: "🚗 Uber $8.5k", text: "Uber 8500" },
    { label: "🍕 Pizza $12k", text: "Pizza 12000" },
  ];

  // Clipboard paste handler
  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.read) {
        const text = await navigator.clipboard?.readText?.();
        if (text?.trim()) {
          setOmnibarText((prev) => `${prev} ${text}`.trim());
          toast.success("Texto pegado desde portapapeles");
        } else {
          toast.info("Usa Ctrl+V para pegar directamente tu captura");
        }
        return;
      }
      const items = await navigator.clipboard.read();
      let foundImage = false;
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], `comprobante_${Date.now()}.png`, { type: imageType });
          setSelectedFile(file);
          setPreviewUrl(URL.createObjectURL(file));
          foundImage = true;
          toast.success("✓ Captura pegada desde el portapapeles");
          break;
        }
      }
      if (!foundImage) {
        const text = await navigator.clipboard.readText();
        if (text?.trim()) {
          setOmnibarText((prev) => `${prev} ${text}`.trim());
          toast.success("Texto pegado desde el portapapeles");
        }
      }
    } catch (err) {
      toast.info("Presiona Ctrl+V para pegar la captura");
    }
  };

  // Submit Omnibar Input
  const handleSubmitOmnibar = async (overrideText?: string) => {
    const textToSubmit = (overrideText !== undefined ? overrideText : omnibarText).trim();
    if (!textToSubmit && !selectedFile) {
      toast.error("Ingresa un texto o sube un comprobante");
      return;
    }

    setIsSubmitting(true);
    try {
      let imageBase64: string | null = null;
      if (selectedFile) {
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
      }

      // Try AI Extractor
      const { data, error } = await supabase.functions.invoke("extract-finance-input", {
        body: {
          text: textToSubmit || undefined,
          image: imageBase64 || undefined,
          userCategories: categories,
          userPaymentMethods: paymentMethods,
          userAccounts: accounts,
        },
      });

      if (error) throw error;

      const extractedList = data?.transactions || [];

      if (extractedList.length === 0) {
        // Fallback: Local Regex parsing
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
            source: selectedFile ? "screenshot" : "text",
          });
          setOmnibarText("");
          setSelectedFile(null);
          setPreviewUrl(null);
          return;
        } else {
          toast.error("No se pudo extraer el monto. Ejemplo: 'Coto 15000'");
        }
      }
    } catch (err: any) {
      console.warn("AI extraction fallback:", err);
      // Fallback insertion
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
        setOmnibarText("");
        setSelectedFile(null);
        setPreviewUrl(null);
      } else {
        toast.error("Monto no detectado. Ingresa por ejemplo: 'Supermercado 35000'");
      }
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
      // 1. Review Queue Filter
      if (filterReviewOnly && !item.needsReview) return false;

      // 2. Type Filter
      if (selectedTypeFilter !== "all" && item.type !== selectedTypeFilter) return false;

      // 3. Search Filter
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

  // Bulk Selection
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

  // Bulk Actions
  const handleBulkApprove = async () => {
    const txIdsToApprove = Array.from(selectedIds)
      .filter((id) => id.startsWith("tx_"))
      .map((id) => id.replace("tx_", ""));

    if (txIdsToApprove.length === 0) return;

    for (const id of txIdsToApprove) {
      await updateTransaction.mutateAsync({ id, updates: { needs_review: false } });
    }
    toast.success(`✓ ${txIdsToApprove.length} movimientos aprobados`);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const txIdsToDelete = Array.from(selectedIds)
      .filter((id) => id.startsWith("tx_"))
      .map((id) => id.replace("tx_", ""));

    for (const id of txIdsToDelete) {
      await softDeleteTransaction.mutateAsync(id);
    }
    toast.success(`Eliminados ${txIdsToDelete.length} registros`);
    setSelectedIds(new Set());
  };

  const exportCSV = () => {
    const headers = ["ID", "Fecha", "Tipo", "Título", "Subtítulo", "Monto USD", "En Revisión"];
    const rows = filteredEvents.map((e) => [
      e.id,
      e.date,
      e.type,
      `"${e.title.replace(/"/g, '""')}"`,
      `"${(e.subtitle || "").replace(/"/g, '""')}"`,
      e.amountUSD,
      e.needsReview ? "Sí" : "No",
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `movimientos_export_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
  };

  return (
    <div className="space-y-8 pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ArrowUpDown className="h-6 w-6 text-primary" />
            Movimientos Unificados
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Registro consolidado de gastos, ingresos, compras, ventas y dividendos con Omnibar inteligente.
          </p>
        </div>
      </div>

      {/* 1. TOP NATURAL-LANGUAGE OMNIBAR INPUT CARD */}
      <Card className="bg-card border border-border/80 shadow-md relative overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary animate-pulse" />
              Omnibar de Ingreso Rápido (Lenguaje Natural & Comprobantes)
            </span>
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
              IA & Audio Habilitados
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            Escribe en lenguaje natural (ej. <i>"Supermercado 35000"</i>, <i>"Uber 15 usd"</i>) o adjunta un comprobante.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch gap-2">
            <div className="relative flex-1">
              <Input
                placeholder="Ingresa un gasto o movimiento... (ej: Coto 45.000 o Nafta $12000)"
                value={omnibarText}
                onChange={(e) => setOmnibarText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmitOmnibar();
                  }
                }}
                className="pr-20 bg-background/80 border-border/80 text-sm font-medium"
              />
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={handlePasteFromClipboard}
                  title="Pegar del portapapeles"
                >
                  <ClipboardPaste className="h-4 w-4" />
                </Button>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setSelectedFile(f);
                      setPreviewUrl(URL.createObjectURL(f));
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  title="Subir captura"
                >
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AudioQuickRecorder
                onTranscriptReady={(transcript) => {
                  setOmnibarText((prev) => `${prev} ${transcript}`.trim());
                }}
              />
              <Button
                onClick={() => handleSubmitOmnibar()}
                disabled={isSubmitting}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 mr-1.5" />}
                Registrar
              </Button>
            </div>
          </div>

          {/* Screenshot Preview if file selected */}
          {previewUrl && (
            <div className="flex items-center gap-3 p-2 rounded-md bg-muted/40 border border-border/60">
              <img src={previewUrl} alt="Preview" className="h-10 w-10 object-cover rounded" />
              <span className="text-xs font-medium text-foreground flex-1 truncate">{selectedFile?.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:bg-destructive/10"
                onClick={() => {
                  setSelectedFile(null);
                  setPreviewUrl(null);
                }}
              >
                Quitar
              </Button>
            </div>
          )}

          {/* Preset buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-muted-foreground font-medium mr-1">Presets Rápidos:</span>
            {PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="outline"
                size="sm"
                onClick={() => {
                  setOmnibarText(p.text);
                  handleSubmitOmnibar(p.text);
                }}
                className="h-7 text-xs bg-background/50 hover:bg-secondary border-border/60"
              >
                {p.label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 2. HEADER TOOLBAR & REVIEW QUEUE FILTER BADGE */}
      <Card className="bg-card border border-border/80">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Filter controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Search */}
              <div className="relative min-w-[200px]">
                <Search className="h-4 w-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar movimiento o activo..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 text-xs h-9 bg-background/80"
                />
              </div>

              {/* Event Type Filter */}
              <Select value={selectedTypeFilter} onValueChange={setSelectedTypeFilter}>
                <SelectTrigger className="w-[160px] text-xs h-9 bg-background/80">
                  <SelectValue placeholder="Tipo de Evento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los Eventos</SelectItem>
                  <SelectItem value="expense">Gastos</SelectItem>
                  <SelectItem value="income">Ingresos</SelectItem>
                  <SelectItem value="buy">Compras (Trade)</SelectItem>
                  <SelectItem value="sell">Ventas (Trade)</SelectItem>
                  <SelectItem value="dividend">Dividendos</SelectItem>
                  <SelectItem value="transfer">Transferencias</SelectItem>
                </SelectContent>
              </Select>

              {/* Review Queue Badge Pill */}
              {reviewQueueCount > 0 && (
                <Button
                  variant={filterReviewOnly ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilterReviewOnly(!filterReviewOnly)}
                  className="rounded-full h-9 px-3.5 bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20 text-xs font-semibold"
                >
                  <AlertTriangle className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
                  Pendientes de revisión ({reviewQueueCount})
                </Button>
              )}
            </div>

            {/* Export & Bulk Action bar */}
            <div className="flex items-center gap-2">
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 bg-muted/80 p-1 rounded-md border border-border/60">
                  <span className="text-xs text-muted-foreground font-medium px-2">
                    {selectedIds.size} seleccionados
                  </span>
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

              <Button variant="outline" size="sm" onClick={exportCSV} className="h-9 text-xs">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Exportar CSV
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. UNIFIED EVENT FEED TABLE */}
      <Card className="bg-card border border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Feed Unificado de Eventos ({filteredEvents.length})</CardTitle>
          <CardDescription className="text-xs">
            Historial consolidado en orden cronológico inverso.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {txLoading || tradesLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Cargando historial unificado...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedIds.size === filteredEvents.length && filteredEvents.length > 0}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-[110px]">Fecha</TableHead>
                  <TableHead className="w-[130px]">Tipo</TableHead>
                  <TableHead>Descripción / Activo</TableHead>
                  <TableHead>Categoría / Subtítulo</TableHead>
                  <TableHead className="text-right">Monto (USD)</TableHead>
                  <TableHead className="text-center">Estado / Revisión</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvents.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground text-sm">
                      No se encontraron movimientos registrados con los filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredEvents.map((item) => {
                    const isSelected = selectedIds.has(item.id);

                    // Badge formatting by event type
                    let badgeClass = "bg-secondary text-secondary-foreground";
                    if (item.type === "expense") badgeClass = "bg-destructive/10 text-destructive border-destructive/20";
                    else if (item.type === "income") badgeClass = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                    else if (item.type === "buy") badgeClass = "bg-primary/10 text-primary border-primary/20";
                    else if (item.type === "sell") badgeClass = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                    else if (item.type === "dividend") badgeClass = "bg-purple-500/10 text-purple-400 border-purple-500/20";

                    return (
                      <TableRow key={item.id} className={item.needsReview ? "bg-amber-500/5 hover:bg-amber-500/10" : "hover:bg-muted/40"}>
                        <TableCell>
                          <Checkbox checked={isSelected} onCheckedChange={() => toggleSelectId(item.id)} />
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{item.date}</TableCell>
                        <TableCell>
                          <ChessBadge eventType={item.type} size="sm" />
                        </TableCell>
                        <TableCell className="font-semibold text-foreground text-sm">{item.title}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.subtitle || "—"}</TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          US$ {item.amountUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-center">
                          {item.needsReview ? (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => handleApproveTransaction(item.rawId, e)}
                              className="h-7 text-xs px-2.5 bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400 font-semibold"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              ✓ Aprobar
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
    </div>
  );
}
