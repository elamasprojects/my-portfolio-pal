
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

-- 3. Revoke/grant
REVOKE EXECUTE ON FUNCTION public.is_leaderboard_creator FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_leaderboard_creator TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_leaderboard_member FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_leaderboard_member TO authenticated;

-- 4. Drop all existing problematic policies
DROP POLICY IF EXISTS "Members can view leaderboards" ON public.leaderboards;
DROP POLICY IF EXISTS "Creator can manage leaderboards" ON public.leaderboards;
DROP POLICY IF EXISTS "Leaderboard creator can manage members" ON public.leaderboard_members;
DROP POLICY IF EXISTS "Members can view leaderboard members" ON public.leaderboard_members;
DROP POLICY IF EXISTS "Users can accept their own invite" ON public.leaderboard_members;

-- 5. Recreate leaderboards policies
CREATE POLICY "Creator can manage leaderboards"
  ON public.leaderboards FOR ALL TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Members can view leaderboards"
  ON public.leaderboards FOR SELECT TO authenticated
  USING (public.is_leaderboard_member(id, auth.uid()));

-- 6. Recreate leaderboard_members policies
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
