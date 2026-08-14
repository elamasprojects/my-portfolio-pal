import { Transaction, Category } from "@/types/finance";
import { Trade } from "@/hooks/usePortfolio";

export type UnifiedEventType = "expense" | "income" | "buy" | "sell" | "dividend" | "transfer" | "investment";

export interface UnifiedEventItem {
  id: string; // `tx_${t.id}` or `trade_${t.id}`
  sourceTable: "transactions" | "trades";
  rawId: string;
  date: string; // ISO date string (YYYY-MM-DD)
  type: UnifiedEventType;
  title: string;
  subtitle?: string;
  amountUSD: number;
  originalAmount?: number;
  originalCurrency?: string;
  needsReview: boolean;
  confidence?: "high" | "medium" | "low";
  categoryName?: string;
  categoryColor?: string;
  symbol?: string;
  rawRecord: Transaction | Trade;
}

export function normalizeToUnifiedEvents(
  transactions: Transaction[] = [],
  trades: Trade[] = [],
  categoriesMap: Map<string, Category> = new Map()
): UnifiedEventItem[] {
  const txItems: UnifiedEventItem[] = transactions
    .filter((t) => !t.deleted_at)
    .map((t) => {
      const category = t.category_id ? categoriesMap.get(t.category_id) : t.category;
      return {
        id: `tx_${t.id}`,
        sourceTable: "transactions",
        rawId: t.id,
        date: t.transaction_date,
        type: (t.type as UnifiedEventType) || "expense",
        title: t.name || "Sin título",
        subtitle: category?.name || (t.type === "income" ? "Ingreso" : "Gasto"),
        amountUSD: Number(t.amount_usd || 0),
        originalAmount: t.original_amount ? Number(t.original_amount) : undefined,
        originalCurrency: t.original_currency || "USD",
        needsReview: !!t.needs_review,
        confidence: t.confidence,
        categoryName: category?.name,
        categoryColor: category?.color,
        rawRecord: t,
      };
    });

  const tradeItems: UnifiedEventItem[] = trades.map((t) => ({
    id: `trade_${t.id}`,
    sourceTable: "trades",
    rawId: t.id,
    date: t.trade_date,
    type: (t.trade_type as UnifiedEventType) || "buy",
    title: `${t.trade_type.toUpperCase()} ${t.symbol}`,
    subtitle: `${t.asset_name || t.symbol} • ${(t.asset_type || "asset").toUpperCase()}`,
    amountUSD: Number(t.total_amount || 0),
    originalAmount: t.original_price ? Number(t.original_price * (t.quantity || 1)) : undefined,
    originalCurrency: t.original_currency || "USD",
    needsReview: false,
    symbol: t.symbol,
    rawRecord: t,
  }));

  return [...txItems, ...tradeItems].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}
