import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import { useDemo } from "../DemoContext";
import { SCREEN_TITLES } from "../data/screens";
import { DeviceSwitcher } from "./DeviceSwitcher";
import { ThemeToggle } from "./ThemeToggle";

/** Phone-frame header: title + currency + an in-frame controls panel (device + theme). */
export function DemoTopBar() {
  const { screen, currency, setCurrency, device, setDevice } = useDemo();
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-20 border-b border-border/50 bg-background/90 px-4 pb-3 pt-[max(1.4rem,env(safe-area-inset-top))] backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <h1 className="truncate text-lg font-bold">{SCREEN_TITLES[screen]}</h1>
        <div className="flex items-center gap-2">
          <CurrencyToggle value={currency} onChange={setCurrency} />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Preview controls"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {open && (
        <>
          <button className="absolute inset-0 z-10 cursor-default" aria-hidden onClick={() => setOpen(false)} />
          <div className="absolute right-3 top-full z-20 mt-1 flex flex-col gap-3 rounded-2xl border bg-popover p-3 shadow-xl">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Device</p>
              <DeviceSwitcher device={device} onChange={setDevice} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Theme</p>
              <ThemeToggle />
            </div>
          </div>
        </>
      )}
    </header>
  );
}
