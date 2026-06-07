// Real index history via the existing stock-history edge function (Yahoo OHLC).
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IndexCandle {
  time: number; // unix seconds
  close: number;
}

export function useIndexHistory(symbol: string, range = "1Y") {
  return useQuery({
    queryKey: ["demo-index-history", symbol, range],
    queryFn: async (): Promise<IndexCandle[]> => {
      const { data, error } = await supabase.functions.invoke("stock-history", { body: { symbol, range } });
      if (error) throw error;
      return (data?.candles ?? []).map((c: { time: number; close: number }) => ({ time: c.time, close: c.close }));
    },
    enabled: !!symbol,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}
