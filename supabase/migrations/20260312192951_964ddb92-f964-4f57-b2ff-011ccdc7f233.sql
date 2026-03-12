
-- 1. Create portfolio_positions table
CREATE TABLE public.portfolio_positions (
  user_id uuid NOT NULL,
  portfolio_id uuid NOT NULL REFERENCES public.portfolios(id) ON DELETE CASCADE,
  symbol text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  avg_cost numeric NOT NULL DEFAULT 0,
  cost_basis numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, portfolio_id, symbol)
);

-- 2. Enable RLS
ALTER TABLE public.portfolio_positions ENABLE ROW LEVEL SECURITY;

-- 3. RLS policies
CREATE POLICY "Users can view own positions"
  ON public.portfolio_positions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- No direct insert/update/delete from clients — managed by triggers
-- But we need a policy for the trigger (runs as table owner, bypasses RLS)
-- So no additional write policies needed.

-- 4. Function to rebuild a single position from trades ledger
CREATE OR REPLACE FUNCTION public.rebuild_position(_user_id uuid, _portfolio_id uuid, _symbol text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _norm_symbol text := upper(trim(_symbol));
  _qty numeric := 0;
  _avg_cost numeric := 0;
  _total_cost numeric := 0;
  _rec record;
BEGIN
  -- Walk trades chronologically to compute weighted avg cost
  FOR _rec IN
    SELECT trade_type, quantity, price_per_unit, commission_amount
    FROM public.trades
    WHERE user_id = _user_id
      AND portfolio_id = _portfolio_id
      AND upper(trim(symbol)) = _norm_symbol
    ORDER BY trade_date ASC, created_at ASC
  LOOP
    IF _rec.trade_type = 'buy' THEN
      _total_cost := _avg_cost * _qty + _rec.price_per_unit * _rec.quantity + COALESCE(_rec.commission_amount, 0);
      _qty := _qty + _rec.quantity;
      IF _qty > 0 THEN
        _avg_cost := _total_cost / _qty;
      END IF;
    ELSIF _rec.trade_type = 'sell' THEN
      _qty := _qty - _rec.quantity;
      IF _qty <= 0 THEN
        _qty := 0;
        _avg_cost := 0;
      END IF;
    END IF;
    -- dividends don't affect position quantity
  END LOOP;

  IF _qty > 0 THEN
    INSERT INTO public.portfolio_positions (user_id, portfolio_id, symbol, quantity, avg_cost, cost_basis, updated_at)
    VALUES (_user_id, _portfolio_id, _norm_symbol, _qty, _avg_cost, _avg_cost * _qty, now())
    ON CONFLICT (user_id, portfolio_id, symbol)
    DO UPDATE SET quantity = EXCLUDED.quantity, avg_cost = EXCLUDED.avg_cost, cost_basis = EXCLUDED.cost_basis, updated_at = now();
  ELSE
    DELETE FROM public.portfolio_positions
    WHERE user_id = _user_id AND portfolio_id = _portfolio_id AND symbol = _norm_symbol;
  END IF;
END;
$$;

-- 5. Trigger function for AFTER INSERT/UPDATE/DELETE on trades
CREATE OR REPLACE FUNCTION public.trigger_rebuild_position()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    PERFORM public.rebuild_position(OLD.user_id, OLD.portfolio_id, OLD.symbol);
  END IF;
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    PERFORM public.rebuild_position(NEW.user_id, NEW.portfolio_id, NEW.symbol);
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_rebuild_position
AFTER INSERT OR UPDATE OR DELETE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.trigger_rebuild_position();

-- 6. Validation trigger: block sells exceeding available quantity
CREATE OR REPLACE FUNCTION public.validate_sell_quantity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _available numeric;
  _norm_symbol text := upper(trim(NEW.symbol));
BEGIN
  IF NEW.trade_type != 'sell' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(quantity, 0) INTO _available
  FROM public.portfolio_positions
  WHERE user_id = NEW.user_id
    AND portfolio_id = NEW.portfolio_id
    AND symbol = _norm_symbol;

  IF _available IS NULL THEN
    _available := 0;
  END IF;

  IF NEW.quantity > _available THEN
    RAISE EXCEPTION 'Insufficient shares: available %, requested %', _available, NEW.quantity;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_validate_sell
BEFORE INSERT OR UPDATE ON public.trades
FOR EACH ROW
EXECUTE FUNCTION public.validate_sell_quantity();

-- 7. Backfill: generate positions for all existing trades
DO $$
DECLARE
  _rec record;
BEGIN
  -- First normalize existing symbols
  UPDATE public.trades SET symbol = upper(trim(symbol)) WHERE symbol != upper(trim(symbol));
  
  -- Rebuild all distinct positions
  FOR _rec IN
    SELECT DISTINCT user_id, portfolio_id, upper(trim(symbol)) as symbol
    FROM public.trades
  LOOP
    PERFORM public.rebuild_position(_rec.user_id, _rec.portfolio_id, _rec.symbol);
  END LOOP;
END;
$$;
