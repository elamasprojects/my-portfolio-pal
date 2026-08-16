import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "@/components/AppLayout";
import { RequireAuth } from "@/components/RequireAuth";

// Core Pages / Views
import Auth from "./pages/Auth";
import Index from "./pages/Index";
import TradeLog from "./pages/TradeLog";
import Strategy from "./pages/Strategy";
import Patrimonio from "./pages/Patrimonio";
import AssetDetail from "./pages/AssetDetail";

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
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <Routes>
            {/* Public Authentication Route */}
            <Route path="/auth" element={<Auth />} />

            {/* Core Navigation Routes */}
            <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
            <Route path="/strategy" element={<ProtectedRoute><Strategy /></ProtectedRoute>} />
            <Route path="/movements" element={<ProtectedRoute><TradeLog /></ProtectedRoute>} />
            <Route path="/finance" element={<ProtectedRoute><Patrimonio /></ProtectedRoute>} />
            <Route path="/patrimonio" element={<ProtectedRoute><Patrimonio /></ProtectedRoute>} />
            <Route path="/asset/:symbol" element={<ProtectedRoute><AssetDetail /></ProtectedRoute>} />
            {/* Deep link into Inversiones with the trade capture dialog open. */}
            <Route path="/add" element={<ProtectedRoute><Index /></ProtectedRoute>} />

            {/* Graceful Legacy Path Redirects -> Tablero (/) */}
            <Route path="/players" element={<Navigate to="/" replace />} />
            <Route path="/player/:username" element={<Navigate to="/" replace />} />
            <Route path="/security" element={<Navigate to="/" replace />} />
            <Route path="/progress" element={<Navigate to="/" replace />} />
            <Route path="/analysis" element={<Navigate to="/" replace />} />
            <Route path="/analysis/*" element={<Navigate to="/" replace />} />
            <Route path="/portfolio" element={<Navigate to="/" replace />} />
            <Route path="/chess" element={<Navigate to="/" replace />} />
            <Route path="/settings" element={<Navigate to="/" replace />} />
            <Route path="/demo" element={<Navigate to="/" replace />} />
            <Route path="/watch" element={<Navigate to="/" replace />} />
            <Route path="/landing" element={<Navigate to="/" replace />} />
            <Route path="/install" element={<Navigate to="/" replace />} />
            <Route path="/tools" element={<Navigate to="/" replace />} />
            <Route path="/tools/*" element={<Navigate to="/" replace />} />

            {/* Graceful Legacy Path Redirects -> Movimientos (/movements) */}
            <Route path="/trades" element={<Navigate to="/movements" replace />} />
            {/* The CSV importer is gone; its old path lands on the manual capture flow. */}
            <Route path="/add/*" element={<Navigate to="/add" replace />} />
            {/* /finance itself is the Finanzas view (declared above and linked from both navs);
                only its retired PR #2 subroutes redirect. */}
            <Route path="/finance/*" element={<Navigate to="/movements" replace />} />

            {/* Graceful Legacy Path Redirects -> Estrategia (/strategy) */}
            <Route path="/watchlist" element={<Navigate to="/strategy" replace />} />
            <Route path="/alerts" element={<Navigate to="/strategy" replace />} />
            <Route path="/progress/discipline" element={<Navigate to="/strategy" replace />} />

            {/* Historical Legacy Aliases */}
            <Route path="/export" element={<Navigate to="/" replace />} />
            <Route path="/import" element={<Navigate to="/add" replace />} />
            <Route path="/performance" element={<Navigate to="/" replace />} />
            <Route path="/timeline" element={<Navigate to="/movements" replace />} />
            <Route path="/report" element={<Navigate to="/" replace />} />
            <Route path="/achievements" element={<Navigate to="/" replace />} />
            <Route path="/discipline" element={<Navigate to="/strategy" replace />} />

            {/* Fallback Catch-All Redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
