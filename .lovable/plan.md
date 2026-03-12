

# Fix Slider, Sell Flow & Reimagine Mobile Nav

## Issue 1: Commission Slider Doesn't Move

**Root cause**: In `Settings.tsx` line 228-233, the Slider uses `onValueCommit` (fires only on mouse release) but the component is **controlled** with `value={[ub.commission_pct]}` — this value comes from the DB and never updates during drag. The thumb visually snaps back because React re-renders with the old DB value on every frame.

**Fix**: Add local state per broker to track the slider value during drag. Use `onValueChange` for visual feedback, and `onValueCommit` to persist to DB.

### Changes in `src/pages/Settings.tsx`
- Create a `commissionOverrides` state (`Record<string, number>`) to hold in-progress slider values
- Use `onValueChange` to update local state (visual), `onValueCommit` to save to DB
- Display value from local override if present, otherwise from DB

---

## Issue 2: Can't Sell — "Zero Shares"

**Root cause**: The insert at line 525-542 does NOT include `total_amount`. While `computeHoldings` doesn't use it, the missing field means `total_amount` is NULL for all trades. More critically, the sell validation at line 505 uses `availableShares` which depends on `selectedHolding` being set and matching a holding. The holdings computation itself looks correct — trades exist in the DB with valid quantities.

The actual issue is likely that the `formExpanded`/`symbolResolved` logic collapses the form unexpectedly during the sell flow, similar to the price-edit bug. When a user selects a holding and the quote fetch updates `price`, the form may re-render in a way that resets state.

**Fixes**:
1. Add `total_amount: finalTotal` to the trade insert (completeness)
2. Ensure `formExpanded` is set to `true` when selecting a holding for sell/dividend (in `handleHoldingSelect`)
3. Protect the sell flow from `symbolResolved` collapsing: for sell/dividend, `symbolResolved` should only require `selectedHolding !== ""`  — it already does this, but `formExpanded` resets could cause issues
4. Add `total_amount` retroactively via migration for existing trades

### Migration for existing trades
```sql
UPDATE public.trades
SET total_amount = quantity * price_per_unit
WHERE total_amount IS NULL;
```

### Changes in `src/pages/AddTrade.tsx`
- Add `total_amount: finalTotal` to the insert object
- In `handleHoldingSelect`, call `setFormExpanded(true)` to prevent collapse
- Ensure sell/dividend path keeps form stable

---

## Issue 3: Mobile Nav Redesign

**Current**: 6 buttons (Board, New Move, History, Analysis, Progress, Strategy)

**New layout** (5 buttons, left to right):
1. **Ver Más** (MoreHorizontal icon) — opens a sheet/drawer with: Progress, Strategy, Notation, Chess AI, Players, Settings
2. **Nueva Jugada** (Plus icon) — `/add`
3. **Tablero** (LayoutDashboard icon) — `/` (center, prominent)
4. **Análisis** (BarChart3 icon) — `/analysis`
5. **Historial** (List icon) — `/trades`

### Changes in `src/components/MobileNav.tsx`
- Replace the items array with the new 5-item layout
- Add state for the "Ver Más" drawer/sheet
- Import `Sheet` component for the drawer
- The drawer lists all secondary sections: Progress, Strategy, Notation, Chess AI, Players, Settings
- Center button (Tablero) gets slightly larger styling

### i18n additions
- `nav.more`: "Ver más" / "More"

---

## Summary of all file changes

| File | Change |
|---|---|
| `src/pages/Settings.tsx` | Local slider state + `onValueChange` |
| `src/pages/AddTrade.tsx` | Add `total_amount`, `setFormExpanded(true)` in sell path |
| `src/components/MobileNav.tsx` | Full redesign with 5 buttons + "Ver Más" drawer |
| `src/i18n/en.ts` | Add `nav.more` key |
| `src/i18n/es.ts` | Add `nav.more` key |
| Migration SQL | Backfill `total_amount` for existing trades |

