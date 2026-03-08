
-- Add username to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Create follow_status enum
DO $$ BEGIN
  CREATE TYPE public.follow_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Create follow_requests table
CREATE TABLE public.follow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status follow_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, target_id)
);

ALTER TABLE public.follow_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own requests"
  ON public.follow_requests FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = target_id);

CREATE POLICY "Users can send requests"
  ON public.follow_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can respond to requests"
  ON public.follow_requests FOR UPDATE TO authenticated
  USING (auth.uid() = target_id);

CREATE POLICY "Users can cancel requests"
  ON public.follow_requests FOR DELETE TO authenticated
  USING (auth.uid() = requester_id);

-- Create shared_exports table
CREATE TABLE public.shared_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  portfolio_name text NOT NULL,
  stats_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own exports"
  ON public.shared_exports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own exports"
  ON public.shared_exports FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view shared exports"
  ON public.shared_exports FOR SELECT TO anon
  USING (true);

-- Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for avatars bucket
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Create exports storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('exports', 'exports', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for exports bucket
CREATE POLICY "Users can upload exports"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'exports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Anyone can view exports"
  ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'exports');

-- Update profiles RLS to allow public viewing (for player search)
CREATE POLICY "Anyone can view profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

-- Security definer function for player summary
CREATE OR REPLACE FUNCTION public.get_player_summary(_requester_id uuid, _target_username text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _target_id uuid;
  _result jsonb;
BEGIN
  -- Get target user id from username
  SELECT id INTO _target_id FROM public.profiles WHERE username = _target_username;
  IF _target_id IS NULL THEN
    RETURN jsonb_build_object('error', 'User not found');
  END IF;

  -- Check if there's an accepted follow request
  IF NOT EXISTS (
    SELECT 1 FROM public.follow_requests
    WHERE requester_id = _requester_id AND target_id = _target_id AND status = 'accepted'
  ) THEN
    RETURN jsonb_build_object('error', 'Not authorized');
  END IF;

  -- Return aggregated summary only
  SELECT jsonb_build_object(
    'username', p.username,
    'display_name', p.display_name,
    'avatar_url', p.avatar_url,
    'total_trades', COALESCE(stats.total_trades, 0),
    'total_invested', COALESCE(stats.total_invested, 0),
    'holdings_count', COALESCE(stats.holdings_count, 0)
  ) INTO _result
  FROM public.profiles p
  LEFT JOIN LATERAL (
    SELECT 
      COUNT(*)::int AS total_trades,
      COALESCE(SUM(CASE WHEN trade_type = 'buy' THEN quantity * price_per_unit ELSE 0 END), 0) AS total_invested,
      COUNT(DISTINCT symbol)::int AS holdings_count
    FROM public.trades t
    WHERE t.user_id = _target_id
  ) stats ON true
  WHERE p.id = _target_id;

  RETURN _result;
END;
$$;

-- Update handle_new_user to set username from metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, username)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email),
    NEW.raw_user_meta_data->>'username'
  );

  INSERT INTO public.portfolios (user_id, name)
  VALUES (NEW.id, 'My Portfolio');

  RETURN NEW;
END;
$function$;
