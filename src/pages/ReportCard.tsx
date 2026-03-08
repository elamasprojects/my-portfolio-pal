import { useState, useMemo, useRef, useCallback } from "react";
import { useTrades, Trade, computePerformance } from "@/hooks/usePortfolio";
import { useActivePortfolio } from "@/hooks/usePortfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, Download, TrendingUp, TrendingDown, BarChart3, Star, Award, Coins } from "lucide-react";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, isWithinInterval } from "date-fns";
import html2canvas from "html2canvas";
import { useLanguage } from "@/i18n";
import { format, parseISO, startOfMonth, endOfMonth, subMonths, isWithinInterval } from "date-fns";
import html2canvas from "html2canvas";

interface MonthStats {
  month: string;
  label: string;
  totalTrades: number;
  buys: number;
  sells: number;
  dividends: number;
  netRealizedPnL: number;
  dividendIncome: number;
  winRate: number;
  winningSells: number;
  totalSells: number;
  bestTrade: { symbol: string; pnl: number } | null;
  worstTrade: { symbol: string; pnl: number } | null;
  mostTradedAsset: string;
  grade: string;
  gradeColor: string;
}

function computeMonthStats(allTrades: Trade[], monthKey: string): MonthStats {
  const [year, month] = monthKey.split("-").map(Number);
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);

  const monthTrades = allTrades.filter((t) => {
    const d = parseISO(t.trade_date);
    return isWithinInterval(d, { start, end });
  });

  const sorted = [...allTrades]
    .filter((t) => parseISO(t.trade_date) <= end)
    .sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());

  // Build positions up to end of month for avg cost
  const positions = new Map<string, { qty: number; avgCost: number }>();
  const sellPnLs: { symbol: string; pnl: number }[] = [];

  for (const t of sorted) {
    const pos = positions.get(t.symbol) || { qty: 0, avgCost: 0 };
    const inMonth = isWithinInterval(parseISO(t.trade_date), { start, end });

    if (t.trade_type === "buy") {
      const totalCost = pos.avgCost * pos.qty + t.price_per_unit * t.quantity;
      pos.qty += t.quantity;
      pos.avgCost = pos.qty > 0 ? totalCost / pos.qty : 0;
    } else if (t.trade_type === "sell") {
      const pnl = (t.price_per_unit - pos.avgCost) * t.quantity;
      if (inMonth) sellPnLs.push({ symbol: t.symbol, pnl });
      pos.qty -= t.quantity;
      if (pos.qty <= 0) { pos.qty = 0; pos.avgCost = 0; }
    }
    positions.set(t.symbol, pos);
  }

  const buys = monthTrades.filter((t) => t.trade_type === "buy").length;
  const sells = monthTrades.filter((t) => t.trade_type === "sell").length;
  const dividendTrades = monthTrades.filter((t) => t.trade_type === "dividend");
  const dividendIncome = dividendTrades.reduce((s, t) => s + (t.total_amount || t.price_per_unit * t.quantity), 0);

  const netRealizedPnL = sellPnLs.reduce((s, x) => s + x.pnl, 0);
  const winningSells = sellPnLs.filter((x) => x.pnl > 0).length;
  const totalSells = sellPnLs.length;
  const winRate = totalSells > 0 ? (winningSells / totalSells) * 100 : 0;

  const best = sellPnLs.length > 0 ? sellPnLs.reduce((a, b) => (b.pnl > a.pnl ? b : a)) : null;
  const worst = sellPnLs.length > 0 ? sellPnLs.reduce((a, b) => (b.pnl < a.pnl ? b : a)) : null;

  // Most traded asset
  const assetCounts = new Map<string, number>();
  for (const t of monthTrades) {
    assetCounts.set(t.symbol, (assetCounts.get(t.symbol) || 0) + 1);
  }
  const mostTradedAsset = assetCounts.size > 0
    ? Array.from(assetCounts.entries()).sort((a, b) => b[1] - a[1])[0][0]
    : "—";

  // Grade
  let grade: string;
  let gradeColor: string;
  if (totalSells === 0) {
    grade = "C";
    gradeColor = "hsl(var(--muted-foreground))";
  } else if (netRealizedPnL > 0 && winRate > 80 && monthTrades.length >= 10) {
    grade = "A+";
    gradeColor = "hsl(var(--gain))";
  } else if (netRealizedPnL > 0 && winRate > 60) {
    grade = "A";
    gradeColor = "hsl(var(--gain))";
  } else if (netRealizedPnL > 0) {
    grade = "B";
    gradeColor = "hsl(174 62% 50%)";
  } else if (netRealizedPnL < 0 && winRate > 40) {
    grade = "D";
    gradeColor = "hsl(var(--loss))";
  } else {
    grade = "F";
    gradeColor = "hsl(var(--destructive))";
  }

  return {
    month: monthKey,
    label: format(start, "MMMM yyyy"),
    totalTrades: monthTrades.length,
    buys,
    sells,
    dividends: dividendTrades.length,
    netRealizedPnL: Math.round(netRealizedPnL * 100) / 100,
    dividendIncome: Math.round(dividendIncome * 100) / 100,
    winRate: Math.round(winRate),
    winningSells,
    totalSells,
    bestTrade: best ? { symbol: best.symbol, pnl: Math.round(best.pnl * 100) / 100 } : null,
    worstTrade: worst ? { symbol: worst.symbol, pnl: Math.round(worst.pnl * 100) / 100 } : null,
    mostTradedAsset,
    grade,
    gradeColor,
  };
}

export default function ReportCard() {
  const { activeId } = useActivePortfolio();
  const { data: trades = [], isLoading } = useTrades(activeId || undefined);
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const { t } = useLanguage();

  // Compute available months
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    for (const t of trades) {
      const d = parseISO(t.trade_date);
      months.add(format(d, "yyyy-MM"));
    }
    return Array.from(months).sort().reverse();
  }, [trades]);

  const [selectedMonth, setSelectedMonth] = useState<string>("");

  // Default to most recent month
  const activeMonth = selectedMonth || availableMonths[0] || "";

  const stats = useMemo(() => {
    if (!activeMonth || trades.length === 0) return null;
    return computeMonthStats(trades, activeMonth);
  }, [trades, activeMonth]);

  const handleExport = useCallback(async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: null,
        scale: 2,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-card-${activeMonth}.png`;
      a.click();
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setExporting(false);
    }
  }, [activeMonth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-pulse text-muted-foreground">{t("report.loadingReport")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl chess-title flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            {t("report.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("report.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          {availableMonths.length > 0 && (
            <Select value={activeMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select month" />
              </SelectTrigger>
              <SelectContent>
                {availableMonths.map((m) => (
                  <SelectItem key={m} value={m}>
                    {format(parseISO(`${m}-01`), "MMMM yyyy")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {stats && (
            <Button variant="outline" size="sm" onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4 mr-1" />
              {exporting ? t("report.exporting") : t("report.downloadPng")}
            </Button>
          )}
        </div>
      </div>

      {!stats ? (
        <Card>
          <CardContent className="py-16 text-center">
            <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-muted-foreground">{t("report.noTrades")}</p>
          </CardContent>
        </Card>
      ) : (
        <div ref={cardRef}>
          <Card className="overflow-hidden">
            {/* Grade header */}
            <div
              className="flex items-center justify-between px-8 py-10"
              style={{ background: `linear-gradient(135deg, ${stats.gradeColor}22, ${stats.gradeColor}08)` }}
            >
              <div>
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  {stats.label}
                </p>
                <p className="text-lg font-semibold text-foreground mt-1">{t("report.tradingReportCard")}</p>
              </div>
              <div className="flex flex-col items-center">
                <div
                  className="text-7xl font-black leading-none"
                  style={{ color: stats.gradeColor }}
                >
                  {stats.grade}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {stats.grade === "A+" && t("report.outstanding")}
                  {stats.grade === "A" && t("report.excellent")}
                  {stats.grade === "B" && t("report.goodJob")}
                  {stats.grade === "C" && t("report.holdingSteady")}
                  {stats.grade === "D" && t("report.roomToImprove")}
                  {stats.grade === "F" && t("report.toughMonth")}
                </p>
              </div>
            </div>

            <CardContent className="p-8">
              {/* Stats grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                <StatBox icon={<BarChart3 className="h-4 w-4" />} label={t("report.totalTrades")} value={stats.totalTrades.toString()} sub={`${stats.buys} ${t("report.buys")} · ${stats.sells} ${t("report.sells")}`} />
                <StatBox icon={<TrendingUp className="h-4 w-4" />} label={t("report.netPnl")} value={`${stats.netRealizedPnL >= 0 ? "+" : ""}$${stats.netRealizedPnL.toFixed(2)}`} valueColor={stats.netRealizedPnL >= 0 ? "hsl(var(--gain))" : "hsl(var(--loss))"} />
                <StatBox icon={<Coins className="h-4 w-4" />} label={t("report.dividends")} value={`$${stats.dividendIncome.toFixed(2)}`} />
                <StatBox icon={<Award className="h-4 w-4" />} label={t("report.winRate")} value={stats.totalSells > 0 ? `${stats.winRate}%` : "—"} sub={stats.totalSells > 0 ? `${stats.winningSells}/${stats.totalSells} ${t("report.wins")}` : t("report.noSells")} />
              </div>

              {/* Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
                {stats.bestTrade && (
                  <Card className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Star className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium text-foreground">{t("report.bestTrade")}</span>
                      </div>
                      <p className="text-lg font-bold text-foreground">{stats.bestTrade.symbol}</p>
                      <p className="text-sm font-semibold" style={{ color: "hsl(var(--gain))" }}>
                        +${stats.bestTrade.pnl.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                )}
                {stats.worstTrade && (
                  <Card className="border-border">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="h-4 w-4 text-destructive" />
                        <span className="text-sm font-medium text-foreground">{t("report.worstTrade")}</span>
                      </div>
                      <p className="text-lg font-bold text-foreground">{stats.worstTrade.symbol}</p>
                      <p className="text-sm font-semibold" style={{ color: "hsl(var(--loss))" }}>
                        ${stats.worstTrade.pnl.toFixed(2)}
                      </p>
                    </CardContent>
                  </Card>
                )}
                <Card className="border-border">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium text-foreground">{t("report.mostTraded")}</span>
                    </div>
                    <p className="text-lg font-bold text-foreground">{stats.mostTradedAsset}</p>
                    <p className="text-sm text-muted-foreground">{t("report.byTradeCount")}</p>
                  </CardContent>
                </Card>
              </div>

              {/* Win rate bar */}
              {stats.totalSells > 0 && (
                <div className="mt-8">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">{t("report.winRate")}</span>
                    <span className="text-sm font-bold text-foreground">{stats.winRate}%</span>
                  </div>
                  <Progress value={stats.winRate} className="h-3" />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
  sub,
  valueColor,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-1.5 text-muted-foreground">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-xl font-bold" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
