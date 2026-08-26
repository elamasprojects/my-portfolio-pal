import { useQuery } from "@tanstack/react-query";
import { fetchAndCacheInflationIndex } from "@/lib/apiIngestion";
import { toInflationPoints, type InflationPoint } from "@/lib/inflationHistory";

export interface InflationHistory {
  points: InflationPoint[];
  /**
   * True when the series is the synthetic fallback rather than published INDEC data. The UI has
   * to say so: a projected 2%/month curve looks exactly like a measured one on a chart.
   */
  isEstimated: boolean;
  source: string | null;
}

/**
 * Published monthly inflation (INDEC via ArgentinaDatos), for display only.
 *
 * Reads no portfolio data and feeds no portfolio figure.
 */
export function useInflationHistory() {
  return useQuery<InflationHistory>({
    queryKey: ["inflation-history"],
    queryFn: async () => {
      const result = await fetchAndCacheInflationIndex();
      return {
        points: toInflationPoints(result.data),
        isEstimated: result.isEstimated,
        source: result.data[0]?.source ?? null,
      };
    },
    // Monthly data; there is nothing to gain from refetching it often.
    staleTime: 12 * 60 * 60 * 1000,
    retry: 1,
  });
}
