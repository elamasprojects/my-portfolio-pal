import { useRef, useState, useMemo } from "react";
import { FileDown, Printer, Sun, Moon, Share2 } from "lucide-react";
import { FaXTwitter } from "react-icons/fa6";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  useTrades,
  useActivePortfolio,
  computeHoldings,
  computePerformance,
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
  const cardRef = useRef<HTMLDivElement>(null);
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

  const handleDownloadPDF = async () => {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: previewDark ? "#1a1a20" : "#f0f0f2",
      });
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
    if (!cardRef.current || !user) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(cardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: previewDark ? "#1a1a20" : "#f0f0f2",
      });

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

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
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

      {/* Shareable Card — 1200x630 aspect ratio for Twitter */}
      <div
        ref={cardRef}
        className="rounded-xl border border-border overflow-hidden"
        style={{
          aspectRatio: "1200 / 630",
          background: previewDark ? "#1a1a20" : "#f0f0f2",
          color: previewDark ? "#fafafa" : "#1a1a20",
        }}
      >
        <div className="h-full flex flex-col p-8">
          {/* Card Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                <AvatarFallback className="text-xs" style={{ background: previewDark ? "#333" : "#ddd" }}>
                  {(profile?.username || profile?.display_name || "U").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-bold text-sm">{profile?.username || profile?.display_name || "Trader"}</p>
                <p className="text-xs opacity-60">{portfolio?.name || "Portfolio"} • {format(new Date(), "MMM d, yyyy")}</p>
              </div>
            </div>
            <p className="text-xs opacity-40 font-mono">♟ Chess</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[
              { label: t("export.totalInvested"), value: `$${totalInvested.toFixed(2)}` },
              { label: t("board.marketValue"), value: `$${marketValue.toFixed(2)}` },
              { label: t("board.unrealizedPnl"), value: `${unrealizedPnl >= 0 ? "+" : ""}$${unrealizedPnl.toFixed(2)}`, positive: unrealizedPnl >= 0 },
              { label: t("export.realizedPnl"), value: `$${performance.total_realized_pnl.toFixed(2)}`, positive: performance.total_realized_pnl >= 0 },
              { label: t("export.dividends"), value: `$${performance.total_dividends.toFixed(2)}` },
              { label: t("export.winRate"), value: `${performance.win_rate.toFixed(1)}%` },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-lg p-4 text-center"
                style={{ background: previewDark ? "#252530" : "#ffffff" }}
              >
                <p className="text-[10px] opacity-60 mb-1">{stat.label}</p>
                <p
                  className="text-lg font-bold font-mono"
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

          {/* Allocation + Holdings */}
          <div className="flex-1 flex gap-6 min-h-0">
            {pieData.length > 0 && (
              <div className="flex-1 min-h-0">
                <p className="text-[10px] font-semibold opacity-60 mb-1">{t("export.portfolioAllocation")}</p>
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
                      fill={previewDark ? "#fafafa" : "#1a1a20"}
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
            <div className="w-44 flex-shrink-0 min-w-0">
              <p className="text-[10px] font-semibold opacity-60 mb-2">{t("export.holdings")}</p>
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
          <div className="text-center text-[10px] opacity-30 mt-4 pt-3 border-t" style={{ borderColor: previewDark ? "#333" : "#ccc" }}>
            {t("export.generatedBy")} • {format(new Date(), "yyyy-MM-dd")}
          </div>
        </div>
      </div>
    </div>
  );
}
