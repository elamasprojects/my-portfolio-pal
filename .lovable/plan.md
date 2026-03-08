

# Fix Leaderboard Infinite Recursion in RLS Policies

## Root Cause

The error `infinite recursion detected in policy for relation "leaderboard_members"` is caused by circular RLS policy references:

1. **`leaderboard_members`** "Members can view leaderboard members" policy queries `leaderboard_members` itself to check membership — direct self-reference recursion.
2. **`leaderboards`** "Members can view leaderboards" policy queries `leaderboard_members`, which triggers its policies, which query `leaderboard_members` again — circular.
3. The "Leaderboard creator can manage members" policy on `leaderboard_members` queries `leaderboards`, which triggers `leaderboards` policies, which query `leaderboard_members` — circular again.

This blocks ALL operations on both tables (SELECT, INSERT, etc.).

## Fix

Create two **security definer** helper functions to break the recursion, then replace the problematic policies.

### SQL Migration

```sql
-- 1. Helper: check if user is creator of a leaderboard
CREATE OR REPLACE FUNCTION public.is_leaderboard_creator(_leaderboard_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leaderboards
    WHERE id = _leaderboard_id AND creator_id = _user_id
  )
$$;

-- 2. Helper: check if user is member of a leaderboard
CREATE OR REPLACE FUNCTION public.is_leaderboard_member(_leaderboard_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.leaderboard_members
    WHERE leaderboard_id = _leaderboard_id AND user_id = _user_id
  )
$$;

-- 3. Drop all existing problematic policies
DROP POLICY "Members can view leaderboards" ON public.leaderboards;
DROP POLICY "Creator can manage leaderboards" ON public.leaderboards;
DROP POLICY "Leaderboard creator can manage members" ON public.leaderboard_members;
DROP POLICY "Members can view leaderboard members" ON public.leaderboard_members;
DROP POLICY "Users can accept their own invite" ON public.leaderboard_members;

-- 4. Recreate leaderboards policies using helpers
CREATE POLICY "Creator can manage leaderboards"
  ON public.leaderboards FOR ALL TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Members can view leaderboards"
  ON public.leaderboards FOR SELECT TO authenticated
  USING (public.is_leaderboard_member(id, auth.uid()));

-- 5. Recreate leaderboard_members policies using helpers
CREATE POLICY "Creator can manage members"
  ON public.leaderboard_members FOR ALL TO authenticated
  USING (public.is_leaderboard_creator(leaderboard_id, auth.uid()))
  WITH CHECK (public.is_leaderboard_creator(leaderboard_id, auth.uid()));

CREATE POLICY "Members can view members"
  ON public.leaderboard_members FOR SELECT TO authenticated
  USING (public.is_leaderboard_member(leaderboard_id, auth.uid()));

CREATE POLICY "Users can accept own invite"
  ON public.leaderboard_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### Also fix: DialogHeader ref warning

In `Players.tsx`, the `DialogHeader` component is being passed a ref incorrectly. Minor fix — wrap or remove the ref assignment.

### Files changed
1. **SQL migration** — drop/recreate policies with security definer functions
2. **`src/pages/Players.tsx`** — fix DialogHeader ref warning (add `DialogDescription` for accessibility)

