import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "gain" | "loss";

export function MetricTile({
  label,
  value,
  sub,
  tone = "neutral",
  icon: Icon,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  icon?: LucideIcon;
  className?: string;
}) {
  const valueColor = tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-foreground";
  const iconWrap =
    tone === "gain" ? "bg-gain/10 text-gain" : tone === "loss" ? "bg-loss/10 text-loss" : "bg-primary/10 text-primary";
  return (
    <div className={cn("rounded-xl border bg-card p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className={cn("mt-1 font-mono text-xl font-bold", valueColor)}>{value}</p>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {Icon && (
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconWrap)}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
    </div>
  );
}
