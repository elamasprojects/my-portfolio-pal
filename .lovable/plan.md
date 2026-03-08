

# Mark Notifications as Read

## Approach

Use **localStorage** to track which notification IDs the user has seen. When the popover opens, all current notification IDs are saved to localStorage. The badge count only shows **unseen** notifications.

No database changes needed — this is a lightweight client-side solution appropriate for this use case (follow request notifications are already ephemeral).

## Changes

### `src/components/Inbox.tsx`

- Add `useState` for `readIds` (a `Set<string>` initialized from localStorage)
- On popover `onOpenChange(true)`, save all current notification IDs to localStorage and update state
- Badge count = `totalCount - readCount` (only show unread)
- Visually dim already-read notifications with reduced opacity
- localStorage key: `inbox-read-ids-{userId}` to scope per user

### `src/i18n/en.ts` + `es.ts`

- Add `social.markAllRead` key (optional, for a future "mark all read" button)

## Technical Detail

```text
Open popover → collect all notification IDs → save to localStorage
Badge = total - intersection(allIds, readIds)
Read items render with opacity-60
```

One file changed: `src/components/Inbox.tsx`. Minor i18n additions.

