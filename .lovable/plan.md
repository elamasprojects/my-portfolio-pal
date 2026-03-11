

# Plan: Multi-Image Fix, Brokers Feature & Price Edit Bug

## 3 Issues to Address

### Issue 1: Multi-image upload not working
**Root cause**: The file input at line 770-776 already has `multiple` attribute and `handleFileChange` correctly processes multiple files. The likely issue is **mobile behavior** — on iOS/Android, `accept="image/*"` with `multiple` may not allow multi-select depending on the browser. Additionally, the `capture` attribute could be interfering. However, looking more carefully, the code logic is correct for desktop. The real issue may be that on some devices the file picker dialog doesn't allow multi-select. We should ensure `multiple` works and also add an explicit "upload more" UX so users can add images incrementally before processing starts.

**Fix**: Add a staging area where users can add images one by one (or multi-select), see thumbnails of all selected images, then press "Analyze All" to kick off OCR. This makes it work on all devices.

### Issue 2: Price edit closes/bugs the card
**Root cause**: The `useEffect` at lines 342-372 auto-fetches a quote when `symbol` changes. When the user edits the price field, `userEditedPrice.current = true` protects the price. BUT — `symbolResolved` depends on `assetName.trim() !== "" && price.trim() !== ""`. If the user clears the price field briefly while editing, `symbolResolved` becomes `false`, which hides the entire trade details section (the form collapses). When they type again it reappears. This creates the "closing" effect.

**Fix**: Don't use `price` in `symbolResolved` for screenshot-populated forms. Use a separate flag or check if form was populated from OCR to keep the section visible.

### Issue 3: Brokers feature (new)
New feature with database table, settings UI, and integration into the trade entry form.

---

## Database Changes

### Migration 1: `brokers` table (predefined broker list)
```sql
CREATE TABLE public.brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'AR',
  category TEXT NOT NULL DEFAULT 'digital',
  display_order INT NOT NULL DEFAULT 0
);
-- Seed with AR and US brokers
-- No RLS needed — public read-only reference table
```

### Migration 2: `user_brokers` table (user preferences)
```sql
CREATE TABLE public.user_brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES public.brokers(id),
  commission_pct NUMERIC NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, broker_id)
);
ALTER TABLE public.user_brokers ENABLE ROW LEVEL SECURITY;
-- Standard user-scoped RLS policies
```

### Migration 3: Add `broker_id` and `commission_pct` to `trades`
```sql
ALTER TABLE public.trades ADD COLUMN broker_id UUID REFERENCES public.brokers(id);
ALTER TABLE public.trades ADD COLUMN commission_pct NUMERIC DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN commission_amount NUMERIC DEFAULT 0;
```

### Migration 4: Add `brokers_enabled` to `profiles`
```sql
ALTER TABLE public.profiles ADD COLUMN brokers_enabled BOOLEAN NOT NULL DEFAULT false;
```

## Predefined Broker Data (INSERT via data tool)
**Argentina (15 brokers):** IEB+, IOL, Balanz, Bull Market, PPI, Cocos Capital, Inviu, TM Inversiones, Allaria Ledesma, SBS Trading, TPCG Valores, Rava Bursátil, EcoValores, Nexo, Bancos Comerciales

**US (6 + Other):** Interactive Brokers, Charles Schwab, Fidelity, TD Ameritrade, Robinhood, E*TRADE, Other

---

## Frontend Changes

### 1. Fix multi-image upload (`src/pages/AddTrade.tsx`)
- Add a **staging area** between file selection and OCR processing
- New state: `stagedFiles: File[]` — images selected but not yet analyzed
- When user selects files, they go to `stagedFiles` first with thumbnail previews
- User can add more files or remove individual ones
- "Analyze All" button kicks off `processQueue(stagedFiles)`
- This solves the device compatibility issue — users can add 1 image at a time

### 2. Fix price edit collapse (`src/pages/AddTrade.tsx`)
- Change `symbolResolved` logic: when in screenshot/multi-mode (`fromScreenshotRef.current` or `screenshotQueue.length > 0`), only require `assetName` or `symbol` to keep the section visible, not `price`
- Alternative simpler fix: add a `formExpanded` state set to `true` once OCR populates the form, and use it to keep sections visible

### 3. New hook: `src/hooks/useBrokers.tsx`
- `useBrokers()` — fetch all predefined brokers from `public.brokers`
- `useUserBrokers()` — fetch user's selected brokers with commission rates
- `useAddUserBroker()` — add a broker to user's list
- `useUpdateUserBroker()` — update commission_pct or is_default
- `useRemoveUserBroker()` — remove from user's list
- `useDefaultBroker()` — returns user's default broker

### 4. Settings page update (`src/pages/Settings.tsx`)
- New card: **"Brokers"** with toggle to enable/disable the feature (`brokers_enabled`)
- When enabled, show list of user's selected brokers with commission % slider (0.0% - 1.5%, step 0.1%)
- "Add Broker" button opens a picker grouped by country (Argentina / US)
- Each broker shows: name, commission %, default star icon
- Click star to set as default

### 5. Trade entry integration (`src/pages/AddTrade.tsx`)
- Only show broker selector if `profile.brokers_enabled === true`
- Add a Select dropdown after Strategy picker showing user's brokers, pre-selected to default
- On submit: save `broker_id` and `commission_pct` to the trade
- Store both the original price AND commission — `commission_amount = total * commission_pct / 100`
- For **buys**: commission increases cost basis (price_per_unit stays the same, commission stored separately)
- For **sells**: commission reduces proceeds

### 6. Profile hook update (`src/hooks/useProfile.tsx`)
- Add `brokers_enabled: boolean` to Profile interface
- Include in select query and update mutation

### 7. i18n updates (`src/i18n/en.ts`, `src/i18n/es.ts`)
New keys for:
- `settings.brokers`, `settings.brokersEnabled`, `settings.addBroker`, `settings.commission`, `settings.defaultBroker`
- `addTrade.broker`, `addTrade.selectBroker`
- `brokers.argentina`, `brokers.us`, `brokers.other`
- Multi-image staging: `addTrade.stageImages`, `addTrade.analyzeAll`, `addTrade.addMore`

---

## Technical Details

### Commission calculation
When saving a trade:
- `commission_pct` = broker's commission rate at time of trade
- `commission_amount` = `total * commission_pct / 100`
- `price_per_unit` stays as the raw market price (no modification)
- P&L calculations in `computePerformance()` will be updated to subtract commissions:
  - Buy: effective cost = `price_per_unit + (commission_amount / quantity)`
  - Sell: effective proceeds = `price_per_unit - (commission_amount / quantity)`

### `symbolResolved` fix
Change from:
```ts
const symbolResolved = tradeType === "dividend" ? selectedHolding !== "" : assetName.trim() !== "" && price.trim() !== "";
```
To:
```ts
const symbolResolved = tradeType === "dividend" ? selectedHolding !== "" : assetName.trim() !== "" && (price.trim() !== "" || fromScreenshotRef.current || screenshotQueue.length > 0);
```

