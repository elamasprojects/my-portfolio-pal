import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Transaction,
  Category,
  PaymentMethod,
  FinancialAccount,
  IngestionSource,
  ConfidenceLevel,
} from "@/types/finance";
import { toast } from "sonner";

export function useFinancialAccounts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["financial_accounts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("financial_accounts" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching financial accounts:", error);
        throw error;
      }
      return (data || []) as unknown as FinancialAccount[];
    },
    enabled: !!user,
  });

  const addAccount = useMutation({
    mutationFn: async (acc: Partial<FinancialAccount>) => {
      if (!user) throw new Error("No user");
      const { data, error } = await supabase
        .from("financial_accounts" as any)
        .insert({
          user_id: user.id,
          name: acc.name?.trim(),
          type: acc.type || "digital_wallet",
          currency: acc.currency || "USD",
          color: acc.color || "#10b981",
          icon: acc.icon || "Wallet",
          aliases: acc.aliases || [],
          detection_patterns: acc.detection_patterns || [],
          initial_balance: acc.initial_balance || 0,
          current_balance: acc.current_balance || acc.initial_balance || 0,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as FinancialAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_accounts"] });
      toast.success("Cuenta financiera creada");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Error al crear cuenta");
    },
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<FinancialAccount> }) => {
      if (!user) throw new Error("No user");
      const { data, error } = await supabase
        .from("financial_accounts" as any)
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as FinancialAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_accounts"] });
      toast.success("Cuenta financiera actualizada");
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No user");
      const { error } = await supabase
        .from("financial_accounts" as any)
        .update({ is_active: false })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financial_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] });
      toast.success("Cuenta financiera eliminada");
    },
  });

  return {
    accounts: query.data || [],
    isLoading: query.isLoading,
    addAccount,
    updateAccount,
    deleteAccount,
  };
}

export function usePaymentMethods() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["payment_methods", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("payment_methods" as any)
        .select("*, account:financial_accounts(*)")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) {
        console.error("Error fetching payment methods:", error);
        throw error;
      }
      return (data || []) as unknown as PaymentMethod[];
    },
    enabled: !!user,
  });

  const addPaymentMethod = useMutation({
    mutationFn: async (pm: Partial<PaymentMethod>) => {
      if (!user) throw new Error("No user");
      const { data, error } = await supabase
        .from("payment_methods" as any)
        .insert({
          user_id: user.id,
          account_id: pm.account_id || null,
          name: pm.name?.trim(),
          type: pm.type || "card",
          instrument_type: pm.instrument_type || "card_debit",
          currency: pm.currency || "USD",
          color: pm.color || "#8b5cf6",
          icon: pm.icon || "CreditCard",
          aliases: pm.aliases || [],
          detection_patterns: pm.detection_patterns || [],
          initial_balance: 0,
          current_balance: 0,
        })
        .select("*, account:financial_accounts(*)")
        .single();

      if (error) throw error;
      return data as unknown as PaymentMethod;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] });
      toast.success("Medio de pago agregado");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Error al agregar medio de pago");
    },
  });

  const updatePaymentMethod = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PaymentMethod> }) => {
      if (!user) throw new Error("No user");
      const { data, error } = await supabase
        .from("payment_methods" as any)
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select("*, account:financial_accounts(*)")
        .single();

      if (error) throw error;
      return data as unknown as PaymentMethod;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] });
      toast.success("Medio de pago actualizado");
    },
  });

  const deletePaymentMethod = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No user");
      const { error } = await supabase
        .from("payment_methods" as any)
        .update({ is_active: false })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] });
      toast.success("Medio de pago eliminado");
    },
  });

  return {
    paymentMethods: query.data || [],
    isLoading: query.isLoading,
    addPaymentMethod,
    updatePaymentMethod,
    deletePaymentMethod,
  };
}

export function useCategories() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["pf_categories", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("pf_categories" as any)
        .select("*")
        .or(`user_id.is.null,user_id.eq.${user.id}`)
        .eq("archived", false)
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return (data || []) as unknown as Category[];
    },
    enabled: !!user,
  });

  const addCategory = useMutation({
    mutationFn: async (cat: Partial<Category>) => {
      if (!user) throw new Error("No user");
      const { data, error } = await supabase
        .from("pf_categories" as any)
        .insert({
          user_id: user.id,
          name: cat.name,
          type: cat.type || "expense",
          color: cat.color || "#3b82f6",
          icon: cat.icon || "Tag",
          aliases: cat.aliases || [],
          keywords: cat.keywords || [],
          sort_order: cat.sort_order || 99,
          is_system: false,
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pf_categories"] });
      toast.success("Categoría creada");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Error al crear categoría");
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Category> }) => {
      if (!user) throw new Error("No user");
      const { data, error } = await supabase
        .from("pf_categories" as any)
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Category;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pf_categories"] });
      toast.success("Categoría actualizada");
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No user");
      const { error } = await supabase
        .from("pf_categories" as any)
        .update({ archived: true })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pf_categories"] });
      toast.success("Categoría eliminada");
    },
    onError: (err: any) => {
      toast.error(err?.message || "No se puede eliminar una categoría del sistema");
    },
  });

  return {
    categories: query.data || [],
    isLoading: query.isLoading,
    addCategory,
    updateCategory,
    deleteCategory,
  };
}

export function useTransactions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["transactions", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("transactions" as any)
        .select(
          "*, category:pf_categories(*), payment_method:payment_methods!transactions_payment_method_id_fkey(*), account:financial_accounts(*)"
        )
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false });

      if (error) {
        console.error("Error fetching transactions:", error);
        throw error;
      }
      return (data || []) as unknown as Transaction[];
    },
    enabled: !!user,
  });

  const addTransaction = useMutation({
    mutationFn: async (tx: {
      type?: "income" | "expense" | "transfer" | "investment";
      name: string;
      raw_merchant?: string;
      amount_usd: number;
      transaction_date?: string;
      category_id?: string | null;
      payment_method_id?: string | null;
      account_id?: string | null;
      destination_account_id?: string | null;
      original_amount?: number | null;
      original_currency?: string | null;
      fx_rate?: number | null;
      fx_source?: string | null;
      source?: IngestionSource;
      receipt_url?: string | null;
      notes?: string | null;
      confidence?: ConfidenceLevel;
      needs_review?: boolean;
      extracted_fields?: Record<string, any>;
    }) => {
      if (!user) throw new Error("No user");

      const { data, error } = await supabase
        .from("transactions" as any)
        .insert({
          user_id: user.id,
          type: tx.type || "expense",
          name: tx.name.trim(),
          raw_merchant: tx.raw_merchant || tx.name,
          amount_usd: tx.amount_usd,
          transaction_date: tx.transaction_date || new Date().toISOString().split("T")[0],
          category_id: tx.category_id || null,
          payment_method_id: tx.payment_method_id || null,
          account_id: tx.account_id || null,
          destination_account_id: tx.destination_account_id || null,
          original_amount: tx.original_amount || null,
          original_currency: tx.original_currency || "USD",
          fx_rate: tx.fx_rate || 1,
          fx_source: tx.fx_source || "native_usd",
          source: tx.source || "manual",
          receipt_url: tx.receipt_url || null,
          notes: tx.notes || null,
          confidence: tx.confidence || "high",
          needs_review: tx.needs_review || false,
          extracted_fields: tx.extracted_fields || {},
        })
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Transaction;
    },
    onSuccess: (savedTx) => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] });
      toast.success(`✓ ${savedTx.name} — $${Number(savedTx.amount_usd).toFixed(2)} USD`);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Error al registrar transacción");
    },
  });

  const updateTransaction = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Transaction> }) => {
      if (!user) throw new Error("No user");
      const { data, error } = await supabase
        .from("transactions" as any)
        .update(updates)
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      return data as unknown as Transaction;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] });
      toast.success("Transacción actualizada");
    },
  });

  const softDeleteTransaction = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("No user");
      const { error } = await supabase
        .from("transactions" as any)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["financial_accounts"] });
      queryClient.invalidateQueries({ queryKey: ["payment_methods"] });
      toast.success("Transacción eliminada");
    },
  });

  const reviewQueue = (query.data || []).filter((t) => t.needs_review && !t.deleted_at);

  return {
    transactions: query.data || [],
    reviewQueue,
    isLoading: query.isLoading,
    addTransaction,
    updateTransaction,
    softDeleteTransaction,
  };
}
