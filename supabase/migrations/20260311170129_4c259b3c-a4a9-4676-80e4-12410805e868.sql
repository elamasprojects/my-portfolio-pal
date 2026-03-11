
-- Brokers reference table
CREATE TABLE public.brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'AR',
  category TEXT NOT NULL DEFAULT 'digital',
  display_order INT NOT NULL DEFAULT 0
);

-- Public read-only, no RLS needed
ALTER TABLE public.brokers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read brokers" ON public.brokers FOR SELECT TO authenticated USING (true);

-- User broker preferences
CREATE TABLE public.user_brokers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broker_id UUID NOT NULL REFERENCES public.brokers(id) ON DELETE CASCADE,
  commission_pct NUMERIC NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, broker_id)
);

ALTER TABLE public.user_brokers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own user_brokers" ON public.user_brokers FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own user_brokers" ON public.user_brokers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own user_brokers" ON public.user_brokers FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own user_brokers" ON public.user_brokers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Add broker columns to trades
ALTER TABLE public.trades ADD COLUMN broker_id UUID REFERENCES public.brokers(id);
ALTER TABLE public.trades ADD COLUMN commission_pct NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.trades ADD COLUMN commission_amount NUMERIC NOT NULL DEFAULT 0;

-- Add brokers_enabled to profiles
ALTER TABLE public.profiles ADD COLUMN brokers_enabled BOOLEAN NOT NULL DEFAULT false;

-- Trigger to enforce single default broker per user
CREATE OR REPLACE FUNCTION public.enforce_single_default_broker()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.is_default = true THEN
    UPDATE public.user_brokers
    SET is_default = false
    WHERE user_id = NEW.user_id AND id != NEW.id AND is_default = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_single_default_broker_trigger
  BEFORE INSERT OR UPDATE ON public.user_brokers
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_single_default_broker();
