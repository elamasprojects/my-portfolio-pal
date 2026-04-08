import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface QuoteResult {
  symbol: string;
  price: number;
  previousClose: number;
}

interface MarketPriceResult {
  prices: Map<string, number>;
  previousCloses: Map<string, number>;
  isLoading: boolean;
}

async function fetchQuote(symbol: string): Promise<QuoteResult> {
  try {
    const { data, error } = await supabase.functions.invoke("fetch-quote", {
      body: { symbol },
    });
    if (error) return { symbol: symbol.toUpperCase(), price: 0, previousClose: 0 };
    return {
      symbol: symbol.toUpperCase(),
      price: data?.price || 0,
      previousClose: data?.previousClose || 0,
    };
  } catch {
    return { symbol: symbol.toUpperCase(), price: 0, previousClose: 0 };
  }
}

export function useMarketPrices(symbols: string[]): MarketPriceResult {
  const uniqueSymbols = [...new Set(symbols.map((s) => s.toUpperCase()))].filter(Boolean);

  const { data, isLoading } = useQuery({
    queryKey: ["market-prices", uniqueSymbols.join(",")],
    queryFn: async () => {
      if (uniqueSymbols.length === 0) return { prices: new Map<string, number>(), previousCloses: new Map<string, number>() };
      const results = await Promise.all(uniqueSymbols.map(fetchQuote));
      const prices = new Map<string, number>();
      const previousCloses = new Map<string, number>();
      for (const r of results) {
        if (r.price > 0) prices.set(r.symbol, r.price);
        if (r.previousClose > 0) previousCloses.set(r.symbol, r.previousClose);
      }
      return { prices, previousCloses };
    },
    enabled: uniqueSymbols.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  return {
    prices: data?.prices || new Map<string, number>(),
    previousCloses: data?.previousCloses || new Map<string, number>(),
    isLoading,
  };
}
