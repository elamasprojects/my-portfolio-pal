

# Add Strategy Management (/strategy)

## Concept

A new `strategies` table stores the user's trading strategies (e.g., Technical Analysis, Elliott Wave, DCA). One can be marked as default. When adding a trade, the default strategy is auto-selected (user can override). Each trade gets a `strategy_id` column linking to the strategy used.

## Database Changes

### New table: `strategies`
```sql
CREATE TABLE public.strategies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  icon text DEFAULT 'TrendingUp',
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.strategies ENABLE ROW LEVEL SECURITY;
-- Standard CRUD policies for own rows
```

### Add `strategy_id` to `trades`
```sql
ALTER TABLE public.trades ADD COLUMN strategy_id uuid REFERENCES public.strategies(id) ON DELETE SET NULL;
```

### Trigger to enforce single default
A trigger that unsets `is_default` on other strategies when one is set as default (same user).

## New Files

### `src/hooks/useStrategies.tsx`
- `useStrategies()` — fetch all strategies for current user
- `useDefaultStrategy()` — derived from the list (find `is_default = true`)
- `useCreateStrategy()` — insert mutation
- `useUpdateStrategy()` — update name/description/icon
- `useDeleteStrategy()` — delete mutation
- `useSetDefaultStrategy()` — sets `is_default = true` on one, `false` on others

### `src/pages/Strategy.tsx`
- List of user strategies as cards, each showing name, description, icon, and a "Default" badge
- "Add Strategy" button opens an inline form or dialog
- Each card has edit/delete/set-default actions
- Starter suggestions shown when empty (Technical Analysis, Elliott Wave, Fundamental Analysis, DCA, Swing Trading)

## Modified Files

### `src/pages/AddTrade.tsx`
- Import `useStrategies` and `useDefaultStrategy`
- Add a strategy selector (dropdown) pre-filled with the default strategy
- Pass `strategy_id` in the insert payload

### `src/components/AppSidebar.tsx` + `src/components/MobileNav.tsx`
- Add "Strategy" nav item with a suitable icon (e.g., `Target` or `Crosshair`)

### `src/App.tsx`
- Add `/strategy` route

### `src/i18n/en.ts` + `src/i18n/es.ts`
- Add translation keys for strategy page, form labels, empty state, etc.

## UX Flow

1. User visits `/strategy` → sees their strategies (or empty state with suggestions)
2. Creates strategies, sets one as default
3. When adding a trade, the default strategy is pre-selected in a dropdown
4. Strategy column appears in Trade Log for filtering/grouping

