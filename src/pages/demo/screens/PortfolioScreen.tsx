import { useState } from "react";
import { Briefcase } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemo } from "../DemoContext";
import { Chip } from "../components/Chip";
import { EmptyState } from "../components/EmptyState";
import { PortfolioV1 } from "./portfolio/PortfolioV1";
import { PortfolioV2 } from "./portfolio/PortfolioV2";
import { PortfolioV3 } from "./portfolio/PortfolioV3";
import { PortfolioV4 } from "./portfolio/PortfolioV4";
import { PortfolioV5 } from "./portfolio/PortfolioV5";

const VARIATIONS = [
  { id: "v1", label: "Classic", Comp: PortfolioV1 },
  { id: "v2", label: "Terminal", Comp: PortfolioV2 },
  { id: "v3", label: "Heatmap", Comp: PortfolioV3 },
  { id: "v4", label: "Allocation", Comp: PortfolioV4 },
  { id: "v5", label: "Highlights", Comp: PortfolioV5 },
];

/**
 * Demo Portfolio tab — a Design Lab for the portfolio page: flip through 5 distinct
 * layouts (Classic / Terminal / Heatmap / Allocation / Highlights), all on real data.
 */
export function PortfolioScreen() {
  const { data, setScreen } = useDemo();
  const [v, setV] = useState("v1");

  if (data.loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full rounded-full" />
        <Skeleton className="h-28 w-full rounded-2xl" />
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

  const Active = VARIATIONS.find((x) => x.id === v)?.Comp ?? PortfolioV1;

  return (
    <div className="space-y-4">
      <div className="demo-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {VARIATIONS.map((x, i) => (
          <Chip key={x.id} active={v === x.id} onClick={() => setV(x.id)}>
            {i + 1}. {x.label}
          </Chip>
        ))}
      </div>
      <Active />
    </div>
  );
}
