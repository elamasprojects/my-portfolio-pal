import { useState, useMemo } from "react";
import { useLanguage } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AffiliateButton } from "@/components/AffiliateButton";
import { TrendingUp } from "lucide-react";
import { SEOHead } from "@/components/SEOHead";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";

const PRESETS = [
  { key: "conservative", rate: 5 },
  { key: "sp500", rate: 10 },
  { key: "btc", rate: 50 },
];

export default function CompoundCalculator() {
  const { t } = useLanguage();
  const [initial, setInitial] = useState(1000);
  const [monthly, setMonthly] = useState(100);
  const [years, setYears] = useState(10);
  const [rate, setRate] = useState(10);

  const data = useMemo(() => {
    const monthlyRate = rate / 100 / 12;
    const points = [];
    let balance = initial;
    let invested = initial;

    points.push({ year: 0, balance: Math.round(balance), invested });

    for (let y = 1; y <= years; y++) {
      for (let m = 0; m < 12; m++) {
        balance = balance * (1 + monthlyRate) + monthly;
        invested += monthly;
      }
      points.push({ year: y, balance: Math.round(balance), invested });
    }
    return points;
  }, [initial, monthly, years, rate]);

  const finalBalance = data[data.length - 1]?.balance ?? 0;
  const totalInvested = data[data.length - 1]?.invested ?? 0;
  const totalGain = finalBalance - totalInvested;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <div className="py-8 px-4 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h1 className="font-serif text-2xl md:text-3xl font-bold">
          {t("tools.compound.title" as any)}
        </h1>
      </div>
      <p className="text-muted-foreground text-sm">
        {t("tools.compound.subtitle" as any)}
      </p>

      {/* Inputs */}
      <Card>
        <CardContent className="p-6 grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>{t("tools.compound.initial" as any)}</Label>
            <Input
              type="number"
              min={0}
              value={initial}
              onChange={(e) => setInitial(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("tools.compound.monthly" as any)}</Label>
            <Input
              type="number"
              min={0}
              value={monthly}
              onChange={(e) => setMonthly(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("tools.compound.years" as any)}</Label>
            <Input
              type="number"
              min={1}
              max={50}
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("tools.compound.rate" as any)}</Label>
            <Input
              type="number"
              min={0}
              step={0.5}
              value={rate}
              onChange={(e) => setRate(Number(e.target.value))}
            />
          </div>

          <div className="col-span-2 flex flex-wrap gap-2">
            {PRESETS.map(({ key, rate: r }) => (
              <Button
                key={key}
                variant={rate === r ? "default" : "outline"}
                size="sm"
                onClick={() => setRate(r)}
              >
                {t(`tools.compound.preset.${key}` as any)} ({r}%)
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("tools.compound.projection" as any)}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="year"
                  tickFormatter={(v) => `${v}y`}
                  className="text-xs"
                />
                <YAxis
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  className="text-xs"
                />
                <Tooltip
                  formatter={(v: number) => fmt(v)}
                  labelFormatter={(l) => `${t("tools.compound.yearLabel" as any)} ${l}`}
                />
                <Area
                  type="monotone"
                  dataKey="invested"
                  stroke="hsl(var(--chart-3))"
                  fill="hsl(var(--chart-3) / 0.1)"
                  name={t("tools.compound.invested" as any)}
                />
                <Area
                  type="monotone"
                  dataKey="balance"
                  stroke="hsl(var(--chart-2))"
                  fill="hsl(var(--chart-2) / 0.1)"
                  name={t("tools.compound.finalValue" as any)}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("tools.compound.invested" as any)}</p>
            <p className="text-lg font-bold font-mono">{fmt(totalInvested)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("tools.compound.finalValue" as any)}</p>
            <p className="text-lg font-bold font-mono text-gain">{fmt(finalBalance)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground">{t("tools.compound.gain" as any)}</p>
            <p className="text-lg font-bold font-mono text-gain">{fmt(totalGain)}</p>
          </CardContent>
        </Card>
      </div>

      {/* CTA */}
      <div className="text-center space-y-3 pt-4">
        <AffiliateButton
          platform="bingx"
          campaign="compound"
          label={t("tools.compound.cta" as any)}
        />
      </div>
    </div>
  );
}
