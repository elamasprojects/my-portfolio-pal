import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChessBadge } from "@/components/ui/ChessBadge";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n";
import confetti from "canvas-confetti";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Clock,
  Award,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceDot,
  ReferenceLine,
} from "recharts";

export interface ClosedPositionSummary {
  symbol: string;
  asset_name: string;
  quantity: number;
  avgBuyPrice: number;
  sellPrice: number;
  returnPct: number;
  returnPnl: number;
  holdDays: number;
  annualizedReturnPct: number;
  buyDate: string;
  sellDate: string;
  isTopTradeOfMonth?: boolean;
  isWinStreak?: boolean;
  winStreakCount?: number;
}

interface ClosedPositionSummaryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: ClosedPositionSummary | null;
  currencySymbol?: string;
}

interface CandlePoint {
  dateStr: string;
  close: number;
  timestamp: number;
}

export function ClosedPositionSummaryDialog({
  open,
  onOpenChange,
  summary,
  currencySymbol = "$",
}: ClosedPositionSummaryDialogProps) {
  const { t } = useLanguage();
  const [chartData, setChartData] = useState<CandlePoint[]>([]);
  const [chartLoading, setChartLoading] = useState<boolean>(false);

  useEffect(() => {
    if (!open || !summary) return;

    // Trigger celebratory confetti on profit
    if (summary.returnPct > 0) {
      try {
        confetti({
          particleCount: 90,
          spread: 70,
          origin: { y: 0.55 },
          colors: ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6"],
        });
      } catch {
        /* ignore confetti errors */
      }
    }

    // Fetch stock history for mini chart
    let isMounted = true;
    setChartLoading(true);

    supabase.functions
      .invoke("stock-history", {
        body: { symbol: summary.symbol, range: "1Y" },
      })
      .then(({ data }) => {
        if (!isMounted) return;
        if (data?.candles?.length) {
          const points: CandlePoint[] = data.candles.map((c: any) => ({
            timestamp: c.time * 1000,
            close: c.close,
            dateStr: new Date(c.time * 1000).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            }),
          }));
          setChartData(points);
        } else {
          setChartData(generateFallbackChart(summary));
        }
      })
      .catch(() => {
        if (isMounted) setChartData(generateFallbackChart(summary));
      })
      .finally(() => {
        if (isMounted) setChartLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [open, summary]);

  if (!summary) return null;

  const isGain = summary.returnPct >= 0;
  const gainLossColor = isGain ? "text-gain" : "text-loss";
  const gainLossBg = isGain ? "bg-gain/10 border-gain/30" : "bg-loss/10 border-loss/30";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] p-6 rounded-2xl overflow-hidden">
        <DialogHeader className="space-y-1 text-center pb-2 border-b">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-1 text-primary">
            {isGain ? <Sparkles className="h-6 w-6 text-gain" /> : <TrendingDown className="h-6 w-6 text-loss" />}
          </div>
          <DialogTitle className="text-xl font-bold font-mono">
            {t("closedCard.title")}: {summary.symbol}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{summary.asset_name}</p>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Main Profit / Loss Banner */}
          <div
            className={`rounded-2xl p-4 text-center border ${gainLossBg} transition-all shadow-sm`}
          >
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">
              {isGain ? t("closedCard.profit") : t("closedCard.loss")} Total
            </p>
            <div className="flex items-center justify-center gap-2 mt-1">
              {isGain ? (
                <TrendingUp className="h-7 w-7 text-gain" />
              ) : (
                <TrendingDown className="h-7 w-7 text-loss" />
              )}
              <span className={`text-3xl font-extrabold font-mono ${gainLossColor}`}>
                {isGain ? "+" : ""}
                {summary.returnPct.toFixed(2)}%
              </span>
            </div>
            <p className={`text-sm font-mono font-semibold mt-1 opacity-90 ${gainLossColor}`}>
              {isGain ? "+" : ""}
              {currencySymbol}
              {Math.abs(summary.returnPnl).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </p>
          </div>

          {/* Chess.com Move Evaluation Badge */}
          <div className="flex justify-center">
            <ChessBadge
              evaluation={
                summary.returnPct >= 20
                  ? "brillante"
                  : summary.returnPct > 0
                  ? "correcta"
                  : summary.returnPct > -10
                  ? "imprecision"
                  : "blunder"
              }
              size="md"
            />
          </div>

          {/* Achievement Badges */}
          <div className="flex flex-wrap gap-2 justify-center">
            {summary.isTopTradeOfMonth && (
              <Badge className="bg-amber-500/15 text-amber-500 border-amber-500/30 gap-1 px-3 py-1 text-xs">
                <Award className="h-3.5 w-3.5" />
                {t("closedCard.topTradeMonth")}
              </Badge>
            )}
            {summary.isWinStreak && (
              <Badge className="bg-orange-500/15 text-orange-500 border-orange-500/30 gap-1 px-3 py-1 text-xs">
                <Zap className="h-3.5 w-3.5" />
                {t("closedCard.winStreak")} ({summary.winStreakCount}x)
              </Badge>
            )}
            {summary.returnPct >= 20 && (
              <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1 px-3 py-1 text-xs">
                <Sparkles className="h-3.5 w-3.5" />
                🚀 Operación Estelar (+20%)
              </Badge>
            )}
          </div>

          {/* Metrics Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-xl border bg-card p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span>{t("closedCard.holdDuration")}</span>
              </div>
              <p className="text-base font-bold font-mono text-foreground">
                {summary.holdDays} {t("closedCard.days")}
              </p>
            </div>

            <div className="rounded-xl border bg-card p-3 space-y-1">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                <span>{t("closedCard.annualized")}</span>
              </div>
              <p className={`text-base font-bold font-mono ${gainLossColor}`}>
                {summary.annualizedReturnPct >= 0 ? "+" : ""}
                {summary.annualizedReturnPct.toFixed(1)}% p.a.
              </p>
            </div>

            <div className="rounded-xl border bg-card p-3 space-y-1">
              <span className="text-[11px] text-muted-foreground">{t("closedCard.buyPrice")}</span>
              <p className="text-sm font-bold font-mono text-foreground">
                {currencySymbol}
                {summary.avgBuyPrice.toFixed(2)}
              </p>
            </div>

            <div className="rounded-xl border bg-card p-3 space-y-1">
              <span className="text-[11px] text-muted-foreground">{t("closedCard.sellPrice")}</span>
              <p className="text-sm font-bold font-mono text-foreground">
                {currencySymbol}
                {summary.sellPrice.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Mini Stock History Chart with Buy & Sell Points */}
          <div className="rounded-xl border bg-card p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Trayectoria & Puntos de Operación</span>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1 text-emerald-500 font-medium">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Compra
                </span>
                <span className="flex items-center gap-1 text-rose-500 font-medium">
                  <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" /> Venta
                </span>
              </div>
            </div>

            <div className="h-36 w-full pt-2">
              {chartLoading ? (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Cargando gráfico...
                </div>
              ) : chartData.length > 0 ? (
                (() => {
                  // Match Buy & Sell timestamps to closest candles in chartData (matching PriceChart.tsx)
                  const buyTs = new Date(summary.buyDate).getTime();
                  const sellTs = new Date(summary.sellDate).getTime();

                  let buyIdx = 0;
                  let buyMinDiff = Math.abs(chartData[0].timestamp - buyTs);

                  let sellIdx = chartData.length - 1;
                  let sellMinDiff = Math.abs(chartData[chartData.length - 1].timestamp - sellTs);

                  for (let i = 0; i < chartData.length; i++) {
                    const bDiff = Math.abs(chartData[i].timestamp - buyTs);
                    if (bDiff < buyMinDiff) {
                      buyMinDiff = bDiff;
                      buyIdx = i;
                    }
                    const sDiff = Math.abs(chartData[i].timestamp - sellTs);
                    if (sDiff < sellMinDiff) {
                      sellMinDiff = sDiff;
                      sellIdx = i;
                    }
                  }

                  const buyDotX = chartData[buyIdx]?.dateStr;
                  const sellDotX = chartData[sellIdx]?.dateStr;

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="closedGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="5%"
                              stopColor={isGain ? "hsl(var(--gain))" : "hsl(var(--loss))"}
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="95%"
                              stopColor={isGain ? "hsl(var(--gain))" : "hsl(var(--loss))"}
                              stopOpacity={0.0}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="dateStr" hide />
                        <YAxis hide domain={["auto", "auto"]} />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const p = payload[0].payload;
                              return (
                                <div className="bg-popover text-popover-foreground text-xs p-2 rounded-lg border shadow-md font-mono">
                                  <p>{p.dateStr}</p>
                                  <p className="font-bold">
                                    {currencySymbol}
                                    {p.close.toFixed(2)}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <ReferenceLine
                          y={summary.avgBuyPrice}
                          stroke="hsl(var(--gain))"
                          strokeDasharray="3 3"
                          strokeWidth={1.5}
                        />
                        <ReferenceLine
                          y={summary.sellPrice}
                          stroke="hsl(var(--loss))"
                          strokeDasharray="3 3"
                          strokeWidth={1.5}
                        />
                        <Area
                          type="monotone"
                          dataKey="close"
                          stroke={isGain ? "hsl(var(--gain))" : "hsl(var(--loss))"}
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#closedGradient)"
                        />
                        {/* Validated ReferenceDots matching PriceChart.tsx */}
                        {buyDotX && (
                          <ReferenceDot
                            x={buyDotX}
                            y={summary.avgBuyPrice}
                            r={6}
                            fill="hsl(var(--gain))"
                            stroke="hsl(var(--background))"
                            strokeWidth={2}
                          />
                        )}
                        {sellDotX && (
                          <ReferenceDot
                            x={sellDotX}
                            y={summary.sellPrice}
                            r={6}
                            fill="hsl(var(--loss))"
                            stroke="hsl(var(--background))"
                            strokeWidth={2}
                          />
                        )}
                      </AreaChart>
                    </ResponsiveContainer>
                  );
                })()
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                  Sin datos históricos suficientes
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2 border-t">
          <Button
            type="button"
            className="w-full font-semibold"
            onClick={() => onOpenChange(false)}
          >
            {t("closedCard.closeBtn")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Fallback chart if stock-history API is unavailable
function generateFallbackChart(summary: ClosedPositionSummary): CandlePoint[] {
  const points: CandlePoint[] = [];
  const totalSteps = 10;
  const startPrice = summary.avgBuyPrice;
  const endPrice = summary.sellPrice;
  const buyTs = new Date(summary.buyDate).getTime();
  const sellTs = new Date(summary.sellDate).getTime();
  const timeDiff = Math.max(86400000, sellTs - buyTs);

  for (let i = 0; i <= totalSteps; i++) {
    const ratio = i / totalSteps;
    const price = startPrice + (endPrice - startPrice) * ratio;
    const timestamp = buyTs + timeDiff * ratio;
    points.push({
      dateStr: new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      close: Number(price.toFixed(2)),
      timestamp,
    });
  }

  return points;
}
