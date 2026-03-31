

# Plan: Allocation by Broker + Broker Filter in "By Asset"

## Changes

### 1. `src/pages/Index.tsx`

**New data: import `useBrokers`** from `useBrokers.tsx` to get broker names (mapping `broker_id` → `name`).

**New allocation tab "By Broker"**:
- Group holdings value by `broker_id` from trades. Since each trade has a `broker_id`, walk through trades to compute per-broker invested value using the same logic as `computeHoldings` but grouped by broker.
- New `useMemo` that iterates trades, builds positions per `(broker_id, symbol)`, then aggregates market value per broker. Trades without a broker go into "Sin broker" / "No broker".
- Add a 4th tab trigger "By Broker" in the existing `TabsList`.

**Broker filter in "By Asset" tab**:
- Add a small `Select` dropdown inside the "asset" `TabsContent`, above the pie chart.
- Options: "All" (default) + one per broker that has trades.
- When a broker is selected, filter `allocationByAsset` to only show symbols where that broker was used.
- The filter uses a `useState` for `assetBrokerFilter` (null = all).

**Computing per-broker data**:
- New `useMemo` → `tradesByBroker`: a Map from `broker_id` to trades array.
- `allocationByBroker`: aggregate market value of positions built from each broker's trades.
- `filteredAllocationByAsset`: when `assetBrokerFilter` is set, recompute `computeHoldings` on filtered trades, then map to allocation data.

### 2. `src/i18n/en.ts` & `src/i18n/es.ts`

New keys:
- `board.byBroker`: "By Broker" / "Por Broker"
- `board.allBrokers`: "All Brokers" / "Todos los Brokers"
- `board.noBroker`: "No Broker" / "Sin Broker"

### No DB changes

Trades already store `broker_id`. Broker names come from the existing `useBrokers()` hook.

## Files modified

| File | Change |
|---|---|
| `src/pages/Index.tsx` | 4th allocation tab, broker filter Select in "By Asset" tab |
| `src/i18n/en.ts`, `es.ts` | 3 new keys |

