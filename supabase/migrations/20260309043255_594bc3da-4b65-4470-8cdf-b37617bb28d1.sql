ALTER TABLE public.trades ADD COLUMN original_currency text NOT NULL DEFAULT 'USD';
ALTER TABLE public.trades ADD COLUMN original_price numeric;