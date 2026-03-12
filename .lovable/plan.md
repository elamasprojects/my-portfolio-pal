

# Fix Export Card Size, Players UX & OCR Sell Matching

## Issue 1: Export Card Too Small

The card at line 152 uses `max-w-4xl` (896px) which on a 1453px viewport leaves it feeling small. Remove the `max-w-4xl` constraint and let it use the full available width. Also increase internal padding and font sizes for better visual impact.

### Changes in `src/pages/ExportReport.tsx`
- Remove `max-w-4xl` from outer container, use `max-w-6xl`
- Increase stat values from `text-lg` to `text-2xl`
- Increase stat labels from `text-[10px]` to `text-xs`
- Increase avatar to `h-12 w-12`, username to `text-base`
- Increase padding from `p-8` to `p-10`

---

## Issue 2: Players Page UX Improvements

After inspecting the 979-line Players page, key UX issues:

1. **No empty state illustration** — just text when no connections
2. **Connection switcher pills are small and flat** — need more visual weight
3. **Stats grid uses plain Cards with no visual hierarchy** — all look the same
4. **Pie chart has small radius** (90/45) — should be larger
5. **Podium section is visually weak** — needs better spacing and sizing
6. **Search popover is cramped** — should be wider with better result cards

### Changes in `src/pages/Players.tsx`
- Add visual empty state with larger icon and call-to-action
- Increase connection switcher pill size and add subtle shadow on active
- Add colored accents to stat cards (win rate gets green/red tint based on value)
- Increase pie chart outerRadius to 110, innerRadius to 55, chart height to 300px
- Improve podium: larger avatars (h-12 w-12), wider columns (w-24), bigger medal icons
- Search popover wider (w-96) with better spacing
- Add subtle hover animations on cards

---

## Issue 3: OCR Sell Matching — Root Cause Analysis

### Current workflow (step by step):

1. User uploads screenshot → `handleImageUpload` (single) or `processQueue` (multi)
2. **Single image path** (`handleImageUpload`, line 278): Manually sets fields (`setTradeType`, `setSymbol`, etc.) but **never calls `populateFormFromData`**. This means the OCR sell matching logic (lines 249-274) is NEVER executed for single images.
3. **Multi image path** (`processQueue`, line 186): Calls `populateFormFromData` which DOES have sell matching.
4. Even in `populateFormFromData`, the sell matching depends on `enrichedPositionHoldings` which comes from `usePortfolioPositions()` — an async query. If positions haven't loaded when OCR completes, `enrichedPositionHoldings` is empty and no match is found.
5. The `inputMode` default is `"amount"` (line 88, reset in `resetFormFields` line 663). Neither the single-image nor multi-image path for sells consistently sets it to `"shares"`.

### Three possible solutions:

**A) Unify paths — route single image through `populateFormFromData`** (Selected)
- Remove the duplicate field-setting logic in `handleImageUpload`
- Have it call `populateFormFromData` just like the multi-image path
- This ensures sell matching runs for ALL screenshot uploads
- Add a guard: if positions haven't loaded yet, retry matching after positions arrive

**B) Add sell matching as a separate effect**
- Create a `useEffect` that watches for `tradeType === "sell" && symbol && !selectedHolding && positions.length > 0` and auto-matches
- Pro: decoupled from upload path. Con: more complex, race conditions

**C) Move sell matching to the form rendering level**
- Instead of matching at upload time, always show the select dropdown and pre-filter based on OCR symbol
- Con: changes form behavior significantly

**Selected: Option A** — cleanest, single source of truth, and adds a retry mechanism.

### Fix plan:

1. **Refactor `handleImageUpload`** to call `populateFormFromData(data)` instead of manually setting each field
2. **Add a retry effect**: when `positions` finishes loading and `tradeType === "sell"` and `selectedHolding === ""` and `symbol !== ""`, re-attempt matching
3. **Force `inputMode = "shares"` for sells** in both `populateFormFromData` and the manual sell button click

### Changes in `src/pages/AddTrade.tsx`
- Refactor `handleImageUpload` to use `populateFormFromData`
- Add `useEffect` for deferred sell matching when positions load late
- In manual sell button click handler (line 1034-1037), add `setInputMode("shares")`

---

## Summary of file changes

| File | Change |
|---|---|
| `src/pages/ExportReport.tsx` | Remove `max-w-4xl`, increase sizing throughout |
| `src/pages/Players.tsx` | UX improvements: empty state, larger charts, better podium, wider search |
| `src/pages/AddTrade.tsx` | Unify single-image handler with `populateFormFromData`, add deferred sell matching effect, default sells to shares mode |

