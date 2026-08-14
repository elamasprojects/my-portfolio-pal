import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  TrendingUp,
  ArrowLeftRight,
  Target,
  Landmark,
  Search,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "@/components/ui/basic-dropdown";
import { ChessKnight } from "@/components/ChessKnight";
import { motion } from "motion/react";

interface ChessNavbarProps {
  onOpenOmnibar: () => void;
}

const navItems = [
  { label: "Inversiones", url: "/", icon: TrendingUp, exact: true },
  { label: "Estrategia", url: "/strategy", icon: Target, exact: false },
  { label: "Movimientos", url: "/movements", icon: ArrowLeftRight, exact: false },
  { label: "Finanzas", url: "/finance", icon: Landmark, exact: false },
];

export function ChessNavbar({ onOpenOmnibar }: ChessNavbarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { venta: mepRate } = useDolarMEP();
  const { signOut } = useAuth();
  const { profile } = useProfile();

  const initials = (profile?.username || profile?.display_name || "U").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/40 bg-background/80 px-4 md:px-8 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4">
        {/* Brand & Logo */}
        <div
          onClick={() => navigate("/")}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary transition-transform group-hover:scale-105">
            <ChessKnight className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-serif text-lg font-bold tracking-tight text-foreground">
                CHESS
              </span>
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-mono font-bold text-primary">
                2.0
              </span>
            </div>
            <p className="text-[10px] font-mono text-muted-foreground hidden sm:block">
              Decision Auditing System
            </p>
          </div>
        </div>

        {/* Primary 3-Tab Spanish Navigation */}
        <nav className="hidden md:flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/40 p-1.5 backdrop-blur-md">
          {navItems.map((item) => {
            const isActive = item.exact
              ? location.pathname === item.url
              : location.pathname.startsWith(item.url);

            return (
              <NavLink
                key={item.url}
                to={item.url}
                end={item.exact}
                className={`relative z-10 flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-primary-foreground font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="chess-navbar-pill"
                    className="absolute inset-0 rounded-full bg-primary shadow-sm"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-20 flex items-center gap-2">
                  <item.icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </span>
              </NavLink>
            );
          })}
        </nav>

        {/* Market Rates, Fast Actions & User Menu */}
        <div className="flex items-center gap-3">
          {/* Live Dolar MEP Pill */}
          {mepRate > 0 && (
            <div className="hidden lg:flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-3 py-1 text-xs font-mono">
              <span className="text-[10px] text-muted-foreground font-sans">MEP:</span>
              <span className="font-bold text-foreground">${mepRate.toFixed(2)}</span>
            </div>
          )}

          {/* Omnibar Quick Trigger (⌘K) */}
          <Button
            variant="outline"
            size="sm"
            onClick={onOpenOmnibar}
            className="flex items-center gap-2 h-9 text-xs font-mono text-muted-foreground rounded-full px-3.5 border-border/40 hover:bg-muted/60"
          >
            <Search className="h-3.5 w-3.5 text-primary" />
            <span className="hidden sm:inline">Buscar / Registrar...</span>
            <kbd className="hidden sm:inline-block rounded border border-border/60 bg-muted px-1.5 py-0.5 text-[10px] font-sans">
              ⌘K
            </kbd>
          </Button>

          {/* User Profile Menu */}
          <Dropdown>
            <DropdownTrigger>
              <div className="flex items-center justify-center rounded-full p-1 hover:bg-muted transition-colors cursor-pointer">
                <Avatar className="h-8 w-8 border border-border/40">
                  {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                  <AvatarFallback className="text-xs bg-primary/10 text-primary font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            </DropdownTrigger>
            <DropdownContent placement="bottom" align="end" sideOffset={8} className="w-48">
              <div className="px-3 py-2 border-b border-border/40">
                <p className="text-xs font-semibold text-foreground truncate">
                  {profile?.display_name || profile?.username || "Usuario Chess"}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">
                  Modo Auditoría Único
                </p>
              </div>
              <DropdownItem onClick={signOut} destructive className="mt-1">
                <LogOut className="h-4 w-4 mr-2" />
                Cerrar Sesión
              </DropdownItem>
            </DropdownContent>
          </Dropdown>
        </div>
      </div>
    </header>
  );
}
