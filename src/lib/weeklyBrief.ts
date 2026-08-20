/**
 * Sunday Weekly Intelligence Digest Generator
 * Project: Chess (Requirement R5)
 */

export interface WeeklyBriefResult {
  performance7dPct: number;
  performanceMTDPct: number;
  thesisAlerts: Array<{
    symbol: string;
    type: "target_met" | "invalidation_hit" | "near_target";
    message: string;
  }>;
  abnormalExpenses: Array<{
    category: string;
    amountARS: number;
    deviationPct: number;
  }>;
  conversionRatePct: number;
  aiAuditQuestion: string;
}

/**
 * Computes Sunday intelligence digest for portfolio metrics, alerts, anomalies, and AI coaching question.
 */
export async function generateWeeklyBrief(
  tradeHistory: any[] = [],
  transactions: any[] = [],
  currentPrices: Record<string, number> = {}
): Promise<WeeklyBriefResult> {
  // 1. AI Auditing Question based on trade habits
  const hasBlunders = tradeHistory.some(
    (t) => t.is_planned_exit === false || Boolean(t.unplanned_rationale)
  );

  let aiAuditQuestion =
    "What key macro or fundamental metrics influenced your performance this week?";

  if (hasBlunders) {
    aiAuditQuestion =
      "You exited positions early before target without hitting invalidation. What invalidation rule failed?";
  } else if (tradeHistory.length === 0 && transactions.length === 0) {
    aiAuditQuestion =
      "No financial transactions recorded this week. Review candidate watchlist for potential entry triggers.";
  } else if (tradeHistory.length === 0) {
    aiAuditQuestion =
      "No trades were logged this week. Were market entry conditions unmet according to your strategy rules?";
  }

  // 2. Dynamic Thesis Proximity Alerts
  const thesisAlerts: WeeklyBriefResult["thesisAlerts"] = [];

  for (const trade of tradeHistory) {
    const symbol = trade.symbol || "ASSET";
    const targetPrice = Number(trade.target_price_usd || trade.targetPriceUSD || 0);
    const invalidationPrice = Number(trade.invalidation_price_usd || trade.invalidationPriceUSD || 0);
    const invalidationCond = trade.invalidation_condition || trade.invalidationCondition || "";
    const currentPrice =
      currentPrices[symbol] ||
      Number(trade.sell_price_ars || trade.sellPriceARS || trade.current_price_ars || trade.buy_price_ars || 0);

    if (targetPrice > 0 && currentPrice >= targetPrice) {
      thesisAlerts.push({
        symbol,
        type: "target_met",
        message: `${symbol} reached target price of US$${targetPrice}`,
      });
    } else if (targetPrice > 0 && currentPrice >= targetPrice * 0.95) {
      thesisAlerts.push({
        symbol,
        type: "near_target",
        message: `${symbol} is within 5% of target price (US$${targetPrice})`,
      });
    } else if (invalidationPrice > 0 && currentPrice <= invalidationPrice) {
      thesisAlerts.push({
        symbol,
        type: "invalidation_hit",
        message: `${symbol} hit invalidation condition: ${invalidationCond || "stop loss level"}`,
      });
    }
  }

  // No placeholder alert when there is nothing to report. A brief that invents an AAPL target
  // hit is worse than an empty one: it is the brief the user is meant to act on.

  // 3. Abnormal Expense Deviations (>1.5x of 4-week average)
  const abnormalExpenses: WeeklyBriefResult["abnormalExpenses"] = [];
  if (transactions && transactions.length > 0) {
    const expenseMap: Record<string, { recent: number; history: number[]; total: number; count: number }> = {};
    for (const tx of transactions) {
      if (tx.type === "expense" || tx.category) {
        const cat = tx.category || "Otros";
        const amt = Number(tx.amount || tx.amountARS || 0);
        if (!expenseMap[cat]) {
          expenseMap[cat] = { recent: 0, history: [], total: 0, count: 0 };
        }
        expenseMap[cat].total += amt;
        expenseMap[cat].count += 1;
        expenseMap[cat].recent = amt;
      }
    }
    for (const [cat, data] of Object.entries(expenseMap)) {
      const avg = data.count > 1 ? (data.total - data.recent) / (data.count - 1) : data.recent;
      if (avg > 0 && data.recent > 1.5 * avg) {
        const deviationPct = Math.round(((data.recent - avg) / avg) * 100);
        abnormalExpenses.push({
          category: cat,
          amountARS: data.recent,
          deviationPct,
        });
      }
    }
  }

  // 4. Performance (7d / MTD) Computation
  let performance7dPct = 0.0;
  let performanceMTDPct = 0.0;

  // Each window is measured over the trades that actually fall inside it. The MTD figure used
  // to be `7d * 2.4` — a multiplier nobody measured — and both fell back to hardcoded 3.4% /
  // 8.2% whenever cost basis was zero.
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const returnOver = (since: Date): number => {
    let totalGainARS = 0;
    let totalCostARS = 0;
    for (const t of tradeHistory) {
      const rawDate = t.sellDate || t.sell_date || t.trade_date || t.created_at;
      if (rawDate) {
        const tradeDate = new Date(rawDate);
        if (Number.isFinite(tradeDate.getTime()) && tradeDate < since) continue;
      }
      const buyPrice = Number(t.buy_price_ars || 0);
      const sellPrice = Number(t.sell_price_ars || t.buy_price_ars || 0);
      const qty = Number(t.quantity || 1);
      totalCostARS += buyPrice * qty;
      totalGainARS += (sellPrice - buyPrice) * qty;
    }
    // No cost basis in the window means no measurable return, not a default one.
    if (totalCostARS <= 0) return 0;
    return Number(((totalGainARS / totalCostARS) * 100).toFixed(1));
  };

  if (tradeHistory.length > 0) {
    performance7dPct = returnOver(sevenDaysAgo);
    performanceMTDPct = returnOver(monthStart);
  }

  // 5. Monthly Capital Conversion Rate (% of income allocated to assets)
  // 0 until income is recorded: an invented 42.5% conversion rate reads as a measured one.
  let conversionRatePct = 0;
  if (transactions.length > 0) {
    let incomeTotal = 0;
    let investmentTotal = 0;
    for (const tx of transactions) {
      const amt = Number(tx.amount || tx.amountARS || 0);
      if (tx.type === "income") {
        incomeTotal += amt;
      } else if (tx.type === "buy" || tx.type === "investment") {
        investmentTotal += amt;
      }
    }
    if (incomeTotal > 0) {
      conversionRatePct = Number(((investmentTotal / incomeTotal) * 100).toFixed(1));
    }
  }

  return {
    performance7dPct,
    performanceMTDPct,
    thesisAlerts,
    abnormalExpenses,
    conversionRatePct,
    aiAuditQuestion,
  };
}
