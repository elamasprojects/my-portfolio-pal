

## Auto-fill Price & Asset Name via Finnhub

### Overview

Create a Supabase Edge Function that calls the Finnhub API using the existing `finnhub_api_key` secret. When the user fills in the symbol field on `/add`, debounce for ~500ms, then call the edge function to fetch the current quote price and company profile (name). Auto-populate the "Price per Unit" and "Asset Name" fields.

### Edge Function: `fetch-quote`

**File**: `supabase/functions/fetch-quote/index.ts`

- Accepts `?symbol=AAPL` query param
- Calls two Finnhub endpoints:
  - `https://finnhub.io/api/v1/quote?symbol=AAPL` → returns `c` (current price)
  - `https://finnhub.io/api/v1/stock/profile2?symbol=AAPL` → returns `name` (company name)
- Uses `finnhub_api_key` from `Deno.env.get()`
- Returns `{ price, name, symbol }`
- CORS headers included
- No JWT verification needed (public quote data, no user data)

**Config** (`supabase/config.toml`):
```toml
[functions.fetch-quote]
verify_jwt = false
```

### Frontend Changes: `src/pages/AddTrade.tsx`

- Add a `useEffect` that watches `symbol` with a 500ms debounce
- When symbol is 1+ characters, call the edge function via `supabase.functions.invoke('fetch-quote', { body: { symbol } })`
- On success: set `price` and `assetName` from response
- Show a small loading indicator next to the symbol field while fetching
- User can still manually override the auto-filled values

### Files to create/modify

1. **Create** `supabase/functions/fetch-quote/index.ts` — edge function
2. **Edit** `supabase/config.toml` — add `verify_jwt = false` for the function
3. **Edit** `src/pages/AddTrade.tsx` — add debounced lookup on symbol change

