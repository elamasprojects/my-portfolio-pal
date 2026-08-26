import { describe, it, expect } from "vitest";
import { summariseExitsFIFO } from "@/lib/tradeMatching";
import { classifyTradeOutcome } from "@/lib/gameReviewClassifier";
import { calculateCounterfactuals } from "@/lib/counterfactuals";
import { adjustTradeForSplit } from "@/lib/corporateActions";
import { buildTradeRow } from "@/lib/tradeEntry";
import { makeTrade } from "@/test/factories";

const ctx = { userId: "u1", portfolioId: "p1", now: new Date("2026-08-26T12:00:00.000Z") };

describe("summariseExitsFIFO — two sells on one day", () => {
  it("keeps them as separate exits", () => {
    const trades = [
      makeTrade({ id: "b1", symbol: "NU", trade_type: "buy", quantity: 100, price_per_unit: 10, trade_date: "2026-01-01T10:00:00Z" }),
      makeTrade({ id: "b2", symbol: "NU", trade_type: "buy", quantity: 100, price_per_unit: 12, trade_date: "2026-02-01T10:00:00Z" }),
      makeTrade({ id: "s1", symbol: "NU", trade_type: "sell", quantity: 100, price_per_unit: 15, trade_date: "2026-03-01T10:00:00Z" }),
      makeTrade({ id: "s2", symbol: "NU", trade_type: "sell", quantity: 100, price_per_unit: 20, trade_date: "2026-03-01T16:00:00Z" }),
    ];

    const exits = summariseExitsFIFO(trades);

    // Merged on date, these collapsed into one exit of 200 units — inflating "top trade of the
    // month" and miscounting the win streak.
    expect(exits).toHaveLength(2);
    expect(exits.map((e) => e.quantity)).toEqual([100, 100]);
    expect(exits.map((e) => e.pnl)).toEqual([(15 - 10) * 100, (20 - 12) * 100]);
  });
});

describe("classifyTradeOutcome — a planned stop is not a Blunder", () => {
  // Sold at a loss; the stock then recovered well past the entry. Run through the real
  // counterfactual engine so the classifier sees the figures it does in production.
  const losingTrade = {
    tradeId: "t1",
    symbol: "NU",
    buyDate: "2026-01-01",
    sellDate: "2026-03-01",
    buyPriceARS: 100,
    sellPriceARS: 85,
    quantity: 10,
    holdingPriceAtSellDateARS: 150,
    splitFactor: 1,
  };

  const grade = (isPlannedExit: boolean) => {
    const trade = { ...losingTrade, isPlannedExit };
    return classifyTradeOutcome(trade, calculateCounterfactuals(trade));
  };

  it("grades an unplanned panic sell a Blunder", () => {
    expect(grade(false)).toBe("Blunder");
  });

  it("does not grade the same exit a Blunder when it followed the declared plan", () => {
    // Following your own stop and being proven 'wrong' by a later recovery is the discipline
    // this app rewards; it used to be punished identically to a panic sell.
    expect(grade(true)).not.toBe("Blunder");
  });
});

describe("adjustTradeForSplit", () => {
  it("scales the entry but leaves post-split prices alone", () => {
    const adjusted = adjustTradeForSplit({
      tradeId: "t1",
      symbol: "NVDA",
      buyDate: "2026-01-01",
      sellDate: "2026-06-01",
      buyPriceARS: 1000,
      sellPriceARS: 120,
      quantity: 10,
      holdingPriceAtSellDateARS: 130,
      splitFactor: 10,
    });

    // Entry: 10 shares @ 1000 becomes 100 @ 100.
    expect(adjusted.quantity).toBe(100);
    expect(adjusted.buyPriceARS).toBe(100);
    // The exit and the "what if I had held" price are already quoted post-split.
    expect(adjusted.sellPriceARS).toBe(120);
    expect(adjusted.holdingPriceAtSellDateARS).toBe(130);
  });

  it("is a no-op without a split", () => {
    const adjusted = adjustTradeForSplit({
      tradeId: "t1", symbol: "NU", buyDate: "2026-01-01", sellDate: "2026-02-01",
      buyPriceARS: 100, sellPriceARS: 120, quantity: 10,
      holdingPriceAtSellDateARS: 130, splitFactor: 1,
    });

    expect(adjusted.quantity).toBe(10);
    expect(adjusted.buyPriceARS).toBe(100);
    expect(adjusted.holdingPriceAtSellDateARS).toBe(130);
  });
});

describe("buildTradeRow — discipline fields on a sell", () => {
  it("records an unplanned exit with its written justification", () => {
    const row = buildTradeRow(
      {
        tradeType: "sell",
        symbol: "NU",
        quantity: 10,
        price: 15,
        isPlannedExit: false,
        unplannedRationale: "Vendí por pánico tras un rumor, sin cambio en la tesis.",
      },
      ctx
    );

    expect(row.is_planned_exit).toBe(false);
    expect(row.unplanned_rationale).toContain("pánico");
  });

  it("records a planned exit without a rationale", () => {
    const row = buildTradeRow(
      { tradeType: "sell", symbol: "NU", quantity: 10, price: 15, isPlannedExit: true },
      ctx
    );

    expect(row.is_planned_exit).toBe(true);
    expect(row.unplanned_rationale).toBeNull();
  });

  it("never marks a buy as an exit", () => {
    const row = buildTradeRow(
      {
        tradeType: "buy",
        symbol: "NU",
        quantity: 10,
        price: 15,
        entryThesis: "Tesis de entrada suficientemente larga",
        targetPrice: 20,
        invalidationCondition: "Pierde el soporte de 12",
      },
      ctx
    );

    expect(row.is_planned_exit).toBe(false);
    expect(row.unplanned_rationale).toBeNull();
  });
});
