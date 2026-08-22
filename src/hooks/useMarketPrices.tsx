import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDolarMEP } from "@/hooks/useDolarMEP";

interface QuoteResult {
  symbol: string;
  price: number;
  previousClose: number;
  /** Currency the exchange quotes this listing in, per the provider. */
  currency: string;
}

interface MarketPriceResult {
  /** Prices normalised to USD, matching the rest of the codebase's convention. */
  prices: Map<string, number>;
  previousCloses: Map<string, number>;
  /** The currency each quote arrived in, before normalisation. For display and debugging. */
  quoteCurrencies: Map<string, string>;
  isLoading: boolean;
}

/** Stable identity for the "no data yet" case. Must never be mutated by consumers. */
const EMPTY_PRICE_MAP: ReadonlyMap<string, number> = new Map<string, number>();
const EMPTY_CURRENCY_MAP: ReadonlyMap<string, string> = new Map<string, string>();

async function fetchQuote(symbol: string): Promise<QuoteResult> {
  const empty = { symbol: symbol.toUpperCase(), price: 0, previousClose: 0, currency: "USD" };
  try {
    const { data, error } = await supabase.functions.invoke("fetch-quote", {
      body: { symbol },
    });
    if (error) return empty;
    return {
      symbol: symbol.toUpperCase(),
      price: data?.price || 0,
      previousClose: data?.previousClose || 0,
      currency: String(data?.currency || "USD").toUpperCase(),
    };
  } catch {
    return empty;
  }
}

/**
 * Live quotes for `symbols`, normalised to USD.
 *
 * Every price in this codebase is USD (`trades.price_per_unit` included), so the conversion
 * belongs here — one place — rather than in each of the seven screens that read these maps.
 * A BYMA listing quotes in pesos: adding that figure to a dollar portfolio inflated net worth by
 * roughly the exchange rate, i.e. three orders of magnitude per position.
 */
export function useMarketPrices(symbols: string[]): MarketPriceResult {
  const uniqueSymbols = [...new Set(symbols.map((s) => s.toUpperCase()))].filter(Boolean);
  const { venta: mepRate = 0 } = useDolarMEP();

  const { data, isLoading } = useQuery({
    queryKey: ["market-prices", uniqueSymbols.join(","), mepRate > 0],
    queryFn: async () => {
      const prices = new Map<string, number>();
      const previousCloses = new Map<string, number>();
      const quoteCurrencies = new Map<string, string>();

      if (uniqueSymbols.length === 0) return { prices, previousCloses, quoteCurrencies };

      const results = await Promise.all(uniqueSymbols.map(fetchQuote));

      for (const r of results) {
        quoteCurrencies.set(r.symbol, r.currency);

        // An ARS quote with no rate to convert it is dropped, not passed through. Consumers
        // then fall back to cost basis, which is wrong by a little; passing it through would be
        // wrong by a factor of ~1500.
        const isARS = r.currency === "ARS";
        if (isARS && !(mepRate > 0)) continue;

        const toUSD = (value: number) => (isARS ? value / mepRate : value);

        if (r.price > 0) prices.set(r.symbol, toUSD(r.price));
        if (r.previousClose > 0) previousCloses.set(r.symbol, toUSD(r.previousClose));
      }

      return { prices, previousCloses, quoteCurrencies };
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
    quoteCurrencies: data?.quoteCurrencies ?? (EMPTY_CURRENCY_MAP as Map<string, string>),
    isLoading,
  };
}
