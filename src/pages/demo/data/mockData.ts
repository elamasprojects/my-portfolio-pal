// Deterministic mock generators for the new-feature prototypes.
// Alerts + watchlist live in shared libs (used by demo + production); re-exported here.
import type { Holding } from "@/hooks/usePortfolio";
import type { DividendEvent } from "./types";

export { makeAlerts } from "@/lib/alerts";
export { makeWatchlist } from "@/lib/watchlist";

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
const round2 = (v: number) => Math.round(v * 100) / 100;
const iso = (d: Date) => d.toISOString().split("T")[0];
function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

// ── Dividend calendar (upcoming ex/pay dates) ──
export function makeDividendSchedule(holdings: Holding[], now: Date): DividendEvent[] {
  const payers = holdings.filter((h) => hash(h.symbol) % 2 === 0).slice(0, 6);
  return payers
    .map((h) => {
      const seed = hash(h.symbol);
      const exOffset = 4 + (seed % 55); // 4..58 days out
      const exDate = addDays(now, exOffset);
      const payDate = addDays(exDate, 14);
      const yieldPerQuarter = 0.004 + (seed % 20) / 1000;
      const amountPerShare = round2(Math.max(0.02, h.avg_cost * yieldPerQuarter));
      return {
        id: `dv-${h.symbol}`,
        symbol: h.symbol,
        exDate: iso(exDate),
        payDate: iso(payDate),
        amountPerShare,
        shares: h.net_quantity,
      } as DividendEvent;
    })
    .sort((a, b) => a.exDate.localeCompare(b.exDate));
}

// ── Synthetic benchmark fallback (used only if stock-history fails) ──
export function makeSyntheticIndexCurve(portfolioPoints: { date: string; pct: number }[]): { date: string; pct: number }[] {
  return portfolioPoints.map((p, i) => {
    const wobble = Math.sin(i / 2) * 1.5;
    return { date: p.date, pct: round2(p.pct * 0.6 + wobble) };
  });
}
