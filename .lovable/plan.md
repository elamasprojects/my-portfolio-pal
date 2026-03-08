

# Show "Request Accepted" Notifications in Inbox

When another user accepts your follow request, you should see a notification in the Inbox bell icon.

## Approach

Currently the Inbox only shows **incoming pending requests** (people asking to follow you). We'll extend it to also show **recently accepted sent requests** (people who accepted your request), displayed as read-only notification items.

## Changes

### 1. `src/hooks/useFollows.tsx`
- Add a new query `acceptedSentRequests` that fetches sent requests with `status = 'accepted'`, ordered by `updated_at desc`, limited to recent ones (e.g. last 7 days) so the inbox doesn't fill with old acceptances.

### 2. `src/components/Inbox.tsx`
- Import and display `acceptedSentRequests` from `useFollows`
- Fetch profiles for accepted request `target_id`s (the person who accepted)
- Render them below incoming requests with a distinct style (e.g. green checkmark, "accepted your request" text)
- Badge count = incoming pending + recent accepted notifications

### 3. `src/i18n/en.ts` and `src/i18n/es.ts`
- Add `"social.acceptedYourRequest": "Accepted your request"` translation key

