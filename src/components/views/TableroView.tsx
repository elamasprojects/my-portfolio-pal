import { useState, useMemo, useEffect } from "react";
import { useUnifiedFinancials } from "@/hooks/useUnifiedFinancials";
import { useTrades, computeHoldings, computePerformance, computeCash, Holding, Trade } from "@/hooks/usePortfolio";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { calculateRealReturns, calculateRealReturnsBatch } from "@/lib/realReturns";
import { RealReturnColumns } from "@/types/realReturns";
import { makeFormatters } from "@/lib/format";
import { SankeyFlowChart } from "@/components/finance/SankeyFlowChart";
import { QuickSellDialog } from "@/components/QuickSellDialog";
import { MobileSwipeableHoldingCard } from "@/components/MobileSwipeableHoldingCard";
import { ClosedPositionSummaryDialog, ClosedPositionSummary } from "@/components/ClosedPositionSummaryDialog";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChessBadge } from "@/components/ui/ChessBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsMobile } from "@/hooks/use-mobile";
import { useNavigate } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  PieChart as PieChartIcon,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Zap,
  Activity,
  Layers,
  ArrowRightLeft,
  Percent,
} from "lucide-react";

export function TableroView() {
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Financial & market data hooks
  const { netWorthMetrics, sankeyData, transactions, isLoading: unifiedLoading } = useUnifiedFinancials();
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { venta: mepRate = 1200 } = useDolarMEP();

  const holdings = useMemo(() => computeHoldings(trades), [trades]);
  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const { prices: marketPrices, isLoading: pricesLoading } = useMarketPrices(symbols);

  // Formatting helpers
  const { fmt, cx } = makeFormatters("USD", mepRate);

  // Quick sell & closed position states
  const [quickSellOpen, setQuickSellOpen] = useState(false);
  const [selectedHoldingForSell, setSelectedHoldingForSell] = useState<Holding | null>(null);
  const [sellCurrentPrice, setSellCurrentPrice] = useState<number | null>(null);
  const [closedSummaryOpen, setClosedSummaryOpen] = useState(false);
  const [closedSummaryData, setClosedSummaryData] = useState<ClosedPositionSummary | null>(null);

  // Active Holdings Gain Column Toggle: 'nominal' | 'real_ipc' | 'usd_ccl'
  const [gainDisplayMode, setGainDisplayMode] = useState<"nominal" | "real_ipc" | "usd_ccl">("nominal");

  // 1. Calculate Net Worth in 3 Columns
  const effectiveCclRate = mepRate > 0 ? mepRate : 1200;
  const netWorthUSD = netWorthMetrics.netWorthUSD || 0;
  const netWorthARS = netWorthUSD * effectiveCclRate;

  const [netWorth3Col, setNetWorth3Col] = useState<RealReturnColumns>({
    nominalARS: netWorthARS,
    realVsIPC: netWorthARS,
    usdVsCCL: netWorthUSD,
  });

  // 2. Capital Conversion Rate 3-Column saved capital calculation
  const monthlyInflowUSD = netWorthMetrics.monthlyBrokerInflowUSD || 0;
  const monthlyInflowARS = monthlyInflowUSD * effectiveCclRate;
  const [capitalSaved3Col, setCapitalSaved3Col] = useState<RealReturnColumns>({
    nominalARS: monthlyInflowARS,
    realVsIPC: monthlyInflowARS,
    usdVsCCL: monthlyInflowUSD,
  });

  // 3. 3-Column Real Returns Batch P&L
  const [realReturnsTableData, setRealReturnsTableData] = useState<
    { category: string; nominalARS: number; realVsIPC: number; usdVsCCL: number }[]
  >([]);

  useEffect(() => {
    let isMounted = true;
    async function load3ColMetrics() {
      const todayIso = new Date().toISOString().split("T")[0];
      const monthStartIso = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const yearStartIso = `${new Date().getFullYear()}-01-01`;

      // Net Worth 3-column calculation
      const nwRes = await calculateRealReturns({
        amountARS: netWorthARS,
        startDate: monthStartIso,
        endDate: todayIso,
      });

      // Capital saved 3-column calculation
      const capRes = await calculateRealReturns({
        amountARS: monthlyInflowARS,
        startDate: monthStartIso,
        endDate: todayIso,
      });

      // Batch P&L calculation for asset categories & portfolio breakdown
      const assetCategories = [
        { key: "total", label: "Patrimonio Total", usd: netWorthMetrics.netWorthUSD },
        { key: "portfolio", label: "Portafolio Inversiones", usd: netWorthMetrics.portfolioMarketValueUSD },
        { key: "liquid", label: "Efectivo Líquido", usd: netWorthMetrics.liquidCashUSD },
        { key: "broker", label: "Efectivo Broker", usd: netWorthMetrics.brokerCashUSD },
      ];

      const batchParams = assetCategories.map((item) => ({
        amountARS: item.usd * effectiveCclRate,
        startDate: yearStartIso,
        endDate: todayIso,
      }));

      const batchResults = await calculateRealReturnsBatch(batchParams);

      if (isMounted) {
        setNetWorth3Col(nwRes);
        setCapitalSaved3Col(capRes);
        setRealReturnsTableData(
          assetCategories.map((item, idx) => ({
            category: item.label,
            nominalARS: batchResults[idx].nominalARS,
            realVsIPC: batchResults[idx].realVsIPC,
            usdVsCCL: batchResults[idx].usdVsCCL,
          }))
        );
      }
    }

    load3ColMetrics();
    return () => {
      isMounted = false;
    };
  }, [netWorthARS, monthlyInflowARS, effectiveCclRate, netWorthMetrics]);

  const handleOpenQuickSell = (holding: Holding, price?: number | null, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedHoldingForSell(holding);
    const convertedPrice = price ? cx(price) : holding.avg_cost ? cx(holding.avg_cost) : null;
    setSellCurrentPrice(convertedPrice);
    setQuickSellOpen(true);
  };

  const handleQuickSellSuccess = (summary: ClosedPositionSummary) => {
    setClosedSummaryData(summary);
    setClosedSummaryOpen(true);
  };

  const isLoading = unifiedLoading || tradesLoading || pricesLoading;

  return (
    <div className="space-y-8 pb-12">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            Tablero General
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visión unificada de patrimonio, retorno real de capital en 3 columnas y flujo de caja.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs py-1 px-3 border-primary/30 text-primary bg-primary/10">
            Dólar CCL/MEP: ${effectiveCclRate.toLocaleString("es-AR")}
          </Badge>
        </div>
      </div>

      {/* 1. NET WORTH BANNER (3 SIMULTANEOUS COLUMNS) */}
      <Card className="bg-card/90 border border-border/80 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Wallet className="h-44 w-44 text-primary" />
        </div>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Patrimonio Neto Unificado (Net Worth)</span>
            <Badge variant="secondary" className="text-[10px] font-semibold">
              3 Columnas Simultáneas
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-1">
              {/* Column 1: Nominal ARS */}
              <div className="p-4 rounded-lg bg-background/60 border border-border/60">
                <span className="text-xs text-muted-foreground font-medium block mb-1">
                  1. Nominal ARS
                </span>
                <div className="text-2xl font-bold text-foreground">
                  $ {netWorth3Col.nominalARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </div>
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Valor facial acumulado en Pesos
                </span>
              </div>

              {/* Column 2: Real vs IPC Deflated */}
              <div className="p-4 rounded-lg bg-background/60 border border-primary/30 bg-primary/5">
                <span className="text-xs text-primary font-medium block mb-1 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  2. Real vs IPC (Deflatado ARS)
                </span>
                <div className="text-2xl font-bold text-primary">
                  $ {netWorth3Col.realVsIPC.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </div>
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Poder de compra ajustado por inflación INDEC
                </span>
              </div>

              {/* Column 3: USD vs CCL */}
              <div className="p-4 rounded-lg bg-background/60 border border-emerald-500/30 bg-emerald-500/5">
                <span className="text-xs text-emerald-400 font-medium block mb-1 flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5" />
                  3. USD vs CCL (Real USD)
                </span>
                <div className="text-2xl font-bold text-emerald-400">
                  US$ {netWorth3Col.usdVsCCL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-muted-foreground mt-1 block">
                  Valuación libre en dólares de mercado
                </span>
              </div>
            </div>
          )}

          {/* Sub-breakdown of liquid vs broker cash vs portfolio */}
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-border/40 text-xs text-muted-foreground">
            <div>
              <span className="block font-medium text-foreground">Efectivo Líquido</span>
              <span>US$ {netWorthMetrics.liquidCashUSD?.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            </div>
            <div>
              <span className="block font-medium text-foreground">Efectivo Broker</span>
              <span>US$ {netWorthMetrics.brokerCashUSD?.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            </div>
            <div>
              <span className="block font-medium text-foreground">Portafolio Activos</span>
              <span>US$ {netWorthMetrics.portfolioMarketValueUSD?.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. CAPITAL CONVERSION RATE TILE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 bg-card border border-border/80 flex flex-col justify-between">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Percent className="h-4 w-4 text-primary" />
              Tasa de Conversión de Capital
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-4xl font-extrabold text-foreground tracking-tight">
                {netWorthMetrics.investmentRatePct || 0}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Porcentaje de ingresos del período destinado a inversiones en activos.
              </p>
            </div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">Ingresos del Período:</span>
                <span className="font-medium text-foreground">US$ {netWorthMetrics.monthlyIncomeUSD?.toLocaleString("en-US")}</span>
              </div>
              <div className="flex justify-between items-center py-1 border-b border-border/40">
                <span className="text-muted-foreground">Capital Invertido:</span>
                <span className="font-medium text-emerald-400">US$ {netWorthMetrics.monthlyBrokerInflowUSD?.toLocaleString("en-US")}</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">Tasa de Ahorro Total:</span>
                <span className="font-medium text-foreground">{netWorthMetrics.savingsRatePct || 0}%</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 3-COLUMN CAPITAL BREAKDOWN TILE */}
        <Card className="md:col-span-2 bg-card border border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" />
              Desglose de Capital Guardado (3 Columnas)
            </CardTitle>
            <CardDescription className="text-xs">
              Monto invertido en el período ajustado por inflación IPC y dólar CCL
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-3 rounded-md bg-secondary/50 border border-border/60">
                <span className="text-xs text-muted-foreground font-medium block">Nominal ARS</span>
                <span className="text-lg font-bold text-foreground block mt-1">
                  $ {capitalSaved3Col.nominalARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="p-3 rounded-md bg-primary/10 border border-primary/20">
                <span className="text-xs text-primary font-medium block">Real vs IPC</span>
                <span className="text-lg font-bold text-primary block mt-1">
                  $ {capitalSaved3Col.realVsIPC.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="p-3 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-xs text-emerald-400 font-medium block">USD vs CCL</span>
                <span className="text-lg font-bold text-emerald-400 block mt-1">
                  US$ {capitalSaved3Col.usdVsCCL.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. 3-COLUMN REAL RETURNS TABLE & P&L */}
      <Card className="bg-card border border-border/80">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Tabla de Retornos Reales y P&L (3 Columnas)
          </CardTitle>
          <CardDescription className="text-xs">
            Calculado mediante <code className="text-primary font-mono text-[11px]">calculateRealReturnsBatch</code> para comparación directa de poder adquisitivo.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[200px]">Concepto / Componente</TableHead>
                <TableHead className="text-right">1. Nominal ARS</TableHead>
                <TableHead className="text-right text-primary">2. Real vs IPC (Deflatado)</TableHead>
                <TableHead className="text-right text-emerald-400">3. USD vs CCL (Real USD)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {realReturnsTableData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-xs">
                    Cargando retornos en 3 columnas...
                  </TableCell>
                </TableRow>
              ) : (
                realReturnsTableData.map((row, i) => (
                  <TableRow key={i} className="hover:bg-muted/40">
                    <TableCell className="font-medium text-foreground text-sm">
                      {row.category}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      $ {row.nominalARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-primary font-semibold">
                      $ {row.realVsIPC.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-emerald-400 font-semibold">
                      US$ {row.usdVsCCL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 4. ACTIVE HOLDINGS / POSITIONS TABLE WITH 3-COLUMN GAIN TOGGLE */}
      <Card className="bg-card border border-border/80">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-400" />
              Posiciones Activas en Cartera
            </CardTitle>
            <CardDescription className="text-xs">
              Tenencias actuales con cotización de mercado en tiempo real y selector de ganancia en 3 columnas.
            </CardDescription>
          </div>

          {/* 3-Column Gain Toggle */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/60">
            <span className="text-xs text-muted-foreground px-2 font-medium">Ganancia:</span>
            <Button
              variant={gainDisplayMode === "nominal" ? "default" : "ghost"}
              size="sm"
              onClick={() => setGainDisplayMode("nominal")}
              className="text-xs h-7 px-2.5"
            >
              Nominal
            </Button>
            <Button
              variant={gainDisplayMode === "real_ipc" ? "default" : "ghost"}
              size="sm"
              onClick={() => setGainDisplayMode("real_ipc")}
              className="text-xs h-7 px-2.5"
            >
              IPC Deflatado
            </Button>
            <Button
              variant={gainDisplayMode === "usd_ccl" ? "default" : "ghost"}
              size="sm"
              onClick={() => setGainDisplayMode("usd_ccl")}
              className="text-xs h-7 px-2.5"
            >
              USD CCL
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isMobile ? (
            <div className="space-y-3">
              {holdings.map((h) => {
                const livePrice = marketPrices.get(h.symbol.toUpperCase());
                return (
                  <MobileSwipeableHoldingCard
                    key={h.symbol}
                    holding={h}
                    currentPrice={livePrice}
                    displayCurrency="USD"
                    currencySymbol="US$"
                    cx={cx}
                    fmt={fmt}
                    onOpenQuickSell={(holding, price, e) => handleOpenQuickSell(holding, price, e)}
                  />
                );
              })}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Símbolo / Activo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio Promedio</TableHead>
                  <TableHead className="text-right">Precio Actual</TableHead>
                  <TableHead className="text-right">Valor Mercado (USD)</TableHead>
                  <TableHead className="text-right">
                    Ganancia ({gainDisplayMode === "nominal" ? "Nominal ARS" : gainDisplayMode === "real_ipc" ? "Real vs IPC" : "USD CCL"})
                  </TableHead>
                  <TableHead className="text-center">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                      No hay posiciones activas registradas en el portafolio.
                    </TableCell>
                  </TableRow>
                ) : (
                  holdings.map((h) => {
                    const price = marketPrices.get(h.symbol.toUpperCase());
                    const currentPrice = price || h.avg_cost;
                    const marketVal = currentPrice * h.net_quantity;
                    const pnlUSD = (currentPrice - h.avg_cost) * h.net_quantity;
                    const pnlARS = pnlUSD * effectiveCclRate;
                    const pnlPct = h.total_invested > 0 ? (pnlUSD / h.total_invested) * 100 : 0;
                    const isPositive = pnlUSD >= 0;

                    const matchingBuyTrade = trades.find((t) => t.symbol === h.symbol && (t.trade_type === "buy" || !t.trade_type));
                    const currentPriceARS = currentPrice * effectiveCclRate;
                    const targetPriceARS = matchingBuyTrade?.target_price_ars;
                    const invalidationPriceARS = matchingBuyTrade?.invalidation_price_ars;
                    const isTargetHit = Boolean(targetPriceARS && targetPriceARS > 0 && currentPriceARS >= targetPriceARS);
                    const isInvalidationHit = Boolean(
                      (invalidationPriceARS && invalidationPriceARS > 0 && currentPriceARS <= invalidationPriceARS) ||
                      (currentPriceARS < h.avg_cost * effectiveCclRate * 0.85)
                    );

                    return (
                      <TableRow key={h.symbol} className="hover:bg-muted/40">
                        <TableCell className="font-semibold text-foreground">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span>{h.symbol}</span>
                            <Badge variant="outline" className="text-[10px] uppercase">
                              {h.asset_type || "asset"}
                            </Badge>
                            {isTargetHit && (
                              <ChessBadge evaluation="brillante" label="Target Alcanzado" size="xs" />
                            )}
                            {isInvalidationHit && !isTargetHit && (
                              <ChessBadge evaluation="imprecision" label="Invalidación" size="xs" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{h.net_quantity}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          US$ {h.avg_cost.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-semibold">
                          US$ {currentPrice.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          US$ {marketVal.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {gainDisplayMode === "nominal" && (
                            <span className={isPositive ? "text-emerald-400 font-semibold" : "text-destructive font-semibold"}>
                              {isPositive ? "+" : ""}$ {pnlARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ({pnlPct.toFixed(1)}%)
                            </span>
                          )}
                          {gainDisplayMode === "real_ipc" && (
                            <span className={isPositive ? "text-primary font-semibold" : "text-destructive font-semibold"}>
                              {isPositive ? "+" : ""}$ {(pnlARS * (netWorth3Col.nominalARS > 0 ? netWorth3Col.realVsIPC / netWorth3Col.nominalARS : 1)).toLocaleString("es-AR", { maximumFractionDigits: 0 })} ({pnlPct.toFixed(1)}%)
                            </span>
                          )}
                          {gainDisplayMode === "usd_ccl" && (
                            <span className={isPositive ? "text-emerald-400 font-semibold" : "text-destructive font-semibold"}>
                              {isPositive ? "+" : ""}US$ {pnlUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })} ({pnlPct.toFixed(1)}%)
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="h-7 text-xs px-2.5 bg-destructive/20 hover:bg-destructive/30 text-destructive border border-destructive/30"
                            onClick={(e) => handleOpenQuickSell(h, currentPrice, e)}
                          >
                            <TrendingDown className="h-3.5 w-3.5 mr-1" />
                            Vender
                          </Button>
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

      {/* 5. PERIOD SANKEY FLOW DIAGRAM */}
      <Card className="bg-card border border-border/80">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-primary" />
            Flujo Financiero del Período (Diagrama Sankey)
          </CardTitle>
          <CardDescription className="text-xs">
            Visualización unificada de fuentes de ingreso, canalización hacia gastos y asignación de capital a inversión.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          {sankeyData.nodes.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border/60 rounded-lg text-muted-foreground text-sm">
              No hay movimientos financieros suficientes en el período para construir el diagrama de Sankey.
            </div>
          ) : (
            <SankeyFlowChart
              data={sankeyData}
              transactions={transactions}
              displayCurrency="USD"
              currencySymbol="US$"
              cx={(val) => val}
            />
          )}
        </CardContent>
      </Card>

      {/* QUICK SELL DIALOG INTEGRATION */}
      <QuickSellDialog
        open={quickSellOpen}
        onOpenChange={setQuickSellOpen}
        holding={selectedHoldingForSell}
        currentPrice={sellCurrentPrice}
        currencySymbol="US$"
        displayCurrency="USD"
        mepRate={mepRate}
        trades={trades}
        onSuccessClosedSummary={handleQuickSellSuccess}
      />

      {/* CLOSED POSITION SUMMARY DIALOG */}
      <ClosedPositionSummaryDialog
        open={closedSummaryOpen}
        onOpenChange={setClosedSummaryOpen}
        summary={closedSummaryData}
      />
    </div>
  );
}
