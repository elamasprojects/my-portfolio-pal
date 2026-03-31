

# Plan: Automatic Dividend Tracking

## API Analysis

Finnhub (current API) provides two dividend endpoints:

1. **`/stock/dividends?symbol=X&from=DATE&to=DATE`** — Historical dividends with ex-date, pay-date, amount, currency. Weight: 10 API calls per request. Free tier: 60 calls/minute.
2. **`/stock/basic-dividends?symbol=X`** — Current dividend yield and annual dividend per share.

Both are per-symbol, so we must query each holding individually. No "all dividends for all stocks" bulk endpoint exists.

## Two Features

### Feature A: Weekly Dividend Auto-Detection (retroactive)

A scheduled edge function that runs weekly via `pg_cron`. For each user's open positions, it queries Finnhub `/stock/dividends` for the past 7 days. If a dividend was paid (ex-date fell in that window) and the user held the stock, it automatically inserts a `dividend` trade into the `trades` table.

**Flow:**
1. Edge function `check-dividends` runs weekly
2. Queries `portfolio_positions` to get all unique symbols with open positions
3. For each symbol, calls Finnhub `/stock/dividends?from=7_days_ago&to=today`
4. If a dividend is found, checks which users hold that symbol and how many shares
5. Inserts a `dividend` trade with `quantity = shares held`, `price_per_unit = dividend_amount`, auto-generated note "Auto-detected dividend"
6. Deduplication: before inserting, checks if a dividend trade already exists for that user/symbol/date

**Considerations:**
- Rate limiting: with ~50 unique symbols across all users, that's 50 calls (weight 10 each = 500 effective calls). Free tier allows 60/min, so we'd need to batch with delays (~1 second between calls)
- Only works for US-listed stocks (Finnhub coverage). Argentine stocks (`.BA` suffix) may not have dividend data

### Feature B: Dividend Projection Dashboard

When a user buys a stock, fetch its dividend calendar and show projected future income.

**Flow:**
1. On the Dashboard or AssetDetail page, call `/stock/basic-dividends` to get annual dividend per share
2. Multiply by user's quantity to show projected annual dividend income
3. Show a "Dividend Projection" card: per-holding expected dividends and total portfolio dividend yield

**Implementation:**
- New edge function `fetch-dividends` that wraps Finnhub's dividend endpoints
- New section on Dashboard showing projected dividend income per holding
- Could also show a dividend calendar (upcoming ex-dates)

## Recommended Approach

Start with **Feature A** (auto-detection) as it solves the core pain point (manually entering dividends). Feature B (projection) can be added later as an enhancement.

### Files to create/modify

| File | Change |
|---|---|
| `supabase/functions/check-dividends/index.ts` | New edge function: fetch dividends for all held symbols, auto-insert trades |
| `src/pages/Index.tsx` | Add "Projected Dividends" card showing annual estimate per holding |
| `src/i18n/en.ts`, `es.ts` | New keys for dividend projection labels |

### Database changes

- A `pg_cron` job to invoke `check-dividends` weekly (via SQL insert, not migration)
- Enable `pg_cron` and `pg_net` extensions if not already enabled (migration)

### Edge function logic (`check-dividends`)

```text
1. Query portfolio_positions → get distinct symbols
2. For each symbol (with 1s delay between calls):
   a. GET /stock/dividends?symbol=X&from=7d_ago&to=today
   b. For each dividend found:
      - Query portfolio_positions WHERE symbol = X
      - For each user holding:
        - Check if dividend trade already exists (same symbol, same date, trade_type='dividend')
        - If not, INSERT into trades (trade_type='dividend', quantity=shares, price_per_unit=dividend_amount)
3. Return summary of inserted dividends
```

### Rate limit strategy

- Batch symbols: query distinct symbols across ALL users (not per-user), reducing calls
- Add 1-second delay between Finnhub calls
- If >60 symbols, split into chunks and process across multiple minutes

### Limitations to communicate to user

- Only works for US stocks with Finnhub coverage
- Free Finnhub tier has 60 calls/min limit — works for portfolios with <50 unique symbols total
- Argentine stocks (`.BA`) may not return dividend data
- Weekly check means dividends are detected with up to 7-day delay

