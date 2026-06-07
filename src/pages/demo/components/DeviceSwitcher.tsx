import { Monitor, Smartphone, Watch } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DeviceKind } from "../data/types";

const OPTIONS: { kind: DeviceKind; label: string; Icon: typeof Monitor }[] = [
  { kind: "desktop", label: "Desktop", Icon: Monitor },
  { kind: "phone", label: "Phone", Icon: Smartphone },
  { kind: "watch", label: "Watch", Icon: Watch },
];

export function DeviceSwitcher({
  device,
  onChange,
  className,
}: {
  device: DeviceKind;
  onChange: (d: DeviceKind) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-card/80 p-1 backdrop-blur",
        className,
      )}
      role="tablist"
      aria-label="Device preview"
    >
      {OPTIONS.map(({ kind, label, Icon }) => {
        const active = device === kind;
        return (
          <button
            key={kind}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(kind)}
            className={cn(
              "inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors",
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
