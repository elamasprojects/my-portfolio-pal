import { ReactNode, useState, useEffect } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { FinanceMobileNav } from "@/components/navigation/FinanceMobileNav";
import { ModeSwitcher } from "@/components/navigation/ModeSwitcher";
import { useAppMode } from "@/hooks/useAppMode";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { OmnibarFinance } from "@/components/finance/OmnibarFinance";
import { Button } from "@/components/ui/button";
import { Search, Sparkles } from "lucide-react";

import { useShareTargetListener, SharedData } from "@/hooks/useShareTargetListener";

export function AppLayout({ children }: { children: ReactNode }) {
  const { mode } = useAppMode();
  const { mepRate, isLoading: mepLoading } = useDolarMEP();
  const [omnibarOpen, setOmnibarOpen] = useState(false);
  const [sharedText, setSharedText] = useState<string | undefined>();
  const [sharedFile, setSharedFile] = useState<File | null>(null);

  // PWA Share Target Listener
  useShareTargetListener((data: SharedData) => {
    if (data.text) setSharedText(data.text);
    if (data.files && data.files.length > 0) setSharedFile(data.files[0]);
    setOmnibarOpen(true);
  });

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOmnibarOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Global Top Bar */}
          <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/40 bg-background/80 px-4 md:px-6 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="hidden md:flex" />
              <ModeSwitcher />
            </div>

            <div className="flex items-center gap-2.5">
              {/* Dolar MEP Live Pill */}
              {mepRate && (
                <div className="hidden sm:flex items-center gap-1.5 rounded-full border border-border/40 bg-muted/30 px-2.5 py-1 text-xs font-mono">
                  <span className="text-[10px] text-muted-foreground font-sans">MEP:</span>
                  <span className="font-bold text-foreground">${mepRate.toFixed(2)}</span>
                </div>
              )}

              {/* Omnibar Quick Trigger */}
              <Button
                variant="outline"
                size="sm"
                className="hidden sm:flex items-center gap-2 h-8 text-xs font-mono text-muted-foreground rounded-full px-3"
                onClick={() => setOmnibarOpen(true)}
              >
                <Search className="h-3.5 w-3.5" />
                <span>Buscar / Registrar...</span>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-sans">⌘K</kbd>
              </Button>
            </div>
          </header>

          {/* Main Content Viewport */}
          <main className="flex-1 overflow-auto p-4 md:p-6 pb-24 md:pb-8">
            {children}
          </main>
        </div>

        {/* Contextual Mobile Bottom Nav */}
        {mode === "finance" ? (
          <FinanceMobileNav onOpenQuickInput={() => setOmnibarOpen(true)} />
        ) : (
          <MobileNav />
        )}

        {/* Global Omnibar */}
        <OmnibarFinance
          open={omnibarOpen}
          onOpenChange={(v) => {
            setOmnibarOpen(v);
            if (!v) {
              setSharedText(undefined);
              setSharedFile(null);
            }
          }}
          initialText={sharedText}
          initialFile={sharedFile}
        />
      </div>
    </SidebarProvider>
  );
}
