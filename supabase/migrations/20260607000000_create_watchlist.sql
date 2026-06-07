-- Watchlist: per-user list of tickers to track (live quotes are fetched client-side).
-- Powers the production /watchlist page, the /demo Watchlist screen, and the watch view.

create table if not exists public.watchlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  symbol     text not null,
  name       text,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

-- One user = one watchlist; queries always filter by user_id.
create index if not exists watchlist_user_id_idx on public.watchlist (user_id);

-- Row Level Security: a user may only see/modify their own rows.
alter table public.watchlist enable row level security;

create policy "Users can view their own watchlist"
  on public.watchlist for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can add to their own watchlist"
  on public.watchlist for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can remove from their own watchlist"
  on public.watchlist for delete
  to authenticated
  using (auth.uid() = user_id);
