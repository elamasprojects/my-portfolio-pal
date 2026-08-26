import { useState, useMemo } from "react";
import { useTrades, computePerformance, Trade } from "@/hooks/usePortfolio";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { matchTradesFIFO } from "@/lib/tradeMatching";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from "recharts";
import { BarChart3, TrendingUp, TrendingDown, DollarSign, Calendar, Tag, AlertTriangle } from "lucide-react";

export function PerformanceMetricsDashboard() {
  const { data: trades = [], isLoading } = useTrades();
  const { venta: mepRate = 1200 } = useDolarMEP();
  const [period, setPeriod] = useState<"month" | "quarter">("month");

  const effectiveRate = mepRate > 0 ? mepRate : 1200;

  // Compute closed trades P&L grouped by period
  const { periodicData, unmatchedSells } = useMemo(() => {
    const dividends = trades.filter((t) => t.trade_type === "dividend");

    const groupMap: Record<string, { period: string; realizedUSD: number; dividendsUSD: number }> = {};
    const periodKey = (value: string | Date) => {
      const date = value instanceof Date ? value : new Date(value);
      return period === "month"
        ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
        : `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;
    };

    // Realised P&L comes from FIFO lot matching, the same engine the Game Review uses, so a
    // sell is priced against the lots it actually consumed. The previous version averaged
    // every prior buy and — when a sell had no buy in the loaded window — fell back to
    // `sell price * 0.88`, inventing a ~13.6% gain out of a constant.
    const matchedSellIds = new Set<string>();
    for (const symbol of new Set(trades.map((t) => t.symbol.toUpperCase()))) {
      const symbolTrades = trades.filter((t) => t.symbol.toUpperCase() === symbol);
      for (const lot of matchTradesFIFO(symbolTrades).closedTrades) {
        matchedSellIds.add(lot.sellTradeId);
        const key = periodKey(lot.sellDate);
        if (!groupMap[key]) groupMap[key] = { period: key, realizedUSD: 0, dividendsUSD: 0 };
        groupMap[key].realizedUSD += lot.pnl;
      }
    }

    // A sell whose opening buy predates the data window cannot be priced. It is reported,
    // not guessed at.
    const unmatched = trades.filter(
      (t) => t.trade_type === "sell" && !matchedSellIds.has(t.id)
    ).length;

    for (const d of dividends) {
      const key = periodKey(d.trade_date || d.created_at);
      const amtUSD = Number(d.total_amount || 0);
      if (!groupMap[key]) groupMap[key] = { period: key, realizedUSD: 0, dividendsUSD: 0 };
      groupMap[key].dividendsUSD += amtUSD;
    }

    return {
      periodicData: Object.values(groupMap).sort((a, b) => a.period.localeCompare(b.period)),
      unmatchedSells: unmatched,
    };
  }, [trades, period]);

  // Aggregate stats
  const aggregateStats = useMemo(() => {
    let totalRealizedUSD = 0;
    let totalDividendsUSD = 0;
    let bestPeriod = { period: "—", total: 0 };
    let worstPeriod = { period: "—", total: 0 };

    for (const row of periodicData) {
      const net = row.realizedUSD + row.dividendsUSD;
      totalRealizedUSD += row.realizedUSD;
      totalDividendsUSD += row.dividendsUSD;

      if (net > bestPeriod.total) bestPeriod = { period: row.period, total: net };
      if (net < worstPeriod.total) worstPeriod = { period: row.period, total: net };
    }

    const avgUSD = periodicData.length > 0 ? (totalRealizedUSD + totalDividendsUSD) / periodicData.length : 0;

    return {
      totalRealizedUSD,
      totalDividendsUSD,
      netTotalUSD: totalRealizedUSD + totalDividendsUSD,
      bestPeriod,
      worstPeriod,
      avgUSD,
    };
  }, [periodicData]);

  return (
    <div className="space-y-6">
      {unmatchedSells > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-300">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            {unmatchedSells} {unmatchedSells === 1 ? "venta queda" : "ventas quedan"} fuera del
            cálculo: su compra de origen es anterior a los datos cargados, así que no hay costo
            real contra el cual medirlas.
          </span>
        </div>
      )}

      {/* 4 Summary Metric Tiles */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border border-border/70 p-4 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Ganancia Realizada Neta
          </span>
          <div
            className={`text-2xl font-black font-mono ${
              aggregateStats.netTotalUSD >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {aggregateStats.netTotalUSD >= 0 ? "+" : ""}US${" "}
            {aggregateStats.netTotalUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-muted-foreground">
            P&L cerrado + dividendos cobrados
          </p>
        </Card>

        <Card className="bg-card border border-border/70 p-4 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Mejor {period === "month" ? "Mes" : "Trimestre"}
          </span>
          <div className="text-2xl font-black font-mono text-emerald-400">
            {aggregateStats.bestPeriod.total > 0 ? "+" : ""}US${" "}
            {aggregateStats.bestPeriod.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            {aggregateStats.bestPeriod.period}
          </p>
        </Card>

        <Card className="bg-card border border-border/70 p-4 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Peor {period === "month" ? "Mes" : "Trimestre"}
          </span>
          <div
            className={`text-2xl font-black font-mono ${
              aggregateStats.worstPeriod.total < 0 ? "text-rose-400" : "text-foreground"
            }`}
          >
            {aggregateStats.worstPeriod.total < 0 ? "-" : ""}US${" "}
            {Math.abs(aggregateStats.worstPeriod.total).toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-muted-foreground font-mono">
            {aggregateStats.worstPeriod.period}
          </p>
        </Card>

        <Card className="bg-card border border-border/70 p-4 space-y-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
            Promedio {period === "month" ? "Mensual" : "Trimestral"}
          </span>
          <div
            className={`text-2xl font-black font-mono ${
              aggregateStats.avgUSD >= 0 ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {aggregateStats.avgUSD >= 0 ? "+" : ""}US${" "}
            {aggregateStats.avgUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </div>
          <p className="text-[11px] text-muted-foreground">Retorno medio por período</p>
        </Card>
      </div>

      {/* Periodic Bar Chart */}
      <Card className="bg-card border border-border/80 shadow-md">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              P&L Histórico por {period === "month" ? "Mes" : "Trimestre"} (USD)
            </CardTitle>
            <CardDescription className="text-xs">
              Evolución de ganancias realizadas y cobro de dividendos a lo largo del tiempo.
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/60">
            <Button
              variant={period === "month" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setPeriod("month")}
            >
              Mensual
            </Button>
            <Button
              variant={period === "quarter" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setPeriod("quarter")}
            >
              Trimestral
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {periodicData.length === 0 ? (
            <p className="text-center py-12 text-muted-foreground text-sm">
              No hay operaciones cerradas o dividendos registrados para graficar.
            </p>
          ) : (
            <div className="h-80 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodicData} margin={{ top: 10, right: 15, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/40" vertical={false} />
                  <XAxis
                    dataKey="period"
                    className="text-[11px] font-mono fill-muted-foreground"
                    tickLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${v}`}
                    className="text-[11px] font-mono fill-muted-foreground"
                    tickLine={false}
                    axisLine={false}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Tooltip
                    formatter={(val: number) => [
                      `US$ ${val.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
                      "",
                    ]}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--popover-foreground))",
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="realizedUSD"
                    name="P&L Realizado"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="dividendsUSD"
                    name="Dividendos"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
