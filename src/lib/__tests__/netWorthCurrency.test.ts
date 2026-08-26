import { describe, it, expect } from "vitest";
import { computeUnifiedNetWorth } from "@/lib/financialMath";
import type { FinancialAccount, Transaction } from "@/types/finance";
import type { Holding, PortfolioPerformance } from "@/hooks/usePortfolio";

/**
 * Net worth is reported in USD. Every input has to arrive in USD before it is added, and the
 * account balances were the one place that was not converted: an ARS broker account holding
 * AR$1.580.294 was added as US$1.580.294.
 */

function account(overrides: Partial<FinancialAccount>): FinancialAccount {
  return {
    id: "acc",
    user_id: "u1",
    name: "Cuenta",
    type: "bank",
    currency: "USD",
    initial_balance: 0,
    current_balance: 0,
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  } as FinancialAccount;
}

const NO_TX: Transaction[] = [];
const NO_HOLDINGS: Holding[] = [];
const NO_PERF: PortfolioPerformance = {
  total_realized_pnl: 0,
  total_dividends: 0,
  total_return: 0,
  total_cost_basis: 0,
  win_rate: 0,
  winning_sells: 0,
  total_sells: 0,
  by_symbol: [],
};

const MEP = 1500;

describe("computeUnifiedNetWorth — account currency", () => {
  it("converts an ARS broker account instead of counting pesos as dollars", () => {
    const accounts = [
      account({ id: "ieb", name: "IEB+", type: "broker_cash", currency: "ARS", current_balance: 1_500_000 }),
    ];

    const metrics = computeUnifiedNetWorth(
      accounts, NO_TX, NO_HOLDINGS, NO_PERF, new Map(), [], MEP
    );

    // 1.500.000 / 1500 = US$1.000 — not US$1.500.000.
    expect(metrics.brokerCashUSD).toBe(1000);
    expect(metrics.netWorthUSD).toBe(1000);
  });

  it("leaves USD accounts untouched", () => {
    const accounts = [
      account({ id: "mercury", name: "Mercury", currency: "USD", current_balance: 28_000 }),
    ];

    const metrics = computeUnifiedNetWorth(
      accounts, NO_TX, NO_HOLDINGS, NO_PERF, new Map(), [], MEP
    );

    expect(metrics.liquidCashUSD).toBe(28_000);
  });

  it("skips an ARS account when no rate is available rather than counting it at face value", () => {
    const accounts = [
      account({ id: "ieb", type: "broker_cash", currency: "ARS", current_balance: 1_500_000 }),
      account({ id: "mercury", currency: "USD", current_balance: 500 }),
    ];

    const metrics = computeUnifiedNetWorth(
      accounts, NO_TX, NO_HOLDINGS, NO_PERF, new Map(), [], 0
    );

    expect(metrics.brokerCashUSD).toBe(0);
    expect(metrics.netWorthUSD).toBe(500);
  });

  it("lets a negative balance pull net worth down", () => {
    const accounts = [
      account({ id: "mercury", currency: "USD", current_balance: 1_000 }),
      account({ id: "payoneer", currency: "USD", current_balance: -400 }),
    ];

    const metrics = computeUnifiedNetWorth(
      accounts, NO_TX, NO_HOLDINGS, NO_PERF, new Map(), [], MEP
    );

    // Clamping the overdraft to zero used to report US$1.000 for someone holding US$600.
    expect(metrics.liquidCashUSD).toBe(600);
  });

  it("ignores inactive accounts", () => {
    const accounts = [
      account({ id: "vieja", currency: "USD", current_balance: 9_999, is_active: false }),
      account({ id: "mercury", currency: "USD", current_balance: 100 }),
    ];

    const metrics = computeUnifiedNetWorth(
      accounts, NO_TX, NO_HOLDINGS, NO_PERF, new Map(), [], MEP
    );

    expect(metrics.netWorthUSD).toBe(100);
  });
});
