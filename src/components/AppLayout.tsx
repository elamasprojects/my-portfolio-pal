import { ReactNode, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { ChessNavbar } from "@/components/navigation/ChessNavbar";
import { ChessMobileNav } from "@/components/navigation/ChessMobileNav";
import { OmnibarFinance } from "@/components/finance/OmnibarFinance";
import { useShareTargetListener, SharedData } from "@/hooks/useShareTargetListener";

export function AppLayout({ children }: { children: ReactNode }) {
  const [omnibarOpen, setOmnibarOpen] = useState(false);
  const [sharedText, setSharedText] = useState<string | undefined>();
  const [sharedFile, setSharedFile] = useState<File | null>(null);
  const location = useLocation();

  // Reset scroll to top on route change to prevent viewport jumping
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);

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
    <div className="min-h-screen flex flex-col w-full bg-background text-foreground">
      {/* Top 3-View Chess Spanish Navbar */}
      <ChessNavbar onOpenOmnibar={() => setOmnibarOpen(true)} />

      {/* Main Content Viewport */}
      <main className="flex-1 mx-auto w-full max-w-7xl p-4 md:p-6 pb-32 md:pb-8">
        {children}
      </main>

      {/* Mobile 3-View Bottom Nav */}
      <ChessMobileNav onOpenOmnibar={() => setOmnibarOpen(true)} />

      {/* Global Natural-Language Omnibar */}
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
  );
}

export default AppLayout;
