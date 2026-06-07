import { useMemo } from "react";
import { Eye, Trash2 } from "lucide-react";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { useProfile } from "@/hooks/useProfile";
import { makeFormatters } from "@/lib/format";
import { useWatchlist } from "@/hooks/useWatchlist";
import { AddToWatchlistButton } from "@/components/AddToWatchlistButton";
import { useLanguage } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const Watchlist = () => {
  const { t } = useLanguage();
  const { profile } = useProfile();
  const { venta: mepRate } = useDolarMEP();
  const { items: watch, remove } = useWatchlist();
  const symbols = useMemo(() => watch.map((w) => w.symbol), [watch]);
  const { prices, previousCloses, isLoading } = useMarketPrices(symbols);
  const fmt = makeFormatters((profile?.default_currency as "USD" | "ARS") || "USD", mepRate);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 pr-12 md:pr-0">
        <div>
          <h1 className="text-2xl chess-title">{t("watchlist.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("watchlist.subtitle")}</p>
        </div>
        <AddToWatchlistButton className="shrink-0" />
      </div>

      {watch.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Eye className="h-6 w-6" />
            </div>
            <p className="max-w-xs text-sm text-muted-foreground">{t("watchlist.empty")}</p>
            <AddToWatchlistButton />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="divide-y divide-border p-0">
            {watch.map((w) => {
              const price = prices.get(w.symbol.toUpperCase());
              const prev = previousCloses.get(w.symbol.toUpperCase());
              const dayPct = price && prev ? ((price - prev) / prev) * 100 : null;
              const up = (dayPct ?? 0) >= 0;
              return (
                <div key={w.symbol} className="flex items-center gap-3 p-4">
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
                      <p className="text-xs text-muted-foreground">{t("watchlist.noQuote")}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={t("watchlist.remove")}
                    onClick={() => remove(w.symbol)}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Watchlist;
