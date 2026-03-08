

# Make Pie Chart Bigger in Export Report

## Change

In `src/pages/ExportReport.tsx`, restructure the "Allocation + Holdings" section to make the pie chart the dominant element:

- **Pie chart container**: Change from `flex-shrink-0 w-40` to `flex-1` so it fills available space
- **ResponsiveContainer**: Change from fixed `height={140}` to `height="100%"` to fill the full remaining card height
- **Pie outerRadius**: Change from `60` to `"80%"` (responsive to container size)
- **Add labels**: Show `symbol + %` directly on pie slices with proper contrast (`fill` set based on `previewDark`)
- **Holdings badges**: Move to a narrower `w-44 flex-shrink-0` column on the right side instead of taking `flex-1`

This swaps the layout so the pie chart takes most of the space and holdings badges sit in a compact sidebar.

### File changed

| File | Change |
|------|--------|
| `src/pages/ExportReport.tsx` | Resize pie chart container, add labels, swap flex layout |

