import { useState } from "react";
import { LayoutDashboard, Plus, History, BarChart3, Trophy, Crosshair, PieChart, Sparkles, Users, Settings, ShieldCheck } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage, TranslationKey } from "@/i18n";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const galleryItems: { titleKey: TranslationKey; url: string; icon: any }[] = [
  { titleKey: "nav.newMove", url: "/add", icon: Plus },
  { titleKey: "nav.progress", url: "/progress", icon: Trophy },
  { titleKey: "nav.strategy", url: "/strategy", icon: Crosshair },
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

  const isGalleryActive = galleryItems.some((item) => location.pathname === item.url);

  const getActiveIndex = () => {
    if (location.pathname === "/") return 0;
    if (location.pathname === "/analysis") return 1;
    if (location.pathname === "/trades") return 2;
    if (location.pathname === "/portfolio") return 3;
    return -1;
  };

  const activeIndex = getActiveIndex();

  const navItems = [
    { titleKey: "nav.board" as TranslationKey, url: "/", icon: LayoutDashboard },
    { titleKey: "nav.analysis" as TranslationKey, url: "/analysis", icon: BarChart3 },
    { titleKey: "nav.moveHistory" as TranslationKey, url: "/trades", icon: History },
    { titleKey: "nav.notation" as TranslationKey, url: "/portfolio", icon: PieChart },
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
        </div>

        {/* FAB Plus Button */}
        <button
          onClick={() => setOpen(true)}
          className={`shrink-0 h-16 w-16 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 duration-300 ${
            open || isGalleryActive
              ? "bg-primary text-primary-foreground ring-2 ring-primary ring-offset-2 ring-offset-background scale-105"
              : "bg-primary text-primary-foreground hover:bg-primary/95 hover:scale-105"
          }`}
        >
          <Plus className={`h-6 w-6 transition-transform duration-300 ${open ? 'rotate-45' : ''}`} />
        </button>
      </nav>

      {/* Bottom sheet menu */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-[2rem] border-t border-border/30 bg-background/80 dark:bg-background/90 backdrop-blur-lg px-6 pb-10 pt-4 max-h-[85vh] overflow-y-auto shadow-2xl fixed inset-x-0 bottom-0 max-w-md mx-auto"
        >
          {/* Bottom Sheet Handle Grabber */}
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full mx-auto mb-6" />

          <SheetHeader className="mb-6">
            <SheetTitle className="text-center text-xl font-bold tracking-tight">{t("nav.more")}</SheetTitle>
          </SheetHeader>

          <div className="grid grid-cols-3 gap-4">
            {galleryItems.map((item) => {
              const isActive = location.pathname === item.url;
              return (
                <button
                  key={item.titleKey}
                  onClick={() => {
                    navigate(item.url);
                    setOpen(false);
                  }}
                  className={`group flex flex-col items-center justify-center p-4 rounded-2xl border transition-all duration-300 gap-2.5 active:scale-95 ${
                    isActive
                      ? "bg-primary/10 border-primary/25 text-primary shadow-sm"
                      : "bg-card/45 hover:bg-card/75 border-border/10 hover:border-border/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <div className={`p-3 rounded-xl transition-all duration-300 ${
                    isActive
                      ? 'bg-primary/20 text-primary scale-110'
                      : 'bg-secondary/40 group-hover:bg-secondary/60 text-muted-foreground group-hover:text-foreground'
                  }`}>
                    <item.icon className="h-6 w-6" />
                  </div>
                  <span className="text-xs font-semibold text-center leading-tight transition-colors duration-200">
                    {t(item.titleKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
