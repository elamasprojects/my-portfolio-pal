import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Trade } from "@/hooks/usePortfolio";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceDot,
} from "recharts";

type Range = "1M" | "3M" | "6M" | "1Y" | "ALL";

interface TradeMarker {
  type: "buy" | "sell";
  quantity: number;
  price: number;
  total: number;
  date: string;
  id: string;
}

interface CandlePoint {
  time: number;
  close: number;
  date: string;
  tradeMarker?: TradeMarker;
}

interface PriceChartProps {
  symbol: string;
  trades: Trade[];
}

const formatPrice = (v: number): string => {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  if (v >= 1) return `$${v.toFixed(0)}`;
  if (v >= 0.01) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as CandlePoint | undefined;
  if (!point) return null;

  const marker = point.tradeMarker;

  if (marker) {
    const isBuy = marker.type === "buy";
    return (
      <div
        className={`rounded-lg border px-3 py-2 text-xs shadow-lg ${
          isBuy
            ? "bg-gain/10 border-gain/30 text-gain"
            : "bg-loss/10 border-loss/30 text-loss"
        }`}
      >
        <p className="font-bold text-sm mb-1">
          {isBuy ? "BUY" : "SELL"}
        </p>
        <p className="text-foreground/80">{point.date}</p>
        <p className="font-mono mt-1">
          {marker.quantity} × ${marker.price.toFixed(2)}
        </p>
        <p className="font-mono font-bold">
          Total: ${marker.total.toFixed(2)}
        </p>
      </div>
    );
  }

  return (
    <div
      className="rounded-lg border px-3 py-2 text-xs shadow-md"
      style={{
        backgroundColor: "hsl(var(--card))",
        borderColor: "hsl(var(--border))",
      }}
    >
      <p className="text-muted-foreground">{point.date}</p>
      <p className="font-mono font-bold text-foreground">
        ${point.close.toFixed(2)}
      </p>
    </div>
  );
};

export const PriceChart = ({ symbol, trades }: PriceChartProps) => {
  const { t } = useLanguage();
  const [rawCandles, setRawCandles] = useState<CandlePoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<Range>("1Y");

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    supabase.functions
      .invoke("stock-history", { body: { symbol, range } })
      .then(({ data }) => {
        if (cancelled) return;
        if (data?.candles?.length) {
          setRawCandles(
            data.candles.map((c: any) => ({
              time: c.time,
              close: c.close,
              date: new Date(c.time * 1000).toLocaleDateString(),
            }))
          );
        } else {
          setRawCandles([]);
        }
      })
      .catch(() => !cancelled && setRawCandles([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [symbol, range]);

  // Merge trade markers into candle data
  const { candles, tradeMarkers } = useMemo(() => {
    if (!rawCandles.length) return { candles: rawCandles, tradeMarkers: [] };

    const relevantTrades = trades.filter(
      (t) => t.trade_type === "buy" || t.trade_type === "sell"
    );

    const maxBuyQty = Math.max(
      ...relevantTrades.filter((t) => t.trade_type === "buy").map((t) => Number(t.quantity)),
      1
    );
    const maxSellQty = Math.max(
      ...relevantTrades.filter((t) => t.trade_type === "sell").map((t) => Number(t.quantity)),
      1
    );

    const markers: (TradeMarker & { closestIdx: number; radius: number })[] = [];
    const candlesCopy = rawCandles.map((c) => ({ ...c }));

    for (const trade of relevantTrades) {
      const tradeTs = Math.floor(new Date(trade.trade_date).getTime() / 1000);
      let closestIdx = 0;
      let minDiff = Math.abs(candlesCopy[0].time - tradeTs);
      for (let i = 1; i < candlesCopy.length; i++) {
        const diff = Math.abs(candlesCopy[i].time - tradeTs);
        if (diff < minDiff) {
          closestIdx = i;
          minDiff = diff;
        }
      }

      const qty = Number(trade.quantity);
      const maxQ = trade.trade_type === "buy" ? maxBuyQty : maxSellQty;
      const hasMult =
        relevantTrades.filter((t) => t.trade_type === trade.trade_type).length > 1;
      const radius = hasMult ? 4 + (qty / maxQ) * 6 : 6;

      const marker: TradeMarker = {
        type: trade.trade_type as "buy" | "sell",
        quantity: qty,
        price: Number(trade.price_per_unit),
        total: Number(trade.total_amount),
        date: new Date(trade.trade_date).toLocaleDateString(),
        id: trade.id,
      };

      // Embed marker into the candle point for tooltip detection
      candlesCopy[closestIdx] = {
        ...candlesCopy[closestIdx],
        tradeMarker: marker,
      };

      markers.push({ ...marker, closestIdx, radius });
    }

    return { candles: candlesCopy, tradeMarkers: markers };
  }, [rawCandles, trades]);

  const ranges: Range[] = ["1M", "3M", "6M", "1Y", "ALL"];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{t("asset.priceHistory")}</CardTitle>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <Button
              key={r}
              variant={range === r ? "default" : "ghost"}
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={() => setRange(r)}
            >
              {r}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-[250px] w-full" />
        ) : candles.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-12">
            {t("asset.noChartData")}
          </p>
        ) : (
          <div className="h-[280px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={candles} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={40}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  width={55}
                  tickFormatter={formatPrice}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="hsl(var(--primary))"
                  fill="url(#priceGradient)"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                />
                {tradeMarkers.map((m) => (
                  <ReferenceDot
                    key={m.id}
                    x={candles[m.closestIdx]?.date}
                    y={m.price}
                    r={m.radius}
                    fill={m.type === "buy" ? "hsl(var(--gain))" : "hsl(var(--loss))"}
                    stroke="hsl(var(--background))"
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
            <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-gain" /> {t("board.type") === "Type" ? "Buy" : "Compra"}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-3 h-3 rounded-full bg-loss" /> {t("board.type") === "Type" ? "Sell" : "Venta"}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
