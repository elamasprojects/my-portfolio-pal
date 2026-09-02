import { createContext, useContext, type ReactNode } from "react";

/**
 * El disparador de la carga, para las vistas que quieran ofrecer un atajo.
 *
 * El selector ("¿operación o movimiento?") vive en `AppLayout`, que es quien monta los
 * diálogos. Sin esto, cada vista que quisiera un acceso rápido tenía que armar su propio
 * flujo de captura — que es exactamente cómo Movimientos terminó con seis puertas a dos
 * destinos.
 */

interface IngestContextValue {
  openPicker: () => void;
}

const IngestContext = createContext<IngestContextValue | null>(null);

export function IngestProvider({
  openPicker,
  children,
}: IngestContextValue & { children: ReactNode }) {
  return <IngestContext.Provider value={{ openPicker }}>{children}</IngestContext.Provider>;
}

/**
 * Fuera del layout —una vista montada suelta en una prueba— devuelve un no-op en vez de
 * romper: el atajo es una comodidad, no el único camino. El "+" de la barra siempre está.
 */
export function useIngest(): IngestContextValue {
  return useContext(IngestContext) ?? { openPicker: () => {} };
}
