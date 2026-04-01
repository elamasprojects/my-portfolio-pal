

# Plan: Enhanced Chart Markers + FIFO Trade Matching

This is a large feature with three distinct parts. I recommend implementing in **3 phases**.

---

## Phase 1: Enhanced Chart Markers (hover tooltips + dynamic sizes)

### What changes

**`src/components/PriceChart.tsx`**:

- **Enrich trade markers** with `quantity`, `total_amount`, and trade metadata
- **Dynamic dot radius**: Calculate relative size per trade type. For a single trade, use default `r=6`. For multiple buys (or sells), scale proportionally: `r = 4 + (quantity / maxQuantity) * 6` (range 4-10px)
- **Custom tooltip on marker hover**: Replace the default Recharts tooltip when hovering a `ReferenceDot`. Use a custom `label` prop on `ReferenceDot` that renders a styled div — green background for buy, red for sell — showing:
  - Date
  - Type (Buy/Sell)
  - Quantity + Price
  - Total amount

**Technical approach for custom hover**: Recharts `ReferenceDot` doesn't natively support hover tooltips. Instead:
1. Embed trade marker data directly into the `candles` data array (add optional `tradeMarker` field to each candle point that has a trade)
2. Use a **custom Tooltip component** that checks if the hovered point has a `tradeMarker` — if yes, render the buy/sell styled card; if no, render the default price tooltip
3. This avoids fighting Recharts limitations with `ReferenceDot` hover events

---

## Phase 2: FIFO Trade Matching (closed trades calculation)

### What changes

**New utility: `src/lib/tradeMatching.ts`**

Pure client-side FIFO matching logic:

```text
Input: trades[] sorted by date (buys + sells for one symbol)
Output: ClosedTrade[] — each sell "closes" a portion of a previous buy

Algorithm:
1. Maintain a queue of open buy lots: { date, price, remainingQty }
2. For each sell (chronological):
   - Consume from oldest buy lot until sell qty is filled
   - Each consumption = one ClosedTrade with:
     - buyDate, buyPrice, sellDate, sellPrice
     - quantity (portion closed)
     - pnl = (sellPrice - buyPrice) * quantity
     - returnPct = (sellPrice - buyPrice) / buyPrice * 100
```

No DB changes — purely derived from existing trades.

---

## Phase 3: Closed Trades UI on Asset Detail Page

### What changes

**`src/pages/AssetDetail.tsx`**:

Add a new Card section "Closed Trades" between the chart and the trade history table. Each row shows:
- Buy date → Sell date
- Quantity closed
- Buy price → Sell price
- P&L ($) and Return (%)
- Green/red styling based on profit/loss

If there are remaining open shares, show a summary row: "X shares still open @ avg $Y"

### i18n keys (6 new)

`asset.closedTrades`, `asset.openShares`, `asset.buyDate`, `asset.sellDate`, `asset.tradeReturn`, `asset.stillOpen`

---

## Implementation Order

| Phase | Files | Description |
|-------|-------|-------------|
| 1 | `src/components/PriceChart.tsx` | Custom tooltip + dynamic dot sizes |
| 2 | `src/lib/tradeMatching.ts` (new) | FIFO matching utility |
| 3 | `src/pages/AssetDetail.tsx`, `src/i18n/en.ts`, `es.ts` | Closed trades card using matching utility |

Each phase is independently shippable. Phase 1 enhances the existing chart. Phase 2 is a pure utility with no UI. Phase 3 uses Phase 2 to render the closed trades view.

