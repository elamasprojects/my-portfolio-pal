import { useMemo } from "react";
import { Eye, Trash2 } from "lucide-react";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useWatchlist } from "@/hooks/useWatchlist";
import { AddToWatchlistButton } from "@/components/AddToWatchlistButton";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDemo } from "../DemoContext";
import { SectionCard } from "../components/SectionCard";
import { EmptyState } from "../components/EmptyState";

export function WatchlistScreen() {
  const { fmt } = useDemo();
  const { items: watch, remove } = useWatchlist();
  const symbols = useMemo(() => watch.map((w) => w.symbol), [watch]);
  const { prices, previousCloses, isLoading } = useMarketPrices(symbols);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Track any ticker with live quotes.</p>
        <AddToWatchlistButton />
      </div>

      {watch.length === 0 ? (
        <EmptyState icon={Eye} title="Your watchlist is empty" description="Use “Add symbol” to start tracking a ticker." />
      ) : (
        <SectionCard title="Watchlist" bodyClassName="space-y-2">
          {watch.map((w) => {
            const price = prices.get(w.symbol.toUpperCase());
            const prev = previousCloses.get(w.symbol.toUpperCase());
            const dayPct = price && prev ? ((price - prev) / prev) * 100 : null;
            const up = (dayPct ?? 0) >= 0;
            return (
              <div key={w.symbol} className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold">{w.symbol}</p>
                  <p className="truncate text-xs text-muted-foreground">{w.name}</p>
                </div>
                <div className="shrink-0 text-right">
                  {isLoading ? (
                    <Skeleton className="ml-auto h-5 w-16" />
                  ) : price ? (
                    <>
                      <p className="font-mono text-sm font-semibold">{fmt.fmt(fmt.cx(price))}</p>
                      {dayPct !== null && (
                        <p className={cn("font-mono text-xs font-semibold", up ? "text-gain" : "text-loss")}>
                          {up ? "+" : ""}
                          {dayPct.toFixed(2)}%
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground">No quote</p>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => remove(w.symbol)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </SectionCard>
      )}
    </div>
  );
}
