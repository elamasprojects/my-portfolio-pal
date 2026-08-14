/**
 * E2E Test Suite Fixture Types & Sample Data
 * Specs from Explorer 3 Handoff & Requirement Contracts
 */
import { calculateBackupChecksum } from "@/lib/backupSystem";


export interface InflationIndexFixture {
  id: string;
  period: string; // ISO Date YYYY-MM-01
  ipc_value: number;
  cer_value: number;
  source: 'argentina_datos' | 'indec' | 'manual';
  created_at: string;
}

export interface FxRateFixture {
  id: string;
  rate_date: string; // ISO Date YYYY-MM-DD
  ccl_sell: number;
  ccl_buy: number;
  mep_sell: number;
  mep_buy: number;
  oficial_sell: number;
  source: 'dolar_api' | 'argentina_datos';
  fetched_at: string;
}

export interface TradeFixture {
  id: string;
  user_id: string;
  symbol: string;
  asset_category: 'equity' | 'bond' | 'cedear' | 'crypto';
  buy_date: string;
  sell_date?: string | null;
  buy_price_ars: number;
  sell_price_ars?: number | null;
  quantity: number;
  split_factor?: number; // default 1.0
  entry_thesis: string;
  target_price_ars: number;
  invalidation_condition: string;
  is_planned_exit?: boolean;
  unplanned_rationale?: string | null;
  status: 'open' | 'closed';
  created_at: string;
}

export interface GameReviewFixture {
  id: string;
  trade_id: string;
  do_nothing_return_ars: number;
  spy_return_pct: number;
  ccl_return_pct: number;
  fixed_deposit_return_pct: number;
  outcome_classification: 'Brillante' | 'Correcta' | 'Imprecision' | 'Blunder';
  net_cost_of_trading_usd: number;
  audited_at: string;
}

export interface BackupPayloadFixture {
  version: string;
  timestamp: string;
  checksum: string;
  data: {
    inflation_index: InflationIndexFixture[];
    fx_rates: FxRateFixture[];
    trades: TradeFixture[];
    game_reviews: GameReviewFixture[];
  };
}

// Sample Fixture Instances for Test Helpers
export const sampleInflationFixtures: InflationIndexFixture[] = [
  {
    id: 'ipc-2024-01',
    period: '2024-01-01',
    ipc_value: 100.0,
    cer_value: 120.5,
    source: 'argentina_datos',
    created_at: '2024-01-31T23:59:59Z',
  },
  {
    id: 'ipc-2024-02',
    period: '2024-02-01',
    ipc_value: 110.0,
    cer_value: 132.55,
    source: 'argentina_datos',
    created_at: '2024-02-29T23:59:59Z',
  },
  {
    id: 'ipc-2024-03',
    period: '2024-03-01',
    ipc_value: 125.0,
    cer_value: 150.62,
    source: 'argentina_datos',
    created_at: '2024-03-31T23:59:59Z',
  },
];

export const sampleFxRateFixtures: FxRateFixture[] = [
  {
    id: 'fx-2024-01-01',
    rate_date: '2024-01-01',
    ccl_sell: 1000.0,
    ccl_buy: 980.0,
    mep_sell: 990.0,
    mep_buy: 975.0,
    oficial_sell: 820.0,
    source: 'dolar_api',
    fetched_at: '2024-01-01T17:00:00Z',
  },
  {
    id: 'fx-2024-02-01',
    rate_date: '2024-02-01',
    ccl_sell: 1200.0,
    ccl_buy: 1180.0,
    mep_sell: 1180.0,
    mep_buy: 1160.0,
    oficial_sell: 840.0,
    source: 'dolar_api',
    fetched_at: '2024-02-01T17:00:00Z',
  },
];

export const sampleTradeFixtures: TradeFixture[] = [
  {
    id: 'trade-001',
    user_id: 'user-test-123',
    symbol: 'AAPL',
    asset_category: 'cedear',
    buy_date: '2024-01-01',
    sell_date: '2024-02-01',
    buy_price_ars: 1000.0,
    sell_price_ars: 1500.0,
    quantity: 100,
    split_factor: 1.0,
    entry_thesis: 'Strong quarterly earnings growth forecast for Q1',
    target_price_ars: 1500.0,
    invalidation_condition: 'Revenue growth below 5% YoY',
    is_planned_exit: true,
    unplanned_rationale: null,
    status: 'closed',
    created_at: '2024-01-01T10:00:00Z',
  },
  {
    id: 'trade-002',
    user_id: 'user-test-123',
    symbol: 'GGAL',
    asset_category: 'equity',
    buy_date: '2024-01-15',
    sell_date: '2024-02-15',
    buy_price_ars: 1000.0,
    sell_price_ars: 750.0,
    quantity: 100,
    split_factor: 1.0,
    entry_thesis: 'Banking sector recovery play on macroeconomic reforms',
    target_price_ars: 1500.0,
    invalidation_condition: 'Stock breaks below 800 ARS support level',
    is_planned_exit: false,
    unplanned_rationale: 'Selling due to panic over market rumor despite no thesis change',
    status: 'closed',
    created_at: '2024-01-15T11:30:00Z',
  },
];

export const sampleGameReviewFixtures: GameReviewFixture[] = [
  {
    id: 'review-001',
    trade_id: 'trade-001',
    do_nothing_return_ars: 150000.0,
    spy_return_pct: 15.0,
    ccl_return_pct: 20.0,
    fixed_deposit_return_pct: 5.0,
    outcome_classification: 'Brillante',
    net_cost_of_trading_usd: 0.0,
    audited_at: '2024-02-01T18:00:00Z',
  },
  {
    id: 'review-002',
    trade_id: 'trade-002',
    do_nothing_return_ars: 120000.0,
    spy_return_pct: 10.0,
    ccl_return_pct: 25.0,
    fixed_deposit_return_pct: 5.0,
    outcome_classification: 'Blunder',
    net_cost_of_trading_usd: 40.0,
    audited_at: '2024-02-15T18:00:00Z',
  },
];

const rawSampleBackupData = {
  version: '1.0.0',
  timestamp: '2026-08-14T00:00:00Z',
  data: {
    inflation_index: sampleInflationFixtures,
    fx_rates: sampleFxRateFixtures,
    trades: sampleTradeFixtures,
    game_reviews: sampleGameReviewFixtures,
  },
};

export const sampleBackupPayloadFixture: BackupPayloadFixture = {
  ...rawSampleBackupData,
  checksum: calculateBackupChecksum(rawSampleBackupData),
};
