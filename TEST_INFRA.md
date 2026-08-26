# E2E Test Infrastructure Architecture & Feature Inventory Mapping

**Project**: Chess — Single-User Decision-Auditing System  
**Track**: E2E Testing Track (Tiers 1-4)  
**Location**: `C:\Users\ezequ\.gemini\antigravity\scratch\my-portfolio-pal\TEST_INFRA.md`  

---

## 1. Test Architecture Overview

The E2E test infrastructure for **Chess** is built on top of Vitest, React Testing Library, Mock Service Worker (MSW) patterns, and stateful chainable Supabase client mocks. It guarantees isolated, deterministic, high-signal verification without relying on external network requests or mutating live database tables.

```
src/
├── __tests__/
│   └── e2e/
│       ├── tier1-r1-views-pruning.test.tsx       # Tier 1: Feature Coverage (R1-R5)
│       ├── tier2-boundary-corner-cases.test.ts   # Tier 2: Boundary & Corner Cases
│       ├── tier3-cross-feature-interactions.test.ts # Tier 3: Pairwise Interactions
│       └── tier4-real-world-workloads.test.ts   # Tier 4: Workloads & Split Engine
└── test/
    ├── fixtures/
    │   └── types.ts                             # Fixture Schema Definitions & Datasets
    ├── mocks/
    │   ├── mockSupabase.ts                      # Chainable Mock Supabase Client Factory
    │   └── mockExternalApis.ts                  # ArgentinaDatos & DolarAPI Stubs
    ├── helpers/
    │   └── stateSetup.ts                        # Timer Advancement & Environment Setup
    └── infra.test.ts                            # Test Infrastructure Self-Verification
```

### 1.1 Core Test Utilities & Mock Architecture

1. **Stateful Supabase Client Mock (`src/test/mocks/mockSupabase.ts`)**:
   - Implements chainable query interfaces (`from('table').select().eq().gte().lte().in().order().single()`).
   - Supports stateful `insert()`, `update()`, and `delete()` operations on isolated in-memory stores (`trades`, `inflation_index`, `fx_rates`, `game_reviews`, `backups`).
   - Handles RPC calls like `perform_backup_dry_run` for non-destructive restoration verification.

2. **External API Network Intercept Handlers (`src/test/mocks/mockExternalApis.ts`)**:
   - Intercepts requests to ArgentinaDatos CPI inflation endpoint (`/v1/finanzas/indices/inflacion`) and CCL FX endpoint (`/v1/finanzas/cotizaciones/ccl`).
   - Intercepts requests to DolarAPI rate endpoints (`/v1/dolares/ccl`, `/v1/dolares/oficial`).

3. **Deterministic State & Timer Helpers (`src/test/helpers/stateSetup.ts`)**:
   - `setupTestEnvironment()`: Initializes clean Vitest environment, mock Supabase instance, and API stubs. Supports `{ useFakeTimers: boolean }` option (fake timers disabled by default for React Testing Library rendering tests, enabled when fake timer advancement is required).
   - `advanceCoolingTimer(seconds)`: Advances fake timers deterministically to test 60-second friction inversion cooling-off periods.
   - `triggerSundayWeeklyBrief()`: Advances system time to upcoming Sunday 09:00:00 UTC for automated weekly brief testing.

4. **Genuine Production Interface Exports**:
   - All E2E test suites in `src/__tests__/e2e/` (Tiers 1-4) import production domain functions directly from `@/lib/gameReview`, `@/lib/realReturns`, `@/lib/weeklyBrief`, `@/lib/backupSystem`, `@/components/finance/OmnibarFinance`, `@/components/discipline/PreTradeThesisModal`, and `@/components/discipline/FrictionCoolingTimerModal`.
   - All local inline function redefinitions have been completely removed from test files.


---

## 2. Feature Inventory Mapping Across Test Tiers

The 20 system features defined in `PROJECT.md` are mapped across all 4 E2E testing tiers as detailed below:

| # | Feature | Requirement | Tier 1 (Feature) | Tier 2 (Boundary) | Tier 3 (Pairwise) | Tier 4 (Workloads) |
|---|---------|-------------|------------------|-------------------|-------------------|--------------------|
| 1 | DB Schema & Migrations | R2, R3, R5 | `tier1` | `tier2` | `tier3` | `tier4` |
| 2 | IPC Inflation Ingestion | R3 | `tier1` | `tier2` | `tier3` | `tier4` |
| 3 | FX Rates Ingestion | R3 | `tier1` | `tier2` | `tier3` | `tier4` |
| 4 | 3-Column P&L Engine | R3 | `tier1` | `tier2` | `tier3` | `tier4` |
| 5 | Legacy Codebase Pruning | R1 | `tier1` | `tier2` | — | — |
| 6 | Dark Mode Enforcer | R1 | `tier1` | `tier2` | — | — |
| 7 | Spanish Standardization | R1 | `tier1` | `tier2` | — | — |
| 8 | 3-View Navigation & Router | R1 | `tier1` | `tier2` | `tier3` | — |
| 9 | Tablero View (`/`) | R1, R3 | `tier1` | `tier2` | `tier3` | — |
| 10 | Movimientos View (`/movements`) | R1 | `tier1` | `tier2` | `tier3` | — |
| 11 | Estrategia View (`/strategy`) | R1, R4 | `tier1` | `tier2` | `tier3` | — |
| 12 | Counterfactual Audit Engine | R2 | `tier1` | `tier2` | `tier3` | `tier4` |
| 13 | Trade Outcome Classifier | R2 | `tier1` | `tier2` | `tier3` | `tier4` |
| 14 | Aggregate Audit Metrics | R2 | `tier1` | `tier2` | `tier3` | `tier4` |
| 15 | Corporate Action Adjustments | R2 | `tier1` | `tier2` | — | `tier4` |
| 16 | Pre-Trade Thesis Enforcement | R4 | `tier1` | `tier2` | `tier3` | — |
| 17 | Friction Inversion Engine | R4 | `tier1` | `tier2` | `tier3` | — |
| 18 | Target & Invalidation Highlighting | R4 | `tier1` | `tier2` | `tier3` | — |
| 19 | Weekly Intelligence Brief | R5 | `tier1` | `tier2` | `tier3` | — |
| 20 | Fail-Safe Backup & Restoration | R5 | `tier1` | `tier2` | `tier3` | `tier4` |

---

## 3. Test Tiers & Methodology Specifications

### 3.1 Tier 1: Feature Coverage (R1-R5)
- **Scope**: Direct validation of requirements R1 through R5.
- **Coverage**: $\ge 5$ test cases per feature covering 3-view navigation (`Tablero`, `Movimientos`, `Estrategia`), legacy section redirection, dark mode token enforcement, Spanish UI labels, 3-column P&L calculations, counterfactual trade audits, pre-trade thesis validation, friction cooling timer, Sunday weekly brief, and JSON/CSV backup exports.

### 3.2 Tier 2: Boundary & Corner Cases
- **Scope**: Edge-case testing using Category-Partitioning & Boundary Value Analysis.
- **Coverage**: Handling of zero/negative inputs, empty portfolios, extreme IPC inflation jumps (+100%), 0-priced assets, missing FX rates during holidays, incomplete thesis forms, timer cancellation/retry attempts, and dry-run restoration checksum errors.

### 3.3 Tier 3: Pairwise Cross-Feature Interactions
- **Scope**: 4-Factor Pairwise Combinatorial Matrix testing orthogonal feature state propagation.
- **Coverage**: Simultaneous execution of trade placement $\rightarrow$ thesis recording $\rightarrow$ friction timer enforcement $\rightarrow$ 3-column P&L recalculation $\rightarrow$ Game Review outcome classification (*Brillante*, *Correcta*, *Imprecisión*, *Blunder*).

### 3.4 Tier 4: Real-World Application Workloads
- **Scope**: High-volume, multi-year operational stress testing and engine precision.
- **Coverage**:
  1. **Full 2-Year Trade History Simulation**: 64 transactions (40 buys, 20 sells, 4 dividends) across 3 economic inflation/FX regimes (Hyper-inflation, Disinflation, Moderate) computing aggregate metrics (Blunder Rate = 40.0%, Net Cost of Trading USD, Category Edge USD) in $<150$ms.
  2. **Corporate Action Stock Split Adjustments Engine**: 10-for-1 stock split scenario ($S = 10$) on NVDA historical series adjusting quantities ($Q_{adj} = Q \times S$), prices ($P_{adj} = P / S$), weighted average cost basis ($103.33 USD/share), and scaling counterfactual benchmark series ($1/S = 0.10$).
  3. **Fail-Safe Weekly Backup & Restoration Dry-Run**: Structured JSON export with header metadata, 12-week retention auto-purge (purging week 1 upon week 13 generation), and dry-run restoration foreign-key & mathematical parity verification.

---

## 4. Verification & Execution Commands

- **Type Checker**:
  ```bash
  npx tsc --noEmit
  ```
- **Vitest Test Suite**:
  ```bash
  npm test
  ```
