

## Batch 2: Trade Timeline / Replay + Monthly Report Card

### Roadmap Reminder

```text
Batch 1:  Strategy Performance Comparison  +  Achievement System     ✅ DONE
Batch 2:  Trade Timeline / Replay          +  Monthly Report Card    ← NOW
Batch 3:  Trading Discipline Score         +  PDF Export
```

---

### Feature 1: Trade Timeline / Replay

A horizontal, scrollable timeline showing every trade as a node. Hover/click to see details. Useful for spotting behavioral patterns.

**New page:** `src/pages/Timeline.tsx`

- Horizontal scrollable container with a center axis line
- Each trade rendered as a circle node on the axis, positioned by date
  - Green circle = buy, red = sell, blue/purple = dividend
  - Size scaled by trade total amount (min/max clamped)
- Dates shown on the axis at regular intervals
- Hover on a node shows a `HoverCard` with: symbol, asset name, type, quantity, price, total, date, notes
- Click navigates to `/asset/:symbol`
- Filter bar at top: asset type filter, trade type filter, date range (reuse existing patterns)
- Empty state when no trades
- Groups trades on the same day into a stacked cluster

**Navigation:**
- Add "Timeline" to `AppSidebar.tsx` with a `Clock` or `GitBranch` icon
- Add `/timeline` route to `App.tsx`

**Files:**
```
NEW:   src/pages/Timeline.tsx
EDIT:  src/components/AppSidebar.tsx — add nav item
EDIT:  src/App.tsx — add route
```

No DB changes. Uses existing `useTrades()` hook.

---

### Feature 2: Monthly Report Card

Auto-generated end-of-month summary with stats, highlights, and a fun letter grade. Shareable as an image via `html2canvas`.

**New page:** `src/pages/ReportCard.tsx`

- Month selector at top (dropdown of months that have trades, defaulting to previous month)
- For the selected month, compute:
  - Total trades count
  - Net realized P&L (from sells in that month, using avg cost at time of sell)
  - Dividends received
  - Best trade (highest single-sell P&L)
  - Worst trade (lowest single-sell P&L)
  - Most traded asset (by trade count)
  - New positions opened / positions closed
- **Grade calculation** (fun, not serious):
  - A+ : P&L > 0, win rate > 80%, 10+ trades
  - A  : P&L > 0, win rate > 60%
  - B  : P&L > 0
  - C  : P&L == 0 or no sells
  - D  : P&L < 0, win rate > 40%
  - F  : P&L < 0, win rate <= 40%
- Card layout styled like a report card — large grade letter with color, stats in a grid below
- "Share as Image" button: wraps the card in a ref, uses `html2canvas` (or the simpler approach of a hidden canvas + `toBlob`) to capture and trigger download. We'll use the existing `canvas-confetti` pattern — but for image capture we need `html2canvas`.
  - Alternative without new dependency: use the browser's native `ClipboardItem` API to copy a screenshot, or simply style a printable div and use `window.print()`. Given no new deps is simpler, we'll use a "Copy to Clipboard" approach with a styled, print-friendly card, plus a "Download as PNG" that uses a lightweight canvas rendering.
  - **Decision:** Add `html2canvas` as a dependency — it's small, well-maintained, and the right tool for this.

**Navigation:**
- Add "Report Card" to `AppSidebar.tsx` with a `FileText` or `GraduationCap` icon
- Add `/report` route to `App.tsx`

**Files:**
```
NEW:   src/pages/ReportCard.tsx
EDIT:  src/components/AppSidebar.tsx — add nav item
EDIT:  src/App.tsx — add route
DEP:   html2canvas (new dependency for image export)
```

No DB changes. All computation is client-side from existing trade data.

---

### Implementation Order

1. **Trade Timeline** — no new dependencies, self-contained page
2. **Monthly Report Card** — adds `html2canvas` dependency, slightly more complex computation

### Complete file list

```
NEW:
  src/pages/Timeline.tsx
  src/pages/ReportCard.tsx

MODIFIED:
  src/components/AppSidebar.tsx — add Timeline + Report Card nav items
  src/App.tsx — add /timeline and /report routes

DEPENDENCY:
  html2canvas — for report card image export
```

