import { useMemo } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDemo } from "../DemoContext";
import { makeWatchlist } from "../data/mockData";
import { SectionCard } from "../components/SectionCard";

export function WatchlistScreen() {
  const { data, fmt, setScreen } = useDemo();
  const watch = useMemo(() => makeWatchlist(data.holdings.map((h) => h.symbol)), [data.holdings]);
  const symbols = useMemo(() => watch.map((w) => w.symbol), [watch]);
  const { prices, previousCloses, isLoading } = useMarketPrices(symbols);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Track tickers you don't own yet — with live quotes.</p>
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
                aria-label={`Add ${w.symbol}`}
                onClick={() => {
                  toast.success(`${w.symbol} → Add Trade (prototype)`);
                  setScreen("addTrade");
                }}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </SectionCard>
      <p className="text-center text-xs text-muted-foreground">Quotes are live; the symbol list is a sample (prototype).</p>
    </div>
  );
}
