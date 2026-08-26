import { useState, useMemo } from "react";
import { useUnifiedFinancials } from "@/hooks/useUnifiedFinancials";
import { SankeyFlowChart } from "@/components/finance/SankeyFlowChart";
import { OmnibarFinance } from "@/components/finance/OmnibarFinance";
import { useProfile } from "@/hooks/useProfile";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { makeFormatters } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  TrendingUp,
  Plus,
  Inbox,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Zap,
  Sparkles,
  Calendar,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { MercurySyncButton } from "@/components/finance/MercurySyncButton";

export default function FinanceDashboard() {
  const [omnibarOpen, setOmnibarOpen] = useState(false);
  const [filterPeriod, setFilterPeriod] = useState<"this_month" | "last_month" | "30d" | "all">("all");

  const filterRange = useMemo(() => {
    const now = new Date();
    if (filterPeriod === "this_month") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start, end };
    }
    if (filterPeriod === "last_month") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { start, end };
    }
    if (filterPeriod === "30d") {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { start };
    }
    return undefined;
  }, [filterPeriod]);

  const { profile } = useProfile();
  const { mepRate } = useDolarMEP();
  const displayCurrency = profile?.default_currency === "ARS" ? "ARS" : "USD";
  const { cx, fmtUSD, fmtCompact, currencySymbol } = makeFormatters(displayCurrency, mepRate);

  const { netWorthMetrics, sankeyData, transactions, reviewQueue, isLoading } = useUnifiedFinancials(filterRange);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-24 md:pb-12">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-foreground">
            Finanzas Personales & Flujo de Caja
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Tu patrimonio líquido, tasa de ahorro y distribución de ingresos en tiempo real.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {reviewQueue.length > 0 && (
            <NavLink to="/finance/review">
              <Button
                variant="outline"
                size="sm"
                className="border-amber-500/40 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 text-xs font-semibold gap-1.5"
              >
                <Inbox className="h-4 w-4" />
                <span>Revisión ({reviewQueue.length})</span>
              </Button>
            </NavLink>
          )}

          {/* Se auto-oculta si no hay ninguna tarjeta de Mercury vinculada. */}
          <MercurySyncButton />

          <Button
            onClick={() => setOmnibarOpen(true)}
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5 shadow-md"
          >
            <Plus className="h-4 w-4" />
            <span>Registrar Movimiento</span>
          </Button>
        </div>
      </div>

      {/* Hero Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Net Worth */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Patrimonio Neto</span>
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-foreground mt-1">
            {currencySymbol}
            {cx(netWorthMetrics.netWorthUSD).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 font-mono">
            Líquido: {fmtCompact(cx(netWorthMetrics.liquidCashUSD))} · Broker: {fmtCompact(cx(netWorthMetrics.portfolioMarketValueUSD))}
          </p>
        </div>

        {/* Monthly Income */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Ingresos (30d)</span>
            <ArrowUpRight className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-emerald-500 mt-1">
            +{currencySymbol}
            {cx(netWorthMetrics.monthlyIncomeUSD).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 font-mono">
            Tasa Ahorro: <span className="font-bold text-emerald-400">{netWorthMetrics.savingsRatePct}%</span>
          </p>
        </div>

        {/* Monthly Expenses */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Gastos de Vida (30d)</span>
            <ArrowDownRight className="h-4 w-4 text-rose-500" />
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-rose-500 mt-1">
            -{currencySymbol}
            {cx(netWorthMetrics.monthlyExpensesUSD).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 font-mono">
            Burn Rate: {currencySymbol}{cx(netWorthMetrics.monthlyBurnRateUSD).toFixed(0)}/mes
          </p>
        </div>

        {/* Financial Runway */}
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Runway Financiero</span>
            <ShieldCheck className="h-4 w-4 text-purple-400" />
          </div>
          <p className="text-xl sm:text-2xl font-bold font-mono text-purple-400 mt-1">
            {netWorthMetrics.totalRunwayMonths} <span className="text-xs font-sans text-muted-foreground">meses</span>
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 font-mono">
            Líquido: {netWorthMetrics.liquidRunwayMonths}m sin liquidar
          </p>
        </div>
      </div>

      {/* Period Selector Tabs for Sankey Chart */}
      <div className="flex items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/40 p-1">
          <Button
            variant={filterPeriod === "all" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs rounded-full px-3 font-medium"
            onClick={() => setFilterPeriod("all")}
          >
            Histórico Completo
          </Button>
          <Button
            variant={filterPeriod === "30d" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs rounded-full px-3 font-medium"
            onClick={() => setFilterPeriod("30d")}
          >
            Últimos 30 días
          </Button>
          <Button
            variant={filterPeriod === "this_month" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs rounded-full px-3 font-medium"
            onClick={() => setFilterPeriod("this_month")}
          >
            Este Mes
          </Button>
          <Button
            variant={filterPeriod === "last_month" ? "default" : "ghost"}
            size="sm"
            className="h-7 text-xs rounded-full px-3 font-medium"
            onClick={() => setFilterPeriod("last_month")}
          >
            Mes Anterior
          </Button>
        </div>
      </div>

      {/* Main Sankey Diagram Section */}
      <SankeyFlowChart
        data={sankeyData}
        transactions={transactions}
        filterRange={filterRange}
        displayCurrency={displayCurrency}
        currencySymbol={currencySymbol}
        cx={cx}
      />

      {/* Omnibar Dialog */}
      <OmnibarFinance open={omnibarOpen} onOpenChange={setOmnibarOpen} />
    </div>
  );
}
