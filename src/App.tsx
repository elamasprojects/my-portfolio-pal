import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LanguageProvider } from "@/i18n";
import { AppLayout } from "@/components/AppLayout";
import { RequireAuth } from "@/components/RequireAuth";
import { WatchRedirect } from "@/components/WatchRedirect";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import AddTradeHub from "./pages/AddTradeHub";
import TradeLog from "./pages/TradeLog";
import AssetDetail from "./pages/AssetDetail";
import AnalysisHub from "./pages/AnalysisHub";
import ProgressHub from "./pages/ProgressHub";
import Portfolio from "./pages/Portfolio";
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
import DemoApp from "./pages/demo/DemoApp";
import Watch from "./pages/Watch";
import Alerts from "./pages/Alerts";
import Watchlist from "./pages/Watchlist";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppLayout>{children}</AppLayout>
    </RequireAuth>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <WatchRedirect />
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
              <Route path="/portfolio" element={<ProtectedRoute><Portfolio /></ProtectedRoute>} />
              <Route path="/strategy" element={<ProtectedRoute><Strategy /></ProtectedRoute>} />
              <Route path="/chess" element={<ProtectedRoute><Chess /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/security" element={<ProtectedRoute><Security /></ProtectedRoute>} />
              <Route path="/alerts" element={<ProtectedRoute><Alerts /></ProtectedRoute>} />
              <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
              <Route path="/players" element={<ProtectedRoute><Players /></ProtectedRoute>} />
              <Route path="/player/:username" element={<ProtectedRoute><PlayerProfile /></ProtectedRoute>} />
              {/* Mobile redesign prototype (Design Lab) — self-gates auth, custom layout */}
              <Route path="/demo" element={<DemoApp />} />
              {/* Standalone round watch view (Wear OS-style) on live data — self-gates auth */}
              <Route path="/watch" element={<Watch />} />
              {/* Legacy redirects */}
              <Route path="/export" element={<Navigate to="/portfolio" replace />} />
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
