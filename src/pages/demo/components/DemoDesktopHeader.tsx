import { ChessKnight } from "@/components/ChessKnight";
import { cn } from "@/lib/utils";
import { useDemo } from "../DemoContext";
import { FEATURE_NAV, PRIMARY_TABS, SCREEN_TITLES } from "../data/screens";
import type { DemoScreenId } from "../data/types";

export function DemoDesktopHeader() {
  const { screen, setScreen } = useDemo();

  const Tab = (id: DemoScreenId, label?: string) => {
    const active = screen === id || (id === "dashboard" && screen === "assetDetail");
    return (
      <button
        key={id}
        type="button"
        onClick={() => setScreen(id)}
        className={cn(
          "h-10 rounded-lg px-3 text-sm font-medium transition-colors",
          active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
        )}
      >
        {label ?? SCREEN_TITLES[id]}
      </button>
    );
  };

  return (
    <header className="sticky top-0 z-20 -mx-4 mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-b bg-background/80 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
      <div className="flex items-center gap-2">
        <ChessKnight className="h-6 w-6 text-primary" />
        <span className="font-serif text-xl font-bold">Chess</span>
        <span className="ml-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
          Demo
        </span>
      </div>
      <nav className="flex flex-wrap items-center gap-1">
        {PRIMARY_TABS.map((id) => Tab(id))}
        <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
        {FEATURE_NAV.map((f) => Tab(f.id, f.label))}
      </nav>
    </header>
  );
}
