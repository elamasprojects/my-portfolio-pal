
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  reference_id uuid,
  actor_id uuid,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
  ON public.notifications FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, read) WHERE read = false;

-- Trigger function to auto-create notifications on follow request changes
CREATE OR REPLACE FUNCTION public.notify_follow_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, reference_id, actor_id)
    VALUES (NEW.target_id, 'follow_request_received', NEW.id, NEW.requester_id);
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    INSERT INTO public.notifications (user_id, type, reference_id, actor_id)
    VALUES (NEW.requester_id, 'follow_request_accepted', NEW.id, NEW.target_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_follow_request_change
  AFTER INSERT OR UPDATE ON public.follow_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_follow_request();
