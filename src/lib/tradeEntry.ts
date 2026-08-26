/**
 * Builds the `trades` row for a manually captured buy, sell or dividend.
 *
 * Kept pure and separate from the mutation so the field mapping — currency normalisation,
 * dividend shape, and the generated-column rule — is testable without a database.
 */

export interface TradeEntryInput {
  tradeType: "buy" | "sell" | "dividend";
  symbol: string;
  assetName?: string;
  assetType?: string;
  /** Ignored for dividends, which are recorded as a single cash event. */
  quantity?: number;
  /** Unit price for buy/sell, or the total cash received for a dividend. */
  price: number;
  currency?: "USD" | "ARS";
  /** Required when currency is ARS: the rate the amounts were entered at. */
  mepRate?: number | null;
  tradeDate?: string;
  brokerId?: string | null;
  notes?: string | null;
  /** Pre-trade thesis (R4). Mandatory on buys — enforced by the capture form. */
  entryThesis?: string | null;
  /**
   * Exit target, entered in the same currency as `price`. Normalised to USD on the way in, so
   * the stored level is always comparable against a live quote.
   */
  targetPrice?: number | null;
  invalidationCondition?: string | null;
  /** Optional numeric stop level, entered in the same currency as `price`. */
  invalidationPrice?: number | null;
  /**
   * Friction inversion (R4), for sells. True only when the exit was taken against a declared
   * thesis level. Recorded at the point of sale because it cannot be reconstructed later.
   */
  isPlannedExit?: boolean;
  /** Written justification, required by the friction rules for an unplanned exit. */
  unplannedRationale?: string | null;
}

export interface TradeEntryContext {
  userId: string;
  portfolioId: string;
  /** Injectable for deterministic tests. */
  now?: Date;
}

export function buildTradeRow(input: TradeEntryInput, ctx: TradeEntryContext) {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) throw new Error("Symbol is required");

  const isDividend = input.tradeType === "dividend";
  const isARS = input.currency === "ARS" && !!input.mepRate && input.mepRate > 0;
  const mepRate = isARS ? (input.mepRate as number) : null;

  // A dividend is a single cash event: quantity 1 so the generated `total_amount`
  // (quantity * price_per_unit) equals the cash received.
  const quantity = isDividend ? 1 : Number(input.quantity);
  const enteredPrice = Number(input.price);

  if (!Number.isFinite(enteredPrice) || enteredPrice <= 0) {
    throw new Error(
      isDividend ? "Dividend amount must be greater than 0" : "Price must be greater than 0"
    );
  }
  if (!isDividend && (!Number.isFinite(quantity) || quantity <= 0)) {
    throw new Error("Quantity must be greater than 0");
  }
  if (input.currency === "ARS" && !isARS) {
    throw new Error("An ARS amount needs a MEP rate to convert with");
  }

  // price_per_unit is stored normalised to USD across this codebase; original_price and
  // mep_rate preserve exactly what the user typed.
  const pricePerUnit = isARS ? enteredPrice / (mepRate as number) : enteredPrice;

  // The thesis levels are entered in the same currency as the price, so they follow the same
  // normalisation. Storing them unconverted is what made a US$300 target read as AR$300 and
  // fire "target reached" the moment the position was opened.
  const toUSD = (value?: number | null): number | null => {
    if (value === null || value === undefined) return null;
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric <= 0) return null;
    return isARS ? numeric / (mepRate as number) : numeric;
  };

  // NOTE: `total_amount` is a GENERATED column and must never appear here.
  return {
    portfolio_id: ctx.portfolioId,
    user_id: ctx.userId,
    symbol,
    asset_name: (input.assetName || symbol).trim(),
    asset_type: input.assetType || "stock",
    trade_type: input.tradeType,
    quantity,
    price_per_unit: pricePerUnit,
    trade_date: input.tradeDate
      ? new Date(input.tradeDate).toISOString()
      : (ctx.now ?? new Date()).toISOString(),
    original_currency: isARS ? "ARS" : "USD",
    original_price: isARS ? enteredPrice : null,
    mep_rate: mepRate,
    broker_id: input.brokerId || null,
    notes: input.notes || null,
    commission_pct: 0,
    commission_amount: 0,
    entry_thesis: input.entryThesis || null,
    target_price_usd: toUSD(input.targetPrice),
    invalidation_condition: input.invalidationCondition || null,
    invalidation_price_usd: toUSD(input.invalidationPrice),
    is_planned_exit: input.tradeType === "sell" ? Boolean(input.isPlannedExit) : false,
    unplanned_rationale:
      input.tradeType === "sell" && !input.isPlannedExit
        ? input.unplannedRationale || null
        : null,
  };
}
