import type { ReactNode } from "react";

/**
 * Pixel Watch 4 (45mm): 1.4" round AMOLED, 320ppi → 456×456 logical px.
 * The WatchScreen is designed at a true 456×456 box and scaled to fit the round display.
 */
const LOGICAL = 456;
const DISPLAY = 228; // rendered size on screen
const SCALE = DISPLAY / LOGICAL;

export function WatchBezel({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-10">
      <div className="relative h-[300px] w-[284px] rounded-[42%] bg-neutral-900 shadow-2xl ring-1 ring-black/50">
        {/* crown */}
        <div className="absolute right-[-5px] top-1/2 h-12 w-2.5 -translate-y-1/2 rounded-full bg-neutral-700" />
        {/* side button */}
        <div className="absolute right-[-3px] top-[34%] h-6 w-1.5 -translate-y-1/2 rounded-full bg-neutral-700/80" />
        {/* round display */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-full bg-black"
          style={{ height: DISPLAY, width: DISPLAY }}>
          <div className="origin-top-left" style={{ width: LOGICAL, height: LOGICAL, transform: `scale(${SCALE})` }}>
            {children}
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">Pixel Watch 4 · 45 mm · Wear OS</p>
    </div>
  );
}
