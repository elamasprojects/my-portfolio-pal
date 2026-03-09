

# Add CSV Import Section to Landing Page

Add a new section between "How It Works" and "More Features" that highlights the CSV import capability with a friendly tone.

## Changes

### 1. `src/i18n/es.ts` and `src/i18n/en.ts`
Add new translation keys:
- `landing.csv.title` — "¿Ya tenés todo en Excel? No pasa nada" / "Already have everything in Excel? No worries"
- `landing.csv.desc` — Description of the CSV import feature (column mapping, preview, batch insert)
- `landing.csv.cta` — Button label to navigate to import

### 2. `src/pages/Landing.tsx`
Insert a new section after the "How It Works" block:
- Centered layout with the `FileSpreadsheet` icon prominently displayed
- Title + descriptive paragraph
- Three small bullet points highlighting: auto column mapping, preview before import, batch processing
- A subtle CTA button pointing to `/auth` (sign up to use it)
- Uses the same `motion` fade-in animations as the rest of the page
- Background uses a slight gradient or `bg-muted/30` alternation to visually separate it

