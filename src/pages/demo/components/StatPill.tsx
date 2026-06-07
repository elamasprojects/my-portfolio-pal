import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatPill({
  positive,
  children,
  className,
}: {
  positive: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs font-semibold",
        positive ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss",
        className,
      )}
    >
      {children}
    </span>
  );
}
