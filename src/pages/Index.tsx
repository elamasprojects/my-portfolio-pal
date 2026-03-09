import { useMemo, useState } from "react";
import { useTrades, computeHoldings, computePerformance, computeCumulativePnL } from "@/hooks/usePortfolio";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useProfile } from "@/hooks/useProfile";
import { useDolarMEP, convertUsdToArs } from "@/hooks/useDolarMEP";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, DollarSign, BarChart3, Plus, Target, Percent, Banknote, LineChart as LineChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, AreaChart, Area } from "recharts";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";

const CHART_COLORS = [
  "hsl(42, 80%, 55%)",
  "hsl(152, 55%, 45%)",
  "hsl(220, 8%, 60%)",
  "hsl(30, 60%, 50%)",
  "hsl(220, 10%, 35%)",
];

const Index = () => {
  const { data: trades = [], isLoading } = useTrades();
  const { profile } = useProfile();
  const { venta: mepRate } = useDolarMEP();
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "ARS">("USD");
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Initialize display currency from profile preference
  const [currencyInitialized, setCurrencyInitialized] = useState(false);
  if (profile && !currencyInitialized) {
    setDisplayCurrency((profile.default_currency as "USD" | "ARS") || "USD");
    setCurrencyInitialized(true);
  }

  const holdings = computeHoldings(trades);
  const performance = computePerformance(trades);
  const cumulativePnL = useMemo(() => computeCumulativePnL(trades), [trades]);

  const isARS = displayCurrency === "ARS";
  const cx = (usd: number) => isARS ? convertUsdToArs(usd, mepRate) : usd;
  const currencySymbol = isARS ? "ARS$" : "$";
  const fmt = (v: number) => `${currencySymbol}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  // Live market prices
  const { prices: marketPrices, isLoading: pricesLoading } = useMarketPrices(holdings.map(h => h.symbol));

  const marketValue = useMemo(() => 
    holdings.reduce((s, h) => {
      const price = marketPrices.get(h.symbol.toUpperCase());
      return s + (price ? price * h.net_quantity : h.total_invested);
    }, 0),
    [holdings, marketPrices]
  );

  const unrealizedPnl = useMemo(() => 
    holdings.reduce((s, h) => {
      const price = marketPrices.get(h.symbol.toUpperCase());
      if (!price) return s;
      return s + (price - h.avg_cost) * h.net_quantity;
    }, 0),
    [holdings, marketPrices]
  );

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

  const pnlByAsset = performance.by_symbol
    .filter((s) => s.realized_pnl !== 0 || s.dividends_received !== 0)
    .sort((a, b) => b.total_return - a.total_return)
    .slice(0, 10);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-muted-foreground">{t("board.loadingPortfolio")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl chess-title">{t("board.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("board.subtitle")}</p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <CurrencyToggle value={displayCurrency} onChange={setDisplayCurrency} />
          {isARS && mepRate > 0 && (
            <span className="text-[10px] text-muted-foreground">{t("board.exchangeRate")} · ${mepRate.toFixed(2)}</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("board.costBasis")}</p>
                <p className="text-2xl font-bold font-mono mt-1">
                  {fmt(cx(performance.total_cost_basis))}
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
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("board.marketValue")}</p>
                <p className="text-2xl font-bold font-mono mt-1">
                  {pricesLoading ? <Skeleton className="h-8 w-24" /> : fmt(cx(marketValue))}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <LineChartIcon className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("board.realizedPnl")}</p>
                <p className={`text-2xl font-bold font-mono mt-1 ${performance.total_realized_pnl >= 0 ? "text-gain" : "text-loss"}`}>
                  {performance.total_realized_pnl >= 0 ? "+" : ""}
                  {fmt(cx(performance.total_realized_pnl))}
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
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("board.unrealizedPnl")}</p>
                {pricesLoading ? (
                  <Skeleton className="h-8 w-24 mt-1" />
                ) : (
                  <p className={`text-2xl font-bold font-mono mt-1 ${unrealizedPnl >= 0 ? "text-gain" : "text-loss"}`}>
                    {unrealizedPnl >= 0 ? "+" : ""}{fmt(cx(unrealizedPnl))}
                  </p>
                )}
              </div>
              <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${unrealizedPnl >= 0 ? "bg-gain/10" : "bg-loss/10"}`}>
                {unrealizedPnl >= 0 ? (
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
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("board.winRate")}</p>
                <p className="text-2xl font-bold font-mono mt-1">
                  {performance.total_sells > 0 ? `${performance.win_rate.toFixed(0)}%` : "—"}
                </p>
                {performance.total_sells > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {performance.winning_sells}/{performance.total_sells} {t("common.sells")}
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
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("board.dividends")}</p>
                <p className="text-2xl font-bold font-mono mt-1 text-gain">
                  {fmt(cx(performance.total_dividends))}
                </p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-gain/10 flex items-center justify-center">
                <Banknote className="h-5 w-5 text-gain" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("board.holdings")}</p>
            <p className="text-xl font-bold font-mono mt-1">{holdings.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("board.totalTrades")}</p>
            <p className="text-xl font-bold font-mono mt-1">{totalTrades}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("board.buysSells")}</p>
            <p className="text-xl font-bold font-mono mt-1">
              {trades.filter((t) => t.trade_type === "buy").length} / {trades.filter((t) => t.trade_type === "sell").length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("board.totalReturn")}</p>
            <p className={`text-xl font-bold font-mono mt-1 ${performance.total_return >= 0 ? "text-gain" : "text-loss"}`}>
              {performance.total_return >= 0 ? "+" : ""}{fmt(cx(performance.total_return))}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">{t("board.allocationByType")}</CardTitle>
          </CardHeader>
          <CardContent>
            {allocationData.length > 0 ? (
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={allocationData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {allocationData.map((_, index) => (
                        <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value: number) => fmt(cx(value))}
                      contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }}
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
                <p className="text-muted-foreground text-sm">{t("board.noHoldings")}</p>
                <Button size="sm" onClick={() => navigate("/add")}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("board.addFirstTrade")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t("board.holdings")}</CardTitle>
          </CardHeader>
          <CardContent>
            {holdings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("board.symbol")}</TableHead>
                    <TableHead>{t("board.name")}</TableHead>
                    <TableHead>{t("board.type")}</TableHead>
                    <TableHead className="text-right">{t("board.qty")}</TableHead>
                <TableHead className="text-right">{t("board.avgCost")}</TableHead>
                    <TableHead className="text-right">{t("board.currentPrice")}</TableHead>
                    <TableHead className="text-right">{t("board.total")}</TableHead>
                    <TableHead className="text-right">{t("board.unrealizedPnl")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((h) => {
                    const currentPrice = marketPrices.get(h.symbol.toUpperCase());
                    const mktVal = currentPrice ? currentPrice * h.net_quantity : null;
                    const uPnl = currentPrice ? (currentPrice - h.avg_cost) * h.net_quantity : null;
                    return (
                    <TableRow key={h.symbol} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/asset/${h.symbol}`)}>
                      <TableCell className="font-mono font-semibold text-primary">{h.symbol}</TableCell>
                      <TableCell className="text-muted-foreground">{h.asset_name}</TableCell>
                      <TableCell className="capitalize text-muted-foreground">{h.asset_type}</TableCell>
                      <TableCell className="text-right font-mono">{h.net_quantity.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">${h.avg_cost.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">
                        {pricesLoading ? <Skeleton className="h-4 w-14 ml-auto" /> : currentPrice ? `$${currentPrice.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {pricesLoading ? <Skeleton className="h-4 w-16 ml-auto" /> : mktVal !== null ? `$${mktVal.toFixed(2)}` : `$${h.total_invested.toFixed(2)}`}
                      </TableCell>
                      <TableCell className={`text-right font-mono font-semibold ${uPnl === null ? "" : uPnl >= 0 ? "text-gain" : "text-loss"}`}>
                        {pricesLoading ? <Skeleton className="h-4 w-16 ml-auto" /> : uPnl !== null ? `${uPnl >= 0 ? "+" : ""}$${uPnl.toFixed(2)}` : "—"}
                      </TableCell>
                    </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="flex flex-col items-center gap-3 py-8">
                <p className="text-muted-foreground text-sm">{t("board.noHoldings")}</p>
                <Button variant="outline" size="sm" onClick={() => navigate("/add")}>
                  <Plus className="h-4 w-4 mr-1" />
                  {t("board.addTrade")}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {pnlByAsset.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("board.pnlByAsset")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pnlByAsset} layout="vertical" margin={{ left: 60, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis type="category" dataKey="symbol" tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontFamily: "JetBrains Mono" }} width={55} />
                  <ReferenceLine x={0} stroke="hsl(var(--border))" />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(2)}`, t("board.totalReturn")]}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                  />
                  <Bar dataKey="total_return" radius={[0, 4, 4, 0]}>
                    {pnlByAsset.map((entry, i) => (
                      <Cell key={i} fill={entry.total_return >= 0 ? "hsl(var(--gain))" : "hsl(var(--loss))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {cumulativePnL.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("board.pnlOverTime")}</CardTitle>
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
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `$${v}`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(2)}`, t("board.cumulativePnl")]}
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                  />
                  <Area type="monotone" dataKey="cumulative_pnl" stroke="hsl(var(--gain))" fill="url(#pnlGradient)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("board.recentTrades")}</CardTitle>
        </CardHeader>
        <CardContent>
          {recentTrades.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("board.date")}</TableHead>
                  <TableHead>{t("board.symbol")}</TableHead>
                  <TableHead>{t("board.type")}</TableHead>
                  <TableHead className="text-right">{t("board.qty")}</TableHead>
                  <TableHead className="text-right">{t("board.price")}</TableHead>
                  <TableHead className="text-right">{t("board.total")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentTrades.map((t_) => (
                  <TableRow key={t_.id}>
                    <TableCell className="text-muted-foreground">{new Date(t_.trade_date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono font-semibold">{t_.symbol}</TableCell>
                    <TableCell>
                      <span className={
                        t_.trade_type === "buy"
                          ? "text-gain"
                          : t_.trade_type === "sell"
                          ? "text-loss"
                          : "text-primary"
                      }>
                        {t_.trade_type.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {t_.trade_type === "dividend" ? "—" : t_.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {t_.trade_type === "dividend" ? "—" : `$${Number(t_.price_per_unit).toFixed(2)}`}
                    </TableCell>
                    <TableCell className="text-right font-mono">${Number(t_.total_amount).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center gap-3 py-8">
              <p className="text-muted-foreground text-sm">{t("board.noTrades")}</p>
              <Button variant="outline" size="sm" onClick={() => navigate("/add")}>
                <Plus className="h-4 w-4 mr-1" />
                {t("board.getStarted")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
