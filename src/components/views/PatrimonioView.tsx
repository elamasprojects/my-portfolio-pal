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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
  ChevronRight,
  ExternalLink,
} from "lucide-react";

export function PatrimonioView() {
  const { netWorthMetrics, sankeyData, transactions, isLoading: unifiedLoading } = useUnifiedFinancials();
  const { accounts = [], isLoading: accountsLoading } = useFinancialAccounts();
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { data: brokersList = [] } = useBrokers();
  const { venta: mepRate = 1200 } = useDolarMEP();

  const [brokerModalOpen, setBrokerModalOpen] = useState(false);

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

  // Detailed Holdings Breakdown per Broker
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
    brokerNameMap.set("unassigned", "ARQ / Broker Principal");

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

      const brokerName = brokerNameMap.get(bId) || "Broker";
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
      if (bLower.includes("arq") || bId === "unassigned") matchedCashUSD = brokerCashMap.get("arq") || 0;
      else if (bLower.includes("ibkr") || bLower.includes("interactive")) matchedCashUSD = brokerCashMap.get("ibkr") || 0;
      else if (bLower.includes("ieb")) matchedCashUSD = brokerCashMap.get("ieb") || 0;

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

    return result.sort((a, b) => b.totalMarketValUSD - a.totalMarketValUSD);
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
            Dólar CCL/MEP: ${effectiveCclRate.toLocaleString("es-AR")}
          </Badge>
        </div>
      </div>

      {/* 2. HERO PRINCIPAL: PATRIMONIO TOTAL CONSOLIDADO (USD ARRIBA, PESOS EN GRIS ABAJO) */}
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
              US$ {totalNetWorthUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-base sm:text-lg font-mono text-muted-foreground font-semibold mt-1">
              $ {totalNetWorthARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
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
                title={`Brokers & Inversiones: ${brokerWeightPct.toFixed(1)}%`}
              />
              <div
                style={{ width: `${liquidUsdWeightPct}%` }}
                className="bg-emerald-400 h-full transition-all"
                title={`Bancos / Billeteras USD: ${liquidUsdWeightPct.toFixed(1)}%`}
              />
              <div
                style={{ width: `${liquidArsWeightPct}%` }}
                className="bg-sky-400 rounded-r-full h-full transition-all"
                title={`Bancos ARS: ${liquidArsWeightPct.toFixed(1)}%`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. BREAKDOWN DE COMPOSICIÓN (3 BLOQUES: BROKERS, LÍQUIDO USD, LÍQUIDO ARS) */}
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
                {brokerWeightPct.toFixed(1)}%
              </Badge>
            </div>
            <div className="pt-1">
              <div className="text-2xl font-black font-mono text-foreground">
                US$ {totalBrokerUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                $ {totalBrokerARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
              </p>
            </div>
            <div className="text-[11px] text-muted-foreground pt-1.5 border-t border-border/40 font-mono space-y-0.5">
              <div className="flex justify-between">
                <span>Activos en Cartera:</span>
                <span className="font-bold text-foreground">US$ {portfolioInvestedUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between">
                <span>Cash en Brokers (ARQ/IBKR/IEB):</span>
                <span className="font-bold text-emerald-400">US$ {totalBrokerCashUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
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
                {liquidUsdWeightPct.toFixed(1)}%
              </Badge>
            </div>
            <div className="pt-1">
              <div className="text-2xl font-black font-mono text-foreground">
                US$ {totalLiquidUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                $ {(totalLiquidUSD * effectiveCclRate).toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
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
                {liquidArsWeightPct.toFixed(1)}%
              </Badge>
            </div>
            <div className="pt-1">
              <div className="text-2xl font-black font-mono text-foreground">
                US$ {totalLiquidARS_inUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                $ {totalLiquidARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1.5 border-t border-border/40">
              Cuentas bancarias en moneda local
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 4. DESGLOSE INDIVIDUAL DE TODAS LAS CUENTAS (CON CLICK PARA VER DESGLOSE POR BROKER) */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Desglose por Cuenta Financiera ({activeAccounts.length + 1})
          </h2>
          <span className="text-xs font-mono text-muted-foreground">
            Total Patrimonio: US$ {totalNetWorthUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card: Portafolio de Acciones (Activos Invertidos) - CLICKEABLE */}
          <Card
            onClick={() => setBrokerModalOpen(true)}
            className="bg-card border border-primary/40 hover:border-primary cursor-pointer transition-all duration-200 hover:shadow-lg group"
          >
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/15 border border-primary/30 group-hover:scale-105 transition-transform">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-bold text-sm text-foreground">Portafolio Acciones / CEDEARs</h3>
                    <Badge variant="outline" className="text-[9px] font-mono bg-primary/10 text-primary border-primary/30 py-0 px-1.5">
                      Ver por Broker
                    </Badge>
                  </div>
                  <span className="text-[11px] text-primary font-mono uppercase flex items-center gap-1 mt-0.5">
                    Activos Invertidos <ChevronRight className="h-3 w-3 inline" />
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <div className="text-base font-black text-foreground">
                  US$ {portfolioInvestedUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-muted-foreground block">
                  $ {(portfolioInvestedUSD * effectiveCclRate).toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
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
                      US$ {balUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <span className="text-[11px] text-muted-foreground block">
                      $ {balARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* 5. MODAL INTERACTIVO: DESGLOSE DE ACTIVOS INVERTIDOS POR BROKER */}
      <Dialog open={brokerModalOpen} onOpenChange={setBrokerModalOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto bg-card border-border p-6 space-y-5">
          <DialogHeader className="pb-2 border-b border-border/40">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Desglose de Inversiones por Broker
            </DialogTitle>
            <DialogDescription className="text-xs">
              Detalle de activos en cartera y cotizaciones en vivo en cada cuenta de broker.
            </DialogDescription>
          </DialogHeader>

          {/* Resumen Superior */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-background/80 border border-border/60">
            <div>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Total Invertido en Activos</span>
              <span className="text-xl font-black font-mono text-foreground">
                US$ {portfolioInvestedUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono block">
                ≈ ${(portfolioInvestedUSD * effectiveCclRate).toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Cash Comitente Líquido</span>
              <span className="text-xl font-black font-mono text-emerald-400">
                US$ {totalBrokerCashUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[10px] text-muted-foreground font-mono block">
                ARQ + IBKR + IEB+
              </span>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground block">Brokers con Posiciones</span>
              <span className="text-xl font-black font-mono text-primary">
                {brokerHoldingsBreakdown.length} Brokers Activos
              </span>
            </div>
          </div>

          {/* Lista de Brokers con sus Holdings */}
          <div className="space-y-4">
            {brokerHoldingsBreakdown.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">No hay posiciones activas registradas.</p>
            ) : (
              brokerHoldingsBreakdown.map((b) => (
                <Card key={b.brokerId} className="border border-border/70 bg-background/60 overflow-hidden">
                  <CardHeader className="p-4 bg-muted/40 border-b border-border/40 flex flex-row items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-base text-foreground">{b.brokerName}</h4>
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {b.holdings.length} posiciones
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground font-mono">
                        Valuación Activos: US$ {b.totalMarketValUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                        {b.cashUSD > 0 && ` · Cash: US$ ${b.cashUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>
                    <div className="text-right font-mono">
                      <span className="text-base font-black text-foreground block">
                        US$ {b.totalMarketValUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                      <span className={`text-xs font-bold ${b.unrealizedPnlUSD >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {b.unrealizedPnlUSD >= 0 ? "+" : ""}US$ {b.unrealizedPnlUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })} ({b.unrealizedPnlPct >= 0 ? "+" : ""}{b.unrealizedPnlPct.toFixed(1)}%)
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent text-xs">
                          <TableHead>Activo</TableHead>
                          <TableHead className="text-right">Cantidad</TableHead>
                          <TableHead className="text-right">Precio Compra</TableHead>
                          <TableHead className="text-right">Precio Actual</TableHead>
                          <TableHead className="text-right">Valuación</TableHead>
                          <TableHead className="text-right">P&L Latente</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {b.holdings.map((h) => (
                          <TableRow key={h.symbol} className="hover:bg-muted/30 text-xs">
                            <TableCell className="font-bold font-mono">
                              <span>{h.symbol}</span>
                              <span className="text-[10px] text-muted-foreground block font-normal">{h.assetName}</span>
                            </TableCell>
                            <TableCell className="text-right font-mono font-medium">
                              {h.quantity.toLocaleString("en-US", { maximumFractionDigits: 4 })}
                            </TableCell>
                            <TableCell className="text-right font-mono text-muted-foreground">
                              US$ {h.avgCostUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-foreground">
                              US$ {h.livePriceUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold">
                              US$ {h.marketValUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-bold ${h.pnlUSD >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                              {h.pnlUSD >= 0 ? "+" : ""}US$ {h.pnlUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              <span className="block text-[10px] opacity-80">
                                {h.pnlPct >= 0 ? "+" : ""}{h.pnlPct.toFixed(1)}%
                              </span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

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
