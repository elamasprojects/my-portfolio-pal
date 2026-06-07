import { useMemo } from "react";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { makeWatchlist } from "@/lib/watchlist";
import { useDemo } from "../DemoContext";
import { WatchFace } from "@/components/WatchFace";

export function WatchScreen() {
  const { data, fmt } = useDemo();
  const stocks = data.dailyBreakdown.map((b) => ({
    symbol: b.symbol,
    amountChange: b.amountChange,
    pctChange: b.pctChange,
  }));

  const watchItems = useMemo(() => makeWatchlist(data.holdings.map((h) => h.symbol)), [data.holdings]);
  const watchSymbols = useMemo(() => watchItems.map((w) => w.symbol), [watchItems]);
  const { prices, previousCloses } = useMarketPrices(watchSymbols);
  const watchlist = useMemo(
    () =>
      watchItems
        .map((w) => {
          const p = prices.get(w.symbol.toUpperCase());
          const pc = previousCloses.get(w.symbol.toUpperCase());
          const pct = p && pc ? ((p - pc) / pc) * 100 : 0;
          return { symbol: w.symbol, amountChange: p && pc ? p - pc : 0, pctChange: pct };
        })
        .sort((a, b) => Math.abs(b.pctChange) - Math.abs(a.pctChange)),
    [watchItems, prices, previousCloses],
  );

  return (
    <WatchFace
      loading={data.loading || data.pricesLoading}
      hasData={data.hasData}
      dailyChange={data.dailyChange}
      dailyChangePct={data.dailyChangePct}
      stocks={stocks}
      watchlist={watchlist}
      fmtAmount={(v) => fmt.fmtCompact(fmt.cx(v))}
      portfolioValueFmt={fmt.fmtCompact(fmt.cx(data.totalPortfolioValue))}
    />
  );
}
