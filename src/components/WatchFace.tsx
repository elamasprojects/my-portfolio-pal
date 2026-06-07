import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
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
  /** Optional watchlist tickers with today's % change. */
  watchlist?: WatchStock[];
  /** Compact, currency-aware amount formatter (e.g. +$1.2K). */
  fmtAmount: (usd: number) => string;
  /** Shown in the markets-closed fallback. */
  portfolioValueFmt?: string;
}

/**
 * A vertically-scrollable list page. Focuses itself when it becomes active so the Wear OS
 * rotary crown scrolls it, and shows a thin scrollbar as the scroll affordance.
 */
function ScrollPage({ active, children }: { active: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (active) ref.current?.focus({ preventScroll: true });
  }, [active]);
  return (
    <div ref={ref} tabIndex={0} className="watch-scroll touch-pan-y h-full w-full overflow-y-auto outline-none">
      <div className="space-y-2 py-1 pr-1">{children}</div>
    </div>
  );
}

/** A ticker row showing today's % change (used by both list pages). */
function PctRow({ s }: { s: WatchStock }) {
  const up = s.amountChange >= 0;
  return (
    <div className="flex items-center justify-between rounded-2xl bg-white/[0.07] px-4 py-2.5">
      <span className="font-mono text-[22px] font-bold">{s.symbol}</span>
      <span className={cn("font-mono text-[21px] font-semibold", up ? "text-emerald-400" : "text-red-400")}>
        {up ? "+" : ""}
        {s.pctChange.toFixed(1)}%
      </span>
    </div>
  );
}

/**
 * Pixel Watch 4 (45mm) face — designed at a true 456×456 logical box; callers scale it.
 * Always-dark OLED face. "All Stocks" opens a swipeable Stocks ⇄ Watchlist carousel; each
 * page scrolls with the rotary crown (visible thin scrollbar). The day P&L + top movers
 * stay on the main view.
 */
export function WatchFace({
  loading,
  hasData,
  dailyChange,
  dailyChangePct,
  stocks,
  watchlist = [],
  fmtAmount,
  portfolioValueFmt,
}: WatchFaceProps) {
  const [view, setView] = useState<"main" | "list">("main");
  const [page, setPage] = useState(0); // 0 = stocks, 1 = watchlist
  const dayUp = dailyChange >= 0;
  const movers = stocks.slice(0, 5);
  const hasDaily = stocks.length > 0;
  const hasWatchlist = watchlist.length > 0;
  const pages = 2; // always Stocks + Watchlist (so the watchlist is switchable on the watch)

  // Keep the page index valid if the watchlist disappears.
  useEffect(() => {
    if (page > pages - 1) setPage(0);
  }, [pages, page]);

  // Swipe left/right to switch pages. Pointer events cover both the watch (touch) and the
  // demo (mouse drag); `touch-pan-y` on the pages keeps vertical scroll native.
  const down = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: RPointerEvent) => {
    down.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: RPointerEvent) => {
    if (!down.current) return;
    const dx = e.clientX - down.current.x;
    const dy = e.clientY - down.current.y;
    down.current = null;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.4) {
      if (dx < 0) setPage((p) => Math.min(pages - 1, p + 1));
      else setPage((p) => Math.max(0, p - 1));
    }
  };

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
        <div className="flex h-full w-full flex-col">
          <button
            type="button"
            onClick={() => setView("main")}
            className="mx-auto flex items-center gap-1 text-[19px] font-medium text-white/70"
          >
            <ChevronLeft className="h-6 w-6" /> Today
          </button>

          {/* Page title + dots (switch by swiping) */}
          <div className="mb-1.5 mt-1 flex flex-col items-center gap-1.5">
            <p className="text-[24px] font-bold tracking-tight">{page === 1 ? "Watchlist" : "Stocks"}</p>
            <div className="flex gap-1.5">
              {[0, 1].map((i) => (
                <span
                  key={i}
                  className={cn("h-2 w-2 rounded-full transition-colors", page === i ? "bg-white" : "bg-white/30")}
                />
              ))}
            </div>
          </div>

          {/* Swipeable carousel */}
          <div
            className="relative w-full flex-1 select-none overflow-hidden"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={() => (down.current = null)}
          >
            <div
              className="flex h-full transition-transform duration-300 ease-out"
              style={{ width: `${pages * 100}%`, transform: `translateX(-${page * (100 / pages)}%)` }}
            >
              <div className="h-full shrink-0 touch-pan-y" style={{ width: `${100 / pages}%` }}>
                {stocks.length === 0 ? (
                  <p className="mt-6 text-center text-[18px] text-white/45">No quotes today</p>
                ) : (
                  <ScrollPage active={page === 0}>
                    {stocks.map((s) => (
                      <PctRow key={s.symbol} s={s} />
                    ))}
                  </ScrollPage>
                )}
              </div>
              <div className="h-full shrink-0 touch-pan-y" style={{ width: `${100 / pages}%` }}>
                {hasWatchlist ? (
                  <ScrollPage active={page === 1}>
                    {watchlist.map((s) => (
                      <PctRow key={s.symbol} s={s} />
                    ))}
                  </ScrollPage>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center px-3 text-center">
                    <p className="text-[19px] font-semibold text-white/55">Watchlist empty</p>
                    <p className="mt-1.5 text-[14px] leading-snug text-white/40">Add tickers from the Watchlist page in the app.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <p className="mt-1 text-center text-[13px] text-white/35">‹ swipe ›</p>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              setPage(0);
              setView("list");
            }}
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
