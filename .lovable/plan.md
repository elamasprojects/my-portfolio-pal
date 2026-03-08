

# Add "My Connections" Section to Players Page

## Problem
Users have no way to see a list of people they're already connected with. They must search by name each time. There's no "my connections" view.

## Solution
Add a "My Connections" tab to the `/players` page showing all accepted connections (both directions — people you followed and people who followed you). Each connection card links to their profile.

## Changes

### 1. `src/pages/Players.tsx`
- Add a Tabs component with two tabs: "Search" and "My Connections"
- "Search" tab contains the existing search UI
- "My Connections" tab queries `follow_requests` where status = 'accepted' and current user is either `requester_id` or `target_id`, fetches the other user's profile, and renders clickable cards linking to `/player/:username`

### 2. `src/i18n/en.ts` / `src/i18n/es.ts`
- Add keys: `social.myConnections`, `social.noConnections`, `social.search`

No database changes needed — all data is already available via existing tables and RLS policies.

