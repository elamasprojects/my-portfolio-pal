

## Add Trade Page Enhancements

### Overview

Rework the Add Trade page with five enhancements: shares/amount toggle, UI polish, confetti on submit, confirmation page with flip animation and blue background, and an "Add Another" button.

### 1. Shares vs Amount Toggle

Add a toggle in the Trade Details section letting users choose between entering **Shares** (quantity) or **Dollar Amount**. When "Amount" is selected, auto-calculate quantity from `amount / price`. The submitted data always stores `quantity` and `price_per_unit`.

### 2. UI Enhancements

- Slightly larger section headers with better spacing
- Subtle border-left accent on each section
- Buy/Sell toggle styled as pill buttons (green for buy, red for sell) instead of a dropdown
- Smoother transitions when sections unlock (animate height + opacity)

### 3. Confetti Animation

Use `canvas-confetti` (lightweight, no-dependency library) triggered after successful trade submission. Fire a burst of confetti from the center of the screen lasting ~2 seconds.

### 4. Confirmation Page with Flip Transition

After submit success, transition from the form to a confirmation view using a CSS 3D card flip:
- The card container uses `perspective` and `transform-style: preserve-3d`
- Front face = the form, Back face = confirmation details
- On success: rotate Y 180deg over 0.6s, simultaneously transition the page background to a blue gradient (`from-primary/20 to-background`)
- Confirmation shows: symbol, name, trade type (buy/sell badge), quantity, price, total, date, and a checkmark icon

### 5. "Add Another Trade" Button

On the confirmation page, an "Add Another Trade" button flips the card back (reverse animation), resets all form state, and returns to the blank form.

### Technical Details

**New dependency**: `canvas-confetti` (install via npm)

**Files to modify**:
- `src/pages/AddTrade.tsx` — full rewrite with:
  - `inputMode` state: `"shares"` | `"amount"` 
  - `amount` state for dollar amount entry
  - `submitted` boolean + `submittedTrade` object storing the completed trade data
  - `flipped` boolean controlling the CSS flip
  - Buy/Sell pill toggle replacing the Select
  - Confetti trigger on successful submit
  - Two-sided card: form front, confirmation back
  - Background color transition on the wrapper div
- `tailwind.config.ts` — add `flip-to-back` / `flip-to-front` keyframes

**State flow**:
```text
Form (front) → Submit → Insert to DB → Set submittedTrade → Set flipped=true → Fire confetti → Background transitions to blue
                                                                                                    ↓
                                                                              Confirmation (back) ← flip animation
                                                                                    ↓
                                                                          "Add Another" → Reset state → flipped=false → back to form
```

### Files

1. **Edit** `src/pages/AddTrade.tsx` — all UI changes, confirmation page, confetti, flip logic
2. **Edit** `tailwind.config.ts` — add flip keyframes and perspective utilities

