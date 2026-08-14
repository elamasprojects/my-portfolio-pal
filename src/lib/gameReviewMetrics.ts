/**
 * Aggregate Audit Metrics Engine
 * Project: Chess (Milestone M4 / Requirement R2)
 */

import { ClosedTradeAuditInput, CounterfactualMetrics, AggregateAuditMetrics } from "@/types/gameReview";

/**
 * Resolves the asset category for a given trade symbol.
 */
export function resolveAssetCategory(symbol: string, declaredCategory?: string): string {
  if (declaredCategory) {
    const trimmed = declaredCategory.trim();
    const lower = trimmed.toLowerCase();
    if (lower === "crypto") return "Crypto";
    if (lower === "bonds" || lower === "bonos") return "Bonds";
    if (lower === "acciones local" || lower === "acciones") return "Acciones Local";
    if (lower === "cedears" || lower === "cedear") return "CEDEARs";
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }

  let sym = symbol.toUpperCase().trim();
  sym = sym.replace(/\.BA$/, "");

  if (
    sym.startsWith("BTC") ||
    sym.startsWith("ETH") ||
    sym.startsWith("SOL") ||
    sym.startsWith("USDT") ||
    sym.startsWith("ADA") ||
    sym.startsWith("DOT")
  ) {
    return "Crypto";
  }

  let baseSym = sym;
  if ((baseSym.length === 5 || baseSym.length === 4) && (baseSym.endsWith("D") || baseSym.endsWith("C"))) {
    const stem = baseSym.slice(0, -1);
    if (["GGAL", "YPF", "PAMP", "BMA", "SUPV", "TECO2", "VALO", "CEPU", "COME", "EDN", "TGSU2", "AL30", "GD30"].includes(stem)) {
      baseSym = stem;
    }
  }

  if (
    baseSym.startsWith("AL30") ||
    baseSym.startsWith("GD30") ||
    baseSym.startsWith("TV24") ||
    baseSym.startsWith("T2X4") ||
    baseSym.startsWith("BONOS") ||
    baseSym.startsWith("AE38")
  ) {
    return "Bonds";
  }

  if (
    [
      "GGAL",
      "YPF",
      "PAMP",
      "BMA",
      "SUPV",
      "TECO2",
      "VALO",
      "CEPU",
      "COME",
      "EDN",
      "TGSU2",
      "ALUAR",
      "TXAR",
    ].includes(baseSym)
  ) {
    return "Acciones Local";
  }

  return "CEDEARs";
}

/**
 * Calculates aggregate audit metrics (blunder rate %, total net cost USD, category edge summary)
 * across a collection of closed trades and their counterfactual audits.
 */
export function calculateAggregateMetricsFromAudits(
  trades: ClosedTradeAuditInput[],
  audits: CounterfactualMetrics[]
): AggregateAuditMetrics {
  if (!trades || trades.length === 0 || !audits || audits.length === 0) {
    return {
      totalClosedTrades: 0,
      blunderCount: 0,
      blunderRatePercent: 0.0,
      totalNetCostUSD: 0.0,
      categoryEdgeUSD: {},
    };
  }

  let blunderCount = 0;
  let totalNetCostUSD = 0.0;
  const categoryEdgeUSD: Record<string, number> = {};

  for (let i = 0; i < trades.length; i++) {
    const trade = trades[i];
    const audit = audits[i];

    if (audit.outcomeClassification === "Blunder") {
      blunderCount++;
    }

    totalNetCostUSD += audit.netCostOfTradingUSD;

    const cat = resolveAssetCategory(trade.symbol, trade.assetCategory);

    // Compute genuine Category Edge USD (delta between actual return ARS and doNothing return ARS, converted to USD via CCL rate)
    const splitFactor = trade.splitFactor || 1.0;
    const adjQuantity = trade.quantity * splitFactor;
    const adjBuyPrice = trade.buyPriceARS / splitFactor;
    const actualReturnARS = (trade.sellPriceARS - adjBuyPrice) * adjQuantity;
    const edgeARS = actualReturnARS - audit.doNothingReturnARS;
    const cclRate = trade.cclReturnPct && trade.cclReturnPct > 0 ? trade.cclReturnPct : 1000.0;
    const edgeUSD = edgeARS / cclRate;

    categoryEdgeUSD[cat] = Math.round(((categoryEdgeUSD[cat] || 0) + edgeUSD) * 100) / 100;
  }

  const totalClosedTrades = trades.length;
  const blunderRatePercent =
    totalClosedTrades > 0 ? Math.round((blunderCount / totalClosedTrades) * 1000) / 10 : 0.0;

  return {
    totalClosedTrades,
    blunderCount,
    blunderRatePercent,
    totalNetCostUSD: Math.round(totalNetCostUSD * 100) / 100,
    categoryEdgeUSD,
  };
}
