import { useDemo } from "../DemoContext";
import { WatchFace } from "@/components/WatchFace";

export function WatchScreen() {
  const { data, fmt } = useDemo();
  const stocks = data.dailyBreakdown.map((b) => ({
    symbol: b.symbol,
    amountChange: b.amountChange,
    pctChange: b.pctChange,
  }));

  return (
    <WatchFace
      loading={data.loading || data.pricesLoading}
      hasData={data.hasData}
      dailyChange={data.dailyChange}
      dailyChangePct={data.dailyChangePct}
      stocks={stocks}
      fmtAmount={(v) => fmt.fmtCompact(fmt.cx(v))}
      portfolioValueFmt={fmt.fmtCompact(fmt.cx(data.totalPortfolioValue))}
    />
  );
}
