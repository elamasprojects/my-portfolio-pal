

# Plan: Fix Price Chart — Data Source + Y-Axis Display

## Root Cause Analysis

**Two distinct bugs:**

1. **Y-Axis shows "$0" for all values**: The `tickFormatter` uses `v.toFixed(0)` which rounds to integer. For assets priced under $1 (crypto like fractional tokens), everything shows as "$0". The chart line IS rendering correctly (visible in screenshot), but the axis labels are useless.

2. **Finnhub stock candles require a paid subscription**: The free tier returns `{"s":"no_data"}` for the `/stock/candle` endpoint. Confirmed by testing — AAPL returns `{ candles: [] }`. The `fetch-quote` endpoint works fine on free tier, but historical candles do not. This means **stock charts never load**, only crypto charts (via CoinGecko fallback) work.

3. **Infinite re-fetch loop**: `now` is computed as `Math.floor(Date.now() / 1000)` at the component top level, meaning it changes every render, triggering the `useEffect` dependency repeatedly.

## Fix Plan

### 1. `supabase/functions/stock-history/index.ts` — Use Yahoo Finance (free, no key needed)

Replace the Finnhub candle call with Yahoo Finance's chart API, which is free and doesn't require authentication:

```
GET https://query1.finance.yahoo.com/v8/finance/chart/AAPL?range=1y&interval=1d
```

- Accepts `range` param: `1mo`, `3mo`, `6mo`, `1y`, `5y`, `max`
- Returns OHLCV data with timestamps
- Works for all US stocks, ETFs, and many international tickers
- Keep CoinGecko fallback for crypto
- Change the function signature to accept `{ symbol, range }` instead of `{ symbol, from, to }` since Yahoo uses range strings

### 2. `src/components/PriceChart.tsx` — Fix Y-axis + stabilize fetching

**Y-Axis fix**: Use smart formatting — if max value < $1, show decimals; if > $1000, show abbreviated. Replace `v.toFixed(0)` with a dynamic formatter.

**Stabilize `now`**: Wrap in `useMemo` or `useRef` so it doesn't change every render.

**Adapt to new API**: Pass `range` string directly instead of computing unix timestamps.

**Trade markers**: The `ReferenceDot` approach is correct but needs the `x` value to exactly match a `date` string in the candle data. Currently it finds the closest candle by timestamp, which is correct. No change needed for marker logic.

### Files modified

| File | Change |
|---|---|
| `supabase/functions/stock-history/index.ts` | Replace Finnhub candles with Yahoo Finance chart API; keep CoinGecko for crypto |
| `src/components/PriceChart.tsx` | Fix Y-axis formatter for small/large values; stabilize `now` to prevent re-fetch loop; adapt API call to new range-based params |

