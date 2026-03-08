import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface MarketPriceResult {
  prices: Map<string, number>;
  isLoading: boolean;
}

async function fetchQuote(symbol: string): Promise<{ symbol: string; price: number }> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-quote", {
      body: { symbol },
    });
    if (error) return { symbol, price: 0 };
    return { symbol: symbol.toUpperCase(), price: data?.price || 0 };
  } catch {
    return { symbol: symbol.toUpperCase(), price: 0 };
  }
}

export function useMarketPrices(symbols: string[]): MarketPriceResult {
  const uniqueSymbols = [...new Set(symbols.map((s) => s.toUpperCase()))].filter(Boolean);

  const { data, isLoading } = useQuery({
    queryKey: ["market-prices", uniqueSymbols.join(",")],
    queryFn: async () => {
      if (uniqueSymbols.length === 0) return new Map<string, number>();
      const results = await Promise.all(uniqueSymbols.map(fetchQuote));
      const map = new Map<string, number>();
      for (const r of results) {
        if (r.price > 0) map.set(r.symbol, r.price);
      }
      return map;
    },
    enabled: uniqueSymbols.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,
  });

  return {
    prices: data || new Map<string, number>(),
    isLoading,
  };
}
