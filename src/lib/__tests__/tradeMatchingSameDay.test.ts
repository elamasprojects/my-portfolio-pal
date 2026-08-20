import { describe, it, expect } from "vitest";
import { matchTradesFIFO } from "@/lib/tradeMatching";
import { makeTrade } from "@/test/factories";

/**
 * Regression cover for the Game Review's lot matching.
 *
 * Both the batch engine and the dashboard grouped closed lots back onto their exit with
 * `closedTrades.filter(c => c.sellDate === sellDate)`. Two sells of one symbol on the same day
 * share a date, so each of them claimed every lot closed that day — doubling the audited
 * quantity and P&L and writing duplicate `game_reviews` rows.
 */
describe("matchTradesFIFO — two sells on the same day", () => {
  const trades = [
    makeTrade({
      id: "buy-1",
      symbol: "AAPL",
      trade_type: "buy",
      quantity: 100,
      price_per_unit: 100,
      trade_date: "2026-01-01T10:00:00Z",
    }),
    makeTrade({
      id: "buy-2",
      symbol: "AAPL",
      trade_type: "buy",
      quantity: 100,
      price_per_unit: 120,
      trade_date: "2026-02-01T10:00:00Z",
    }),
    makeTrade({
      id: "sell-a",
      symbol: "AAPL",
      trade_type: "sell",
      quantity: 100,
      price_per_unit: 150,
      trade_date: "2026-03-01T10:00:00Z",
    }),
    makeTrade({
      id: "sell-b",
      symbol: "AAPL",
      trade_type: "sell",
      quantity: 100,
      price_per_unit: 160,
      trade_date: "2026-03-01T15:00:00Z",
    }),
  ];

  const { closedTrades } = matchTradesFIFO(trades);

  it("attributes each lot to the sell that consumed it", () => {
    const bySell = (id: string) => closedTrades.filter((c) => c.sellTradeId === id);

    expect(bySell("sell-a")).toHaveLength(1);
    expect(bySell("sell-b")).toHaveLength(1);

    // FIFO: the first sell takes the 100 @ 100 lot, the second takes the 100 @ 120 lot.
    expect(bySell("sell-a")[0].buyPrice).toBe(100);
    expect(bySell("sell-b")[0].buyPrice).toBe(120);
  });

  it("does not let a same-day sibling inflate a sell's quantity", () => {
    const qtyFor = (id: string) =>
      closedTrades.filter((c) => c.sellTradeId === id).reduce((sum, c) => sum + c.quantity, 0);

    expect(qtyFor("sell-a")).toBe(100);
    expect(qtyFor("sell-b")).toBe(100);

    // Matching by date instead would have handed each sell both lots: 200 units apiece.
    const sameDayLots = closedTrades.filter((c) => c.sellDate.startsWith("2026-03-01"));
    expect(sameDayLots).toHaveLength(2);
  });

  it("prices each sell against its own lot", () => {
    const pnlFor = (id: string) =>
      closedTrades.filter((c) => c.sellTradeId === id).reduce((sum, c) => sum + c.pnl, 0);

    expect(pnlFor("sell-a")).toBe((150 - 100) * 100);
    expect(pnlFor("sell-b")).toBe((160 - 120) * 100);
  });
});
