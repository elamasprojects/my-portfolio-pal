

# Cumulative PNL Timeline + Side-by-Side Comparison + Disclaimer Fix

## Changes

### 1. Disclaimer text update
Change `chess.disclaimer` in both i18n files:
- EN: "This is an AI assistant. It can make mistakes and nothing said here should be considered financial advice. All interactions are for educational purposes."
- ES: "Este es un asistente de IA. Puede cometer errores y nada de lo dicho aquí debe considerarse asesoramiento financiero. Toda interacción tiene fines educativos."

### 2. Cumulative PNL line chart per player
In the Overview tab, below the pie chart, add a Recharts `AreaChart` showing cumulative PNL over time using the existing `computeCumulativePnL()` function from `usePortfolio.tsx`. Simple area chart with date on X-axis, cumulative PNL on Y-axis, green/red gradient fill.

### 3. Side-by-side comparison tab
Add a new **"Compare"** tab next to Overview and Leaderboard. This tab:
- Fetches the current user's trades (already available via `useTrades` hook)
- Computes both users' holdings + period PNL + cumulative PNL
- Shows:
  - **Two pie charts** side by side (your allocation vs theirs)
  - **PNL % comparison cards** (7D/1M/3M) with both values next to each other
  - **Overlaid cumulative PNL line chart** — two lines (you vs them) on the same chart, different colors

### Files changed

| File | Change |
|------|--------|
| `src/pages/Players.tsx` | Add cumulative PNL chart to overview, add Compare tab with side-by-side dashboard |
| `src/i18n/en.ts` | Update disclaimer, add compare keys (`social.compare`, `social.you`, `social.cumulativePnl`) |
| `src/i18n/es.ts` | Same translations in Spanish |

### Technical notes
- Import `Area, AreaChart, XAxis, YAxis, CartesianGrid, Line, LineChart, Legend` from recharts
- Import `computeCumulativePnL, useTrades` from usePortfolio
- Current user's trades come from `useTrades()` (uses active portfolio)
- Connected user's trades already fetched as `playerTrades`
- The comparison chart uses `LineChart` with two `Line` elements sharing the same X-axis (dates merged from both datasets)

