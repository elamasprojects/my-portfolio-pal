

# Add "Clear All Notifications" Button

## Changes

### `src/hooks/useNotifications.tsx`
Add a `clearAll` mutation that deletes all notifications for the current user:
```typescript
const clearAll = useMutation({
  mutationFn: async () => {
    const { error } = await supabase
      .from("notifications")
      .delete()
      .eq("user_id", user.id);
    if (error) throw error;
  },
  onSuccess: () => invalidate
});
```
Return `clearAll` alongside existing exports.

### `src/components/Inbox.tsx`
- Import `Trash2` icon from lucide-react
- Add a "Clear all" button in the popover header (next to the title), visible only when `notifications.length > 0`
- Button calls `clearAll.mutate()` and shows a success toast

### `src/i18n/en.ts` + `src/i18n/es.ts`
- Add `social.clearAll`: "Clear all" / "Borrar todo"

No database changes needed — DELETE RLS policy already exists on `notifications`.

