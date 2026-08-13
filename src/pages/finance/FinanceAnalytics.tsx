import { useMemo } from "react";
import { useTransactions, useCategories, usePaymentMethods } from "@/hooks/useFinance";
import { useProfile } from "@/hooks/useProfile";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { makeFormatters } from "@/lib/format";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { TrendingDown, PieChart as PieIcon, BarChart3, CreditCard } from "lucide-react";

export default function FinanceAnalytics() {
  const { transactions, isLoading: txLoading } = useTransactions();
  const { categories } = useCategories();
  const { paymentMethods } = usePaymentMethods();

  const { profile } = useProfile();
  const { mepRate } = useDolarMEP();
  const displayCurrency = profile?.default_currency === "ARS" ? "ARS" : "USD";
  const { cx, currencySymbol, fmtCompact } = makeFormatters(displayCurrency, mepRate);

  // 1. Monthly Category Stacked Bar Data
  const monthlyCategoryData = useMemo(() => {
    const monthMap = new Map<string, Record<string, number>>();

    for (const tx of transactions) {
      if (tx.deleted_at || tx.type === "income") continue;
      const monthKey = tx.transaction_date ? tx.transaction_date.slice(0, 7) : new Date().toISOString().slice(0, 7);
      const catName = tx.category?.name || "Otros";
      const amt = Number(tx.amount_usd) || 0;

      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, {});
      }
      const mObj = monthMap.get(monthKey)!;
      mObj[catName] = (mObj[catName] || 0) + amt;
    }

    const sortedMonths = Array.from(monthMap.keys()).sort();
    return sortedMonths.map((m) => {
      const obj: any = { month: m, ...monthMap.get(m) };
      // Convert to display currency
      for (const k in obj) {
        if (k !== "month") obj[k] = cx(obj[k]);
      }
      return obj;
    });
  }, [transactions, cx]);

  // 2. Spending by Financial Account Data
  const accountSpendingBreakdown = useMemo(() => {
    const accMap = new Map<string, { name: string; value: number; color: string; count: number }>();

    for (const tx of transactions) {
      if (tx.deleted_at || tx.type === "income") continue;
      const accName = tx.account?.name || tx.payment_method?.name || "Efectivo / Otro";
      const color = tx.account?.color || tx.payment_method?.color || "#10b981";
      const amt = Number(tx.amount_usd) || 0;

      if (!accMap.has(accName)) {
        accMap.set(accName, { name: accName, value: 0, color, count: 0 });
      }
      const item = accMap.get(accName)!;
      item.value += amt;
      item.count += 1;
    }

    return Array.from(accMap.values())
      .map((item) => ({ ...item, displayValue: cx(item.value) }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, cx]);

  const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f43f5e", "#64748b"];

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-black font-serif tracking-tight text-foreground">
          Analíticas & Evolución de Gastos
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
          Evolución histórica de tus categorías y desglose de uso de medios de pago.
        </p>
      </div>

      {/* Monthly Category Stacked Bar Chart */}
      <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-base text-foreground">
              Gasto por Categoría a lo Largo del Tiempo
            </h2>
          </div>
          <span className="text-xs font-mono text-muted-foreground">Mensual</span>
        </div>

        <div className="h-72 w-full pt-2">
          {monthlyCategoryData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
              Sin datos suficientes para graficar
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyCategoryData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "currentColor" }} stroke="#555" />
                <YAxis tick={{ fontSize: 11, fill: "currentColor" }} stroke="#555" tickFormatter={(v) => fmtCompact(v)} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-popover text-popover-foreground text-xs p-2.5 rounded-xl border shadow-lg space-y-1 font-mono">
                          <p className="font-bold border-b pb-1">{label}</p>
                          {payload.map((entry: any, i: number) => (
                            <div key={i} className="flex items-center justify-between gap-4">
                              <span style={{ color: entry.color }}>{entry.name}:</span>
                              <span className="font-bold">
                                {currencySymbol}
                                {Number(entry.value).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {categories.map((cat, idx) => (
                  <Bar
                    key={cat.id}
                    dataKey={cat.name}
                    stackId="a"
                    fill={cat.color || COLORS[idx % COLORS.length]}
                    radius={[0, 0, 0, 0]}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Spending by Financial Account Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Pie Chart */}
        <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm space-y-4">
          <div className="flex items-center gap-2">
            <PieIcon className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-base text-foreground">
              Proporción por Cuenta Financiera
            </h2>
          </div>

          <div className="h-60 w-full">
            {accountSpendingBreakdown.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                Sin movimientos registrados
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={accountSpendingBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="displayValue"
                  >
                    {accountSpendingBreakdown.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(val: any) => [`${currencySymbol}${Number(val).toFixed(2)}`, "Gasto"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Table of Financial Accounts */}
        <div className="rounded-2xl border bg-card p-4 sm:p-6 shadow-sm space-y-3">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-base text-foreground">
              Volumen Gastado por Cuenta
            </h2>
          </div>

          <div className="space-y-2 pt-2">
            {accountSpendingBreakdown.map((acc, idx) => (
              <div
                key={acc.name}
                className="flex items-center justify-between p-3 rounded-xl border bg-muted/20 hover:bg-muted/40 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: acc.color || COLORS[idx % COLORS.length] }}
                  />
                  <div>
                    <p className="text-sm font-semibold text-foreground">{acc.name}</p>
                    <p className="text-[11px] text-muted-foreground">{acc.count} transacciones</p>
                  </div>
                </div>
                <p className="font-mono font-bold text-sm text-foreground">
                  {currencySymbol}
                  {acc.displayValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
