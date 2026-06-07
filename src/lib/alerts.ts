// Price/movement alerts seeded deterministically from the user's holdings.
// Shared by the demo prototype and the production /alerts page.
import type { Holding } from "@/hooks/usePortfolio";

export interface Alert {
  id: string;
  symbol: string;
  condition: "above" | "below" | "moves";
  /** price target for above/below; percent for "moves" */
  target: number;
  active: boolean;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
const round2 = (v: number) => Math.round(v * 100) / 100;

export function makeAlerts(holdings: Holding[]): Alert[] {
  const top = [...holdings].sort((a, b) => b.total_invested - a.total_invested).slice(0, 4);
  const conds: Alert["condition"][] = ["above", "below", "moves", "above"];
  return top.map((h, i) => {
    const cond = conds[i % conds.length];
    const target = cond === "above" ? round2(h.avg_cost * 1.15) : cond === "below" ? round2(h.avg_cost * 0.9) : 5;
    return { id: `al-${h.symbol}`, symbol: h.symbol, condition: cond, target, active: hash(h.symbol) % 4 !== 0 };
  });
}
