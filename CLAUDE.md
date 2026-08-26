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

### 1. Supabase — pick the right access path, and the right connector

> ⚠️ **Two Supabase MCP connectors are configured, and their tools have identical names.**
> They are told apart only by an opaque UUID prefix. Using the wrong one runs migrations and
> SQL against a different project. Check the prefix before every write.

| Connector | Server ID prefix | Points to | Use for this repo? |
| --- | --- | --- | --- |
| **`portfolio-tracker`** (custom) | `mcp__1a6d8274-8474-4091-982c-e9158ce59bc6__…` | `yimbswiaqmuggmqygicf.supabase.co` — org `ocdcofxixkaojfuyqgsz` | ✅ **Yes — this one** |
| Official Supabase connector | `mcp__e44037be-429b-4d5f-97d9-b5341ff88822__…` | org `zchsagewrrmiofnjgmyk` (`elamasprojects`) — a different project | ❌ Never |

To confirm you have the right one before writing, call its `get_project_url`; it must return
`https://yimbswiaqmuggmqygicf.supabase.co`.

**Which path to use where:**

- **Local (this machine):** prefer the **CLI** (`npx supabase …`). See [Supabase](#supabase) for
  the working method — Docker is not installed here, so use the access-token + Management API
  path for ad-hoc SQL.
- **Claude Code on the web / cloud sessions:** use the **`portfolio-tracker` connector**. The CLI
  path there would require putting a `SUPABASE_ACCESS_TOKEN` into cloud environment variables,
  which have no secrets store and are readable by anyone using the environment — and a Supabase
  personal access token is account-wide, so it would also expose the other organization. The
  connector avoids both problems, and its traffic does not need any allowlisted domain.

**What the connector cannot do:** it exposes no secrets tooling. It can read edge-function
*source* (so you see names like `LOVABLE_API_KEY`) but never their values, and edge-function
secrets live in the platform env, not Postgres, so `execute_sql` cannot reach them either. To
**set or rotate** a secret, use the dashboard or `npx supabase secrets set` from a local shell.

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
  `check-dividends`, `analyze-trade-image`, `chess-chat`, `extract-finance-input`,
  `mercury-personal-import` (all `verify_jwt = false`).
  Deploy with `npx supabase functions deploy <name>`.
- **Migrations:** `supabase/migrations/*.sql`.

### CLI-first workflow (Docker is NOT installed on this machine)

The CLI is installed as a devDependency and the project is linked. **On this machine, use the CLI
for Supabase work** (in cloud sessions use the `portfolio-tracker` connector instead — see
[rule 1](#1-supabase--pick-the-right-access-path-and-the-right-connector)). Practical caveats here:

- `supabase start`, `supabase db …`, `supabase db dump` **require Docker Desktop**, which is
  **not installed** on this machine → those commands fail. Don't rely on them.
- **Schema introspection works without Docker:** `npx supabase gen types typescript --linked`.
- **Ad-hoc SQL (read/write) without Docker:** call the Supabase **Management API**
  `POST https://api.supabase.com/v1/projects/yimbswiaqmuggmqygicf/database/query` with the
  access token that `supabase login` stored (Windows: the `Supabase CLI:supabase` entry in
  Credential Manager). This executes as `postgres` (bypasses RLS) — the same mechanism the CLI
  uses internally.
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

## Importacion de gastos desde Mercury

`mercury-personal-import` trae los gastos de **una tarjeta especifica** de Mercury a
`transactions`. Corre solo, todos los dias a las 12:00 UTC (09:00 BA) via `pg_cron`, y a
demanda desde el boton "Mercury" del dashboard de finanzas.

**La extraccion esta acotada a la tarjeta, no a la cuenta.** Que tarjeta se importa lo decide
`mercury_card_links`; sin una fila activa ahi no se trae nada. El recorte se hace con el
parametro `cardId` de `GET /api/v1/transactions` (es un filtro real del endpoint, repetible),
y ademas se vuelve a chequear `tx.cardId` sobre la respuesta — si Mercury alguna vez ignorara
el parametro, sin ese segundo chequeo entrarian los gastos de la empresa en tus finanzas
personales.

Reglas que no conviene tocar sin entender por que estan:

- **Solo se importa `status = "sent"`.** `pending` es una autorizacion que el comercio puede no
  capturar; `failed` / `cancelled` / `reversed` son cobros que nunca pasaron. Cada corrida
  reconcilia: lo que se habia importado y ya no esta en `sent` se borra en blando.
- **El signo define el tipo.** Mercury firma en negativo la plata que sale: negativo → `expense`,
  positivo → `income` (un reembolso). Tomar el valor absoluto de todo cobraria los reembolsos
  como gastos.
- **La deduplicacion es un indice unico**, `(user_id, external_source, external_id)` sobre
  `transactions`. Importa porque hay triggers de saldo por fila: un duplicado no ensucia solo
  la lista, descuadra `current_balance`.
- **Lo que no se pudo categorizar entra con `needs_review = true`** y aparece en `/finance/review`.
  El match por keywords exige palabra completa (para que "bar" no matchee "BARBERSHOP"), y lo que
  se le escapa lo levanta el `mercuryCategory` que ya trae Mercury.
- **Tambien se marca lo que se parece a una carga manual tuya.** El indice unico solo frena que
  Mercury entre dos veces; una fila que tipeaste a mano no tiene `external_id` y es invisible para
  esa regla. Antes de insertar se busca una fila manual con el mismo monto al centavo y fecha a
  menos de 4 dias (`MANUAL_DUP_WINDOW_DAYS`), y si aparece se importa igual pero con
  `needs_review` y una nota que dice de cual sospecha. Se importa y se avisa, no se descarta: un
  gasto igual dos veces en la misma semana es perfectamente real.
  **A proposito NO se acota por medio de pago ni por cuenta** — en los datos reales el instrumento
  esta mal puesto (gastos de la tarjeta de Mercury anotados como "Banco Ciudad - ARS"), asi que
  filtrar por ahi no encontraria justo los duplicados que importan.

**Editar un movimiento:** `EditTransactionDialog` (lapiz en `/finance/timeline` y boton "Editar"
en `/finance/review`). El monto es editable a proposito: si pagaste 200 por varias personas y te
devolvieron 190, tu gasto real es 10. Para las filas importadas el dialogo muestra
`extracted_fields.mercury_amount` — lo que el banco cobro de verdad — como referencia de solo
lectura, asi corregir el tuyo no pierde ese dato. Editar pone `needs_review = false` y
`confidence = "high"`: tocarlo a mano ES la decision. Los triggers de saldo corrigen solos el
`current_balance` en el UPDATE.

**Secreto requerido:** `MERCURY_API_TOKEN` (token *Read Only* de Mercury) en los secrets de este
proyecto. El connector MCP no expone secrets: se setea desde el dashboard o con
`npx supabase secrets set MERCURY_API_TOKEN=... --project-ref yimbswiaqmuggmqygicf`. Sin eso la
funcion devuelve 500 con ese mensaje exacto.

## Deployment

Deployed on **Vercel** — `vercel.json` rewrites all routes to `/index.html` (SPA). PWA
auto-updates on deploy.

## Prototyping — the `/demo` Design Lab

**`/demo`** is the isolated, auth-gated **prototyping route** for trying new UI/features against
**real account data** before promoting them to production. It's fully self-contained under
`src/pages/demo/` (only `src/App.tsx` references it — one import + one route) and renders a
redesigned, mobile-first app with a **device switcher: Desktop / Phone / Watch** (toggle via the
bottom-center control dock on desktop, or the phone top-bar controls). Build and review new
features here in all three form factors, then promote the polished bits to the real pages.

- Keep `/demo` working — **don't delete or hide it**; it's our ongoing feature sandbox.
- It reuses the real data hooks + pure compute fns (so numbers match production); shared bits live
  in `src/lib/` (e.g. `dailyBreakdown.ts`) and `src/components/` (e.g. `WatchFace.tsx`).
- There's also a standalone **`/watch`** route — a Wear OS-style round watch view on live data
  (day P&L total + per-stock change), sharing `WatchFace` with the demo.

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
