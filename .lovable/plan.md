

# Plan: OCR Sell Flow Fix, Index/Fund/Bond Support & ARQ Broker

## 3 Changes

### 1. OCR Sell Flow — Auto-select holding from positions

**Problem**: When OCR detects a sell, `populateFormFromData` sets `symbol`, `assetName`, `price`, etc. — but never calls `handleHoldingSelect` or sets `selectedHolding`. For sells, the form uses a `Select` dropdown of existing holdings, and the OCR path doesn't match the extracted symbol against that list.

**Fix in `populateFormFromData`**:
- After populating fields, if `trade_type === "sell"`, match the OCR symbol against `enrichedPositionHoldings`
- If match found: call `setSelectedHolding(matchedSymbol)` to auto-select the holding in the dropdown
- If no match: show toast warning "No tenés {SYMBOL} en cartera" and keep the form open for manual correction
- Also set `inputMode` to `"shares"` for sells (requirement #2)
- Set quantity from OCR data (not amount)

**Changes needed in `populateFormFromData`**: The function needs access to `enrichedPositionHoldings`. Since it's a `useCallback`, add it to the dependency array and add the matching logic inside.

### 2. Sell defaults to "shares" input mode

**Fix**: In `populateFormFromData`, when `trade_type === "sell"`, set `setInputMode("shares")`. Also in the manual sell flow (when user clicks "Sell" button), default to shares mode.

### 3. Add "ARQ" as international broker

**Data insert**: Add a new row to `brokers` table with name "ARQ", country "US" (international), category "digital", display_order 7.

### 4. Index/Fund/Bond OCR support

The `asset_type` enum already supports `etf`, `bond`, `other`. The OCR edge function already has these in its schema. The OCR prompt needs a small enhancement to better recognize index funds (SPY, FXI, EWZ, QQQ) as ETFs and bonds (AL30, GD30, etc.) as bonds. Also add `"fund"` or map funds to `etf` since there's no separate fund type.

**Edge function update**: Enhance the system prompt to explicitly mention common index ETFs and Argentine bonds, and to classify them correctly.

## File Changes

| File | Change |
|---|---|
| `src/pages/AddTrade.tsx` | Update `populateFormFromData` to auto-select holding for sells, default to shares mode for sells, show warning if symbol not in portfolio |
| `supabase/functions/analyze-trade-image/index.ts` | Enhance system prompt for better ETF/bond/index classification |
| Data insert | Add "ARQ" broker to `brokers` table |

## Technical Detail

### `populateFormFromData` sell matching logic:
```ts
// After setting all fields...
if (data.trade_type === "sell") {
  setInputMode("shares"); // default to shares for sells
  const normalized = (data.symbol || "").toUpperCase().trim();
  const match = enrichedPositionHoldings.find(
    h => h.symbol.toUpperCase() === normalized
  );
  if (match) {
    setSelectedHolding(match.symbol);
    setFormExpanded(true);
    // Fetch current quote for this symbol
    handleHoldingSelect(match.symbol);
    // But preserve OCR price
    if (data.price_per_unit) {
      setTimeout(() => setPrice(String(data.price_per_unit)), 100);
    }
  } else {
    toast.warning(`No tenés ${normalized} en cartera`);
  }
}
```

The `populateFormFromData` callback needs `enrichedPositionHoldings` in its dependencies. Since `handleHoldingSelect` fetches a quote that could overwrite the OCR price, we use a `setTimeout` to re-set the OCR price after the quote fetch starts.

