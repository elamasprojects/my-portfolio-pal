import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { TrendingUp, ArrowLeftRight, Target, Landmark } from "lucide-react";
import { motion } from "motion/react";

interface ChessMobileNavProps {
  onOpenOmnibar?: () => void;
}

const tabs = [
  { label: "Inversiones", url: "/", icon: TrendingUp, exact: true },
  { label: "Estrategia", url: "/strategy", icon: Target, exact: false },
  { label: "Movimientos", url: "/movements", icon: ArrowLeftRight, exact: false },
  { label: "Finanzas", url: "/finance", icon: Landmark, exact: false },
];

export function ChessMobileNav({ onOpenOmnibar }: ChessMobileNavProps) {
  const location = useLocation();

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-lg md:hidden">
      <div className="relative flex h-16 items-center justify-between rounded-2xl border border-border/40 bg-card/90 px-1.5 shadow-2xl backdrop-blur-xl">
        {tabs.map((tab) => {
          const isActive = tab.exact
            ? location.pathname === tab.url
            : location.pathname.startsWith(tab.url);

          return (
            <NavLink
              key={tab.url}
              to={tab.url}
              end={tab.exact}
              className={`relative flex h-full flex-1 flex-col items-center justify-center py-1 rounded-xl transition-all duration-200 ${
                isActive
                  ? "text-primary font-bold"
                  : "text-muted-foreground/75 hover:text-foreground active:scale-95"
              }`}
            >
              {isActive && (
                <motion.div
                  layoutId="mobile-active-tab-glow"
                  className="absolute inset-1 rounded-xl bg-primary/10 border border-primary/20"
                  transition={{ type: "spring", stiffness: 450, damping: 35 }}
                />
              )}
              <tab.icon className={`relative z-10 h-5 w-5 transition-transform ${isActive ? "scale-110" : ""}`} />
              <span className="relative z-10 text-[10px] font-semibold tracking-tight mt-1 leading-none text-center truncate max-w-full px-1">
                {tab.label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
