import { useState } from "react";
import { ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemo } from "../../DemoContext";
import { enrichHoldings, type EnrichedHolding } from "../../data/portfolioMetrics";

type SortKey = "mktVal" | "dayPct" | "uPnlPct" | "weight";

/** V2 — Terminal: dense, sortable monospace table. Numbers-first, Bloomberg-style. */
export function PortfolioV2() {
  const { data, fmt, openAsset } = useDemo();
  const { items } = enrichHoldings(data.holdings, data.prices, data.previousCloses);
  const [sort, setSort] = useState<SortKey>("mktVal");
  const sorted = [...items].sort((a, b) => (b[sort] ?? -Infinity) - (a[sort] ?? -Infinity));

  const Th = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="cursor-pointer select-none px-2 py-2" onClick={() => setSort(k)}>
      <span className="inline-flex items-center gap-0.5">
        {label}
        {sort === k && <ArrowDown className="h-3 w-3" />}
      </span>
    </th>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Value</p>
          <p className="font-mono text-lg font-bold">{fmt.fmt(fmt.cx(data.totalPortfolioValue))}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Day · Total</p>
          <p className="font-mono text-sm">
            <span className={data.dailyChange >= 0 ? "text-gain" : "text-loss"}>
              {data.dailyChangePct >= 0 ? "+" : ""}
              {data.dailyChangePct.toFixed(2)}%
            </span>{" "}
            ·{" "}
            <span className={data.totalPnl >= 0 ? "text-gain" : "text-loss"}>
              {data.totalPnlPct >= 0 ? "+" : ""}
              {data.totalPnlPct.toFixed(1)}%
            </span>
          </p>
        </div>
      </div>

      <div className="demo-scroll overflow-x-auto rounded-lg border bg-card">
        <table className="w-full min-w-[520px] text-right font-mono text-xs">
          <thead className="border-b text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-2 py-2 text-left">Sym</th>
              <Th k="dayPct" label="Day" />
              <th className="px-2 py-2">Last</th>
              <Th k="mktVal" label="Value" />
              <Th k="uPnlPct" label="P&L" />
              <Th k="weight" label="Wt" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((h: EnrichedHolding) => (
              <tr
                key={h.symbol}
                className="cursor-pointer border-b border-border/40 last:border-0 hover:bg-accent/30"
                onClick={() => openAsset(h.symbol)}
              >
                <td className="px-2 py-1.5 text-left font-semibold text-primary">{h.symbol}</td>
                <td className={cn("px-2", (h.dayPct ?? 0) >= 0 ? "text-gain" : "text-loss")}>
                  {h.dayPct !== null ? `${h.dayPct >= 0 ? "+" : ""}${h.dayPct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-2 text-muted-foreground">{h.price ? fmt.fmt(fmt.cx(h.price)) : "—"}</td>
                <td className="px-2">{fmt.fmtCompact(fmt.cx(h.mktVal))}</td>
                <td className={cn("px-2", (h.uPnlPct ?? 0) >= 0 ? "text-gain" : "text-loss")}>
                  {h.uPnlPct !== null ? `${h.uPnlPct >= 0 ? "+" : ""}${h.uPnlPct.toFixed(1)}%` : "—"}
                </td>
                <td className="px-2 text-muted-foreground">{h.weight.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-center text-[11px] text-muted-foreground">Tap a header to sort · tap a row for detail</p>
    </div>
  );
}
