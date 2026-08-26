# Project: Chess — Single-User Decision-Auditing System

## Architecture
- **Framework**: Vite + React 18 + TypeScript (Single-page application)
- **Styling**: Tailwind CSS + Radix UI primitives + Lucide icons (Pure Dark Mode token system)
- **State & Data**: TanStack React Query + Custom React Hooks + Supabase Client (`@supabase/supabase-js`)
- **Views Architecture**: 3 unified views (`Tablero` `/`, `Movimientos` `/movements`, `Estrategia` `/strategy`)
- **Backend & Database**: Supabase PostgreSQL tables (`inflation_index`, `fx_rates`, `trades`, `portfolio_positions`, `transactions`, `game_reviews`, `backups`)

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | DB Schema & Migrations | Create `inflation_index`, `fx_rates`, `game_reviews`, `backups` tables & update `trades` with thesis columns | M1 | R2, R3, R5 |
| 2 | IPC Inflation Ingestion | ArgentinaDatos API integration for official CPI index series + CER daily interpolation | M1 | R3 |
| 3 | FX Rates Ingestion | ArgentinaDatos & DolarAPI integration for daily CCL, MEP, and Oficial rates | M1 | R3 |
| 4 | 3-Column P&L Engine | Core calculation library for Nominal ARS, Real vs IPC (Deflated ARS), and USD vs CCL (Real USD) | M1 | R3 |
| 5 | Legacy Codebase Pruning | Remove 20+ legacy routes, Players/Leaderboard, Progress/Gamification, Security page, standalone watchlist | M2 | R1 |
| 6 | Dark Mode Enforcer | Eliminate light theme variables, purge theme switchers, enforce single dark mode token system in `index.css` | M2 | R1 |
| 7 | Spanish Standardization | Remove language selector and standardize UI directly in Spanish | M2 | R1 |
| 8 | 3-View Navigation & Router | Restructure router into Tablero (`/`), Movimientos (`/movements`), Estrategia (`/strategy`) | M2 | R1 |
| 9 | Tablero View (`/`) | Unified Net Worth, Capital Conversion Rate tile, 3-column Real Returns table, Active Holdings, Period Sankey | M3 | R1, R3 |
| 10 | Movimientos View (`/movements`) | Unified event log (expenses, incomes, buys, sells, dividends), Omnibar input, Review Queue badge filter | M3 | R1 |
| 11 | Estrategia View (`/strategy`) | Investment rules dashboard, candidate watchlist with entry theses, thesis-linked alerts | M3 | R1, R4 |
| 12 | Counterfactual Audit Engine | Closed positions audit against "Do Nothing" (Hold original) and Benchmarks (CCL, S&P 500, Fixed-term deposit) | M4 | R2 |
| 13 | Trade Outcome Classifier | Taxonomy rules classifying trades into *Brillante*, *Correcta*, *Imprecisión*, and *Blunder* | M4 | R2 |
| 14 | Aggregate Audit Metrics | Compute Blunder Rate %, Net Cost of Trading vs Holding (USD), and Category Edge | M4 | R2 |
| 15 | Corporate Action Adjustments | Split factor scaling ($Q_{adj} = Q \times S, P_{adj} = P / S$) for historic trade series | M4 | R2 |
| 16 | Pre-Trade Thesis Enforcement | Mandatory 3 fields before buy execution: (1) Entry thesis, (2) Exit target price, (3) Invalidation conditions | M5 | R4 |
| 17 | Friction Inversion Engine | 1-click planned exits vs 60-second cooling-off timer with written rationale for unplanned sells | M5 | R4 |
| 18 | Target & Invalidation Highlighting | Visual target reached ("🎯 Target") or invalidation hit ("⚠️ Invalidación") banners | M5 | R4 |
| 19 | Weekly Intelligence Brief | Sunday digest (7d/MTD performance, thesis proximity, expense anomalies, conversion rate, AI audit question) | M5 | R5 |
| 20 | Fail-Safe Backup & Restoration | Scheduled database export to portable JSON/CSV, 12-week retention, automated dry-run restoration validation | M5 | R5 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Requirement-driven test infrastructure & test suites across Tiers 1-4 | none | DONE |
| M1 | DB Schemas & Real Returns Engine | SQL migrations, ArgentinaDatos/DolarAPI integration, 3-column inflation/FX deflator math engine | none | DONE |
| M2 | Codebase Pruning & 3-View Router | Purge legacy routes/theme/language, dark mode token system, 3-view navigation router | none | DONE |
| M3 | Unified 3-View Interface | Tablero (`/`), Movimientos (`/movements`), Estrategia (`/strategy`) UI components & state hooks | M1, M2 | DONE |
| M4 | Retroactive Game Review Engine | Counterfactual audit engine, outcome classifier, aggregate metrics, corporate actions split adjustments | M1 | DONE |
| M5 | Pre-Trade Discipline & System Services | Pre-trade thesis, friction inversion timer, weekly brief generator, fail-safe backup & restoration verification | M1, M3 | DONE |

## Interface Contracts

### 1. Real Returns Engine (`src/lib/realReturns.ts`)
```typescript
export interface RealReturnColumns {
  nominalARS: number;
  realVsIPC: number; // Deflated by IPC index
  usdVsCCL: number;  // Converted to CCL USD
}

export interface CalculateRealReturnParams {
  amountARS: number;
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string;   // ISO date YYYY-MM-DD
}

export function calculateRealReturns(params: CalculateRealReturnParams): Promise<RealReturnColumns>;
```

### 2. Game Review Engine (`src/lib/gameReview.ts`)
```typescript
export type TradeOutcome = 'Brillante' | 'Correcta' | 'Imprecision' | 'Blunder';

export interface CounterfactualMetrics {
  doNothingReturnARS: number;
  benchmarkReturns: {
    spyReturn: number;
    cclReturn: number;
    fixedDepositReturn: number;
  };
  outcomeClassification: TradeOutcome;
  netCostOfTradingUSD: number;
}

export interface ClosedTradeAuditInput {
  tradeId: string;
  symbol: string;
  buyDate: string;
  sellDate: string;
  buyPriceARS: number;
  sellPriceARS: number;
  quantity: number;
  targetPriceARS?: number;
  invalidationPriceARS?: number;
}

export function auditClosedTrade(trade: ClosedTradeAuditInput): Promise<CounterfactualMetrics>;
```

### 3. Pre-Trade Thesis & Friction Inversion (`src/types/thesis.ts`)
```typescript
export interface PreTradeThesis {
  entryThesis: string; // min 10 chars
  targetPriceARS: number; // > 0
  invalidationCondition: string; // min 10 chars
}

export interface SellExecutionRequest {
  tradeId: string;
  sellQuantity: number;
  sellPriceARS: number;
  isPlannedExit: boolean;
  unplannedRationale?: string; // mandatory if !isPlannedExit (min 20 chars)
  coolingOffDurationSeconds?: number; // 60s for unplanned
}
```

## Code Layout
- `src/components/views/`
  - `TableroView.tsx` (Net Worth, Capital Conversion, 3-Col Returns, Active Positions, Sankey)
  - `MovimientosView.tsx` (Omnibar Input, Unified Event Feed, Review Queue Filter)
  - `EstrategiaView.tsx` (Rules, Pre-trade Theses, Alerts, Watchlist, Game Review summary)
- `src/components/navigation/`
  - `ChessNavbar.tsx` (3-tab top navigation in Spanish)
- `src/components/discipline/`
  - `PreTradeThesisModal.tsx`
  - `FrictionCoolingTimerModal.tsx`
- `src/lib/`
  - `realReturns.ts` (3-column P&L deflator engine)
  - `gameReview.ts` (Counterfactual audit & outcome classifier)
  - `weeklyBrief.ts` (Sunday intelligence digest generator)
  - `backupSystem.ts` (Database dump, retention, dry-run restoration validator)
- `supabase/migrations/`
  - `20260814020000_chess_schema_consolidation.sql` (Tables for IPC, FX, Game Reviews, Backups, Thesis columns)
