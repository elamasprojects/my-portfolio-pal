import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTrades, computeHoldings, computePerformance, Trade } from "@/hooks/usePortfolio";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { PriceChart } from "@/components/PriceChart";
import { EditTradeDialog } from "@/components/EditTradeDialog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, TrendingUp, DollarSign, Target, Award, Calendar, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function AssetDetail() {
  const { symbol = "" } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { data: allTrades = [], isLoading: tradesLoading } = useTrades();
  const { venta: mepRate = 1200 } = useDolarMEP();

  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);

  // Filter trades for this symbol
  const assetTrades = useMemo(() => {
    return allTrades.filter(
      (t) => t.symbol?.toUpperCase() === symbol.toUpperCase()
    );
  }, [allTrades, symbol]);

  // Performance & Holdings for this asset
  const holdings = useMemo(() => computeHoldings(assetTrades), [assetTrades]);
  const holding = holdings[0] || null;
  const perf = useMemo(() => computePerformance(assetTrades), [assetTrades]);
  const symbolPerf = perf.by_symbol[0] || null;

  // Asset full name
  const assetName = assetTrades[0]?.asset_name || symbol;

  // Live price lookup
  useEffect(() => {
    if (!symbol) return;
    setPriceLoading(true);
    supabase.functions
      .invoke("fetch-quote", { body: { symbol: symbol.toUpperCase() } })
      .then(({ data }) => {
        if (data?.price && data.price > 0) {
          setCurrentPrice(data.price);
        }
      })
      .catch((err) => console.warn("Failed to fetch quote:", err))
      .finally(() => setPriceLoading(false));
  }, [symbol]);

  const effectivePrice = currentPrice || holding?.avg_cost || 0;
  const effectiveCcl = mepRate > 0 ? mepRate : 1200;

  // Unrealized P&L
  const unrealizedPnlUSD =
    holding && holding.net_quantity > 0 && currentPrice
      ? (currentPrice - holding.avg_cost) * holding.net_quantity
      : null;
  const unrealizedPct =
    holding && holding.avg_cost > 0 && currentPrice
      ? ((currentPrice - holding.avg_cost) / holding.avg_cost) * 100
      : null;
  const marketValueUSD =
    holding && holding.net_quantity > 0
      ? effectivePrice * holding.net_quantity
      : null;

  const realizedPnlUSD = symbolPerf?.realized_pnl || 0;
  const totalReturnUSD = symbolPerf?.total_return || 0;
  const dividendsUSD = symbolPerf?.dividends_received || 0;

  if (tradesLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-pulse text-muted-foreground">Cargando datos del activo...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 max-w-6xl mx-auto">
      {/* 1. HEADER ROW */}
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-10 w-10">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-black font-mono tracking-tight text-foreground">{symbol}</h1>
              {holding && (
                <Badge variant="outline" className="text-xs font-mono uppercase bg-primary/10 text-primary border-primary/20">
                  {holding.asset_type || "CEDEAR"}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground font-medium">{assetName}</p>
          </div>
        </div>

        {/* Live Price in Header */}
        <div className="text-right font-mono">
          <span className="text-xs text-muted-foreground uppercase tracking-wider block font-sans font-semibold">
            Cotización Actual
          </span>
          {priceLoading ? (
            <Skeleton className="h-7 w-24 ml-auto mt-1" />
          ) : (
            <div className="text-2xl font-black text-foreground">
              US$ {effectivePrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          )}
          <span className="text-xs text-muted-foreground block">
            ≈ ${(effectivePrice * effectiveCcl).toLocaleString("es-AR", { maximumFractionDigits: 0 })} ARS
          </span>
        </div>
      </div>

      {/* 2. HOLDING STATUS & LIVE METRICS (If currently open) */}
      {holding && holding.net_quantity > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-card border-border/70">
            <CardContent className="p-4">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                Posición Abierta
              </span>
              <p className="text-xl font-bold font-mono text-foreground mt-1">
                {holding.net_quantity.toLocaleString("en-US", { maximumFractionDigits: 4 })} u.
              </p>
              <span className="text-[10px] text-muted-foreground block font-mono">
                Costo Prom: US$ {holding.avg_cost.toFixed(2)}
              </span>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/70">
            <CardContent className="p-4">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                Valuación de Mercado
              </span>
              <p className="text-xl font-bold font-mono text-foreground mt-1">
                US$ {marketValueUSD ? marketValueUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}
              </p>
              <span className="text-[10px] text-muted-foreground block font-mono">
                Cost Basis: US$ {holding.total_invested.toFixed(2)}
              </span>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/70">
            <CardContent className="p-4">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                P&L Latente (No Realizado)
              </span>
              <p className={`text-xl font-bold font-mono mt-1 ${unrealizedPnlUSD && unrealizedPnlUSD >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {unrealizedPnlUSD !== null
                  ? `${unrealizedPnlUSD >= 0 ? "+" : ""}US$ ${unrealizedPnlUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                  : "—"}
              </p>
              <span className="text-[10px] text-muted-foreground block font-mono">
                {unrealizedPct !== null ? `${unrealizedPct >= 0 ? "+" : ""}${unrealizedPct.toFixed(1)}%` : "—"}
              </span>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/70">
            <CardContent className="p-4">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                Retorno Total Histórico
              </span>
              <p className={`text-xl font-bold font-mono mt-1 ${totalReturnUSD >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {totalReturnUSD >= 0 ? "+" : ""}US$ {totalReturnUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-muted-foreground block font-mono">
                Realizado: US$ {realizedPnlUSD.toFixed(2)}
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 3. HISTORICAL PERFORMANCE CARDS (If closed or multi-trade) */}
      {symbolPerf && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="bg-card border-border/70">
            <CardContent className="p-4">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                P&L Realizado Cerrado
              </span>
              <p className={`text-lg font-bold font-mono mt-1 ${realizedPnlUSD >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                {realizedPnlUSD >= 0 ? "+" : ""}US$ {realizedPnlUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/70">
            <CardContent className="p-4">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                Dividendos Cobrados
              </span>
              <p className="text-lg font-bold font-mono text-emerald-400 mt-1">
                +US$ {dividendsUSD.toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/70">
            <CardContent className="p-4">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                Win Rate en {symbol}
              </span>
              <p className="text-lg font-bold font-mono text-foreground mt-1">
                {symbolPerf.win_rate.toFixed(0)}%
              </p>
              <span className="text-[10px] text-muted-foreground block font-mono">
                {symbolPerf.winning_sells} de {symbolPerf.total_sells} ventas exitosas
              </span>
            </CardContent>
          </Card>

          <Card className="bg-card border-border/70">
            <CardContent className="p-4">
              <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground block">
                Total Operaciones
              </span>
              <p className="text-lg font-bold font-mono text-foreground mt-1">
                {assetTrades.length} trades
              </p>
              <span className="text-[10px] text-muted-foreground block font-mono">
                Compras, ventas y dividendos
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 4. PRICE CHART WITH BUY / SELL ANNOTATION DOTS */}
      <PriceChart symbol={symbol} trades={assetTrades} />

      {/* 5. HISTORICAL TRADE LOG FOR THIS ASSET */}
      <Card className="bg-card border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            Historial de Operaciones en {symbol} ({assetTrades.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Registro cronológico de compras, ventas y dividendos ejecutados.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assetTrades.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">No se registran operaciones en este activo.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent text-xs">
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead className="text-right">Precio Unitario</TableHead>
                  <TableHead className="text-right">Monto Total</TableHead>
                  <TableHead>Tesis / Notas</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetTrades.map((t) => {
                  const isBuy = t.trade_type === "buy";
                  const isSell = t.trade_type === "sell";
                  const isDiv = t.trade_type === "dividend";

                  return (
                    <TableRow
                      key={t.id}
                      className="cursor-pointer hover:bg-muted/40 text-xs"
                      onClick={() => setEditTrade(t)}
                    >
                      <TableCell className="font-mono text-muted-foreground whitespace-nowrap">
                        {new Date(t.trade_date || t.created_at).toLocaleDateString("es-AR")}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono uppercase font-bold ${
                            isBuy
                              ? "bg-gain/10 text-gain border-gain/30"
                              : isSell
                              ? "bg-loss/10 text-loss border-loss/30"
                              : "bg-primary/10 text-primary border-primary/30"
                          }`}
                        >
                          {t.trade_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {isDiv ? "—" : Number(t.quantity).toLocaleString("en-US", { maximumFractionDigits: 4 })}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {isDiv ? "—" : `US$ ${Number(t.price_per_unit).toFixed(2)}`}
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold">
                        US$ {Number(t.total_amount || t.price_per_unit * t.quantity).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs truncate max-w-[200px]">
                        {t.entry_thesis || t.notes || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Edit Trade Modal */}
      <EditTradeDialog trade={editTrade} open={!!editTrade} onOpenChange={(open) => !open && setEditTrade(null)} />
    </div>
  );
}
