

# Market Prices Integration + Pie Chart Label Fix

## Problem Analysis

### Pages missing live market data:
1. **Index.tsx (Dashboard)** — Shows cost basis, realized PNL, holdings by avg cost. Missing: unrealized PNL, market value, current prices in holdings table.
2. **ExportReport.tsx (Portfolio card)** — Shows `totalInvested` and realized PNL only. Missing: market value, unrealized PNL.
3. **Players.tsx (Player overview + Compare)** — Pie charts show allocation by cost basis. Period PNL is realized-only. Missing: unrealized PNL for each player.

**AssetDetail.tsx** already fetches live prices correctly via `fetch-quote` — no changes needed there.

### Pie chart label contrast:
The `PortfolioPieChart` in Players.tsx renders labels with `label={({ name, value }) => ...}` but uses no explicit `fill` color, so the text inherits a default that clashes with the dark background. Same issue in Index.tsx pie chart (no labels, but tooltip text may also be affected).

---

## Implementation Plan

### 1. Create a reusable `useMarketPrices` hook

A new hook `src/hooks/useMarketPrices.tsx` that:
- Takes an array of symbols
- Calls `fetch-quote` for each (in parallel, with `Promise.all`)
- Returns `Map<string, number>` of symbol → current price
- Uses `@tanstack/react-query` with a 5-minute stale time to avoid excessive API calls
- Deduplicates symbols

### 2. Update Index.tsx (Dashboard)

- Import and use `useMarketPrices(holdings.map(h => h.symbol))`
- Add a new **Unrealized PNL** summary card: `sum((marketPrice - avgCost) * qty)` for all holdings
- Add a **Market Value** summary card: `sum(marketPrice * qty)`
- In the holdings table, add two columns: **Current Price** and **Market Value** (with loading skeleton)
- The allocation pie chart: optionally switch to market value instead of cost basis (or keep cost basis — it's still valid)

### 3. Update ExportReport.tsx (Portfolio card)

- Import `useMarketPrices`
- Add **Market Value** and **Unrealized PNL** to the stats grid (replacing or alongside existing stats)
- Show loading state while prices fetch

### 4. Update Players.tsx (Player overview + Compare)

- Import `useMarketPrices` for player's holdings symbols
- Add an **Unrealized PNL %** card to the overview (alongside the period PNL cards)
- In Compare tab, show unrealized PNL % for both users side by side

### 5. Fix pie chart label contrast (all pie charts)

- **Players.tsx `PortfolioPieChart`**: Add `fill="hsl(var(--foreground))"` and `fontSize={11}` to the label render props
- **Index.tsx allocation pie chart**: Add explicit label with high-contrast fill color
- **ExportReport.tsx pie chart**: Labels aren't shown (tooltip only), but ensure tooltip text has correct contrast

### Files changed

| File | Change |
|------|--------|
| `src/hooks/useMarketPrices.tsx` | New hook — batch fetch prices via `fetch-quote` |
| `src/pages/Index.tsx` | Add market value + unrealized PNL cards, current price column in holdings table |
| `src/pages/ExportReport.tsx` | Add market value + unrealized PNL to shareable card stats |
| `src/pages/Players.tsx` | Add unrealized PNL to overview; fix pie chart label `fill` color |
| `src/i18n/en.ts` + `es.ts` | Add keys: `board.marketValue`, `board.unrealizedPnl`, `board.currentPrice`, `social.unrealizedPnl` |

