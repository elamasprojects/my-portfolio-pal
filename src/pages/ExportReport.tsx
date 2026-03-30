import { useRef, useState, useMemo } from "react";
import { FileDown, Sun, Moon } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  useTrades,
  useActivePortfolio,
  computeHoldings,
  computePerformance,
  computeCash,
} from "@/hooks/usePortfolio";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useTheme } from "@/hooks/useTheme";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { useLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";

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
  const exportRef = useRef<HTMLDivElement>(null);
  const { data: trades = [] } = useTrades();
  const { portfolio } = useActivePortfolio();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [previewDark, setPreviewDark] = useState(theme === "dark");
  const [exporting, setExporting] = useState(false);
  const [sharing, setSharing] = useState(false);

  const holdings = useMemo(() => computeHoldings(trades), [trades]);
  const performance = useMemo(() => computePerformance(trades), [trades]);
  const cash = useMemo(() => computeCash(trades), [trades]);

  const { prices: marketPrices } = useMarketPrices(holdings.map(h => h.symbol));

  const totalInvested = holdings.reduce((s, h) => s + h.total_invested, 0);
  const marketValue = holdings.reduce((s, h) => {
    const price = marketPrices.get(h.symbol.toUpperCase());
    return s + (price ? price * h.net_quantity : h.total_invested);
  }, 0);
  const unrealizedPnl = holdings.reduce((s, h) => {
    const price = marketPrices.get(h.symbol.toUpperCase());
    if (!price) return s;
    return s + (price - h.avg_cost) * h.net_quantity;
  }, 0);

  const pieData = holdings.map((h) => ({
    name: h.symbol,
    value: Math.round(h.total_invested * 100) / 100,
  }));

  const stats = [
    { label: t("export.totalInvested"), value: `$${totalInvested.toFixed(2)}` },
    { label: t("board.marketValue"), value: `$${marketValue.toFixed(2)}` },
    { label: t("board.unrealizedPnl"), value: `${unrealizedPnl >= 0 ? "+" : ""}$${unrealizedPnl.toFixed(2)}`, positive: unrealizedPnl >= 0 },
    { label: t("export.realizedPnl"), value: `$${performance.total_realized_pnl.toFixed(2)}`, positive: performance.total_realized_pnl >= 0 },
    { label: t("board.cash"), value: `$${cash.toFixed(2)}` },
    { label: t("export.winRate"), value: `${performance.win_rate.toFixed(1)}%` },
  ];

  const userName = profile?.username || profile?.display_name || "Trader";
  const userInitials = (profile?.username || profile?.display_name || "U").slice(0, 2).toUpperCase();
  const portfolioLabel = `${portfolio?.name || "Portfolio"} • ${format(new Date(), "MMM d, yyyy")}`;

  const captureExport = async () => {
    if (!exportRef.current) return null;
    return html2canvas(exportRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: previewDark ? "#1a1a20" : "#f0f0f2",
    });
  };

  const handleDownloadPDF = async () => {
    setExporting(true);
    try {
      const canvas = await captureExport();
      if (!canvas) return;
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width, canvas.height],
      });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`portfolio-card-${format(new Date(), "yyyy-MM-dd")}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  const handleShareToX = async () => {
    if (!user) return;
    setSharing(true);
    try {
      const canvas = await captureExport();
      if (!canvas) return;

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/png");
      });

      const path = `${user.id}/${Date.now()}.png`;
      const { error: uploadError } = await supabase.storage
        .from("exports")
        .upload(path, blob, { contentType: "image/png" });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("exports")
        .getPublicUrl(path);

      const { data: exportRecord, error: insertError } = await supabase
        .from("shared_exports")
        .insert({
          user_id: user.id,
          image_url: publicUrl,
          portfolio_name: portfolio?.name || "Portfolio",
          stats_json: {
            total_invested: totalInvested,
            realized_pnl: performance.total_realized_pnl,
            win_rate: performance.win_rate,
            dividends: performance.total_dividends,
            holdings_count: holdings.length,
          },
        })
        .select("id")
        .single();
      if (insertError) throw insertError;

      const shareUrl = `${window.location.origin}/share/${exportRecord.id}`;
      const tweetText = encodeURIComponent(
        `Check out my ${portfolio?.name || "Portfolio"} performance! 📊♟️`
      );
      window.open(
        `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(shareUrl)}`,
        "_blank"
      );
      toast.success("Share link created!");
    } catch (err: any) {
      toast.error(err.message || "Failed to share");
    } finally {
      setSharing(false);
    }
  };

  const bg = previewDark ? "#1a1a20" : "#f0f0f2";
  const fg = previewDark ? "#fafafa" : "#1a1a20";
  const cardBg = previewDark ? "#252530" : "#ffffff";
  const borderClr = previewDark ? "#333" : "#ccc";

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl chess-title flex items-center gap-2">
            <FileDown className="h-6 w-6 text-primary" />
            {t("export.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("export.subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Sun className="h-3.5 w-3.5 text-muted-foreground" />
            <Switch checked={previewDark} onCheckedChange={setPreviewDark} />
            <Moon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF} disabled={exporting}>
            <FileDown className="h-4 w-4 mr-1" />
            {exporting ? t("export.generating") : t("export.downloadPdf")}
          </Button>
          <Button size="sm" onClick={handleShareToX} disabled={sharing}>
            <FaXTwitter className="h-4 w-4 mr-1" />
            {sharing ? t("export.sharing") : t("export.shareToX")}
          </Button>
        </div>
      </div>

      {/* ===== RESPONSIVE PREVIEW (what the user sees) ===== */}
      <div className="rounded-xl border border-border overflow-hidden p-4 sm:p-6" style={{ background: bg, color: fg }}>
        {/* User header */}
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-10 w-10">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
            <AvatarFallback className="text-xs" style={{ background: cardBg }}>{userInitials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="font-bold text-sm truncate">{userName}</p>
            <p className="text-xs opacity-60 truncate">{portfolioLabel}</p>
          </div>
          <p className="text-[10px] opacity-40 font-mono hidden sm:block">♟ Chess</p>
        </div>

        {/* Stats grid — 2 cols mobile, 3 cols desktop */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-lg p-3 text-center" style={{ background: cardBg }}>
              <p className="text-[10px] sm:text-xs opacity-60 mb-0.5 truncate">{stat.label}</p>
              <p
                className="text-base sm:text-xl font-bold font-mono truncate"
                style={
                  stat.positive !== undefined
                    ? { color: stat.positive ? "hsl(174, 62%, 40%)" : "hsl(1, 84%, 63%)" }
                    : {}
                }
              >
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* Allocation + Holdings — stacked on mobile, side-by-side on desktop */}
        <div className="flex flex-col sm:flex-row gap-4">
          {pieData.length > 0 && (
            <div className="w-full sm:flex-1" style={{ height: 220 }}>
              <p className="text-xs font-semibold opacity-60 mb-1">{t("export.portfolioAllocation")}</p>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius="80%"
                    strokeWidth={0}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                    fontSize={11}
                    fill={fg}
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="sm:w-44 sm:flex-shrink-0">
            <p className="text-xs font-semibold opacity-60 mb-2">{t("export.holdings")}</p>
            <div className="flex flex-wrap gap-1.5">
              {holdings.slice(0, 12).map((h, i) => (
                <Badge
                  key={h.symbol}
                  variant="outline"
                  className="text-[10px]"
                  style={{ borderColor: COLORS[i % COLORS.length], color: COLORS[i % COLORS.length] }}
                >
                  {h.symbol}: ${h.total_invested.toFixed(0)}
                </Badge>
              ))}
              {holdings.length > 12 && (
                <Badge variant="outline" className="text-[10px] opacity-60">
                  +{holdings.length - 12} more
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] opacity-30 mt-4 pt-3 border-t" style={{ borderColor: borderClr }}>
          {t("export.generatedBy")} • {format(new Date(), "yyyy-MM-dd")}
        </div>
      </div>

      {/* ===== HIDDEN EXPORT CARD (fixed 1200x630 for html2canvas) ===== */}
      <div
        ref={exportRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          top: 0,
          width: 1200,
          height: 630,
          background: bg,
          color: fg,
          fontFamily: "system-ui, sans-serif",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: 40, height: "100%", display: "flex", flexDirection: "column" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 48, height: 48, borderRadius: "50%", background: cardBg,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 16, fontWeight: 700, overflow: "hidden",
                }}
              >
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  : userInitials}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{userName}</div>
                <div style={{ fontSize: 13, opacity: 0.6 }}>{portfolioLabel}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.4, fontFamily: "monospace" }}>♟ Chess</div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 24 }}>
            {stats.map((stat) => (
              <div key={stat.label} style={{ background: cardBg, borderRadius: 8, padding: 16, textAlign: "center" }}>
                <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 4 }}>{stat.label}</div>
                <div
                  style={{
                    fontSize: 22, fontWeight: 700, fontFamily: "monospace",
                    color: stat.positive !== undefined
                      ? (stat.positive ? "hsl(174, 62%, 40%)" : "hsl(1, 84%, 63%)")
                      : fg,
                  }}
                >
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* Pie + Holdings */}
          <div style={{ flex: 1, display: "flex", gap: 24, minHeight: 0 }}>
            {pieData.length > 0 && (
              <div style={{ flex: 1, minHeight: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.6, marginBottom: 4 }}>{t("export.portfolioAllocation")}</div>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius="80%"
                      strokeWidth={0}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                      fontSize={11}
                      fill={fg}
                    >
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <div style={{ width: 176, flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 600, opacity: 0.6, marginBottom: 8 }}>{t("export.holdings")}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {holdings.slice(0, 12).map((h, i) => (
                  <span
                    key={h.symbol}
                    style={{
                      fontSize: 10, border: `1px solid ${COLORS[i % COLORS.length]}`,
                      color: COLORS[i % COLORS.length], borderRadius: 999,
                      padding: "2px 8px", whiteSpace: "nowrap",
                    }}
                  >
                    {h.symbol}: ${h.total_invested.toFixed(0)}
                  </span>
                ))}
                {holdings.length > 12 && (
                  <span style={{ fontSize: 10, opacity: 0.5, padding: "2px 8px" }}>
                    +{holdings.length - 12} more
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ textAlign: "center", fontSize: 10, opacity: 0.3, marginTop: 16, paddingTop: 12, borderTop: `1px solid ${borderClr}` }}>
            {t("export.generatedBy")} • {format(new Date(), "yyyy-MM-dd")}
          </div>
        </div>
      </div>
    </div>
  );
}
