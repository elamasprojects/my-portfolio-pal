import { useState, useMemo } from "react";
import { useTrades, computeHoldings, Holding, Trade } from "@/hooks/usePortfolio";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { QuickSellDialog } from "@/components/QuickSellDialog";
import { MobileSwipeableHoldingCard } from "@/components/MobileSwipeableHoldingCard";
import { ClosedPositionSummaryDialog, ClosedPositionSummary } from "@/components/ClosedPositionSummaryDialog";
import { thesisForSymbol } from "@/lib/thesis";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ChessBadge } from "@/components/ui/ChessBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import {
  TrendingUp,
  PieChart as PieChartIcon,
  Search,
  Target,
  CheckCircle2,
  LayoutGrid,
  ListFilter,
  Smartphone,
  Layers,
  ArrowUpRight,
  TrendingDown,
} from "lucide-react";

const CHART_COLORS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#6366f1", // Indigo
  "#14b8a6", // Teal
  "#e11d48", // Rose
];

const RAD = Math.PI / 180;
const TICKER_MIN_PCT = 0.03; // 3%

const renderSliceLabel = (props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
  name?: string;
}) => {
  const { cx, cy, midAngle, outerRadius, percent, name } = props;
  if (cx == null || cy == null || midAngle == null || outerRadius == null || percent == null) return null;
  if (percent < TICKER_MIN_PCT) return null;
  const r = outerRadius + 14;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  const isLeft = x < cx;
  return (
    <text
      x={x}
      y={y}
      fill="currentColor"
      fontSize={11}
      fontWeight={700}
      textAnchor={isLeft ? "end" : "start"}
      dominantBaseline="central"
      className="fill-foreground font-mono"
    >
      {name}
    </text>
  );
};

export function TableroView() {
  const navigate = useNavigate();

  // Portfolio hooks
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { venta: mepRate = 1200 } = useDolarMEP();

  const holdings = useMemo(() => computeHoldings(trades), [trades]);
  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const { prices: marketPrices, isLoading: pricesLoading } = useMarketPrices(symbols);

  const [activePortfolioTab, setActivePortfolioTab] = useState<"allocation" | "table" | "cards">("allocation");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>("all");

  // Quick sell & closed summary dialogs
  const [quickSellOpen, setQuickSellOpen] = useState(false);
  const [selectedHoldingForSell, setSelectedHoldingForSell] = useState<Holding | null>(null);
  const [sellCurrentPrice, setSellCurrentPrice] = useState<number | null>(null);
  const [closedSummaryOpen, setClosedSummaryOpen] = useState(false);
  const [closedSummaryData, setClosedSummaryData] = useState<ClosedPositionSummary | null>(null);

  const effectiveCclRate = mepRate > 0 ? mepRate : 1200;

  // Compute live portfolio metrics (USD Native)
  const portfolioMetrics = useMemo(() => {
    let totalInvestedUSD = 0;
    let currentMarketValueUSD = 0;
    let totalTargetHits = 0;
    let totalInvalidations = 0;

    const holdingsEnriched = holdings.map((h) => {
      const livePriceUSD = marketPrices.get(h.symbol.toUpperCase()) || h.avg_cost;
      const positionCostUSD = h.avg_cost * h.net_quantity;
      const positionMarketValUSD = livePriceUSD * h.net_quantity;
      const unrealizedPnlUSD = positionMarketValUSD - positionCostUSD;
      const unrealizedPnlPct = positionCostUSD > 0 ? (unrealizedPnlUSD / positionCostUSD) * 100 : 0;

      totalInvestedUSD += positionCostUSD;
      currentMarketValueUSD += positionMarketValUSD;

      // Thesis levels come back USD-normalised, so they compare directly against the live
      // quote. This used to infer the currency from the magnitude (`> 1000` meant pesos),
      // which misread any sub-1000 ARS target as dollars.
      const thesis = thesisForSymbol(trades, h.symbol);
      const targetPriceUSD = thesis.targetPriceUSD ?? 0;
      // No declared stop level falls back to the 15% drawdown rule off the position's average
      // cost — `h.avg_cost`, the holding's. The trade row has no `avg_cost`, so reading one
      // off it yielded undefined and disabled the check entirely.
      const invalidationPriceUSD = thesis.invalidationPriceUSD ?? (h.avg_cost > 0 ? h.avg_cost * 0.85 : 0);

      const isTargetHit = targetPriceUSD > 0 && livePriceUSD >= targetPriceUSD;
      const isInvalidationHit = (invalidationPriceUSD > 0 && livePriceUSD <= invalidationPriceUSD) || unrealizedPnlPct <= -15;

      if (isTargetHit) totalTargetHits++;
      if (isInvalidationHit && !isTargetHit) totalInvalidations++;

      let targetProgressPct = 0;
      if (targetPriceUSD > 0 && livePriceUSD > 0) {
        targetProgressPct = Math.min(100, Math.max(0, (livePriceUSD / targetPriceUSD) * 100));
      }

      return {
        ...h,
        livePriceUSD,
        positionCostUSD,
        positionMarketValUSD,
        unrealizedPnlUSD,
        unrealizedPnlPct,
        targetPriceUSD,
        invalidationPriceUSD,
        isTargetHit,
        isInvalidationHit,
        targetProgressPct,
        entryThesis: thesis.entryThesis,
        invalidationCondition: thesis.invalidationCondition,
      };
    });

    const totalPnlUSD = currentMarketValueUSD - totalInvestedUSD;
    const totalPnlPct = totalInvestedUSD > 0 ? (totalPnlUSD / totalInvestedUSD) * 100 : 0;

    // Calculate exact weights
    const enrichedWithWeights = holdingsEnriched.map((h) => ({
      ...h,
      weight: currentMarketValueUSD > 0 ? (h.positionMarketValUSD / currentMarketValueUSD) * 100 : 0,
    })).sort((a, b) => b.positionMarketValUSD - a.positionMarketValUSD);

    return {
      totalInvestedUSD,
      currentMarketValueUSD,
      totalPnlUSD,
      totalPnlPct,
      totalTargetHits,
      totalInvalidations,
      holdingsEnriched: enrichedWithWeights,
    };
  }, [holdings, marketPrices, trades]);

  // Filtered holdings
  const filteredHoldings = useMemo(() => {
    return portfolioMetrics.holdingsEnriched.filter((h) => {
      const matchesSearch =
        h.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (h.asset_type && h.asset_type.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesCat =
        selectedCategoryFilter === "all" ||
        (h.asset_type && h.asset_type.toLowerCase() === selectedCategoryFilter.toLowerCase());

      return matchesSearch && matchesCat;
    });
  }, [portfolioMetrics.holdingsEnriched, searchTerm, selectedCategoryFilter]);

  // Donut Pie data
  const pieData = useMemo(() => {
    return portfolioMetrics.holdingsEnriched.map((h) => ({
      name: h.symbol,
      value: h.positionMarketValUSD,
    }));
  }, [portfolioMetrics.holdingsEnriched]);

  const topWeight = portfolioMetrics.holdingsEnriched[0]?.weight ?? 0;
  const assetTypesCount = new Set(portfolioMetrics.holdingsEnriched.map((i) => i.asset_type || "CEDEAR")).size;

  const handleOpenQuickSell = (holding: Holding, priceUSD: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedHoldingForSell(holding);
    setSellCurrentPrice(priceUSD);
    setQuickSellOpen(true);
  };

  const handleQuickSellSuccess = (summary: ClosedPositionSummary) => {
    setClosedSummaryData(summary);
    setClosedSummaryOpen(true);
  };

  const isLoading = tradesLoading || pricesLoading;

  return (
    <div className="space-y-6 pb-20">
      {/* 1. DAILY INVESTMENT HERO BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Portafolio de Inversiones
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visualización y gestión táctica de tus posiciones activas, avance a objetivos y composición.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs py-1 px-3 border-primary/30 text-primary bg-primary/10 font-mono">
            MEP: ${effectiveCclRate.toLocaleString("es-AR")}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/strategy")}
            className="text-xs font-semibold gap-1.5 border-border/60"
          >
            <Target className="h-3.5 w-3.5 text-primary" />
            Ver Tesis ({portfolioMetrics.holdingsEnriched.length})
          </Button>
        </div>
      </div>

      {/* Top 4 Real-time Investment KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Valuación Total */}
        <Card className="bg-card border border-border/70 p-4 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Valuación Total de Cartera
          </span>
          <div className="text-2xl font-black font-mono text-foreground">
            US$ {portfolioMetrics.currentMarketValueUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            ≈ ${(portfolioMetrics.currentMarketValueUSD * effectiveCclRate).toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
          </p>
        </Card>

        {/* KPI 2: Capital Invertido */}
        <Card className="bg-card border border-border/70 p-4 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Capital Invertido
          </span>
          <div className="text-2xl font-black font-mono text-foreground">
            US$ {portfolioMetrics.totalInvestedUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {holdings.length} posiciones abiertas
          </p>
        </Card>

        {/* KPI 3: Retorno Total P&L */}
        <Card className="bg-card border border-border/70 p-4 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Retorno Total (P&L)
          </span>
          <div
            className={`text-2xl font-black font-mono ${
              portfolioMetrics.totalPnlUSD >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {portfolioMetrics.totalPnlUSD >= 0 ? "+" : ""}US${" "}
            {portfolioMetrics.totalPnlUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span className="text-sm ml-1.5 font-bold">
              ({portfolioMetrics.totalPnlPct >= 0 ? "+" : ""}{portfolioMetrics.totalPnlPct.toFixed(2)}%)
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground">Rendimiento acumulado en moneda dura</p>
        </Card>

        {/* KPI 4: Alertas de Tesis */}
        <Card className="bg-card border border-border/70 p-4 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Alertas de Salida / Target
          </span>
          <div className="flex items-center gap-3 pt-0.5">
            {portfolioMetrics.totalTargetHits > 0 ? (
              <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-lg">
                <ChessBadge evaluation="brillante" circleOnly size="sm" />
                <span>{portfolioMetrics.totalTargetHits} en Target</span>
              </div>
            ) : portfolioMetrics.totalInvalidations > 0 ? (
              <div className="flex items-center gap-1.5 text-amber-400 font-bold text-lg">
                <ChessBadge evaluation="imprecision" circleOnly size="sm" />
                <span>{portfolioMetrics.totalInvalidations} en Invalidación</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-muted-foreground text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Posiciones en curso</span>
              </div>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground">
            {portfolioMetrics.totalTargetHits > 0
              ? "🎯 Oportunidad de toma de ganancias"
              : "Revisión de hipótesis activa"}
          </p>
        </Card>
      </div>

      {/* 2. MULTI-VIEW SELECTOR: ALLOCATION (DONUT) | TABLE (TERMINAL) | CARDS */}
      <Card className="bg-card border border-border/80 shadow-md">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <LayoutGrid className="h-5 w-5 text-primary" />
                Explorador de Portafolio ({filteredHoldings.length})
              </CardTitle>
              <CardDescription className="text-xs">
                Elige tu forma favorita de ver tu cartera: Distribución (Donut), Tabla Terminal o Cards.
              </CardDescription>
            </div>

            {/* View Mode Switcher */}
            <Tabs
              value={activePortfolioTab}
              onValueChange={(val: any) => setActivePortfolioTab(val)}
              className="w-full sm:w-auto"
            >
              <TabsList className="grid grid-cols-3 bg-muted/60 p-1 rounded-xl">
                <TabsTrigger value="allocation" className="text-xs font-semibold flex items-center gap-1.5">
                  <PieChartIcon className="h-3.5 w-3.5" />
                  <span>Distribución</span>
                </TabsTrigger>
                <TabsTrigger value="table" className="text-xs font-semibold flex items-center gap-1.5">
                  <ListFilter className="h-3.5 w-3.5" />
                  <span>Tabla PnL</span>
                </TabsTrigger>
                <TabsTrigger value="cards" className="text-xs font-semibold flex items-center gap-1.5">
                  <Smartphone className="h-3.5 w-3.5" />
                  <span>Cards Mobile</span>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Filter and Search Bar for Table & Cards */}
          {activePortfolioTab !== "allocation" && (
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Buscar activo por símbolo (ej. AAPL, BTC, GGAL)..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 h-9 text-xs bg-background/80"
                />
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
                {["all", "cedear", "crypto", "equity", "bond"].map((cat) => (
                  <Button
                    key={cat}
                    variant={selectedCategoryFilter === cat ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedCategoryFilter(cat)}
                    className="h-8 text-xs px-3 rounded-full uppercase text-[10px] font-bold shrink-0"
                  >
                    {cat === "all" ? "Todos" : cat}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* TAB 1: ALLOCATION DONUT (V4 UI FROM PR #2) */}
          {activePortfolioTab === "allocation" && (
            <div className="space-y-6">
              {/* Donut Hero */}
              <div className="relative h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius="54%"
                      outerRadius="76%"
                      paddingAngle={1.5}
                      isAnimationActive={false}
                      label={renderSliceLabel}
                      labelLine={false}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="hsl(var(--card))" strokeWidth={2} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Total Cartera</p>
                  <p className="font-mono text-2xl font-black text-foreground">
                    US$ {portfolioMetrics.currentMarketValueUSD.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{portfolioMetrics.holdingsEnriched.length} posiciones activas</p>
                </div>
              </div>

              {/* 3 Metrics Tiles */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-background/60 border border-border/60 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Posiciones</p>
                  <p className="text-xl font-bold font-mono text-foreground mt-0.5">{portfolioMetrics.holdingsEnriched.length}</p>
                </div>
                <div className="p-3 rounded-xl bg-background/60 border border-border/60 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Mayor Ponderación</p>
                  <p className={`text-xl font-bold font-mono mt-0.5 ${topWeight > 25 ? "text-amber-400" : "text-foreground"}`}>
                    {topWeight.toFixed(1)}%
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-background/60 border border-border/60 text-center">
                  <p className="text-[10px] uppercase text-muted-foreground font-semibold">Tipos de Activos</p>
                  <p className="text-xl font-bold font-mono text-foreground mt-0.5">{assetTypesCount}</p>
                </div>
              </div>

              {/* Weights list with color progress bars */}
              <div className="space-y-3 pt-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ponderación por Activo</h3>
                <div className="space-y-2.5">
                  {portfolioMetrics.holdingsEnriched.map((h, i) => (
                    <div key={h.symbol} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                          />
                          <span className="font-mono font-bold text-foreground">{h.symbol}</span>
                          <span className="text-xs text-muted-foreground uppercase font-mono">
                            · US$ {h.positionMarketValUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </span>
                        <span className="shrink-0 font-mono font-bold text-foreground">{h.weight.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/70 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full"
                          style={{
                            width: `${Math.min(100, h.weight)}%`,
                            backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: FULL TERMINAL PNL TABLE */}
          {activePortfolioTab === "table" && (
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent text-xs">
                    <TableHead>Activo / Símbolo</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Precio Compra</TableHead>
                    <TableHead className="text-right">Precio Actual</TableHead>
                    <TableHead className="text-right">Valuación Total</TableHead>
                    <TableHead className="text-right">P&L Latente</TableHead>
                    <TableHead className="text-center w-[140px]">Avance al Target</TableHead>
                    <TableHead className="text-center">Acción</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                        Cargando precios en vivo...
                      </TableCell>
                    </TableRow>
                  ) : filteredHoldings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                        No se encontraron posiciones activas con los filtros aplicados.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredHoldings.map((h) => {
                      const isGain = h.unrealizedPnlUSD >= 0;
                      return (
                        <TableRow key={h.symbol} className="hover:bg-muted/40 text-sm">
                          <TableCell className="font-bold text-foreground">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-base">{h.symbol}</span>
                              <Badge variant="outline" className="text-[10px] uppercase">
                                {h.asset_type || "activo"}
                              </Badge>
                              {h.isTargetHit && (
                                <ChessBadge evaluation="brillante" label="Target Alcanzado" size="xs" />
                              )}
                              {h.isInvalidationHit && !h.isTargetHit && (
                                <ChessBadge evaluation="imprecision" label="Invalidación" size="xs" />
                              )}
                            </div>
                            {h.entryThesis && (
                              <span className="text-[10px] text-muted-foreground block truncate max-w-[220px] font-normal">
                                {h.entryThesis}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-medium">
                            {h.net_quantity.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            US$ {h.avg_cost.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-foreground">
                            US$ {h.livePriceUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold">
                            US$ {h.positionMarketValUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            <span className={`font-bold block ${isGain ? "text-emerald-400" : "text-rose-400"}`}>
                              {isGain ? "+" : ""}US${" "}
                              {h.unrealizedPnlUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className={`text-[10px] block ${isGain ? "text-emerald-400/80" : "text-rose-400/80"}`}>
                              {isGain ? "+" : ""}{h.unrealizedPnlPct.toFixed(2)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="space-y-1">
                              <Progress value={h.targetProgressPct} className="h-1.5" />
                              <span className="text-[10px] text-muted-foreground font-mono block">
                                {h.targetPriceUSD > 0
                                  ? `${h.targetProgressPct.toFixed(0)}% (Target US$ ${h.targetPriceUSD.toFixed(2)})`
                                  : "Sin Target"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              variant={h.isTargetHit ? "default" : "outline"}
                              size="sm"
                              className={`h-7 text-xs px-2.5 font-semibold ${
                                h.isTargetHit
                                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                                  : h.isInvalidationHit
                                  ? "bg-amber-500/15 text-amber-400 border-amber-500/30 hover:bg-amber-500/25"
                                  : "border-border/60"
                              }`}
                              onClick={(e) => handleOpenQuickSell(h, h.livePriceUSD, e)}
                            >
                              {h.isTargetHit ? "✓ Salida Planificada" : h.isInvalidationHit ? "⚠️ Salir (Stop)" : "Vender"}
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {/* TAB 3: MOBILE CARDS VIEW */}
          {activePortfolioTab === "cards" && (
            <div className="space-y-3">
              {filteredHoldings.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground text-sm">No hay posiciones activas.</p>
              ) : (
                filteredHoldings.map((h) => (
                  <MobileSwipeableHoldingCard
                    key={h.symbol}
                    // The card reads the live price off the holding (`currentPrice`), and needs
                    // its formatters and navigation callback. It was previously handed
                    // `currentPrice`/`displayCurrency`, which it does not accept, so it rendered
                    // without a price and its tap-through did nothing.
                    holding={{
                      ...h,
                      currentPrice: h.livePriceUSD,
                      mktVal: h.positionMarketValUSD,
                      uPnl: h.unrealizedPnlUSD,
                      uPnlPct: h.unrealizedPnlPct,
                    }}
                    pricesLoading={pricesLoading}
                    currencySymbol="US$"
                    cx={(val) => val}
                    fmtCompact={(val) =>
                      val.toLocaleString("en-US", { maximumFractionDigits: 2 })
                    }
                    onNavigate={(symbol) => navigate(`/asset/${symbol}`)}
                    onQuickSell={(holding, price) => handleOpenQuickSell(holding, price || h.livePriceUSD)}
                  />
                ))
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QUICK SELL DIALOG */}
      <QuickSellDialog
        open={quickSellOpen}
        onOpenChange={setQuickSellOpen}
        holding={selectedHoldingForSell}
        currentPrice={sellCurrentPrice}
        currencySymbol="US$"
        displayCurrency="USD"
        mepRate={effectiveCclRate}
        trades={trades}
        // The prop is `onSuccessClosedSummary`; under the old name the celebration dialog
        // never received a summary and never opened.
        onSuccessClosedSummary={handleQuickSellSuccess}
      />

      {/* CLOSED POSITION SUMMARY CELEBRATION MODAL */}
      <ClosedPositionSummaryDialog
        open={closedSummaryOpen}
        onOpenChange={setClosedSummaryOpen}
        summary={closedSummaryData}
        currencySymbol="US$"
      />
    </div>
  );
}
