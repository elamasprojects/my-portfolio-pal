import { describe, it, expect } from "vitest";
import { buildPersonalSankeyData, computeUnifiedNetWorth } from "@/lib/financialMath";
import { Transaction, Category, PaymentMethod } from "@/types/finance";
import { Holding, PortfolioPerformance } from "@/hooks/usePortfolio";

describe("financialMath engine", () => {
  const mockCategories: Category[] = [
    {
      id: "cat-1",
      name: "Food",
      type: "expense",
      color: "#10b981",
      icon: "Utensils",
      aliases: [],
      keywords: ["coto", "supermercado"],
      sort_order: 1,
      archived: false,
      is_system: true,
      created_at: new Date().toISOString(),
    },
    {
      id: "cat-2",
      name: "House",
      type: "expense",
      color: "#3b82f6",
      icon: "Home",
      aliases: [],
      keywords: ["edesur", "luz"],
      sort_order: 2,
      archived: false,
      is_system: true,
      created_at: new Date().toISOString(),
    },
    {
      id: "cat-3",
      name: "UGC Studio Payout",
      type: "income",
      color: "#10b981",
      icon: "Briefcase",
      aliases: [],
      keywords: ["ugc"],
      sort_order: 3,
      archived: false,
      is_system: true,
      created_at: new Date().toISOString(),
    },
  ];

  const mockTransactions: Transaction[] = [
    {
      id: "tx-1",
      user_id: "user-1",
      type: "income",
      name: "Pago UGC Studio",
      amount_usd: 8500,
      transaction_date: "2026-08-01",
      category_id: "cat-3",
      payment_method_id: "pm-1",
      source: "manual",
      confidence: "high",
      needs_review: false,
      created_at: "2026-08-01T12:00:00Z",
    },
    {
      id: "tx-2",
      user_id: "user-1",
      type: "expense",
      name: "Coto Supermercado",
      amount_usd: 1200,
      transaction_date: "2026-08-02",
      category_id: "cat-1",
      payment_method_id: "pm-1",
      source: "screenshot",
      confidence: "high",
      needs_review: false,
      created_at: "2026-08-02T12:00:00Z",
    },
    {
      id: "tx-3",
      user_id: "user-1",
      type: "expense",
      name: "Edesur Luz",
      amount_usd: 300,
      transaction_date: "2026-08-03",
      category_id: "cat-2",
      payment_method_id: "pm-1",
      source: "text",
      confidence: "high",
      needs_review: false,
      created_at: "2026-08-03T12:00:00Z",
    },
  ];

  it("builds Sankey diagram with correct nodes, links, and net savings", () => {
    const sankey = buildPersonalSankeyData(mockTransactions, mockCategories);

    expect(sankey.totalIncome).toBe(8500);
    expect(sankey.totalExpenses).toBe(1500);
    expect(sankey.netResult).toBe(7000);
    expect(sankey.savingsRatePct).toBeCloseTo(82.4, 1);

    // Spine node check
    const spineNode = sankey.nodes.find((n) => n.id === "cash_collected");
    expect(spineNode).toBeDefined();
    expect(spineNode?.value).toBe(8500);

    // Income node check
    const incomeNode = sankey.nodes.find((n) => n.category === "income");
    expect(incomeNode).toBeDefined();
    expect(incomeNode?.value).toBe(8500);

    // Net savings node check
    const netNode = sankey.nodes.find((n) => n.id === "net_savings");
    expect(netNode).toBeDefined();
    expect(netNode?.value).toBe(7000);
    expect(netNode?.color).toBe("#a855f7");
  });

  it("computes unified net worth including bank cash and stock portfolio holdings", () => {
    const mockAccounts: FinancialAccount[] = [
      {
        id: "acc-1",
        user_id: "user-1",
        name: "DolarApp",
        type: "digital_wallet",
        currency: "USD",
        initial_balance: 5000,
        current_balance: 12000,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "acc-2",
        user_id: "user-1",
        name: "Broker Cash (IOL)",
        type: "broker_cash",
        currency: "USD",
        initial_balance: 0,
        current_balance: 3500,
        is_active: true,
        created_at: "2026-01-01T00:00:00Z",
      },
    ];

    const mockHoldings: Holding[] = [
      {
        symbol: "AAPL",
        asset_name: "Apple Inc.",
        asset_type: "stock",
        net_quantity: 50,
        avg_cost: 180,
        total_invested: 9000,
      },
    ];

    const mockPerformance: PortfolioPerformance = {
      total_invested: 9000,
      total_cost_basis: 9000,
      total_realized_pnl: 1500,
      total_dividends: 120,
      total_return: 1620,
      total_trades: 5,
      winning_trades: 4,
      win_rate: 80,
    };

    const mockPrices = new Map<string, number>([["AAPL", 200]]);

    const metrics = computeUnifiedNetWorth(
      mockAccounts,
      mockTransactions,
      mockHoldings,
      mockPerformance,
      mockPrices
    );

    // Liquid Cash: 12,000 | Broker Cash: 3,500 | Stocks: 50 * $200 = 10,000 | Total = 25,500
    expect(metrics.liquidCashUSD).toBe(12000);
    expect(metrics.brokerCashUSD).toBe(3500);
    expect(metrics.portfolioMarketValueUSD).toBe(10000);
    expect(metrics.netWorthUSD).toBe(25500);
  });
});
