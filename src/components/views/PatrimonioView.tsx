import { useState, useMemo, useEffect } from "react";
import { useUnifiedFinancials } from "@/hooks/useUnifiedFinancials";
import { useFinancialAccounts } from "@/hooks/useFinance";
import { useTrades, computeHoldings } from "@/hooks/usePortfolio";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { calculateRealReturns, calculateRealReturnsBatch } from "@/lib/realReturns";
import { RealReturnColumns } from "@/types/realReturns";
import { SankeyFlowChart } from "@/components/finance/SankeyFlowChart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Wallet,
  Landmark,
  CreditCard,
  Coins,
  Banknote,
  TrendingUp,
  Percent,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
} from "lucide-react";

export function PatrimonioView() {
  const { netWorthMetrics, sankeyData, transactions, isLoading: unifiedLoading } = useUnifiedFinancials();
  const { data: accounts = [], isLoading: accountsLoading } = useFinancialAccounts();
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { venta: mepRate = 1200 } = useDolarMEP();

  const effectiveCclRate = mepRate > 0 ? mepRate : 1200;

  // Active accounts only
  const activeAccounts = useMemo(() => {
    return accounts.filter((a) => a.is_active);
  }, [accounts]);

  // Net Worth in 3 Columns
  const netWorthUSD = netWorthMetrics.netWorthUSD || 0;
  const netWorthARS = netWorthUSD * effectiveCclRate;

  const [netWorth3Col, setNetWorth3Col] = useState<RealReturnColumns>({
    nominalARS: netWorthARS,
    realVsIPC: netWorthARS,
    usdVsCCL: netWorthUSD,
  });

  const monthlyInflowUSD = netWorthMetrics.monthlyBrokerInflowUSD || 0;
  const monthlyInflowARS = monthlyInflowUSD * effectiveCclRate;
  const [capitalSaved3Col, setCapitalSaved3Col] = useState<RealReturnColumns>({
    nominalARS: monthlyInflowARS,
    realVsIPC: monthlyInflowARS,
    usdVsCCL: monthlyInflowUSD,
  });

  const [realReturnsTableData, setRealReturnsTableData] = useState<
    { category: string; nominalARS: number; realVsIPC: number; usdVsCCL: number }[]
  >([]);

  useEffect(() => {
    let isMounted = true;
    async function load3ColMetrics() {
      const todayIso = new Date().toISOString().split("T")[0];
      const monthStartIso = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
      const yearStartIso = `${new Date().getFullYear()}-01-01`;

      const nwRes = await calculateRealReturns({
        amountARS: netWorthARS,
        startDate: monthStartIso,
        endDate: todayIso,
      });

      const capRes = await calculateRealReturns({
        amountARS: monthlyInflowARS,
        startDate: monthStartIso,
        endDate: todayIso,
      });

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

  const getAccountIcon = (type: string, name: string) => {
    if (type === "crypto" || name.toLowerCase().includes("binance")) return <Coins className="h-5 w-5 text-amber-400" />;
    if (name.toLowerCase().includes("mercury") || name.toLowerCase().includes("bank")) return <Landmark className="h-5 w-5 text-blue-400" />;
    if (type === "digital_wallet" || name.toLowerCase().includes("dolar")) return <CreditCard className="h-5 w-5 text-purple-400" />;
    return <Banknote className="h-5 w-5 text-emerald-400" />;
  };

  const isLoading = unifiedLoading || accountsLoading || tradesLoading;

  return (
    <div className="space-y-8 pb-16">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" />
            Patrimonio & Cuentas
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Visión estratégica de balance consolidado, cuentas líquidas, flujos y retornos reales.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs py-1 px-3 border-primary/30 text-primary bg-primary/10">
            Dólar CCL/MEP: ${effectiveCclRate.toLocaleString("es-AR")}
          </Badge>
        </div>
      </div>

      {/* 1. NET WORTH 3-COLUMN HERO BANNER */}
      <Card className="bg-card border border-border/80 shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Wallet className="h-44 w-44 text-primary" />
        </div>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
            <span>Patrimonio Neto Consolidado</span>
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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Col 1: Nominal ARS */}
              <div className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Nominal ARS
                </span>
                <div className="text-2xl font-black font-mono text-foreground">
                  $ {netWorth3Col.nominalARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </div>
                <p className="text-[11px] text-muted-foreground">Valor contable en moneda local</p>
              </div>

              {/* Col 2: Real vs IPC */}
              <div className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                  Real vs IPC (Deflactado)
                </span>
                <div className="text-2xl font-black font-mono text-primary">
                  $ {netWorth3Col.realVsIPC.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                </div>
                <p className="text-[11px] text-muted-foreground">Poder de compra ajustado por inflación</p>
              </div>

              {/* Col 3: USD vs CCL */}
              <div className="p-4 rounded-xl bg-background/60 border border-border/60 space-y-1">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
                  USD vs CCL (Real Hard Currency)
                </span>
                <div className="text-2xl font-black font-mono text-emerald-400">
                  US$ {netWorth3Col.usdVsCCL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <p className="text-[11px] text-muted-foreground">Valuación en moneda dura (CCL)</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. REAL ACCOUNTS BREAKDOWN TILES */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Cuentas Financieras & Saldos Líquidos ({activeAccounts.length})
          </h2>
          <span className="text-xs text-muted-foreground">
            Líquido Total: US$ {netWorthMetrics.liquidCashUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeAccounts.map((acc) => {
            const bal = Number(acc.current_balance || 0);
            const isARS = acc.currency === "ARS";
            const balUSD = isARS ? bal / effectiveCclRate : bal;

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
                      {isARS
                        ? `$ ${bal.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`
                        : `US$ ${bal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                    </div>
                    {isARS && (
                      <span className="text-[10px] text-muted-foreground block">
                        ≈ US$ {balUSD.toFixed(2)}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Dinero Invertido en Brokers Tile */}
          <Card className="bg-card border border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/30">
                  <TrendingUp className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-foreground">Brokers (Inversiones)</h3>
                  <span className="text-[11px] text-primary/80 uppercase font-mono">
                    ARQ · IEB+ · IBKR
                  </span>
                </div>
              </div>
              <div className="text-right font-mono">
                <div className="text-base font-black text-primary">
                  US$ {netWorthMetrics.portfolioMarketValueUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[10px] text-muted-foreground block">
                  $ {(netWorthMetrics.portfolioMarketValueUSD * effectiveCclRate).toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 3. SANKEY CASHFLOW DIAGRAM */}
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
            <SankeyFlowChart data={sankeyData} currencySymbol="US$" />
          </div>
        </CardContent>
      </Card>

      {/* 4. REAL RETURNS TABLE */}
      <Card className="bg-card border border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Tabla de Retornos Reales & Rendimiento (P&L 3 Columnas)
          </CardTitle>
          <CardDescription className="text-xs">
            Valuación deflactada de categorías frente a IPC y tipo de cambio CCL.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Categoría de Activo</TableHead>
                <TableHead className="text-right">Nominal ARS</TableHead>
                <TableHead className="text-right">Real vs IPC</TableHead>
                <TableHead className="text-right">USD vs CCL</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {realReturnsTableData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-6 text-muted-foreground text-sm">
                    Calculando retornos reales...
                  </TableCell>
                </TableRow>
              ) : (
                realReturnsTableData.map((row) => (
                  <TableRow key={row.category} className="hover:bg-muted/40">
                    <TableCell className="font-semibold text-foreground">{row.category}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      $ {row.nominalARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-primary font-semibold">
                      $ {row.realVsIPC.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-emerald-400 font-bold">
                      US$ {row.usdVsCCL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
