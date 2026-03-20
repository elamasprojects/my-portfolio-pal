import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AffiliateButton } from "@/components/AffiliateButton";
import { DollarSign, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { format, subYears, differenceInDays, addDays, addWeeks, addMonths } from "date-fns";

type Frequency = "daily" | "weekly" | "monthly";

export default function DCASimulator() {
  const { t } = useLanguage();
  const [amount, setAmount] = useState(10);
  const [frequency, setFrequency] = useState<Frequency>("weekly");
  const [startDate, setStartDate] = useState(
    format(subYears(new Date(), 3), "yyyy-MM-dd")
  );
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: prices, isLoading, error } = useQuery({
    queryKey: ["dca-history", startDate, endDate],
    queryFn: async () => {
      const from = Math.floor(new Date(startDate).getTime() / 1000);
      const to = Math.floor(new Date(endDate).getTime() / 1000);
      const { data, error } = await supabase.functions.invoke("dca-history", {
        body: { coinId: "bitcoin", from, to },
      });
      if (error) throw error;
      return data.prices as [number, number][];
    },
    staleTime: 1000 * 60 * 30,
  });

  const simulation = useMemo(() => {
    if (!prices || prices.length === 0) return null;

    const priceMap = new Map<string, number>();
    for (const [ts, price] of prices) {
      priceMap.set(format(new Date(ts), "yyyy-MM-dd"), price);
    }

    const getNextDate = (d: Date, freq: Frequency) => {
      if (freq === "daily") return addDays(d, 1);
      if (freq === "weekly") return addWeeks(d, 1);
      return addMonths(d, 1);
    };

    const getClosestPrice = (dateStr: string): number | null => {
      if (priceMap.has(dateStr)) return priceMap.get(dateStr)!;
      const d = new Date(dateStr);
      for (let i = 1; i <= 3; i++) {
        const prev = format(addDays(d, -i), "yyyy-MM-dd");
        if (priceMap.has(prev)) return priceMap.get(prev)!;
        const next = format(addDays(d, i), "yyyy-MM-dd");
        if (priceMap.has(next)) return priceMap.get(next)!;
      }
      return null;
    };

    let totalInvested = 0;
    let totalUnits = 0;
    const chartData: { date: string; invested: number; value: number }[] = [];

    let current = new Date(startDate);
    const end = new Date(endDate);

    while (current <= end) {
      const dateStr = format(current, "yyyy-MM-dd");
      const price = getClosestPrice(dateStr);

      if (price) {
        totalInvested += amount;
        totalUnits += amount / price;
        chartData.push({
          date: dateStr,
          invested: Math.round(totalInvested),
          value: Math.round(totalUnits * price),
        });
      }

      current = getNextDate(current, frequency);
    }

    // Update final value with last known price
    const lastPrice = prices[prices.length - 1]?.[1] ?? 0;
    const finalValue = Math.round(totalUnits * lastPrice);

    return {
      chartData,
      totalInvested: Math.round(totalInvested),
      finalValue,
      gain: finalValue - Math.round(totalInvested),
      gainPct: totalInvested > 0 ? ((finalValue / totalInvested - 1) * 100).toFixed(1) : "0",
    };
  }, [prices, amount, frequency, startDate, endDate]);

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="py-8 px-4 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <DollarSign className="h-6 w-6 text-primary" />
        <h1 className="font-serif text-2xl md:text-3xl font-bold">
          {t("tools.dca.title" as any)}
        </h1>
      </div>
      <p className="text-muted-foreground text-sm">
        {t("tools.dca.subtitle" as any)}
      </p>

      {/* Inputs */}
      <Card>
        <CardContent className="p-6 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("tools.dca.amount" as any)}</Label>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("tools.dca.frequency" as any)}</Label>
            <div className="flex gap-1">
              {(["daily", "weekly", "monthly"] as Frequency[]).map((f) => (
                <Button
                  key={f}
                  variant={frequency === f ? "default" : "outline"}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setFrequency(f)}
                >
                  {t(`tools.dca.freq.${f}` as any)}
                </Button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("tools.dca.startDate" as any)}</Label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("tools.dca.endDate" as any)}</Label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="p-6 text-center text-destructive">
            {t("tools.dca.error" as any)}
          </CardContent>
        </Card>
      )}

      {simulation && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {t("tools.dca.chartTitle" as any)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={simulation.chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => {
                        const d = new Date(v);
                        return `${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
                      }}
                      className="text-xs"
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                      className="text-xs"
                    />
                    <Tooltip formatter={(v: number) => fmt(v)} />
                    <Area
                      type="monotone"
                      dataKey="invested"
                      stroke="hsl(var(--chart-3))"
                      fill="hsl(var(--chart-3) / 0.1)"
                      name={t("tools.dca.invested" as any)}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--chart-2))"
                      fill="hsl(var(--chart-2) / 0.1)"
                      name={t("tools.dca.marketValue" as any)}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{t("tools.dca.invested" as any)}</p>
                <p className="text-lg font-bold font-mono">{fmt(simulation.totalInvested)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{t("tools.dca.currentValue" as any)}</p>
                <p className="text-lg font-bold font-mono text-gain">{fmt(simulation.finalValue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{t("tools.dca.gain" as any)}</p>
                <p className={`text-lg font-bold font-mono ${simulation.gain >= 0 ? "text-gain" : "text-loss"}`}>
                  {fmt(simulation.gain)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{t("tools.dca.returnPct" as any)}</p>
                <p className={`text-lg font-bold font-mono ${simulation.gain >= 0 ? "text-gain" : "text-loss"}`}>
                  {simulation.gainPct}%
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CTA */}
          <div className="text-center space-y-3 pt-4">
            <AffiliateButton
              platform="bingx"
              campaign="dca"
              label={t("tools.dca.cta" as any)}
            />
          </div>
        </>
      )}
    </div>
  );
}
