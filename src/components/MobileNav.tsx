import { useState } from "react";
import {
  LayoutDashboard,
  Plus,
  History,
  BarChart3,
  PieChart,
  Menu,
  Trophy,
  Crosshair,
  Sparkles,
  Users,
  Settings,
  ShieldCheck,
  Bell,
  Eye,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate, useLocation } from "react-router-dom";
import { useLanguage, TranslationKey } from "@/i18n";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

type NavItem = { titleKey: TranslationKey; url: string; icon: typeof History; end?: boolean };

// Primary bottom-nav tabs (the center FAB is Add Trade).
const tabs: NavItem[] = [
  { titleKey: "nav.board", url: "/", icon: LayoutDashboard, end: true },
  { titleKey: "nav.moveHistory", url: "/trades", icon: History },
  { titleKey: "nav.analysis", url: "/analysis", icon: BarChart3 },
  { titleKey: "nav.notation", url: "/portfolio", icon: PieChart },
];

// Everything else lives in the top-right "More" menu.
const moreItems: NavItem[] = [
  { titleKey: "nav.progress", url: "/progress", icon: Trophy },
  { titleKey: "nav.strategy", url: "/strategy", icon: Crosshair },
  { titleKey: "nav.chess", url: "/chess", icon: Sparkles },
  { titleKey: "nav.players", url: "/players", icon: Users },
  { titleKey: "nav.alerts", url: "/alerts", icon: Bell },
  { titleKey: "nav.watchlist", url: "/watchlist", icon: Eye },
  { titleKey: "nav.security", url: "/security", icon: ShieldCheck },
  { titleKey: "nav.settings", url: "/settings", icon: Settings },
];

export function MobileNav() {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const Tab = ({ item }: { item: NavItem }) => {
    const isActive = item.end ? location.pathname === item.url : location.pathname.startsWith(item.url);
    return (
      <NavLink
        to={item.url}
        end={item.end}
        className={`relative z-10 flex h-full flex-1 flex-col items-center justify-center gap-0.5 rounded-full transition-colors ${
          isActive ? "text-primary font-medium" : "text-muted-foreground/75"
        }`}
        activeClassName="text-primary font-medium"
      >
        <item.icon className="h-5 w-5 transition-transform active:scale-90" />
        <span className="text-[10px] font-medium leading-none">{t(item.titleKey)}</span>
      </NavLink>
    );
  };

  return (
    <>
      {/* Top-right "More" menu button (mobile only) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("nav.more")}
        className="fixed right-3 top-3 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-border/40 bg-card/80 text-foreground shadow-md backdrop-blur-md transition-transform active:scale-95 md:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Bottom nav: 4 tabs + center FAB = Add Trade */}
      <nav className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md md:hidden">
        <div className="relative flex h-16 items-center justify-between rounded-3xl border border-border/30 bg-card/65 px-2 shadow-lg backdrop-blur-md dark:bg-card/45">
          <Tab item={tabs[0]} />
          <Tab item={tabs[1]} />
          <div className="w-14 shrink-0" aria-hidden />
          <Tab item={tabs[2]} />
          <Tab item={tabs[3]} />

          {/* Center FAB = Add Trade (dark gradient) */}
          <button
            type="button"
            onClick={() => navigate("/add")}
            aria-label={t("nav.newMove")}
            className="absolute left-1/2 top-0 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-zinc-800 via-zinc-900 to-black text-primary shadow-lg ring-4 ring-background transition-transform active:scale-95"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </nav>

      {/* More sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="bottom"
          className="fixed inset-x-0 bottom-0 mx-auto max-h-[85vh] max-w-md overflow-y-auto rounded-t-[2rem] border-t border-border/30 bg-background/80 px-6 pb-10 pt-4 shadow-2xl backdrop-blur-lg dark:bg-background/90"
        >
          <div className="mx-auto mb-6 h-1 w-12 rounded-full bg-muted-foreground/30" />
          <SheetHeader className="mb-6">
            <SheetTitle className="text-center text-xl font-bold tracking-tight">{t("nav.more")}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-3 gap-4">
            {moreItems.map((item) => {
              const isActive = location.pathname === item.url;
              return (
                <button
                  key={item.titleKey}
                  onClick={() => {
                    navigate(item.url);
                    setOpen(false);
                  }}
                  className={`group flex flex-col items-center justify-center gap-2.5 rounded-2xl border p-4 transition-all duration-300 active:scale-95 ${
                    isActive
                      ? "border-primary/25 bg-primary/10 text-primary shadow-sm"
                      : "border-border/10 bg-card/45 text-muted-foreground hover:border-border/30 hover:bg-card/75 hover:text-foreground"
                  }`}
                >
                  <div
                    className={`rounded-xl p-3 transition-all duration-300 ${
                      isActive
                        ? "scale-110 bg-primary/20 text-primary"
                        : "bg-secondary/40 text-muted-foreground group-hover:bg-secondary/60 group-hover:text-foreground"
                    }`}
                  >
                    <item.icon className="h-6 w-6" />
                  </div>
                  <span className="text-center text-xs font-semibold leading-tight">{t(item.titleKey)}</span>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
