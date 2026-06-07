import { useState } from "react";
import { ChevronLeft, List } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WatchStock {
  symbol: string;
  amountChange: number;
  pctChange: number;
}

interface WatchFaceProps {
  loading?: boolean;
  hasData: boolean;
  dailyChange: number;
  dailyChangePct: number;
  /** All holdings with a quote today, sorted by |amountChange| desc. */
  stocks: WatchStock[];
  /** Compact, currency-aware amount formatter (e.g. +$1.2K). */
  fmtAmount: (usd: number) => string;
  /** Shown in the markets-closed fallback. */
  portfolioValueFmt?: string;
}

/**
 * Pixel Watch 4 (45mm) face — designed at a true 456×456 logical box; callers scale it.
 * Always-dark OLED face (fixed emerald/red for contrast). A top button enters a full
 * stock list (today's % change); the day P&L + top movers stay on the main view below it.
 */
export function WatchFace({
  loading,
  hasData,
  dailyChange,
  dailyChangePct,
  stocks,
  fmtAmount,
  portfolioValueFmt,
}: WatchFaceProps) {
  const [view, setView] = useState<"main" | "list">("main");
  const dayUp = dailyChange >= 0;
  const movers = stocks.slice(0, 5);
  const hasDaily = stocks.length > 0;

  return (
    <div className="flex h-[456px] w-[456px] flex-col items-center bg-black text-white" style={{ padding: "12%" }}>
      {loading ? (
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <div className="h-5 w-28 animate-pulse rounded bg-white/20" />
          <div className="h-12 w-48 animate-pulse rounded bg-white/20" />
          <div className="h-5 w-24 animate-pulse rounded bg-white/15" />
        </div>
      ) : !hasData ? (
        <div className="flex h-full flex-col items-center justify-center text-center">
          <p className="text-[22px] uppercase tracking-widest text-white/50">No positions</p>
        </div>
      ) : view === "list" ? (
        <>
          <button
            type="button"
            onClick={() => setView("main")}
            className="mx-auto flex items-center gap-1 text-[19px] font-medium text-white/70"
          >
            <ChevronLeft className="h-6 w-6" /> Today
          </button>
          <p className="mb-2 mt-1 text-[24px] font-bold tracking-tight">All Stocks</p>
          {hasDaily ? (
            <div className="watch-fade scrollbar-hidden w-full flex-1 overflow-y-auto">
              <div className="space-y-2 py-2">
                {stocks.map((s) => {
                  const up = s.amountChange >= 0;
                  return (
                    <div key={s.symbol} className="flex items-center justify-between rounded-2xl bg-white/[0.07] px-4 py-2.5">
                      <span className="font-mono text-[22px] font-bold">{s.symbol}</span>
                      <span className={cn("font-mono text-[21px] font-semibold", up ? "text-emerald-400" : "text-red-400")}>
                        {up ? "+" : ""}
                        {s.pctChange.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="mt-6 text-[18px] text-white/45">No quotes today</p>
          )}
        </>
      ) : (
        <>
          <button
            type="button"
            onClick={() => setView("list")}
            className="mx-auto mb-2 inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-[19px] font-semibold text-white/90 active:scale-95"
          >
            <List className="h-5 w-5" /> All Stocks
          </button>
          {!hasDaily ? (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <p className="text-[17px] uppercase tracking-[0.2em] text-white/45">Markets closed</p>
              {portfolioValueFmt && <p className="mt-3 font-mono text-[40px] font-bold">{portfolioValueFmt}</p>}
              <p className="mt-2 text-[16px] text-white/45">Last close</p>
            </div>
          ) : (
            <>
              <p className="text-[17px] font-semibold uppercase tracking-[0.18em] text-white/55">Today</p>
              <p className={cn("mt-0.5 font-mono text-[48px] font-bold leading-none", dayUp ? "text-emerald-400" : "text-red-400")}>
                {dayUp ? "+" : ""}
                {fmtAmount(dailyChange)}
              </p>
              <p className={cn("mt-1 font-mono text-[26px] font-semibold", dayUp ? "text-emerald-400" : "text-red-400")}>
                {dayUp ? "+" : ""}
                {dailyChangePct.toFixed(2)}%
              </p>
              <div className="watch-fade scrollbar-hidden mt-3 w-full flex-1 overflow-y-auto">
                <div className="space-y-2">
                  {movers.map((m) => {
                    const up = m.amountChange >= 0;
                    return (
                      <div key={m.symbol} className="flex items-center justify-between rounded-2xl bg-white/[0.07] px-4 py-2">
                        <span className="font-mono text-[21px] font-bold">{m.symbol}</span>
                        <div className="text-right leading-tight">
                          <p className={cn("font-mono text-[18px] font-semibold", up ? "text-emerald-400" : "text-red-400")}>
                            {up ? "+" : ""}
                            {fmtAmount(m.amountChange)}
                          </p>
                          <p className={cn("font-mono text-[15px]", up ? "text-emerald-400/80" : "text-red-400/80")}>
                            {up ? "+" : ""}
                            {m.pctChange.toFixed(1)}%
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
