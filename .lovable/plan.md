

# Plan: Historical Stock Chart with Buy/Sell Markers

## What We're Building

A price chart on the AssetDetail page (`/asset/:symbol`) showing the historical price of the stock with visual markers (arrows/dots) indicating where the user bought and sold. This lets users visually evaluate their entry/exit timing.

## API Choice

**Finnhub stock candles endpoint** (`/stock/candle?symbol=X&resolution=D&from=UNIX&to=UNIX`) — already have `finnhub_api_key` configured. Returns OHLCV data. Free tier supports this. For crypto, fall back to CoinGecko's `/market_chart/range` endpoint (already used in `dca-history`).

## Changes

### 1. New Edge Function: `supabase/functions/stock-history/index.ts`

- Accepts `{ symbol, from, to }` (unix timestamps)
- Tries Finnhub `/stock/candle` first (resolution=D for daily candles)
- Returns `{ candles: [{ time, open, high, low, close }] }`
- Falls back to CoinGecko `/coins/{id}/market_chart/range` for crypto (same mapping as `fetch-quote`)
- CORS headers, `verify_jwt = false`

### 2. Updated: `src/pages/AssetDetail.tsx`

- Add a new `Card` section between the P&L cards and the trade history table
- Contains a **Recharts AreaChart** showing daily close prices
- **Buy markers**: Green upward triangles on the chart at buy dates/prices
- **Sell markers**: Red downward triangles at sell dates/prices
- **Time range selector**: buttons for 1M, 3M, 6M, 1Y, ALL (defaults to 1Y or ALL based on first trade date)
- Fetches data via `supabase.functions.invoke("stock-history", { body: { symbol, from, to } })`
- Overlays trade markers using Recharts `ReferenceDot` components positioned at the trade date + trade price

```text
┌─────────────────────────────────┐
│  Price History          [1M][3M][6M][1Y][ALL]  │
│  ╭─────────────╮                               │
│  │   ▲ buy     │  Area chart with              │
│  │  /  \  ▼sell│  gradient fill                │
│  │ /    \_/    │                                │
│  ╰─────────────╯                               │
│  ▲ = Buy  ▼ = Sell                             │
└─────────────────────────────────┘
```

### 3. Config: `supabase/config.toml`

- Add `[functions.stock-history]` with `verify_jwt = false`

### 4. i18n: `src/i18n/en.ts` & `es.ts`

New keys: `asset.priceHistory`, `asset.chartLoading`, `asset.noChartData`

## Files

| File | Change |
|---|---|
| `supabase/functions/stock-history/index.ts` | New edge function for historical candles |
| `supabase/config.toml` | Add stock-history entry |
| `src/pages/AssetDetail.tsx` | Add chart section with AreaChart + trade markers |
| `src/i18n/en.ts`, `es.ts` | 3 new keys |

