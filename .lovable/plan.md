

## MUST HAVE Implementation Plan

Eight features grouped into 4 workstreams. Each section lists the DB changes, files to create/modify, and key logic.

---

### 1. Trade Tags / Strategy Labels

Allow users to tag trades with strategy names (e.g. "breakout", "DCA", "earnings play") and filter by them.

**Database migration:**
```sql
-- New table for reusable tags
CREATE TABLE public.trade_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);
ALTER TABLE public.trade_tags ENABLE ROW LEVEL SECURITY;
-- RLS: users CRUD own tags

-- Junction table
CREATE TABLE public.trade_tag_assignments (
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.trade_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (trade_id, tag_id)
);
ALTER TABLE public.trade_tag_assignments ENABLE ROW LEVEL SECURITY;
-- RLS: users CRUD where trade belongs to them
```

**Files:**
- `src/hooks/useTags.tsx` — `useTags()` query, `useCreateTag()`, `useAssignTag()`, `useRemoveTag()` mutations
- `src/components/TagPicker.tsx` — Popover with existing tags as colored badges + "Create new" input. Used in AddTrade and TradeLog edit dialog
- `src/pages/AddTrade.tsx` — Add TagPicker after notes field. On submit, insert tag assignments after trade insert
- `src/pages/TradeLog.tsx` — Show tags as small badges in each row. Add tag filter dropdown alongside existing type/asset filters
- `src/pages/Index.tsx` — Show tags on recent trades rows

---

### 2. Edit Existing Trades

Click a trade row in Trade Log or Asset Detail to open a pre-filled edit dialog.

**Files:**
- `src/components/EditTradeDialog.tsx` — Dialog with the same fields as AddTrade form (symbol, asset name, type, quantity, price, date, notes, tags). Pre-filled from the trade object. Calls `supabase.from("trades").update(...)`. Includes delete button with confirmation
- `src/pages/TradeLog.tsx` — Wrap each row in a clickable handler that opens EditTradeDialog with the selected trade. Remove the standalone delete button (moved into dialog)
- `src/pages/AssetDetail.tsx` — Same clickable rows opening EditTradeDialog

**Key logic:**
- When editing a sell trade, validate quantity against available shares (excluding the current trade from the calculation)
- After update, invalidate `["trades"]` query

---

### 3. Multiple Portfolios

The `portfolios` table already exists and `handle_new_user()` creates a default one. Enable users to create, rename, delete, and switch portfolios.

**Files:**
- `src/hooks/usePortfolio.tsx` — Add `usePortfolios()` (fetch all), `useActivePortfolio()` (reads from localStorage which portfolio ID is selected, falls back to first), `useCreatePortfolio()`, `useRenamePortfolio()`, `useDeletePortfolio()` mutations. Update `useTrades()` to filter by active portfolio ID
- `src/components/PortfolioSwitcher.tsx` — Dropdown in the sidebar header showing current portfolio name with a chevron. Lists all portfolios. "Create new" option at bottom opens an inline input. Right-click or three-dot menu per item for rename/delete
- `src/components/AppSidebar.tsx` — Replace the static "Portfolio" text with `<PortfolioSwitcher />`
- `src/pages/AddTrade.tsx` — Use `useActivePortfolio()` instead of `useDefaultPortfolio()` so trades go to the selected portfolio
- `src/pages/ImportTrades.tsx` — Same change

**Key logic:**
- Active portfolio ID stored in `localStorage` as `activePortfolioId`. If the stored ID doesn't match any portfolio (deleted), fall back to first
- Switching portfolio triggers refetch of trades via query key `["trades", portfolioId]`
- Cannot delete the last remaining portfolio

---

### 4. Realized P&L Tracking

Calculate profit/loss from closed positions using average cost basis. No live prices needed — purely from trade data.

**Computation (in `src/hooks/usePortfolio.tsx`):**

```text
For each symbol, process trades chronologically:
  - BUY: add to position, update weighted avg cost
  - SELL: realized P&L = (sell_price - avg_cost) * sell_qty
  
Per-symbol output:
  - total_realized_pnl (sum of all sell P&Ls)
  - open_quantity, avg_cost, total_cost_basis
  
Portfolio totals:
  - total_realized_pnl across all symbols
  - total_cost_basis (open positions)
  - win_rate = winning_sells / total_sells
```

**New function in `src/hooks/usePortfolio.tsx`:**
- `computePerformance(trades: Trade[])` — returns per-symbol P&L breakdown and portfolio totals. Uses average cost method

**Files:**
- `src/hooks/usePortfolio.tsx` — Add `computePerformance()` function and `PerformanceData` interface
- `src/pages/Index.tsx` (Dashboard) — Replace "Total Invested" card with two cards: "Cost Basis (Open)" and "Realized P&L" (green/red). Add a "Win Rate" card showing `X%`. Add a new card below the allocation chart: "P&L by Asset" — a horizontal bar chart (recharts `BarChart`) showing realized P&L per symbol, colored green/red
- `src/pages/AssetDetail.tsx` — Add realized P&L card and cost basis card to the stats row. Show P&L per individual sell trade in the history table as an extra column

---

### 5. Dividend / Income Tracking

Add a new trade type `dividend` to log cash distributions received.

**Database migration:**
```sql
-- Extend the trade_type enum
ALTER TYPE public.trade_type ADD VALUE 'dividend';
```

**Files:**
- `src/pages/AddTrade.tsx` — Add a third button "Dividend" in the trade type selector (styled in blue/purple). When selected, show a simplified form: symbol picker (from holdings), amount received, date, notes. No quantity/price fields — just a flat dollar amount stored as `total_amount` with `quantity=1` and `price_per_unit=amount`
- `src/hooks/usePortfolio.tsx` — Update `computeHoldings` to exclude dividend trades from quantity calculations. Update `computePerformance` to include dividends in total return: `total_return = realized_pnl + dividends_received`
- `src/pages/Index.tsx` — Add "Dividends Received" summary card
- `src/pages/AssetDetail.tsx` — Show dividend history and total dividends for the asset
- `src/pages/TradeLog.tsx` — Show dividend trades with a distinct badge color. Add "dividend" to the type filter

---

### Implementation Order

Build in this sequence to minimize rework:

1. **Multiple Portfolios** — foundational; changes query patterns everything else depends on
2. **Edit Trades** — needed before P&L so users can fix mistakes
3. **Trade Tags** — independent, additive
4. **Realized P&L** — depends on clean trade data
5. **Dividend Tracking** — extends P&L, adds new trade type last

### Summary of all DB changes

```text
Migration 1: trade_tags + trade_tag_assignments tables + RLS
Migration 2: ALTER TYPE trade_type ADD VALUE 'dividend'
```

No changes to the existing `trades` or `portfolios` tables.

### Files changed/created (complete list)

```text
NEW:
  src/hooks/useTags.tsx
  src/components/TagPicker.tsx
  src/components/EditTradeDialog.tsx
  src/components/PortfolioSwitcher.tsx

MODIFIED:
  src/hooks/usePortfolio.tsx    — active portfolio, computePerformance, dividend exclusion
  src/components/AppSidebar.tsx — portfolio switcher
  src/pages/AddTrade.tsx        — tags, dividend type, active portfolio
  src/pages/TradeLog.tsx        — edit dialog, tag display/filter, dividend filter
  src/pages/AssetDetail.tsx     — edit dialog, P&L cards, dividend section
  src/pages/Index.tsx           — P&L cards, win rate, dividends card, P&L bar chart
  src/pages/ImportTrades.tsx    — active portfolio
```

