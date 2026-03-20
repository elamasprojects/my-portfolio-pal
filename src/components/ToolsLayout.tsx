import { Link, Outlet, useLocation } from "react-router-dom";
import { ChessKnight } from "@/components/ChessKnight";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { to: "/tools/risk-profile", key: "tools.nav.riskProfile" },
  { to: "/tools/compound", key: "tools.nav.compound" },
  { to: "/tools/dca", key: "tools.nav.dca" },
] as const;

export default function ToolsLayout() {
  const { t } = useLanguage();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-14">
          <Link to="/tools" className="flex items-center gap-2">
            <ChessKnight className="h-6 w-6 text-primary" />
            <span className="font-serif text-xl font-bold">Chess</span>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map(({ to, key }) => (
              <Link
                key={to}
                to={to}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
                  location.pathname === to
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(key as any)}
              </Link>
            ))}
          </nav>

          <Button size="sm" asChild>
            <Link to="/auth">{t("tools.nav.signUp" as any)}</Link>
          </Button>
        </div>

        {/* Mobile nav */}
        <div className="sm:hidden flex items-center gap-1 px-4 pb-2 overflow-x-auto">
          {NAV_LINKS.map(({ to, key }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors",
                location.pathname === to
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t(key as any)}
            </Link>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-6 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <ChessKnight className="h-4 w-4" />
            <span>© {new Date().getFullYear()} Chess</span>
          </div>
          <div className="flex gap-4 text-sm">
            <Link to="/landing" className="text-muted-foreground hover:text-foreground transition-colors">
              {t("tools.footer.about" as any)}
            </Link>
            <Link to="/auth" className="text-muted-foreground hover:text-foreground transition-colors">
              {t("tools.footer.login" as any)}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
