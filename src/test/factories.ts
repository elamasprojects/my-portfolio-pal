/**
 * Fixture builders for the domain types the unit tests exercise.
 *
 * The tests used to write partial object literals and annotate them as `Transaction[]` or
 * `Trade[]`. That only compiled because the repo's `typecheck` script pointed at a solution-style
 * tsconfig with `"files": []`, so `tsc --noEmit` checked nothing at all. With the real check
 * (`tsc -b`) wired up, the drift surfaced: `Transaction` has no `amount` field, and `Trade`
 * carries a dozen columns the literals omitted.
 *
 * These builders fill in the required fields so a test can keep stating only what it cares
 * about, without silencing the type checker with `as any`.
 */

import type { Transaction, Category } from "@/types/finance";
import type { Trade } from "@/hooks/usePortfolio";

export function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "tx_1",
    user_id: "u1",
    type: "expense",
    name: "Transaction",
    amount_usd: 0,
    transaction_date: "2026-08-01",
    source: "manual",
    confidence: "high",
    needs_review: false,
    created_at: "2026-08-01T10:00:00Z",
    updated_at: "2026-08-01T10:00:00Z",
    ...overrides,
  };
}

export function makeCategory(overrides: Partial<Category> = {}): Category {
  return {
    id: "cat1",
    user_id: "u1",
    name: "Categoría",
    type: "expense",
    color: "#888888",
    icon: "circle",
    aliases: [],
    keywords: [],
    sort_order: 0,
    archived: false,
    is_system: false,
    created_at: "2026-08-01T10:00:00Z",
    ...overrides,
  };
}

export function makeTrade(overrides: Partial<Trade> = {}): Trade {
  const quantity = overrides.quantity ?? 1;
  const pricePerUnit = overrides.price_per_unit ?? 0;

  return {
    id: "trade_1",
    portfolio_id: "portfolio_1",
    user_id: "u1",
    symbol: "AAPL",
    asset_name: "Apple Inc.",
    asset_type: "stock",
    trade_type: "buy",
    quantity,
    price_per_unit: pricePerUnit,
    // Mirrors the GENERATED column in Postgres.
    total_amount: quantity * pricePerUnit,
    trade_date: "2026-08-01T10:00:00Z",
    notes: null,
    created_at: "2026-08-01T10:00:00Z",
    strategy_id: null,
    original_currency: "USD",
    original_price: null,
    broker_id: null,
    commission_pct: 0,
    commission_amount: 0,
    mep_rate: null,
    journal_notes: null,
    entry_thesis: null,
    target_price_usd: null,
    invalidation_condition: null,
    invalidation_price_usd: null,
    is_planned_exit: null,
    unplanned_rationale: null,
    split_factor: 1,
    ...overrides,
  };
}
