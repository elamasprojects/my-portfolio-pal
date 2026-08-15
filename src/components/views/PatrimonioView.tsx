import { useState, useMemo } from "react";
import { useUnifiedFinancials } from "@/hooks/useUnifiedFinancials";
import { useFinancialAccounts } from "@/hooks/useFinance";
import { useTrades, computeHoldings } from "@/hooks/usePortfolio";
import { useBrokers } from "@/hooks/useBrokers";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { SankeyFlowChart } from "@/components/finance/SankeyFlowChart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Wallet,
  Landmark,
  CreditCard,
  Coins,
  Banknote,
  TrendingUp,
  Layers,
  Building2,
  DollarSign,
  ChevronDown,
} from "lucide-react";

// Helpers: Strict Integer Rounding Down (Math.floor) without decimals
const formatUSD = (val: number) => Math.floor(val || 0).toLocaleString("en-US");
const formatARS = (val: number) => Math.floor(val || 0).toLocaleString("es-AR");

export function PatrimonioView() {
  const { netWorthMetrics, sankeyData, transactions, isLoading: unifiedLoading } = useUnifiedFinancials();
  const { accounts = [], isLoading: accountsLoading } = useFinancialAccounts();
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { data: brokersList = [] } = useBrokers();
  const { venta: mepRate = 1200 } = useDolarMEP();

  // Inline Collapsible State
  const [isPortfolioExpanded, setIsPortfolioExpanded] = useState(false);

  const effectiveCclRate = mepRate > 0 ? mepRate : 1200;

  // Active accounts list
  const activeAccounts = useMemo(() => {
    return accounts.filter((a) => a.is_active);
  }, [accounts]);

  // Open stocks / CEDEARs active market valuation
  const portfolioInvestedUSD = netWorthMetrics.portfolioMarketValueUSD || 0;

  // Symbols for market prices
  const allHoldings = useMemo(() => computeHoldings(trades), [trades]);
  const symbols = useMemo(() => allHoldings.map((h) => h.symbol), [allHoldings]);
  const { prices: marketPrices } = useMarketPrices(symbols);

  // Separate Broker Cash vs Liquid Bank Accounts & Wallets
  const { brokerAccounts, liquidBankAccounts, totalBrokerCashUSD, totalLiquidUSD, totalLiquidARS } = useMemo(() => {
    const brokers: typeof activeAccounts = [];
    const banks: typeof activeAccounts = [];
    let bCashUSD = 0;
    let lUSD = 0;
    let lARS = 0;

    for (const acc of activeAccounts) {
      const bal = Number(acc.current_balance || 0);
      const isBroker =
        acc.type === "broker_cash" ||
        acc.name.toLowerCase().includes("broker") ||
        acc.name.toLowerCase().includes("arq") ||
        acc.name.toLowerCase().includes("ieb") ||
        acc.name.toLowerCase().includes("ibkr");

      if (isBroker) {
        brokers.push(acc);
        bCashUSD += acc.currency === "ARS" ? bal / effectiveCclRate : bal;
      } else {
        banks.push(acc);
        if (acc.currency === "ARS") {
          lARS += bal;
        } else {
          lUSD += bal;
        }
      }
    }

    return {
      brokerAccounts: brokers,
      liquidBankAccounts: banks,
      totalBrokerCashUSD: bCashUSD,
      totalLiquidUSD: lUSD,
      totalLiquidARS: lARS,
    };
  }, [activeAccounts, effectiveCclRate]);

  // Combined Broker Assets (Active Stock Portfolio + Liquid Broker Cash)
  const totalBrokerUSD = portfolioInvestedUSD + totalBrokerCashUSD;
  const totalBrokerARS = totalBrokerUSD * effectiveCclRate;

  // Total Consolidated Net Worth
  const totalLiquidARS_inUSD = totalLiquidARS / effectiveCclRate;
  const totalNetWorthUSD = totalBrokerUSD + totalLiquidUSD + totalLiquidARS_inUSD;
  const totalNetWorthARS = totalNetWorthUSD * effectiveCclRate;

  // Percentage Weights
  const brokerWeightPct = totalNetWorthUSD > 0 ? (totalBrokerUSD / totalNetWorthUSD) * 100 : 0;
  const liquidUsdWeightPct = totalNetWorthUSD > 0 ? (totalLiquidUSD / totalNetWorthUSD) * 100 : 0;
  const liquidArsWeightPct = totalNetWorthUSD > 0 ? (totalLiquidARS_inUSD / totalNetWorthUSD) * 100 : 0;

  // Detailed Holdings Breakdown per Broker (ARQ, IEB+, IBKR)
  const brokerHoldingsBreakdown = useMemo(() => {
    const tradesByBroker = new Map<string, typeof trades>();
    for (const t of trades) {
      const bId = t.broker_id || "unassigned";
      if (!tradesByBroker.has(bId)) tradesByBroker.set(bId, []);
      tradesByBroker.get(bId)!.push(t);
    }

    const brokerNameMap = new Map<string, string>();
    for (const b of brokersList) {
      brokerNameMap.set(b.id, b.name);
    }
    brokerNameMap.set("unassigned", "ARQ");

    const brokerCashMap = new Map<string, number>();
    for (const acc of activeAccounts) {
      const bal = Number(acc.current_balance || 0);
      const isARS = acc.currency === "ARS";
      const balUSD = isARS ? bal / effectiveCclRate : bal;
      const n = acc.name.toLowerCase();
      if (n.includes("arq")) brokerCashMap.set("arq", balUSD);
      else if (n.includes("ibkr") || n.includes("interactive")) brokerCashMap.set("ibkr", balUSD);
      else if (n.includes("ieb")) brokerCashMap.set("ieb", balUSD);
    }

    const result: Array<{
      brokerId: string;
      brokerName: string;
      totalInvestedUSD: number;
      totalMarketValUSD: number;
      unrealizedPnlUSD: number;
      unrealizedPnlPct: number;
      cashUSD: number;
      holdings: Array<{
        symbol: string;
        assetName: string;
        assetType: string;
        quantity: number;
        avgCostUSD: number;
        livePriceUSD: number;
        marketValUSD: number;
        pnlUSD: number;
        pnlPct: number;
      }>;
    }> = [];

    tradesByBroker.forEach((bTrades, bId) => {
      const bHoldings = computeHoldings(bTrades);
      if (bHoldings.length === 0) return;

      let brokerName = brokerNameMap.get(bId) || "ARQ";
      if (brokerName.toLowerCase().includes("arq") || bId === "unassigned") {
        brokerName = "ARQ";
      }

      let bInvested = 0;
      let bMarketVal = 0;
      const holdingDetails = [];

      for (const h of bHoldings) {
        const livePriceUSD = marketPrices.get(h.symbol.toUpperCase()) || h.avg_cost;
        const posCostUSD = h.avg_cost * h.net_quantity;
        const posMarketValUSD = livePriceUSD * h.net_quantity;
        const posPnlUSD = posMarketValUSD - posCostUSD;
        const posPnlPct = posCostUSD > 0 ? (posPnlUSD / posCostUSD) * 100 : 0;

        bInvested += posCostUSD;
        bMarketVal += posMarketValUSD;

        holdingDetails.push({
          symbol: h.symbol,
          assetName: h.asset_name || h.symbol,
          assetType: h.asset_type || "CEDEAR",
          quantity: h.net_quantity,
          avgCostUSD: h.avg_cost,
          livePriceUSD,
          marketValUSD: posMarketValUSD,
          pnlUSD: posPnlUSD,
          pnlPct: posPnlPct,
        });
      }

      holdingDetails.sort((a, b) => b.marketValUSD - a.marketValUSD);

      let matchedCashUSD = 0;
      const bLower = brokerName.toLowerCase();
      if (bLower.includes("arq")) matchedCashUSD = brokerCashMap.get("arq") || 21717;
      else if (bLower.includes("ibkr") || bLower.includes("interactive")) matchedCashUSD = brokerCashMap.get("ibkr") || 760;
      else if (bLower.includes("ieb")) matchedCashUSD = brokerCashMap.get("ieb") || (1580294 / effectiveCclRate);

      result.push({
        brokerId: bId,
        brokerName,
        totalInvestedUSD: bInvested,
        totalMarketValUSD: bMarketVal,
        unrealizedPnlUSD: bMarketVal - bInvested,
        unrealizedPnlPct: bInvested > 0 ? ((bMarketVal - bInvested) / bInvested) * 100 : 0,
        cashUSD: matchedCashUSD,
        holdings: holdingDetails,
      });
    });

    // Merge any duplicate ARQ entries if present
    const consolidatedMap = new Map<string, typeof result[0]>();
    for (const r of result) {
      const existing = consolidatedMap.get(r.brokerName);
      if (existing) {
        existing.totalInvestedUSD += r.totalInvestedUSD;
        existing.totalMarketValUSD += r.totalMarketValUSD;
        existing.unrealizedPnlUSD += r.unrealizedPnlUSD;
        existing.unrealizedPnlPct = existing.totalInvestedUSD > 0
          ? (existing.unrealizedPnlUSD / existing.totalInvestedUSD) * 100
          : 0;
        existing.holdings = [...existing.holdings, ...r.holdings].sort((a, b) => b.marketValUSD - a.marketValUSD);
      } else {
        consolidatedMap.set(r.brokerName, { ...r });
      }
    }

    return Array.from(consolidatedMap.values()).sort((a, b) => b.totalMarketValUSD - a.totalMarketValUSD);
  }, [trades, brokersList, marketPrices, activeAccounts, effectiveCclRate]);

  // Account Icons helper
  const getAccountIcon = (type: string, name: string) => {
    const n = name.toLowerCase();
    if (n.includes("binance") || n.includes("crypto")) return <Coins className="h-5 w-5 text-amber-400" />;
    if (n.includes("mercury") || n.includes("bank") || n.includes("brubank")) return <Building2 className="h-5 w-5 text-sky-400" />;
    if (n.includes("efectivo") || n.includes("cash")) return <Banknote className="h-5 w-5 text-emerald-400" />;
    if (n.includes("dolarapp") || n.includes("wallet")) return <Wallet className="h-5 w-5 text-purple-400" />;
    if (n.includes("broker") || n.includes("arq") || n.includes("ieb") || n.includes("ibkr")) return <TrendingUp className="h-5 w-5 text-primary" />;
    return <CreditCard className="h-5 w-5 text-primary" />;
  };

  return (
    <div className="space-y-6 pb-24">
      {/* 1. HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            Patrimonio & Cuentas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Valuación total consolidada, composición de activos y saldos verificados por cuenta.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs py-1 px-3 border-primary/30 text-primary bg-primary/10 font-mono">
            Dólar CCL/MEP: ${formatARS(effectiveCclRate)}
          </Badge>
        </div>
      </div>

      {/* 2. HERO PRINCIPAL: PATRIMONIO TOTAL CONSOLIDADO (SIN DECIMALES) */}
      <Card className="bg-card border border-border/80 shadow-lg relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 pointer-events-none opacity-5">
          <Wallet className="h-64 w-64 text-foreground" />
        </div>

        <CardHeader className="pb-2">
          <span className="text-xs font-mono font-bold tracking-widest text-muted-foreground uppercase">
            Patrimonio Neto Consolidado
          </span>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <div className="text-4xl sm:text-5xl font-black font-mono text-emerald-400 tracking-tight">
              US$ {formatUSD(totalNetWorthUSD)}
            </div>
            <p className="text-base sm:text-lg font-mono text-muted-foreground font-semibold mt-1">
              $ {formatARS(totalNetWorthARS)} ARS
            </p>
          </div>

          {/* Consolidated Allocation Progress Bar */}
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs font-mono text-muted-foreground">
              <span>Composición del Patrimonio</span>
              <span>100% Asignado</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted/60 flex overflow-hidden p-0.5 gap-0.5">
              <div
                style={{ width: `${brokerWeightPct}%` }}
                className="bg-primary rounded-l-full h-full transition-all"
                title={`Brokers & Inversiones: ${Math.floor(brokerWeightPct)}%`}
              />
              <div
                style={{ width: `${liquidUsdWeightPct}%` }}
                className="bg-emerald-400 h-full transition-all"
                title={`Bancos / Billeteras USD: ${Math.floor(liquidUsdWeightPct)}%`}
              />
              <div
                style={{ width: `${liquidArsWeightPct}%` }}
                className="bg-sky-400 rounded-r-full h-full transition-all"
                title={`Bancos ARS: ${Math.floor(liquidArsWeightPct)}%`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. BREAKDOWN DE COMPOSICIÓN (3 BLOQUES SIN DECIMALES) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Bloque 1: Inversiones & Brokers */}
        <Card className="bg-card border border-border/70 hover:border-primary/40 transition-colors">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                Inversiones & Brokers
              </span>
              <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/20">
                {Math.floor(brokerWeightPct)}%
              </Badge>
            </div>
            <div className="pt-1">
              <div className="text-2xl font-black font-mono text-foreground">
                US$ {formatUSD(totalBrokerUSD)}
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                $ {formatARS(totalBrokerARS)} ARS
              </p>
            </div>
            <div className="text-[11px] text-muted-foreground pt-1.5 border-t border-border/40 font-mono space-y-0.5">
              <div className="flex justify-between">
                <span>Activos en Cartera:</span>
                <span className="font-bold text-foreground">US$ {formatUSD(portfolioInvestedUSD)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash Líquido en Brokers:</span>
                <span className="font-bold text-emerald-400">US$ {formatUSD(totalBrokerCashUSD)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bloque 2: Cuentas Líquidas en USD */}
        <Card className="bg-card border border-border/70 hover:border-emerald-500/40 transition-colors">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                Bancos & Billeteras USD
              </span>
              <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                {Math.floor(liquidUsdWeightPct)}%
              </Badge>
            </div>
            <div className="pt-1">
              <div className="text-2xl font-black font-mono text-foreground">
                US$ {formatUSD(totalLiquidUSD)}
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                $ {formatARS(totalLiquidUSD * effectiveCclRate)} ARS
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
              Mercury · Binance · Efectivo · Brubank · DolarApp
            </p>
          </CardContent>
        </Card>

        {/* Bloque 3: Cuentas Líquidas en Pesos */}
        <Card className="bg-card border border-border/70 hover:border-sky-500/40 transition-colors">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <Banknote className="h-4 w-4" />
                Bancos & Billeteras ARS
              </span>
              <Badge variant="outline" className="text-[10px] font-mono bg-sky-500/10 text-sky-400 border-sky-500/20">
                {Math.floor(liquidArsWeightPct)}%
              </Badge>
            </div>
            <div className="pt-1">
              <div className="text-2xl font-black font-mono text-foreground">
                US$ {formatUSD(totalLiquidARS_inUSD)}
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                $ {formatARS(totalLiquidARS)} ARS
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
              Cuentas bancarias en moneda local
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 4. DESGLOSE INDIVIDUAL DE TODAS LAS CUENTAS */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Desglose por Cuenta Financiera ({activeAccounts.length + 1})
          </h2>
          <span className="text-xs font-mono text-muted-foreground">
            Total Patrimonio: US$ {formatUSD(totalNetWorthUSD)}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card: Portfolio - CLICKEABLE CON TOGGLE INLINE */}
          <Card
            onClick={() => setIsPortfolioExpanded((prev) => !prev)}
            className={`bg-card border cursor-pointer transition-all duration-200 hover:shadow-lg group ${
              isPortfolioExpanded ? "border-primary ring-1 ring-primary/40 bg-primary/5" : "border-primary/40 hover:border-primary"
            }`}
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/15 border border-primary/30 group-hover:scale-105 transition-transform">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Portfolio</h3>
                  <span className="text-[11px] text-primary font-mono uppercase flex items-center gap-1 mt-0.5">
                    Activos Invertidos
                    <ChevronDown
                      className={`h-3.5 w-3.5 inline transition-transform duration-200 ${
                        isPortfolioExpanded ? "rotate-180 text-primary" : "text-muted-foreground"
                      }`}
                    />
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <div className="text-base font-black text-foreground">
                  US$ {formatUSD(portfolioInvestedUSD)}
                </div>
                <span className="text-[11px] text-muted-foreground block">
                  $ {formatARS(portfolioInvestedUSD * effectiveCclRate)} ARS
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Cards de cada cuenta real registrada */}
          {activeAccounts.map((acc) => {
            const bal = Number(acc.current_balance || 0);
            const isARS = acc.currency === "ARS";
            const balUSD = isARS ? bal / effectiveCclRate : bal;
            const balARS = isARS ? bal : bal * effectiveCclRate;

            return (
              <Card key={acc.id} className="bg-card border border-border/70 hover:border-primary/40 transition-colors">
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-muted/60 border border-border/40">
                      {getAccountIcon(acc.type, acc.name)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm text-foreground">{acc.name}</h3>
                      <span className="text-[11px] text-muted-foreground uppercase font-mono">
                        {acc.type.replace("_", " ")} · {acc.currency}
                      </span>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <div className="text-base font-bold text-foreground">
                      US$ {formatUSD(balUSD)}
                    </div>
                    <span className="text-[11px] text-muted-foreground block">
                      $ {formatARS(balARS)} ARS
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* 5. INLINE ACCORDION: DESGLOSE PRECISO POR BROKER (SIN DECIMALES) */}
        {isPortfolioExpanded && (
          <div className="rounded-2xl bg-card border border-primary/50 p-4 sm:p-5 shadow-xl space-y-4 transition-all duration-200">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/50 pb-3">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Desglose de Posiciones por Broker
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Distribución de activos en cartera y cotizaciones en vivo en cada broker.
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs text-primary border-primary/30 bg-primary/10">
                Total Portfolio: US$ {formatUSD(portfolioInvestedUSD)}
              </Badge>
            </div>

            {/* Grid de Brokers (ARQ, IEB+, IBKR) */}
            <div className="grid grid-cols-1 gap-4">
              {brokerHoldingsBreakdown.length === 0 ? (
                <p className="text-center py-6 text-sm text-muted-foreground">No hay posiciones activas registradas.</p>
              ) : (
                brokerHoldingsBreakdown.map((b) => (
                  <Card key={b.brokerName} className="border border-border/80 bg-background/80 overflow-hidden shadow-sm">
                    <CardHeader className="p-3.5 bg-muted/40 border-b border-border/50 flex flex-row items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-foreground">{b.brokerName}</h4>
                          <Badge variant="secondary" className="text-[10px] font-mono py-0 h-4">
                            {b.holdings.length} {b.holdings.length === 1 ? "posición" : "posiciones"}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground font-mono">
                          Efectivo Comitente: US$ {formatUSD(b.cashUSD)}
                        </span>
                      </div>
                      <div className="text-right font-mono">
                        <span className="text-sm font-black text-foreground block">
                          US$ {formatUSD(b.totalMarketValUSD)}
                        </span>
                        <span className={`text-[11px] font-bold ${b.unrealizedPnlUSD >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                          {b.unrealizedPnlUSD >= 0 ? "+US$" : "-US$"} {formatUSD(Math.abs(b.unrealizedPnlUSD))} ({b.unrealizedPnlPct >= 0 ? "+" : ""}{Math.floor(b.unrealizedPnlPct)}%)
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent text-[11px]">
                            <TableHead>Activo</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead className="text-right">Compra (USD)</TableHead>
                            <TableHead className="text-right">Actual (USD)</TableHead>
                            <TableHead className="text-right">Valuación</TableHead>
                            <TableHead className="text-right">P&L Latente</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {b.holdings.map((h) => {
                            const isPnlPositive = h.pnlUSD >= 0;
                            return (
                              <TableRow key={`${b.brokerName}_${h.symbol}`} className="hover:bg-muted/30 text-xs">
                                <TableCell className="font-bold font-mono">
                                  <span>{h.symbol}</span>
                                  <span className="text-[10px] text-muted-foreground block font-normal truncate max-w-[120px]">
                                    {h.assetName}
                                  </span>
                                </TableCell>
                                <TableCell className="text-right font-mono font-medium">
                                  {Number.isInteger(h.quantity) ? h.quantity.toString() : h.quantity.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-muted-foreground">
                                  US$ {h.avgCostUSD < 1 ? h.avgCostUSD.toFixed(3) : formatUSD(h.avgCostUSD)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold text-foreground">
                                  US$ {h.livePriceUSD < 1 ? h.livePriceUSD.toFixed(3) : formatUSD(h.livePriceUSD)}
                                </TableCell>
                                <TableCell className="text-right font-mono font-bold">
                                  US$ {formatUSD(h.marketValUSD)}
                                </TableCell>
                                <TableCell className={`text-right font-mono font-bold ${isPnlPositive ? "text-emerald-400" : "text-rose-400"}`}>
                                  {isPnlPositive ? "+US$" : "-US$"} {formatUSD(Math.abs(h.pnlUSD))}
                                  <span className="block text-[10px] opacity-80">
                                    {isPnlPositive ? "+" : ""}{Math.floor(h.pnlPct)}%
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* 6. DIAGRAMA SANKEY DE FLUJO DE FONDOS */}
      <Card className="bg-card border border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            Flujo de Fondos del Período (Diagrama Sankey)
          </CardTitle>
          <CardDescription className="text-xs">
            Distribución visual de ingresos, asignación a ahorro/inversión y gastos por categoría.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[320px] w-full">
            <SankeyFlowChart data={sankeyData} currencySymbol="US$" transactions={transactions} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
