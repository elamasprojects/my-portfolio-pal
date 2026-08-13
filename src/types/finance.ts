export type TransactionType = "income" | "expense" | "transfer" | "investment";
export type CurrencyCode = "USD" | "ARS" | "EUR" | "BRL" | "MULTI";
export type ConfidenceLevel = "high" | "medium" | "low";
export type IngestionSource =
  | "screenshot"
  | "text"
  | "batch_paste"
  | "share_target"
  | "voice"
  | "manual"
  | "migrated";

export type AccountType = "bank" | "digital_wallet" | "crypto" | "broker_cash" | "cash_wallet";
export type InstrumentType = "card_debit" | "card_credit" | "pix" | "qr" | "cash" | "transfer";

export interface FinancialAccount {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: CurrencyCode;
  color?: string;
  icon?: string;
  aliases?: string[];
  detection_patterns?: string[];
  initial_balance: number;
  current_balance: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface PaymentMethod {
  id: string;
  user_id: string;
  account_id?: string | null;
  name: string;
  type: "bank" | "digital_wallet" | "card" | "broker_cash" | "crypto" | "cash";
  instrument_type?: InstrumentType;
  currency: CurrencyCode;
  color?: string;
  icon?: string;
  aliases: string[];
  detection_patterns: string[];
  is_active: boolean;
  broker_id?: string | null;
  initial_balance?: number;
  current_balance?: number;
  created_at: string;
  updated_at?: string;

  // Joined relation
  account?: FinancialAccount | null;
}

export interface Category {
  id: string;
  user_id?: string | null;
  name: string;
  type: "income" | "expense" | "both" | "investment";
  color: string;
  icon: string;
  aliases: string[];
  keywords: string[];
  sort_order: number;
  archived: boolean;
  is_system: boolean;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  name: string;
  raw_merchant?: string | null;
  amount_usd: number;
  transaction_date: string;
  category_id?: string | null;
  payment_method_id?: string | null;
  account_id?: string | null;
  destination_account_id?: string | null;

  // Multi-Currency & FX
  original_amount?: number | null;
  original_currency?: CurrencyCode | null;
  fx_rate?: number | null;
  fx_source?: string | null;
  fx_timestamp?: string | null;

  // Ingestion & Confidence
  source: IngestionSource;
  receipt_url?: string | null;
  notes?: string | null;
  confidence: ConfidenceLevel;
  needs_review: boolean;
  extracted_fields?: Record<string, any>;

  // Split Group
  is_split?: boolean;
  split_group_id?: string | null;
  split_total_amount?: number | null;
  split_my_share_pct?: number | null;

  // Investment Integration
  portfolio_id?: string | null;
  trade_id?: string | null;

  created_at: string;
  updated_at?: string;
  deleted_at?: string | null;

  // Joined fields for UI convenience
  category?: Category | null;
  payment_method?: PaymentMethod | null;
  account?: FinancialAccount | null;
}

export interface FxRateCacheItem {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  source: string;
  valid_for_date: string;
  fetched_at: string;
}

export interface CategorizationFeedback {
  id: string;
  user_id: string;
  raw_merchant: string;
  cleaned_merchant: string;
  assigned_category_id: string;
  was_corrected: boolean;
  confidence_score?: number | null;
  created_at: string;
}

// Sankey Diagram Data Structures
export interface SankeyNode {
  id: string;
  name: string;
  category: "income" | "spine" | "expense" | "net";
  value: number;
  color?: string;
  pct?: number;
}

export interface SankeyLink {
  source: string;
  target: string;
  value: number;
  color?: string;
}

export interface SankeyData {
  nodes: SankeyNode[];
  links: SankeyLink[];
  totalIncome: number;
  totalExpenses: number;
  netResult: number;
  savingsRatePct: number;
}

// Consolidated Financial Metrics
export interface UnifiedNetWorthMetrics {
  liquidCashUSD: number;
  brokerCashUSD: number;
  portfolioMarketValueUSD: number;
  totalDebtsUSD: number;
  netWorthUSD: number;
  monthlyIncomeUSD: number;
  monthlyExpensesUSD: number;
  monthlySavingsUSD: number;
  monthlyBrokerInflowUSD: number;
  savingsRatePct: number;
  investmentRatePct: number;
  monthlyBurnRateUSD: number;
  liquidRunwayMonths: number;
  totalRunwayMonths: number;
}
