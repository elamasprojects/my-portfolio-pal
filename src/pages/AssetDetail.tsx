import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTrades, computeHoldings, computePerformance } from "@/hooks/usePortfolio";
import { EditTradeDialog } from "@/components/EditTradeDialog";
import { useLanguage } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { Trade } from "@/hooks/usePortfolio";
import { supabase } from "@/integrations/supabase/client";
import { PriceChart } from "@/components/PriceChart";

const AssetDetail = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { data: trades = [], isLoading } = useTrades();
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const { t } = useLanguage();

  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  const assetTrades = trades.filter((t) => t.symbol === symbol);
  const holdings = computeHoldings(assetTrades);
  const holding = holdings[0];
  const perf = computePerformance(assetTrades);
  const symbolPerf = perf.by_symbol[0];

  useEffect(() => {
    if (!symbol) return;
    setPriceLoading(true);
    supabase.functions
      .invoke("fetch-quote", { body: { symbol } })
      .then(({ data }) => {
        if (data?.price && data.price > 0) {
          setCurrentPrice(data.price);
        }
      })
      .finally(() => setPriceLoading(false));
  }, [symbol]);

  const unrealizedPnl =
    currentPrice && holding ? (currentPrice - holding.avg_cost) * holding.net_quantity : null;
  const unrealizedPct =
    currentPrice && holding && holding.avg_cost > 0
      ? ((currentPrice - holding.avg_cost) / holding.avg_cost) * 100
      : null;
  const marketValue =
    currentPrice && holding ? currentPrice * holding.net_quantity : null;

  if (isLoading) {
    return <div className="animate-pulse text-muted-foreground text-center py-12">{t("common.loading")}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight">{symbol}</h1>
          <p className="text-muted-foreground text-sm">{holding?.asset_name || t("asset.detail")}</p>
        </div>
      </div>

      {holding && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("asset.quantity")}</p>
              <p className="text-xl font-bold font-mono mt-1">{holding.net_quantity}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("asset.avgCost")}</p>
              <p className="text-xl font-bold font-mono mt-1">${holding.avg_cost.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("asset.costBasis")}</p>
              <p className="text-xl font-bold font-mono mt-1">${holding.total_invested.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("asset.type")}</p>
              <p className="text-xl font-bold capitalize mt-1">{holding.asset_type}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Live Price & Unrealized P&L */}
      {holding && holding.net_quantity > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("asset.currentPrice")}</p>
              {priceLoading ? (
                <Skeleton className="h-7 w-20 mt-1" />
              ) : currentPrice ? (
                <p className="text-xl font-bold font-mono mt-1">${currentPrice.toFixed(2)}</p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">—</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("asset.marketValue")}</p>
              {priceLoading ? (
                <Skeleton className="h-7 w-24 mt-1" />
              ) : marketValue !== null ? (
                <p className="text-xl font-bold font-mono mt-1">${marketValue.toFixed(2)}</p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">—</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("asset.unrealizedPnl")}</p>
              {priceLoading ? (
                <Skeleton className="h-7 w-24 mt-1" />
              ) : unrealizedPnl !== null ? (
                <p className={`text-xl font-bold font-mono mt-1 ${unrealizedPnl >= 0 ? "text-gain" : "text-loss"}`}>
                  {unrealizedPnl >= 0 ? "+" : ""}${unrealizedPnl.toFixed(2)}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">—</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("asset.unrealizedPct")}</p>
              {priceLoading ? (
                <Skeleton className="h-7 w-16 mt-1" />
              ) : unrealizedPct !== null ? (
                <p className={`text-xl font-bold font-mono mt-1 ${unrealizedPct >= 0 ? "text-gain" : "text-loss"}`}>
                  {unrealizedPct >= 0 ? "+" : ""}{unrealizedPct.toFixed(2)}%
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-1">—</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* P&L Cards */}
      {symbolPerf && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("asset.realizedPnl")}</p>
              <p className={`text-xl font-bold font-mono mt-1 ${symbolPerf.realized_pnl >= 0 ? "text-gain" : "text-loss"}`}>
                {symbolPerf.realized_pnl >= 0 ? "+" : ""}${symbolPerf.realized_pnl.toFixed(2)}
              </p>
            </CardContent>
          </Card>
          {symbolPerf.dividends_received > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("asset.dividends")}</p>
                <p className="text-xl font-bold font-mono mt-1 text-gain">
                  +${symbolPerf.dividends_received.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{t("asset.totalReturn")}</p>
              <p className={`text-xl font-bold font-mono mt-1 ${symbolPerf.total_return >= 0 ? "text-gain" : "text-loss"}`}>
                {symbolPerf.total_return >= 0 ? "+" : ""}${symbolPerf.total_return.toFixed(2)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("asset.tradeHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {assetTrades.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("board.date")}</TableHead>
                  <TableHead>{t("board.type")}</TableHead>
                  <TableHead className="text-right">{t("board.qty")}</TableHead>
                  <TableHead className="text-right">{t("board.price")}</TableHead>
                  <TableHead className="text-right">{t("board.total")}</TableHead>
                  <TableHead>{t("editTrade.notes")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetTrades.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => setEditTrade(t)}
                  >
                    <TableCell className="text-muted-foreground">{new Date(t.trade_date).toLocaleDateString()}</TableCell>
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
                    <TableCell className="text-muted-foreground text-sm">{t.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">{t("asset.noTrades")}</p>
          )}
        </CardContent>
      </Card>

      <EditTradeDialog trade={editTrade} open={!!editTrade} onOpenChange={(open) => !open && setEditTrade(null)} />
    </div>
  );
};

export default AssetDetail;
