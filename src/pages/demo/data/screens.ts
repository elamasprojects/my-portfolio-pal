import type { DemoScreenId } from "./types";

export const SCREEN_TITLES: Record<DemoScreenId, string> = {
  dashboard: "Home",
  portfolio: "Portfolio",
  trades: "Trade Log",
  assetDetail: "Asset",
  addTrade: "Add Trade",
  analysis: "Analysis",
  players: "Players",
  alerts: "Alerts",
  benchmark: "Benchmark",
  watchlist: "Watchlist",
  dividends: "Dividends",
};

/** Primary bottom-nav tabs (the FAB in the middle is Add Trade). */
export const PRIMARY_TABS: DemoScreenId[] = ["dashboard", "trades", "analysis", "portfolio"];

/** Secondary destinations (surfaced in the desktop header + dashboard shortcuts). */
export const FEATURE_NAV: { id: DemoScreenId; label: string }[] = [
  { id: "alerts", label: "Alerts" },
  { id: "benchmark", label: "Benchmark" },
  { id: "watchlist", label: "Watchlist" },
  { id: "dividends", label: "Dividends" },
  { id: "players", label: "Players" },
];
