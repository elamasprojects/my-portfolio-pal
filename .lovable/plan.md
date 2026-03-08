

# i18n + Profile Dropdown Menu

## Architecture

Simple React Context-based i18n — no external library needed. Translation keys organized by page/component.

```text
src/
  i18n/
    index.tsx        — LanguageProvider, useLanguage hook, t() function
    en.ts            — English translations (~200 keys)
    es.ts            — Spanish translations
```

## Translation Structure

Keys organized by section:
- `common.*` — shared (Loading, Cancel, Create, Delete, Save, etc.)
- `nav.*` — sidebar labels (Board, New Move, Move History, etc.)
- `auth.*` — login/signup page
- `board.*` — dashboard/Index page (Cost Basis, Realized P&L, Win Rate, Holdings, etc.)
- `addTrade.*` — New Move page (Opening, Position, Execute, Buy, Sell, Dividend, etc.)
- `tradeLog.*` — Move History page (filters, table headers, bulk actions)
- `performance.*` — Analysis page
- `timeline.*` — Game Clock page
- `report.*` — Score Sheet page
- `achievements.*` — Titles page
- `discipline.*` — Opening Book page
- `export.*` — Notation page
- `import.*` — Import PGN page
- `chess.*` — Chess AI page (starter questions, header)
- `portfolio.*` — Portfolio switcher dialogs
- `profile.*` — Profile dropdown labels

## Profile Dropdown

Install `motion` (framer-motion successor). Copy the provided `basic-dropdown` component to `src/components/ui/basic-dropdown.tsx`.

Replace the current sidebar footer (theme toggle + sign out buttons) with a single profile avatar/button that opens the dropdown containing:
1. User email (display only)
2. Language switcher (EN / ES toggle)
3. Theme toggle (Light / Dark)
4. Separator
5. Sign Out

The dropdown renders above the trigger (placement="top") since it's at the bottom of the sidebar.

## Files

```text
NEW:
  src/i18n/index.tsx          — LanguageProvider context, useLanguage hook, t() helper
  src/i18n/en.ts              — English translation object
  src/i18n/es.ts              — Spanish translation object
  src/components/ui/basic-dropdown.tsx — Animated dropdown component

MODIFIED:
  src/App.tsx                      — Wrap with LanguageProvider
  src/components/AppSidebar.tsx    — Use t() for nav labels, replace footer with profile dropdown
  src/components/PortfolioSwitcher.tsx — t() for dialog labels
  src/pages/Auth.tsx               — t() for all strings
  src/pages/Index.tsx              — t() for all labels/headers
  src/pages/AddTrade.tsx           — t() for step labels, buttons, toasts
  src/pages/TradeLog.tsx           — t() for filters, headers, bulk actions
  src/pages/Performance.tsx        — t() for heading/labels
  src/pages/Timeline.tsx           — t() for heading/labels
  src/pages/ReportCard.tsx         — t() for heading/labels
  src/pages/Achievements.tsx       — t() for heading/labels
  src/pages/Discipline.tsx         — t() for heading/labels
  src/pages/ExportReport.tsx       — t() for heading/labels
  src/pages/ImportTrades.tsx       — t() for heading/labels
  src/pages/Chess.tsx              — t() for heading, starter questions
  src/pages/AssetDetail.tsx        — t() for labels
  src/components/EditTradeDialog.tsx — t() for dialog labels

DEPENDENCY:
  motion                           — Required by basic-dropdown component
```

~20 files modified, 4 new files. Language persisted to localStorage. No backend changes.

