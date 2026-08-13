-- ==============================================================================
-- MIGRATION: SEPARATE FINANCIAL ACCOUNTS AND PAYMENT METHODS
-- ==============================================================================

-- 1. Create financial_accounts table
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'digital_wallet', -- 'bank', 'digital_wallet', 'crypto', 'broker_cash', 'cash_wallet'
  currency TEXT NOT NULL DEFAULT 'USD',
  color TEXT DEFAULT '#10b981',
  icon TEXT DEFAULT 'Wallet',
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index and RLS for financial_accounts
CREATE INDEX IF NOT EXISTS idx_financial_accounts_user ON public.financial_accounts(user_id);
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own financial accounts" ON public.financial_accounts;
CREATE POLICY "Users can manage own financial accounts"
  ON public.financial_accounts FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Add account_id and instrument_type to payment_methods
ALTER TABLE public.payment_methods 
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS instrument_type TEXT DEFAULT 'card_debit';

-- 3. Add account_id to transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_account ON public.payment_methods(account_id);

-- 4. Function & Trigger to sync Financial Account Balances
CREATE OR REPLACE FUNCTION public.sync_financial_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  v_source_acc_id UUID;
  v_dest_acc_id UUID;
BEGIN
  -- Determine source account from transaction account_id or payment_method account_id
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL THEN
      v_source_acc_id := OLD.account_id;
      IF v_source_acc_id IS NULL AND OLD.payment_method_id IS NOT NULL THEN
        SELECT account_id INTO v_source_acc_id FROM public.payment_methods WHERE id = OLD.payment_method_id;
      END IF;

      IF OLD.type = 'income' AND v_source_acc_id IS NOT NULL THEN
        UPDATE public.financial_accounts SET current_balance = current_balance - OLD.amount_usd WHERE id = v_source_acc_id;
      ELSIF (OLD.type = 'expense' OR OLD.type = 'investment') AND v_source_acc_id IS NOT NULL THEN
        UPDATE public.financial_accounts SET current_balance = current_balance + OLD.amount_usd WHERE id = v_source_acc_id;
      ELSIF OLD.type = 'transfer' THEN
        IF v_source_acc_id IS NOT NULL THEN
          UPDATE public.financial_accounts SET current_balance = current_balance + OLD.amount_usd WHERE id = v_source_acc_id;
        END IF;
        IF OLD.destination_account_id IS NOT NULL THEN
          UPDATE public.financial_accounts SET current_balance = current_balance - OLD.amount_usd WHERE id = OLD.destination_account_id;
        END IF;
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.deleted_at IS NULL THEN
      v_source_acc_id := NEW.account_id;
      IF v_source_acc_id IS NULL AND NEW.payment_method_id IS NOT NULL THEN
        SELECT account_id INTO v_source_acc_id FROM public.payment_methods WHERE id = NEW.payment_method_id;
      END IF;

      IF NEW.type = 'income' AND v_source_acc_id IS NOT NULL THEN
        UPDATE public.financial_accounts SET current_balance = current_balance + NEW.amount_usd WHERE id = v_source_acc_id;
      ELSIF (NEW.type = 'expense' OR NEW.type = 'investment') AND v_source_acc_id IS NOT NULL THEN
        UPDATE public.financial_accounts SET current_balance = current_balance - NEW.amount_usd WHERE id = v_source_acc_id;
      ELSIF NEW.type = 'transfer' THEN
        IF v_source_acc_id IS NOT NULL THEN
          UPDATE public.financial_accounts SET current_balance = current_balance - NEW.amount_usd WHERE id = v_source_acc_id;
        END IF;
        IF NEW.destination_account_id IS NOT NULL THEN
          UPDATE public.financial_accounts SET current_balance = current_balance + NEW.amount_usd WHERE id = NEW.destination_account_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_financial_account_balance ON public.transactions;
CREATE TRIGGER trg_sync_financial_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.sync_financial_account_balance();
