import { LayoutDashboard, Plus, History, LogOut, Moon, Sun, BarChart3, Trophy, PieChart, Sparkles, Globe, Users, Settings, PanelLeftClose, PanelLeft, Crosshair, ShieldCheck } from "lucide-react";
import { Inbox } from "@/components/Inbox";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useLanguage, TranslationKey } from "@/i18n";
import { useProfile } from "@/hooks/useProfile";
import { PortfolioSwitcher } from "@/components/PortfolioSwitcher";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
  DropdownSeparator,
} from "@/components/ui/basic-dropdown";

const navItems: { titleKey: TranslationKey; url: string; icon: any }[] = [
  { titleKey: "nav.board", url: "/", icon: LayoutDashboard },
  { titleKey: "nav.newMove", url: "/add", icon: Plus },
  { titleKey: "nav.moveHistory", url: "/trades", icon: History },
  { titleKey: "nav.analysis", url: "/analysis", icon: BarChart3 },
  { titleKey: "nav.progress", url: "/progress", icon: Trophy },
  { titleKey: "nav.notation", url: "/export", icon: PieChart },
  { titleKey: "nav.strategy", url: "/strategy", icon: Crosshair },
  { titleKey: "nav.chess", url: "/chess", icon: Sparkles },
  { titleKey: "nav.players", url: "/players", icon: Users },
  { titleKey: "nav.security", url: "/security", icon: ShieldCheck },
];

export function AppSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { t, language, setLanguage } = useLanguage();
  const { profile } = useProfile();

  const initials = (profile?.username || profile?.display_name || "U").slice(0, 2).toUpperCase();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-2">
        <button
          onClick={() => toggleSidebar()}
          className="flex items-center justify-center w-full rounded-md p-2 hover:bg-sidebar-accent text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </SidebarHeader>
      <SidebarContent>
        <PortfolioSwitcher />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const useEnd = item.url === "/" || !item.url.match(/^\/(add|analysis|progress)$/);
                return (
                <SidebarMenuItem key={item.titleKey}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={useEnd}
                      className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      activeClassName="bg-sidebar-accent text-sidebar-primary font-medium border-l-2 border-sidebar-primary"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{t(item.titleKey)}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className={`flex items-center gap-2 ${collapsed ? "flex-col" : "flex-row justify-between"}`}>
          <Inbox />
          <Dropdown>
            <DropdownTrigger className={collapsed ? "" : "flex-1"}>
              <div className="flex items-center justify-center w-full rounded-lg px-2 py-1.5 hover:bg-sidebar-accent transition-colors cursor-pointer">
                <Avatar className="h-8 w-8">
                  {profile?.avatar_url && <AvatarImage src={profile.avatar_url} />}
                  <AvatarFallback className="text-xs bg-primary/10 text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            </DropdownTrigger>
          <DropdownContent placement="top" align="start" sideOffset={2} className="w-56">
            {/* Language */}
            <DropdownItem
              onClick={() => setLanguage(language === "en" ? "es" : "en")}
            >
              <Globe className="h-4 w-4" />
              <span className="flex-1">{t("profile.language")}</span>
              <span className="text-xs text-muted-foreground">
                {language === "en" ? "EN" : "ES"}
              </span>
            </DropdownItem>

            {/* Theme */}
            <DropdownItem onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span className="flex-1">{t("profile.theme")}</span>
              <span className="text-xs text-muted-foreground">
                {theme === "dark" ? t("profile.lightMode") : t("profile.darkMode")}
              </span>
            </DropdownItem>

            <DropdownSeparator />

            {/* Settings */}
            <DropdownItem onClick={() => navigate('/settings')}>
              <Settings className="h-4 w-4" />
              {t("nav.settings")}
            </DropdownItem>

            <DropdownSeparator />

            {/* Sign Out */}
            <DropdownItem onClick={signOut} destructive>
              <LogOut className="h-4 w-4" />
              {t("profile.signOut")}
            </DropdownItem>
          </DropdownContent>
          </Dropdown>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
