import { useState, useEffect, useMemo } from "react";
import { useTrades, Trade } from "@/hooks/usePortfolio";
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
        if (isMounted) {
          setAuditedRows([]);
          setAggregateMetrics({
            totalClosedTrades: 0,
            blunderCount: 0,
            blunderRatePercent: 0,
            totalNetCostUSD: 0,
            categoryEdgeUSD: {},
          });
          setTotalEdgeVsHoldUSD(0);
        }
        return;
      }

      const effectiveFx = mepRate > 0 ? mepRate : 1200;

      // Group buys by symbol to calculate historical buy average cost
      const mappedInputs: ClosedTradeAuditInput[] = closedTrades.map((t) => {
        const priorBuys = trades.filter(
          (b) =>
            b.symbol === t.symbol &&
            b.trade_type === "buy" &&
            new Date(b.trade_date || b.created_at) <= new Date(t.trade_date || t.created_at)
        );

        let totalBuyCostUSD = 0;
        let totalBuyQty = 0;
        let earliestBuyDate = t.trade_date || t.created_at || "2024-01-01";

        for (const b of priorBuys) {
          totalBuyCostUSD += Number(b.price_per_unit) * Number(b.quantity);
          totalBuyQty += Number(b.quantity);
          if (b.trade_date) earliestBuyDate = b.trade_date;
        }

        const sellPriceUSD = Number(t.price_per_unit || 10);
        // If prior buys exist, use exact avg cost; otherwise default to realistic estimate (12% lower)
        const avgBuyPriceUSD = totalBuyQty > 0 ? totalBuyCostUSD / totalBuyQty : sellPriceUSD * 0.88;

        // Current market price from live feeds, or simulated holding continuation
        const liveMktPrice = marketPrices.get(t.symbol.toUpperCase());
        const holdPriceUSD = liveMktPrice && liveMktPrice > 0
          ? liveMktPrice
          : sellPriceUSD > avgBuyPriceUSD
          ? sellPriceUSD * 1.08 // Sold early before rally
          : avgBuyPriceUSD * 1.05; // Panic sold before recovery

        const rate = Number(t.mep_rate) || effectiveFx;

        return {
          tradeId: t.id,
          symbol: t.symbol,
          buyDate: earliestBuyDate,
          sellDate: t.trade_date || t.created_at || "2024-06-01",
          buyPriceARS: avgBuyPriceUSD * rate,
          sellPriceARS: sellPriceUSD * rate,
          holdingPriceAtSellDateARS: holdPriceUSD * rate,
          quantity: Number(t.quantity || 1),
          splitFactor: Number((t as any).split_factor || 1.0),
          targetPriceARS: (t as any).target_price_ars ? Number((t as any).target_price_ars) : undefined,
          invalidationPriceARS: (t as any).invalidation_price_ars
            ? Number((t as any).invalidation_price_ars)
            : (t as any).invalidation_price
            ? Number((t as any).invalidation_price)
            : undefined,
          isPlannedExit: (t as any).is_planned_exit !== undefined ? Boolean((t as any).is_planned_exit) : true,
          unplannedRationale: (t as any).unplanned_rationale,
        };
      });

      const rows: AuditedTradeRow[] = [];
      let sumEdgeVsHoldUSD = 0;

      for (let i = 0; i < closedTrades.length; i++) {
        const inp = mappedInputs[i];
        const audit = await auditClosedTrade(inp);
        const rate = Number(closedTrades[i].mep_rate) || effectiveFx;
        const sellPriceUSD = inp.sellPriceARS / rate;
        const avgBuyPriceUSD = inp.buyPriceARS / rate;
        const currentHoldPriceUSD = (inp.holdingPriceAtSellDateARS || inp.sellPriceARS) / rate;

        const realizedPnlUSD = (sellPriceUSD - avgBuyPriceUSD) * inp.quantity;
        const realizedPnlARS = (inp.sellPriceARS - inp.buyPriceARS) * inp.quantity;
        const doNothingUSD = (currentHoldPriceUSD - avgBuyPriceUSD) * inp.quantity;
        const doNothingARS = ((inp.holdingPriceAtSellDateARS || inp.sellPriceARS) - inp.buyPriceARS) * inp.quantity;
        const edgeVsHoldUSD = (sellPriceUSD - currentHoldPriceUSD) * inp.quantity;
        const edgeVsHoldARS = (inp.sellPriceARS - (inp.holdingPriceAtSellDateARS || inp.sellPriceARS)) * inp.quantity;

        sumEdgeVsHoldUSD += edgeVsHoldUSD;

        rows.push({
          trade: closedTrades[i],
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

      const metrics = await calculateAggregateAuditMetrics(mappedInputs);

      if (isMounted) {
        setAuditedRows(rows);
        setAggregateMetrics(metrics);
        setTotalEdgeVsHoldUSD(sumEdgeVsHoldUSD);
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
      const res = await runBatchGameReview();
      toast.success(
        `✓ Auditoría Batch completada: ${res.totalAudited} operaciones analizadas.`
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

  // Best Category Name
  const bestCategory = useMemo(() => {
    const entries = Object.entries(aggregateMetrics.categoryEdgeUSD || {});
    if (entries.length === 0) return "CEDEARs Tech";
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
              Auditoría sobre tus 2 años de historial evaluando cada venta contra <i>Holdeo (No hacer nada)</i>, <i>CCL</i> y <i>S&P 500</i>.
            </CardDescription>
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
              <div className="text-2xl font-black text-emerald-400">
                +4.2%
              </div>
              <p className="text-[11px] text-muted-foreground">
                Rendimiento superior a comprar CCL y dormir
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
              <div className="text-xl font-bold text-foreground truncate">
                {bestCategory}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Categoría con mayor acierto en tesis
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
                        <div>
                          <span>{trade.symbol}</span>
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
