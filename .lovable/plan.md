

## TradingView-Inspired Theme Overhaul

### What changes

The current theme uses a generic dark finance palette (deep blue-slate with emerald green). The TradingView identity is distinctly different: a near-black charcoal background, TradingView's signature blue (`#2962FF`) as the primary accent, and their exact gain/loss colors (green `#26A69A`, red `#EF5350`). Borders are sharper, corners tighter, and the overall feel is more "terminal" than "dashboard."

### Color palette update (index.css)

Map TradingView's dark mode directly to CSS variables:

- **Background**: `#131722` (TV's chart background) → `228 29% 10%`
- **Card/Surface**: `#1E222D` → `225 24% 14%`
- **Popover**: `#2A2E39` → `226 16% 19%`
- **Primary (TV Blue)**: `#2962FF` → `227 100% 58%`
- **Foreground**: `#D1D4DC` → `227 14% 84%`
- **Muted foreground**: `#787B86` → `234 5% 50%`
- **Border**: `#2A2E39` → `226 16% 19%`
- **Gain**: `#26A69A` (TV teal-green) → `174 62% 40%`
- **Loss**: `#EF5350` (TV red) → `1 84% 63%`
- **Ring**: TV Blue
- **Radius**: `0.25rem` (TV uses very tight corners, almost square)
- **Chart colors**: TV blue, teal, orange `#FF9800`, purple `#AB47BC`, yellow `#FFEB3B`

### Typography update

- **Body font**: `Trebuchet MS` as per TV's brand guidelines, with system fallbacks
- **Mono font**: Keep `JetBrains Mono` for numbers (TV uses monospace for data)

### Tailwind config

- Update `fontFamily.sans` to `["Trebuchet MS", "Lucida Grande", "Lucida Sans Unicode", "sans-serif"]`
- Gain/loss color tokens already exist, just updating values

### Component/page tweaks

- **Buttons**: TV blue primary, sharper corners
- **Cards**: Tighter borders, less rounding, `#1E222D` surface
- **Sidebar**: Near-black `#131722` background, TV blue active state
- **Auth page**: TV blue CTA button, tagline "Look first. Then leap." as subtle subtext
- **Chart tooltip**: Match TV's dark popover style
- **Trade type badges**: TV green/red with their exact hex values

### Files to modify

1. `src/index.css` — full CSS variable overhaul + font import change
2. `tailwind.config.ts` — font family update
3. `src/pages/Index.tsx` — chart colors array update, tooltip styles
4. `src/pages/Auth.tsx` — tagline text update
5. `src/components/AppSidebar.tsx` — no structural changes needed (picks up theme vars)
6. All other pages inherit the new theme automatically through CSS variables

### What stays the same

All component structure, routing, database logic, and layout remain untouched. This is purely a visual rebrand through design tokens and a few hardcoded color references.

