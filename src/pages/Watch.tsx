import { useEffect, useState } from "react";
import { RequireAuth } from "@/components/RequireAuth";
import { useWatchData } from "@/hooks/useWatchData";
import { makeFormatters } from "@/lib/format";
import { WatchFace } from "@/components/WatchFace";

const LOGICAL = 456; // Pixel Watch 4 (45mm) logical px

const computeScale = () => {
  if (typeof window === "undefined") return 1;
  return Math.min(Math.min(window.innerWidth, window.innerHeight) / LOGICAL, 1.1);
};

function WatchView() {
  const w = useWatchData();
  // Lazy init from the viewport so the first paint is already scaled (no flash).
  const [scale, setScale] = useState(computeScale);

  useEffect(() => {
    const update = () => setScale(computeScale());
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const fmt = makeFormatters(w.currency, w.mepRate);
  const fmtAmount = (v: number) => fmt.fmtCompact(fmt.cx(v));
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

/**
 * Standalone round watch view on live data (Wear OS-style). Full-screen black, auth-gated,
 * no app chrome. Scales the 456×456 face to fit the viewport.
 */
export default function Watch() {
  return (
    <RequireAuth>
      <WatchView />
    </RequireAuth>
  );
}
