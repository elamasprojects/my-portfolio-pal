import { useState, useMemo } from "react";
import { useTrades, computePerformance, Trade } from "@/hooks/usePortfolio";
import { useStrategyPerformance } from "@/hooks/useStrategyPerformance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { Trophy, AlertTriangle, Tag } from "lucide-react";
import { useLanguage } from "@/i18n";

type Period = "month" | "quarter";

interface PeriodData {
  period: string;
  realized: number;
  dividends: number;
  total: number;
}

function computePeriodicPnL(trades: Trade[], period: Period): PeriodData[] {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
  );

  const positions = new Map<string, { qty: number; avgCost: number }>();
  const periodMap = new Map<string, { realized: number; dividends: number }>();

  for (const t of sorted) {
    const d = new Date(t.trade_date);
    const key =
      period === "month"
        ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
        : `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;

    const entry = periodMap.get(key) || { realized: 0, dividends: 0 };
    const pos = positions.get(t.symbol) || { qty: 0, avgCost: 0 };

    if (t.trade_type === "buy") {
      const totalCost = pos.avgCost * pos.qty + t.price_per_unit * t.quantity;
      pos.qty += t.quantity;
      pos.avgCost = pos.qty > 0 ? totalCost / pos.qty : 0;
      positions.set(t.symbol, pos);
    } else if (t.trade_type === "sell") {
      const pnl = (t.price_per_unit - pos.avgCost) * t.quantity;
      entry.realized += pnl;
      pos.qty -= t.quantity;
      if (pos.qty <= 0) { pos.qty = 0; pos.avgCost = 0; }
      positions.set(t.symbol, pos);
    } else if (t.trade_type === "dividend") {
      entry.dividends += Number(t.total_amount) || t.price_per_unit * t.quantity;
    }

    periodMap.set(key, entry);
  }

  return Array.from(periodMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, { realized, dividends }]) => ({
      period,
      realized: Math.round(realized * 100) / 100,
      dividends: Math.round(dividends * 100) / 100,
      total: Math.round((realized + dividends) * 100) / 100,
    }));
}

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const Performance = () => {
  const { data: trades = [], isLoading } = useTrades();
  const [period, setPeriod] = useState<Period>("month");
  const { t } = useLanguage();

  const periodicData = useMemo(() => computePeriodicPnL(trades, period), [trades, period]);
  const performance = useMemo(() => computePerformance(trades), [trades]);
  const { data: strategyData, isLoading: stratLoading } = useStrategyPerformance(trades);

  const bestPeriod = useMemo(
    () => periodicData.reduce((best, d) => (d.total > (best?.total ?? -Infinity) ? d : best), periodicData[0]),
    [periodicData]
  );
  const worstPeriod = useMemo(
    () => periodicData.reduce((worst, d) => (d.total < (worst?.total ?? Infinity) ? d : worst), periodicData[0]),
    [periodicData]
  );
  const avgReturn = useMemo(
    () => periodicData.length > 0 ? periodicData.reduce((s, d) => s + d.total, 0) / periodicData.length : 0,
    [periodicData]
  );

  if (isLoading) {
    return <div className="animate-pulse text-muted-foreground text-center py-12">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl chess-title">{t("performance.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("performance.subtitle")}</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("performance.totalReturn")}</p>
            <p className={`text-xl font-bold font-mono mt-1 ${performance.total_return >= 0 ? "text-gain" : "text-loss"}`}>
              {performance.total_return >= 0 ? "+" : ""}${fmt(performance.total_return)}
            </p>
          </CardContent>
        </Card>
        {bestPeriod && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-gain" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {period === "month" ? t("performance.bestMonth") : t("performance.bestQuarter")}
                </p>
              </div>
              <p className="text-xl font-bold font-mono mt-1 text-gain">+${fmt(bestPeriod.total)}</p>
              <p className="text-xs text-muted-foreground">{bestPeriod.period}</p>
            </CardContent>
          </Card>
        )}
        {worstPeriod && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-loss" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                  {period === "month" ? t("performance.worstMonth") : t("performance.worstQuarter")}
                </p>
              </div>
              <p className={`text-xl font-bold font-mono mt-1 ${worstPeriod.total >= 0 ? "text-gain" : "text-loss"}`}>
                {worstPeriod.total >= 0 ? "+" : ""}${fmt(worstPeriod.total)}
              </p>
              <p className="text-xs text-muted-foreground">{worstPeriod.period}</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">
              {period === "month" ? t("performance.avgMonthly") : t("performance.avgQuarterly")}
            </p>
            <p className={`text-xl font-bold font-mono mt-1 ${avgReturn >= 0 ? "text-gain" : "text-loss"}`}>
              {avgReturn >= 0 ? "+" : ""}${fmt(avgReturn)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            {period === "month" ? t("performance.pnlByMonth") : t("performance.pnlByQuarter")}
          </CardTitle>
          <div className="flex gap-1">
            <Button variant={period === "month" ? "default" : "outline"} size="sm" onClick={() => setPeriod("month")}>{t("performance.monthly")}</Button>
            <Button variant={period === "quarter" ? "default" : "outline"} size="sm" onClick={() => setPeriod("quarter")}>{t("performance.quarterly")}</Button>
          </div>
        </CardHeader>
        <CardContent>
          {periodicData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodicData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="period" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `$${v}`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Tooltip
                    formatter={(value: number, name: string) => [`$${value.toFixed(2)}`, name === "realized" ? t("performance.realizedPnl") : t("performance.dividends")]}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                  />
                  <Legend />
                  <Bar dataKey="realized" name={t("performance.realizedPnl")} stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="dividends" name={t("performance.dividends")} stackId="a" fill="hsl(var(--gain))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-12">{t("performance.noSellsYet")}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">{t("performance.strategyComparison")}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {stratLoading ? (
            <div className="animate-pulse text-muted-foreground text-sm py-8 text-center">{t("performance.loadingStrategies")}</div>
          ) : strategyData.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-12">{t("performance.tagTrades")}</p>
          ) : (
            <div className="space-y-6">
              <div className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("performance.strategy")}</TableHead>
                      <TableHead className="text-right">{t("performance.trades")}</TableHead>
                      <TableHead className="text-right">{t("performance.sells")}</TableHead>
                      <TableHead className="text-right">{t("performance.winRate")}</TableHead>
                      <TableHead className="text-right">{t("performance.realizedPnl")}</TableHead>
                      <TableHead className="text-right">{t("performance.dividends")}</TableHead>
                      <TableHead className="text-right">{t("performance.totalReturn")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {strategyData.map((s) => (
                      <TableRow key={s.tagId}>
                        <TableCell>
                          <Badge className="text-xs" style={{ backgroundColor: s.tagColor, color: "#fff" }}>{s.tagName}</Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{s.totalTrades}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{s.sells}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{s.sells > 0 ? `${s.winRate}%` : "—"}</TableCell>
                        <TableCell className={`text-right font-mono text-sm ${s.realizedPnl >= 0 ? "text-gain" : "text-loss"}`}>
                          {s.realizedPnl >= 0 ? "+" : ""}${fmt(s.realizedPnl)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-gain">+${fmt(s.dividends)}</TableCell>
                        <TableCell className={`text-right font-mono text-sm font-semibold ${s.totalReturn >= 0 ? "text-gain" : "text-loss"}`}>
                          {s.totalReturn >= 0 ? "+" : ""}${fmt(s.totalReturn)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div style={{ height: Math.max(strategyData.length * 50, 120) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={strategyData} layout="vertical" margin={{ top: 5, right: 20, bottom: 5, left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis type="category" dataKey="tagName" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={70} />
                    <ReferenceLine x={0} stroke="hsl(var(--border))" />
                    <Tooltip
                      formatter={(value: number) => [`$${value.toFixed(2)}`, t("performance.totalReturn")]}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }}
                    />
                    <Bar dataKey="totalReturn" name={t("performance.totalReturn")} radius={[0, 4, 4, 0]}>
                      {strategyData.map((s) => (
                        <rect key={s.tagId} fill={s.tagColor} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Performance;
