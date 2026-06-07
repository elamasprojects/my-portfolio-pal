import { useDemo } from "../DemoContext";
import { DemoTopBar } from "./DemoTopBar";
import { DemoBottomNav } from "./DemoBottomNav";
import { DemoDesktopHeader } from "./DemoDesktopHeader";
import { DashboardScreen } from "../screens/DashboardScreen";
import { PortfolioScreen } from "../screens/PortfolioScreen";
import { TradeLogScreen } from "../screens/TradeLogScreen";
import { AssetDetailScreen } from "../screens/AssetDetailScreen";
import { AddTradeScreen } from "../screens/AddTradeScreen";
import { AnalysisScreen } from "../screens/AnalysisScreen";
import { PlayersScreen } from "../screens/PlayersScreen";
import { AlertsScreen } from "../screens/AlertsScreen";
import { BenchmarkScreen } from "../screens/BenchmarkScreen";
import { WatchlistScreen } from "../screens/WatchlistScreen";
import { DividendCalendarScreen } from "../screens/DividendCalendarScreen";

function ScreenRouter() {
  const { screen } = useDemo();
  switch (screen) {
    case "dashboard":
      return <DashboardScreen />;
    case "portfolio":
      return <PortfolioScreen />;
    case "trades":
      return <TradeLogScreen />;
    case "assetDetail":
      return <AssetDetailScreen />;
    case "addTrade":
      return <AddTradeScreen />;
    case "analysis":
      return <AnalysisScreen />;
    case "players":
      return <PlayersScreen />;
    case "alerts":
      return <AlertsScreen />;
    case "benchmark":
      return <BenchmarkScreen />;
    case "watchlist":
      return <WatchlistScreen />;
    case "dividends":
      return <DividendCalendarScreen />;
    default:
      return <DashboardScreen />;
  }
}

export function DemoAppChrome() {
  const { isPhone } = useDemo();

  if (isPhone) {
    return (
      <div className="relative flex h-full flex-col bg-background">
        <DemoTopBar />
        <div className="demo-scroll flex-1 overflow-y-auto px-4 pb-28 pt-3">
          <ScreenRouter />
        </div>
        <DemoBottomNav />
      </div>
    );
  }

  return (
    <div>
      <DemoDesktopHeader />
      <ScreenRouter />
    </div>
  );
}
