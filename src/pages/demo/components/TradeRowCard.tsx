import type { Trade } from "@/hooks/usePortfolio";
import { cn } from "@/lib/utils";
import { useDemo } from "../DemoContext";

export function TradeRowCard({ trade, onClick }: { trade: Trade; onClick?: () => void }) {
  const { fmt } = useDemo();
  const typeColor =
    trade.trade_type === "buy"
      ? "bg-gain/10 text-gain"
      : trade.trade_type === "sell"
        ? "bg-loss/10 text-loss"
        : "bg-primary/10 text-primary";

  return (
    <button
      onClick={onClick}
      className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border bg-card p-3.5 text-left transition-colors hover:bg-accent/30"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn("shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold uppercase", typeColor)}>
          {trade.trade_type}
        </span>
        <div className="min-w-0">
          <p className="truncate font-mono text-sm font-semibold">{trade.symbol}</p>
          <p className="text-xs text-muted-foreground">{new Date(trade.trade_date).toLocaleDateString()}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-mono text-sm font-semibold">{fmt.fmt(fmt.cx(Number(trade.total_amount)))}</p>
        {trade.trade_type !== "dividend" && (
          <p className="font-mono text-xs text-muted-foreground">
            {Number(trade.quantity).toFixed(2)} @ {fmt.currencySymbol}
            {fmt.cx(Number(trade.price_per_unit)).toFixed(2)}
          </p>
        )}
      </div>
    </button>
  );
}
