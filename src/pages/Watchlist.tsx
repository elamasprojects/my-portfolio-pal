import { useMemo } from "react";
import { Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTrades, computeHoldings } from "@/hooks/usePortfolio";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { useProfile } from "@/hooks/useProfile";
import { makeFormatters } from "@/lib/format";
import { makeWatchlist } from "@/lib/watchlist";
import { useLanguage } from "@/i18n";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const Watchlist = () => {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const { data: trades = [] } = useTrades();
  const { profile } = useProfile();
  const { venta: mepRate } = useDolarMEP();

  const holdings = useMemo(() => computeHoldings(trades), [trades]);
  const watch = useMemo(() => makeWatchlist(holdings.map((h) => h.symbol)), [holdings]);
  const symbols = useMemo(() => watch.map((w) => w.symbol), [watch]);
  const { prices, previousCloses, isLoading } = useMarketPrices(symbols);
  const fmt = makeFormatters((profile?.default_currency as "USD" | "ARS") || "USD", mepRate);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl chess-title">{t("watchlist.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("watchlist.subtitle")}</p>
      </div>

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
                  aria-label={`Add ${w.symbol}`}
                  onClick={() => navigate(`/add?symbol=${w.symbol}`)}
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <p className="text-center text-xs text-muted-foreground">{t("watchlist.prototypeNote")}</p>
    </div>
  );
};

export default Watchlist;
