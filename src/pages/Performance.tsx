import { useState, useMemo } from "react";
import { useTrades, computePerformance, Trade } from "@/hooks/usePortfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from "recharts";
import { TrendingUp, TrendingDown, Trophy, AlertTriangle } from "lucide-react";

type Period = "month" | "quarter";

interface PeriodData {
  period: string;
  realized: number;
  dividends: number;
  total: number;
}

function computePeriodicPnL(trades: Trade[], period: Period): PeriodData[] {
  // Sort all trades chronologically
  const sorted = [...trades].sort(
    (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
  );

  // Track avg cost per symbol
  const positions = new Map<string, { qty: number; avgCost: number }>();
  // Accumulate P&L by period
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
      if (pos.qty <= 0) {
        pos.qty = 0;
        pos.avgCost = 0;
      }
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

const Performance = () => {
  const { data: trades = [], isLoading } = useTrades();
  const [period, setPeriod] = useState<Period>("month");

  const periodicData = useMemo(() => computePeriodicPnL(trades, period), [trades, period]);
  const performance = useMemo(() => computePerformance(trades), [trades]);

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
    return <div className="animate-pulse text-muted-foreground text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Performance</h1>
        <p className="text-muted-foreground text-sm">Periodic realized P&L and dividends</p>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Return</p>
            <p className={`text-xl font-bold font-mono mt-1 ${performance.total_return >= 0 ? "text-gain" : "text-loss"}`}>
              {performance.total_return >= 0 ? "+" : ""}${performance.total_return.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
        {bestPeriod && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5 text-gain" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Best {period === "month" ? "Month" : "Quarter"}</p>
              </div>
              <p className="text-xl font-bold font-mono mt-1 text-gain">
                +${bestPeriod.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">{bestPeriod.period}</p>
            </CardContent>
          </Card>
        )}
        {worstPeriod && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-3.5 w-3.5 text-loss" />
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Worst {period === "month" ? "Month" : "Quarter"}</p>
              </div>
              <p className={`text-xl font-bold font-mono mt-1 ${worstPeriod.total >= 0 ? "text-gain" : "text-loss"}`}>
                {worstPeriod.total >= 0 ? "+" : ""}${worstPeriod.total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-muted-foreground">{worstPeriod.period}</p>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg {period === "month" ? "Monthly" : "Quarterly"}</p>
            <p className={`text-xl font-bold font-mono mt-1 ${avgReturn >= 0 ? "text-gain" : "text-loss"}`}>
              {avgReturn >= 0 ? "+" : ""}${avgReturn.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">P&L by {period === "month" ? "Month" : "Quarter"}</CardTitle>
          <div className="flex gap-1">
            <Button
              variant={period === "month" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("month")}
            >
              Monthly
            </Button>
            <Button
              variant={period === "quarter" ? "default" : "outline"}
              size="sm"
              onClick={() => setPeriod("quarter")}
            >
              Quarterly
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {periodicData.length > 0 ? (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={periodicData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="period"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${v}`}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      `$${value.toFixed(2)}`,
                      name === "realized" ? "Realized P&L" : "Dividends",
                    ]}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--popover-foreground))",
                    }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                  />
                  <Legend />
                  <Bar dataKey="realized" name="Realized P&L" stackId="a" fill="hsl(var(--primary))" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="dividends" name="Dividends" stackId="a" fill="hsl(var(--gain))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-12">
              No sell or dividend trades yet — P&L data will appear here once you close positions or receive dividends.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Performance;
