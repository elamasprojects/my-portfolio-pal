import { useState } from "react";
import { LayoutDashboard, Plus, List, BarChart3, Menu, Trophy, Crosshair, PieChart, Sparkles, Users, Settings, ShieldCheck } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage, TranslationKey } from "@/i18n";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const mainItems: { titleKey: TranslationKey; url: string; icon: any }[] = [
  { titleKey: "nav.newMove", url: "/add", icon: Plus },
  { titleKey: "nav.board", url: "/", icon: LayoutDashboard },
  { titleKey: "nav.analysis", url: "/analysis", icon: BarChart3 },
  { titleKey: "nav.moveHistory", url: "/trades", icon: List },
];

const moreItems: { titleKey: TranslationKey; url: string; icon: any }[] = [
  { titleKey: "nav.progress", url: "/progress", icon: Trophy },
  { titleKey: "nav.strategy", url: "/strategy", icon: Crosshair },
  { titleKey: "nav.notation", url: "/export", icon: PieChart },
  { titleKey: "nav.chess", url: "/chess", icon: Sparkles },
  { titleKey: "nav.players", url: "/players", icon: Users },
  { titleKey: "nav.settings", url: "/settings", icon: Settings },
];

export function MobileNav() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isMoreActive = moreItems.some((item) => location.pathname === item.url);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="flex items-center justify-around h-14">
          {/* Ver Más button */}
          <button
            onClick={() => setOpen(true)}
            className={`flex flex-col items-center gap-0.5 px-2 py-1.5 transition-colors ${
              isMoreActive ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Menu className="h-5 w-5" />
            <span className="text-[10px] leading-tight">{t("nav.more")}</span>
          </button>

          {/* Main nav items */}
          {mainItems.map((item) => {
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

      {/* More drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle>{t("nav.more")}</SheetTitle>
          </SheetHeader>
          <nav className="flex flex-col gap-1 mt-4">
            {moreItems.map((item) => {
              const isActive = location.pathname === item.url;
              return (
                <button
                  key={item.titleKey}
                  onClick={() => {
                    navigate(item.url);
                    setOpen(false);
                  }}
                  className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                  <span>{t(item.titleKey)}</span>
                </button>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}
