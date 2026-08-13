import { useState } from "react";
import {
  TrendingDown,
  History,
  BarChart3,
  Tag,
  Plus,
  Menu,
  Wallet,
  Inbox,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTransactions } from "@/hooks/useFinance";

interface NavItem {
  title: string;
  url: string;
  icon: typeof History;
  end?: boolean;
}

const tabs: NavItem[] = [
  { title: "Flujo", url: "/finance", icon: TrendingDown, end: true },
  { title: "Timeline", url: "/finance/timeline", icon: History },
  { title: "Métricas", url: "/finance/analytics", icon: BarChart3 },
  { title: "Categorías", url: "/finance/categories", icon: Tag },
];

const moreItems: NavItem[] = [
  { title: "Medios de Pago", url: "/finance/payment-methods", icon: Wallet },
  { title: "Cola de Revisión", url: "/finance/review", icon: Inbox },
  { title: "Seguridad", url: "/security", icon: ShieldCheck },
  { title: "Configuración", url: "/settings", icon: Settings },
];

export function FinanceMobileNav({ onOpenQuickInput }: { onOpenQuickInput: () => void }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { reviewQueue } = useTransactions();

  const Tab = ({ item }: { item: NavItem }) => {
    const isActive = item.end
      ? location.pathname === item.url
      : location.pathname.startsWith(item.url);
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
        <span className="text-[10px] font-medium leading-none">{item.title}</span>
      </NavLink>
    );
  };

  return (
    <>
      {/* Top-right "More" menu button (mobile only) */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Más opciones"
        className="fixed right-3 top-3 z-50 flex h-11 w-11 items-center justify-center rounded-full border border-border/40 bg-card/80 text-foreground shadow-md backdrop-blur-md transition-transform active:scale-95 md:hidden"
      >
        <Menu className="h-5 w-5" />
        {reviewQueue.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-bold text-white">
            {reviewQueue.length}
          </span>
        )}
      </button>

      {/* Bottom nav: 4 tabs + center FAB = Add Movement */}
      <nav className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md md:hidden">
        <div className="relative flex h-16 items-center justify-between rounded-3xl border border-border/30 bg-card/65 px-2 shadow-lg backdrop-blur-md dark:bg-card/45">
          <Tab item={tabs[0]} />
          <Tab item={tabs[1]} />
          <div className="w-14 shrink-0" aria-hidden />
          <Tab item={tabs[2]} />
          <Tab item={tabs[3]} />

          {/* Center FAB = Add Expense/Income */}
          <button
            type="button"
            onClick={onOpenQuickInput}
            aria-label="Nuevo Movimiento"
            className="absolute left-1/2 top-0 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-950 text-white shadow-lg ring-4 ring-background transition-transform active:scale-95 hover:scale-105"
          >
            <Plus className="h-6 w-6" />
          </button>
        </div>
      </nav>

      {/* More Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-72 bg-card">
          <SheetHeader>
            <SheetTitle className="text-left font-serif text-lg text-primary">
              Finanzas Personales
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 flex flex-col gap-1">
            {moreItems.map((item) => {
              const isActive = location.pathname.startsWith(item.url);
              return (
                <NavLink
                  key={item.url}
                  to={item.url}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-muted-foreground hover:bg-accent/40 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  <span>{item.title}</span>
                  {item.url === "/finance/review" && reviewQueue.length > 0 && (
                    <span className="ml-auto rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-bold text-amber-500">
                      {reviewQueue.length} pendientes
                    </span>
                  )}
                </NavLink>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
