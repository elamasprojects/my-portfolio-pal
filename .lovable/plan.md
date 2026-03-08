

# Fix Empty Player Overview + Enable Trade Data Access for Connections

## Root Cause: Empty Overview

The connected user (`81f95821`) has **no username set** (`null`). The current code:
1. Uses `activePlayer?.username` to call `get_player_summary` — when username is null, the query is **never executed** (`enabled: !!activePlayer?.username` is false)
2. Even if called, the RPC does `WHERE username = _target_username` which wouldn't match a null username

Both connected users have trades (1 and 2 respectively), so data exists.

## Fix Plan

### 1. Create a new RPC: `get_player_summary_by_id`

Instead of patching the username-based function, create a new one that looks up by user ID directly. This is more reliable for the Players dashboard where we already have the user's ID from the connection.

Same logic as `get_player_summary` but takes `_target_id uuid` instead of `_target_username text`. Still validates the accepted follow_request exists.

### 2. Add helper function: `is_connected_to`

A `SECURITY DEFINER` function that checks if two users have an accepted follow_request. This will be reused in RLS policies.

```sql
CREATE FUNCTION public.is_connected_to(_user_id uuid, _other_id uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follow_requests
    WHERE status = 'accepted'
      AND ((requester_id = _user_id AND target_id = _other_id)
        OR (requester_id = _other_id AND target_id = _user_id))
  )
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
```

### 3. Add RLS SELECT policies for connected users on trades and portfolios

Allow connected users to read each other's trades and portfolios (read-only):

- `trades`: `SELECT` policy using `is_connected_to(auth.uid(), user_id)`
- `portfolios`: `SELECT` policy using `is_connected_to(auth.uid(), user_id)`

This enables future comparison dashboard features where we can query trades directly.

### 4. Update `Players.tsx`

- Change the player summary query to use `get_player_summary_by_id` with `activePlayer.id` instead of username
- Remove the `!!activePlayer?.username` guard — use `!!activePlayer?.id` instead
- Display `activePlayer.display_name` or `activePlayer.id` as fallback when username is null

### Files changed

| File | Change |
|------|--------|
| **SQL migration** | Create `is_connected_to` helper, `get_player_summary_by_id` RPC, add SELECT policies on trades + portfolios for connections |
| **`src/pages/Players.tsx`** | Switch from username-based to ID-based summary lookup |
| **`src/integrations/supabase/types.ts`** | Will auto-update with new function types |

