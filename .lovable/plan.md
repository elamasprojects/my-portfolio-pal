

# Currency Display in Trade Log + Bulk Upload Plan

## Part 1: Currency Display in Trade Log

### Database Migration
Add two columns to the `trades` table:
- `original_currency` (text, default `'USD'`) — stores which currency the trade was entered in
- `original_price` (numeric, nullable) — stores the original price before USD conversion

```sql
ALTER TABLE public.trades ADD COLUMN original_currency text NOT NULL DEFAULT 'USD';
ALTER TABLE public.trades ADD COLUMN original_price numeric;
```

### Code Changes

**`src/hooks/usePortfolio.tsx`** — Add `original_currency` and `original_price` to the `Trade` interface.

**`src/pages/TradeLog.tsx`** — Add a "Ccy" column after "Total" showing a small badge (`🇺🇸 USD` or `🇦🇷 ARS`). Also update CSV export to include the currency column.

**`src/pages/AddTrade.tsx`** — When inserting a trade, save `original_currency` and `original_price` (the price before MEP conversion) alongside the existing USD-normalized values. Find the insert call and add these two fields.

**`src/components/EditTradeDialog.tsx`** — Display the original currency as read-only info when editing a trade.

### Display Format
In the Trade Log table, a new narrow column "Ccy" shows:
- `🇺🇸` for USD trades
- `🇦🇷` for ARS trades

This is a simple visual indicator — no conversion logic in the table itself.

---

## Part 2: Bulk Screenshot Upload (Plan Only)

### Overview
Allow users to select multiple screenshots at once. Each image is analyzed by the existing `analyze-trade-image` edge function in parallel, then presented in a review queue before final submission.

### UI Flow

```text
┌──────────────────────────────────────┐
│  Upload Screenshots                  │
│  [Drop zone / file picker]           │
│  "Select up to 10 images"           │
└──────────────────────────────────────┘
         ↓ files selected
┌──────────────────────────────────────┐
│  Processing Queue                    │
│  ┌────┬──────┬────────┬──────────┐   │
│  │ #  │ File │ Status │ Result   │   │
│  ├────┼──────┼────────┼──────────┤   │
│  │ 1  │ img1 │ ✅ Done │ AAPL BUY│   │
│  │ 2  │ img2 │ ⏳ ...  │ —       │   │
│  │ 3  │ img3 │ ❌ Fail │ Retry   │   │
│  └────┴──────┴────────┴──────────┘   │
└──────────────────────────────────────┘
         ↓ all processed
┌──────────────────────────────────────┐
│  Review & Edit                       │
│  Card per trade: symbol, qty, price  │
│  [Edit] [Remove] per card           │
│  ─────────────────────────────       │
│  [Submit All X Trades]              │
└──────────────────────────────────────┘
```

### Implementation Details

1. **New component**: `src/components/BulkUpload.tsx`
   - Multi-file input (`accept="image/*"`, `multiple`, max 10)
   - State: array of `{ file, status: 'pending'|'processing'|'done'|'error', result? }`
   - Process images with `Promise.allSettled()`, 3 concurrent max to avoid rate limits
   - Each calls `supabase.functions.invoke("analyze-trade-image", { body: { image: base64 } })`

2. **Review queue**: Editable card grid showing extracted data per image
   - Users can edit symbol, quantity, price, date, currency, trade type
   - Remove individual trades or retry failed ones
   - "Submit All" button inserts all trades in a single batch

3. **Integration**: Add a "Bulk Upload" tab/button in `AddTradeHub.tsx` or as a new entry mode in `AddTrade.tsx`

4. **Rate limiting**: Queue with concurrency limit (3 parallel calls), show progress bar

5. **Edge function**: No changes needed — the existing `analyze-trade-image` function handles single images; the bulk logic is client-side orchestration

### Files to Create/Modify
- **New**: `src/components/BulkUpload.tsx`
- **Modified**: `src/pages/AddTradeHub.tsx` (add bulk upload entry point)

This bulk upload feature will be implemented in a follow-up after the currency display is complete.

