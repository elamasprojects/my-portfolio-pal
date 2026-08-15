import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTrades, Trade } from "@/hooks/usePortfolio";
import { matchTradesFIFO } from "@/lib/tradeMatching";
import { getBenchmarkReturnsForPeriod } from "@/lib/benchmarks";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import {
  auditClosedTrade,
  calculateAggregateAuditMetrics,
  runBatchGameReview,
  ClosedTradeAuditInput,
  CounterfactualMetrics,
  AggregateAuditMetrics,
  TradeOutcome,
} from "@/lib/gameReview";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChessBadge } from "@/components/ui/ChessBadge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  Sparkles,
  AlertOctagon,
  Scale,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  ArrowUpDown,
} from "lucide-react";

interface AuditedTradeRow {
  trade: Trade;
  input: ClosedTradeAuditInput;
  audit: CounterfactualMetrics;
  sellPriceUSD: number;
  avgBuyPriceUSD: number;
  currentHoldPriceUSD: number;
  realizedPnlUSD: number;
  realizedPnlARS: number;
  doNothingUSD: number;
  doNothingARS: number;
  edgeVsHoldUSD: number;
  edgeVsHoldARS: number;
  netCostUSD: number;
}

export function GameReviewDashboard() {
  const navigate = useNavigate();
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { venta: mepRate = 1200 } = useDolarMEP();
  
  // Extract symbols for market price resolution
  const symbols = useMemo(() => {
    return Array.from(new Set(trades.map((t) => t.symbol.toUpperCase())));
  }, [trades]);
  const { prices: marketPrices } = useMarketPrices(symbols);

  const [isRunningBatch, setIsRunningBatch] = useState(false);
  const [auditedRows, setAuditedRows] = useState<AuditedTradeRow[]>([]);
  const [aggregateMetrics, setAggregateMetrics] = useState<AggregateAuditMetrics>({
    totalClosedTrades: 0,
    blunderCount: 0,
    blunderRatePercent: 0,
    totalNetCostUSD: 0,
    categoryEdgeUSD: {},
  });
  const [totalEdgeVsHoldUSD, setTotalEdgeVsHoldUSD] = useState<number>(0);
  const [skippedNoPrice, setSkippedNoPrice] = useState<number>(0);
  const [selectedOutcomeFilter, setSelectedOutcomeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"edge" | "pnl" | "date">("edge");
  const [sortDirection, setSortDirection] = useState<"desc" | "asc">("desc");

  // Map closed trades (sells)
  const closedTrades = useMemo(() => {
    return trades.filter((t) => t.trade_type === "sell");
  }, [trades]);

  // Compute audits
  useEffect(() => {
    let isMounted = true;

    async function computeAllAudits() {
      if (closedTrades.length === 0) {
        // Reset by identity, not unconditionally: assigning a fresh [] / {} on every pass
        // re-rendered the component, which re-ran this effect, forever.
        if (isMounted) {
          setAuditedRows((prev) => (prev.length === 0 ? prev : []));
          setAggregateMetrics((prev) =>
            prev.totalClosedTrades === 0 && Object.keys(prev.categoryEdgeUSD).length === 0
              ? prev
              : {
                  totalClosedTrades: 0,
                  blunderCount: 0,
                  blunderRatePercent: 0,
                  totalNetCostUSD: 0,
                  categoryEdgeUSD: {},
                }
          );
          setTotalEdgeVsHoldUSD(0);
          setSkippedNoPrice(0);
        }
        return;
      }

      const effectiveFx = mepRate > 0 ? mepRate : 1200;

      // FIFO lot matching recovers the true cost basis per exit. Averaging every prior buy
      // overstates cost basis on the second and later sells of the same symbol.
      const fifoBySymbol = new Map<string, ReturnType<typeof matchTradesFIFO>>();
      for (const symbol of new Set(trades.map((t) => t.symbol.toUpperCase()))) {
        fifoBySymbol.set(
          symbol,
          matchTradesFIFO(trades.filter((t) => t.symbol.toUpperCase() === symbol))
        );
      }

      const auditable: { trade: Trade; input: ClosedTradeAuditInput }[] = [];
      let skipped = 0;

      for (const t of closedTrades) {
        const symbol = t.symbol.toUpperCase();
        const sellDate = t.trade_date || t.created_at;
        const sellPriceUSD = Number(t.price_per_unit);

        // The "do nothing" counterfactual is what the position would be worth today had it
        // never been sold, so it needs a live price. Without one the exit is not auditable —
        // substituting a multiple of the user's own trade would manufacture the verdict.
        const holdPriceUSD = marketPrices.get(symbol);
        if (!holdPriceUSD || holdPriceUSD <= 0 || !Number.isFinite(sellPriceUSD) || !sellDate) {
          skipped++;
          continue;
        }

        const matched = fifoBySymbol.get(symbol)?.closedTrades.filter((c) => c.sellDate === sellDate) ?? [];
        const matchedQty = matched.reduce((sum, c) => sum + c.quantity, 0);
        if (matchedQty <= 0) {
          skipped++;
          continue;
        }

        const avgBuyPriceUSD =
          matched.reduce((sum, c) => sum + c.buyPrice * c.quantity, 0) / matchedQty;
        const buyDate = matched.reduce(
          (earliest, c) => (c.buyDate < earliest ? c.buyDate : earliest),
          matched[0].buyDate
        );

        // price_per_unit is stored normalised to USD, so one rate converts every leg.
        const rate = effectiveFx;

        // Benchmarks measured over THIS trade's holding period, or null where the series is
        // unavailable. They used to be fixed constants applied to every trade alike.
        const benchmarks = await getBenchmarkReturnsForPeriod(buyDate, sellDate);

        auditable.push({
          trade: t,
          input: {
            tradeId: t.id,
            symbol: t.symbol,
            buyDate,
            sellDate,
            spyReturnPct: benchmarks.spyReturnPct ?? undefined,
            cclReturnPct: benchmarks.cclReturnPct ?? undefined,
            fixedDepositReturnPct: benchmarks.fixedDepositReturnPct ?? undefined,
            buyPriceARS: avgBuyPriceUSD * rate,
            sellPriceARS: sellPriceUSD * rate,
            holdingPriceAtSellDateARS: holdPriceUSD * rate,
            quantity: matchedQty,
            splitFactor: Number((t as any).split_factor || 1.0),
            targetPriceARS: (t as any).target_price_ars ? Number((t as any).target_price_ars) : undefined,
            invalidationPriceARS: (t as any).invalidation_price_ars
              ? Number((t as any).invalidation_price_ars)
              : undefined,
            isPlannedExit: (t as any).is_planned_exit !== undefined ? Boolean((t as any).is_planned_exit) : true,
            unplannedRationale: (t as any).unplanned_rationale,
          },
        });
      }

      const rows: AuditedTradeRow[] = [];
      let sumEdgeVsHoldUSD = 0;

      for (const { trade: t, input: inp } of auditable) {
        const audit = await auditClosedTrade(inp, effectiveFx);
        const rate = effectiveFx;
        const sellPriceUSD = inp.sellPriceARS / rate;
        const avgBuyPriceUSD = inp.buyPriceARS / rate;
        const holdARS = inp.holdingPriceAtSellDateARS as number;
        const currentHoldPriceUSD = holdARS / rate;

        const realizedPnlUSD = (sellPriceUSD - avgBuyPriceUSD) * inp.quantity;
        const realizedPnlARS = (inp.sellPriceARS - inp.buyPriceARS) * inp.quantity;
        const doNothingUSD = (currentHoldPriceUSD - avgBuyPriceUSD) * inp.quantity;
        const doNothingARS = (holdARS - inp.buyPriceARS) * inp.quantity;
        const edgeVsHoldUSD = (sellPriceUSD - currentHoldPriceUSD) * inp.quantity;
        const edgeVsHoldARS = (inp.sellPriceARS - holdARS) * inp.quantity;

        sumEdgeVsHoldUSD += edgeVsHoldUSD;

        rows.push({
          trade: t,
          input: inp,
          audit,
          sellPriceUSD,
          avgBuyPriceUSD,
          currentHoldPriceUSD,
          realizedPnlUSD,
          realizedPnlARS,
          doNothingUSD,
          doNothingARS,
          edgeVsHoldUSD,
          edgeVsHoldARS,
          netCostUSD: audit.netCostOfTradingUSD,
        });
      }

      const metrics = await calculateAggregateAuditMetrics(
        auditable.map((a) => a.input),
        effectiveFx
      );

      if (isMounted) {
        setAuditedRows(rows);
        setAggregateMetrics(metrics);
        setTotalEdgeVsHoldUSD(sumEdgeVsHoldUSD);
        setSkippedNoPrice(skipped);
      }
    }

    computeAllAudits();
    return () => {
      isMounted = false;
    };
  }, [closedTrades, trades, marketPrices, mepRate]);

  // Run Batch Game Review
  const handleRunBatch = async () => {
    setIsRunningBatch(true);
    try {
      const res = await runBatchGameReview(undefined, {
        holdPricesUSD: marketPrices,
        cclRate: mepRate > 0 ? mepRate : undefined,
      });
      toast.success(
        `✓ Auditoría Batch completada: ${res.totalAudited} operaciones analizadas.` +
          (res.skippedNoPrice > 0
            ? ` ${res.skippedNoPrice} omitidas por falta de precio de mercado.`
            : "")
      );
    } catch (err: any) {
      toast.error("Error al ejecutar auditoría batch");
    } finally {
      setIsRunningBatch(false);
    }
  };

  // Filtered & Sorted rows
  const filteredRows = useMemo(() => {
    let list = auditedRows;
    if (selectedOutcomeFilter !== "all") {
      list = list.filter((r) => {
        const cls = r.audit.outcomeClassification;
        if (selectedOutcomeFilter === "Imprecisión" || selectedOutcomeFilter === "Imprecision") {
          return cls === "Imprecisión" || cls === "Imprecision";
        }
        return cls === selectedOutcomeFilter;
      });
    }

    return [...list].sort((a, b) => {
      let diff = 0;
      if (sortBy === "edge") {
        diff = a.edgeVsHoldUSD - b.edgeVsHoldUSD;
      } else if (sortBy === "pnl") {
        diff = a.realizedPnlUSD - b.realizedPnlUSD;
      } else {
        diff = new Date(a.input.sellDate || 0).getTime() - new Date(b.input.sellDate || 0).getTime();
      }
      return sortDirection === "desc" ? -diff : diff;
    });
  }, [auditedRows, selectedOutcomeFilter, sortBy, sortDirection]);

  const getOutcomeBadge = (outcome: TradeOutcome | string) => {
    return <ChessBadge evaluation={outcome} size="sm" />;
  };

  /**
   * Alpha vs holding dollars. Every price in this codebase is stored normalised to USD, so a
   * realised return measured in USD already nets out the peso's devaluation: 0% is exactly the
   * "bought CCL and slept" outcome. Weighted by cost basis over the audited exits.
   * Null when nothing is auditable — an invented figure here reads as a real finding.
   */
  const alphaVsCclPct = useMemo(() => {
    if (auditedRows.length === 0) return null;
    const costBasis = auditedRows.reduce((sum, r) => sum + r.avgBuyPriceUSD * r.input.quantity, 0);
    if (costBasis <= 0) return null;
    const pnl = auditedRows.reduce((sum, r) => sum + r.realizedPnlUSD, 0);
    return (pnl / costBasis) * 100;
  }, [auditedRows]);

  // Best Category Name. With no audited trades there is no best category — showing a
  // plausible-looking placeholder reads as a finding the data does not support.
  const bestCategory = useMemo(() => {
    const entries = Object.entries(aggregateMetrics.categoryEdgeUSD || {});
    if (entries.length === 0) return null;
    entries.sort((a, b) => b[1] - a[1]);
    return entries[0][0];
  }, [aggregateMetrics]);

  return (
    <div className="space-y-6">
      {/* 1. TOP AUDIT BANNER & BATCH TRIGGER */}
      <Card className="bg-card border border-border/80 shadow-md">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Scale className="h-5 w-5 text-primary" />
              Game Review Retroactivo (Auditoría de Holdeo y Decisiones)
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Auditoría de tu historial evaluando cada venta contra <i>Holdeo (No hacer nada)</i>, usando el precio de mercado actual de cada activo.
            </CardDescription>
            {skippedNoPrice > 0 && (
              <p className="text-[11px] text-amber-400/90 mt-1.5">
                {skippedNoPrice} venta{skippedNoPrice === 1 ? "" : "s"} sin auditar: no hay precio de mercado disponible para su activo.
              </p>
            )}
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={handleRunBatch}
            disabled={isRunningBatch}
            className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-1.5 shadow-sm shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isRunningBatch ? "animate-spin" : ""}`} />
            {isRunningBatch ? "Auditanado Historial..." : "Re-ejecutar Auditoría Batch"}
          </Button>
        </CardHeader>

        <CardContent>
          {/* Top 4 Insight KPI Tiles */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* KPI 1: Blunder Rate */}
            <div className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Tasa de Blunders
                </span>
                <ChessBadge evaluation="blunder" circleOnly size="xs" />
              </div>
              <div className="text-2xl font-black text-rose-400">
                {aggregateMetrics.blunderRatePercent.toFixed(1)}%
              </div>
              <p className="text-[11px] text-muted-foreground">
                {aggregateMetrics.blunderCount} de {aggregateMetrics.totalClosedTrades} operaciones cerradas
              </p>
            </div>

            {/* KPI 2: Net Cost of Trading */}
            <div className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Costo / Edge vs Hold
                </span>
                <ChessBadge evaluation={totalEdgeVsHoldUSD >= 0 ? "brillante" : "blunder"} circleOnly size="xs" />
              </div>
              <div
                className={`text-2xl font-black ${
                  totalEdgeVsHoldUSD >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {totalEdgeVsHoldUSD >= 0 ? "+" : "-"}US${" "}
                {Math.abs(totalEdgeVsHoldUSD).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {totalEdgeVsHoldUSD >= 0
                  ? "Ganancia extra generada por operar vs Hold"
                  : "Costo de oportunidad vs No Tocar Nada"}
              </p>
            </div>

            {/* KPI 3: Benchmark Alpha vs CCL */}
            <div className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Alpha vs Dólar CCL
                </span>
                <ChessBadge evaluation="gran_jugada" circleOnly size="xs" />
              </div>
              <div
                className={`text-2xl font-black ${
                  alphaVsCclPct === null
                    ? "text-muted-foreground"
                    : alphaVsCclPct >= 0
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {alphaVsCclPct === null
                  ? "—"
                  : `${alphaVsCclPct >= 0 ? "+" : ""}${alphaVsCclPct.toFixed(1)}%`}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {alphaVsCclPct === null
                  ? "Sin operaciones cerradas auditables"
                  : "Rendimiento en USD vs comprar CCL y dormir"}
              </p>
            </div>

            {/* KPI 4: Best Performing Category Edge */}
            <div className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Edge por Categoría
                </span>
                <ChessBadge evaluation="correcta" circleOnly size="xs" />
              </div>
              <div
                className={`text-xl font-bold truncate ${
                  bestCategory ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {bestCategory ?? "—"}
              </div>
              <p className="text-[11px] text-muted-foreground">
                {bestCategory
                  ? "Categoría con mayor acierto en tesis"
                  : "Sin operaciones cerradas auditables"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. CLASSIFICATION BREAKDOWN & FILTER PILLS */}
      <Card className="bg-card border border-border/80">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-primary" />
                Desglose de Decisiones Históricas ({filteredRows.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Auditoría detallada de cada operación cerrada: ganancia real, holdeo si conservabas y edge de trading.
              </CardDescription>
            </div>

            {/* Filter buttons */}
            <div className="flex flex-wrap items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border/60">
              <Button
                variant={selectedOutcomeFilter === "all" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setSelectedOutcomeFilter("all")}
              >
                Todos ({auditedRows.length})
              </Button>
              <Button
                variant={selectedOutcomeFilter === "Brillante" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5 flex items-center gap-1.5"
                onClick={() => setSelectedOutcomeFilter("Brillante")}
              >
                <ChessBadge evaluation="brillante" circleOnly size="xs" />
                <span>Brillante</span>
              </Button>
              <Button
                variant={selectedOutcomeFilter === "Correcta" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5 flex items-center gap-1.5"
                onClick={() => setSelectedOutcomeFilter("Correcta")}
              >
                <ChessBadge evaluation="correcta" circleOnly size="xs" />
                <span>Correcta</span>
              </Button>
              <Button
                variant={selectedOutcomeFilter === "Imprecisión" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5 flex items-center gap-1.5"
                onClick={() => setSelectedOutcomeFilter("Imprecisión")}
              >
                <ChessBadge evaluation="imprecision" circleOnly size="xs" />
                <span>Imprecisión</span>
              </Button>
              <Button
                variant={selectedOutcomeFilter === "Blunder" ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs px-2.5 flex items-center gap-1.5"
                onClick={() => setSelectedOutcomeFilter("Blunder")}
              >
                <ChessBadge evaluation="blunder" circleOnly size="xs" />
                <span>Blunder</span>
              </Button>
            </div>
          </div>

          {/* Sort Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1 mr-1">
                <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
                Ordenar por:
              </span>
              <Button
                variant={sortBy === "edge" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5 font-semibold"
                onClick={() => setSortBy("edge")}
              >
                Edge vs Hold
              </Button>
              <Button
                variant={sortBy === "pnl" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5 font-semibold"
                onClick={() => setSortBy("pnl")}
              >
                P&L Realizado
              </Button>
              <Button
                variant={sortBy === "date" ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs px-2.5 font-semibold"
                onClick={() => setSortBy("date")}
              >
                Fecha de Venta
              </Button>
            </div>

            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs px-2 text-primary font-bold hover:bg-primary/10"
              onClick={() => setSortDirection(sortDirection === "desc" ? "asc" : "desc")}
            >
              {sortDirection === "desc" ? "↓ Mayor a Menor" : "↑ Menor a Mayor"}
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Activo / Símbolo</TableHead>
                <TableHead>Evaluación</TableHead>
                <TableHead className="text-right">Precio Venta</TableHead>
                <TableHead className="text-right">P&L Realizado (USD / ARS)</TableHead>
                <TableHead className="text-right">Holdeo (Do-Nothing)</TableHead>
                <TableHead className="text-right">Edge vs Hold (USD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                    {tradesLoading
                      ? "Calculando auditorías contrafácticas..."
                      : "No hay operaciones cerradas registradas con el filtro seleccionado."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map(({ trade, input, audit, sellPriceUSD, avgBuyPriceUSD, currentHoldPriceUSD, realizedPnlUSD, realizedPnlARS, doNothingUSD, doNothingARS, edgeVsHoldUSD, edgeVsHoldARS }) => {
                  const isGain = realizedPnlUSD >= 0;
                  const isPositiveEdge = edgeVsHoldUSD >= 0;
                  return (
                    <TableRow key={trade.id} className="hover:bg-muted/40">
                      <TableCell className="font-bold text-foreground">
                        <div
                          className="cursor-pointer group select-none"
                          onClick={() => navigate(`/asset/${trade.symbol}`)}
                          title={`Ver análisis de ${trade.symbol}`}
                        >
                          <span className="group-hover:text-primary group-hover:underline transition-colors">
                            {trade.symbol}
                          </span>
                          <span className="text-[10px] text-muted-foreground block font-mono">
                            {input.sellDate?.slice(0, 10)} · {input.quantity.toFixed(2)} u.
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{getOutcomeBadge(audit.outcomeClassification)}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <span className="font-bold text-foreground">
                          US$ {sellPriceUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-muted-foreground block font-sans">
                          $ {input.sellPriceARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <span className={`font-bold ${isGain ? "text-emerald-400" : "text-rose-400"}`}>
                          {isGain ? "+" : ""}US${" "}
                          {realizedPnlUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[10px] text-muted-foreground block font-sans">
                          {realizedPnlARS >= 0 ? "+" : ""}${" "}
                          {realizedPnlARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        <span
                          className={
                            doNothingUSD >= 0 ? "text-emerald-400 font-semibold" : "text-destructive font-semibold"
                          }
                        >
                          {doNothingUSD >= 0 ? "+" : ""}US${" "}
                          {doNothingUSD.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-[10px] text-muted-foreground block font-sans">
                          {doNothingARS >= 0 ? "+" : ""}${" "}
                          {doNothingARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-bold">
                        <span className={isPositiveEdge ? "text-emerald-400" : "text-rose-400"}>
                          {isPositiveEdge ? "+" : ""}US${" "}
                          {edgeVsHoldUSD.toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                        <span className="text-[10px] text-muted-foreground block font-sans font-normal">
                          {isPositiveEdge ? "Alpha por vender" : "Costo de oportunidad"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
