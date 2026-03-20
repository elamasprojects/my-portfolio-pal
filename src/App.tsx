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
import AddTradeHub from "./pages/AddTradeHub";
import TradeLog from "./pages/TradeLog";
import AssetDetail from "./pages/AssetDetail";
import AnalysisHub from "./pages/AnalysisHub";
import ProgressHub from "./pages/ProgressHub";
import ExportReport from "./pages/ExportReport";
import Chess from "./pages/Chess";
import Settings from "./pages/Settings";
import Strategy from "./pages/Strategy";
import Players from "./pages/Players";
import PlayerProfile from "./pages/PlayerProfile";
import SharedExport from "./pages/SharedExport";
import Landing from "./pages/Landing";
import Install from "./pages/Install";
import NotFound from "./pages/NotFound";
import ToolsLayout from "./components/ToolsLayout";
import Tools from "./pages/Tools";
import RiskProfile from "./pages/RiskProfile";
import CompoundCalculator from "./pages/CompoundCalculator";
import DCASimulator from "./pages/DCASimulator";
import Security from "./pages/Security";

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
              <Route path="/landing" element={<Landing />} />
              <Route path="/install" element={<Install />} />
              <Route path="/share/:id" element={<SharedExport />} />
              <Route path="/tools" element={<ToolsLayout />}>
                <Route index element={<Tools />} />
                <Route path="risk-profile" element={<RiskProfile />} />
                <Route path="compound" element={<CompoundCalculator />} />
                <Route path="dca" element={<DCASimulator />} />
              </Route>
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/add" element={<ProtectedRoute><AddTradeHub /></ProtectedRoute>} />
              <Route path="/add/import" element={<ProtectedRoute><AddTradeHub /></ProtectedRoute>} />
              <Route path="/trades" element={<ProtectedRoute><TradeLog /></ProtectedRoute>} />
              <Route path="/analysis" element={<ProtectedRoute><AnalysisHub /></ProtectedRoute>} />
              <Route path="/analysis/timeline" element={<ProtectedRoute><AnalysisHub /></ProtectedRoute>} />
              <Route path="/analysis/report" element={<ProtectedRoute><AnalysisHub /></ProtectedRoute>} />
              <Route path="/progress" element={<ProtectedRoute><ProgressHub /></ProtectedRoute>} />
              <Route path="/progress/discipline" element={<ProtectedRoute><ProgressHub /></ProtectedRoute>} />
              <Route path="/asset/:symbol" element={<ProtectedRoute><AssetDetail /></ProtectedRoute>} />
              <Route path="/export" element={<ProtectedRoute><ExportReport /></ProtectedRoute>} />
              <Route path="/strategy" element={<ProtectedRoute><Strategy /></ProtectedRoute>} />
              <Route path="/chess" element={<ProtectedRoute><Chess /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/players" element={<ProtectedRoute><Players /></ProtectedRoute>} />
              <Route path="/player/:username" element={<ProtectedRoute><PlayerProfile /></ProtectedRoute>} />
              {/* Legacy redirects */}
              <Route path="/import" element={<Navigate to="/add/import" replace />} />
              <Route path="/performance" element={<Navigate to="/analysis" replace />} />
              <Route path="/timeline" element={<Navigate to="/analysis/timeline" replace />} />
              <Route path="/report" element={<Navigate to="/analysis/report" replace />} />
              <Route path="/achievements" element={<Navigate to="/progress" replace />} />
              <Route path="/discipline" element={<Navigate to="/progress/discipline" replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </LanguageProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
