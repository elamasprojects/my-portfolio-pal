import { BarChart3, Briefcase, History, LayoutDashboard, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemo } from "../DemoContext";
import type { DemoScreenId } from "../data/types";

const LEFT: { id: DemoScreenId; label: string; Icon: typeof History }[] = [
  { id: "dashboard", label: "Home", Icon: LayoutDashboard },
  { id: "trades", label: "Trades", Icon: History },
];
const RIGHT: { id: DemoScreenId; label: string; Icon: typeof History }[] = [
  { id: "analysis", label: "Analysis", Icon: BarChart3 },
  { id: "portfolio", label: "Portfolio", Icon: Briefcase },
];

export function DemoBottomNav() {
  const { screen, setScreen } = useDemo();

  const NavBtn = ({ id, label, Icon }: { id: DemoScreenId; label: string; Icon: typeof History }) => {
    const active = screen === id;
    return (
      <button
        type="button"
        onClick={() => setScreen(id)}
        className={cn(
          "flex h-14 min-w-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-medium transition-colors",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
        <span>{label}</span>
      </button>
    );
  };

  return (
    <nav className="absolute inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
      <div className="relative mx-auto flex h-16 max-w-md items-center justify-between rounded-3xl border border-border/40 bg-card/85 px-2 shadow-lg backdrop-blur-md">
        <NavBtn {...LEFT[0]} />
        <NavBtn {...LEFT[1]} />
        <div className="w-14 shrink-0" aria-hidden />
        <NavBtn {...RIGHT[0]} />
        <NavBtn {...RIGHT[1]} />

        {/* Center FAB = Add Trade (the primary action) */}
        <button
          type="button"
          onClick={() => setScreen("addTrade")}
          aria-label="Add trade"
          className="absolute left-1/2 top-0 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black text-primary shadow-lg ring-4 ring-background transition-transform active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </nav>
  );
}
