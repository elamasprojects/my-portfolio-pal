
-- 1. Helper: check if two users are connected (accepted follow_request)
CREATE OR REPLACE FUNCTION public.is_connected_to(_user_id uuid, _other_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.follow_requests
    WHERE status = 'accepted'
      AND ((requester_id = _user_id AND target_id = _other_id)
        OR (requester_id = _other_id AND target_id = _user_id))
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_connected_to FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_connected_to TO authenticated;

-- 2. New RPC: get_player_summary_by_id (same logic, but by UUID)
CREATE OR REPLACE FUNCTION public.get_player_summary_by_id(_requester_id uuid, _target_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _result jsonb;
BEGIN
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

-- 3. RLS: Connected users can SELECT trades
CREATE POLICY "Connected users can view trades"
  ON public.trades FOR SELECT TO authenticated
  USING (public.is_connected_to(auth.uid(), user_id));

-- 4. RLS: Connected users can SELECT portfolios
CREATE POLICY "Connected users can view portfolios"
  ON public.portfolios FOR SELECT TO authenticated
  USING (public.is_connected_to(auth.uid(), user_id));
