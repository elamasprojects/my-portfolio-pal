

# Plan: Fix DCA, Remove BingX CTA, Enhance UI

## 3 Changes

### 1. Remove BingX affiliate button from Risk Profile result
- **File**: `src/pages/RiskProfile.tsx` (lines 217-221)
- Remove the `<AffiliateButton>` component from the results CTA section
- Keep the secondary "Registrate en Chess" button and the restart button

### 2. Fix DCA Simulator — deploy the edge function
- The `dca-history` edge function code exists but the logs show only boot/shutdown cycles with no actual request processing, suggesting the function may not be deployed or is erroring silently
- **Action**: Deploy the `dca-history` edge function using `supabase--deploy_edge_functions`
- Verify the function works by checking logs after deployment

### 3. Enhance UI for both pages

**Risk Profile result (`RiskProfile.tsx`)**:
- Add allocation breakdown as a styled list with colored dots next to the pie chart (legend)
- Add a gradient background or highlight to the profile type card header
- Add an emoji/icon per profile type (shield for conservative, scale for moderate, rocket for aggressive, flame for very aggressive)
- Better spacing and visual hierarchy for the result section

**DCA Simulator (`DCASimulator.tsx`)**:
- Add a Bitcoin icon and better header styling
- Add a descriptive intro card explaining what DCA is
- Improve the input card with better labels, icons, and a "Simulate" visual indicator
- Style the summary cards with colored top borders or gradients matching gain/loss
- Add a legend to the chart area
- Better responsive layout for mobile (stack inputs vertically on small screens)
- Remove or disable the BingX affiliate CTA at the bottom (same as risk profile)

## Files Modified
| File | Changes |
|---|---|
| `src/pages/RiskProfile.tsx` | Remove AffiliateButton, enhance result UI with allocation legend, profile icons, better card styling |
| `src/pages/DCASimulator.tsx` | Enhance layout, add intro card, improve summary cards, better mobile responsiveness, remove affiliate CTA |
| Edge function deployment | Deploy `dca-history` |

