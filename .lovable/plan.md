

# Pie Chart + Period PNL % for Connected Players

## What to build

1. **Portfolio pie chart** — shows each player's holdings as % allocation by symbol (using their trades data, which is now accessible via RLS)
2. **PNL as percentage** — show realized PNL % for 7 days, 1 month, and 3 months (not dollar amounts)

## Data approach

Since connected users already have RLS SELECT access to each other's `trades` and `portfolios` tables, we can query trades directly from the frontend — no new RPC needed.

- **Pie chart**: Query the connected player's trades, run `computeHoldings()` (already exists in `usePortfolio.tsx`), then calculate % allocation by `total_invested` per symbol
- **Period PNL %**: Query trades, filter sells by date range (7d / 30d / 90d), compute realized PNL for that period, divide by cost basis to get percentage

## Implementation

### Players.tsx changes

**New query**: Fetch the active player's trades directly:
```ts
const { data: playerTrades = [] } = useQuery({
  queryKey: ["player-trades", activePlayer?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", activePlayer!.id)
      .order("trade_date", { ascending: false });
    return data as Trade[];
  },
  enabled: !!activePlayer?.id,
});
```

**Pie chart component**: Use Recharts `PieChart` + `Pie` + `Cell` to render holdings allocation. Each slice = one symbol, sized by % of total invested. Show labels with symbol + percentage.

**Period PNL component**: Three cards showing PNL % for 7d, 1m, 3m. Computed client-side:
- Filter sells within the period
- Calculate realized PNL for those sells using avg cost
- Divide by total cost basis → percentage
- Color green/red based on sign

### Remove from overview

- Remove the dollar-based stat cards for realized PNL, total return, dividends (replaced by the percentage PNL cards)
- Keep: total trades, holdings count, win rate
- Add: pie chart + 3 period PNL % cards

### New sub-components

1. `PortfolioPieChart` — Recharts pie with custom colors, labels showing symbol + %
2. `PeriodPnlCards` — 3 side-by-side cards (7D / 1M / 3M) each showing PNL %

### Files changed

| File | Change |
|------|--------|
| `src/pages/Players.tsx` | Add trades query, pie chart, period PNL cards; import from recharts and usePortfolio |
| `src/i18n/en.ts` + `es.ts` | Add keys: `social.pnl7d`, `social.pnl1m`, `social.pnl3m`, `social.portfolioAllocation` |

No SQL migration needed — all data is already accessible via existing RLS policies.

