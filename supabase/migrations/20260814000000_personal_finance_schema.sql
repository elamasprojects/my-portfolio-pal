-- ============================================================================
-- PERSONAL FINANCE SCHEMA & SEED DATA MIGRATION
-- ============================================================================

-- 1. PAYMENT METHODS / CUENTAS FINANCIERAS
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                             -- 'DolarApp Global Card', 'Mercado Pago', 'Bank ARS'
  type TEXT NOT NULL DEFAULT 'digital_wallet',    -- 'bank', 'digital_wallet', 'card', 'broker_cash', 'crypto', 'cash'
  currency TEXT NOT NULL DEFAULT 'USD',           -- 'ARS', 'USD', 'EUR', 'MULTI'
  color TEXT DEFAULT '#10b981',
  icon TEXT DEFAULT 'Wallet',
  aliases TEXT[] DEFAULT '{}',
  detection_patterns TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  broker_id UUID REFERENCES public.brokers(id) ON DELETE SET NULL,
  initial_balance NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own payment methods"
  ON public.payment_methods FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_user ON public.payment_methods(user_id, is_active);

-- 2. CATEGORÍAS DE GASTOS / INGRESOS (PERSONALES)
CREATE TABLE IF NOT EXISTS public.pf_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL = Categoría del sistema
  name TEXT NOT NULL,                             -- 'Food', 'House', 'Travel', 'Salidas', 'Tech'
  type TEXT NOT NULL DEFAULT 'expense',           -- 'income', 'expense', 'both', 'investment'
  color TEXT DEFAULT '#3b82f6',
  icon TEXT DEFAULT 'Tag',
  aliases TEXT[] DEFAULT '{}',
  keywords TEXT[] DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  archived BOOLEAN NOT NULL DEFAULT false,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pf_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view system and own categories"
  ON public.pf_categories FOR SELECT TO authenticated
  USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can create own categories"
  ON public.pf_categories FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can update own categories"
  ON public.pf_categories FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND is_system = false)
  WITH CHECK (auth.uid() = user_id AND is_system = false);

CREATE POLICY "Users can delete own categories"
  ON public.pf_categories FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND is_system = false);

CREATE INDEX IF NOT EXISTS idx_pf_categories_user ON public.pf_categories(user_id, type);

-- 3. LIBRO MAYOR DE TRANSACCIONES (TRANSACTIONS LEDGER)
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'expense',           -- 'income', 'expense', 'transfer', 'investment'
  name TEXT NOT NULL,                             -- Nombre limpio: 'Coto', 'Lidl', 'Pago UGC Studio'
  raw_merchant TEXT,
  amount_usd NUMERIC(12,2) NOT NULL,              -- Moneda base USD
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  category_id UUID REFERENCES public.pf_categories(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES public.payment_methods(id) ON DELETE RESTRICT,
  destination_account_id UUID REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  
  -- Multi-Moneda y Trazabilidad FX
  original_amount NUMERIC(14,2),
  original_currency TEXT,                         -- 'ARS', 'EUR', 'USD', 'BRL'
  fx_rate NUMERIC(12,6),
  fx_source TEXT,
  fx_timestamp TIMESTAMPTZ,
  
  -- Ingesta y Confianza
  source TEXT NOT NULL DEFAULT 'manual',          -- 'screenshot', 'text', 'batch_paste', 'share_target', 'voice', 'migrated'
  receipt_url TEXT,
  notes TEXT,
  confidence TEXT NOT NULL DEFAULT 'high',        -- 'high', 'medium', 'low'
  needs_review BOOLEAN NOT NULL DEFAULT false,
  extracted_fields JSONB DEFAULT '{}',
  
  -- Split / Gastos Compartidos
  is_split BOOLEAN NOT NULL DEFAULT false,
  split_group_id UUID,
  split_total_amount NUMERIC(12,2),
  split_my_share_pct NUMERIC(5,2),
  
  -- Integración con Portfolio Bursátil
  portfolio_id UUID REFERENCES public.portfolios(id) ON DELETE SET NULL,
  trade_id UUID REFERENCES public.trades(id) ON DELETE SET NULL,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ                          -- Soft Delete
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own transactions"
  ON public.transactions FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, transaction_date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_transactions_review ON public.transactions(user_id) WHERE needs_review = true AND deleted_at IS NULL;

-- 4. CACHE FX
CREATE TABLE IF NOT EXISTS public.fx_rate_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_currency TEXT NOT NULL,
  to_currency TEXT NOT NULL DEFAULT 'USD',
  rate NUMERIC(14,6) NOT NULL,
  source TEXT NOT NULL,                           -- 'dolarapi_cripto', 'dolarapi_mep', 'ecb', 'manual'
  valid_for_date DATE NOT NULL DEFAULT CURRENT_DATE,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(from_currency, to_currency, valid_for_date, source)
);

ALTER TABLE public.fx_rate_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read FX rate cache"
  ON public.fx_rate_cache FOR SELECT TO authenticated
  USING (true);

-- 5. APRENDIZAJE DE IA / CATEGORIZATION FEEDBACK
CREATE TABLE IF NOT EXISTS public.categorization_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  raw_merchant TEXT NOT NULL,
  cleaned_merchant TEXT NOT NULL,
  assigned_category_id UUID NOT NULL REFERENCES public.pf_categories(id) ON DELETE CASCADE,
  was_corrected BOOLEAN NOT NULL DEFAULT false,
  confidence_score NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.categorization_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own feedback"
  ON public.categorization_feedback FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 6. TRIGGER DE ACTUALIZACIÓN DE SALDOS
CREATE OR REPLACE FUNCTION public.sync_payment_method_balance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Revertir balance anterior en UPDATE/DELETE
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    IF OLD.deleted_at IS NULL THEN
      IF OLD.type = 'income' THEN
        UPDATE public.payment_methods SET current_balance = current_balance - OLD.amount_usd WHERE id = OLD.payment_method_id;
      ELSIF OLD.type = 'expense' OR OLD.type = 'investment' THEN
        UPDATE public.payment_methods SET current_balance = current_balance + OLD.amount_usd WHERE id = OLD.payment_method_id;
      ELSIF OLD.type = 'transfer' THEN
        UPDATE public.payment_methods SET current_balance = current_balance + OLD.amount_usd WHERE id = OLD.payment_method_id;
        IF OLD.destination_account_id IS NOT NULL THEN
          UPDATE public.payment_methods SET current_balance = current_balance - OLD.amount_usd WHERE id = OLD.destination_account_id;
        END IF;
      END IF;
    END IF;
  END IF;

  -- Aplicar nuevo balance en INSERT/UPDATE
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    IF NEW.deleted_at IS NULL THEN
      IF NEW.type = 'income' THEN
        UPDATE public.payment_methods SET current_balance = current_balance + NEW.amount_usd WHERE id = NEW.payment_method_id;
      ELSIF NEW.type = 'expense' OR NEW.type = 'investment' THEN
        UPDATE public.payment_methods SET current_balance = current_balance - NEW.amount_usd WHERE id = NEW.payment_method_id;
      ELSIF NEW.type = 'transfer' THEN
        UPDATE public.payment_methods SET current_balance = current_balance - NEW.amount_usd WHERE id = NEW.payment_method_id;
        IF NEW.destination_account_id IS NOT NULL THEN
          UPDATE public.payment_methods SET current_balance = current_balance + NEW.amount_usd WHERE id = NEW.destination_account_id;
        END IF;
      END IF;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_payment_method_balance ON public.transactions;
CREATE TRIGGER trg_sync_payment_method_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.sync_payment_method_balance();

-- 7. SEED SYSTEM CATEGORIES (PERSONALES)
INSERT INTO public.pf_categories (name, type, icon, color, is_system, sort_order, keywords, aliases)
VALUES
  ('Food', 'expense', 'Utensils', '#10b981', true, 1, ARRAY['lidl', 'carrefour', 'disco', 'coto', 'rewe', 'mercadona', 'pedidosya', 'mcdonalds', 'subway', 'spar', 'billa', 'netto', 'kaufland', 'supermercado', 'restaurante', 'cena', 'almuerzo'], ARRAY['comida', 'supermercado', 'alimentos']),
  ('House', 'expense', 'Home', '#3b82f6', true, 2, ARRAY['edesur', 'aysa', 'luz', 'agua', 'gas', 'ferreteria', 'dm drogerie', 'alquiler', 'expensas', 'edenor', 'metrogas', 'mantenimiento'], ARRAY['casa', 'hogar', 'servicios hogar']),
  ('Travel', 'expense', 'Plane', '#6366f1', true, 3, ARRAY['uber', 'kiwi', 'omio', 'hostel', 'a&o', 'dott', 'voi', 'bvg', 'regiojet', 'nafta', 'whoosh', 'vuelo', 'avion', 'hotel', 'cabify'], ARRAY['viajes', 'transporte', 'movilidad']),
  ('Salidas', 'expense', 'Sparkles', '#f59e0b', true, 4, ARRAY['decathlon', 'c&a', 'sfera', 'new yorker', 'sprinter', 'farmacity', 'ropa', 'bar', 'boliche', 'regalos', 'souvenirs', 'zara'], ARRAY['ropa', 'shopping', 'ocio']),
  ('Entertainment', 'expense', 'Film', '#8b5cf6', true, 5, ARRAY['museum', 'gym', 'futbol', 'gimnasio', 'spotlight', 'pacha', 'recital', 'cine', 'concierto', 'teatro', 'padel'], ARRAY['entretenimiento', 'deportes']),
  ('Tech', 'expense', 'Laptop', '#06b6d4', true, 6, ARRAY['monitor', 'teclado', 'mouse', 'pixel', 'watch', 'buds', 'cargador', 'hardware', 'gadgets', 'auriculares', 'apple', 'logitech'], ARRAY['tecnologia', 'hardware']),
  ('Tools & Software', 'expense', 'Wrench', '#ec4899', true, 7, ARRAY['claude', 'notion', 'chatgpt', 'openai', 'anthropic', 'github', 'cursor', 'spotify', 'netflix', 'youtube'], ARRAY['suscripciones', 'software', 'productivity tools']),
  ('Payments & Loans', 'expense', 'CreditCard', '#64748b', true, 8, ARRAY['cuota', 'prestamo', 'vodafone', 'movistar', 'prestige', 'personal', 'claro', 'telefonia', 'tarjeta'], ARRAY['cuotas', 'telefonia', 'pagos fijos']),
  ('Healthcare', 'expense', 'HeartPulse', '#ef4444', true, 9, ARRAY['farmacia', 'medico', 'seguro', 'osde', 'swiss medical', 'medicamentos', 'dentista', 'consulta'], ARRAY['salud', 'medicina']),
  ('UGC Studio Income', 'income', 'Briefcase', '#10b981', true, 10, ARRAY['ugc', 'ugc studio', 'ganancias ugc', 'pago mensual ugc'], ARRAY['ugc ganancias', 'retiro ugc']),
  ('AI Freelance Dev', 'income', 'Code', '#06b6d4', true, 11, ARRAY['freelance', 'desarrollo ai', 'cliente dev', 'consultoria'], ARRAY['freelance ai', 'proyectos']),
  ('Dividends', 'income', 'TrendingUp', '#8b5cf6', true, 12, ARRAY['dividendo', 'dividendos', 'yield', 'distribucion'], ARRAY['dividendos bursatiles']),
  ('Trading P&L', 'income', 'ArrowUpRight', '#10b981', true, 13, ARRAY['trade', 'ganancia trade', 'venta acciones', 'realized pnl'], ARRAY['ganancias trading']),
  ('Investment Contribution', 'investment', 'PiggyBank', '#a855f7', true, 14, ARRAY['broker', 'iol', 'balanz', 'bull market', 'ppi', 'interactive brokers', 'cocos', 'inversion'], ARRAY['aporte broker', 'inversion portfolio'])
ON CONFLICT DO NOTHING;
