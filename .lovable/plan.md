

# Supabase-backed Notification System

## Overview

Replace the localStorage-based read tracking with a proper `notifications` table in Supabase. Notifications are created automatically via database triggers when relevant events occur (follow request received, follow request accepted). Read state syncs across all devices.

## Database Changes

### 1. Create `notifications` table

```sql
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,           -- 'follow_request_received', 'follow_request_accepted'
  reference_id uuid,            -- ID of the follow_request that triggered it
  actor_id uuid,                -- who triggered the notification
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
```

### 2. Trigger: auto-create notification on new follow request

```sql
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
```

## Frontend Changes

### `src/hooks/useNotifications.tsx` (new)

- Query `notifications` table ordered by `created_at DESC`, joined with actor profiles
- `markAsRead` mutation: `UPDATE notifications SET read = true WHERE user_id = auth.uid() AND read = false`
- `unreadCount` derived from query data
- Expose: `notifications`, `unreadCount`, `markAllAsRead`

### `src/components/Inbox.tsx` (rewrite)

- Replace all localStorage logic with `useNotifications` hook
- On popover open → call `markAllAsRead`
- Render notifications by type:
  - `follow_request_received` → show accept/decline buttons (lookup pending status from `follow_requests` via `reference_id`)
  - `follow_request_accepted` → show confirmation with green checkmark
- Keep existing avatar/profile display logic (fetch profiles by `actor_id`)
- Remove `loadReadIds`, `saveReadIds`, `getStorageKey` functions entirely

### Files

| File | Action |
|------|--------|
| Migration SQL | Create `notifications` table + trigger |
| `src/hooks/useNotifications.tsx` | New hook |
| `src/components/Inbox.tsx` | Rewrite to use Supabase notifications |

