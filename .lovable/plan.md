

## WOW Factor Features — Roadmap and Detailed Plan

### Implementation Roadmap (3 batches of 2)

```text
Batch 1:  Strategy Performance Comparison  +  Achievement System
Batch 2:  Trade Timeline / Replay          +  Monthly Report Card
Batch 3:  Trading Discipline Score         +  PDF Export
```

**Rationale for ordering:**
- Batch 1 builds on existing infrastructure (tags, confetti) with no DB changes needed for strategy comparison, and one new table for achievements.
- Batch 2 adds two visual/shareable features — timeline uses existing trade data, report card uses existing performance computation.
- Batch 3 requires the most new infrastructure (user-defined rules table, PDF generation library).

---

### Batch 1 — Detailed Plan

---

#### Feature 1: Strategy Performance Comparison

Compare tagged strategies against each other in a table and bar chart.

**No DB changes.** Uses existing `trade_tags`, `trade_tag_assignments`, and `computePerformance` logic.

**Logic** — new function `computeStrategyPerformance` in a new hook `src/hooks/useStrategyPerformance.tsx`:
- Fetch all trades + tag assignments + tags
- Group trades by tag (a trade can appear in multiple groups)
- For each tag group, run the same avg-cost P&L computation used in `computePerformance`
- Return per-strategy: tag name, tag color, total trades, sells, winning sells, win rate, realized P&L, dividends, total return

**UI** — new section on the Performance page (`src/pages/Performance.tsx`):
- A card titled "Strategy Comparison" below the periodic chart
- Table with columns: Strategy (colored badge), Trades, Sells, Win Rate, Realized P&L, Dividends, Total Return
- Sorted by total return descending
- Horizontal bar chart below the table showing total return per strategy, colored by tag color
- Empty state: "Tag your trades with strategies to compare them here"

**Files:**
```
NEW:   src/hooks/useStrategyPerformance.tsx
EDIT:  src/pages/Performance.tsx — add Strategy Comparison section
```

---

#### Feature 2: Achievement System

Badges for milestones. Computed client-side from trade data — no server persistence needed for badge definitions, but we store unlocked achievements to show unlock timestamps and trigger confetti only once.

**DB migration:**
```sql
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_key)
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
-- RLS: users CRUD own achievements
```

**Achievement definitions** — constant array in `src/hooks/useAchievements.tsx`:

| Key | Title | Description | Check logic |
|-----|-------|-------------|-------------|
| `first_trade` | First Steps | Log your first trade | trades.length >= 1 |
| `ten_trades` | Getting Serious | Log 10 trades | trades.length >= 10 |
| `hundred_trades` | Centurion | Log 100 trades | trades.length >= 100 |
| `first_sell` | Closing Time | Complete your first sell | sells >= 1 |
| `first_profit` | In the Green | First profitable sell | any sell with P&L > 0 |
| `first_dividend` | Passive Income | Receive your first dividend | dividends >= 1 |
| `diversified_3` | Spreading Out | Hold 3 different assets | unique holdings >= 3 |
| `diversified_5` | Well Diversified | Hold 5 different assets | unique holdings >= 5 |
| `multi_asset` | Asset Explorer | Trade across 3 asset types | unique asset types >= 3 |
| `profitable_month` | Monthly Win | First month with positive P&L | any month P&L > 0 |
| `tagged_trade` | Strategist | Tag your first trade | any tag assignment exists |
| `multi_portfolio` | Portfolio Pro | Create a second portfolio | portfolios >= 2 |

**Hook** `src/hooks/useAchievements.tsx`:
- Takes trades, holdings, portfolios, tag assignments as inputs
- Evaluates each achievement's condition
- Compares against `achievements` table to find newly unlocked ones
- On new unlock: insert into DB, fire `canvas-confetti`, show toast with badge icon
- Returns `{ achievements: Achievement[], unlocked: string[], newlyUnlocked: string[] }`

**UI** — new page `src/pages/Achievements.tsx`:
- Grid of achievement cards (3 columns on desktop, 2 on mobile)
- Each card: icon/emoji, title, description, unlocked date or locked state (grayed out with lock icon)
- Progress bar at top: "X of 12 unlocked"
- Confetti burst on page load if there are newly unlocked achievements

**Navigation:**
- Add "Achievements" to `AppSidebar.tsx` with a Trophy icon
- Add `/achievements` route to `App.tsx`

**Files:**
```
NEW:   src/hooks/useAchievements.tsx
NEW:   src/pages/Achievements.tsx
EDIT:  src/components/AppSidebar.tsx — add nav item
EDIT:  src/App.tsx — add route
DB:    Create achievements table + RLS
```

