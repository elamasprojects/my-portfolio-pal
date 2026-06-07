// Deterministic mock generators for the new-feature prototypes.
// Seeded off real holding symbols so the demo is stable across reloads and plausible.
import type { Holding } from "@/hooks/usePortfolio";
import type { DemoAlert, DividendEvent, WatchItem } from "./types";

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

// ── Price / movement alerts ──
export function makeAlerts(holdings: Holding[]): DemoAlert[] {
  const top = [...holdings].sort((a, b) => b.total_invested - a.total_invested).slice(0, 4);
  const conds: DemoAlert["condition"][] = ["above", "below", "moves", "above"];
  return top.map((h, i) => {
    const cond = conds[i % conds.length];
    const target = cond === "above" ? round2(h.avg_cost * 1.15) : cond === "below" ? round2(h.avg_cost * 0.9) : 5;
    return {
      id: `al-${h.symbol}`,
      symbol: h.symbol,
      condition: cond,
      target,
      active: hash(h.symbol) % 4 !== 0,
    };
  });
}

// ── Watchlist (tickers not owned) ──
const WATCH_UNIVERSE: WatchItem[] = [
  { symbol: "VOO", name: "Vanguard S&P 500 ETF" },
  { symbol: "NVDA", name: "NVIDIA Corp." },
  { symbol: "TSLA", name: "Tesla, Inc." },
  { symbol: "KO", name: "The Coca-Cola Company" },
  { symbol: "MELI", name: "MercadoLibre, Inc." },
  { symbol: "AMZN", name: "Amazon.com, Inc." },
];

export function makeWatchlist(ownedSymbols: string[]): WatchItem[] {
  const owned = new Set(ownedSymbols.map((s) => s.toUpperCase()));
  return WATCH_UNIVERSE.filter((w) => !owned.has(w.symbol));
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
      // quarterly dividend ~ 0.4%–2.4% of cost basis per share
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
  // A gentle index curve that trails the portfolio's general shape.
  return portfolioPoints.map((p, i) => {
    const wobble = Math.sin(i / 2) * 1.5;
    return { date: p.date, pct: round2(p.pct * 0.6 + wobble) };
  });
}
