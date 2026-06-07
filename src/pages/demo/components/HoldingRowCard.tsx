import type { Holding } from "@/hooks/usePortfolio";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight } from "lucide-react";
import { useDemo } from "../DemoContext";

export function HoldingRowCard({ holding, onClick }: { holding: Holding; onClick?: () => void }) {
  const { data, fmt } = useDemo();
  const price = data.prices.get(holding.symbol.toUpperCase());
  const mktVal = price ? price * holding.net_quantity : holding.total_invested;
  const uPnlPct = price ? ((price - holding.avg_cost) / holding.avg_cost) * 100 : null;
  const up = (uPnlPct ?? 0) >= 0;

  return (
    <button
      onClick={onClick}
      className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border bg-card p-3.5 text-left transition-colors hover:bg-accent/30"
    >
      <div className="min-w-0">
        <p className="font-mono text-sm font-semibold text-primary">{holding.symbol}</p>
        <p className="text-xs text-muted-foreground">
          {holding.net_quantity.toFixed(2)} @ {fmt.currencySymbol}
          {fmt.cx(holding.avg_cost).toFixed(2)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <div className="text-right">
          {data.pricesLoading ? (
            <Skeleton className="ml-auto h-5 w-16" />
          ) : (
            <>
              <p className="font-mono text-sm font-semibold">{fmt.fmtCompact(fmt.cx(mktVal))}</p>
              {uPnlPct !== null && (
                <p className={cn("font-mono text-xs font-semibold", up ? "text-gain" : "text-loss")}>
                  {up ? "+" : ""}
                  {uPnlPct.toFixed(1)}%
                </p>
              )}
            </>
          )}
        </div>
        {onClick && <ChevronRight className="h-4 w-4 text-muted-foreground/50" />}
      </div>
    </button>
  );
}
