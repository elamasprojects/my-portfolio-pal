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

/** Stable identity for the "no data yet" case. Must never be mutated by consumers. */
const EMPTY_PRICE_MAP: ReadonlyMap<string, number> = new Map<string, number>();

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

  // Shared frozen empties: returning `new Map()` on every render gave consumers a fresh
  // identity each time, so any effect with `prices` in its dependency array re-ran on every
  // render. Combined with an effect that sets fresh state, that is an infinite render loop —
  // which is what hung /strategy whenever no quotes were loaded.
  return {
    prices: data?.prices ?? (EMPTY_PRICE_MAP as Map<string, number>),
    previousCloses: data?.previousCloses ?? (EMPTY_PRICE_MAP as Map<string, number>),
    isLoading,
  };
}
