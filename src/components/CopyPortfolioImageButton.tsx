import { useRef, useState } from "react";
import { Cell, Pie, PieChart } from "recharts";
import { ImageDown, Loader2 } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n";
import { CHART_COLORS } from "@/pages/demo/data/chartColors";

export interface ShareItem {
  symbol: string;
  name: string;
  weight: number; // % of portfolio
}

const CARD_BG = "#0e0f13";
const TEXT = "#e7e9ee";
const SUB = "#9aa0aa";
const RAD = Math.PI / 180;

// Ticker label just outside the donut, only for slices >= 5% (the legend lists every ticker).
const renderSliceLabel = (props: {
  cx?: number;
  cy?: number;
  midAngle?: number;
  outerRadius?: number;
  percent?: number;
  name?: string;
}) => {
  const { cx, cy, midAngle, outerRadius, percent, name } = props;
  if (cx == null || cy == null || midAngle == null || outerRadius == null || percent == null) return null;
  if (percent < 0.05) return null;
  const r = outerRadius + 18;
  const x = cx + r * Math.cos(-midAngle * RAD);
  const y = cy + r * Math.sin(-midAngle * RAD);
  return (
    <text
      x={x}
      y={y}
      fill={TEXT}
      fontSize={18}
      fontWeight={700}
      textAnchor={x < cx ? "end" : "start"}
      dominantBaseline="central"
      style={{ fontFamily: "monospace" }}
    >
      {name}
    </text>
  );
};

/**
 * Copies a shareable PNG of the portfolio to the clipboard: person's name + a donut +
 * every ticker with its allocation %. No money amounts — percentages only.
 */
export function CopyPortfolioImageButton({ name, items }: { name: string; items: ShareItem[] }) {
  const { t } = useLanguage();
  const cardRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const sorted = [...items].sort((a, b) => b.weight - a.weight);
  const pieData = sorted.map((h) => ({ name: h.symbol, value: Math.max(0.0001, h.weight) }));
  const cols = sorted.length <= 8 ? 2 : sorted.length <= 18 ? 3 : 4;

  const handleCopy = async () => {
    const node = cardRef.current;
    if (!node || !sorted.length) return;
    setBusy(true);
    try {
      const canvas = await html2canvas(node, { scale: 2, backgroundColor: CARD_BG, useCORS: true, logging: false });
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("no blob");
      try {
        if (!navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("clipboard unsupported");
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        toast.success(t("portfolio.copied"));
      } catch {
        // Clipboard image write unsupported/blocked (Firefox/Safari, unfocused tab) → download instead.
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "portfolio.png";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        toast.success(t("portfolio.downloaded"));
      }
    } catch {
      toast.error(t("portfolio.copyError"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={handleCopy} disabled={busy || !sorted.length} className="shrink-0">
        {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <ImageDown className="mr-1 h-4 w-4" />}
        {t("portfolio.copyImage")}
      </Button>

      {/* Offscreen share card captured by html2canvas. Inline styles only (no CSS vars). */}
      <div aria-hidden style={{ position: "fixed", left: -99999, top: 0, pointerEvents: "none" }}>
        <div
          ref={cardRef}
          style={{
            width: 1080,
            background: CARD_BG,
            color: TEXT,
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
            padding: 64,
            boxSizing: "border-box",
          }}
        >
          {/* Header — person's name */}
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.1, wordBreak: "break-word" }}>{name}</div>
              <div style={{ fontSize: 20, color: SUB, marginTop: 8, letterSpacing: 0.5 }}>Portfolio · Allocation</div>
            </div>
            <div style={{ fontSize: 22, color: SUB, fontFamily: "monospace", whiteSpace: "nowrap" }}>♟ Chess</div>
          </div>

          {/* Donut */}
          <div style={{ display: "flex", justifyContent: "center", margin: "12px 0 28px" }}>
            <PieChart width={560} height={460}>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={118}
                outerRadius={188}
                paddingAngle={1}
                isAnimationActive={false}
                stroke={CARD_BG}
                strokeWidth={2}
                label={renderSliceLabel}
                labelLine={false}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Pie>
            </PieChart>
          </div>

          {/* Legend — every ticker + allocation %, no money */}
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: "14px 28px" }}>
            {sorted.map((h, i) => (
              <div key={h.symbol} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22 }}>
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 4,
                    background: CHART_COLORS[i % CHART_COLORS.length],
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontWeight: 700, fontFamily: "monospace" }}>{h.symbol}</span>
                <span style={{ marginLeft: "auto", color: SUB, fontFamily: "monospace", fontWeight: 600 }}>
                  {h.weight.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
