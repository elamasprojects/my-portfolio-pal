

## Restructure Add Trade: Trade Type First, Smart Sell Flow

### What changes

Move the Buy/Sell selection to the very top of the form as Step 1. The rest of the form adapts based on the selection:

- **Buy**: Shows the existing symbol lookup flow (type a ticker, auto-fetch quote, fill details).
- **Sell**: Fetches the user's current holdings (symbols with net positive quantity from buy trades), displays them as a selectable list. Selecting one auto-fills symbol, asset name, asset type, and fetches the current price. The user can only sell assets they own.

### New flow

```text
Step 1: Trade Type (Buy / Sell)
  ├── Buy  → Symbol Lookup input (existing flow)
  └── Sell → Holdings picker (Select dropdown of owned symbols)
              → Auto-fills symbol, assetName, assetType, fetches live price
Step 2: Asset Details (auto-filled, editable)
Step 3: Trade Details (quantity/amount, price, date, notes)
Step 4: Order Summary + Submit
```

### Technical details

**Holdings query** (runs when user selects "sell"):
- Query all trades for the user's portfolio, grouped by symbol
- Calculate net shares per symbol: sum of buy quantities minus sum of sell quantities
- Filter to symbols with net shares > 0
- Display as a `Select` dropdown showing `SYMBOL — Asset Name (X shares available)`

**Sell quantity validation**:
- When selling, cap the max quantity to the available shares for that symbol
- Show "X shares available" hint below the quantity input

### Files to modify

1. **`src/pages/AddTrade.tsx`** — restructure form order, add holdings fetch, add sell picker, move buy/sell toggle to top as first section, add available shares validation

### UI layout

```text
┌─────────────────────────────┐
│ Trade Type                  │
│ [  BUY  ] [  SELL  ]        │
├─────────────────────────────┤
│ (if BUY)  Symbol Lookup     │
│ [AAPL________________]      │
│                             │
│ (if SELL) Select Asset      │
│ [▾ AAPL — Apple (10 sh) ]   │
├─────────────────────────────┤
│ Asset Details (auto-filled) │
├─────────────────────────────┤
│ Trade Details               │
├─────────────────────────────┤
│ Order Summary               │
└─────────────────────────────┘
```

