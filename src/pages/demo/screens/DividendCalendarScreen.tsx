import { useMemo } from "react";
import { CalendarClock, Coins } from "lucide-react";
import { useDemo } from "../DemoContext";
import { makeDividendSchedule } from "../data/mockData";
import { MetricTile } from "../components/MetricTile";
import { SectionCard } from "../components/SectionCard";
import { EmptyState } from "../components/EmptyState";

const monthLabel = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "long", year: "numeric" });
const dayLabel = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function DividendCalendarScreen() {
  const { data, fmt, setScreen } = useDemo();

  const schedule = useMemo(() => makeDividendSchedule(data.holdings, new Date()), [data.holdings]);

  const annualIncome = useMemo(() => {
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 1);
    const trailing = data.trades
      .filter((t) => t.trade_type === "dividend" && new Date(t.trade_date) >= cutoff)
      .reduce((s, t) => s + (Number(t.total_amount) || 0), 0);
    return trailing > 0 ? trailing : data.performance.total_dividends;
  }, [data.trades, data.performance.total_dividends]);

  const yieldOnCost = data.performance.total_cost_basis > 0 ? (annualIncome / data.performance.total_cost_basis) * 100 : 0;

  // Group upcoming events by month
  const grouped = useMemo(() => {
    const map = new Map<string, typeof schedule>();
    for (const ev of schedule) {
      const key = monthLabel(ev.exDate);
      const arr = map.get(key) || [];
      arr.push(ev);
      map.set(key, arr);
    }
    return [...map.entries()];
  }, [schedule]);

  if (data.holdings.length === 0) {
    return (
      <EmptyState
        icon={CalendarClock}
        title="No dividend data yet"
        description="Hold dividend-paying assets to see income and upcoming dates."
        actionLabel="Add a trade"
        onAction={() => setScreen("addTrade")}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <MetricTile label="Annual income" value={fmt.fmtCompact(fmt.cx(annualIncome))} tone="gain" icon={Coins} />
        <MetricTile label="Yield on cost" value={`${yieldOnCost.toFixed(2)}%`} icon={CalendarClock} />
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card/50 p-6 text-center text-sm text-muted-foreground">
          No upcoming dividends scheduled for your holdings.
        </p>
      ) : (
        grouped.map(([month, events]) => (
          <SectionCard key={month} title={month} bodyClassName="space-y-2">
            {events.map((ev) => {
              const est = ev.amountPerShare * ev.shares;
              return (
                <div key={ev.id} className="flex items-center gap-3 rounded-xl border bg-card p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm font-semibold">{ev.symbol}</p>
                    <p className="text-xs text-muted-foreground">
                      Ex {dayLabel(ev.exDate)} · Pay {dayLabel(ev.payDate)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-semibold text-gain">{fmt.fmt(fmt.cx(est))}</p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {fmt.currencySymbol}
                      {fmt.cx(ev.amountPerShare).toFixed(2)}/sh
                    </p>
                  </div>
                </div>
              );
            })}
          </SectionCard>
        ))
      )}
      <p className="text-center text-xs text-muted-foreground">
        Income & yield-on-cost are real; upcoming dates are estimated (prototype).
      </p>
    </div>
  );
}
