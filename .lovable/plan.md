

# App Audit: Flaws and Enhancements

---

## MUST HAVE (Bugs / Broken Functionality)

1. **Quantity displays with full floating-point precision** — Dashboard holdings table, Trade Log, and Export all show quantities like `26.501766784452297` instead of a reasonable `26.50`. No rounding/formatting applied anywhere quantities render.

2. **Tooltip shows "Dividendos" twice in Analysis chart** — In `Performance.tsx` line 173, the tooltip formatter compares `name` against the raw dataKey `"realized"`, but Recharts passes the display `name` prop (the translated string). Since `t("performance.realizedPnl")` !== `"realized"`, both tooltip entries show `t("performance.dividends")`. Should compare against `dataKey` or use a different approach.

3. **Pie chart label contrast on Players page** — Labels on the pie chart (visible in screenshot) are nearly invisible: small, dark text on a dark background with no explicit `fill` color. Same issue persists despite the previous "fix" attempt.

4. **Achievements page not translated** — All achievement titles and descriptions ("First Steps", "Log your first trade", "Getting Serious", etc.) are hardcoded in English even when the app language is Spanish.

5. **No mobile navigation** — On mobile (390px), the sidebar completely disappears and there is no hamburger menu, bottom tab bar, or any way to navigate between sections. Users are trapped on whatever page they land on.

---

## NICE TO HAVE (UX Improvements)

6. **Win Rate shows "—" with no explanation** — When there are no sells, "Tasa de Éxito" shows "—" which is technically correct but unhelpful. A small "(no sells yet)" hint would be better.

7. **Display name shows email address** — In Settings, "Nombre para mostrar" shows `chessinvestingcontacto@gmail.com`. This leaks into the export card and player profiles. Should encourage users to set a proper display name.

8. **Export pie chart is still too small** — Despite the previous enlargement, with only 1 holding the pie chart renders as a tiny circle. The allocation section takes minimal vertical space in the card. The chart should have a minimum height.

9. **No loading indicator when fetching market prices on first load** — The dashboard shows stale cost-basis values momentarily before market prices load, which can be confusing. A global "prices updating..." indicator would help.

10. **"Retorno Total" card shows +$0.00 even with unrealized gains** — The "Total Return" stat card only accounts for realized P&L, not unrealized. With $19.88 unrealized gain visible, the total return card says $0.00 which feels contradictory.

---

## WOW FACTOR (Delightful Additions)

11. **Animated counter transitions** — When market prices load and values update, the numbers could animate/count up instead of snapping, giving a Bloomberg terminal feel.

12. **Sparkline mini-charts in summary cards** — Small inline sparklines showing 7-day trend in the Market Value and Unrealized P&L cards.

13. **Portfolio health score** — A single composite score (diversification + win rate + consistency) displayed as a prominent gauge/ring on the dashboard.

14. **Confetti on achievement unlock** — The `canvas-confetti` package is already installed but appears unused. Trigger it when a new achievement is unlocked.

---

## PLEASE DON'T HAVE (Anti-patterns to Avoid/Remove)

15. **Chessboard background pattern on every page** — The `opacity-[0.02]` chessboard overlay in `AppLayout.tsx` adds visual noise and CSS complexity for virtually zero visual benefit. It also applies 4 gradient layers on every single page.

16. **Raw user email exposed as fallback identity** — The email `marcelolamas@gmail.com` shows as the player display name in the Players section. Emails should never be displayed to other users — use username or "Anonymous Player" as fallback.

17. **Duplicate `useMarketPrices` hook file** — The hook was created but the exact same file already existed (from the plan). Verify there isn't a duplicate or stale version.

---

### Summary

| Category | Count |
|----------|-------|
| Must Have | 5 |
| Nice to Have | 5 |
| Wow Factor | 4 |
| Please Don't Have | 3 |

**Highest priority**: Fix quantity formatting, fix the duplicated tooltip label, add mobile navigation, and translate achievements.

