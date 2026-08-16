import { describe, it, expect } from "vitest";
import { buildTradeRow } from "@/lib/tradeEntry";

/**
 * Regression cover for the capability the 3-view refactor dropped.
 *
 * AddTrade.tsx and ImportTrades.tsx were deleted and /add redirected away, leaving
 * useQuickSellTrade (with a hardcoded trade_type: "sell") as the only insert into `trades`.
 * The app could close a position but never open one, and "mandatory thesis on buys" had no
 * buy flow to attach to.
 */

const ctx = {
  userId: "user-1",
  portfolioId: "portfolio-1",
  now: new Date("2026-08-16T12:00:00.000Z"),
};

describe("buildTradeRow", () => {
  it("records a buy with its pre-trade thesis attached", () => {
    const row = buildTradeRow(
      {
        tradeType: "buy",
        symbol: "aapl",
        quantity: 10,
        price: 230,
        entryThesis: "Crecimiento de ingresos sostenido",
        targetPriceARS: 300,
        invalidationCondition: "Pierde el soporte de 180",
      },
      ctx
    );

    expect(row.trade_type).toBe("buy");
    expect(row.symbol).toBe("AAPL");
    expect(row.quantity).toBe(10);
    expect(row.price_per_unit).toBe(230);
    expect(row.entry_thesis).toBe("Crecimiento de ingresos sostenido");
    expect(row.target_price_ars).toBe(300);
    expect(row.invalidation_condition).toBe("Pierde el soporte de 180");
  });

  it("never writes the generated total_amount column", () => {
    const row = buildTradeRow(
      { tradeType: "buy", symbol: "AAPL", quantity: 3, price: 100 },
      ctx
    );
    // total_amount is GENERATED (quantity * price_per_unit); writing it is rejected by Postgres.
    expect(row).not.toHaveProperty("total_amount");
  });

  it("records a dividend as a single cash event", () => {
    const row = buildTradeRow({ tradeType: "dividend", symbol: "KO", price: 125.4 }, ctx);

    expect(row.trade_type).toBe("dividend");
    // quantity 1 so the generated total_amount equals the cash received.
    expect(row.quantity).toBe(1);
    expect(row.price_per_unit).toBe(125.4);
    expect(row.entry_thesis).toBeNull();
  });

  it("ignores any quantity passed alongside a dividend", () => {
    const row = buildTradeRow(
      { tradeType: "dividend", symbol: "KO", price: 50, quantity: 999 },
      ctx
    );
    expect(row.quantity).toBe(1);
  });

  it("normalises an ARS price to USD while preserving what was typed", () => {
    const row = buildTradeRow(
      {
        tradeType: "buy",
        symbol: "GGAL",
        quantity: 100,
        price: 12000,
        currency: "ARS",
        mepRate: 1200,
      },
      ctx
    );

    // price_per_unit is USD everywhere in this codebase; original_price keeps the pesos.
    expect(row.price_per_unit).toBe(10);
    expect(row.original_currency).toBe("ARS");
    expect(row.original_price).toBe(12000);
    expect(row.mep_rate).toBe(1200);
  });

  it("refuses an ARS amount with no MEP rate instead of treating pesos as dollars", () => {
    expect(() =>
      buildTradeRow(
        { tradeType: "buy", symbol: "GGAL", quantity: 1, price: 12000, currency: "ARS" },
        ctx
      )
    ).toThrow(/MEP/);
  });

  it("leaves USD prices untouched", () => {
    const row = buildTradeRow(
      { tradeType: "sell", symbol: "AAPL", quantity: 5, price: 240, currency: "USD" },
      ctx
    );
    expect(row.price_per_unit).toBe(240);
    expect(row.original_currency).toBe("USD");
    expect(row.original_price).toBeNull();
    expect(row.mep_rate).toBeNull();
  });

  it("rejects non-positive quantities and prices", () => {
    expect(() => buildTradeRow({ tradeType: "buy", symbol: "A", quantity: 0, price: 10 }, ctx)).toThrow();
    expect(() => buildTradeRow({ tradeType: "buy", symbol: "A", quantity: 1, price: 0 }, ctx)).toThrow();
    expect(() => buildTradeRow({ tradeType: "dividend", symbol: "A", price: -5 }, ctx)).toThrow();
    expect(() => buildTradeRow({ tradeType: "buy", symbol: "   ", quantity: 1, price: 5 }, ctx)).toThrow();
  });

  it("defaults the trade date to now and honours an explicit one", () => {
    const auto = buildTradeRow({ tradeType: "buy", symbol: "A", quantity: 1, price: 5 }, ctx);
    expect(auto.trade_date).toBe("2026-08-16T12:00:00.000Z");

    const explicit = buildTradeRow(
      { tradeType: "buy", symbol: "A", quantity: 1, price: 5, tradeDate: "2024-03-01" },
      ctx
    );
    expect(explicit.trade_date.slice(0, 10)).toBe("2024-03-01");
  });

  it("scopes the row to the acting user and portfolio", () => {
    const row = buildTradeRow({ tradeType: "buy", symbol: "A", quantity: 1, price: 5 }, ctx);
    expect(row.user_id).toBe("user-1");
    expect(row.portfolio_id).toBe("portfolio-1");
  });
});
