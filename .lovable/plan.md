

# Revamp /players: Connection Dashboard + Leaderboard

## Current State
- `/players` shows a tabbed view (My Connections / Search) — just a list of connected profiles with no data
- `/player/:username` shows basic stats (total trades, total invested, holdings count) via the `get_player_summary` RPC
- The RPC only returns 3 aggregate numbers — no P&L data

## New Design

### 1. Redesign `/players` page layout

**No connections yet**: Show the search bar prominently (current search tab content, full-page).

**Has connections**: Two-section layout:
- **Header**: Page title + top-right icon buttons for Search (magnifying glass popover/dialog) and Connections list (users icon popover/dialog)
- **Main content**: A selected connection's profile dashboard (stats cards, similar to current PlayerProfile but richer) with a connection switcher (avatar row or dropdown) at the top
- **Default view**: Show the first connection's data, or a leaderboard summary

### 2. Enrich the `get_player_summary` RPC

Add P&L calculations to the existing function so connected players can see:
- **Realized P&L** (from sells: `(sell_price - avg_cost) * qty`)
- **Total Dividends**
- **Total Return** (realized + dividends)
- **Win Rate** (profitable sells / total sells)

This keeps raw trade data hidden (security definer) while exposing aggregated performance.

**SQL migration** — update `get_player_summary` to add these fields to the returned JSONB.

### 3. Leaderboard with Podium

**New DB table**: `leaderboards`
- `id` uuid PK
- `creator_id` uuid (references profiles)
- `name` text
- `created_at` timestamptz

**New DB table**: `leaderboard_members`
- `id` uuid PK
- `leaderboard_id` uuid FK → leaderboards
- `user_id` uuid
- `invited_at` timestamptz
- `joined_at` timestamptz nullable (null = pending invite)

**New RPC**: `get_leaderboard_rankings`
- Security definer function
- For a given leaderboard_id, calculates each member's realized P&L for the current week and current month
- Returns sorted array with rank, username, avatar, weekly_pnl, monthly_pnl

**UI — Leaderboard tab on /players page**:
- "Create Leaderboard" button — name it, then invite from your connections
- Podium display: top 3 shown as 1st/2nd/3rd with medals (gold/silver/bronze) and avatars
- Below podium: ranked list showing all members with weekly and monthly P&L columns
- Period toggle: "This Week" / "This Month"

### 4. File Changes

| File | Change |
|------|--------|
| `src/pages/Players.tsx` | Complete rewrite: conditional layout (no connections vs has connections), connection switcher, inline player stats, leaderboard tab |
| `src/pages/PlayerProfile.tsx` | Remove standalone page (fold into Players) or keep as deep-link |
| `src/hooks/useFollows.tsx` | No changes needed |
| `src/i18n/en.ts` + `es.ts` | Add leaderboard keys: `social.leaderboard`, `social.createLeaderboard`, `social.weeklyPnl`, `social.monthlyPnl`, `social.podium`, `social.inviteToLeaderboard`, `social.rank` |
| **SQL migration** | 1) Update `get_player_summary` to include realized_pnl, dividends, total_return, win_rate. 2) Create `leaderboards` + `leaderboard_members` tables with RLS. 3) Create `get_leaderboard_rankings` RPC |

### 5. Implementation Order

1. **SQL migration**: Update RPC + create leaderboard tables + rankings function
2. **Rewrite `/players`**: Conditional layout, connection data display, search/connections as icons
3. **Leaderboard UI**: Create/invite flow, podium component, rankings table
4. **Translations**: All new keys in en.ts and es.ts

