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

const RANGE_DAYS: Record<Range, number | null> = {
  "1M": 30, "3M": 90, "6M": 180, "1Y": 365, ALL: null,
};

interface PriceChartProps {
  symbol: string;
  trades: Trade[];
}

export const PriceChart = ({ symbol, trades }: PriceChartProps) => {
  const { t } = useLanguage();
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState<Range>("1Y");

  const now = Math.floor(Date.now() / 1000);

  const fromTs = useMemo(() => {
    const days = RANGE_DAYS[range];
    if (!days) {
      const firstTrade = trades.length
        ? Math.min(...trades.map((t) => new Date(t.trade_date).getTime() / 1000))
        : now - 365 * 86400;
      return Math.floor(firstTrade) - 30 * 86400;
    }
    return now - days * 86400;
  }, [range, trades, now]);

  useEffect(() => {
    if (!symbol) return;
    setLoading(true);
    supabase.functions
      .invoke("stock-history", { body: { symbol, from: fromTs, to: now } })
      .then(({ data }) => {
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
      .catch(() => setCandles([]))
      .finally(() => setLoading(false));
  }, [symbol, fromTs, now]);

  // Map trades to chart points
  const tradeMarkers = useMemo(() => {
    if (!candles.length) return [];
    return trades
      .filter((t) => t.trade_type === "buy" || t.trade_type === "sell")
      .map((t) => {
        const tradeTs = Math.floor(new Date(t.trade_date).getTime() / 1000);
        // Find closest candle
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
                  tickFormatter={(v: number) => `$${v.toFixed(0)}`}
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
