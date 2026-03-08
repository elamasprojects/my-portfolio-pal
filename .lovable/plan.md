

# Social Features + Twitter Login + Shareable Export

## 1. Twitter/X OAuth Login

**Auth page**: Add a "Sign in with X" button alongside Google. Uses `supabase.auth.signInWithOAuth({ provider: 'twitter' })`.

**Prerequisite (user action)**: The user must enable the Twitter provider in their [Supabase Auth Providers dashboard](https://supabase.com/dashboard/project/yimbswiaqmuggmqygicf/auth/providers) and add their Twitter Consumer Key/Secret there. This cannot be done from code.

**File**: `src/pages/Auth.tsx` — add Twitter/X button with `FaXTwitter` icon from `react-icons`.

## 2. Username + Profile Photo

### Database changes (migration)

- Add `username` (text, unique, nullable) column to `profiles` table
- Create `avatars` storage bucket (public) with RLS for authenticated uploads
- Update `handle_new_user()` trigger to also set username from `raw_user_meta_data`

### Sign-up flow

- **Auth page**: When `!isLogin`, show a "Username" input field. Pass it as `data: { display_name: username }` in the `signUp` options so the trigger picks it up.

### Profile settings page (`/settings`)

- New page with: avatar upload (to `avatars` bucket), editable username, editable display name
- Avatar displayed via Supabase Storage public URL
- New route in `App.tsx`, new nav item in sidebar

### useProfile hook

- Fetches profile from `profiles` table (display_name, avatar_url, username)
- Provides `updateProfile` mutation
- Used in sidebar (avatar image instead of initials), settings page, export card

## 3. Social — Portfolio View Requests + Inbox

### Database (migration)

```sql
-- Request statuses
create type public.follow_status as enum ('pending', 'accepted', 'declined');

-- Follow/view requests table
create table public.follow_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  target_id uuid not null references auth.users(id) on delete cascade,
  status follow_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(requester_id, target_id)
);

alter table public.follow_requests enable row level security;

-- Users can see requests they sent or received
create policy "Users can view own requests"
  on public.follow_requests for select to authenticated
  using (auth.uid() = requester_id or auth.uid() = target_id);

-- Users can insert requests where they are the requester
create policy "Users can send requests"
  on public.follow_requests for insert to authenticated
  with check (auth.uid() = requester_id);

-- Users can update requests they received (accept/decline)
create policy "Users can respond to requests"
  on public.follow_requests for update to authenticated
  using (auth.uid() = target_id);

-- Users can delete requests they sent
create policy "Users can cancel requests"
  on public.follow_requests for delete to authenticated
  using (auth.uid() = requester_id);
```

### Player search + request flow

- **New page `/players`** — search users by username. Shows avatar + username. "Request Access" button sends a follow request.
- Add nav item "Players" to sidebar (icon: `Users`)

### Inbox

- **Inbox icon** in the `AppLayout` header, next to the sidebar trigger. Shows a badge with pending count.
- Clicking opens a sheet/popover listing pending requests with Accept/Decline buttons.
- Uses `follow_requests` table filtered by `target_id = auth.uid()` and `status = 'pending'`.

### Viewing another player's portfolio

- **New page `/player/:username`** — shows limited metrics (total invested, win rate, realized P&L, holdings count) for accepted connections only.
- RLS on trades/portfolios stays strict — the viewer page uses a **security definer function** `get_player_summary(target_user_id)` that checks `follow_requests` status before returning aggregated (not raw) data.

### Sidebar changes

- Profile dropdown shows only avatar circle (no email text)
- Inbox bell icon in header with unread count badge

## 4. Export as Shareable Card + Share to X

### Export page redesign

- The report preview becomes a designed "card" (fixed aspect ratio, ~1200x630px for Twitter card dimensions)
- Compact layout: portfolio name, key stats (invested, P&L, win rate), allocation pie, user avatar + username
- "Share to X" button: captures the card as PNG via `html2canvas`, then opens `https://twitter.com/intent/tweet?text=...&url=...` (the user would need to manually attach the image, OR we upload to storage and link)
- Alternative: upload the PNG to Supabase Storage `exports` bucket (public), generate a public URL, and use Twitter Card meta tags on a public share page

### Share flow (practical approach)

1. User clicks "Share to X"
2. Card is rendered to PNG via html2canvas
3. PNG is uploaded to a public `exports` storage bucket
4. A shareable URL is generated: `{origin}/share/{export_id}`
5. Twitter intent URL opens with the shareable link
6. The `/share/:id` page is public (no auth) and displays the card image with proper OG meta tags

### Database + Storage

- Create `exports` storage bucket (public)
- Create `shared_exports` table: `id, user_id, image_url, portfolio_name, stats_json, created_at`

## Files Summary

```text
MIGRATION:
  - Add username to profiles
  - Create avatars bucket + RLS
  - Create exports bucket + RLS
  - Create follow_requests table + RLS
  - Create shared_exports table + RLS
  - Create get_player_summary() security definer function

NEW:
  src/pages/Settings.tsx          — Profile editor (avatar, username, display name)
  src/pages/Players.tsx           — Search users, send follow requests
  src/pages/PlayerProfile.tsx     — View accepted player's summary
  src/pages/SharedExport.tsx      — Public share page (no auth)
  src/hooks/useProfile.tsx        — Profile CRUD hook
  src/hooks/useFollows.tsx        — Follow requests hook
  src/components/Inbox.tsx        — Inbox popover with pending requests

MODIFIED:
  src/App.tsx                     — New routes (/settings, /players, /player/:username, /share/:id)
  src/pages/Auth.tsx              — Twitter/X button, username field on signup
  src/pages/ExportReport.tsx      — Shareable card layout, "Share to X" button
  src/components/AppSidebar.tsx   — Avatar image, Players nav, remove email from trigger
  src/components/AppLayout.tsx    — Inbox icon in header
  src/i18n/en.ts + es.ts         — New translation keys
  supabase/config.toml            — (no changes needed)
```

**User action required**: Enable Twitter provider in the [Supabase Auth Providers dashboard](https://supabase.com/dashboard/project/yimbswiaqmuggmqygicf/auth/providers) with your Twitter app credentials.

