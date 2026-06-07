# Chess — Mobile UX/UI Diagnosis & Feature‑Gap Report

**App:** Chess — Your Portfolio Strategy (PWA, `vite_react_shadcn_ts`)
**Scope:** Mobile experience (the surface you use most)
**Session:** Logged in as `ezequiellamas@gmail.com`, viewport **375 × 812** (iPhone‑class), **dark theme** + **Spanish** (your actual settings), against your **real portfolio** (≈ **$29,915** value, **+18.1%**, ~18 positions).
**Status:** Read‑only diagnosis. **No application code was changed.**

---

## 0. How this was done (method + one important caveat)

I logged into your account in a controlled preview, set a mobile viewport, and walked **11 screens** live while reading the source for each. Pages visited: Dashboard, Trade Log, Add Trade, Analysis, Progress, Players, Chess (AI), Asset Detail, Settings, Export, Strategy.

**⚠️ Screenshot caveat — please read.** You asked for screenshots. The preview browser in this sandbox runs the page as a **backgrounded tab**, so its compositor never paints a frame and `preview_screenshot` times out (I tried six different work‑arounds: freezing the WebGL background, disabling animations, spoofing page‑visibility, forcing focus, and shimming `requestAnimationFrame`). Raster screenshots simply aren't capturable in this environment.

Rather than block on that, I switched to tools that are actually **more precise than eyeballing screenshots** for a UI audit:
- **Accessibility snapshots** → exact rendered text, structure, and roles of every page.
- **Computed‑style + layout measurements** → real pixel sizes of touch targets, font sizes, horizontal‑overflow detection, and WCAG contrast ratios computed from the live DOM.
- **Source reading** → the exact responsive logic behind each screen.

Every claim below is backed by a measurement or a `file:line` reference. (If you want literal image screenshots, the reliable path is to run `npm run dev` locally and shoot them from a real browser/DevTools device mode — happy to script that.)

**Environment note:** to set up the preview I created `.claude/launch.json` (preview tooling config only) and stopped a **stray `npm run dev` already running on port 8080** (a leftover dev server from the main repo). Both are environment setup, not app changes.

---

## 1. Executive summary

The app is **surprisingly feature‑rich and, in places, genuinely excellent** — the Add‑Trade flow (AI screenshot OCR, batch import, $/shares toggle, journaling) is better than most commercial trackers. The core problem is **not features, it's mobile polish and a few information‑architecture choices**. Three issues repeat across the whole app and drag the mobile experience down: **data tables that don't adapt to phones**, **touch targets and fonts that are too small**, and a **bottom‑navigation design that hides your most frequent action**.

**Top 5 things to fix (mobile UX):**
1. **Tables overflow on mobile** — Trade Log renders a **1123 px‑wide** 12‑column table on a 375 px screen (also Strategy 1031 px, Asset Detail 641 px). No card fallback.
2. **The "+" button doesn't add a trade** — it opens a "More" menu; adding a trade (your most common action) is buried 2 taps deep, while **Export** sits in prime nav.
3. **The bulk‑action bar collides with the bottom nav** on Trade Log (both are fixed at the bottom, centered).
4. **Touch targets below the 44 px minimum** everywhere (currency toggle 24 px, filter tabs 28 px, table checkboxes 16 px).
5. **Pervasive tiny text** (10–11 px) and **loss‑red contrast of 3.81:1** (below WCAG AA 4.5:1) on the dark theme.

**Top 5 features it's missing (vs. industry standard + common sense):**
1. **Price / movement alerts** (you have a notifications system already — it's not used for this).
2. **Benchmark vs. an index** (S&P 500 / Merval) — "am I beating the market?" is the #1 question a tracker should answer.
3. **Watchlist** for tickers you don't own yet.
4. **Dividend calendar + projected income / yield‑on‑cost** (a `check-dividends` function already exists to power it).
5. **Cash, deposits & withdrawals → true time‑/money‑weighted returns** (cash shows `$0.00`; returns are currently position‑only).

---

## 2. What's already strong (don't break these)

A fair audit starts with what's working — there's a lot:

- **Add Trade is a standout.** [`src/pages/AddTrade.tsx`](src/pages/AddTrade.tsx): AI **screenshot OCR** of broker confirmations (`analyze-trade-image`), **multi‑image batch** with a review queue (up to 10, concurrency 3), **clipboard paste**, progressive disclosure (type → symbol search w/ autocomplete → details), **$‑amount vs. shares** input toggle, live quote auto‑fetch, MEP rate handling, broker commission math, a **6‑question trade‑journaling wizard** + TradingView chart upload, and a 3D flip + confetti confirmation. It's mobile‑aware (`max-w-lg`, large `h-14`/`h-20` buttons). This is your moat — invest in it.
- **Rich dashboard with real depth** — portfolio value, day P&L, **realized vs. unrealized** split, **win rate (realized & projected)**, cash, allocation pies (by type/asset/market/broker), positions, win‑rate progression. Positions correctly render as **cards** on mobile (no overflow).
- **Argentine‑market fluency** — MEP dollar conversion (`useDolarMEP`), ARS/USD per‑trade currency + `mep_rate`, broker commissions (flat or %). This is real differentiation for your niche.
- **Gamification & discipline** — achievements with confetti, configurable discipline rules + compliance scoring. Good retention mechanics.
- **Social layer** — followers, player compare, leaderboards with podium.
- **AI assistant** ("Chess") with portfolio‑aware starter prompts.
- **Planning tools** — risk‑profile questionnaire, compound & DCA calculators (public, pre‑login — smart for acquisition).
- **Bones of a good PWA** — installable, autoUpdate, portrait‑locked, i18n (EN/ES), dark mode, gain green contrast measured at a healthy **6.25:1**.

---

## 3. Mobile UX/UI diagnosis (issues, by severity)

### 🔴 A. Data tables don't adapt to mobile (systemic — highest impact)
The app uses shadcn `<Table>` everywhere; that component wraps content in an `overflow-auto` div, so on a phone the table **becomes a horizontal‑scroll strip** instead of reflowing.

| Screen | Rendered table width @ 375 px | Evidence |
|---|---|---|
| **Trade Log** | **1123 px** (12 columns) | [`src/pages/TradeLog.tsx:258`](src/pages/TradeLog.tsx) — no `useIsMobile` branch, no card view |
| **Strategy** | **1031 px** | [`src/pages/Strategy.tsx`](src/pages/Strategy.tsx) performance table |
| **Asset Detail** | **641 px** (trade history) | [`src/pages/AssetDetail.tsx`](src/pages/AssetDetail.tsx) |

On Trade Log the user must scroll right through Date · Symbol · Name · Type · Asset · Qty · Price · Total · Ccy · Strategy · Tags to see anything past "Name". This is the single biggest mobile readability problem.

**Recommendation:** add a mobile **card layout** (one card per trade: Symbol + type badge + date on the left, qty·price·total stacked on the right, tags below) gated on `useIsMobile()`, exactly like the dashboard's positions already do. Same for Strategy and Asset Detail. Reuse the existing `Card` primitives.

### 🔴 B. Bottom navigation hides the primary action
[`src/components/MobileNav.tsx`](src/components/MobileNav.tsx): the four primary tabs are **Dashboard · Analysis · Trade History · Portfolio (Export)** and the big **"+" FAB opens a 7‑item "More" sheet** ([`MobileNav.tsx:85`](src/components/MobileNav.tsx)). Consequences:
- **Adding a trade — the most frequent action in a trade logger — is 2 taps** (FAB → "Nueva Jugada"), and the "+" icon misleads (it reads as "add" but is "menu").
- **Export occupies prime real estate** (4th tab) although it's an occasional action, while Add, Progress, Players, Strategy, Chess are all buried in the sheet.

**Recommendation:** make the **FAB the Add‑Trade action** (tap = go to `/add`; this is the dominant mobile pattern). Put a small "More"/grid entry in the capsule instead of stealing the FAB. Reconsider the 4 primary tabs — e.g., **Dashboard · Trades · Analysis · Players/Progress**, with Export moved into More.

### 🟠 C. Floating bulk‑action bar collides with the bottom nav
On Trade Log, selecting rows shows a bar at `fixed bottom-6` with 5 inline controls ([`TradeLog.tsx:344`](src/pages/TradeLog.tsx)), while the nav capsule is at `fixed bottom-4` ([`MobileNav.tsx:50`](src/components/MobileNav.tsx)). Both are bottom‑anchored and centered, so on a 375 px screen they **overlap**, and the 5‑control row is likely to clip horizontally.

**Recommendation:** when selection mode is active on mobile, lift the bar above the nav (`bottom-24`) or replace it with a compact sheet; collapse the 5 actions into an overflow menu on narrow widths.

### 🟠 D. Touch targets below the 44 px minimum (systemic)
Apple HIG says ≥ 44 px; Material says ≥ 48 px. Measured offenders:

| Control | Size | Where |
|---|---|---|
| Currency toggle 🇺🇸/🇦🇷 | **24 px** tall | Dashboard, Settings |
| Allocation filter tabs (Por Tipo/Activo…) | **28 px** tall | Dashboard |
| Chart range chips (1M/3M/6M/1Y/ALL) | **28 px** (~31 px wide) | Asset Detail |
| Table row checkboxes / icons | **16 px** | Trade Log (×177 small targets) |
| Strategy chips, edit/delete icons | **26–32 px** | Strategy |
| Filter selects, send button | **40 px** | Trade Log, Chess |

**Recommendation:** bump interactive controls to a **44 px min hit area** (padding can stay visually small via an invisible tap area). Prioritize the dashboard currency toggle and the table checkboxes.

### 🟠 E. Typography is too small for mobile (systemic)
Sub‑12 px text is everywhere — measured per page: Dashboard **58** elements (incl. 2 at **9 px**), Settings **25**, Export **48**, Strategy **10**, Players incl. **9 px**. Nav labels are `text-[10px]` ([`MobileNav.tsx:78`](src/components/MobileNav.tsx)). 9–11 px in muted gray on a phone is a strain, especially for a finance app read at arm's length.

**Recommendation:** set a **mobile floor of 12–13 px** for body/labels and 11 px only for true micro‑captions. Audit the `text-[10px]`, `text-[11px]`, and `text-xs` usages on data‑dense screens.

### 🟡 F. Loss‑red contrast fails WCAG AA on dark theme
Measured on your live (dark) dashboard:
- **Gain green** `rgb(52,178,119)` → **6.25:1** ✅
- **Loss red** `rgb(215,66,66)` → **3.81:1** ❌ (AA needs 4.5:1 for normal text)
- Muted gray labels `rgb(131,137,149)` → 5.29:1 (OK for contrast, but rendered at 10–11 px).

Loss‑red marks your most important negative info (down days, losing positions) and often appears at small sizes. Source: [`src/index.css:37`](src/index.css) (`--loss: 0 65% 55%`).

**Recommendation:** darken/saturate loss‑red to clear 4.5:1 on both themes (e.g., raise lightness contrast or add a subtle weight/!bg behind small red numbers). Don't rely on color alone — keep the +/− signs you already use.

### 🟡 G. Safe‑area insets (notch / home indicator)
The floating nav sits at `bottom-4` with no `env(safe-area-inset-bottom)` handling. On notched iPhones the capsule can crowd the home indicator. **Recommendation:** add `padding-bottom: env(safe-area-inset-bottom)` to the nav and `viewport-fit=cover`.

### 🟡 H. i18n leak (English in the Spanish UI)
Strategy page header renders **"Retorno Total by Strategy"** — partial translation. Worth a pass over [`src/i18n/es.ts`](src/i18n/es.ts) for hard‑coded English (chart titles are common offenders).

### 🟢 I. Dashboard information density
The dashboard stacks value, day P&L, realized/unrealized, dual win‑rate, cash, 4 allocation pies, positions, and a win‑rate chart — strong, but heavy on a first mobile screen. **Recommendation:** consider collapsing secondary KPIs behind a "more metrics" expander, or a compact hero + swipeable KPI cards.

### Per‑page quick notes
- **Dashboard** ✅ positions render as cards (no overflow); only the small toggles/tabs/fonts apply.
- **Add Trade** ✅ best‑in‑class; just enlarge the Manual/CSV tab (32 px).
- **Analysis** ✅ tabs (Análisis/Reloj/Boleta) + period toggle + charts fit well.
- **Progress / Chess / Players** ✅ clean and fit; minor small‑font/target items only.
- **Settings** dense (24 small controls) but functional.
- **Export** the export‑card preview is text‑dense by design (it's meant to be rendered to an image).

---

## 4. Feature‑gap analysis & proposals

Benchmarked against what retail investors expect from portfolio trackers (Sharesight, Snowball, Delta, Stock Events, Empower) and Argentine apps (Cocos, IOL, Balanz), plus plain common sense for portfolio strategy. Grouped by priority and mapped to **infrastructure you already have**.

### Tier 1 — Table stakes a tracker should have
1. **Price & movement alerts.** "Notify me if NU hits $14 / moves ±5% / a position drops 10%." You already have a **notifications system** (`useNotifications`, Inbox) and a quote function (`fetch-quote`) — this is mostly wiring + a scheduled check.
2. **Benchmark vs. an index.** Overlay your return vs **S&P 500 / Nasdaq / Merval** on the performance chart and show alpha. This is the question your whole app implies but doesn't answer. (`stock-history`/`dca-history` functions can fetch index series.)
3. **Watchlist.** Track symbols you're considering (with the same quote/news plumbing) before they become trades. Natural feeder into Add Trade.
4. **Dividend calendar + projected income.** You record dividends and have a **`check-dividends`** edge function — surface **upcoming ex‑/pay dates, projected annual income, and yield‑on‑cost**. High value for long‑term investors.
5. **Cash, deposits & withdrawals → real returns.** Cash shows `$0.00`; without modeling deposits, the headline "% return" can't be a true **time‑weighted or money‑weighted (IRR)** figure. Add a cash ledger and compute TWR/IRR — this materially changes how trustworthy the performance numbers are.

### Tier 2 — Strong differentiators / common‑sense for "portfolio strategy"
6. **Allocation targets & rebalancing.** Let users set a target mix (e.g., 60% stocks / 20% ETF / 20% crypto, or per‑position caps) and show **drift + rebalance suggestions**. This fits the "strategy" brand directly and complements the risk‑profile tool you already have.
7. **Portfolio risk analytics.** Concentration warnings ("NU is 25% of your book"), **beta, volatility, max drawdown**, sector/geo exposure. You have a risk *questionnaire* but not live portfolio *risk*. (You already compute allocation — concentration is a quick win.)
8. **Tax / realized‑gains report.** A per‑tax‑year realized‑gains export (short vs. long term; Argentine *Bienes Personales* / *Ganancias* framing) on top of your existing realized‑P&L engine and CSV export.
9. **Richer Asset Detail.** Today it's price chart + trade history. Add **fundamentals** (P/E, market cap, 52‑wk range, analyst target), **news headlines**, and the **next earnings date** for the ticker — turns it into a real research view.
10. **Sector & geography breakdown.** You already slice by type/asset/market/broker; add **sector** and **country** pies (the data is one classification away and is standard in every tracker).

### Tier 3 — High‑leverage, mostly reuse existing infra
11. **Recurring‑buy / DCA reminders.** You have a DCA *simulator*; add an actual **"remind me to buy $X of Y monthly"** using the notifications system — closes the loop from planning to action.
12. **Goals & net‑worth over time.** A net‑worth/contributions chart and a savings‑goal progress bar (pairs with gamification).
13. **Broker‑specific import templates.** Your CSV + screenshot OCR is great; add labeled templates for **IOL, Cocos, Balanz, IBKR** to reduce import friction.
14. **Position thesis & review reminders.** Extend the buy‑journal into an ongoing **"why I own this" + scheduled review** (e.g., quarterly) — strong for a discipline‑oriented app.
15. **Onboarding & empty states.** First‑run guidance and friendly empty states (the app assumes you already have data) to convert the public tools/landing traffic into active users.

### Quick reference — gap × existing infra
| Proposed feature | Reuses |
|---|---|
| Price alerts | `useNotifications`, `fetch-quote`, Inbox |
| Dividend calendar/income | `check-dividends`, `trades` (dividend type) |
| Benchmark vs index | `stock-history` / `dca-history` |
| Concentration/risk | existing allocation computations |
| Tax report | realized‑P&L engine + CSV export |
| Recurring‑buy reminders | DCA simulator + notifications |

---

## 5. Prioritized roadmap

**Quick wins (low effort, high impact — mostly CSS/layout):**
- Mobile **card layout** for Trade Log (and Strategy / Asset Detail tables).
- Make the **FAB = Add Trade**; move Export out of the primary 4.
- Fix the **bulk‑bar / nav collision** (raise to `bottom-24` on mobile).
- Enforce **≥44 px touch targets** and a **12 px font floor**; add **safe‑area** padding.
- Bump **loss‑red contrast** to AA; sweep the i18n leak.

**Medium bets (clear value, moderate build):**
- **Price alerts**, **watchlist**, **benchmark vs index**, **dividend calendar/income**, **concentration warnings**.

**Bigger bets (architecturally meaningful):**
- **Cash/deposits ledger + true TWR/IRR returns**, **allocation targets & rebalancing**, **tax reporting**, **richer Asset Detail (fundamentals/news/earnings)**.

---

## 6. Appendix — per‑page measured data (mobile 375 × 812, dark, real account)

| Page | Horizontal table overflow | Sub‑44px tap targets (samples) | Sub‑12px text count | Notes |
|---|---|---|---|---|
| `/` Dashboard | none | 7 — currency 24px, alloc tabs 28px, expand 32px | 58 (incl. 9px×2) | positions = cards ✅ |
| `/trades` Trade Log | **table 1123px** | 177 — checkboxes 16px, filters 40px | 5 | no mobile layout 🔴 |
| `/add` Add Trade | none | 4 — tabs 32px, submit 40px | 5 | best‑in‑class ✅ |
| `/analysis` | none | 5 — tabs 32px, period 36px | 5 | charts fit ✅ |
| `/progress` | none | 2 — tabs 32px | 5 | ✅ |
| `/players` | none | 7 — tabs 32px, avatars 40px | 7 (incl. 9px) | rich ✅ |
| `/chess` AI | none | 7 — prompt chips 34px, input 40px | 5 | ✅ |
| `/asset/NU` | **table 641px** | 6 — range chips 28px | 5 | wide trade table 🟠 |
| `/settings` | none | 24 — toggles 24px, chips 28px | 25 | dense |
| `/export` | none | 3 — buttons 36px | 48 | export‑card preview |
| `/strategy` | **table 1031px** | 7 — chips 26px, create 36px | 10 | wide table + i18n leak 🟠 |

---

*Prepared from a live, authenticated mobile walkthrough + source review. No application files were modified; the only files created were this report and the preview's `.claude/launch.json`.*
