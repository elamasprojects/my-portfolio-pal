import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

/**
 * On a real phone → full-bleed (the device IS the phone).
 * On desktop → a centered ~390×844 device mock so the mobile design reads as a real app.
 */
export function PhoneBezel({ children }: { children: ReactNode }) {
  const realMobile = useIsMobile();

  if (realMobile) {
    return <div className="relative h-[100dvh] w-full overflow-hidden bg-background">{children}</div>;
  }

  return (
    <div className="flex justify-center py-6">
      <div className="relative h-[844px] max-h-[88vh] w-[390px] rounded-[3.2rem] bg-neutral-900 p-3 shadow-2xl ring-1 ring-black/40">
        {/* Dynamic-Island-style notch */}
        <div className="absolute left-1/2 top-3 z-30 h-7 w-32 -translate-x-1/2 rounded-full bg-black" />
        <div className="relative h-full w-full overflow-hidden rounded-[2.6rem] bg-background">{children}</div>
      </div>
    </div>
  );
}
