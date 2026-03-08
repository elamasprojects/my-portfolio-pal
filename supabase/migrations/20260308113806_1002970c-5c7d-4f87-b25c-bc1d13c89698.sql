
CREATE TABLE public.discipline_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rule_type text NOT NULL,
  rule_value numeric,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.discipline_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own discipline rules"
  ON public.discipline_rules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own discipline rules"
  ON public.discipline_rules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own discipline rules"
  ON public.discipline_rules FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own discipline rules"
  ON public.discipline_rules FOR DELETE
  USING (auth.uid() = user_id);
