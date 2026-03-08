import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { LanguageProvider } from "@/i18n";
import { AppLayout } from "@/components/AppLayout";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AddTrade from "./pages/AddTrade";
import TradeLog from "./pages/TradeLog";
import AssetDetail from "./pages/AssetDetail";
import ImportTrades from "./pages/ImportTrades";
import Performance from "./pages/Performance";
import Timeline from "./pages/Timeline";
import ReportCard from "./pages/ReportCard";
import Achievements from "./pages/Achievements";
import Discipline from "./pages/Discipline";
import ExportReport from "./pages/ExportReport";
import Chess from "./pages/Chess";
import Settings from "./pages/Settings";
import Players from "./pages/Players";
import PlayerProfile from "./pages/PlayerProfile";
import SharedExport from "./pages/SharedExport";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!session) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/share/:id" element={<SharedExport />} />
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/add" element={<ProtectedRoute><AddTrade /></ProtectedRoute>} />
              <Route path="/trades" element={<ProtectedRoute><TradeLog /></ProtectedRoute>} />
              <Route path="/import" element={<ProtectedRoute><ImportTrades /></ProtectedRoute>} />
              <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
              <Route path="/timeline" element={<ProtectedRoute><Timeline /></ProtectedRoute>} />
              <Route path="/report" element={<ProtectedRoute><ReportCard /></ProtectedRoute>} />
              <Route path="/asset/:symbol" element={<ProtectedRoute><AssetDetail /></ProtectedRoute>} />
              <Route path="/achievements" element={<ProtectedRoute><Achievements /></ProtectedRoute>} />
              <Route path="/discipline" element={<ProtectedRoute><Discipline /></ProtectedRoute>} />
              <Route path="/export" element={<ProtectedRoute><ExportReport /></ProtectedRoute>} />
              <Route path="/chess" element={<ProtectedRoute><Chess /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/players" element={<ProtectedRoute><Players /></ProtectedRoute>} />
              <Route path="/player/:username" element={<ProtectedRoute><PlayerProfile /></ProtectedRoute>} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
