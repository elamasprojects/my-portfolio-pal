-- Selling a whole position was rejected as "Insufficient shares" even when the request was for
-- exactly what the ledger held.
--
-- Two causes, both here:
--
--   1. `validate_sell_quantity` read the available quantity from `portfolio_positions`, a cache
--      that `rebuild_position` deliberately empties for holdings under 0.005 units or $10 of
--      cost basis. For those positions the trigger saw 0 available and refused every sale — the
--      position was in the ledger but could never be closed.
--
--   2. The comparison was exact. The browser sums quantities in IEEE-754 doubles while Postgres
--      sums them as `numeric`, so a full exit computed client-side lands a few femto-shares above
--      the ledger figure (105.74550581601055 requested against 105.745505816010414 available)
--      and tripped the check.
--
-- Available is now derived from the trades ledger itself, and the comparison carries a tolerance
-- far below any tradable fraction of a share.

CREATE OR REPLACE FUNCTION public.position_quantity(
  _user_id uuid,
  _portfolio_id uuid,
  _symbol text
)
RETURNS numeric
LANGUAGE sql
STABLE
-- INVOKER on purpose. As DEFINER this would bypass RLS on `trades` while taking `_user_id`
-- straight from the caller, so any signed-in user could read anyone else's exact position
-- sizes. Running as the invoker means RLS filters the sum to rows the caller already owns;
-- passing somebody else's id simply returns 0. `validate_sell_quantity` is DEFINER, so the
-- trigger still sees the full ledger for the row it is validating.
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(SUM(
    CASE
      WHEN trade_type = 'buy'  THEN quantity
      WHEN trade_type = 'sell' THEN -quantity
      ELSE 0
    END
  ), 0)
  FROM public.trades
  WHERE user_id = _user_id
    AND portfolio_id = _portfolio_id
    AND upper(trim(symbol)) = upper(trim(_symbol));
$function$;

COMMENT ON FUNCTION public.position_quantity(uuid, uuid, text) IS
  'Exact units held of a symbol, summed from the trades ledger in numeric. The authoritative '
  'figure for a full exit: a browser''s floating-point total differs in the last digits.';

GRANT EXECUTE ON FUNCTION public.position_quantity(uuid, uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.validate_sell_quantity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _available numeric;
  -- Well below any tradable fraction of a share, and far above double-rounding noise.
  _tolerance constant numeric := 0.000001;
BEGIN
  IF NEW.trade_type != 'sell' THEN
    RETURN NEW;
  END IF;

  _available := public.position_quantity(NEW.user_id, NEW.portfolio_id, NEW.symbol);

  -- A BEFORE INSERT does not see NEW in the table, so the sum already excludes it. A BEFORE
  -- UPDATE does see OLD, so remove the row's own signed contribution before comparing —
  -- otherwise editing a sell in place always reads as an over-sell.
  -- Only when the edit stays on the same position; re-pointing a row at another symbol or
  -- portfolio means OLD never contributed to this sum, and crediting it back would inflate
  -- the available quantity and let an over-sell through.
  IF TG_OP = 'UPDATE'
     AND OLD.user_id = NEW.user_id
     AND OLD.portfolio_id = NEW.portfolio_id
     AND upper(trim(OLD.symbol)) = upper(trim(NEW.symbol))
  THEN
    _available := _available - (
      CASE OLD.trade_type
        WHEN 'buy'  THEN OLD.quantity
        WHEN 'sell' THEN -OLD.quantity
        ELSE 0
      END
    );
  END IF;

  IF NEW.quantity > _available + _tolerance THEN
    RAISE EXCEPTION 'Insufficient shares: available %, requested %', _available, NEW.quantity;
  END IF;

  RETURN NEW;
END;
$function$;
