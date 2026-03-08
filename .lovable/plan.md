

# Two Changes: Sidebar Footer Layout + Live Price on Asset Detail

## 1. Sidebar footer: only stack vertically when collapsed

Currently the footer always uses `flex-col`. Change it so:
- **Expanded**: horizontal row layout with avatar + username info and inbox icon side by side (original design)
- **Collapsed**: vertical stack with Inbox above, Avatar below

### `src/components/AppSidebar.tsx`
Use the existing `collapsed` variable to conditionally switch between `flex-row` and `flex-col` layouts in the footer div.

## 2. Fetch live price on `/asset/:symbol` page

When the user visits an asset detail page, call the existing `fetch-quote` edge function to get the current market price, then display unrealized P&L.

### `src/pages/AssetDetail.tsx`
- Add a `useEffect` that calls `supabase.functions.invoke('fetch-quote', { body: { symbol } })` on mount
- Store `currentPrice` and `loading` state
- Add new cards to the stats grid:
  - **Current Price**: shows live price
  - **Market Value**: `currentPrice * holding.net_quantity`
  - **Unrealized P&L**: `(currentPrice - holding.avg_cost) * holding.net_quantity` with gain/loss coloring
  - **Unrealized %**: percentage change from avg cost
- Show a loading skeleton while the quote is being fetched
- Only show these cards when `holding.net_quantity > 0` (open position exists)

### `src/i18n/en.ts` and `src/i18n/es.ts`
Add new translation keys:
- `asset.currentPrice` — "Current Price" / "Precio Actual"
- `asset.marketValue` — "Market Value" / "Valor de Mercado"
- `asset.unrealizedPnl` — "Unrealized P&L" / "P&L No Realizado"
- `asset.unrealizedPct` — "Unrealized %" / "% No Realizado"

### Files to change
1. `src/components/AppSidebar.tsx` — conditional footer layout
2. `src/pages/AssetDetail.tsx` — fetch quote + display unrealized P&L cards
3. `src/i18n/en.ts` — add 4 new keys
4. `src/i18n/es.ts` — add 4 new keys

