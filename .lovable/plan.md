

## Nice to Have — Implementation Plan

Based on the earlier roadmap, here are the Nice to Have features and how to build each one.

---

### 1. Cumulative Realized P&L Line Chart

A line chart on the Dashboard showing how realized P&L accumulated over time, computed purely from trade history.

**Logic** (in `src/hooks/usePortfolio.tsx`):
- New function `computeCumulativePnL(trades: Trade[])` — sort all trades chronologically, maintain running avg cost per symbol, and on each sell compute the P&L delta. On each dividend, add to cumulative. Return an array of `{ date: string, cumulative_pnl: number }` data points.

**UI** (in `src/pages/Index.tsx`):
- New card below P&L by Asset: "P&L Over Time" — a `recharts` `AreaChart` with gradient fill (green above zero, red below). X-axis = date, Y-axis = cumulative dollar P&L. Only render when there are sell or dividend trades.

---

### 2. Periodic Performance Summary (Monthly/Quarterly)

A bar chart showing realized P&L grouped by month or quarter, with a toggle.

**Logic** (in `src/hooks/usePortfolio.tsx`):
- New function `computePeriodicPnL(trades: Trade[], period: 'month' | 'quarter')` — group sell/dividend trades by period, compute P&L per group using the same avg-cost logic. Return `{ period: string, realized: number, dividends: number }[]`.

**UI**: New page `src/pages/Performance.tsx` dedicated to analytics:
- Period toggle (Month / Quarter)
- `BarChart` with stacked bars (realized P&L + dividends)
- Summary stats: best month, worst month, average monthly return
- Add "Performance" nav item to `AppSidebar.tsx`

---

### 3. Bulk Actions in Trade Log

Select multiple trades and apply actions (delete, tag, export selected).

**Changes to `src/pages/TradeLog.tsx`:**
- Add a checkbox column (first column). Header checkbox for select-all (filtered).
- Track `selectedIds: Set<string>` state.
- When any trades are selected, show a floating action bar at the bottom with:
  - "Delete (N)" — opens confirmation dialog, batch deletes via `supabase.from("trades").delete().in("id", [...ids])`
  - "Tag" — opens a tag picker popover, batch inserts tag assignments
  - "Export (N)" — triggers CSV download of selected rows only
- Clicking a row still opens edit dialog (only when not in selection mode). Checkbox click stops propagation.

---

### 4. Duplicate / "Add Similar Trade"

Quick way to log a similar trade from an existing one.

**Changes to `src/components/EditTradeDialog.tsx`:**
- Add a "Duplicate" button in the dialog footer (between Delete and Save).
- On click: navigate to `/add` with query params encoding the trade fields: `?symbol=AAPL&name=Apple&type=buy&asset=stock&price=150&notes=DCA`

**Changes to `src/pages/AddTrade.tsx`:**
- On mount, read `useSearchParams()`. If params exist, pre-fill the form fields (tradeType, symbol, assetName, assetType, price, notes). Clear the params after applying. This auto-advances the progressive disclosure since fields are already filled.

---

### 5. CSV Export

Export all trades (or filtered trades) as a CSV file.

**Changes to `src/pages/TradeLog.tsx`:**
- Add an "Export CSV" button in the filter bar (next to existing filters).
- On click: generate CSV string from `filtered` trades array with headers: Date, Symbol, Name, Type, Asset, Quantity, Price, Total, Notes, Tags.
- Tags column: join tag names with semicolons.
- Trigger browser download via `Blob` + `URL.createObjectURL` + hidden anchor click.
- No backend needed — purely client-side.

---

### Implementation Order

1. **CSV Export** — smallest, no new files, immediate user value
2. **Duplicate Trade** — small change across 2 files
3. **Cumulative P&L Chart** — adds to dashboard, self-contained
4. **Performance Page** — new page + sidebar nav item
5. **Bulk Actions** — most complex UI change, do last

### Files changed/created

```text
NEW:
  src/pages/Performance.tsx     — periodic P&L page

MODIFIED:
  src/hooks/usePortfolio.tsx    — computeCumulativePnL, computePeriodicPnL
  src/pages/Index.tsx           — cumulative P&L area chart
  src/pages/TradeLog.tsx        — bulk select, CSV export button
  src/components/EditTradeDialog.tsx — duplicate button
  src/pages/AddTrade.tsx        — read URL params for pre-fill
  src/components/AppSidebar.tsx — add Performance nav item
  src/App.tsx                   — add /performance route
```

No database changes required. All features are purely client-side.

