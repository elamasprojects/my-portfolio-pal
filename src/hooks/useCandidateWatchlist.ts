import { useState, useEffect, useCallback } from "react";
import { CandidateWatchlistItem } from "@/types/thesis";
import { toast } from "sonner";

const STORAGE_KEY = "chess_candidate_watchlist";

const DEFAULT_CANDIDATES: CandidateWatchlistItem[] = [
  {
    id: "cand_1",
    symbol: "AAPL",
    assetCategory: "cedear",
    targetEntryPriceARS: 14500,
    targetExitPriceARS: 18500,
    invalidationPriceARS: 13200,
    entryThesis: "Consolidación en soporte técnico previo a reporte trimestral de ganancias con fuerte demanda institucional.",
    invalidationCondition: "Cierre por debajo de $13.200 con volumen superior al promedio mensual.",
    created_at: new Date().toISOString(),
  },
  {
    id: "cand_2",
    symbol: "AL30",
    assetCategory: "bond",
    targetEntryPriceARS: 68000,
    targetExitPriceARS: 85000,
    invalidationPriceARS: 61000,
    entryThesis: "Comprensión de riesgo país y acumulación de reservas del BCRA.",
    invalidationCondition: "Deterioro fiscal mensual o reversión de compras netas de divisas.",
    created_at: new Date().toISOString(),
  },
];

export function useCandidateWatchlist() {
  const [items, setItems] = useState<CandidateWatchlistItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn("Error reading candidate watchlist from localStorage:", e);
    }
    return DEFAULT_CANDIDATES;
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
