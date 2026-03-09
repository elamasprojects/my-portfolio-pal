import { useQuery } from "@tanstack/react-query";

interface DolarMEPResponse {
  compra: number;
  venta: number;
  casa: string;
  nombre: string;
  moneda: string;
  fechaActualizacion: string;
}

export function convertArsToUsd(ars: number, ventaRate: number): number {
  if (!ventaRate || ventaRate <= 0) return ars;
  return ars / ventaRate;
}

export function convertUsdToArs(usd: number, ventaRate: number): number {
  if (!ventaRate || ventaRate <= 0) return usd;
  return usd * ventaRate;
}

export function useDolarMEP() {
  const { data, isLoading } = useQuery({
    queryKey: ["dolar-mep"],
    queryFn: async (): Promise<DolarMEPResponse> => {
      const res = await fetch("https://dolarapi.com/v1/dolares/bolsa");
      if (!res.ok) throw new Error("Failed to fetch MEP rate");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  return {
    venta: data?.venta ?? 0,
    compra: data?.compra ?? 0,
    fechaActualizacion: data?.fechaActualizacion ?? null,
    isLoading,
  };
}
