
-- Migration 1: Trade tags system
CREATE TABLE public.trade_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#3b82f6',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, name)
);
ALTER TABLE public.trade_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tags" ON public.trade_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tags" ON public.trade_tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON public.trade_tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON public.trade_tags FOR DELETE USING (auth.uid() = user_id);

-- Junction table
CREATE TABLE public.trade_tag_assignments (
  trade_id uuid NOT NULL REFERENCES public.trades(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.trade_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (trade_id, tag_id)
);
ALTER TABLE public.trade_tag_assignments ENABLE ROW LEVEL SECURITY;

-- RLS for junction table using security definer to avoid recursion
CREATE OR REPLACE FUNCTION public.owns_trade(_user_id uuid, _trade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trades WHERE id = _trade_id AND user_id = _user_id
  )
$$;

CREATE POLICY "Users can view own tag assignments" ON public.trade_tag_assignments FOR SELECT USING (public.owns_trade(auth.uid(), trade_id));
CREATE POLICY "Users can insert own tag assignments" ON public.trade_tag_assignments FOR INSERT WITH CHECK (public.owns_trade(auth.uid(), trade_id));
CREATE POLICY "Users can delete own tag assignments" ON public.trade_tag_assignments FOR DELETE USING (public.owns_trade(auth.uid(), trade_id));
