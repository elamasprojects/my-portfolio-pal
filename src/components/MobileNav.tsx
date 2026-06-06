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

const moreItems: { titleKey: TranslationKey; url: string; icon: any }[] = [
  { titleKey: "nav.progress", url: "/progress", icon: Trophy },
  { titleKey: "nav.strategy", url: "/strategy", icon: Crosshair },
  { titleKey: "nav.notation", url: "/export", icon: PieChart },
  { titleKey: "nav.chess", url: "/chess", icon: Sparkles },
  { titleKey: "nav.players", url: "/players", icon: Users },
  { titleKey: "nav.security", url: "/security", icon: ShieldCheck },
  { titleKey: "nav.settings", url: "/settings", icon: Settings },
];

export function MobileNav() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isMoreActive = moreItems.some((item) => location.pathname === item.url);

  const getActiveIndex = () => {
    if (location.pathname === "/") return 0;
    if (location.pathname === "/analysis") return 1;
    if (location.pathname === "/trades") return 2;
    if (isMoreActive) return 3;
    return -1;
  };

  const activeIndex = getActiveIndex();

  const navItems = [
    { titleKey: "nav.board" as TranslationKey, url: "/", icon: LayoutDashboard },
    { titleKey: "nav.analysis" as TranslationKey, url: "/analysis", icon: BarChart3 },
    { titleKey: "nav.moveHistory" as TranslationKey, url: "/trades", icon: List },
  ];

  return (
    <>
      <nav className="fixed bottom-4 left-4 right-4 z-50 md:hidden flex items-center justify-between gap-3 max-w-md mx-auto">
        {/* Navbar Capsule */}
        <div className="relative flex-1 flex items-center h-16 rounded-full border border-border/30 bg-card/65 dark:bg-card/45 backdrop-blur-md px-1.5 shadow-lg select-none">
          {/* Sliding Active Indicator Wrapper */}
          <div
            className="absolute top-1.5 bottom-1.5 left-0 w-1/4 px-1.5 transition-transform duration-300 ease-out pointer-events-none"
            style={{
              transform: `translateX(${activeIndex * 100}%)`,
              opacity: activeIndex === -1 ? 0 : 1,
            }}
          >
            <div className="w-full h-full rounded-full bg-primary/10 dark:bg-primary/20 border border-primary/15 dark:border-primary/30 shadow-inner" />
          </div>

          {/* Nav Items */}
          {navItems.map((item) => {
            const isActive = location.pathname === item.url;
            return (
              <NavLink
                key={item.titleKey}
                to={item.url}
                end={item.url === "/"}
                className={`relative z-10 flex-1 flex flex-col items-center justify-center gap-0.5 h-full rounded-full transition-colors ${
                  isActive ? "text-primary font-medium" : "text-muted-foreground/75"
                }`}
                activeClassName="text-primary font-medium"
              >
                <item.icon className="h-5 w-5 transition-transform duration-200 active:scale-90" />
                <span className="text-[10px] font-medium leading-none">{t(item.titleKey)}</span>
              </NavLink>
            );
          })}

          {/* Ver más (More) Item */}
          <button
            onClick={() => setOpen(true)}
            className={`relative z-10 flex-1 flex flex-col items-center justify-center gap-0.5 h-full rounded-full transition-colors ${
              isMoreActive ? "text-primary font-medium" : "text-muted-foreground/75"
            }`}
          >
            <Menu className="h-5 w-5 transition-transform duration-200 active:scale-90" />
            <span className="text-[10px] font-medium leading-none">{t("nav.more")}</span>
          </button>
        </div>

        {/* FAB Plus Button */}
        <button
          onClick={() => navigate("/add")}
          className={`shrink-0 h-16 w-16 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 duration-200 ${
            location.pathname === "/add"
              ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
              : "bg-primary text-primary-foreground hover:bg-primary/95"
          }`}
        >
          <Plus className="h-6 w-6" />
        </button>
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
