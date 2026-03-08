

## UX/UI Audit & Enhancement Plan

### Findings by Page

---

#### Global Issues

1. **Light mode contrast**: The main content area background is very light gray (`240 4% 95%`) while cards are near-white (`0 0% 98%`) -- almost no visual separation between cards and background.
2. **Sidebar contrast in light mode**: The sidebar stays dark in both themes (good), but the email text and footer buttons are hard to read (`sidebar-foreground/50` and `/70` are too dim).
3. **No empty state CTAs**: When there are no trades, the empty states say "No trades yet" but don't offer a button to go add one.
4. **No loading skeletons**: All loading states are plain "Loading..." text with `animate-pulse`. Should use proper skeleton placeholders.
5. **`muted-foreground` in dark mode**: Set to `0 0% 98%` which is full white -- same as `foreground`. This kills visual hierarchy. Should be dimmer (e.g., `240 5% 55%`).

---

#### /add (Add Trade) -- Primary Focus

**Issues found:**

1. **Disabled sections still visible and confusing**: The form shows all sections (Asset Details, Trade Details, Order Summary) grayed out at 30% opacity before the user even picks a trade type. This clutters the view and creates cognitive overload. The user sees fields they can't interact with yet.

2. **Buy/Sell buttons lack visual clarity before selection**: Both buttons are `bg-muted text-muted-foreground` when unselected -- they look like disabled elements rather than clickable choices.

3. **Footer bar contrast issue**: The `bg-muted` footer with `$0.00` and "Add Trade" button blends into the card in light mode. In dark mode, the pink button on gray is fine but the `$0.00` text doesn't stand out.

4. **No progressive disclosure**: The entire long form is visible from the start. Users should see only the current step, with subsequent sections expanding as they fill in data (accordion-style reveal).

5. **"Sell" button always visible even for new users**: A new user with zero holdings still sees the Sell button prominently. Clicking it shows "No holdings to sell" -- a dead end. It should be disabled with a tooltip when there are no holdings.

6. **Order Summary is redundant with footer**: Both show the total. The Order Summary section adds little value since it repeats what's already visible.

7. **No quick "sell all" button**: When selling, users often want to sell their entire position. There's no "Max" or "Sell All" shortcut.

---

#### Dashboard (/)

8. **Pie chart tooltip hardcoded to dark theme colors**: The `contentStyle` uses hardcoded HSL values. In light mode, the tooltip has dark background which is fine, but it should use CSS variables.

9. **No "Add Trade" CTA when portfolio is empty**: Just shows "No holdings yet. Add your first trade!" as text with no button.

---

#### Trade Log (/trades)

10. **No search/text filter**: Only has type and asset dropdowns. Can't search by symbol name.

11. **No pagination**: All trades load at once. Will break with many trades.

---

### Enhancement Plan

#### Priority 1: Fix /add Page UX

**Changes to `src/pages/AddTrade.tsx`:**

- **Progressive disclosure**: Hide sections below the current step entirely (not just opacity). After selecting Buy/Sell, animate-in the symbol section. After symbol resolves, animate-in the rest.
- **Disable Sell button** when `holdings.length === 0` with a tooltip "Add a buy trade first".
- **Add "Max" button** next to quantity input in sell mode that fills in the full available shares.
- **Remove the Order Summary section** -- the sticky footer already shows the total. Replace with a single-line summary row showing `10 shares x $150.00 = $1,500.00`.
- **Improve Buy/Sell button styling**: Use outlined style with icons (ArrowDownLeft for Buy in green, ArrowUpRight for Sell in red) to make them look like primary action buttons rather than toggle pills.

**Changes to `src/index.css`:**

- Fix `muted-foreground` in `.dark` from `0 0% 98%` to `240 5% 55%` so dimmed text is actually dim.
- Slightly increase card/background contrast in light mode.

#### Priority 2: Dashboard Polish

**Changes to `src/pages/Index.tsx`:**

- Add a CTA button "Add Your First Trade" when holdings are empty, linking to `/add`.
- Use CSS variables for the pie chart tooltip styling.

#### Priority 3: Trade Log Improvements

**Changes to `src/pages/TradeLog.tsx`:**

- Add a text search input to filter by symbol or name.

#### Files to modify

1. `src/pages/AddTrade.tsx` -- progressive disclosure, sell button disable, max button, remove redundant summary
2. `src/index.css` -- fix muted-foreground in dark mode, improve light mode contrast
3. `src/pages/Index.tsx` -- empty state CTA, tooltip CSS vars
4. `src/pages/TradeLog.tsx` -- add symbol search filter

