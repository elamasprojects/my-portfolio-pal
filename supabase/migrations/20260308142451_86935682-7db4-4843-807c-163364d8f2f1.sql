
-- 1. Update get_player_summary to include realized P&L, dividends, total return, win rate
CREATE OR REPLACE FUNCTION public.get_player_summary(_requester_id uuid, _target_username text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  _target_id uuid;
  _result jsonb;
BEGIN
  SELECT id INTO _target_id FROM public.profiles WHERE username = _target_username;
  IF _target_id IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.follow_requests
    WHERE status = 'accepted'
      AND (
        (requester_id = _requester_id AND target_id = _target_id)
        OR (requester_id = _target_id AND target_id = _requester_id)
      )
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  SELECT jsonb_build_object(
    'username', p.username,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'total_trades', COALESCE(stats.total_trades, 0),
    'total_invested', COALESCE(stats.total_invested, 0),
    'holdings_count', COALESCE(stats.holdings_count, 0),
    'realized_pnl', COALESCE(stats.realized_pnl, 0),
    'total_dividends', COALESCE(stats.total_dividends, 0),
    'total_return', COALESCE(stats.realized_pnl, 0) + COALESCE(stats.total_dividends, 0),
    'win_rate', CASE WHEN COALESCE(stats.total_sells, 0) > 0
      THEN ROUND((COALESCE(stats.winning_sells, 0)::numeric / stats.total_sells::numeric) * 100, 1)
      ELSE 0 END,
    'total_sells', COALESCE(stats.total_sells, 0)
  ) INTO _result
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*)::int AS total_trades,
      COALESCE(SUM(CASE WHEN trade_type = 'buy' THEN quantity * price_per_unit ELSE 0 END), 0) AS total_invested,
      COUNT(DISTINCT symbol)::int AS holdings_count,
      COALESCE(SUM(CASE WHEN trade_type = 'sell' THEN
        (price_per_unit - COALESCE((
          SELECT SUM(b.quantity * b.price_per_unit) / NULLIF(SUM(b.quantity), 0)
          FROM public.trades b
          WHERE b.user_id = _target_id AND b.symbol = t.symbol AND b.trade_type = 'buy'
        ), 0)) * quantity
      ELSE 0 END), 0) AS realized_pnl,
      COALESCE(SUM(CASE WHEN trade_type = 'dividend' THEN COALESCE(total_amount, quantity * price_per_unit) ELSE 0 END), 0) AS total_dividends,
      COUNT(CASE WHEN trade_type = 'sell' THEN 1 END)::int AS total_sells,
      COUNT(CASE WHEN trade_type = 'sell' AND price_per_unit > COALESCE((
        SELECT SUM(b.quantity * b.price_per_unit) / NULLIF(SUM(b.quantity), 0)
        FROM public.trades b
        WHERE b.user_id = _target_id AND b.symbol = t.symbol AND b.trade_type = 'buy'
      ), 0) THEN 1 END)::int AS winning_sells
    FROM public.trades t
    WHERE t.user_id = _target_id
  ) stats ON true
  WHERE p.id = _target_id;

  RETURN _result;
END;
$$;

-- 2. Create tables first (both before policies)
CREATE TABLE public.leaderboards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.leaderboard_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leaderboard_id uuid NOT NULL REFERENCES public.leaderboards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  UNIQUE (leaderboard_id, user_id)
);

ALTER TABLE public.leaderboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard_members ENABLE ROW LEVEL SECURITY;

-- 3. Policies for leaderboards
CREATE POLICY "Creator can manage leaderboards"
  ON public.leaderboards FOR ALL TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Members can view leaderboards"
  ON public.leaderboards FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboard_members lm
      WHERE lm.leaderboard_id = id AND lm.user_id = auth.uid()
    )
  );

-- 4. Policies for leaderboard_members
CREATE POLICY "Leaderboard creator can manage members"
  ON public.leaderboard_members FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboards lb
      WHERE lb.id = leaderboard_id AND lb.creator_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.leaderboards lb
      WHERE lb.id = leaderboard_id AND lb.creator_id = auth.uid()
    )
  );

CREATE POLICY "Members can view leaderboard members"
  ON public.leaderboard_members FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.leaderboard_members my
      WHERE my.leaderboard_id = leaderboard_members.leaderboard_id AND my.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can accept their own invite"
  ON public.leaderboard_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 5. Create get_leaderboard_rankings RPC
CREATE OR REPLACE FUNCTION public.get_leaderboard_rankings(_leaderboard_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _result jsonb;
  _week_start timestamptz;
  _month_start timestamptz;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.leaderboard_members
    WHERE leaderboard_id = _leaderboard_id AND user_id = auth.uid()
  ) AND NOT EXISTS (
    SELECT 1 FROM public.leaderboards
    WHERE id = _leaderboard_id AND creator_id = auth.uid()
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  _week_start := date_trunc('week', now());
  _month_start := date_trunc('month', now());

  SELECT jsonb_agg(row_data ORDER BY (row_data->>'monthly_pnl')::numeric DESC)
  INTO _result
  FROM (
    SELECT jsonb_build_object(
      'user_id', lm.user_id,
      'username', p.username,
      'display_name', p.display_name,
      'avatar_url', p.avatar_url,
      'joined', lm.joined_at IS NOT NULL,
      'weekly_pnl', COALESCE((
        SELECT SUM(
          (t.price_per_unit - COALESCE((
            SELECT SUM(b.quantity * b.price_per_unit) / NULLIF(SUM(b.quantity), 0)
            FROM public.trades b
            WHERE b.user_id = lm.user_id AND b.symbol = t.symbol AND b.trade_type = 'buy'
          ), 0)) * t.quantity
        )
        FROM public.trades t
        WHERE t.user_id = lm.user_id AND t.trade_type = 'sell' AND t.trade_date >= _week_start
      ), 0),
      'monthly_pnl', COALESCE((
        SELECT SUM(
          (t.price_per_unit - COALESCE((
            SELECT SUM(b.quantity * b.price_per_unit) / NULLIF(SUM(b.quantity), 0)
            FROM public.trades b
            WHERE b.user_id = lm.user_id AND b.symbol = t.symbol AND b.trade_type = 'buy'
          ), 0)) * t.quantity
        )
        FROM public.trades t
        WHERE t.user_id = lm.user_id AND t.trade_type = 'sell' AND t.trade_date >= _month_start
      ), 0)
    ) AS row_data
    FROM public.leaderboard_members lm
    JOIN public.profiles p ON p.id = lm.user_id
    WHERE lm.leaderboard_id = _leaderboard_id
      AND lm.joined_at IS NOT NULL
  ) sub;

  RETURN COALESCE(_result, '[]'::jsonb);
END;
$$;
