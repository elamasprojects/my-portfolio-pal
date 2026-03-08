

## Batch 3: Trading Discipline Score + Dark/Light Mode PDF Export

### Roadmap Status

```text
Batch 1:  Strategy Performance Comparison  +  Achievement System     ✅ DONE
Batch 2:  Trade Timeline / Replay          +  Monthly Report Card    ✅ DONE
Batch 3:  Trading Discipline Score         +  PDF Export             ← NOW
```

---

### Feature 1: Trading Discipline Score

Users define personal trading rules, and the app checks every trade for compliance, producing a score.

**Database changes** -- new table `discipline_rules`:
```sql
CREATE TABLE public.discipline_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_type text NOT NULL,        -- 'max_position_pct' | 'always_notes' | 'max_trade_size' | 'min_diversification'
  rule_value numeric,             -- threshold value (e.g. 5 for 5%, 1000 for $1000)
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.discipline_rules ENABLE ROW LEVEL SECURITY;
-- Standard user-owns-row policies for SELECT, INSERT, UPDATE, DELETE
```

**Rule types (built-in, user toggles and configures thresholds):**

| rule_type | Label | Default | Check logic |
|-----------|-------|---------|-------------|
| `max_position_pct` | Max position size | 10% | No single trade > X% of total portfolio value |
| `always_notes` | Always add notes | on | Every trade has a non-empty notes field |
| `max_trade_size` | Max trade amount | $5,000 | No single trade total exceeds $X |
| `min_diversification` | Min assets held | 3 | Portfolio holds at least N different symbols |

**Logic** -- new hook `src/hooks/useDiscipline.tsx`:
- Fetches user's rules from `discipline_rules` (with defaults if none exist)
- Evaluates each trade against each enabled rule
- Returns: overall score (0-100), per-rule compliance percentage, list of violations (trade + rule violated)
- Score = average of per-rule compliance rates across all enabled rules

**UI** -- new page `src/pages/Discipline.tsx`:
- Rules configuration section at top: toggle each rule on/off, set threshold via input
- Score display: large circular gauge (0-100) with color gradient (red/yellow/green)
- Per-rule breakdown: card per rule showing compliance % and a progress bar
- Violations list: expandable section showing recent violations with trade details
- Empty state: explains discipline scoring and prompts to configure rules

**Navigation:**
- Add "Discipline" to sidebar with `Shield` icon
- Add `/discipline` route

**Files:**
```
NEW:   src/hooks/useDiscipline.tsx
NEW:   src/pages/Discipline.tsx
EDIT:  src/components/AppSidebar.tsx
EDIT:  src/App.tsx
DB:    Create discipline_rules table + RLS
```

---

### Feature 2: Dark/Light Mode PDF Export

Generate a clean, branded PDF portfolio report with allocation chart, holdings table, P&L summary, and recent trades. Respects current theme.

**Approach:** Use `html2canvas` (already installed) to capture a styled, hidden report div, then convert the canvas to a multi-page PDF using a small PDF builder. We will add `jspdf` as a dependency -- it pairs with `html2canvas` and handles pagination.

**New file** `src/pages/ExportReport.tsx`:
- Renders a full-page report preview styled with the current theme (dark or light)
- Report sections:
  1. Header: portfolio name, date range, user email
  2. Summary stats: total value, total invested, realized P&L, dividends
  3. Allocation pie chart (same as dashboard)
  4. Holdings table: symbol, quantity, avg cost, total invested
  5. P&L table: symbol, realized P&L, dividends, total return
  6. Recent trades (last 20)
- "Download PDF" button: uses `html2canvas` to capture the report div, then `jspdf` to create a PDF from the canvas image(s)
- "Print" button: triggers `window.print()` with print-specific CSS
- Theme toggle preview: small switch to preview report in dark vs light before export

**Navigation:**
- Add "Export PDF" to sidebar with `FileDown` icon
- Add `/export` route

**Files:**
```
NEW:   src/pages/ExportReport.tsx
EDIT:  src/components/AppSidebar.tsx
EDIT:  src/App.tsx
DEP:   jspdf (new dependency for PDF generation)
```

No additional DB changes for this feature.

---

### Implementation Order

1. **Trading Discipline Score** -- DB migration first, then hook, then page
2. **PDF Export** -- self-contained page, add jspdf dependency

### Complete file list

```text
NEW:
  src/hooks/useDiscipline.tsx     -- discipline rule evaluation
  src/pages/Discipline.tsx        -- discipline score UI + rule config
  src/pages/ExportReport.tsx      -- PDF report preview + export

MODIFIED:
  src/components/AppSidebar.tsx   -- add Discipline + Export PDF nav items
  src/App.tsx                     -- add /discipline and /export routes

DB:
  discipline_rules table + RLS policies

DEPENDENCY:
  jspdf -- PDF generation from canvas
```

