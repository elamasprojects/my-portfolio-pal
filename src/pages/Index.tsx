import { useMemo } from "react";
import { useTrades, computeHoldings, computePerformance, computeCumulativePnL } from "@/hooks/usePortfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Plus, Target, Percent, Banknote } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, AreaChart, Area } from "recharts";
import { useNavigate } from "react-router-dom";

const CHART_COLORS = [
  "hsl(42, 80%, 55%)",
  "hsl(152, 55%, 45%)",
  "hsl(220, 8%, 60%)",
  "hsl(30, 60%, 50%)",
  "hsl(220, 10%, 35%)",
];

const Index = () => {
  const { data: trades = [], isLoading } = useTrades();
  const navigate = useNavigate();
  const holdings = computeHoldings(trades);
  const performance = computePerformance(trades);
  const cumulativePnL = useMemo(() => computeCumulativePnL(trades), [trades]);

  const totalTrades = trades.filter((t) => t.trade_type !== "dividend").length;
  const recentTrades = trades.slice(0, 5);

  const allocationData = holdings.reduce((acc, h) => {
    const existing = acc.find((a) => a.name === h.asset_type);
    if (existing) {
      existing.value += h.total_invested;
    } else {
      acc.push({ name: h.asset_type, value: h.total_invested });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

  // P&L by asset chart data
  const pnlByAsset = performance.by_symbol
    .filter((s) => s.realized_pnl !== 0 || s.dividends_received !== 0)
    .sort((a, b) => b.total_return - a.total_return)
    .slice(0, 10);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">Loading portfolio...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Your portfolio overview</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Cost Basis (Open)</p>
                <p className="text-2xl font-bold font-mono mt-1">
                  ${performance.total_cost_basis.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Realized P&L</p>
                <p className={`text-2xl font-bold font-mono mt-1 ${performance.total_realized_pnl >= 0 ? "text-gain" : "text-loss"}`}>
                  {performance.total_realized_pnl >= 0 ? "+" : ""}
                  ${performance.total_realized_pnl.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${performance.total_realized_pnl >= 0 ? "bg-gain/10" : "bg-loss/10"}`}>
                {performance.total_realized_pnl >= 0 ? (
                  <TrendingUp className="h-5 w-5 text-gain" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-loss" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Win Rate</p>
                <p className="text-2xl font-bold font-mono mt-1">
                  {performance.total_sells > 0 ? `${performance.win_rate.toFixed(0)}%` : "—"}
                </p>
                {performance.total_sells > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {performance.winning_sells}/{performance.total_sells} sells
                  </p>
                )}
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Dividends</p>
                <p className="text-2xl font-bold font-mono mt-1 text-gain">
                  ${performance.total_dividends.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-gain/10 flex items-center justify-center">
                <Banknote className="h-5 w-5 text-gain" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Holdings</p>
            <p className="text-xl font-bold font-mono mt-1">{holdings.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Trades</p>
            <p className="text-xl font-bold font-mono mt-1">{totalTrades}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Buys / Sells</p>
            <p className="text-xl font-bold font-mono mt-1">
              {trades.filter((t) => t.trade_type === "buy").length} / {trades.filter((t) => t.trade_type === "sell").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Return</p>
            <p className={`text-xl font-bold font-mono mt-1 ${performance.total_return >= 0 ? "text-gain" : "text-loss"}`}>
              {performance.total_return >= 0 ? "+" : ""}${performance.total_return.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Allocation Pie Chart */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Allocation by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {allocationData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={allocationData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {allocationData.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => `$${value.toFixed(2)}`}
                      contentStyle={{
                        background: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--popover-foreground))",
                      }}
                      itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex flex-wrap gap-3 justify-center mt-2">
                  {allocationData.map((entry, i) => (
                    <div key={entry.name} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-muted-foreground capitalize">{entry.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-muted-foreground text-sm">No holdings yet</p>
                <Button size="sm" onClick={() => navigate("/add")}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Your First Trade
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Holdings Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Holdings</CardTitle>
          </CardHeader>
          <CardContent>
            {holdings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Avg Cost</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((h) => (
                    <TableRow
                      key={h.symbol}
                      className="cursor-pointer hover:bg-accent/50"
                      onClick={() => navigate(`/asset/${h.symbol}`)}
                    >
                      <TableCell className="font-mono font-semibold text-primary">{h.symbol}</TableCell>
                      <TableCell className="text-muted-foreground">{h.asset_name}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{h.asset_type}</TableCell>
                      <TableCell className="text-right font-mono">{h.net_quantity}</TableCell>
                      <TableCell className="text-right font-mono">${h.avg_cost.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">${h.total_invested.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-muted-foreground text-sm">No holdings yet</p>
                <Button variant="outline" size="sm" onClick={() => navigate("/add")}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Trade
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* P&L by Asset Chart */}
      {pnlByAsset.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">P&L by Asset</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pnlByAsset} layout="vertical" margin={{ left: 60, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `$${v}`}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="symbol"
                    tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontFamily: "JetBrains Mono" }}
                    width={55}
                  />
                  <ReferenceLine x={0} stroke="hsl(var(--border))" />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(2)}`, "Total Return"]}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--popover-foreground))",
                    }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                  />
                  <Bar dataKey="total_return" radius={[0, 4, 4, 0]}>
                    {pnlByAsset.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={entry.total_return >= 0 ? "hsl(var(--gain))" : "hsl(var(--loss))"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cumulative P&L Over Time */}
      {cumulativePnL.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">P&L Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativePnL} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <defs>
                    <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--gain))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--gain))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${v}`}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(2)}`, "Cumulative P&L"]}
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--popover-foreground))",
                    }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="cumulative_pnl"
                    stroke="hsl(var(--gain))"
                    fill="url(#pnlGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Trades */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Trades</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTrades.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTrades.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground">{new Date(t.trade_date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono font-semibold">{t.symbol}</TableCell>
                    <TableCell>
                      <span className={
                        t.trade_type === "buy"
                          ? "text-gain"
                          : t.trade_type === "sell"
                          ? "text-loss"
                          : "text-primary"
                      }>
                        {t.trade_type.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {t.trade_type === "dividend" ? "—" : t.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {t.trade_type === "dividend" ? "—" : `$${Number(t.price_per_unit).toFixed(2)}`}
                    </TableCell>
                    <TableCell className="text-right font-mono">${Number(t.total_amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-muted-foreground text-sm">No trades yet</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/add")}>
                <Plus className="h-4 w-4 mr-1" />
                Get Started
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
