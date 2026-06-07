import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWatchData } from "@/hooks/useWatchData";
import { convertUsdToArs } from "@/hooks/useDolarMEP";
import { WatchFace } from "@/components/WatchFace";

const LOGICAL = 456; // Pixel Watch 4 (45mm) logical px

/**
 * Standalone round watch view on live data (Wear OS-style). Full-screen black,
 * auth-gated, no app chrome. Scales the 456×456 face to fit the viewport.
 */
export default function Watch() {
  const { session, loading } = useAuth();
  const w = useWatchData();
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const size = Math.min(window.innerWidth, window.innerHeight);
      setScale(Math.min(size / LOGICAL, 1.1));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  if (loading) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-black text-sm text-white/60">Loading…</div>;
  }
  if (!session) return <Navigate to="/auth" replace />;

  const isARS = w.currency === "ARS";
  const fmtAmount = (v: number) => {
    const x = isARS ? convertUsdToArs(v, w.mepRate) : v;
    const sym = isARS ? "ARS$" : "$";
    const abs = Math.abs(x);
    if (abs >= 1_000_000) return `${sym}${(x / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sym}${(x / 1_000).toFixed(1)}K`;
    return `${sym}${x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const stocks = w.breakdown.map((b) => ({ symbol: b.symbol, amountChange: b.amountChange, pctChange: b.pctChange }));

  return (
    <div className="flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-black">
      <div className="overflow-hidden rounded-full" style={{ width: LOGICAL * scale, height: LOGICAL * scale }}>
        <div className="origin-top-left" style={{ width: LOGICAL, height: LOGICAL, transform: `scale(${scale})` }}>
          <WatchFace
            loading={w.loading || w.pricesLoading}
            hasData={w.hasData}
            dailyChange={w.dailyChange}
            dailyChangePct={w.dailyChangePct}
            stocks={stocks}
            fmtAmount={fmtAmount}
            portfolioValueFmt={fmtAmount(w.totalPortfolioValue)}
          />
        </div>
      </div>
    </div>
  );
}
