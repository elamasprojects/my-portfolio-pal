import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

export type AppMode = "investments" | "finance";

interface AppModeContextType {
  mode: AppMode;
  setMode: (mode: AppMode) => void;
}

const AppModeContext = createContext<AppModeContextType | undefined>(undefined);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();

  const [mode, setModeState] = useState<AppMode>(() => {
    if (location.pathname.startsWith("/finance")) return "finance";
    const saved = localStorage.getItem("app_active_mode");
    return saved === "finance" ? "finance" : "investments";
  });

  // Sync mode with route changes
  useEffect(() => {
    if (location.pathname.startsWith("/finance")) {
      if (mode !== "finance") setModeState("finance");
    } else if (
      location.pathname === "/" ||
      location.pathname.startsWith("/trades") ||
      location.pathname.startsWith("/analysis") ||
      location.pathname.startsWith("/portfolio") ||
      location.pathname.startsWith("/strategy") ||
      location.pathname.startsWith("/chess")
    ) {
      if (mode !== "investments") setModeState("investments");
    }
  }, [location.pathname]);

  const setMode = (newMode: AppMode) => {
    setModeState(newMode);
    localStorage.setItem("app_active_mode", newMode);
    if (newMode === "finance" && !location.pathname.startsWith("/finance")) {
      navigate("/finance");
    } else if (newMode === "investments" && location.pathname.startsWith("/finance")) {
      navigate("/");
    }
  };

  return (
    <AppModeContext.Provider value={{ mode, setMode }}>
      {children}
    </AppModeContext.Provider>
  );
}

export function useAppMode() {
  const context = useContext(AppModeContext);
  if (!context) {
    throw new Error("useAppMode must be used within an AppModeProvider");
  }
  return context;
}
