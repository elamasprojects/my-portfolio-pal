

# Portfolio Tracker MVP — Full Specification

## Vision

A trade tracking app for retail investors that solves one core pain: **logging trades with minimal friction** and getting **actionable metrics** on performance. Dark finance theme, web app, mixed asset support (stocks, ETFs, crypto).

---

## Core Principles

1. **Minimal friction to log trades** — 2 taps to add a position. Future: voice/AI input.
2. **Metrics that help you improve** — P&L, win rate, category breakdowns, performance over time.
3. **Beautiful dark finance UI** — professional, sleek, trust-building.

---

## Tech Stack

- **Frontend**: React + Vite + Tailwind + shadcn/ui (dark theme)
- **Backend**: Supabase (auth, database, edge functions)
- **Charts**: Recharts
- **Live Prices**: Edge function calling free APIs (Yahoo Finance / CoinGecko)

---

## Database Schema

```text
profiles
├── id (uuid, PK, references auth.users)
├── display_name (text)
├── avatar_url (text)
└── created_at (timestamptz)

portfolios
├── id (uuid, PK)
├── user_id (uuid, FK → profiles.id)
├── name (text, default "My Portfolio")
├── description (text, nullable)
└── created_at (timestamptz)

trades
├── id (uuid, PK)
├── portfolio_id (uuid, FK → portfolios.id)
├── user_id (uuid, FK → profiles.id)
├── symbol (text)                    -- e.g. "AAPL", "BTC"
├── asset_name (text)                -- e.g. "Apple Inc.", "Bitcoin"
├── asset_type (enum: stock, etf, crypto, bond, other)
├── trade_type (enum: buy, sell)
├── quantity (numeric)
├── price_per_unit (numeric)         -- purchase/sell price
├── total_amount (numeric)           -- quantity × price
├── trade_date (timestamptz)
├── notes (text, nullable)
└── created_at (timestamptz)

holdings (materialized view or computed)
  → Aggregated from trades: net quantity, avg cost basis per symbol per portfolio
```

RLS: All tables scoped to `auth.uid() = user_id`. Profiles auto-created via trigger on auth signup.

---

## Pages & Routes

| Route | Page | Description |
|-------|------|-------------|
| `/auth` | Auth | Login / Signup (email) |
| `/` | Dashboard | Portfolio overview, charts, summary metrics |
| `/trades` | Trade Log | Full list of all trades, filterable |
| `/add` | Quick Add | Minimal form: symbol, qty, price, buy/sell |
| `/asset/:symbol` | Asset Detail | Per-asset view with P&L and trade history |

---

## Feature Breakdown

### 1. Authentication
- Email/password signup and login
- Auto-create profile + default portfolio on first login
- Protected routes (redirect to `/auth` if not logged in)

### 2. Quick Trade Entry (the core differentiator)
- Streamlined form: **Symbol search → Quantity → Price → Buy/Sell → Done**
- Auto-fill current price from live API
- Date defaults to now
- Success toast, stays on page for rapid entry
- Future: AI voice input (post-MVP)

### 3. Dashboard
- **Total portfolio value** (large, top)
- **Overall P&L** ($ and %, green/red)
- **Allocation pie chart** by asset type (stocks vs crypto vs ETF)
- **Performance line chart** (portfolio value over time, toggleable: 1W/1M/3M/1Y)
- **Top holdings table** — symbol, qty, avg cost, current price, P&L, weight %
- **Recent trades** — last 5 trades quick view

### 4. Trade Log
- Full table of all trades
- Filters: asset type, buy/sell, date range
- Sort by date, amount, P&L
- Edit / delete trades

### 5. Asset Detail Page
- Click any holding → see all trades for that symbol
- Price chart (if available)
- Avg cost basis, total invested, current value, P&L
- Trade history for that specific asset

### 6. Live Prices (Edge Function)
- `GET /functions/v1/fetch-prices?symbols=AAPL,BTC,MSFT`
- Calls Yahoo Finance API for stocks/ETFs, CoinGecko for crypto
- Returns current prices, cached for 5 minutes
- Used on dashboard load and asset detail pages

---

## UI / Design

- **Dark background**: slate-900/950 base
- **Accent colors**: emerald-500 for gains, red-500 for losses
- **Cards**: dark bordered cards with subtle gradients
- **Typography**: clean, monospace for numbers/prices
- **Layout**: sidebar nav on desktop, bottom nav on mobile

---

## MVP Scope — What's IN vs OUT

| IN (MVP) | OUT (Post-MVP) |
|----------|----------------|
| Email auth | Social login, OAuth |
| Manual trade entry | AI/voice trade entry |
| Live prices (stocks + crypto) | Bonds, real estate prices |
| Dashboard with charts | Advanced analytics |
| Single portfolio | Multiple portfolios |
| Basic P&L metrics | Win rate, Sharpe ratio, etc. |
| Web app | Mobile app |
| — | Affiliate buy/sell buttons |
| — | Courses / memberships |
| — | Mentorship features |
| — | WhatsApp integration |
| — | AI analysis (earnings reports, frameworks) |

---

## Implementation Order

1. **Database setup** — tables, RLS, triggers
2. **Auth pages** — login/signup with dark theme
3. **App layout** — sidebar, dark theme, protected routes
4. **Quick Add Trade** — the core flow
5. **Dashboard** — summary cards, charts, holdings table
6. **Trade Log** — full trade history with filters
7. **Live Prices Edge Function** — fetch and display current prices
8. **Asset Detail** — per-symbol breakdown

Estimated: 7-8 implementation steps to reach a functional MVP.

