

# Three Changes: Spanish as Default, Full Translation, Sidebar Footer Fix

## 1. Make Spanish the default language
Change the default language in `src/i18n/index.tsx` from `"en"` to `"es"` (line 28). This affects new users who haven't set a preference yet.

## 2. Translate all hardcoded English strings
Several pages have hardcoded English text instead of using `t()`. Here's the full list:

### `src/pages/AddTrade.tsx` — ~30+ hardcoded strings
- Line 379: `"New Move"` → `t("addTrade.title")`
- Line 380: `"Log a new buy, sell, or dividend"` → `t("addTrade.subtitle")`
- Line 396: `"New Trade"` → `t("addTrade.newTrade")`
- Line 403: `"Input Method"` → new key
- Line 411: `"Manual"` → `t("addTrade.inputManual")`
- Line 420: `"From Screenshot"` → `t("addTrade.inputScreenshot")`
- Line 431/460: tooltip hint → `t("addTrade.tooltipHint")`
- Line 450: `"Upload Screenshot"` → `t("addTrade.uploadScreenshot")`
- Line 491: `"Analyzing image..."` → `t("addTrade.analyzing")`
- Line 498: `"Drop image here or click to upload"` → `t("addTrade.dropImage")`
- Line 499: `"JPG, PNG, WEBP supported"` → `t("addTrade.supportedFormats")`
- Line 513: `"← Back to input method"` → new key
- Line 521: `"Opening"` → `t("addTrade.opening")`
- Line 536: `"Buy"` → `t("addTrade.buy")`
- Line 557: `"Sell"` → `t("addTrade.sell")`
- Line 562: `"Add a buy trade first"` → `t("addTrade.addBuyFirst")`
- Line 586: `"Dividend"` → `t("addTrade.dividend")`
- Line 591: `"Add a buy trade first"` → `t("addTrade.addBuyFirst")`
- Line 604: `"Position"` → `t("addTrade.position")`
- Line 609: `"Symbol Lookup"` → `t("addTrade.symbolLookup")`
- Line 631: `"Select Asset"` / `"Select Asset to Sell"` → `t(...)` keys
- Line 637: `"Choose an asset..."` → `t("addTrade.chooseAsset")`
- Line 642: `"shares"` → `t("common.shares")`
- Line 649-650: `"Current price"`, `"shares available"` → `t(...)` keys
- Line 666: `"Execute"` → `t("addTrade.execute")`
- Line 669: `"Asset Details"` → `t("addTrade.assetDetails")`
- Line 674: `"Asset Name"` → `t("addTrade.assetName")`
- Line 685: `"Asset Type"` → `t("addTrade.assetType")`
- Lines 691-695: Stock/ETF/Crypto/Bond/Other → `t(...)` keys
- Line 711: `"Dividend Details"` / `"Trade Details"` → `t(...)` keys
- Line 720: `"Amount Received ($)"` → `t("addTrade.amountReceived")`
- Line 735: `"Date Received"` → `t("addTrade.dateReceived")`
- Line 746: `"Notes (optional)"` → `t("addTrade.notes")`
- Lines 764-777: `"Shares"` / `"Amount"` labels → `t(...)` keys
- Line 800: `"Max"` → `t("addTrade.max")`
- Line 806: `"shares available"` → `t("addTrade.sharesAvailable")`
- Line 814: `"Dollar Amount"` → `t("addTrade.dollarAmount")`
- Line 864: `"Price per Unit ($)"` → `t("addTrade.pricePerUnit")`
- Line 880: `"Trade Date"` → `t("addTrade.tradeDate")`
- Line 891: `"Notes (optional)"` → `t("addTrade.notes")`
- Line 906: `"Tags (optional)"` → `t("addTrade.tags")`
- Line 952: `"Adding..."` / `"Add"` → `t(...)` keys
- Line 975: `"Dividend Recorded!"` / `"Trade Submitted!"` → `t(...)` keys
- Line 977: `"Your trade has been recorded successfully."` → `t("addTrade.tradeRecorded")`
- Lines 984-1037: confirmation card labels (Symbol, Asset, Type, Shares, Price, Date, Total, Amount)
- Line 1047: `"Add Another Trade"` → `t("addTrade.addAnother")`

### `src/pages/ImportTrades.tsx` — ~20+ hardcoded strings
- Line 325: `"Import PGN"` → `t("import.title")` (change to "Import CSV")
- Line 328: subtitle → `t("import.subtitle")`
- Lines 335-337: step labels → `t(...)` keys
- Lines 373-377: drag/drop text → `t(...)` keys
- Line 391: `"Not sure about the format?"` → `t("import.notSure")`
- Line 395: `"Download Template"` → `t("import.downloadTemplate")`
- Lines 407-408: Map Columns heading → `t(...)` keys
- Line 439: required mapping warning → `t("import.mapRequired")`
- Line 444: preview text → `t("import.preview")`
- Line 478: `"Validate & Continue"` → `t("import.validateContinue")`
- Line 489: `"Review Import"` → `t("import.reviewImport")`
- Lines 495-499: valid/error labels → `t(...)` keys
- Line 505: `"Errors found:"` → `t("import.errorsFound")`
- Line 521: preview text → `t("import.previewValid")`
- Lines 526-529: table headers → `t(...)` keys
- Line 567: `"Importing..."` → `t("import.importing")`
- Line 571: `"Import X Trades"` → `t("import.importTrades", ...)`
- Line 587: `"Import Complete!"` → `t("import.importComplete")`
- Line 589: success message → `t("import.successMessage", ...)`
- Line 593: `"Import More"` → `t("import.importMore")`
- Line 596: `"View Trade Log"` → `t("import.viewTradeLog")`

### `src/pages/AssetDetail.tsx` — ~15 hardcoded strings
- All card labels (Quantity, Avg Cost, Cost Basis, Type, Realized P&L, Dividends, Total Return)
- Trade History heading, table headers (Date, Type, Qty, Price, Total, Notes)
- Empty state text
- Loading text

### `src/pages/Install.tsx` — All hardcoded (low priority, but should be translated)

### `src/i18n/en.ts` and `src/i18n/es.ts`
- Change `"import.title"` and `"nav.importPgn"` from "Import PGN" to "Import CSV" / "Importar CSV"
- Add new keys: `"addTrade.inputMethod"`, `"addTrade.backToInput"`, plus any missing confirmation card keys

## 3. Fix sidebar footer layout when collapsed

Current layout (line 93 of AppSidebar.tsx): Inbox and Avatar are in a horizontal `flex` row with `gap-2`. When collapsed, this looks wrong — the image shows them misaligned.

**Fix**: Change the footer to a vertical `flex-col` layout, with the avatar (profile dropdown) at the very bottom and the Inbox bell above it. This works in both expanded and collapsed states.

```tsx
<SidebarFooter className="border-t border-sidebar-border p-3">
  <div className="flex flex-col items-center gap-2">
    <Inbox />
    <Dropdown>
      ...
    </Dropdown>
  </div>
</SidebarFooter>
```

## Summary of files to change
1. `src/i18n/index.tsx` — default language to `"es"`
2. `src/i18n/en.ts` — fix "Import PGN" → "Import CSV", add missing keys
3. `src/i18n/es.ts` — same fixes, add missing keys
4. `src/pages/AddTrade.tsx` — replace all hardcoded strings with `t()` calls
5. `src/pages/ImportTrades.tsx` — replace all hardcoded strings with `t()` calls
6. `src/pages/AssetDetail.tsx` — replace all hardcoded strings with `t()` calls
7. `src/pages/Install.tsx` — translate hardcoded strings
8. `src/components/AppSidebar.tsx` — fix footer layout to vertical with avatar at bottom

