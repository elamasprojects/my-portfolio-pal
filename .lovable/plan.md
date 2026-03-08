

# Chess-Themed UI Rebrand

Transform the app into a strategic, minimalist, chess-inspired experience. The metaphor: investing is chess — every trade is a move, every portfolio is a board, every strategy is an opening.

## Design Philosophy

Not literal chess pieces everywhere. Instead: the elegance of marble and wood, the precision of a chess clock, the tension of a quiet position. Black and white with gold accents. Clean geometry. Strategic language.

## Color Palette Overhaul (`src/index.css`)

### Dark Mode (Primary)
| Token | Value | Concept |
|-------|-------|---------|
| `--background` | Deep obsidian `220 15% 8%` | Dark mahogany board |
| `--card` | Smoky charcoal `220 12% 12%` | Dark square |
| `--popover` | Slate `220 12% 16%` | Elevated surface |
| `--foreground` | Ivory `40 20% 95%` | Light square / piece |
| `--primary` | Warm gold `42 80% 55%` | The king — accent for action |
| `--primary-foreground` | Near-black `220 15% 8%` | Contrast on gold |
| `--secondary` | Cool silver `220 8% 40%` | Supporting metal |
| `--muted` | Deep slate `220 10% 22%` | Quiet squares |
| `--muted-foreground` | Mist `220 8% 55%` | Subtle text |
| `--accent` | Amber glow `42 60% 15%` | Warm hover |
| `--accent-foreground` | Gold `42 80% 65%` | Accent text |
| `--border` | Hairline `220 10% 18%` | Grid lines |
| `--gain` | Emerald `152 55% 45%` | Winning position |
| `--loss` | Crimson `0 65% 55%` | Losing position |
| `--ring` | Gold `42 80% 55%` | Focus ring |

### Light Mode
| Token | Value | Concept |
|-------|-------|---------|
| `--background` | Warm ivory `40 25% 96%` | Light marble board |
| `--card` | Pure white `0 0% 100%` | Clean surface |
| `--foreground` | Near-black `220 15% 12%` | Dark piece |
| `--primary` | Deep gold `42 75% 45%` | Muted gold for light |
| `--muted` | Light warm gray `40 10% 90%` | Soft squares |

### Sidebar (both modes)
| Token | Value |
|-------|-------|
| `--sidebar-background` | `220 18% 7%` — nearly black |
| `--sidebar-foreground` | Ivory `40 15% 90%` |
| `--sidebar-primary` | Gold `42 80% 55%` |
| `--sidebar-accent` | `220 15% 14%` |
| `--sidebar-border` | `220 12% 15%` |

### Chart Colors
Replace pink/magenta with gold/silver/emerald/bronze/slate:
- `--chart-1`: Gold `42 80% 55%`
- `--chart-2`: Emerald `152 55% 45%`
- `--chart-3`: Silver `220 8% 60%`
- `--chart-4`: Bronze `30 60% 50%`
- `--chart-5`: Deep slate `220 10% 35%`

## Typography (`tailwind.config.ts` + `index.css`)

- **Primary font**: Keep `Poppins` but reduce weight usage — lean into 400/500 for body, 600 for emphasis only
- **Mono font**: Keep `JetBrains Mono` — perfect for the "chess notation" feel of trade data
- **Add**: Import `Cormorant Garamond` (or `Playfair Display`) for page titles only — a serif that evokes the classical chess aesthetic
- Reduce `--radius` from `1.5rem` to `0.5rem` — sharper corners, more geometric

## Branding Updates

### App Name & Logo
- Rename "Portfolio Tracker" to **"Chess"** throughout
- Replace `TrendingUp` icon with a custom chess knight SVG (inline, minimal, geometric)
- Tagline: *"Look first. Then leap."* → *"Think. Move. Win."* or *"Every move counts."*

### Sidebar (`AppSidebar.tsx`)
- Replace nav item labels with chess-strategic language:
  - Dashboard → **Board** (overview of the board state)
  - Add Trade → **New Move**
  - Trade Log → **Move History**
  - Performance → **Analysis**
  - Timeline → **Game Clock**
  - Report Card → **Score Sheet**
  - Achievements → **Titles** (like GM, IM in chess)
  - Discipline → **Opening Book** (your rules/system)
  - Export PDF → **Notation** (chess notation = recording moves)
  - Chess AI → **Chess** (keep as-is, it's the AI analyst)
  - Import CSV → **Import PGN** (PGN = chess game format)
- Subtle separator lines between nav groups
- Gold accent on active item instead of pink

### Portfolio Switcher (`PortfolioSwitcher.tsx`)
- Replace `TrendingUp` with knight icon
- Style the dropdown as a dark, elegant selector

## Component-Level Changes

### Cards (`card.tsx` + usage)
- Reduce border radius to `0.5rem`
- Add a very subtle `1px` border with `border-border`
- On hover: faint gold border glow (`hover:border-primary/30 transition-colors`)
- Remove shadows in dark mode, use border contrast instead

### Buttons (`button.tsx`)
- Primary: gold background, dark text, no rounded-full — use `rounded-md`
- Hover: slightly brighter gold
- Ghost: on hover, subtle warm tint
- Destructive: stays crimson

### Inputs (`input.tsx`)
- Sharper radius
- On focus: gold ring instead of pink
- Placeholder text in muted silver

### Auth Page (`Auth.tsx`)
- Replace `DottedSurface` animation: change dot colors from blue-tinted to warm ivory/gold tinted
- Or replace entirely with a subtle SVG chessboard pattern that fades at edges
- Login card: dark card on dark background, gold "Sign In" button
- Replace logo with knight + "Chess" branding

### Dashboard (`Index.tsx`)
- Page title: "Board" with a subtle knight icon
- Summary cards: clean, no colored icon backgrounds — just the number with a thin gold underline
- Chart tooltip styles: dark popover with gold accents
- Pie chart colors: gold/silver/emerald/bronze palette

### Add Trade (`AddTrade.tsx`)
- Step labels: "Opening" (type), "Position" (symbol), "Execute" (details)
- Buy/Sell/Dividend buttons: Buy = emerald border, Sell = crimson border, Dividend = gold border
- Confetti colors: gold, ivory, silver instead of blue/green/purple

### Chess AI Page (`Chess.tsx`)
- Keep the current layout but update:
  - Header icon: knight instead of Sparkles
  - User messages: gold background
  - AI messages: dark card background
  - Starter question chips: gold border, warm hover

## Animations & Micro-interactions

### New keyframes in `tailwind.config.ts`:
- `chess-slide`: a subtle horizontal slide (like sliding a piece) for page transitions
- `pulse-gold`: a gentle gold pulse for active/important elements
- Existing accordion/fade animations stay

### Hover effects:
- Cards: `transition-all duration-200 hover:translate-y-[-1px] hover:border-primary/30`
- Nav items: gold left-border indicator on active (2px solid gold bar)
- Table rows: warm background on hover `hover:bg-primary/5`
- Buttons: subtle scale `hover:scale-[1.02]` on primary buttons only

## Background Patterns

### DottedSurface update (`dotted-surface.tsx`)
- Change dot colors from blue `(0.3, 0.4, 0.7)` to warm gold `(0.7, 0.6, 0.3)`
- Reduce opacity to `0.3` for subtlety
- Change fog color from `0x131722` to `0x111318`
- This creates a warm, understated animated background for the auth page

### Main app background
- Add a very faint CSS chessboard pattern overlay to the main content area (8x8 grid, 2% opacity)
- Implemented as a CSS pseudo-element or background-image on the `<main>` tag in `AppLayout.tsx`

## Files to Modify

```text
MODIFIED:
  src/index.css                    — Full color palette rewrite (light + dark)
  tailwind.config.ts               — Radius, new keyframes, serif font
  src/components/AppSidebar.tsx     — Chess terminology, knight icon, gold accents
  src/components/PortfolioSwitcher.tsx — Knight icon, "Chess" branding
  src/components/AppLayout.tsx      — Subtle chessboard background pattern
  src/components/ui/card.tsx        — Hover effects
  src/components/ui/button.tsx      — Radius adjustments
  src/components/ui/input.tsx       — Gold focus ring
  src/components/ui/dotted-surface.tsx — Gold-tinted dots
  src/pages/Auth.tsx               — Rebrand to Chess, knight logo, tagline
  src/pages/Index.tsx              — "Board" title, gold chart palette
  src/pages/AddTrade.tsx           — Chess step labels, updated confetti
  src/pages/Chess.tsx              — Gold user messages, knight icon
  src/pages/Achievements.tsx       — "Titles" heading
  src/pages/Performance.tsx        — "Analysis" heading
  src/pages/Timeline.tsx           — "Game Clock" heading
  src/pages/ReportCard.tsx         — "Score Sheet" heading
  src/pages/Discipline.tsx         — "Opening Book" heading
  src/pages/ExportReport.tsx       — "Notation" heading
  src/pages/TradeLog.tsx           — "Move History" heading
  src/pages/ImportTrades.tsx       — "Import PGN" heading
```

No new dependencies. No database changes. Pure UI/theming work.

