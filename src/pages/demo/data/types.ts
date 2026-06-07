// Demo Design Lab — shared types. Isolated prototype; no production imports mutated.
import type { Holding, PortfolioPerformance, Trade } from "@/hooks/usePortfolio";
import type { DailyBreakdownItem } from "@/lib/dailyBreakdown";

export type DeviceKind = "desktop" | "phone" | "watch";

export type DemoCurrency = "USD" | "ARS";

export type DemoScreenId =
  | "dashboard"
  | "portfolio"
  | "trades"
  | "assetDetail"
  | "addTrade"
  | "analysis"
  | "players"
  | "alerts"
  | "benchmark"
  | "watchlist"
  | "dividends";

export type { DailyBreakdownItem };

export interface CumulativePoint {
  date: string;
  cumulative_pnl: number;
  net_pnl?: number;
}

export interface DemoData {
  trades: Trade[];
  holdings: Holding[];
  performance: PortfolioPerformance;
  cash: number;
  prices: Map<string, number>;
  previousCloses: Map<string, number>;
  marketValue: number;
  unrealizedPnl: number;
  totalPortfolioValue: number;
  totalPnl: number;
  totalPnlPct: number;
  dailyChange: number;
  dailyChangePct: number;
  dailyBreakdown: DailyBreakdownItem[];
  cumulativePnL: CumulativePoint[];
  mepRate: number;
  totalTrades: number;
  hasData: boolean;
  loading: boolean;
  pricesLoading: boolean;
}

export type { Formatters } from "@/lib/format";

// ── New-feature mock types ──
export interface DemoAlert {
  id: string;
  symbol: string;
  condition: "above" | "below" | "moves";
  /** price target for above/below; percent for "moves" */
  target: number;
  active: boolean;
}

export interface WatchItem {
  symbol: string;
  name: string;
}

export interface DividendEvent {
  id: string;
  symbol: string;
  exDate: string; // ISO yyyy-mm-dd
  payDate: string; // ISO yyyy-mm-dd
  amountPerShare: number;
  shares: number;
}

export interface BenchmarkPoint {
  date: string;
  portfolioPct: number; // % from start
  indexPct: number; // % from start
}
