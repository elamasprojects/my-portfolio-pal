import { useState, useEffect, useCallback } from "react";
import { CandidateWatchlistItem } from "@/types/thesis";
import { toast } from "sonner";

const STORAGE_KEY = "chess_candidate_watchlist";

export function useCandidateWatchlist() {
  // Seeded with nothing on purpose. This list used to open with two invented candidates
  // (AAPL and AL30, with prices and theses nobody wrote) which the effect below then persisted
  // to localStorage, making them indistinguishable from the user's own entries.
  const [items, setItems] = useState<CandidateWatchlistItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Error reading candidate watchlist from localStorage:", e);
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.warn("Error writing candidate watchlist to localStorage:", e);
    }
  }, [items]);

  const addItem = useCallback((item: Omit<CandidateWatchlistItem, "id" | "created_at">) => {
    const newItem: CandidateWatchlistItem = {
      ...item,
      id: `cand_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [newItem, ...prev]);
    toast.success(`✓ ${item.symbol} añadido a la Watchlist de Candidatas`);
    return newItem;
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target) {
        toast.info(`Removido ${target.symbol} de la watchlist`);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const updateItem = useCallback((id: string, updates: Partial<CandidateWatchlistItem>) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
    toast.success("Candidata actualizada");
  }, []);

  return {
    items,
    addItem,
    removeItem,
    updateItem,
  };
}
