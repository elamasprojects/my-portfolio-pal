import { useState, useMemo, useRef } from "react";
import { useTrades, Trade } from "@/hooks/usePortfolio";
import { useActivePortfolio } from "@/hooks/usePortfolio";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { GitBranch, ArrowUpCircle, ArrowDownCircle, Coins, Filter } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useLanguage } from "@/i18n";

const TRADE_TYPE_COLORS: Record<string, string> = {
  buy: "hsl(var(--gain))",
  sell: "hsl(var(--loss))",
  dividend: "hsl(var(--primary))",
};

const TRADE_TYPE_LABELS: Record<string, string> = {
  buy: "Buy",
  sell: "Sell",
  dividend: "Dividend",
};

interface DayCluster {
  date: string;
  trades: Trade[];
}

function clusterByDay(trades: Trade[]): DayCluster[] {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime()
  );
  const map = new Map<string, Trade[]>();
  for (const t of sorted) {
    const day = t.trade_date.split("T")[0];
    const arr = map.get(day) || [];
    arr.push(t);
    map.set(day, arr);
  }
  return Array.from(map.entries()).map(([date, trades]) => ({ date, trades }));
}

function getNodeSize(amount: number, minAmt: number, maxAmt: number): number {
  const MIN_SIZE = 16;
  const MAX_SIZE = 48;
  if (maxAmt === minAmt) return (MIN_SIZE + MAX_SIZE) / 2;
  const ratio = (amount - minAmt) / (maxAmt - minAmt);
  return MIN_SIZE + ratio * (MAX_SIZE - MIN_SIZE);
}

export default function Timeline() {
  const { activeId } = useActivePortfolio();
  const { data: trades = [], isLoading } = useTrades(activeId || undefined);
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [assetTypeFilter, setAssetTypeFilter] = useState<string>("all");
  const [tradeTypeFilter, setTradeTypeFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    return trades.filter((t) => {
      if (assetTypeFilter !== "all" && t.asset_type !== assetTypeFilter) return false;
      if (tradeTypeFilter !== "all" && t.trade_type !== tradeTypeFilter) return false;
      return true;
    });
  }, [trades, assetTypeFilter, tradeTypeFilter]);

  const clusters = useMemo(() => clusterByDay(filtered), [filtered]);

  const { minAmt, maxAmt } = useMemo(() => {
    const amounts = filtered.map((t) => Math.abs(t.total_amount || t.price_per_unit * t.quantity));
    return { minAmt: Math.min(...amounts, 0), maxAmt: Math.max(...amounts, 1) };
  }, [filtered]);

  const assetTypes = useMemo(() => {
    const types = new Set(trades.map((t) => t.asset_type));
    return Array.from(types);
  }, [trades]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">{t("timeline.loadingTimeline")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl chess-title flex items-center gap-2">
            <GitBranch className="h-6 w-6 text-primary" />
            {t("timeline.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("timeline.subtitle")}</p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{t("timeline.filters")}</span>
            </div>
            <Select value={assetTypeFilter} onValueChange={setAssetTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Asset type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("timeline.allAssets")}</SelectItem>
                {assetTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tradeTypeFilter} onValueChange={setTradeTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Trade type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("timeline.allTypes")}</SelectItem>
                <SelectItem value="buy">{t("timeline.buy")}</SelectItem>
                <SelectItem value="sell">{t("timeline.sell")}</SelectItem>
                <SelectItem value="dividend">{t("timeline.dividend")}</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="secondary" className="ml-auto">
              {filtered.length} trade{filtered.length !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      {clusters.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <GitBranch className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">{t("timeline.noTrades")}</p>
            <p className="text-sm text-muted-foreground/60 mt-1">{t("timeline.addTrades")}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {format(parseISO(clusters[0].date), "MMM yyyy")} — {format(parseISO(clusters[clusters.length - 1].date), "MMM yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="w-full">
              <div className="relative pb-8 pt-4" style={{ minWidth: Math.max(clusters.length * 120, 600) }}>
                {/* Axis line */}
                <div className="absolute left-0 right-0 top-1/2 h-[2px] bg-border" />

                {/* Date ticks + trade nodes */}
                <div className="flex items-center justify-between relative" style={{ minHeight: 180 }}>
                  {clusters.map((cluster, ci) => (
                    <div
                      key={cluster.date}
                      className="flex flex-col items-center relative"
                      style={{ flex: "1 0 auto", minWidth: 80 }}
                    >
                      {/* Stacked trade nodes above/below axis */}
                      <div className="flex flex-col items-center gap-1 mb-2">
                        {cluster.trades.map((trade, ti) => {
                          const amt = Math.abs(trade.total_amount || trade.price_per_unit * trade.quantity);
                          const size = getNodeSize(amt, minAmt, maxAmt);
                          const color = TRADE_TYPE_COLORS[trade.trade_type];
                          const Icon = trade.trade_type === "buy" ? ArrowUpCircle : trade.trade_type === "sell" ? ArrowDownCircle : Coins;

                          return (
                            <HoverCard key={trade.id} openDelay={100} closeDelay={50}>
                              <HoverCardTrigger asChild>
                                <button
                                  onClick={() => navigate(`/asset/${trade.symbol}`)}
                                  className="rounded-full flex items-center justify-center transition-transform hover:scale-125 focus:outline-none focus:ring-2 focus:ring-ring shadow-md cursor-pointer"
                                  style={{
                                    width: size,
                                    height: size,
                                    backgroundColor: color,
                                  }}
                                  title={`${trade.symbol} — ${TRADE_TYPE_LABELS[trade.trade_type]}`}
                                >
                                  <Icon className="text-white" style={{ width: size * 0.5, height: size * 0.5 }} />
                                </button>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-72" side="top">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="font-bold text-foreground">{trade.symbol}</span>
                                    <Badge
                                      style={{ backgroundColor: color }}
                                      className="text-white border-0 text-xs"
                                    >
                                      {TRADE_TYPE_LABELS[trade.trade_type]}
                                    </Badge>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{trade.asset_name}</p>
                                  <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div>
                                      <span className="text-muted-foreground">Qty:</span>{" "}
                                      <span className="font-medium text-foreground">{trade.quantity}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Price:</span>{" "}
                                      <span className="font-medium text-foreground">${trade.price_per_unit.toFixed(2)}</span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Total:</span>{" "}
                                      <span className="font-medium text-foreground">
                                        ${(trade.total_amount || trade.price_per_unit * trade.quantity).toFixed(2)}
                                      </span>
                                    </div>
                                    <div>
                                      <span className="text-muted-foreground">Date:</span>{" "}
                                      <span className="font-medium text-foreground">{format(parseISO(trade.trade_date), "MMM d, yyyy")}</span>
                                    </div>
                                  </div>
                                  {trade.notes && (
                                    <p className="text-xs text-muted-foreground border-t border-border pt-2 italic">
                                      {trade.notes}
                                    </p>
                                  )}
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          );
                        })}
                      </div>

                      {/* Tick mark */}
                      <div className="w-[2px] h-4 bg-border" />

                      {/* Date label */}
                      <span className="text-[10px] text-muted-foreground mt-1 whitespace-nowrap">
                        {format(parseISO(cluster.date), "MMM d")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TRADE_TYPE_COLORS.buy }} />
                <span className="text-xs text-muted-foreground">Buy</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TRADE_TYPE_COLORS.sell }} />
                <span className="text-xs text-muted-foreground">Sell</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: TRADE_TYPE_COLORS.dividend }} />
                <span className="text-xs text-muted-foreground">Dividend</span>
              </div>
              <span className="text-xs text-muted-foreground ml-auto">Node size = trade amount</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
