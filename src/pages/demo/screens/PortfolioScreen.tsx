import { useState } from "react";
import { Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDemo } from "../DemoContext";
import { EmptyState } from "../components/EmptyState";
import { PortfolioV4 } from "./portfolio/PortfolioV4";
import { PortfolioV2 } from "./portfolio/PortfolioV2";
import { PortfolioV3 } from "./portfolio/PortfolioV3";

const VIEWS = [
  { id: "allocation", label: "Allocation", Comp: PortfolioV4 },
  { id: "terminal", label: "Terminal", Comp: PortfolioV2 },
  { id: "heatmap", label: "Heatmap", Comp: PortfolioV3 },
];

/** Portfolio page with three toggleable views — Allocation (default), Terminal, Heatmap. */
export function PortfolioScreen() {
  const { data, setScreen } = useDemo();
  const [view, setView] = useState("allocation");

  if (data.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-full" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!data.hasData) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Your portfolio is empty"
        description="Add a trade to start building your portfolio."
        actionLabel="Add a trade"
        onAction={() => setScreen("addTrade")}
      />
    );
  }

  const Active = VIEWS.find((x) => x.id === view)?.Comp ?? PortfolioV4;

  return (
    <div className="space-y-4">
      <div className="flex rounded-full border bg-card p-1">
        {VIEWS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setView(x.id)}
            className={cn(
              "flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
              view === x.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <Active />
    </div>
  );
}
