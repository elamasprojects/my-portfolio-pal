import { useRef, useState, useMemo } from "react";
import { FileDown, Printer, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useTrades,
  useActivePortfolio,
  computeHoldings,
  computePerformance,
} from "@/hooks/usePortfolio";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { useLanguage } from "@/i18n";

const COLORS = [
  "hsl(42, 80%, 55%)",
  "hsl(152, 55%, 45%)",
  "hsl(220, 8%, 60%)",
  "hsl(30, 60%, 50%)",
  "hsl(220, 10%, 35%)",
  "hsl(42, 60%, 70%)",
  "hsl(152, 40%, 60%)",
];

export default function ExportReport() {
  const reportRef = useRef<HTMLDivElement>(null);
  const { data: trades = [] } = useTrades();
  const { portfolio } = useActivePortfolio();
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [previewDark, setPreviewDark] = useState(theme === "dark");
  const [previewDark, setPreviewDark] = useState(theme === "dark");
  const [exporting, setExporting] = useState(false);

  const holdings = useMemo(() => computeHoldings(trades), [trades]);
  const performance = useMemo(() => computePerformance(trades), [trades]);
  const recentTrades = useMemo(() => trades.slice(0, 20), [trades]);

  const totalInvested = holdings.reduce((s, h) => s + h.total_invested, 0);
  const pieData = holdings.map((h) => ({
    name: h.symbol,
    value: Math.round(h.total_invested * 100) / 100,
  }));

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: previewDark ? "#1a1a20" : "#f0f0f2",
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? "landscape" : "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`portfolio-report-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => window.print();

  const bgClass = previewDark ? "dark" : "";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl chess-title flex items-center gap-2">
            <FileDown className="h-6 w-6 text-primary" />
            {t("export.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("export.subtitle")}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-muted-foreground" />
            <Switch checked={previewDark} onCheckedChange={setPreviewDark} />
            <Moon className="h-4 w-4 text-muted-foreground" />
          </div>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-1" /> {t("export.print")}
          </Button>
          <Button size="sm" onClick={handleDownloadPDF} disabled={exporting}>
            <FileDown className="h-4 w-4 mr-1" />
            {exporting ? t("export.generating") : t("export.downloadPdf")}
          </Button>
        </div>
      </div>

      {/* Report Preview */}
      <div
        ref={reportRef}
        className={`rounded-xl border border-border p-8 space-y-8 ${bgClass}`}
        style={{
          background: previewDark ? "#1a1a20" : "#f0f0f2",
          color: previewDark ? "#fafafa" : "#1a1a20",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: previewDark ? "#333" : "#ccc" }}>
          <div>
            <h2 className="text-xl font-bold">{portfolio?.name || "Portfolio"} {t("export.report")}</h2>
            <p className="text-sm opacity-60">{user?.email}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium">{format(new Date(), "MMMM d, yyyy")}</p>
            <p className="text-xs opacity-60">{trades.length} {t("export.totalTrades")}</p>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: t("export.totalInvested"), value: `$${totalInvested.toFixed(2)}` },
            { label: t("export.realizedPnl"), value: `$${performance.total_realized_pnl.toFixed(2)}`, color: performance.total_realized_pnl >= 0 },
            { label: t("export.dividends"), value: `$${performance.total_dividends.toFixed(2)}` },
            { label: t("export.winRate"), value: `${performance.win_rate.toFixed(1)}%` },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-lg p-4 text-center"
              style={{ background: previewDark ? "#252530" : "#ffffff" }}
            >
              <p className="text-xs opacity-60 mb-1">{stat.label}</p>
              <p
                className="text-lg font-bold font-mono"
                style={
                  stat.color !== undefined
                    ? { color: stat.color ? "hsl(174, 62%, 40%)" : "hsl(1, 84%, 63%)" }
                    : {}
                }
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Allocation Chart */}
        {pieData.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 opacity-80">{t("export.portfolioAllocation")}</h3>
            <div className="flex items-center gap-6 flex-wrap">
              <div className="w-48 h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} strokeWidth={0}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap gap-2">
                {pieData.map((d, i) => (
                  <Badge key={d.name} variant="outline" style={{ borderColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length] }}>
                    {d.name}: ${d.value.toFixed(0)}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Holdings Table */}
        {holdings.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 opacity-80">Holdings</h3>
            <div className="rounded-lg overflow-hidden" style={{ background: previewDark ? "#252530" : "#ffffff" }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Avg Cost</TableHead>
                    <TableHead className="text-right">Invested</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((h) => (
                    <TableRow key={h.symbol}>
                      <TableCell className="font-medium">{h.symbol}</TableCell>
                      <TableCell className="text-right font-mono">{h.net_quantity}</TableCell>
                      <TableCell className="text-right font-mono">${h.avg_cost.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">${h.total_invested.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* P&L by Symbol */}
        {performance.by_symbol.filter((s) => s.total_sells > 0 || s.dividends_received > 0).length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 opacity-80">P&L by Asset</h3>
            <div className="rounded-lg overflow-hidden" style={{ background: previewDark ? "#252530" : "#ffffff" }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Realized P&L</TableHead>
                    <TableHead className="text-right">Dividends</TableHead>
                    <TableHead className="text-right">Total Return</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {performance.by_symbol
                    .filter((s) => s.total_sells > 0 || s.dividends_received > 0)
                    .map((s) => (
                      <TableRow key={s.symbol}>
                        <TableCell className="font-medium">{s.symbol}</TableCell>
                        <TableCell className="text-right font-mono" style={{ color: s.realized_pnl >= 0 ? "hsl(174, 62%, 40%)" : "hsl(1, 84%, 63%)" }}>
                          ${s.realized_pnl.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-mono">${s.dividends_received.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono" style={{ color: s.total_return >= 0 ? "hsl(174, 62%, 40%)" : "hsl(1, 84%, 63%)" }}>
                          ${s.total_return.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Recent Trades */}
        {recentTrades.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 opacity-80">Recent Trades (Last 20)</h3>
            <div className="rounded-lg overflow-hidden" style={{ background: previewDark ? "#252530" : "#ffffff" }}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTrades.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs">{format(new Date(t.trade_date), "MMM d, yy")}</TableCell>
                      <TableCell className="font-medium">{t.symbol}</TableCell>
                      <TableCell>
                        <Badge variant={t.trade_type === "buy" ? "default" : t.trade_type === "sell" ? "destructive" : "secondary"} className="text-xs">
                          {t.trade_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono">{t.quantity}</TableCell>
                      <TableCell className="text-right font-mono">${t.price_per_unit.toFixed(2)}</TableCell>
                      <TableCell className="text-right font-mono">${(t.quantity * t.price_per_unit).toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center text-xs opacity-40 pt-4 border-t" style={{ borderColor: previewDark ? "#333" : "#ccc" }}>
          Generated by Chess • {format(new Date(), "yyyy-MM-dd HH:mm")}
        </div>
      </div>
    </div>
  );
}
