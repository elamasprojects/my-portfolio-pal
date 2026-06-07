import { useMemo, useState } from "react";
import { Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDemo } from "../DemoContext";
import { TradeRowCard } from "../components/TradeRowCard";
import { Chip } from "../components/Chip";
import { EmptyState } from "../components/EmptyState";

type Filter = "all" | "buy" | "sell" | "dividend";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "buy", label: "Buys" },
  { id: "sell", label: "Sells" },
  { id: "dividend", label: "Dividends" },
];

export function TradeLogScreen() {
  const { data, isPhone, openAsset, setScreen } = useDemo();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(
    () =>
      data.trades.filter((t) => {
        if (filter !== "all" && t.trade_type !== filter) return false;
        if (q.trim()) {
          const s = q.toLowerCase();
          if (!t.symbol.toLowerCase().includes(s) && !t.asset_name.toLowerCase().includes(s)) return false;
        }
        return true;
      }),
    [data.trades, q, filter],
  );

  if (data.loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  if (data.trades.length === 0) {
    return (
      <EmptyState
        icon={Plus}
        title="No trades yet"
        description="Your trade history will appear here as cards — no more sideways scrolling."
        actionLabel="Add a trade"
        onAction={() => setScreen("addTrade")}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbol or name" className="h-11 pl-9" />
      </div>
      <div className="demo-scroll flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label}
          </Chip>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">No matching trades.</p>
      ) : (
        <div className={cn("space-y-2", !isPhone && "grid grid-cols-2 gap-2 space-y-0")}>
          {filtered.map((t) => (
            <TradeRowCard key={t.id} trade={t} onClick={() => openAsset(t.symbol)} />
          ))}
        </div>
      )}
    </div>
  );
}
