import { useMemo, useState } from "react";
import { useTrades, computeHoldings, computePerformance, computeCash, computeCumulativePnLWithUnrealized, inferMarket } from "@/hooks/usePortfolio";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useProfile } from "@/hooks/useProfile";
import { useDolarMEP, convertUsdToArs } from "@/hooks/useDolarMEP";
import { useIsMobile } from "@/hooks/use-mobile";
import { useBrokers } from "@/hooks/useBrokers";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TrendingUp, TrendingDown, DollarSign, Plus, Target, Banknote, Wallet, ArrowUpRight, ArrowDownRight, ChevronDown, ChevronUp } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine, AreaChart, Area, Legend } from "recharts";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/i18n";

const CHART_COLORS = [
  "hsl(42, 80%, 55%)",
  "hsl(152, 55%, 45%)",
  "hsl(220, 8%, 60%)",
  "hsl(30, 60%, 50%)",
  "hsl(220, 10%, 35%)",
  "hsl(280, 50%, 55%)",
  "hsl(190, 60%, 45%)",
  "hsl(350, 60%, 50%)",
];

const Index = () => {
  const { data: trades = [], isLoading } = useTrades();
  const { data: brokersList = [] } = useBrokers();
  const { profile } = useProfile();
  const { venta: mepRate } = useDolarMEP();
  const [displayCurrency, setDisplayCurrency] = useState<"USD" | "ARS">("USD");
  const [assetBrokerFilter, setAssetBrokerFilter] = useState<string | null>(null);
  const [dailyExpanded, setDailyExpanded] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const [currencyInitialized, setCurrencyInitialized] = useState(false);
  if (profile && !currencyInitialized) {
    setDisplayCurrency((profile.default_currency as "USD" | "ARS") || "USD");
    setCurrencyInitialized(true);
  }

  const holdings = computeHoldings(trades);
  const performance = computePerformance(trades);
  const cash = useMemo(() => computeCash(trades), [trades]);

  const isARS = displayCurrency === "ARS";
  const cx = (usd: number) => isARS ? convertUsdToArs(usd, mepRate) : usd;
  const currencySymbol = isARS ? "ARS$" : "$";
  const fmt = (v: number) => `${currencySymbol}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtCompact = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${currencySymbol}${(v / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${currencySymbol}${(v / 1_000).toFixed(1)}K`;
    return fmt(v);
  };

  const { prices: marketPrices, previousCloses, isLoading: pricesLoading } = useMarketPrices(holdings.map(h => h.symbol));

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

  const cumulativePnL = useMemo(() => computeCumulativePnLWithUnrealized(trades, marketPrices), [trades, marketPrices]);

  const combinedWinRate = useMemo(() => {
    let openWinning = 0;
    let openTotal = 0;
    for (const h of holdings) {
      const price = marketPrices.get(h.symbol.toUpperCase());
      if (price !== undefined && price !== null) {
        if (price > h.avg_cost) {
          openWinning++;
        }
        openTotal++;
      }
    }
    const wins = performance.winning_sells + openWinning;
    const total = performance.total_sells + openTotal;
    const rate = total > 0 ? (wins / total) * 100 : 0;
    return { wins, total, rate };
  }, [holdings, marketPrices, performance.winning_sells, performance.total_sells]);

  const totalPortfolioValue = marketValue + cash;
  const totalPnl = performance.total_realized_pnl + unrealizedPnl + performance.total_dividends;
  const totalPnlPct = performance.total_cost_basis > 0 ? (totalPnl / performance.total_cost_basis) * 100 : 0;

  // Daily performance
  const dailyChange = useMemo(() =>
    holdings.reduce((s, h) => {
      const price = marketPrices.get(h.symbol.toUpperCase());
      const prevClose = previousCloses.get(h.symbol.toUpperCase());
      if (!price || !prevClose) return s;
      return s + (price - prevClose) * h.net_quantity;
    }, 0),
    [holdings, marketPrices, previousCloses]
  );
  const dailyChangePct = totalPortfolioValue - dailyChange > 0
    ? (dailyChange / (totalPortfolioValue - dailyChange)) * 100
    : 0;

  const dailyBreakdown = useMemo(() => {
    const list = holdings.map((h) => {
      const price = marketPrices.get(h.symbol.toUpperCase());
      const prevClose = previousCloses.get(h.symbol.toUpperCase());
      if (!price || !prevClose) return null;
      
      const changePerShare = price - prevClose;
      const amountChange = changePerShare * h.net_quantity;
      const pctChange = prevClose > 0 ? (changePerShare / prevClose) * 100 : 0;
      
      const prevTotalPortfolioValue = totalPortfolioValue - dailyChange;
      const portfolioContribPct = prevTotalPortfolioValue > 0 ? (amountChange / prevTotalPortfolioValue) * 100 : 0;

      return {
        symbol: h.symbol,
        amountChange,
        pctChange,
        portfolioContribPct,
        net_quantity: h.net_quantity,
        currentPrice: price,
        prevClose,
      };
    }).filter(Boolean) as {
      symbol: string;
      amountChange: number;
      pctChange: number;
      portfolioContribPct: number;
      net_quantity: number;
      currentPrice: number;
      prevClose: number;
    }[];

    // Sort by absolute change descending, so the biggest movers (positive or negative) are at the top
    return list.sort((a, b) => Math.abs(b.amountChange) - Math.abs(a.amountChange));
  }, [holdings, marketPrices, previousCloses, totalPortfolioValue, dailyChange]);

  const totalTrades = trades.filter((t) => t.trade_type !== "dividend").length;
  const recentTrades = trades.slice(0, 5);

  // Allocation by type
  const allocationByType = useMemo(() => {
    const data = holdings.reduce((acc, h) => {
      const mktPrice = marketPrices.get(h.symbol.toUpperCase());
      const val = mktPrice ? mktPrice * h.net_quantity : h.total_invested;
      const existing = acc.find((a) => a.name === h.asset_type);
      if (existing) existing.value += val;
      else acc.push({ name: h.asset_type, value: val });
      return acc;
    }, [] as { name: string; value: number }[]);
    if (cash > 0) data.push({ name: "cash", value: cash });
    return data;
  }, [holdings, cash, marketPrices]);

  // Allocation by individual asset
  const allocationByAsset = useMemo(() => {
    const data = holdings.map(h => {
      const mktPrice = marketPrices.get(h.symbol.toUpperCase());
      const val = mktPrice ? mktPrice * h.net_quantity : h.total_invested;
      return { name: h.symbol, value: val };
    }).sort((a, b) => b.value - a.value);
    if (cash > 0) data.push({ name: "Cash", value: cash });
    return data;
  }, [holdings, cash, marketPrices]);

  // Allocation by market
  const allocationByMarket = useMemo(() => {
    const map = new Map<string, number>();
    for (const h of holdings) {
      const market = inferMarket(h.symbol);
      const mktPrice = marketPrices.get(h.symbol.toUpperCase());
      const val = mktPrice ? mktPrice * h.net_quantity : h.total_invested;
      map.set(market, (map.get(market) || 0) + val);
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [holdings, marketPrices]);

  // Broker name map
  const brokerNameMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const b of brokersList) m.set(b.id, b.name);
    return m;
  }, [brokersList]);

  // Allocation by broker
  const allocationByBroker = useMemo(() => {
    const brokerPositions = new Map<string, Map<string, { qty: number; buyCost: number; symbol: string }>>();
    for (const t_ of trades) {
      if (t_.trade_type === "dividend") continue;
      const bKey = t_.broker_id || "__none__";
      if (!brokerPositions.has(bKey)) brokerPositions.set(bKey, new Map());
      const symMap = brokerPositions.get(bKey)!;
      const pos = symMap.get(t_.symbol) || { qty: 0, buyCost: 0, symbol: t_.symbol };
      if (t_.trade_type === "buy") {
        pos.buyCost += t_.quantity * t_.price_per_unit;
        pos.qty += t_.quantity;
      } else {
        pos.qty -= t_.quantity;
      }
      symMap.set(t_.symbol, pos);
    }
    const result: { name: string; value: number }[] = [];
    for (const [bKey, symMap] of brokerPositions.entries()) {
      let total = 0;
      for (const [sym, pos] of symMap.entries()) {
        if (pos.qty <= 0) continue;
        const mktPrice = marketPrices.get(sym.toUpperCase());
        const avgCost = pos.buyCost / (pos.qty + (pos.qty <= 0 ? pos.qty : 0)); // simplified
        total += mktPrice ? mktPrice * pos.qty : (pos.buyCost > 0 ? (pos.buyCost / (pos.qty > 0 ? pos.qty : 1)) * pos.qty : 0);
      }
      if (total > 0) {
        const name = bKey === "__none__" ? t("board.noBroker") : (brokerNameMap.get(bKey) || t("board.noBroker"));
        result.push({ name, value: total });
      }
    }
    return result.sort((a, b) => b.value - a.value);
  }, [trades, marketPrices, brokerNameMap, t]);

  // Brokers that have trades (for filter dropdown)
  const brokersInTrades = useMemo(() => {
    const set = new Set<string>();
    for (const t_ of trades) {
      if (t_.broker_id) set.add(t_.broker_id);
    }
    return Array.from(set).map(id => ({ id, name: brokerNameMap.get(id) || id }));
  }, [trades, brokerNameMap]);

  // Filtered allocation by asset (when broker filter active)
  const filteredAllocationByAsset = useMemo(() => {
    if (!assetBrokerFilter) return allocationByAsset;
    const filteredTrades = trades.filter(t_ => t_.broker_id === assetBrokerFilter);
    const filteredHoldings = computeHoldings(filteredTrades);
    const data = filteredHoldings.map(h => {
      const mktPrice = marketPrices.get(h.symbol.toUpperCase());
      const val = mktPrice ? mktPrice * h.net_quantity : h.total_invested;
      return { name: h.symbol, value: val };
    }).sort((a, b) => b.value - a.value);
    return data;
  }, [assetBrokerFilter, allocationByAsset, trades, marketPrices]);

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

  // Holdings with computed P&L
  const holdingsWithPnl = holdings.map(h => {
    const currentPrice = marketPrices.get(h.symbol.toUpperCase());
    const mktVal = currentPrice ? currentPrice * h.net_quantity : null;
    const uPnl = currentPrice ? (currentPrice - h.avg_cost) * h.net_quantity : null;
    const uPnlPct = currentPrice && h.avg_cost > 0 ? ((currentPrice - h.avg_cost) / h.avg_cost) * 100 : null;
    return { ...h, currentPrice, mktVal, uPnl, uPnlPct };
  });

  const chartTooltipStyle = {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--popover-foreground))",
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header row */}
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

      {/* ═══════ HERO CARD ═══════ */}
      <Card className="border-primary/30 bg-gradient-to-br from-card to-accent/20">
        <CardContent className="p-5 md:p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("board.portfolioValue")}</p>
              {pricesLoading ? (
                <Skeleton className="h-10 w-40 mt-1" />
              ) : (
                <p className="text-3xl md:text-4xl font-bold font-mono mt-1">
                  {fmt(cx(totalPortfolioValue))}
                </p>
              )}
              <div className="flex items-center gap-1.5 mt-1">
                {pricesLoading ? (
                  <Skeleton className="h-4 w-20" />
                ) : (
                  <>
                    {totalPnl >= 0 ? (
                      <ArrowUpRight className="h-4 w-4 text-gain" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-loss" />
                    )}
                    <span className={`text-sm font-semibold font-mono ${totalPnl >= 0 ? "text-gain" : "text-loss"}`}>
                      {totalPnl >= 0 ? "+" : ""}{fmt(cx(totalPnl))} ({totalPnlPct >= 0 ? "+" : ""}{totalPnlPct.toFixed(1)}%)
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
              <div>
                <p className="text-xs uppercase tracking-wider">{t("board.costBasis")}</p>
                <p className="font-mono font-semibold text-foreground">{fmt(cx(performance.total_cost_basis))}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider">{t("board.dividends")}</p>
                <p className="font-mono font-semibold text-gain">{fmt(cx(performance.total_dividends))}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider">{t("board.totalTrades")}</p>
                <p className="font-mono font-semibold text-foreground">{totalTrades}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════ TODAY'S PERFORMANCE ═══════ */}
      {profile?.show_daily_performance !== false && !pricesLoading && holdings.length > 0 && (
        <Collapsible open={dailyExpanded} onOpenChange={setDailyExpanded} className="w-full">
          <Card className={`border-l-4 ${dailyChange >= 0 ? "border-l-gain" : "border-l-loss"} overflow-hidden`}>
            <CollapsibleTrigger asChild>
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-accent/10 transition-colors select-none">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${dailyChange >= 0 ? "bg-gain/10" : "bg-loss/10"}`}>
                    {dailyChange >= 0 ? <TrendingUp className="h-5 w-5 text-gain" /> : <TrendingDown className="h-5 w-5 text-loss" />}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("board.todayPerformance")}</p>
                    <p className={`text-lg font-bold font-mono ${dailyChange >= 0 ? "text-gain" : "text-loss"}`}>
                      {dailyChange >= 0 ? "+" : ""}{fmt(cx(dailyChange))}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className={`font-mono text-sm ${dailyChange >= 0 ? "text-gain border-gain/30" : "text-loss border-loss/30"}`}>
                    {dailyChangePct >= 0 ? "+" : ""}{dailyChangePct.toFixed(2)}%
                  </Badge>
                  {dailyBreakdown.length > 0 && (
                    dailyExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                </div>
              </div>
            </CollapsibleTrigger>
            
            {dailyBreakdown.length > 0 && (
              <CollapsibleContent className="border-t border-border/50 bg-accent/5">
                <div className="p-4 animate-in fade-in slide-in-from-top-1 duration-200">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("board.dailyBreakdown")}</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                    {dailyBreakdown.map((b) => (
                      <div key={b.symbol} className="p-3 rounded-lg border border-border/50 bg-card hover:bg-accent/10 transition-all flex flex-col justify-between shadow-sm">
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="font-mono font-bold text-sm text-foreground">{b.symbol}</span>
                          <span className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded ${b.amountChange >= 0 ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"}`}>
                            {b.amountChange >= 0 ? "+" : ""}{b.pctChange.toFixed(2)}%
                          </span>
                        </div>
                        <div className="space-y-1 text-xs">
                          <div className="flex justify-between font-mono">
                            <span className="text-muted-foreground">{t("board.dailyPnl")}</span>
                            <span className={`font-semibold ${b.amountChange >= 0 ? "text-gain" : "text-loss"}`}>
                              {b.amountChange >= 0 ? "+" : ""}{fmt(cx(b.amountChange))}
                            </span>
                          </div>
                          <div className="flex justify-between font-mono text-[10px]">
                            <span className="text-muted-foreground">{t("board.portfolioContrib")}</span>
                            <span className={`font-semibold ${b.amountChange >= 0 ? "text-gain" : "text-loss"}`}>
                              {b.amountChange >= 0 ? "+" : ""}{b.portfolioContribPct.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CollapsibleContent>
            )}
          </Card>
        </Collapsible>
      )}

      {/* ═══════ METRICS GRID (2x2 mobile, 4-col desktop) ═══════ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider truncate">{t("board.realizedPnl")}</p>
                <p className={`text-lg md:text-xl font-bold font-mono mt-0.5 ${performance.total_realized_pnl >= 0 ? "text-gain" : "text-loss"}`}>
                  {performance.total_realized_pnl >= 0 ? "+" : ""}{fmtCompact(cx(performance.total_realized_pnl))}
                </p>
              </div>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${performance.total_realized_pnl >= 0 ? "bg-gain/10" : "bg-loss/10"}`}>
                {performance.total_realized_pnl >= 0 ? <TrendingUp className="h-4 w-4 text-gain" /> : <TrendingDown className="h-4 w-4 text-loss" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider truncate">{t("board.unrealizedPnl")}</p>
                {pricesLoading ? (
                  <Skeleton className="h-6 w-16 mt-1" />
                ) : (
                  <p className={`text-lg md:text-xl font-bold font-mono mt-0.5 ${unrealizedPnl >= 0 ? "text-gain" : "text-loss"}`}>
                    {unrealizedPnl >= 0 ? "+" : ""}{fmtCompact(cx(unrealizedPnl))}
                  </p>
                )}
              </div>
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${unrealizedPnl >= 0 ? "bg-gain/10" : "bg-loss/10"}`}>
                {unrealizedPnl >= 0 ? <TrendingUp className="h-4 w-4 text-gain" /> : <TrendingDown className="h-4 w-4 text-loss" />}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider truncate mb-1">
                  {t("board.winRate")}
                </p>
                <div className="flex items-baseline gap-3">
                  <div>
                    <p className="text-lg md:text-xl font-bold font-mono">
                      {performance.total_sells > 0 ? `${performance.win_rate.toFixed(0)}%` : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 whitespace-nowrap">
                      {performance.total_sells > 0 ? `${performance.winning_sells}/${performance.total_sells}` : "0/0"}{" "}
                      <span className="text-[9px] opacity-80 font-sans">({t("board.realized")})</span>
                    </p>
                  </div>
                  <div className="border-l pl-3 border-border">
                    <p className="text-base md:text-lg font-bold font-mono text-muted-foreground">
                      {combinedWinRate.total > 0 ? `${combinedWinRate.rate.toFixed(0)}%` : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground/75 mt-0.5 whitespace-nowrap">
                      {combinedWinRate.total > 0 ? `${combinedWinRate.wins}/${combinedWinRate.total}` : "0/0"}{" "}
                      <span className="text-[9px] opacity-80 font-sans">({t("board.projected")})</span>
                    </p>
                  </div>
                </div>
              </div>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 ml-2 mt-0.5">
                <Target className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wider truncate">{t("board.cash")}</p>
                <p className="text-lg md:text-xl font-bold font-mono mt-0.5">
                  {fmtCompact(cx(cash))}
                </p>
              </div>
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Wallet className="h-4 w-4 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ═══════ HOLDINGS + ALLOCATION (side by side on desktop) ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
        {/* Holdings */}
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{t("board.holdings")}</CardTitle>
          </CardHeader>
          <CardContent>
            {holdingsWithPnl.length > 0 ? (
              isMobile ? (
                /* ── Mobile: Cards ── */
                <div className="space-y-2">
                  {holdingsWithPnl.map((h) => (
                    <div
                      key={h.symbol}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/30 cursor-pointer transition-colors"
                      onClick={() => navigate(`/asset/${h.symbol}`)}
                    >
                      <div className="min-w-0">
                        <p className="font-mono font-semibold text-primary text-sm">{h.symbol}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {h.net_quantity.toFixed(2)} @ {currencySymbol}{cx(h.avg_cost).toFixed(2)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {pricesLoading ? (
                          <Skeleton className="h-5 w-16 ml-auto" />
                        ) : (
                          <>
                            <p className="font-mono text-sm font-semibold">
                              {h.mktVal !== null ? fmtCompact(cx(h.mktVal)) : fmtCompact(cx(h.total_invested))}
                            </p>
                            {h.uPnlPct !== null && (
                              <p className={`text-[11px] font-mono font-semibold ${h.uPnl! >= 0 ? "text-gain" : "text-loss"}`}>
                                {h.uPnl! >= 0 ? "+" : ""}{h.uPnlPct.toFixed(1)}%
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* ── Desktop: Table ── */
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("board.symbol")}</TableHead>
                      <TableHead className="text-right">{t("board.qty")}</TableHead>
                      <TableHead className="text-right">{t("board.avgCost")}</TableHead>
                      <TableHead className="text-right">{t("board.price")}</TableHead>
                      <TableHead className="text-right">{t("board.mktVal")}</TableHead>
                      <TableHead className="text-right">{t("board.pnl")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdingsWithPnl.map((h) => (
                      <TableRow key={h.symbol} className="cursor-pointer hover:bg-accent/50" onClick={() => navigate(`/asset/${h.symbol}`)}>
                        <TableCell className="font-mono font-semibold text-primary">{h.symbol}</TableCell>
                        <TableCell className="text-right font-mono">{h.net_quantity.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">{currencySymbol}{cx(h.avg_cost).toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">
                          {pricesLoading ? <Skeleton className="h-4 w-14 ml-auto" /> : h.currentPrice ? `${currencySymbol}${cx(h.currentPrice).toFixed(2)}` : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {pricesLoading ? <Skeleton className="h-4 w-16 ml-auto" /> : h.mktVal !== null ? fmt(cx(h.mktVal)) : fmt(cx(h.total_invested))}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-semibold ${h.uPnl === null ? "" : h.uPnl >= 0 ? "text-gain" : "text-loss"}`}>
                          {pricesLoading ? <Skeleton className="h-4 w-16 ml-auto" /> : h.uPnlPct !== null ? `${h.uPnlPct >= 0 ? "+" : ""}${h.uPnlPct.toFixed(1)}%` : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
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

        {/* Allocation Tabs */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("board.allocationByType")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="type">
              <TabsList className="w-full h-8">
                <TabsTrigger value="type" className="text-xs flex-1">{t("board.byType")}</TabsTrigger>
                <TabsTrigger value="asset" className="text-xs flex-1">{t("board.byAsset")}</TabsTrigger>
                <TabsTrigger value="market" className="text-xs flex-1">{t("board.byMarket")}</TabsTrigger>
                <TabsTrigger value="broker" className="text-xs flex-1">{t("board.byBroker")}</TabsTrigger>
              </TabsList>
              {["type", "market", "broker"].map((tab) => {
                const data = tab === "type" ? allocationByType : tab === "market" ? allocationByMarket : allocationByBroker;
                const total = data.reduce((s, d) => s + d.value, 0);
                return (
                  <TabsContent key={tab} value={tab}>
                    {data.length > 0 ? (
                      <>
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                                {data.map((_, i) => (
                                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value: number) => `${fmt(cx(value))} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`}
                                contentStyle={chartTooltipStyle}
                                itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {data.map((entry, i) => (
                            <div key={entry.name} className="flex items-center gap-1 text-[11px]">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                              <span className="text-muted-foreground capitalize truncate max-w-[80px]">{entry.name}</span>
                              <span className="text-foreground font-mono">{total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0}%</span>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-3 py-8">
                        <p className="text-muted-foreground text-sm">{t("board.noHoldings")}</p>
                      </div>
                    )}
                  </TabsContent>
                );
              })}

              {/* By Asset tab with broker filter */}
              <TabsContent value="asset">
                {brokersInTrades.length > 0 && (
                  <div className="mb-3">
                    <Select value={assetBrokerFilter || "all"} onValueChange={(v) => setAssetBrokerFilter(v === "all" ? null : v)}>
                      <SelectTrigger className="h-8 text-xs w-full">
                        <SelectValue placeholder={t("board.allBrokers")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("board.allBrokers")}</SelectItem>
                        {brokersInTrades.map((b) => (
                          <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {(() => {
                  const data = filteredAllocationByAsset;
                  const total = data.reduce((s, d) => s + d.value, 0);
                  return data.length > 0 ? (
                    <>
                      <div className="h-44">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={2} dataKey="value">
                              {data.map((_, i) => (
                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value: number) => `${fmt(cx(value))} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`}
                              contentStyle={chartTooltipStyle}
                              itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="flex flex-wrap gap-2 justify-center">
                        {data.map((entry, i) => (
                          <div key={entry.name} className="flex items-center gap-1 text-[11px]">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="text-muted-foreground capitalize truncate max-w-[80px]">{entry.name}</span>
                            <span className="text-foreground font-mono">{total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0}%</span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-8">
                      <p className="text-muted-foreground text-sm">{t("board.noHoldings")}</p>
                    </div>
                  );
                })()}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* ═══════ P&L OVER TIME (dual line) ═══════ */}
      {cumulativePnL.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("board.pnlOverTime")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cumulativePnL} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
                  <defs>
                    <linearGradient id="pnlGradientRealized" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(42, 80%, 55%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(42, 80%, 55%)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="pnlGradientNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(152, 55%, 45%)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(152, 55%, 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis tickFormatter={(v) => `${currencySymbol}${cx(v).toFixed(0)}`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="hsl(var(--border))" />
                  <Tooltip
                    formatter={(value: number, name: string) => [
                      fmt(cx(value)),
                      name === "cumulative_pnl" ? t("board.realizedLine") : t("board.netLine"),
                    ]}
                    contentStyle={chartTooltipStyle}
                    itemStyle={{ color: "hsl(var(--popover-foreground))" }}
                  />
                  <Legend
                    formatter={(value) => value === "cumulative_pnl" ? t("board.realizedLine") : t("board.netLine")}
                    wrapperStyle={{ fontSize: 11 }}
                  />
                  <Area type="monotone" dataKey="cumulative_pnl" stroke="hsl(42, 80%, 55%)" fill="url(#pnlGradientRealized)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="net_pnl" stroke="hsl(152, 55%, 45%)" fill="url(#pnlGradientNet)" strokeWidth={2} dot={false} strokeDasharray="5 3" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══════ P&L BY ASSET + RECENT TRADES (side by side on desktop) ═══════ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {pnlByAsset.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{t("board.pnlByAsset")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pnlByAsset} layout="vertical" margin={{ left: 60, right: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tickFormatter={(v) => `${currencySymbol}${cx(v).toFixed(0)}`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis type="category" dataKey="symbol" tick={{ fill: "hsl(var(--foreground))", fontSize: 12, fontFamily: "JetBrains Mono" }} width={55} />
                    <ReferenceLine x={0} stroke="hsl(var(--border))" />
                    <Tooltip
                      formatter={(value: number) => [fmt(cx(value)), t("board.totalReturn")]}
                      contentStyle={chartTooltipStyle}
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

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("board.recentTrades")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentTrades.length > 0 ? (
              isMobile ? (
                /* ── Mobile: Cards ── */
                <div className="space-y-2">
                  {recentTrades.map((t_) => (
                    <div key={t_.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge
                          variant={t_.trade_type === "buy" ? "default" : t_.trade_type === "sell" ? "destructive" : "secondary"}
                          className="text-[10px] px-1.5 py-0 shrink-0"
                        >
                          {t_.trade_type.toUpperCase()}
                        </Badge>
                        <div className="min-w-0">
                          <p className="font-mono font-semibold text-sm truncate">{t_.symbol}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(t_.trade_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <p className="font-mono text-sm font-semibold shrink-0">{fmt(cx(Number(t_.total_amount)))}</p>
                    </div>
                  ))}
                </div>
              ) : (
                /* ── Desktop: Table ── */
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("board.date")}</TableHead>
                      <TableHead>{t("board.symbol")}</TableHead>
                      <TableHead>{t("board.type")}</TableHead>
                      <TableHead className="text-right">{t("board.qty")}</TableHead>
                      <TableHead className="text-right">{t("board.total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recentTrades.map((t_) => (
                      <TableRow key={t_.id}>
                        <TableCell className="text-muted-foreground text-xs">{new Date(t_.trade_date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-mono font-semibold">{t_.symbol}</TableCell>
                        <TableCell>
                          <span className={t_.trade_type === "buy" ? "text-gain" : t_.trade_type === "sell" ? "text-loss" : "text-primary"}>
                            {t_.trade_type.toUpperCase()}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {t_.trade_type === "dividend" ? "—" : t_.quantity}
                        </TableCell>
                        <TableCell className="text-right font-mono">{fmt(cx(Number(t_.total_amount)))}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )
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
    </div>
  );
};

export default Index;
