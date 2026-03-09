

# Landing Page for Chess

## Overview

Create a public marketing landing page at `/landing` that showcases the app's features with the existing Chess branding: gold/amber accents, Cormorant Garamond serif headings, JetBrains Mono for data, and the 3D dotted wave animation.

## New File: `src/pages/Landing.tsx`

### Structure

```text
┌─────────────────────────────────────────────────┐
│  HERO                                           │
│  - 3D DottedSurface background                  │
│  - ChessKnight logo + "Chess" wordmark          │
│  - Tagline: "Every move counts."                │
│  - Subheadline: Your portfolio, played smart.   │
│  - CTA buttons: Get Started / Sign In           │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  FEATURES GRID (3x2)                            │
│  Each card: icon + title + short description    │
│  - Portfolio Dashboard                          │
│  - Trade Entry (Manual + OCR)                   │
│  - Analysis & Reports                           │
│  - Strategy Management                          │
│  - AI Assistant                                 │
│  - Multi-currency (ARS/USD)                     │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  HOW IT WORKS (3 steps)                         │
│  1. Log your trades                             │
│  2. Analyze performance                         │
│  3. Improve your strategy                       │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  FEATURE HIGHLIGHTS                             │
│  - Alternating image/text sections              │
│  - Dashboard screenshot + description           │
│  - OCR trade capture                            │
│  - Strategy performance                         │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  TESTIMONIALS / SOCIAL PROOF                    │
│  - Player avatars + quote                       │
│  - "Join traders tracking their moves"          │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  FINAL CTA                                      │
│  - "Start playing smarter today"                │
│  - Sign Up button                               │
└─────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────┐
│  FOOTER                                         │
│  - Logo + copyright                             │
│  - Links: Privacy, Terms, Install PWA           │
└─────────────────────────────────────────────────┘
```

### Features to Highlight

| Feature | Icon | Description |
|---------|------|-------------|
| Portfolio Dashboard | LayoutDashboard | Real-time market values, P&L tracking, allocation charts |
| Smart Trade Entry | Camera | Manual entry or upload screenshots — AI extracts the details |
| Performance Analysis | BarChart3 | Monthly/quarterly P&L, win rates, strategy comparison |
| Strategy Management | Crosshair | Define methodologies, track which strategies perform best |
| Chess AI | Sparkles | Ask questions about your portfolio, get personalized insights |
| Multi-Currency | Globe | Toggle between USD and ARS with live Dólar MEP rates |

### Additional Features (secondary grid)
- Multi-Portfolio support
- CSV Import
- Achievements & Titles
- Social features (Players)
- Discipline rules
- Shareable reports

## Routing Change: `src/App.tsx`

Add `/landing` as a public route (no auth required):
```tsx
<Route path="/landing" element={<Landing />} />
```

Optionally redirect `/auth` signed-out users to `/landing` instead, or add a "Learn More" link.

## i18n Updates

Add translation keys for landing page content in `en.ts` and `es.ts`:
- `landing.hero.title`, `landing.hero.subtitle`, `landing.hero.cta`
- `landing.features.*` (6 main features)
- `landing.howItWorks.step1/2/3`
- `landing.cta.final`

## Styling Notes

- Uses existing theme colors (gold primary, gain/loss colors)
- DottedSurface component for hero background
- ChessKnight SVG for logo
- Responsive: mobile-first with lg breakpoints for side-by-side layouts
- Cards use existing `Card` component with hover effects

