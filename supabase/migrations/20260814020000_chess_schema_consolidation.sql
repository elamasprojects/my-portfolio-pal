-- Consolidation migration for Project Chess (Milestone M1)
-- Tables: inflation_index, fx_rates, game_reviews, backups
-- Alterations: trades (pre-trade thesis & friction inversion columns)

-- 1. Table: public.inflation_index
CREATE TABLE IF NOT EXISTS public.inflation_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month DATE NOT NULL UNIQUE,
  index_value NUMERIC NOT NULL,
  monthly_rate NUMERIC,
  source TEXT NOT NULL DEFAULT 'argentinadatos_indec',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inflation_index_month ON public.inflation_index(month DESC);

ALTER TABLE public.inflation_index ENABLE ROW LEVEL SECURITY;

-- inflation_index is shared reference data: world-readable, but writable only by
-- the service role (ingestion jobs). Granting FOR ALL to `authenticated` would let
-- any signed-in user delete or poison the series for everybody.
DROP POLICY IF EXISTS "Allow public read access on inflation_index" ON public.inflation_index;
DROP POLICY IF EXISTS "Allow authenticated manage access on inflation_index" ON public.inflation_index;

CREATE POLICY "Allow public read access on inflation_index"
  ON public.inflation_index FOR SELECT
  USING (true);

-- 2. Table: public.fx_rates
CREATE TABLE IF NOT EXISTS public.fx_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_date DATE NOT NULL UNIQUE,
  ccl_rate NUMERIC NOT NULL,
  mep_rate NUMERIC,
  oficial_rate NUMERIC,
  source TEXT NOT NULL DEFAULT 'dolarapi',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fx_rates_date ON public.fx_rates(rate_date DESC);

ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;

-- Same rationale as inflation_index: shared reference data, read-only for users.
DROP POLICY IF EXISTS "Allow public read access on fx_rates" ON public.fx_rates;
DROP POLICY IF EXISTS "Allow authenticated manage access on fx_rates" ON public.fx_rates;

CREATE POLICY "Allow public read access on fx_rates"
  ON public.fx_rates FOR SELECT
  USING (true);

-- 3. Table: public.game_reviews
CREATE TABLE IF NOT EXISTS public.game_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  trade_id UUID NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE UNIQUE,
  do_nothing_return_ars NUMERIC,
  spy_return NUMERIC,
  ccl_return NUMERIC,
  fixed_deposit_return NUMERIC,
  outcome_classification TEXT NOT NULL DEFAULT 'Correcta',
  net_cost_usd NUMERIC,
  audited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_reviews_trade ON public.game_reviews(trade_id);
CREATE INDEX IF NOT EXISTS idx_game_reviews_user ON public.game_reviews(user_id);

-- If an earlier revision of this migration already ran, it created a nullable
-- user_id and the code wrote NULL-owner rows. Those rows are unattributable and
-- were readable by every authenticated user, so drop them and close the column.
DELETE FROM public.game_reviews WHERE user_id IS NULL;
ALTER TABLE public.game_reviews ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.game_reviews ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.game_reviews ENABLE ROW LEVEL SECURITY;

-- `OR user_id IS NULL` would expose every unowned row to every authenticated user.
DROP POLICY IF EXISTS "Users can manage own game reviews" ON public.game_reviews;

CREATE POLICY "Users can manage own game reviews"
  ON public.game_reviews FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Table: public.backups
CREATE TABLE IF NOT EXISTS public.backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  export_data JSONB NOT NULL,
  retention_weeks INT NOT NULL DEFAULT 12,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backups_user_created ON public.backups(user_id, created_at DESC);

-- backups.export_data holds a full portfolio snapshot; a NULL owner meant every
-- authenticated user could read (and delete) it.
DELETE FROM public.backups WHERE user_id IS NULL;
ALTER TABLE public.backups ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.backups ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own backups" ON public.backups;

CREATE POLICY "Users can manage own backups"
  ON public.backups FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Alter Table: public.trades (Pre-Trade Thesis & Friction Inversion)
ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS entry_thesis TEXT,
  ADD COLUMN IF NOT EXISTS target_price_ars NUMERIC,
  ADD COLUMN IF NOT EXISTS invalidation_condition TEXT,
  ADD COLUMN IF NOT EXISTS is_planned_exit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS unplanned_rationale TEXT;
