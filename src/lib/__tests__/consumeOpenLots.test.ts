import { describe, it, expect } from "vitest";
import { matchTradesFIFO, consumeOpenLotsFIFO, summariseExitsFIFO } from "@/lib/tradeMatching";
import type { Trade } from "@/hooks/usePortfolio";

/**
 * Regression cover for the closed-position summary.
 *
 * It read `symbolTrades[0]` — the first buy of the symbol ever — as the position's entry. For a
 * ticker bought and sold repeatedly that dates the sale back to shares disposed of months
 * earlier: a NU position opened on 2026-08-20 and closed on 2026-08-24 was reported as held for
 * 167 days, measured from a March purchase that had already been sold.
 */

function trade(over: Partial<Trade> & Pick<Trade, "trade_type" | "quantity" | "price_per_unit" | "trade_date">): Trade {
  return {
    id: over.trade_date + over.trade_type + over.quantity,
    portfolio_id: "p1",
    user_id: "u1",
    symbol: "NU",
    asset_name: "Nu Holdings Ltd.",
    asset_type: "stock",
    total_amount: over.quantity * over.price_per_unit,
    notes: null,
    created_at: over.trade_date,
    strategy_id: null,
    original_currency: "USD",
    original_price: null,
    broker_id: null,
    commission_pct: 0,
    commission_amount: 0,
    mep_rate: null,
    journal_notes: null,
    ...over,
  } as Trade;
}

// The real shape of the reported position: bought and fully sold three times over, then
// re-entered days before the exit under test.
const NU_LEDGER: Trade[] = [
  trade({ trade_type: "buy", quantity: 34.72, price_per_unit: 14.399, trade_date: "2026-03-11T18:26:31Z" }),
  trade({ trade_type: "buy", quantity: 17.64, price_per_unit: 14.173, trade_date: "2026-03-19T19:30:12Z" }),
  trade({ trade_type: "sell", quantity: 52.36, price_per_unit: 14.4, trade_date: "2026-07-31T14:01:54Z" }),
  trade({ trade_type: "buy", quantity: 105.745505816, price_per_unit: 14.185, trade_date: "2026-08-20T17:04:56Z" }),
];

describe("consumeOpenLotsFIFO", () => {
  it("dates a sale to the lot it consumes, not to the first purchase ever", () => {
    const { openLots } = matchTradesFIFO(NU_LEDGER);
    const consumed = consumeOpenLotsFIFO(openLots, 105.745505816);

    // The March lots were already closed out by the July sale; only the August buy is open.
    expect(consumed.earliestBuyDate).toBe("2026-08-20T17:04:56Z");
    expect(consumed.weightedBuyPrice).toBeCloseTo(14.185, 6);

    const holdDays = Math.round(
      (new Date("2026-08-24T15:43:34Z").getTime() - new Date(consumed.earliestBuyDate!).getTime()) /
        86_400_000
    );
    expect(holdDays).toBe(4); // was 167
  });

  it("weights the cost across every lot a larger sale reaches into", () => {
    const lots = [
      { date: "2026-01-01T00:00:00Z", price: 10, remainingQty: 100 },
      { date: "2026-02-01T00:00:00Z", price: 20, remainingQty: 100 },
    ];

    const consumed = consumeOpenLotsFIFO(lots, 150);

    expect(consumed.quantity).toBe(150);
    // (100 * 10 + 50 * 20) / 150 = 13.33…
    expect(consumed.weightedBuyPrice).toBeCloseTo(40 / 3, 6);
    expect(consumed.earliestBuyDate).toBe("2026-01-01T00:00:00Z");
    expect(consumed.lots).toHaveLength(2);
  });

  it("takes only what exists when the request exceeds the open lots", () => {
    const lots = [{ date: "2026-01-01T00:00:00Z", price: 10, remainingQty: 5 }];
    const consumed = consumeOpenLotsFIFO(lots, 999);

    expect(consumed.quantity).toBe(5);
    expect(consumed.weightedBuyPrice).toBe(10);
  });

  it("reports nothing consumed against an empty position", () => {
    const consumed = consumeOpenLotsFIFO([], 10);

    expect(consumed.quantity).toBe(0);
    expect(consumed.earliestBuyDate).toBeNull();
    expect(consumed.weightedBuyPrice).toBe(0);
  });

  it("leaves the caller's lots untouched", () => {
    const lots = [{ date: "2026-01-01T00:00:00Z", price: 10, remainingQty: 100 }];
    consumeOpenLotsFIFO(lots, 40);

    expect(lots[0].remainingQty).toBe(100);
  });
});

describe("matchTradesFIFO chronological order", () => {
  it("replays a same-day buy before the sell it funded", () => {
    const sameDay: Trade[] = [
      trade({ trade_type: "sell", quantity: 10, price_per_unit: 12, trade_date: "2026-05-15T00:00:00Z" }),
      trade({ trade_type: "buy", quantity: 10, price_per_unit: 11, trade_date: "2026-05-15T00:00:00Z" }),
    ];

    const { closedTrades, openLots } = matchTradesFIFO(sameDay);

    // Sorting on the date alone let the sell run first against nothing, leaving the buy open.
    expect(closedTrades).toHaveLength(1);
    expect(closedTrades[0].buyPrice).toBe(11);
    expect(openLots).toHaveLength(0);
  });
});

describe("summariseExitsFIFO", () => {
  it("keeps each symbol's lot queue separate", () => {
    const ledger: Trade[] = [
      trade({ symbol: "AAA", trade_type: "buy", quantity: 10, price_per_unit: 100, trade_date: "2026-01-01T00:00:00Z" }),
      trade({ symbol: "BBB", trade_type: "buy", quantity: 10, price_per_unit: 1, trade_date: "2026-01-02T00:00:00Z" }),
      trade({ symbol: "BBB", trade_type: "sell", quantity: 10, price_per_unit: 2, trade_date: "2026-01-03T00:00:00Z" }),
    ];

    const exits = summariseExitsFIFO(ledger);

    // Replayed as one queue, BBB's sale would consume AAA's $100 lot and report a $980 loss.
    expect(exits).toHaveLength(1);
    expect(exits[0].symbol).toBe("BBB");
    expect(exits[0].pnl).toBeCloseTo(10, 6);
  });

  it("folds the lots of one sale into a single exit", () => {
    const ledger: Trade[] = [
      trade({ trade_type: "buy", quantity: 10, price_per_unit: 10, trade_date: "2026-01-01T00:00:00Z" }),
      trade({ trade_type: "buy", quantity: 10, price_per_unit: 12, trade_date: "2026-01-02T00:00:00Z" }),
      trade({ trade_type: "buy", quantity: 10, price_per_unit: 14, trade_date: "2026-01-03T00:00:00Z" }),
      trade({ trade_type: "sell", quantity: 30, price_per_unit: 20, trade_date: "2026-02-01T00:00:00Z" }),
    ];

    const exits = summariseExitsFIFO(ledger);

    // One sale across three lots is one exit — counting the lots made a single winning trade
    // read as a 3-trade winning streak.
    expect(exits).toHaveLength(1);
    expect(exits[0].quantity).toBeCloseTo(30, 6);
    expect(exits[0].pnl).toBeCloseTo(10 * 10 + 8 * 10 + 6 * 10, 6);
  });

  it("ranks a multi-lot exit above a smaller single-lot one", () => {
    const ledger: Trade[] = [
      trade({ symbol: "BIG", trade_type: "buy", quantity: 3, price_per_unit: 10, trade_date: "2026-01-01T00:00:00Z" }),
      trade({ symbol: "BIG", trade_type: "buy", quantity: 3, price_per_unit: 10, trade_date: "2026-01-02T00:00:00Z" }),
      trade({ symbol: "BIG", trade_type: "buy", quantity: 3, price_per_unit: 10, trade_date: "2026-01-03T00:00:00Z" }),
      trade({ symbol: "BIG", trade_type: "sell", quantity: 9, price_per_unit: 110, trade_date: "2026-02-01T00:00:00Z" }),
      trade({ symbol: "SML", trade_type: "buy", quantity: 1, price_per_unit: 10, trade_date: "2026-01-01T00:00:00Z" }),
      trade({ symbol: "SML", trade_type: "sell", quantity: 1, price_per_unit: 410, trade_date: "2026-02-02T00:00:00Z" }),
    ];

    const best = summariseExitsFIFO(ledger).reduce((max, e) => Math.max(max, e.pnl), 0);

    // BIG made 900 in one sale (three 300 lots); per-lot maxima would have called SML's 400
    // the best trade of the month.
    expect(best).toBeCloseTo(900, 6);
  });

  it("returns nothing when no position was ever closed", () => {
    const ledger: Trade[] = [
      trade({ trade_type: "buy", quantity: 10, price_per_unit: 10, trade_date: "2026-01-01T00:00:00Z" }),
    ];

    expect(summariseExitsFIFO(ledger)).toEqual([]);
  });
});
