import { LayoutDashboard, Plus, List, BarChart3, Trophy, Crosshair } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLanguage, TranslationKey } from "@/i18n";

const items: { titleKey: TranslationKey; url: string; icon: any }[] = [
  { titleKey: "nav.board", url: "/", icon: LayoutDashboard },
  { titleKey: "nav.newMove", url: "/add", icon: Plus },
  { titleKey: "nav.moveHistory", url: "/trades", icon: List },
  { titleKey: "nav.analysis", url: "/analysis", icon: BarChart3 },
  { titleKey: "nav.progress", url: "/progress", icon: Trophy },
  { titleKey: "nav.strategy", url: "/strategy", icon: Crosshair },
];

export function MobileNav() {
  const { t } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-around h-14">
        {items.map((item) => {
          const useEnd = item.url === "/";
          return (
            <NavLink
              key={item.titleKey}
              to={item.url}
              end={useEnd}
              className="flex flex-col items-center gap-0.5 px-2 py-1.5 text-muted-foreground transition-colors"
              activeClassName="text-primary"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] leading-tight">{t(item.titleKey)}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
