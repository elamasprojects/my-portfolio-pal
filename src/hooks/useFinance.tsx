import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Transaction, Category, PaymentMethod, IngestionSource, ConfidenceLevel } from "@/types/finance";
import { toast } from "sonner";

export function usePaymentMethods() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["payment_methods", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("payment_methods" as any)
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (error) throw error;

      if (data && data.length === 0) {
        const defaults = [
          {
            user_id: user.id,
            name: "DolarApp Global Card",
            type: "digital_wallet",
            currency: "USD",
            color: "#10b981",
            icon: "CreditCard",
            detection_patterns: ["USDc", "DolarApp", "Global Card"],
            aliases: ["dolarapp", "dolar app", "tarjeta global"],
            initial_balance: 0,
            current_balance: 0,
          },
          {
            user_id: user.id,
            name: "Mercado Pago",
            type: "digital_wallet",
            currency: "ARS",
            color: "#009ee3",
            icon: "Wallet",
            detection_patterns: ["MERPAGO*", "Mercado Pago", "Dinero disponible"],
            aliases: ["mp", "mercadopago"],
            initial_balance: 0,
            current_balance: 0,
          },
          {
            user_id: user.id,
            name: "Bank ARS",
            type: "bank",
            currency: "ARS",
            color: "#3b82f6",
            icon: "Building",
            detection_patterns: ["Transferencia", "Débito", "Banco"],
            aliases: ["banco", "bank", "cuenta ars"],
            initial_balance: 0,
            current_balance: 0,
          },
          {
            user_id: user.id,
            name: "Efectivo",
            type: "cash",
            currency: "USD",
            color: "#84cc16",
            icon: "Coins",
            detection_patterns: ["Efectivo", "Cash"],
            aliases: ["efectivo", "cash"],
            initial_balance: 0,
            current_balance: 0,
          },
        ];
        const { data: created } = await supabase
          .from("payment_methods" as any)
          .insert(defaults)
          .select();
        return (created || []) as unknown as PaymentMethod[];
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
          name: pm.name,
          type: pm.type || "digital_wallet",
          currency: pm.currency || "USD",
          color: pm.color || "#10b981",
          icon: pm.icon || "Wallet",
          aliases: pm.aliases || [],
          detection_patterns: pm.detection_patterns || [],
          initial_balance: pm.initial_balance || 0,
          current_balance: pm.current_balance || pm.initial_balance || 0,
        })
        .select()
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
        .select()
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
        .select("*, category:pf_categories(*), payment_method:payment_methods(*)")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("transaction_date", { ascending: false });

      if (error) throw error;
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
      payment_method_id: string;
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
          payment_method_id: tx.payment_method_id,
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
