# CLAUDE.md

Guidance for Claude Code (and other AI agents) working in this repository.

## Project

**Chess — Your Portfolio Strategy** (package `vite_react_shadcn_ts`). A PWA for strategic
investment-portfolio tracking aimed at retail investors, with Argentine-market support (MEP
dollar, local brokers). Users log buy/sell trades, track positions & realized/unrealized P&L,
analyze performance, earn achievements, follow other "players" (leaderboards), and use planning
tools (risk profile, compound & DCA calculators). Scaffolded with Lovable; deployed on Vercel.

## Active Test Account Context

For local testing, debugging, or database access:
- **Email:** `ezequiellamas@gmail.com`
- **Password:** `123456`
- **User ID:** `409422f9-ef9d-4818-a756-bfbb5fac6d7f`
- **Portfolio ID:** `e9b993fe-e93b-414f-a53b-86c580be02d1`

---

## ⚠️ Important project rules (read first)

### 1. Supabase — always use the CLI, never the MCP
For **any** Supabase query or action (reads **and** writes), use the Supabase **CLI**
(`npx supabase …`) — **not** the Supabase MCP server. Only fall back to the MCP if the CLI
path is genuinely impossible. See [Supabase](#supabase) for the working method on this machine
(Docker is not installed here, so use the access-token + Management API path for ad-hoc SQL).

### 2. Pushing to `main` — commit as the `elamasprojects` GitHub account
Every push to `main` must be **authored** by the GitHub account:

- **name:** `elamasprojects`
- **email:** `ezequiellamas@gmail.com`

Ensure the git author identity is set before committing to `main` (this repo's local config is
already set this way — keep it):

```sh
git config user.name "elamasprojects"
git config user.email "ezequiellamas@gmail.com"
```

Push using the `elamasprojects` GitHub credentials. Do not commit/push to `main` under any other
author. (Remote: `github.com/elamasprojects/my-portfolio-pal`, default branch `main`.)

---

## Commands

```sh
npm run dev        # Vite dev server → http://localhost:8080
npm run build      # Production build
npm run build:dev  # Development-mode build
npm run lint       # ESLint
npm run preview    # Preview the production build
npm run test       # Run unit tests once (Vitest)
npm run test:watch # Vitest watch mode
```

Tests: Vitest + jsdom + Testing Library; setup in `src/test/setup.ts`; files named
`src/**/*.{test,spec}.{ts,tsx}`.

## Tech stack

- **Build:** Vite 5 + `@vitejs/plugin-react-swc`, TypeScript.
- **UI:** React 18, shadcn/ui (Radix primitives under `src/components/ui`), Tailwind CSS,
  `lucide-react`, `motion`/framer-motion, `recharts`, `three` (3D backgrounds).
- **Routing:** React Router v6 (`BrowserRouter`).
- **Server state:** TanStack React Query.
- **Forms/validation:** `react-hook-form` + `zod` (`@hookform/resolvers`).
- **Backend:** Supabase (`@supabase/supabase-js`) — Auth, Postgres, Edge Functions (Deno).
- **PWA:** `vite-plugin-pwa` (autoUpdate); app name "Chess".
- **i18n:** custom provider in `src/i18n` (English + Spanish).
- **Export/misc:** `jspdf` + `html2canvas`, `sonner` (toasts), `date-fns`.
- **Dev-only:** `lovable-tagger`.

Path alias: **`@` → `src/`** (configured in `vite.config.ts`, `vitest.config.ts`, tsconfig).
Dev server runs on port **8080**.

## Project structure

```
src/
  main.tsx, App.tsx        # entry + routes
  components/              # app components
    ui/                    # shadcn/ui primitives (generated — follow their conventions)
  hooks/                   # data + domain hooks: useAuth, usePortfolio, usePortfolioPositions,
                           #   useBrokers, useMarketPrices, useStrategies, useDolarMEP, useTags,
                           #   useAchievements, useDiscipline, useNotifications, useFollows, …
  pages/                   # route pages (Index, AddTradeHub, TradeLog, AnalysisHub, ProgressHub,
                           #   AssetDetail, Strategy, Chess, Players, Tools, Settings, …)
  integrations/supabase/   # client.ts (createClient) + types.ts (GENERATED — do not edit)
  i18n/                    # en.ts, es.ts, index.tsx (LanguageProvider)
  lib/                     # utils.ts (cn helper), tradeMatching.ts (buy/sell lot matching)
  config/affiliates.ts
supabase/
  config.toml              # project_id = yimbswiaqmuggmqygicf; edge-fn verify_jwt flags
  functions/<name>/index.ts# Deno edge functions
  migrations/*.sql         # timestamped migrations
public/                    # PWA icons, favicon, static assets
```

Providers in `App.tsx` (outer→inner): React Query → Auth → Language → Tooltip → Router.
Routes under `/` are wrapped in `ProtectedRoute` (redirects to `/auth` when no session) +
`AppLayout`. Public routes: `/auth`, `/landing`, `/install`, `/share/:id`, `/tools/*`.

## Supabase

- **Project ref:** `yimbswiaqmuggmqygicf` (org `ocdcofxixkaojfuyqgsz`, name "portfolio-tracker").
  Linked via the CLI (state in `supabase/.temp/`, which is gitignored).
- **Client:** `src/integrations/supabase/client.ts` (URL + publishable/anon key). Env in `.env`:
  `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SUPABASE_PROJECT_ID`.
- **Generated types:** `src/integrations/supabase/types.ts` — regenerate with
  `npx supabase gen types typescript --linked`. **Do not hand-edit.**
- **Edge functions (Deno):** `fetch-quote`, `search-symbol`, `stock-history`, `dca-history`,
  `check-dividends`, `analyze-trade-image`, `chess-chat` (all `verify_jwt = false`).
  Deploy with `npx supabase functions deploy <name>`.
- **Migrations:** `supabase/migrations/*.sql`.

### CLI-first workflow (Docker is NOT installed on this machine)

The CLI is installed as a devDependency and the project is linked. **Use the CLI for all Supabase
work — not the MCP.** Practical caveats here:

- `supabase start`, `supabase db …`, `supabase db dump` **require Docker Desktop**, which is
  **not installed** on this machine → those commands fail. Don't rely on them.
- **Schema introspection works without Docker:** `npx supabase gen types typescript --linked`.
- **Ad-hoc SQL (read/write) without Docker:** call the Supabase **Management API**
  `POST https://api.supabase.com/v1/projects/yimbswiaqmuggmqygicf/database/query` with the
  access token that `supabase login` stored (Windows: the `Supabase CLI:supabase` entry in
  Credential Manager). This executes as `postgres` (bypasses RLS) — the same mechanism the CLI
  uses internally. Prefer this over the Supabase MCP.
- Auth/link (one-time): `npx supabase login`, then
  `npx supabase link --project-ref yimbswiaqmuggmqygicf`.

### Database domain model (public schema)

- **`trades`** — buy / sell / dividend rows. `total_amount` is a **GENERATED** column
  (`quantity * price_per_unit`) — **never insert or update it**; set only `quantity` and
  `price_per_unit`. A **`validate_sell_quantity`** trigger rejects selling more shares than the
  ledger shows as held (so a sell of a position opened before your data window will be blocked).
  Trades carry `original_currency` (USD/ARS) and `mep_rate` for AR$↔US$ conversion.
- **`portfolio_positions`** — cached holdings (quantity, avg_cost, cost_basis). Maintained by the
  **`rebuild_position(_user_id, _portfolio_id, _symbol)`** function. **After programmatic bulk
  trade inserts/deletes, call `rebuild_position` for each affected symbol** or the cached
  positions go stale.
- **`portfolios`**, **`brokers`** / **`user_brokers`**, **`strategies`**, **`trade_tags`** /
  **`trade_tag_assignments`**, **`discipline_rules`**, **`achievements`**.
- Social: **`profiles`**, **`follow_requests`**, **`leaderboards`** / **`leaderboard_members`**,
  **`notifications`**, **`shared_exports`**.

## Deployment

Deployed on **Vercel** — `vercel.json` rewrites all routes to `/index.html` (SPA). PWA
auto-updates on deploy.

## Conventions & gotchas

- Import from `src` via the `@/…` alias.
- New UI: compose existing `src/components/ui` (shadcn) primitives and follow their patterns.
- Fetch/mutate Supabase data through the React Query hooks in `src/hooks` — reuse them instead of
  calling the client directly inside components.
- Route user-facing strings through i18n (`src/i18n/en.ts` / `es.ts`).
- Don't edit generated files: `src/integrations/supabase/types.ts`, `src/components/ui/*` (when
  regenerated).
- `trades.total_amount` is generated; `portfolio_positions` is a cache — keep both rules above in
  mind for any data work.
