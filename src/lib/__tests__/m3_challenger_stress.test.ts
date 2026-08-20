import { describe, it, expect, beforeEach, vi } from "vitest";
import { normalizeToUnifiedEvents, UnifiedEventItem } from "@/lib/unifiedEvents";
import { computeDiscipline, DisciplineRule, RULE_DEFAULTS } from "@/hooks/useDiscipline";
import { renderHook, act } from "@testing-library/react";
import { useCandidateWatchlist } from "@/hooks/useCandidateWatchlist";
import { Transaction, Category } from "@/types/finance";
import { makeTransaction, makeCategory, makeTrade } from "@/test/factories";
import { Trade } from "@/hooks/usePortfolio";
import { computeUnifiedNetWorth, buildPersonalSankeyData } from "@/lib/financialMath";

describe("Milestone M3 Challenger Empirical Stress Tests", () => {

  describe("1. normalizeToUnifiedEvents Normalizer Stress Tests", () => {
    it("handles empty arrays gracefully without throwing", () => {
      const result = normalizeToUnifiedEvents([], [], new Map());
      expect(result).toEqual([]);
    });

    it("filters out deleted transactions (deleted_at is set)", () => {
      const transactions: Transaction[] = ([
        {
          id: "tx_1",
          user_id: "u1",
          account_id: "acc1",
          category_id: "cat1",
          amount_usd: 10,
          type: "expense",
          name: "Active Tx",
          transaction_date: "2026-08-01",
          created_at: "2026-08-01T10:00:00Z",
          updated_at: "2026-08-01T10:00:00Z",
        },
        {
          id: "tx_2",
          user_id: "u1",
          account_id: "acc1",
          category_id: "cat1",
          amount_usd: 20,
          type: "expense",
          name: "Deleted Tx",
          transaction_date: "2026-08-02",
          deleted_at: "2026-08-03T12:00:00Z",
          created_at: "2026-08-02T10:00:00Z",
          updated_at: "2026-08-03T12:00:00Z",
        },
      ] satisfies Partial<Transaction>[]).map(makeTransaction);

      const result = normalizeToUnifiedEvents(transactions, [], new Map());
      expect(result.length).toBe(1);
      expect(result[0].rawId).toBe("tx_1");
    });

    it("maps category details correctly from categoriesMap", () => {
      const catMap = new Map<string, Category>();
      catMap.set("cat1", makeCategory({
        id: "cat1",
        user_id: "u1",
        name: "Supermercado",
        type: "expense",
        color: "#ff0000",
        created_at: "2026-01-01",
      }));

      const transactions: Transaction[] = ([
        {
          id: "tx_1",
          user_id: "u1",
          account_id: "acc1",
          category_id: "cat1",
          amount_usd: 15,
          type: "expense",
          name: "Coto",
          transaction_date: "2026-08-10",
          created_at: "2026-08-10T10:00:00Z",
          updated_at: "2026-08-10T10:00:00Z",
        },
      ] satisfies Partial<Transaction>[]).map(makeTransaction);

      const result = normalizeToUnifiedEvents(transactions, [], catMap);
      expect(result[0].categoryName).toBe("Supermercado");
      expect(result[0].categoryColor).toBe("#ff0000");
      expect(result[0].subtitle).toBe("Supermercado");
    });

    it("handles missing/null fields and defaults safely", () => {
      const transactions: any[] = [
        {
          id: "tx_nulls",
          user_id: "u1",
          account_id: "acc1",
          amount_usd: null,
          type: null,
          name: null,
          transaction_date: "2026-08-05",
        },
      ];
      const trades: any[] = [
        {
          id: "tr_nulls",
          portfolio_id: "p1",
          user_id: "u1",
          symbol: "AAPL",
          trade_type: "buy",
          quantity: 10,
          price_per_unit: 150,
          total_amount: null,
          trade_date: "2026-08-06",
        },
      ];

      const result = normalizeToUnifiedEvents(transactions, trades, new Map());
      expect(result.length).toBe(2);
      
      const tx = result.find((r) => r.sourceTable === "transactions")!;
      expect(tx.title).toBe("Sin título");
      expect(tx.amountUSD).toBe(0);
      expect(tx.type).toBe("expense");

      const trade = result.find((r) => r.sourceTable === "trades")!;
      expect(trade.amountUSD).toBe(0);
      expect(trade.title).toBe("BUY AAPL");
    });

    it("sorts merged transactions and trades chronologically descending", () => {
      const transactions: Transaction[] = ([
        { id: "tx_old", user_id: "u1", account_id: "a1", amount_usd: 10, type: "expense", name: "Old Tx", transaction_date: "2026-01-01", created_at: "", updated_at: "" },
        { id: "tx_mid", user_id: "u1", account_id: "a1", amount_usd: 20, type: "expense", name: "Mid Tx", transaction_date: "2026-05-15", created_at: "", updated_at: "" },
      ] satisfies Partial<Transaction>[]).map(makeTransaction);
      const trades: Trade[] = ([
        { id: "tr_newest", portfolio_id: "p1", user_id: "u1", symbol: "TSLA", trade_type: "buy", quantity: 1, price_per_unit: 200, total_amount: 200, trade_date: "2026-08-14", created_at: "" },
      ] satisfies Partial<Trade>[]).map(makeTrade);

      const result = normalizeToUnifiedEvents(transactions, trades, new Map());
      expect(result.map((r) => r.id)).toEqual(["trade_tr_newest", "tx_tx_mid", "tx_tx_old"]);
    });

    it("performs efficiently with large workloads (10,000 items)", () => {
      const largeTxs: Transaction[] = Array.from({ length: 5000 }, (_, i) => makeTransaction({
        id: `tx_${i}`,
        user_id: "u1",
        account_id: "a1",
        amount_usd: i,
        type: "expense",
        name: `Tx ${i}`,
        transaction_date: "2026-08-01",
        created_at: "",
        updated_at: "",
      }));

      const largeTrades: Trade[] = Array.from({ length: 5000 }, (_, i) => makeTrade({
        id: `tr_${i}`,
        portfolio_id: "p1",
        user_id: "u1",
        symbol: "AAPL",
        trade_type: "buy",
        quantity: 1,
        price_per_unit: 100,
        total_amount: 100,
        trade_date: "2026-08-02",
        created_at: "",
      }));

      const start = performance.now();
      const result = normalizeToUnifiedEvents(largeTxs, largeTrades, new Map());
      const duration = performance.now() - start;

      expect(result.length).toBe(10000);
      expect(duration).toBeLessThan(500); // Should execute in < 500ms
    });
  });

  describe("2. useCandidateWatchlist Hook & Persistence Stress Tests", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    // The watchlist opens empty. It used to seed two invented candidates (AAPL and AL30, with
    // prices and theses nobody wrote) and persist them, so they were indistinguishable from the
    // user's own entries.
    it("starts empty when localStorage has nothing stored", () => {
      const { result } = renderHook(() => useCandidateWatchlist());
      expect(result.current.items).toEqual([]);
    });

    it("handles corrupt JSON in localStorage gracefully", () => {
      localStorage.setItem("chess_candidate_watchlist", "{corrupt_json_key: ");
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const { result } = renderHook(() => useCandidateWatchlist());
      expect(result.current.items).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("supports CRUD operations: addItem, updateItem, removeItem", () => {
      const { result } = renderHook(() => useCandidateWatchlist());

      let addedItem: any;
      act(() => {
        addedItem = result.current.addItem({
          symbol: "NVDA",
          assetCategory: "cedear",
          targetEntryPriceARS: 12000,
          targetExitPriceARS: 16000,
          invalidationPriceARS: 10500,
          entryThesis: "Fuerte crecimiento por demanda AI",
          invalidationCondition: "Caida por debajo de soporte",
        });
      });

      expect(result.current.items.some((i) => i.symbol === "NVDA")).toBe(true);
      expect(addedItem.id).toBeDefined();

      // Update item
      act(() => {
        result.current.updateItem(addedItem.id, { targetExitPriceARS: 17000 });
      });
      const updated = result.current.items.find((i) => i.id === addedItem.id);
      expect(updated?.targetExitPriceARS).toBe(17000);

      // Remove item
      act(() => {
        result.current.removeItem(addedItem.id);
      });
      expect(result.current.items.some((i) => i.id === addedItem.id)).toBe(false);
    });

    it("persists items to localStorage on state changes", () => {
      const { result } = renderHook(() => useCandidateWatchlist());

      act(() => {
        result.current.addItem({
          symbol: "MSFT",
          assetCategory: "cedear",
          targetEntryPriceARS: 50000,
          targetExitPriceARS: 65000,
          invalidationPriceARS: 45000,
          entryThesis: "Liderazgo en software de inteligencia artificial",
          invalidationCondition: "Desaceleración de crecimiento en Azure",
        });
      });

      const stored = localStorage.getItem("chess_candidate_watchlist");
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.some((i: any) => i.symbol === "MSFT")).toBe(true);
    });
  });

  describe("3. computeDiscipline Engine Stress Tests", () => {
    const rules: DisciplineRule[] = [
      { rule_type: "max_position_pct", rule_value: 20, enabled: true },
      { rule_type: "always_notes", rule_value: 1, enabled: true },
      { rule_type: "max_trade_size", rule_value: 1000, enabled: true },
      { rule_type: "min_diversification", rule_value: 2, enabled: true },
    ];

    it("handles zero trades cleanly (75% overall score due to diversification min threshold with 0 assets)", () => {
      const score = computeDiscipline([], rules);
      expect(score.overall).toBe(75);
      expect(score.violations.length).toBe(1); // 1 violation for min_diversification
    });

    it("correctly identifies position size violation", () => {
      const trades: Trade[] = ([
        {
          id: "t1",
          portfolio_id: "p1",
          user_id: "u1",
          symbol: "BTC",
          trade_type: "buy",
          quantity: 1,
          price_per_unit: 500,
          total_amount: 500,
          notes: "Buy thesis",
          trade_date: "2026-08-01",
          created_at: "",
        },
      ] satisfies Partial<Trade>[]).map(makeTrade);

      // Portfolio total value is 500. Trade 1 total is 500 (100% of portfolio). Limit is 20%.
      const score = computeDiscipline(trades, rules);
      const posRule = score.rules.find((r) => r.rule_type === "max_position_pct");
      expect(posRule?.violations_count).toBe(1);
      expect(score.violations.some((v) => v.rule_type === "max_position_pct")).toBe(true);
    });

    it("flags missing notes rule violations", () => {
      const trades: Trade[] = ([
        {
          id: "t1",
          portfolio_id: "p1",
          user_id: "u1",
          symbol: "AAPL",
          trade_type: "buy",
          quantity: 1,
          price_per_unit: 100,
          total_amount: 100,
          notes: "", // Empty notes!
          trade_date: "2026-08-01",
          created_at: "",
        },
      ] satisfies Partial<Trade>[]).map(makeTrade);

      const score = computeDiscipline(trades, rules);
      const notesRule = score.rules.find((r) => r.rule_type === "always_notes");
      expect(notesRule?.violations_count).toBe(1);
    });

    it("skips dividend trades when checking position size and trade size", () => {
      const trades: Trade[] = ([
        {
          id: "t_div",
          portfolio_id: "p1",
          user_id: "u1",
          symbol: "KO",
          trade_type: "dividend",
          quantity: 100,
          price_per_unit: 500, // $50,000 dividend!
          total_amount: 50000,
          notes: "Quarterly dividend payment",
          trade_date: "2026-08-01",
          created_at: "",
        },
      ] satisfies Partial<Trade>[]).map(makeTrade);

      const score = computeDiscipline(trades, rules);
      const posRule = score.rules.find((r) => r.rule_type === "max_position_pct");
      const sizeRule = score.rules.find((r) => r.rule_type === "max_trade_size");

      expect(posRule?.violations_count).toBe(0);
      expect(sizeRule?.violations_count).toBe(0);
    });

    it("ignores disabled rules in overall score calculation", () => {
      const disabledRules: DisciplineRule[] = [
        { rule_type: "max_position_pct", rule_value: 10, enabled: false },
        { rule_type: "always_notes", rule_value: 1, enabled: false },
        { rule_type: "max_trade_size", rule_value: 100, enabled: false },
        { rule_type: "min_diversification", rule_value: 5, enabled: false },
      ];

      const trades: Trade[] = ([
        {
          id: "t1",
          portfolio_id: "p1",
          user_id: "u1",
          symbol: "AAPL",
          trade_type: "buy",
          quantity: 1,
          price_per_unit: 10000,
          total_amount: 10000,
          notes: "",
          trade_date: "2026-08-01",
          created_at: "",
        },
      ] satisfies Partial<Trade>[]).map(makeTrade);

      const score = computeDiscipline(trades, disabledRules);
      expect(score.overall).toBe(100);
      expect(score.rules.every((r) => !r.enabled)).toBe(true);
    });
  });

  describe("4. Financial Math (useUnifiedFinancials dependencies) Stress Tests", () => {
    it("handles computeUnifiedNetWorth with empty inputs", () => {
      const emptyPerformance = {
        total_realized_pnl: 0,
        total_dividends: 0,
        total_return: 0,
        total_cost_basis: 0,
        win_rate: 0,
        winning_sells: 0,
        total_sells: 0,
        by_symbol: [],
      };
      const netWorth = computeUnifiedNetWorth([], [], [], emptyPerformance, new Map());
      expect(netWorth.netWorthUSD).toBe(0);
      expect(netWorth.liquidCashUSD).toBe(0);
      expect(netWorth.investmentRatePct).toBe(0);
    });

    it("handles buildPersonalSankeyData with inverted or invalid date filter ranges", () => {
      const transactions: Transaction[] = ([
        {
          id: "tx1",
          user_id: "u1",
          account_id: "a1",
          amount_usd: 50,
          type: "income",
          name: "Sueldo",
          transaction_date: "2026-08-01",
          created_at: "",
          updated_at: "",
        },
        {
          id: "tx2",
          user_id: "u1",
          account_id: "a1",
          amount_usd: 20,
          type: "expense",
          name: "Alquiler",
          transaction_date: "2026-08-05",
          created_at: "",
          updated_at: "",
        },
      ] satisfies Partial<Transaction>[]).map(makeTransaction);

      // Start date AFTER end date
      const invertedRange = { start: new Date("2026-08-30"), end: new Date("2026-08-01") };
      const sankeyData = buildPersonalSankeyData(transactions, [], invertedRange);
      
      expect(sankeyData.nodes).toBeDefined();
      expect(sankeyData.links).toBeDefined();
    });
  });

});
