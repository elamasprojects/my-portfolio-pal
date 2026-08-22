import { Transaction, SankeyData, SankeyNode, SankeyLink, UnifiedNetWorthMetrics, Category, PaymentMethod, FinancialAccount } from "@/types/finance";
import { Holding, PortfolioPerformance, Trade } from "@/hooks/usePortfolio";

export function parseTransactionLocalDate(dateStr: string): Date {
  if (!dateStr) return new Date();
  if (dateStr.includes("T")) return new Date(dateStr);
  const parts = dateStr.split("-").map(Number);
  if (parts.length === 3) {
    return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
  }
  return new Date(dateStr);
}

export function buildPersonalSankeyData(
  transactions: Transaction[],
  categories: Category[],
  filterRange?: { start?: Date; end?: Date }
): SankeyData {
  const filtered = transactions.filter((t) => {
    if (t.deleted_at) return false;
    const txDate = parseTransactionLocalDate(t.transaction_date);
    if (filterRange?.start && txDate < filterRange.start) return false;
    if (filterRange?.end && txDate > filterRange.end) return false;
    return true;
  });

  const catMap = new Map<string, Category>();
  for (const c of categories) catMap.set(c.id, c);

  const incomeByConcept = new Map<string, number>();
  const expenseByCategory = new Map<string, number>();

  let totalIncome = 0;
  let totalExpenses = 0;

  for (const t of filtered) {
    const amt = Number(t.amount_usd) || 0;
    if (amt <= 0) continue;

    if (t.type === "income") {
      const label = t.category_id && catMap.get(t.category_id)
        ? catMap.get(t.category_id)!.name
        : t.name || "Ingresos Varios";
      incomeByConcept.set(label, (incomeByConcept.get(label) || 0) + amt);
      totalIncome += amt;
    } else if (t.type === "expense" || t.type === "investment") {
      const label = t.category_id && catMap.get(t.category_id)
        ? catMap.get(t.category_id)!.name
        : "Otros Gastos";
      expenseByCategory.set(label, (expenseByCategory.get(label) || 0) + amt);
      totalExpenses += amt;
    }
  }

  // If no transactions yet, provide empty skeleton
  if (totalIncome === 0 && totalExpenses === 0) {
    return {
      nodes: [],
      links: [],
      totalIncome: 0,
      totalExpenses: 0,
      netResult: 0,
      savingsRatePct: 0,
    };
  }

  const nodes: SankeyNode[] = [];
  const links: SankeyLink[] = [];

  const spineId = "cash_collected";
  const effectiveSpineValue = Math.max(totalIncome, totalExpenses);

  // Center Spine
  nodes.push({
    id: spineId,
    name: "CASH COLLECTED",
    category: "spine",
    value: effectiveSpineValue,
    color: "#f8fafc",
    pct: 100,
  });

  // Left side: Income Sources (Green/Emerald)
  for (const [name, val] of incomeByConcept.entries()) {
    const id = `inc_${name.toLowerCase().replace(/\s+/g, "_")}`;
    const pct = totalIncome > 0 ? (val / totalIncome) * 100 : 0;
    nodes.push({
      id,
      name,
      category: "income",
      value: val,
      color: "#10b981",
      pct: Math.round(pct * 10) / 10,
    });
    links.push({
      source: id,
      target: spineId,
      value: val,
      color: "#10b981",
    });
  }

  // If income < expenses, balance with savings draw
  if (totalIncome < totalExpenses) {
    const deficit = totalExpenses - totalIncome;
    nodes.push({
      id: "inc_savings_draw",
      name: "Uso de Ahorros Previos",
      category: "income",
      value: deficit,
      color: "#64748b",
      pct: Math.round((deficit / totalExpenses) * 100 * 10) / 10,
    });
    links.push({
      source: "inc_savings_draw",
      target: spineId,
      value: deficit,
      color: "#64748b",
    });
  }

  // Right side: Expenses (Red/Coral)
  for (const [name, val] of expenseByCategory.entries()) {
    const id = `exp_${name.toLowerCase().replace(/\s+/g, "_")}`;
    const pct = effectiveSpineValue > 0 ? (val / effectiveSpineValue) * 100 : 0;
    nodes.push({
      id,
      name,
      category: "expense",
      value: val,
      color: "#f43f5e",
      pct: Math.round(pct * 10) / 10,
    });
    links.push({
      source: spineId,
      target: id,
      value: val,
      color: "#f43f5e",
    });
  }

  // Bottom Right: Net Result / Savings & Investment (Violet/Purple)
  const netResult = Math.max(0, totalIncome - totalExpenses);
  if (netResult > 0) {
    const netId = "net_savings";
    const pct = effectiveSpineValue > 0 ? (netResult / effectiveSpineValue) * 100 : 0;
    nodes.push({
      id: netId,
      name: "Resultado Neto (Ahorro & Inversión)",
      category: "net",
      value: netResult,
      color: "#a855f7",
      pct: Math.round(pct * 10) / 10,
    });
    links.push({
      source: spineId,
      target: netId,
      value: netResult,
      color: "#a855f7",
    });
  }

  const savingsRatePct = totalIncome > 0 ? Math.max(0, (netResult / totalIncome) * 100) : 0;

  return {
    nodes,
    links,
    totalIncome,
    totalExpenses,
    netResult,
    savingsRatePct: Math.round(savingsRatePct * 10) / 10,
  };
}

export function computeUnifiedNetWorth(
  financialAccounts: FinancialAccount[],
  transactions: Transaction[],
  holdings: Holding[],
  portfolioPerformance: PortfolioPerformance,
  prices: Map<string, number>,
  trades?: Pick<Trade, "trade_type" | "trade_date" | "created_at" | "total_amount" | "price_per_unit" | "quantity">[],
  /** ARS per USD, for accounts denominated in pesos. Omitted, those accounts are skipped. */
  arsPerUsd = 0
): UnifiedNetWorthMetrics {
  let liquidCashUSD = 0;
  let brokerCashUSD = 0;

  for (const acc of financialAccounts) {
    if (!acc.is_active) continue;

    // An ARS account holds pesos. Summing its balance straight into a USD total counted, for
    // example, AR$1.580.294 of broker cash as US$1.580.294. With no rate available the account
    // is skipped rather than counted at face value.
    const raw = Number(acc.current_balance) || 0;
    let bal = raw;
    if (acc.currency === "ARS") {
      if (!(arsPerUsd > 0)) continue;
      bal = raw / arsPerUsd;
    }

    if (acc.type === "broker_cash") {
      brokerCashUSD += bal;
    } else {
      // A negative balance is money owed and has to pull net worth down. Clamping it to zero
      // made an overdrawn account silently disappear from the total.
      liquidCashUSD += bal;
    }
  }

  let portfolioMarketValueUSD = 0;
  for (const h of holdings) {
    const p = prices.get(h.symbol.toUpperCase());
    portfolioMarketValueUSD += p ? p * h.net_quantity : h.total_invested;
  }

  // Uninvested broker cash comes from the `financial_accounts` balances above, which are
  // the authoritative, user-maintained figures. Deriving a second estimate from the trade
  // ledger and adding it here counted the same pesos twice, and the running total it used
  // clamped at zero on every buy-before-sell sequence, so it overstated cash on top of that.
  const netWorthUSD = liquidCashUSD + brokerCashUSD + portfolioMarketValueUSD;

  // Monthly flow (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  let monthlyIncomeUSD = 0;
  let monthlyExpensesUSD = 0;
  let monthlyBrokerInflowUSD = 0;
  let investmentTransactionsUSD = 0;
  let buyTradesUSD = 0;

  for (const t of transactions) {
    if (t.deleted_at) continue;
    const txDate = parseTransactionLocalDate(t.transaction_date);
    if (txDate < thirtyDaysAgo) continue;

    const amt = Number(t.amount_usd) || 0;
    if (t.type === "income") monthlyIncomeUSD += amt;
    else if (t.type === "expense") monthlyExpensesUSD += amt;
    else if (t.type === "investment") investmentTransactionsUSD += amt;
  }

  // Buys and `investment` transactions describe the same money from two sides: the transfer
  // into the broker and the purchase it funded. Adding both counted every peso twice. The
  // executed buys are the stronger record of capital actually deployed, so they win when
  // present and the transaction total stands in only when no buy was captured.
  if (trades && Array.isArray(trades)) {
    for (const tr of trades) {
      if (tr.trade_type === "buy") {
        const trDate = parseTransactionLocalDate(tr.trade_date || tr.created_at);
        if (trDate >= thirtyDaysAgo) {
          const amt = Number(tr.total_amount) || Number(tr.price_per_unit) * Number(tr.quantity) || 0;
          buyTradesUSD += amt;
        }
      }
    }
  }

  monthlyBrokerInflowUSD = buyTradesUSD > 0 ? buyTradesUSD : investmentTransactionsUSD;

  const monthlySavingsUSD = Math.max(0, monthlyIncomeUSD - monthlyExpensesUSD);
  // Money saved is not money invested. Falling back to savings here reported an investment
  // rate for a month in which nothing was bought — the one number this metric exists to catch.
  const effectiveCapitalInvertedUSD = monthlyBrokerInflowUSD;
  const savingsRatePct = monthlyIncomeUSD > 0 ? (monthlySavingsUSD / monthlyIncomeUSD) * 100 : 0;
  const investmentRatePct = monthlyIncomeUSD > 0 ? (effectiveCapitalInvertedUSD / monthlyIncomeUSD) * 100 : 0;
  const monthlyBurnRateUSD = Math.max(1, monthlyExpensesUSD);
  const liquidRunwayMonths = liquidCashUSD / monthlyBurnRateUSD;
  const totalRunwayMonths = (liquidCashUSD + brokerCashUSD + portfolioMarketValueUSD) / monthlyBurnRateUSD;

  return {
    liquidCashUSD,
    brokerCashUSD,
    portfolioMarketValueUSD,
    totalDebtsUSD: 0,
    netWorthUSD,
    monthlyIncomeUSD,
    monthlyExpensesUSD,
    monthlySavingsUSD,
    monthlyBrokerInflowUSD: effectiveCapitalInvertedUSD,
    savingsRatePct: Math.round(savingsRatePct * 10) / 10,
    investmentRatePct: Math.round(investmentRatePct * 10) / 10,
    monthlyBurnRateUSD,
    liquidRunwayMonths: Math.round(liquidRunwayMonths * 10) / 10,
    totalRunwayMonths: Math.round(totalRunwayMonths * 10) / 10,
  };
}
