import { useTrades, computeHoldings } from "@/hooks/usePortfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TrendingUp, TrendingDown, DollarSign, BarChart3 } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useNavigate } from "react-router-dom";

const CHART_COLORS = [
  "hsl(227, 100%, 58%)",
  "hsl(174, 62%, 40%)",
  "hsl(36, 100%, 49%)",
  "hsl(291, 52%, 51%)",
  "hsl(54, 100%, 61%)",
];

const Index = () => {
  const { data: trades = [], isLoading } = useTrades();
  const navigate = useNavigate();
  const holdings = computeHoldings(trades);

  const totalInvested = holdings.reduce((sum, h) => sum + h.total_invested, 0);
  const totalTrades = trades.length;
  const recentTrades = trades.slice(0, 5);

  // Allocation by asset type
  const allocationData = holdings.reduce((acc, h) => {
    const existing = acc.find((a) => a.name === h.asset_type);
    if (existing) {
      existing.value += h.total_invested;
    } else {
      acc.push({ name: h.asset_type, value: h.total_invested });
    }
    return acc;
  }, [] as { name: string; value: number }[]);

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
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Invested</p>
                <p className="text-2xl font-bold font-mono mt-1">
                  ${totalInvested.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Holdings</p>
                <p className="text-2xl font-bold font-mono mt-1">{holdings.length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Trades</p>
                <p className="text-2xl font-bold font-mono mt-1">{totalTrades}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Buys / Sells</p>
                <p className="text-2xl font-bold font-mono mt-1">
                  {trades.filter((t) => t.trade_type === "buy").length} / {trades.filter((t) => t.trade_type === "sell").length}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingDown className="h-5 w-5 text-primary" />
              </div>
            </div>
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
                      contentStyle={{ background: "hsl(222, 47%, 8%)", border: "1px solid hsl(222, 30%, 16%)", borderRadius: "8px" }}
                      itemStyle={{ color: "hsl(210, 40%, 95%)" }}
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
              <p className="text-muted-foreground text-sm text-center py-8">No holdings yet. Add your first trade!</p>
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
              <p className="text-muted-foreground text-sm text-center py-8">No holdings yet</p>
            )}
          </CardContent>
        </Card>
      </div>

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
                      <span className={t.trade_type === "buy" ? "text-gain" : "text-loss"}>
                        {t.trade_type.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{t.quantity}</TableCell>
                    <TableCell className="text-right font-mono">${Number(t.price_per_unit).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">${Number(t.total_amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">No trades yet. Get started by adding your first trade!</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
