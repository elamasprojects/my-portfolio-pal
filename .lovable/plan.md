

# Fix Screenshot Trade Import + UI Tweaks

## Problems Identified

1. **Screenshot data overwritten by API**: When the AI extracts symbol/price/date from screenshot, the `useEffect` that auto-fetches quotes fires on symbol change and overwrites the AI-extracted `price` and `assetName`. Only the asset name should come from the API; price, date, and quantity must be preserved from the image.

2. **Insert fails on `total_amount`**: The `trades` table has `total_amount` as a generated column. The insert sends it explicitly, causing a `428C9` Postgres error. Must remove `total_amount` from the insert payload.

3. **Default input mode**: Should be `"amount"` instead of `"shares"`.

4. **Toggle placement**: Move the Shares/Amount toggle from the header row down next to the "Dollar Amount" / "Shares" label.

## Changes (all in `src/pages/AddTrade.tsx`)

### 1. Track screenshot origin, skip price overwrite
- Add a `fromScreenshot` ref/state. Set it to `true` in `handleImageUpload` on success.
- In the `useEffect` that fetches quotes (line 170-194): when `fromScreenshot` is true, only fetch the asset name — do NOT overwrite `price` or `tradeDate`. After applying, reset the flag.

### 2. Remove `total_amount` from insert
- Line 274: delete `total_amount: finalTotal` from the `.insert()` call. The DB computes it automatically.

### 3. Default `inputMode` to `"amount"`
- Line 60: change initial state from `"shares"` to `"amount"`.
- Line 344 (`resetFields`): change reset value from `"shares"` to `"amount"`.
- Line 326 (`handleAddAnother`): change reset value from `"shares"` to `"amount"`.

### 4. Move toggle next to input label
- Remove the toggle from the header area (lines 705-719).
- Place it inline next to the "Shares" or "Dollar Amount" label (lines 768/803), as a row with label + toggle.

