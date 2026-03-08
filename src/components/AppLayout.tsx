import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Inbox } from "@/components/Inbox";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center border-b border-border px-4 shrink-0">
            <SidebarTrigger className="text-muted-foreground" />
          </header>
          <main className="flex-1 overflow-auto p-4 md:p-6 relative">
            {/* Subtle chessboard pattern overlay */}
            <div
              className="pointer-events-none absolute inset-0 opacity-[0.02]"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, hsl(var(--foreground)) 25%, transparent 25%),
                  linear-gradient(-45deg, hsl(var(--foreground)) 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, hsl(var(--foreground)) 75%),
                  linear-gradient(-45deg, transparent 75%, hsl(var(--foreground)) 75%)
                `,
                backgroundSize: '60px 60px',
                backgroundPosition: '0 0, 0 30px, 30px -30px, -30px 0',
              }}
            />
            <div className="relative z-[1]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
