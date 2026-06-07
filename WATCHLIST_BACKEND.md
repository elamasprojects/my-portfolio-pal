# Watchlist — Backend setup (Supabase)

The watchlist is now a **real, DB-backed feature**: search a ticker, add it, remove it, and the
list persists per-user and syncs across devices (production `/watchlist`, the `/demo` Watchlist
screen, and the watch view all read the same table).

The **frontend is already wired** to a Supabase table called `public.watchlist` via
`src/hooks/useWatchlist.ts`. The only thing left is to **create that table** (one migration). Until
it exists the UI degrades gracefully — the list shows empty and "Add symbol" surfaces a toast —
so nothing else breaks. Once you apply the SQL below, **no code change is needed**; it just works.

> I couldn't apply this from my environment: the Management API token on this machine returns
> `403` (no Management privileges) and the Supabase MCP servers time out / report no permission.
> Hence this hand-off doc. Pick **one** of the methods below — Method A (Dashboard) is the
> simplest and needs no local tooling.

---

## What gets created

A single table + Row Level Security so each user only ever sees their own rows:

| column       | type          | notes                                             |
|--------------|---------------|---------------------------------------------------|
| `id`         | `uuid` PK     | `default gen_random_uuid()`                       |
| `user_id`    | `uuid`        | FK → `auth.users(id)`, `on delete cascade`        |
| `symbol`     | `text`        | stored upper-case (the client normalizes)         |
| `name`       | `text`        | company/description (nullable)                    |
| `created_at` | `timestamptz` | `default now()` — list is ordered by this         |

Constraints: `unique (user_id, symbol)` (no duplicates — the client treats a duplicate insert,
Postgres error `23505`, as success) and an index on `user_id`.

The canonical SQL also lives at
[`supabase/migrations/20260607000000_create_watchlist.sql`](supabase/migrations/20260607000000_create_watchlist.sql).

---

## The SQL

```sql
create table if not exists public.watchlist (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  symbol     text not null,
  name       text,
  created_at timestamptz not null default now(),
  unique (user_id, symbol)
);

create index if not exists watchlist_user_id_idx on public.watchlist (user_id);

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
```

---

## Apply it — pick one method

### Method A — Supabase Dashboard SQL Editor (recommended, no tooling)

1. Open the project dashboard → **SQL Editor** → **New query**
   (https://supabase.com/dashboard/project/yimbswiaqmuggmqygicf/sql/new).
2. Paste the SQL above and click **Run**.
3. Confirm success (see *Verify* below). Done — the app picks it up immediately on next load.

### Method B — Supabase CLI (`db push`)

The project is already linked (`project_id = yimbswiaqmuggmqygicf`) and the migration file is
committed, so this pushes it to the remote DB. `db push` talks to the remote directly — it does
**not** need Docker (only `supabase start` / `db reset` / `db diff` do).

```sh
npx supabase db push
```

If prompted to log in / link first:

```sh
npx supabase login
npx supabase link --project-ref yimbswiaqmuggmqygicf
npx supabase db push
```

### Method C — Management API (executes as `postgres`)

If you have a Personal Access Token with Management rights
(https://supabase.com/dashboard/account/tokens), run the query endpoint. PowerShell:

```powershell
$token = "<YOUR_SUPABASE_ACCESS_TOKEN>"
$sql   = Get-Content -Raw "supabase/migrations/20260607000000_create_watchlist.sql"
Invoke-RestMethod -Method Post `
  -Uri "https://api.supabase.com/v1/projects/yimbswiaqmuggmqygicf/database/query" `
  -Headers @{ Authorization = "Bearer $token"; "Content-Type" = "application/json" } `
  -Body (@{ query = $sql } | ConvertTo-Json)
```

---

## Verify

Run in the SQL Editor (or via the query endpoint):

```sql
-- table exists with the right columns
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'watchlist'
order by ordinal_position;

-- RLS is on + three policies present
select policyname, cmd
from pg_policies
where schemaname = 'public' and tablename = 'watchlist';
```

You should see the 5 columns and 3 policies (`SELECT` / `INSERT` / `DELETE`). Then, in the app:
sign in → **Watchlist** → **Add symbol** → search e.g. `AAPL` → it persists across a reload and
shows on another device with the same account.

Optional (keeps generated types current — not required, the hook casts `"watchlist" as any`):

```sh
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```

---

## Rollback

```sql
drop table if exists public.watchlist;  -- policies + index drop with it
```

---

## How the frontend uses it (reference)

- **`src/hooks/useWatchlist.ts`** — React Query CRUD (mirrors `useTags`):
  - `select id, symbol, name, created_at … eq user_id … order created_at`
  - `insert { user_id, symbol (UPPER), name }` — ignores `23505` (already present)
  - `delete … eq user_id … eq symbol`
  - returns `{ items, isLoading, add(symbol, name), remove(symbol) }`
- **`src/components/AddToWatchlistButton.tsx`** — symbol search via the `search-symbol` edge
  function → `add()`.
- **Consumers:** `src/pages/Watchlist.tsx`, `src/pages/demo/screens/WatchlistScreen.tsx`,
  `src/hooks/useWatchData.ts` + `src/pages/demo/screens/WatchScreen.tsx` (watch view).

No mock data remains — `src/lib/watchlist.ts` (the old sample universe) was deleted.
