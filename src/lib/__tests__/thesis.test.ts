import { describe, it, expect } from "vitest";
import { latestBuyForSymbol, thesisForSymbol } from "@/lib/thesis";
import { makeTrade } from "@/test/factories";

/**
 * Regression cover for the thesis readings the three strategy views disagreed on.
 *
 * Each of them took `symbolTrades[symbolTrades.length - 1]` as "the latest buy" while
 * `useTrades` returns rows newest-first, so all three displayed the thesis of the *first*
 * purchase ever made of that symbol.
 */
describe("latestBuyForSymbol", () => {
  const oldBuy = makeTrade({
    id: "old",
    symbol: "AAPL",
    trade_type: "buy",
    trade_date: "2024-01-01T10:00:00Z",
    entry_thesis: "Tesis vieja",
    target_price_usd: 200,
  });
  const newBuy = makeTrade({
    id: "new",
    symbol: "AAPL",
    trade_type: "buy",
    trade_date: "2026-05-01T10:00:00Z",
    entry_thesis: "Tesis vigente",
    target_price_usd: 300,
  });

  it("picks the most recent buy regardless of the order the rows arrive in", () => {
    // Newest-first, the order `useTrades` actually returns.
    expect(latestBuyForSymbol([newBuy, oldBuy], "AAPL")?.id).toBe("new");
    // Oldest-first, in case the query's ordering ever changes.
    expect(latestBuyForSymbol([oldBuy, newBuy], "AAPL")?.id).toBe("new");
  });

  it("ignores sells, dividends and other symbols", () => {
    const sell = makeTrade({
      id: "sell",
      symbol: "AAPL",
      trade_type: "sell",
      trade_date: "2026-08-01T10:00:00Z",
    });
    const otherSymbol = makeTrade({
      id: "other",
      symbol: "MSFT",
      trade_type: "buy",
      trade_date: "2026-08-02T10:00:00Z",
    });

    expect(latestBuyForSymbol([sell, otherSymbol, newBuy, oldBuy], "AAPL")?.id).toBe("new");
  });

  it("matches the symbol case-insensitively", () => {
    expect(latestBuyForSymbol([newBuy], "aapl")?.id).toBe("new");
  });

  it("returns null when the symbol has no buy", () => {
    expect(latestBuyForSymbol([], "AAPL")).toBeNull();
  });
});

describe("thesisForSymbol", () => {
  it("reads the thesis off the most recent buy", () => {
    const trades = [
      makeTrade({
        id: "new",
        symbol: "AAPL",
        trade_date: "2026-05-01T10:00:00Z",
        entry_thesis: "Tesis vigente",
        target_price_usd: 300,
        invalidation_condition: "Pierde el soporte",
        invalidation_price_usd: 180,
      }),
      makeTrade({
        id: "old",
        symbol: "AAPL",
        trade_date: "2024-01-01T10:00:00Z",
        entry_thesis: "Tesis vieja",
        target_price_usd: 200,
      }),
    ];

    expect(thesisForSymbol(trades, "AAPL")).toEqual({
      entryThesis: "Tesis vigente",
      targetPriceUSD: 300,
      invalidationCondition: "Pierde el soporte",
      invalidationPriceUSD: 180,
      tradeDate: "2026-05-01T10:00:00Z",
    });
  });

  it("treats a zero or missing level as no level, not as a hit at price zero", () => {
    const thesis = thesisForSymbol(
      [makeTrade({ symbol: "AAPL", target_price_usd: 0, invalidation_price_usd: null })],
      "AAPL"
    );
    expect(thesis.targetPriceUSD).toBeNull();
    expect(thesis.invalidationPriceUSD).toBeNull();
  });

  it("returns an empty thesis for a symbol with no buys", () => {
    expect(thesisForSymbol([], "AAPL")).toEqual({
      entryThesis: null,
      targetPriceUSD: null,
      invalidationCondition: null,
      invalidationPriceUSD: null,
      tradeDate: null,
    });
  });
});
