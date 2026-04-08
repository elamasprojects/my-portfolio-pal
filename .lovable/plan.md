

# Plan: Daily Portfolio Performance Widget + Global Currency Display

## What We're Building

1. A **"Today's Performance"** card on the dashboard showing how much the portfolio gained/lost today (in $ and %)
2. A **Settings toggle** to show/hide this card
3. The existing currency toggle already works globally on the dashboard — no changes needed there

## How Daily Performance Works

Finnhub's `/quote` endpoint already returns `pc` (previous close) alongside `c` (current price). We just need to pass `pc` through to the frontend.

**Daily P&L formula**: For each holding, `(currentPrice - previousClose) * quantity`. Sum across all holdings = today's portfolio change.

## Changes

### 1. Edge Function: `supabase/functions/fetch-quote/index.ts`

Add `previousClose: quote.pc` to the response object (alongside the existing `price: quote.c`). For CoinGecko, use `price_change_24h` from the market data response.

### 2. Hook: `src/hooks/useMarketPrices.tsx`

- Expand the return type to include `previousClose` per symbol: `Map<string, { price: number; previousClose: number }>`
- Or simpler: add a second map `previousCloses: Map<string, number>`

### 3. Dashboard: `src/pages/Index.tsx`

Add a new card after the Hero card (or inside the 2x2 metrics grid, replacing or adding to it):

```text
┌────────────────────────────┐
│  TODAY'S PERFORMANCE       │
│  +$342.50  (+1.2%)         │
│  ▲ green or ▼ red          │
└────────────────────────────┘
```

- Calculates: `Σ (currentPrice - previousClose) × quantity` for all holdings
- Percentage: `dailyChange / (totalPortfolioValue - dailyChange) × 100`
- Respects the existing `displayCurrency` toggle (ARS/USD)
- Conditionally rendered based on `profile.show_daily_performance`

### 4. Profile/Settings: DB + UI

- **Migration**: Add `show_daily_performance boolean NOT NULL DEFAULT true` to `profiles` table
- **`src/hooks/useProfile.tsx`**: Add `show_daily_performance` to the Profile interface and select/update queries
- **`src/pages/Settings.tsx`**: Add a Switch toggle under the currency card: "Show daily performance on dashboard"

### 5. i18n: `src/i18n/en.ts` & `es.ts`

New keys: `board.todayPerformance`, `settings.showDailyPerformance`, `settings.showDailyPerformanceDesc`

## Files

| File | Change |
|---|---|
| `supabase/functions/fetch-quote/index.ts` | Return `previousClose` from Finnhub (`pc`) and CoinGecko |
| `src/hooks/useMarketPrices.tsx` | Expose `previousCloses` map |
| `src/pages/Index.tsx` | Add "Today's Performance" card, conditionally rendered |
| `src/hooks/useProfile.tsx` | Add `show_daily_performance` field |
| `src/pages/Settings.tsx` | Add toggle for daily performance visibility |
| `src/i18n/en.ts`, `es.ts` | 3 new keys |
| Migration | Add `show_daily_performance` column to `profiles` |

## Implementation Order

1. Migration (add column)
2. Update `fetch-quote` to return `previousClose`
3. Update `useMarketPrices` to expose previous closes
4. Update `useProfile` with new field
5. Add Settings toggle
6. Add dashboard card with daily performance

