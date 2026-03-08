

# OCR Trade Import via AI Image Analysis

## Overview

Add an image-based trade input mode to the "New Move" page. Before the current manual flow, present two options: "Manual" and "From Screenshot". The screenshot mode lets users upload a trade confirmation image, which gets analyzed by AI to auto-populate all form fields.

## Architecture

```text
User uploads image
  → base64 sent to edge function `analyze-trade-image`
  → Edge function calls Lovable AI (gemini-2.5-flash, supports vision)
  → AI extracts: trade_type, symbol, asset_name, quantity, price, date
  → Response auto-fills the manual form fields
  → User reviews and submits normally
```

## Implementation

### 1. Reference image

Copy the uploaded reference image to `src/assets/trade-screenshot-example.jpg`. This image is shown inside a tooltip to guide users on what kind of screenshot to upload.

### 2. Edge function: `supabase/functions/analyze-trade-image/index.ts`

- Receives `{ image: "data:image/..." }` from client
- Calls Lovable AI gateway with `google/gemini-2.5-flash` (vision-capable, cheap)
- Uses tool calling to extract structured output: `{ trade_type, symbol, asset_name, asset_type, quantity, price_per_unit, trade_date }`
- Returns the extracted fields as JSON
- Handles 429/402 errors properly

### 3. Update `supabase/config.toml`

Add `[functions.analyze-trade-image]` with `verify_jwt = false`.

### 4. Modify `src/pages/AddTrade.tsx`

**Before the trade type selector**, add an input mode choice:

- Two cards: "Manual" (pencil icon) and "From Screenshot" (camera icon)
- Default: none selected (user must pick)
- When "Manual" is selected, show the existing form as-is
- When "From Screenshot" is selected, show:
  - A file upload dropzone for the image
  - Next to it, an info icon with a tooltip. On hover, the tooltip shows the reference image and text: "Screenshot your trade confirmation like this and upload it here"
  - Loading state while AI processes
  - On success: auto-set `tradeType`, `symbol`, `assetName`, `assetType`, `quantity`, `price`, `tradeDate` and switch to the manual form view so the user can review/edit before submitting

### 5. i18n keys

Add new keys to `en.ts` and `es.ts` for the new UI strings (input mode labels, tooltip text, processing messages).

## Files

```text
NEW:
  src/assets/trade-screenshot-example.jpg  — copied from user upload
  supabase/functions/analyze-trade-image/index.ts — AI vision edge function

MODIFIED:
  supabase/config.toml        — add function config
  src/pages/AddTrade.tsx       — add input mode selector + image upload flow
  src/i18n/en.ts               — new translation keys
  src/i18n/es.ts               — new translation keys
```

## Technical Details

- Model: `google/gemini-2.5-flash` — cheapest vision-capable model, ideal for structured extraction
- Uses tool calling (not JSON mode) for reliable structured output
- The AI prompt instructs the model to identify buy/sell from context clues in the screenshot
- After extraction, the form switches to manual mode with all fields pre-filled so the user can verify and correct before submitting

