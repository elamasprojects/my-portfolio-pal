

## Redesign Add Trade Form

### What changes

Restructure the Add Trade page into a sectioned card layout inspired by the checkout-form component, with the Symbol field visually separated and gating the rest of the form.

### Layout

The form becomes a single `Card` with distinct sections separated by `Separator` components:

1. **Symbol Lookup Section** — icon + label header, symbol input with loading spinner. Prominently separated at the top.
2. **Separator**
3. **Asset Details Section** (disabled until symbol is resolved) — asset name, asset type, trade type fields. Icon + label header.
4. **Separator**
5. **Trade Details Section** (disabled until symbol is resolved) — quantity, price per unit, trade date, notes. Icon + label header.
6. **Separator**
7. **Order Summary Section** — shows total calculation (quantity × price) in a grid like the checkout form's payment summary.
8. **Footer** — total amount + submit button, styled like the checkout form footer with dark background bar.

### Behavior

- `symbolResolved` derived state: `true` when `assetName` and `price` are both populated (i.e., quote fetched successfully).
- All fields below the symbol section get `disabled={!symbolResolved}` and reduced opacity when disabled.
- User can still manually edit auto-filled fields after they're populated.

### Styling

- Each section uses the checkout-form pattern: icon + bold label header, then content below.
- Icons: `Search` for symbol, `Tag` for asset details, `TrendingUp` for trade details, `Calculator` for summary.
- Sections use `space-y-3` internally with `text-sm text-muted-foreground` for labels.
- Footer bar: `bg-muted rounded-lg p-4 flex items-center justify-between`.

### Files to modify

1. **`src/pages/AddTrade.tsx`** — full rewrite of the JSX structure, add `Separator` import, add `symbolResolved` state logic, apply disabled states.

No new components needed. All dependencies (`Separator`, `Card`, `Input`, icons) already exist.

