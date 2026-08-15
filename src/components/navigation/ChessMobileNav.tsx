import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { TrendingUp, ArrowLeftRight, Target, Landmark, Plus } from "lucide-react";

interface ChessMobileNavProps {
  onOpenOmnibar?: () => void;
}

const leftTabs = [
  { label: "Inversiones", url: "/", icon: TrendingUp, exact: true },
  { label: "Estrategia", url: "/strategy", icon: Target, exact: false },
];

const rightTabs = [
  { label: "Movimientos", url: "/movements", icon: ArrowLeftRight, exact: false },
  { label: "Finanzas", url: "/finance", icon: Landmark, exact: false },
];

export function ChessMobileNav({ onOpenOmnibar }: ChessMobileNavProps) {
  const location = useLocation();

  const renderTab = (tab: { label: string; url: string; icon: any; exact: boolean }) => {
    const isActive = tab.exact
      ? location.pathname === tab.url
      : location.pathname.startsWith(tab.url);

    return (
      <NavLink
        key={tab.url}
        to={tab.url}
        end={tab.exact}
        className={`relative flex h-full flex-1 flex-col items-center justify-center py-1 rounded-xl transition-all duration-150 ${
          isActive
            ? "text-primary font-bold bg-primary/10"
            : "text-muted-foreground/75 hover:text-foreground active:scale-95"
        }`}
      >
        <tab.icon className={`h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} />
        <span className="text-[10px] font-semibold tracking-tight mt-1 leading-none text-center truncate max-w-full px-1">
          {tab.label}
        </span>
      </NavLink>
    );
  };

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg md:hidden">
      <div className="relative flex h-16 items-center justify-between rounded-2xl border border-border/50 bg-card/95 px-2 shadow-2xl backdrop-blur-xl">
        {/* Left Tabs: Inversiones & Estrategia */}
        <div className="flex flex-1 items-center justify-around h-full gap-1">
          {leftTabs.map(renderTab)}
        </div>

        {/* Center Prominent Add (+) Button */}
        <div className="flex items-center justify-center px-2 shrink-0">
          <button
            type="button"
            onClick={onOpenOmnibar}
            aria-label="Registrar Movimiento"
            className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg border-2 border-background ring-2 ring-primary/30 transition-transform active:scale-90 hover:scale-105"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>
        </div>

        {/* Right Tabs: Movimientos & Finanzas */}
        <div className="flex flex-1 items-center justify-around h-full gap-1">
          {rightTabs.map(renderTab)}
        </div>
      </div>
    </nav>
  );
}
