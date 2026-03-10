

# Multi-Image Upload: Sequential Trade Entry

## How it works today

1. User picks "Screenshot" entry mode → uploads ONE image
2. AI extracts trade data → form auto-fills → user reviews and submits
3. Confirmation card flips showing single trade details
4. "Add another" resets everything

## Proposed Flow

```text
Screenshot mode → file picker (multiple) → N images selected
                                            ↓
                              Analyze all images in parallel
                                            ↓
                              Queue of N extracted trades
                                            ↓
                         Show trade 1/N in the existing form
                         User reviews/edits → "Add Trade (1 of 5)"
                                            ↓
                         Auto-advance to trade 2/N (form re-fills)
                                            ↓
                              ... repeat until N/N ...
                                            ↓
                         Final confirmation: summary of ALL trades
                         with list of symbols, totals, and count
```

## Changes

### `src/pages/AddTrade.tsx`

**New state for multi-image queue:**
- `screenshotQueue`: array of `{ file, status, extractedData? }[]`
- `currentQueueIndex`: which trade is being reviewed (0-based)
- `submittedTrades`: array of `SubmittedTrade[]` (accumulates all submitted trades)

**Modified file input:**
- Add `multiple` attribute to the hidden file input
- `handleFileChange` / `handleDrop` accepts multiple files (max 10)
- When multiple files detected: analyze all in parallel (with 3-concurrency limit), store results in `screenshotQueue`
- Show a small progress indicator: "Analyzing 3/5 images..."

**Modified form behavior when queue active:**
- When `screenshotQueue` has items, auto-populate form from `screenshotQueue[currentQueueIndex].extractedData`
- Submit button text changes: `"Add Trade (1 of 5)"` instead of `"Add Trade BUY"`
- On submit success: push to `submittedTrades[]`, increment `currentQueueIndex`, re-populate form with next item
- If it's the last trade: flip to confirmation

**Modified confirmation card (back of flip):**
- When `submittedTrades.length > 1`: show batch summary instead of single trade
- Title: "X trades recorded" 
- List each trade: symbol, type badge, total
- Grand total at the bottom
- "Add more" button resets everything

**Single image still works identically** — if only 1 file is selected, the queue has 1 item and behaves exactly as today.

### `src/i18n/en.ts` and `src/i18n/es.ts`

New keys:
- `addTrade.analyzingMultiple`: "Analyzing {current}/{total} images..."
- `addTrade.tradeOf`: "Add Trade ({current} of {total})"
- `addTrade.allTradesRecorded`: "All trades recorded"
- `addTrade.batchSummary`: "{count} trades submitted successfully"
- `addTrade.grandTotal`: "Grand Total"
- `addTrade.skipTrade`: "Skip"

### No database or edge function changes needed

The existing `analyze-trade-image` function handles one image at a time. The multi-image logic is purely client-side orchestration — we call the function N times in parallel.

