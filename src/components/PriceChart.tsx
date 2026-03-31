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

type Candle = { time: number; close: number; date: string };
type Range = "1M" | "3M" | "6M" | "1Y" | "ALL";

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

export const PriceChart = ({ symbol, trades }: PriceChartProps) => {
  const { t } = useLanguage();
  const [candles, setCandles] = useState<Candle[]>([]);
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
          setCandles(
            data.candles.map((c: any) => ({
              time: c.time,
              close: c.close,
              date: new Date(c.time * 1000).toLocaleDateString(),
            }))
          );
        } else {
          setCandles([]);
        }
      })
      .catch(() => !cancelled && setCandles([]))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [symbol, range]);

  // Map trades to chart points
  const tradeMarkers = useMemo(() => {
    if (!candles.length) return [];
    return trades
      .filter((t) => t.trade_type === "buy" || t.trade_type === "sell")
      .map((t) => {
        const tradeTs = Math.floor(new Date(t.trade_date).getTime() / 1000);
        let closest = candles[0];
        let minDiff = Math.abs(candles[0].time - tradeTs);
        for (const c of candles) {
          const diff = Math.abs(c.time - tradeTs);
          if (diff < minDiff) {
            closest = c;
            minDiff = diff;
          }
        }
        return {
          date: closest.date,
          price: Number(t.price_per_unit),
          type: t.trade_type as "buy" | "sell",
          id: t.id,
        };
      });
  }, [candles, trades]);

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
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, "Price"]}
                />
                <Area
                  type="monotone"
                  dataKey="close"
                  stroke="hsl(var(--primary))"
                  fill="url(#priceGradient)"
                  strokeWidth={2}
                  dot={false}
                />
                {tradeMarkers.map((m) => (
                  <ReferenceDot
                    key={m.id}
                    x={m.date}
                    y={m.price}
                    r={6}
                    fill={m.type === "buy" ? "hsl(var(--gain))" : "hsl(var(--loss))"}
                    stroke={m.type === "buy" ? "hsl(var(--gain))" : "hsl(var(--loss))"}
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
