import { useMemo } from "react";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";
import { PriceChart } from "@/components/PriceChart";
import { cn } from "@/lib/utils";
import { useDemo } from "../DemoContext";
import { MetricTile } from "../components/MetricTile";
import { TradeRowCard } from "../components/TradeRowCard";
import { SectionCard } from "../components/SectionCard";
import { EmptyState } from "../components/EmptyState";

export function AssetDetailScreen() {
  const { selectedSymbol, data, fmt, setScreen } = useDemo();
  const symbol = selectedSymbol;

  const symbolTrades = useMemo(
    () => (symbol ? data.trades.filter((t) => t.symbol === symbol) : []),
    [data.trades, symbol],
  );

  if (!symbol) {
    return <EmptyState icon={ArrowLeft} title="No asset selected" actionLabel="Back to portfolio" onAction={() => setScreen("dashboard")} />;
  }

  const holding = data.holdings.find((h) => h.symbol === symbol);
  const price = data.prices.get(symbol.toUpperCase());
  const prevClose = data.previousCloses.get(symbol.toUpperCase());
  const name = symbolTrades[0]?.asset_name || symbol;
  const dayPct = price && prevClose ? ((price - prevClose) / prevClose) * 100 : null;
  const dayUp = (dayPct ?? 0) >= 0;

  const mktVal = holding ? (price ? price * holding.net_quantity : holding.total_invested) : 0;
  const uPnl = holding && price ? (price - holding.avg_cost) * holding.net_quantity : 0;
  const uPnlPct = holding && price && holding.avg_cost > 0 ? ((price - holding.avg_cost) / holding.avg_cost) * 100 : 0;
  const up = uPnl >= 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setScreen("dashboard")}
          aria-label="Back"
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="font-mono text-xl font-bold text-primary">{symbol}</h1>
            {dayPct !== null && (
              <span className={cn("font-mono text-sm font-semibold", dayUp ? "text-gain" : "text-loss")}>
                {dayUp ? "+" : ""}
                {dayPct.toFixed(2)}%
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{name}</p>
        </div>
        <div className="ml-auto text-right">
          {price ? (
            <p className="font-mono text-lg font-bold">{fmt.fmt(fmt.cx(price))}</p>
          ) : (
            <p className="text-xs text-muted-foreground">No quote</p>
          )}
        </div>
      </div>

      {holding ? (
        <div className="grid grid-cols-2 gap-3">
          <MetricTile label="Position value" value={fmt.fmtCompact(fmt.cx(mktVal))} />
          <MetricTile
            label="Unrealized P&L"
            value={`${up ? "+" : ""}${fmt.fmtCompact(fmt.cx(uPnl))}`}
            sub={`${up ? "+" : ""}${uPnlPct.toFixed(1)}%`}
            tone={up ? "gain" : "loss"}
            icon={up ? TrendingUp : TrendingDown}
          />
          <MetricTile label="Shares" value={holding.net_quantity.toFixed(2)} />
          <MetricTile label="Avg cost" value={fmt.fmt(fmt.cx(holding.avg_cost))} />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed bg-card/50 p-4 text-center text-sm text-muted-foreground">
          Position closed — showing trade history.
        </p>
      )}

      <PriceChart symbol={symbol} trades={symbolTrades} />

      <SectionCard title="Trade history" bodyClassName="space-y-2">
        {symbolTrades.map((t) => (
          <TradeRowCard key={t.id} trade={t} />
        ))}
      </SectionCard>
    </div>
  );
}
