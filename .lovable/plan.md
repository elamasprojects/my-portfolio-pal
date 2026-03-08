

# Add Real-time Notifications via Supabase Realtime

## Approach

Subscribe to Supabase Realtime on the `notifications` table, filtered to `user_id = auth.uid()`. When an INSERT event arrives, invalidate the notifications query cache so the inbox updates instantly.

## Changes

### `src/hooks/useNotifications.tsx`

- Add a `useEffect` that creates a Supabase Realtime channel subscription on `public:notifications` with a filter `user_id=eq.{user.id}`
- On `INSERT` events, invalidate the `["notifications", user.id]` query key to refetch
- Clean up the subscription on unmount or when user changes
- No changes needed to the Inbox component — it already reacts to query data changes

### Database

Supabase Realtime needs the `notifications` table added to the realtime publication. This requires a migration:

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
```

## Summary

Two changes total: one SQL migration (1 line) and one `useEffect` added to `useNotifications.tsx` (~15 lines).

