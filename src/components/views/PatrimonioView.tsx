import { useState, useMemo } from "react";
import { useUnifiedFinancials } from "@/hooks/useUnifiedFinancials";
import { useFinancialAccounts } from "@/hooks/useFinance";
import { useTrades } from "@/hooks/usePortfolio";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { SankeyFlowChart } from "@/components/finance/SankeyFlowChart";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Wallet,
  Landmark,
  CreditCard,
  Coins,
  Banknote,
  TrendingUp,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  DollarSign,
} from "lucide-react";

export function PatrimonioView() {
  const { netWorthMetrics, sankeyData, transactions, isLoading: unifiedLoading } = useUnifiedFinancials();
  const { accounts = [], isLoading: accountsLoading } = useFinancialAccounts();
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { venta: mepRate = 1200 } = useDolarMEP();

  const effectiveCclRate = mepRate > 0 ? mepRate : 1200;

  // Active accounts list
  const activeAccounts = useMemo(() => {
    return accounts.filter((a) => a.is_active);
  }, [accounts]);

  // Compute breakdown segments
  const portfolioInvestedUSD = netWorthMetrics.portfolioMarketValueUSD || 0;
  const portfolioInvestedARS = portfolioInvestedUSD * effectiveCclRate;

  // Split liquid accounts by currency
  const { usdAccountsUSD, arsAccountsARS, arsAccountsUSD } = useMemo(() => {
    let usdSum = 0;
    let arsSum = 0;
    for (const acc of activeAccounts) {
      const bal = Number(acc.current_balance || 0);
      if (acc.currency === "ARS") {
        arsSum += bal;
      } else {
        usdSum += bal;
      }
    }
    return {
      usdAccountsUSD: usdSum,
      arsAccountsARS: arsSum,
      arsAccountsUSD: arsSum / effectiveCclRate,
    };
  }, [activeAccounts, effectiveCclRate]);

  // Total consolidated Net Worth
  const totalNetWorthUSD = portfolioInvestedUSD + usdAccountsUSD + arsAccountsUSD;
  const totalNetWorthARS = totalNetWorthUSD * effectiveCclRate;

  // Weights
  const portfolioWeightPct = totalNetWorthUSD > 0 ? (portfolioInvestedUSD / totalNetWorthUSD) * 100 : 0;
  const usdLiquidWeightPct = totalNetWorthUSD > 0 ? (usdAccountsUSD / totalNetWorthUSD) * 100 : 0;
  const arsLiquidWeightPct = totalNetWorthUSD > 0 ? (arsAccountsUSD / totalNetWorthUSD) * 100 : 0;

  // Account Icons helper
  const getAccountIcon = (type: string, name: string) => {
    const n = name.toLowerCase();
    if (n.includes("binance") || n.includes("crypto")) return <Coins className="h-5 w-5 text-amber-400" />;
    if (n.includes("mercury") || n.includes("bank") || n.includes("brubank")) return <Building2 className="h-5 w-5 text-sky-400" />;
    if (n.includes("efectivo") || n.includes("cash")) return <Banknote className="h-5 w-5 text-emerald-400" />;
    if (n.includes("dolarapp") || n.includes("wallet")) return <Wallet className="h-5 w-5 text-purple-400" />;
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
            Valuación total consolidada, composición de activos y desglose por cuenta financiera.
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
              <span>Composición de tu Capital</span>
              <span>100% Asignado</span>
            </div>
            <div className="h-3 w-full rounded-full bg-muted/60 flex overflow-hidden p-0.5 gap-0.5">
              <div
                style={{ width: `${portfolioWeightPct}%` }}
                className="bg-primary rounded-l-full h-full transition-all"
                title={`Inversiones: ${portfolioWeightPct.toFixed(1)}%`}
              />
              <div
                style={{ width: `${usdLiquidWeightPct}%` }}
                className="bg-emerald-400 h-full transition-all"
                title={`USD Líquido: ${usdLiquidWeightPct.toFixed(1)}%`}
              />
              <div
                style={{ width: `${arsLiquidWeightPct}%` }}
                className="bg-sky-400 rounded-r-full h-full transition-all"
                title={`ARS Líquido: ${arsLiquidWeightPct.toFixed(1)}%`}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3. BREAKDOWN DE COMPOSICIÓN (3 BLOQUES: INVERTIDO, LÍQUIDO USD, LÍQUIDO ARS) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Bloque 1: Invertido en Brokers */}
        <Card className="bg-card border border-border/70 hover:border-primary/40 transition-colors">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4" />
                Invertido (Brokers)
              </span>
              <Badge variant="outline" className="text-[10px] font-mono bg-primary/10 text-primary border-primary/20">
                {portfolioWeightPct.toFixed(1)}%
              </Badge>
            </div>
            <div className="pt-1">
              <div className="text-2xl font-black font-mono text-foreground">
                US$ {portfolioInvestedUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                $ {portfolioInvestedARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
              ARQ · IEB+ · Interactive Brokers
            </p>
          </CardContent>
        </Card>

        {/* Bloque 2: Cuentas Líquidas en USD */}
        <Card className="bg-card border border-border/70 hover:border-emerald-500/40 transition-colors">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <DollarSign className="h-4 w-4" />
                Líquido en Dólares
              </span>
              <Badge variant="outline" className="text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                {usdLiquidWeightPct.toFixed(1)}%
              </Badge>
            </div>
            <div className="pt-1">
              <div className="text-2xl font-black font-mono text-foreground">
                US$ {usdAccountsUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                $ {(usdAccountsUSD * effectiveCclRate).toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
              Mercury · Binance · Efectivo · DolarApp
            </p>
          </CardContent>
        </Card>

        {/* Bloque 3: Cuentas Líquidas en Pesos */}
        <Card className="bg-card border border-border/70 hover:border-sky-500/40 transition-colors">
          <CardContent className="p-5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                <Banknote className="h-4 w-4" />
                Líquido en Pesos
              </span>
              <Badge variant="outline" className="text-[10px] font-mono bg-sky-500/10 text-sky-400 border-sky-500/20">
                {arsLiquidWeightPct.toFixed(1)}%
              </Badge>
            </div>
            <div className="pt-1">
              <div className="text-2xl font-black font-mono text-foreground">
                US$ {arsAccountsUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-0.5">
                $ {arsAccountsARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1 border-t border-border/40">
              Brubank y cuentas bancarias locales
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 4. BREAKDOWN POR CUENTA FINANCIERA INDIVIDUAL */}
      <div className="space-y-4 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            Desglose por Cuenta Financiera ({activeAccounts.length + 1})
          </h2>
          <span className="text-xs font-mono text-muted-foreground">
            Total Cuentas: US$ {totalNetWorthUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Card: Brokers / Inversiones */}
          <Card className="bg-card border border-border/70 hover:border-primary/40 transition-colors">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20">
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
                <div className="text-base font-black text-foreground">
                  US$ {portfolioInvestedUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
                <span className="text-[11px] text-muted-foreground block">
                  $ {portfolioInvestedARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
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

      {/* 5. DIAGRAMA SANKEY DE FLUJO DE FONDOS */}
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
