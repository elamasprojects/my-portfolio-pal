

## Document Review & CSV Import Plan

### Feature Gap Analysis

The document describes a vision for a trading portfolio app. Here's what's built vs. what's missing:

| Feature | Status | Notes |
|---------|--------|-------|
| Quick trade logging (minimal friction) | Done | Symbol auto-fill, shares/amount toggle, confetti confirmation |
| Portfolio dashboard with metrics | Partial | Has totals, pie chart, holdings. Missing: P&L tracking, win rate, performance over time |
| Trade log with filters | Done | Filter by type/asset, delete trades |
| Asset detail page | Done | Per-symbol trade history and stats |
| CSV/Excel import | Not built | **User requests this now** |
| AI-powered trade entry (voice/WhatsApp) | Not built | Future roadmap |
| Advanced metrics (win rate, strategy analysis) | Not built | Needs current price data to calculate P&L |
| Mentorship/coaching profiles | Not built | Future roadmap |
| AI analysis (earnings, frameworks) | Not built | Future roadmap |
| Courses/memberships/pricing tiers | Not built | Future roadmap |
| Compound interest calculator | Not built | Future roadmap |
| Affiliate/broker integration | Not built | Future roadmap |

The core trade logging flow is solid. The biggest gap for immediate value is **bulk import** and **better metrics**.

---

### CSV Import Feature Plan

#### User Flow

1. User clicks "Import Trades" in the sidebar (new nav item) or from a button on the Trade Log page
2. New `/import` page with a drag-and-drop file upload zone
3. User uploads a CSV file
4. App parses the CSV client-side, shows a preview table with column mapping
5. User maps their CSV columns to the required fields (symbol, trade type, quantity, price, date, asset name, asset type, notes)
6. App validates rows, highlights errors (missing symbol, invalid numbers, etc.)
7. User confirms import — rows are batch-inserted into the `trades` table
8. Success screen with count of imported trades + confetti

#### Column Mapping

Users' spreadsheets will have different column names. The UI will:
- Auto-detect common column names (e.g., "Ticker" → symbol, "Qty" → quantity, "Buy/Sell" → trade_type)
- Let users manually reassign via dropdowns on each detected column
- Show a live preview of the first 5 rows mapped to the target schema

#### Technical Implementation

**New file: `src/pages/ImportTrades.tsx`**
- Drag-and-drop zone using native `<input type="file" accept=".csv">`
- Parse CSV client-side using a simple custom parser (split by comma/semicolon, handle quoted fields) — no new dependency needed
- Column mapping UI: each CSV header gets a `<Select>` dropdown with target fields
- Auto-mapping heuristic: fuzzy-match CSV headers to known aliases (e.g., "ticker", "symbol", "stock" → `symbol`)
- Validation pass: check each row for required fields, valid numbers, valid dates, valid trade_type values
- Error display: highlight invalid rows in red with tooltip explaining the issue
- Batch insert: chunk rows into groups of 50, insert via `supabase.from("trades").insert(chunk)`
- Uses the user's default portfolio ID (same as AddTrade)

**Edit: `src/components/AppSidebar.tsx`**
- Add "Import CSV" nav item with `Upload` icon, linking to `/import`

**Edit: `src/App.tsx`**
- Add `/import` route wrapped in `ProtectedRoute`

#### Column Aliases Map

```text
symbol:     "symbol", "ticker", "stock", "asset", "coin"
asset_name: "name", "asset_name", "company", "description"
trade_type: "type", "trade_type", "side", "action", "buy/sell", "direction"
quantity:   "quantity", "qty", "shares", "amount", "units", "size"
price:      "price", "price_per_unit", "cost", "entry", "unit_price"
trade_date: "date", "trade_date", "time", "timestamp", "executed"
asset_type: "asset_type", "category", "class", "instrument"
notes:      "notes", "comment", "memo", "description"
```

#### UI Layout

Three steps shown as a progress indicator:

1. **Upload** — Large drag-and-drop zone with file icon, accepts `.csv` files
2. **Map & Review** — Table showing CSV headers mapped to target fields, preview of first 5 rows, error count badge, ability to skip rows
3. **Confirm** — Summary (X trades to import, Y skipped), confirm button, confetti on success

#### Files to create/modify

1. **Create** `src/pages/ImportTrades.tsx` — full import page with 3-step wizard
2. **Edit** `src/components/AppSidebar.tsx` — add Import nav item
3. **Edit** `src/App.tsx` — add `/import` route

