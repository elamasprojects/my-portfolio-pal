-- Follow-up to 20260814020000_chess_schema_consolidation.sql.
--
-- Two problems that consolidation left behind:
--
--   1. `target_price_ars` was written with whatever currency the capture form was set to
--      (USD by default) and read back as ARS by three different views, each guessing
--      differently. Every price in this codebase is stored normalised to USD
--      (`trades.price_per_unit`); the thesis levels now follow the same rule, so there is
--      one interpretation instead of three. The column had no rows, so nothing is migrated.
--
--   2. `split_factor` and `invalidation_price_ars` were read by the Game Review engine but
--      never created, so split adjustment and the invalidation blunder rule could never fire.

ALTER TABLE public.trades
  ADD COLUMN IF NOT EXISTS target_price_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS invalidation_price_usd NUMERIC,
  ADD COLUMN IF NOT EXISTS split_factor NUMERIC NOT NULL DEFAULT 1;

ALTER TABLE public.trades
  DROP CONSTRAINT IF EXISTS trades_split_factor_positive;
ALTER TABLE public.trades
  ADD CONSTRAINT trades_split_factor_positive CHECK (split_factor > 0);

-- Ambiguous by construction: same column, three readings. Replaced by target_price_usd.
ALTER TABLE public.trades DROP COLUMN IF EXISTS target_price_ars;

-- Reference-data caches: the consolidation migration granted SELECT only, reasoning that
-- writes would come from a service-role ingestion job. No such job exists — the browser
-- client is the only writer (src/lib/apiIngestion.ts), so every cache write was silently
-- rejected and the DB cache never populated.
--
-- INSERT (not UPDATE/DELETE) keeps the original protection: a signed-in user can extend the
-- shared series with a month or a day that is missing, but cannot rewrite or erase a value
-- somebody else already recorded. Ingestion inserts with ON CONFLICT DO NOTHING.
DROP POLICY IF EXISTS "Allow authenticated insert on inflation_index" ON public.inflation_index;
CREATE POLICY "Allow authenticated insert on inflation_index"
  ON public.inflation_index FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated insert on fx_rates" ON public.fx_rates;
CREATE POLICY "Allow authenticated insert on fx_rates"
  ON public.fx_rates FOR INSERT
  TO authenticated
  WITH CHECK (true);
