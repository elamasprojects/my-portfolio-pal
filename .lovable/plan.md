

# Multi-Currency Support (ARS/USD) with Dolar MEP

## Overview

Add ARS/USD currency support across the app. All trades are stored in USD internally. When a user enters a trade in ARS, it gets converted to USD using the Dolar MEP rate. The dashboard toggle lets users view all values in either currency. The OCR edge function detects ARS vs USD automatically.

## Database Changes

**Add `default_currency` column to `profiles` table:**
```sql
ALTER TABLE public.profiles ADD COLUMN default_currency text NOT NULL DEFAULT 'USD';
```

No new tables needed. Trades remain stored in USD — conversion happens at input/display time.

## New Files

### `src/hooks/useDolarMEP.tsx`
- React Query hook that fetches `https://dolarapi.com/v1/dolares/bolsa`
- Returns `{ venta, compra, isLoading }` — we use `venta` for conversions
- `staleTime: 5min` to avoid excessive calls
- Export a helper `convertArsToUsd(ars, rate)` and `convertUsdToArs(usd, rate)`

### `src/components/CurrencyToggle.tsx`
- Small toggle component with AR 🇦🇷 / US 🇺🇸 flags
- Takes `value: "ARS" | "USD"` and `onChange`
- Inline next to the h1 on the Board page
- Shows small text "Dólar MEP" beneath or as tooltip

## Modified Files

### `src/pages/Index.tsx` (Board/Dashboard)
- Import `useDolarMEP` and `CurrencyToggle`
- Add local state `displayCurrency` initialized from profile's `default_currency`
- Place `CurrencyToggle` inline next to the h1
- Wrap all dollar amounts with a conversion multiplier: if ARS, multiply by MEP rate; show `$` for USD, `ARS$` for ARS
- Add small caption "Tipo de cambio: Dólar MEP" when ARS is selected

### `src/pages/Settings.tsx`
- Add a new Card section "Default Currency"
- Radio or toggle: USD / ARS with flag emojis
- Persists to `profiles.default_currency`
- Helper text: "El tipo de cambio utiliza el Dólar MEP"

### `src/hooks/useProfile.tsx`
- Add `default_currency` to the Profile interface and select query
- Include it in `updateProfile` mutation

### `src/pages/AddTrade.tsx`
- Add a currency toggle (ARS/USD) near the price input, defaulting to profile's `default_currency`
- When currency is ARS: after user enters price, convert to USD using MEP rate before storing
- Show the converted USD value as preview text
- For amount mode: same logic — convert ARS amount to USD

### `supabase/functions/analyze-trade-image/index.ts`
- Add `currency` field to the extraction schema: `enum: ["USD", "ARS"]`
- Update system prompt to detect currency from context clues (pesos, ARS, $AR, Argentine brokers like IOL/Balanz/Bull Market)
- Return `currency` in the response

### `src/pages/AddTrade.tsx` (OCR handling)
- When OCR returns `currency: "ARS"`, auto-set the currency toggle to ARS
- The existing conversion logic handles the rest

### `src/i18n/en.ts` + `src/i18n/es.ts`
- Add keys: `settings.defaultCurrency`, `settings.currencyHelper`, `board.exchangeRate`, `addTrade.currency`, `addTrade.convertedToUsd`, etc.

## Data Flow

```text
User enters ARS price → fetch MEP rate → convert to USD → store in DB as USD
User views Board in ARS → fetch MEP rate → multiply all USD values × rate → display
```

All internal storage remains USD. The MEP rate is fetched live from `dolarapi.com/v1/dolares/bolsa`.

## Technical Notes

- The dolarapi returns `{ compra, venta, ... }` — use `venta` for ARS→USD conversion (selling ARS to get USD)
- Edge function calls dolarapi server-side for OCR conversion if needed, but client-side conversion is simpler and preferred for display/input
- Profile `default_currency` only sets the initial toggle state; users can switch freely on the Board

