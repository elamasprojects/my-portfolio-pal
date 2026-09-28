import type { Category, Transaction } from "@/types/finance";
import { parseTransactionLocalDate } from "@/lib/financialMath";

/**
 * Períodos de las vistas de finanzas, y contra qué se compara cada uno.
 *
 * Vive acá y no en los componentes porque el Sankey de /finance, el feed de /movements y sus
 * gráficos tienen que cortar exactamente igual: si "mes anterior" empezara un día distinto en
 * cada pantalla, los totales no cerrarían entre sí y nadie sabría cuál creer.
 */

export type FinancePeriod = "30d" | "this_month" | "last_month" | "ytd" | "all";

export interface DateRange {
  start?: Date;
  /** Inclusivo: el último instante del último día. */
  end?: Date;
}

export const PERIOD_LABELS: Record<FinancePeriod, string> = {
  "30d": "Últimos 30 días",
  this_month: "Mes actual",
  last_month: "Mes anterior",
  ytd: "Año en curso",
  all: "Histórico",
};

/** Para el teléfono: los cuatro botones tienen que entrar en 343 px sin esconder ninguno. */
export const PERIOD_SHORT_LABELS: Record<FinancePeriod, string> = {
  "30d": "30 días",
  this_month: "Este mes",
  last_month: "Mes ant.",
  ytd: "Este año",
  all: "Todo",
};

const DAY_MS = 86400000;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Primer y último instante del mes `offset` meses desde el de `now`. */
function monthRange(now: Date, offset: number): DateRange {
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = endOfDay(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0));
  return { start, end };
}

/**
 * El rango de un período.
 *
 * "Últimos 30 días" e "Año en curso" quedan abiertos hacia adelante a propósito: el feed ya
 * mostraba así los movimientos fechados a futuro (una cuota agendada) y esconderlos al cambiar
 * de filtro los haría desaparecer sin aviso.
 */
export function resolvePeriod(period: FinancePeriod, now: Date = new Date()): DateRange {
  switch (period) {
    case "30d":
      // Hoy y los 29 días anteriores: 30 días de calendario, como hacía el feed.
      return { start: addDays(startOfDay(now), -29) };
    case "this_month":
      return monthRange(now, 0);
    case "last_month":
      return monthRange(now, -1);
    case "ytd":
      return { start: new Date(now.getFullYear(), 0, 1) };
    case "all":
      return {};
  }
}

/**
 * El período contra el que se compara, o null si no hay uno que tenga sentido.
 *
 * El año en curso se compara contra el MISMO tramo del año pasado (1/1 al mismo día), no
 * contra el año entero: comparar nueve meses con doce siempre daría que este año se gasta
 * menos, y esa conclusión sería falsa.
 */
export function previousPeriod(period: FinancePeriod, now: Date = new Date()): DateRange | null {
  switch (period) {
    case "30d": {
      const today = startOfDay(now);
      return { start: addDays(today, -59), end: endOfDay(addDays(today, -30)) };
    }
    case "this_month":
      return monthRange(now, -1);
    case "last_month":
      return monthRange(now, -2);
    case "ytd": {
      const y = now.getFullYear() - 1;
      return {
        start: new Date(y, 0, 1),
        // 29/2 de un bisiesto cae en 1/3 del año siguiente; se clampa al último día de febrero.
        end: endOfDay(new Date(y, now.getMonth(), Math.min(now.getDate(), new Date(y, now.getMonth() + 1, 0).getDate()))),
      };
    }
    case "all":
      return null;
  }
}

/**
 * El rango cortado en hoy, para los totales que se comparan.
 *
 * "30 días" y "Año en curso" quedan abiertos hacia adelante para el feed, pero una cuota
 * agendada para noviembre no es plata que ya salió: sumada al total, el ▲% contra el período
 * anterior (que corta en el mismo día) salía inflado y el total del panel no coincidía con el
 * final de su propia línea, que ya se cortaba en hoy.
 */
export function capAtToday(range: DateRange, now: Date = new Date()): DateRange {
  const today = endOfDay(now);
  return { ...range, end: range.end && range.end < today ? range.end : today };
}

/** Texto corto para la leyenda de la línea punteada. */
export function previousPeriodLabel(period: FinancePeriod, now: Date = new Date()): string | null {
  switch (period) {
    case "30d":
      return "30 días previos";
    case "this_month":
    case "last_month": {
      const r = previousPeriod(period, now)!;
      return r.start!.toLocaleDateString("es-AR", { month: "long", year: "numeric" });
    }
    case "ytd":
      return `Mismo tramo ${now.getFullYear() - 1}`;
    case "all":
      return null;
  }
}

export function isInRange(dateStr: string, range: DateRange | null | undefined): boolean {
  if (!range) return false;
  const t = parseTransactionLocalDate(dateStr).getTime();
  // Una fecha ilegible no se esconde: se muestra para que se vea que está mal.
  if (!Number.isFinite(t)) return true;
  if (range.start && t < range.start.getTime()) return false;
  if (range.end && t > range.end.getTime()) return false;
  return true;
}

// ─── Flujo de un período ────────────────────────────────────────────────────────────────

export type FlowKind = "income" | "expense";

/**
 * Qué lado del flujo es una transacción, con el mismo criterio que el Sankey.
 *
 * `investment` cuenta como egreso porque el Sankey lo cuenta así: si los gráficos de
 * /movements lo dejaran afuera, el margen de acá y el "Excedente Neto" de /finance darían
 * números distintos para el mismo mes.
 */
export function flowKind(t: Transaction): FlowKind | null {
  if (t.deleted_at) return null;
  if (!(Number(t.amount_usd) > 0)) return null;
  if (t.type === "income") return "income";
  if (t.type === "expense" || t.type === "investment") return "expense";
  return null;
}

export interface FlowTotals {
  income: number;
  expense: number;
  margin: number;
}

export function flowTotals(transactions: Transaction[], range: DateRange | null): FlowTotals {
  let income = 0;
  let expense = 0;
  if (range) {
    for (const t of transactions) {
      const kind = flowKind(t);
      if (!kind || !isInRange(t.transaction_date, range)) continue;
      if (kind === "income") income += Number(t.amount_usd);
      else expense += Number(t.amount_usd);
    }
  }
  return { income, expense, margin: income - expense };
}

// ─── Torta por categoría ────────────────────────────────────────────────────────────────

export interface CategorySlice {
  name: string;
  value: number;
}

/**
 * El nombre de la porción, con el mismo criterio que los nodos del Sankey — así una categoría
 * se llama igual en las dos pantallas y el total de una porción coincide con el de su nodo.
 */
export function categoryLabel(t: Transaction, catMap: Map<string, Category>): string {
  const cat = t.category_id ? catMap.get(t.category_id) : undefined;
  if (cat) return cat.name;
  return t.type === "income" ? t.name || "Ingresos Varios" : "Otros Gastos";
}

/**
 * Porciones por categoría, de mayor a menor. Más allá de `maxSlices` se agrupa en "Resto":
 * una torta de quince porciones no se lee, y las chicas no cambian ninguna decisión.
 */
export function categoryBreakdown(
  transactions: Transaction[],
  categories: Category[],
  range: DateRange,
  kind: FlowKind,
  maxSlices = 6,
): CategorySlice[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const byName = new Map<string, number>();
  for (const t of transactions) {
    if (flowKind(t) !== kind || !isInRange(t.transaction_date, range)) continue;
    const name = categoryLabel(t, catMap);
    byName.set(name, (byName.get(name) || 0) + Number(t.amount_usd));
  }
  const sorted = [...byName.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  if (sorted.length <= maxSlices) return sorted;
  const head = sorted.slice(0, maxSlices - 1);
  const rest = sorted.slice(maxSlices - 1).reduce((s, x) => s + x.value, 0);
  return [...head, { name: "Resto", value: rest }];
}

// ─── Serie acumulada contra el período anterior ─────────────────────────────────────────

export interface SeriesPoint {
  /** Etiqueta del eje: '12' (día del mes / día n) o 'mar' (mes). */
  label: string;
  /** Acumulados del período actual. null después de hoy: el futuro no es cero. */
  income: number | null;
  expense: number | null;
  margin: number | null;
  /** Acumulados del período anterior, alineados por posición (día n contra día n). */
  prevIncome: number | null;
  prevExpense: number | null;
  prevMargin: number | null;
}

export interface PeriodSeries {
  granularity: "day" | "month";
  points: SeriesPoint[];
}

type Bucketer = { count: number; indexOf: (d: Date) => number; label: (i: number) => string };

function dayBucketer(start: Date, end: Date): Bucketer {
  const s = startOfDay(start).getTime();
  const count = Math.round((startOfDay(end).getTime() - s) / DAY_MS) + 1;
  return {
    count,
    indexOf: (d) => Math.round((startOfDay(d).getTime() - s) / DAY_MS),
    label: (i) => String(addDays(start, i).getDate()),
  };
}

function monthBucketer(start: Date, end: Date): Bucketer {
  const s = start.getFullYear() * 12 + start.getMonth();
  const count = end.getFullYear() * 12 + end.getMonth() - s + 1;
  return {
    count,
    indexOf: (d) => d.getFullYear() * 12 + d.getMonth() - s,
    label: (i) =>
      new Date(start.getFullYear(), start.getMonth() + i, 1)
        .toLocaleDateString("es-AR", { month: "short", ...(count > 12 ? { year: "2-digit" } : {}) })
        .replace(".", ""),
  };
}

function cumulate(
  transactions: Transaction[],
  range: DateRange,
  b: Bucketer,
  len: number,
): { income: number[]; expense: number[] } {
  const income = new Array(len).fill(0);
  const expense = new Array(len).fill(0);
  for (const t of transactions) {
    const kind = flowKind(t);
    if (!kind || !isInRange(t.transaction_date, range)) continue;
    const i = b.indexOf(parseTransactionLocalDate(t.transaction_date));
    if (i < 0 || i >= len) continue;
    (kind === "income" ? income : expense)[i] += Number(t.amount_usd);
  }
  for (let i = 1; i < len; i++) {
    income[i] += income[i - 1];
    expense[i] += expense[i - 1];
  }
  return { income, expense };
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * La serie ACUMULADA del período, con la del anterior superpuesta.
 *
 * Acumulada y no por día porque la pregunta que responde es "¿voy gastando más o menos que el
 * mes pasado a esta altura?": el gasto diario es puro ruido (el alquiler cae un día y dispara
 * la barra), el acumulado muestra el ritmo.
 *
 * Hasta dos meses se agrupa por día; más, por mes. El período anterior se alinea por posición
 * — el día 12 contra el día 12 —, que es la única lectura de "a esta altura".
 */
export function buildPeriodSeries(
  transactions: Transaction[],
  period: FinancePeriod,
  now: Date = new Date(),
): PeriodSeries {
  const cur = resolvePeriod(period, now);
  const prev = previousPeriod(period, now);
  const today = endOfDay(now);

  let start = cur.start;
  if (!start) {
    // Histórico: desde el primer movimiento.
    let min = Infinity;
    for (const t of transactions) {
      if (!flowKind(t)) continue;
      const ms = parseTransactionLocalDate(t.transaction_date).getTime();
      if (Number.isFinite(ms) && ms < min) min = ms;
    }
    start = Number.isFinite(min) ? new Date(min) : startOfDay(now);
  }
  const end = cur.end ?? today;

  const spanDays = Math.round((startOfDay(end).getTime() - startOfDay(start).getTime()) / DAY_MS) + 1;
  const granularity: "day" | "month" = spanDays <= 62 ? "day" : "month";
  const mk = granularity === "day" ? dayBucketer : monthBucketer;

  const curB = mk(start, end);
  const prevB = prev ? mk(prev.start!, prev.end!) : null;
  const len = Math.max(curB.count, prevB?.count ?? 0);

  const c = cumulate(transactions, { start, end }, curB, len);
  const p = prev && prevB ? cumulate(transactions, prev, prevB, len) : null;

  // Hasta dónde llega "hoy" en la serie actual: de ahí en más va null, no un acumulado plano.
  const todayIdx = today.getTime() < start.getTime() ? -1 : Math.min(curB.indexOf(now), curB.count - 1);

  const points: SeriesPoint[] = [];
  for (let i = 0; i < len; i++) {
    const live = i <= todayIdx;
    const hasPrev = p !== null && prevB !== null && i < prevB.count;
    points.push({
      label: i < curB.count ? curB.label(i) : prevB!.label(i),
      income: live ? round2(c.income[i]) : null,
      expense: live ? round2(c.expense[i]) : null,
      margin: live ? round2(c.income[i] - c.expense[i]) : null,
      prevIncome: hasPrev ? round2(p!.income[i]) : null,
      prevExpense: hasPrev ? round2(p!.expense[i]) : null,
      prevMargin: hasPrev ? round2(p!.income[i] - p!.expense[i]) : null,
    });
  }
  return { granularity, points };
}
