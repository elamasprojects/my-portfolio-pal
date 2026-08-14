import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { LayoutDashboard, ArrowLeftRight, Target, Plus } from "lucide-react";

interface ChessMobileNavProps {
  onOpenOmnibar: () => void;
}

const tabs = [
  { label: "Tablero", url: "/", icon: LayoutDashboard, exact: true },
  { label: "Movimientos", url: "/movements", icon: ArrowLeftRight, exact: false },
  { label: "Estrategia", url: "/strategy", icon: Target, exact: false },
];

export function ChessMobileNav({ onOpenOmnibar }: ChessMobileNavProps) {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md md:hidden">
      <div className="relative flex h-16 items-center justify-around rounded-3xl border border-border/30 bg-card/75 px-3 shadow-2xl backdrop-blur-lg">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? location.pathname === tab.url
            : location.pathname.startsWith(tab.url);

          return (
            <NavLink
              key={tab.url}
              to={tab.url}
              end={tab.exact}
              className={`relative z-10 flex h-full flex-1 flex-col items-center justify-center gap-1 transition-colors ${
                isActive ? "text-primary font-bold" : "text-muted-foreground/75"
              }`}
            >
              <tab.icon className="h-5 w-5 transition-transform active:scale-90" />
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </NavLink>
          );
        })}

        {/* Floating Quick Input Action Button */}
        <button
          type="button"
          onClick={onOpenOmnibar}
          aria-label="Registrar Movimiento"
          className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/30 bg-primary text-primary-foreground shadow-lg transition-transform active:scale-95"
        >
          <Plus className="h-6 w-6" />
        </button>
      </div>
    </nav>
  );
}
