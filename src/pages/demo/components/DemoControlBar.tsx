import { CurrencyToggle } from "@/components/CurrencyToggle";
import { cn } from "@/lib/utils";
import { useDemo } from "../DemoContext";
import { DeviceSwitcher } from "./DeviceSwitcher";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Floating control dock (bottom-center): device switch + currency + theme.
 * Visible on desktop for any device; on a real phone it appears only in Watch mode
 * (so you can switch back) — otherwise the phone uses its own in-frame controls.
 */
export function DemoControlBar() {
  const { device, setDevice, currency, setCurrency } = useDemo();
  return (
    <div
      className={cn(
        "fixed bottom-4 left-1/2 z-50 -translate-x-1/2 items-center gap-2 rounded-full border bg-card/90 p-1.5 pl-3 shadow-xl backdrop-blur",
        device === "watch" ? "flex" : "hidden md:flex",
      )}
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prototype</span>
      <span className="mx-1 h-5 w-px bg-border" />
      <DeviceSwitcher device={device} onChange={setDevice} />
      <CurrencyToggle value={currency} onChange={setCurrency} />
      <ThemeToggle />
    </div>
  );
}
