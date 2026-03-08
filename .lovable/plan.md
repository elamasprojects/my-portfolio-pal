

# UX/UI Audit: Sidebar Navigation Consolidation

## Current State
The sidebar has **13 items** — too many for quick scanning. Several pages serve closely related purposes and can be merged as tabs within a single view.

## Proposed Consolidation: 13 items down to 8

```text
CURRENT (13)                    PROPOSED (8)
─────────────────────────────   ──────────────────────────────
Board (Dashboard)         ───►  Board (Dashboard)
New Move (Add Trade)      ───►  New Move (Add Trade)
Import PGN (Import)       ─┘   (merged into New Move as tab)
Move History (Trade Log)  ───►  Move History (Trade Log)
Analysis (Performance)    ───►  Analysis (with tabs below)
Game Clock (Timeline)     ─┘     ├─ Performance (default)
Score Sheet (Report Card) ─┘     ├─ Timeline
                                 └─ Report Card
Titles (Achievements)     ───►  Progress (with tabs below)
Opening Book (Discipline) ─┘     ├─ Titles (default)
                                 └─ Opening Book
Notation (Export)         ───►  Notation (Export)
Chess (AI Chat)           ───►  Chess (AI Chat)
Players                   ───►  Players
Settings                  ───►  Settings
```

## Grouping Rationale

### 1. New Move + Import PGN → "New Move" with tabs
Both are about **adding trades** to the system. The Import page is a secondary entry method. Merge as two tabs: "Manual" and "Import CSV".

### 2. Analysis + Game Clock + Score Sheet → "Analysis" with tabs
All three are **read-only analytics views** over the same trade data:
- **Performance**: P&L by period with bar charts
- **Timeline**: Chronological visual of trades
- **Report Card**: Monthly graded summaries

These are natural sub-views of "Analysis". Use a tab bar at the top of the page.

### 3. Titles + Opening Book → "Progress" with tabs
Both are **self-assessment/gamification** features:
- **Achievements**: Badge progress tracking
- **Discipline**: Rule compliance scoring

They share the theme of "how am I doing as a trader?" Combine under a "Progress" nav item with tabs.

## Implementation Plan

### Files to create
- `src/pages/AnalysisHub.tsx` — wrapper page with Tabs: Performance | Timeline | Report Card
- `src/pages/ProgressHub.tsx` — wrapper page with Tabs: Titles | Opening Book

### Files to modify
- `src/pages/AddTrade.tsx` — add a tab bar at top: "Manual" | "Import", render ImportTrades content in the Import tab
- `src/components/AppSidebar.tsx` — reduce navItems from 13 to 8
- `src/App.tsx` — update routes: `/analysis`, `/analysis/timeline`, `/analysis/report`, `/progress`, `/progress/discipline`. Keep old routes as redirects for bookmarks.
- `src/i18n/en.ts` and `src/i18n/es.ts` — add new nav keys, add tab label keys

### Sidebar result (8 items)
| Icon | Label | Route |
|------|-------|-------|
| LayoutDashboard | Board | `/` |
| Plus | New Move | `/add` |
| List | Move History | `/trades` |
| BarChart3 | Analysis | `/analysis` |
| Trophy | Progress | `/progress` |
| FileDown | Notation | `/export` |
| Sparkles | Chess | `/chess` |
| Users | Players | `/players` |

Settings stays in the profile dropdown (footer), not in the main nav — it's a secondary action.

### UI pattern for hub pages
Each hub page uses shadcn Tabs at the top of the content area. URL defined by nested routes so browser back/forward and deep links work. Example:

```text
┌─────────────────────────────────────┐
│ [Performance]  [Timeline]  [Report] │  ← Tab bar
├─────────────────────────────────────┤
│                                     │
│   (current page content renders)    │
│                                     │
└─────────────────────────────────────┘
```

