/**
 * Los dos colores de los gráficos de viaje, y por qué son estos.
 *
 * La superficie de las tarjetas es #1B1D22. Sobre ese fondo el par pasa los seis chequeos del
 * validador —banda de luminosidad, piso de croma, separación bajo daltonismo (ΔE 21 protan,
 * 22 tritán), piso de visión normal (ΔE 23) y contraste ≥ 3:1—, así que no se apoyan en que
 * el lector distinga dos tonos parecidos. El dorado es el mismo que ya usa el gráfico de
 * inflación: una serie más en la app, no una paleta nueva.
 */

/** Lo que salió del bolsillo. */
export const SPEND = "#BF8A28";

/** Lo que ya estaba pago antes de salir, y lo que volvió como reembolso. */
export const PREPAID = "#4591C4";

/** Ejes y grilla, en los tokens del tema: recesivos a propósito. */
export const AXIS = "hsl(var(--muted-foreground))";
export const GRID = "hsl(var(--border))";

export const TOOLTIP_STYLE = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
} as const;

/** US$ con dos decimales, en la convención de separadores que usa el resto de la app. */
export function usd(n: number): string {
  return `US$ ${n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** US$ redondeado, para ejes y titulares donde los centavos son ruido. */
export function usdShort(n: number): string {
  if (Math.abs(n) >= 1000) return `US$ ${(n / 1000).toFixed(1)}k`;
  return `US$ ${Math.round(n)}`;
}

/** 'YYYY-MM-DD' → '24 jun', sin que el huso corra el día. */
export function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return `${d} ${date.toLocaleDateString("es-AR", { month: "short" }).replace(".", "")}`;
}
