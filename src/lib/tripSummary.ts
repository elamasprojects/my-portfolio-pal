import type { Category, PaymentMethod, Transaction } from "@/types/finance";

/**
 * Qué gastó un viaje, y por qué esa cuenta no es un filtro por fechas.
 *
 * La ventana resuelve la enorme mayoría de las filas sin que haya que marcar nada, pero se
 * equivoca en las dos puntas, y las dos importan:
 *
 *   * Lo prepago quedaría afuera. El vuelo y los hospedajes reservados desde casa son la
 *     parte más cara del viaje y están fechados semanas antes de salir.
 *   * Lo de casa quedaría adentro. Las boletas de luz siguieron llegando, y el día de la
 *     vuelta entraron compras en pesos con una tarjeta local.
 *
 * De ahí que un viaje sea el rango más una lista corta de excepciones. Todo lo que decide
 * qué entra vive acá, en funciones puras sobre datos ya traídos, para que se pueda probar
 * sin base de datos.
 */

export type TripItemMode = "include" | "exclude";

export interface Trip {
  id: string;
  user_id: string;
  name: string;
  destination?: string | null;
  start_date: string;
  end_date: string;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface TripItem {
  id: string;
  trip_id: string;
  transaction_id: string;
  mode: TripItemMode;
  reason?: string | null;
}

/** Una transacción ya resuelta como parte del viaje, con el porqué a la vista. */
export interface TripEntry {
  transaction: Transaction;
  /** Positivo si es gasto, negativo si es un reembolso. En dólares, como todo el ledger. */
  signedUSD: number;
  /** La fecha cae dentro del rango del viaje. */
  inWindow: boolean;
  /** Se pagó antes de salir: vuelo, hospedaje reservado. */
  isPrepaid: boolean;
  /** Llegó después de volver: un reembolso de tax free, un cargo que tardó en impactar. */
  isAfter: boolean;
  /** La excepción que la trajo o la sacó, si hubo alguna. */
  override: TripItemMode | null;
  reason?: string | null;
}

export interface TripBucket {
  id: string;
  name: string;
  total: number;
  count: number;
  /** Fracción del gasto bruto, 0..1. */
  share: number;
}

export interface TripDay {
  /** 'YYYY-MM-DD'. */
  date: string;
  spend: number;
  refunds: number;
  /** spend − refunds del día. */
  net: number;
  /** Neto acumulado desde el arranque, con el prepago ya sumado en la base. */
  cumulative: number;
}

/** Un tramo de siete días del viaje. */
export interface TripWeek {
  /** 1 para la primera semana de viaje. */
  index: number;
  start: string;
  end: string;
  spend: number;
}

export interface TripSummary {
  entries: TripEntry[];
  /** Días de viaje, contando el primero y el último. */
  days: number;
  /** Gasto bruto, sin descontar reembolsos. */
  spend: number;
  /** Reembolsos, en positivo. */
  refunds: number;
  /** Lo que el viaje costó de verdad: spend − refunds. */
  net: number;
  /**
   * Los tres tramos son netos —gasto menos reembolsos de ese tramo— y suman exactamente `net`.
   * Que cierren importa: son lo que la pantalla muestra como desglose del titular.
   */
  /** Lo que el viaje ya costaba antes de salir. */
  prepaid: number;
  /** Lo gastado en destino, dentro de la ventana. */
  onTrip: number;
  /** Lo que impactó después de volver. Negativo si fue un reembolso tardío. */
  after: number;
  /**
   * Ritmo diario en destino. Deliberadamente `onTrip / days` y no el total: repartir el vuelo
   * entre los días daría un "gasté X por día" que no describe ningún día del viaje.
   */
  perDay: number;
  daysWithSpend: number;
  /** Días del viaje sin un solo gasto. */
  quietDays: number;
  byCategory: TripBucket[];
  byPaymentMethod: TripBucket[];
  /** Una fila por día del viaje, incluidos los días en cero. */
  daily: TripDay[];
  /**
   * El mismo gasto en tramos de siete días. A 77 barras diarias en pantalla de teléfono cada
   * una queda en tres píxeles; por semana el ritmo se lee, y el detalle diario ya lo lleva la
   * curva acumulada.
   */
  byWeek: TripWeek[];
  /** El día más caro en destino, o null si no hubo gasto. */
  biggestDay: { date: string; total: number } | null;
  /** Los gastos más grandes, de mayor a menor. */
  topExpenses: TripEntry[];
}

const SIN_CATEGORIA = "Sin categoría";
const SIN_MEDIO = "Sin medio de pago";

/** Fechas 'YYYY-MM-DD': el orden lexicográfico ya es el cronológico, sin husos de por medio. */
function inRange(date: string, start: string, end: string): boolean {
  return date >= start && date <= end;
}

/** Días entre dos fechas contando las dos puntas. Mínimo 1, para no dividir por cero. */
export function tripDayCount(start: string, end: string): number {
  const a = Date.parse(`${start}T00:00:00Z`);
  const b = Date.parse(`${end}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return 1;
  return Math.floor((b - a) / 86_400_000) + 1;
}

/** Todas las fechas del viaje, en orden, incluidas las que no tuvieron gasto. */
export function tripDateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const total = tripDayCount(start, end);
  const from = Date.parse(`${start}T00:00:00Z`);
  if (!Number.isFinite(from)) return [start];
  for (let i = 0; i < total; i++) {
    out.push(new Date(from + i * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Qué transacciones son del viaje.
 *
 * El default cubre sólo gastos dentro de la ventana. Durante este viaje entraron más de
 * US$ 14.000 de ingresos de trabajo que no tienen nada que ver con él: si el rango arrastrara
 * cualquier tipo de movimiento, el resumen abriría diciendo que el viaje dejó ganancia. Un
 * ingreso entra únicamente si se lo incluye a mano, que es el caso de los reembolsos.
 *
 * Transferencias e inversiones no entran ni marcadas: mueven plata entre cuentas propias, así
 * que contarlas como gasto inventaría un costo que nadie pagó.
 */
export function resolveTripEntries(
  trip: Trip,
  transactions: Transaction[],
  items: TripItem[] = []
): TripEntry[] {
  const overrides = new Map<string, TripItem>();
  for (const item of items) {
    if (item.trip_id === trip.id) overrides.set(item.transaction_id, item);
  }

  const entries: TripEntry[] = [];
  for (const tx of transactions) {
    if (tx.deleted_at) continue;
    if (tx.type !== "expense" && tx.type !== "income") continue;

    const override = overrides.get(tx.id) ?? null;
    if (override?.mode === "exclude") continue;

    const inWindow = inRange(tx.transaction_date, trip.start_date, trip.end_date);
    const belongs = override?.mode === "include" || (inWindow && tx.type === "expense");
    if (!belongs) continue;

    const amount = Math.abs(Number(tx.amount_usd) || 0);
    entries.push({
      transaction: tx,
      signedUSD: tx.type === "income" ? -amount : amount,
      inWindow,
      isPrepaid: tx.transaction_date < trip.start_date,
      isAfter: tx.transaction_date > trip.end_date,
      override: override?.mode ?? null,
      reason: override?.reason ?? null,
    });
  }

  return entries.sort((a, b) =>
    a.transaction.transaction_date.localeCompare(b.transaction.transaction_date)
  );
}

function bucketise(
  entries: TripEntry[],
  spend: number,
  keyOf: (e: TripEntry) => { id: string; name: string }
): TripBucket[] {
  const map = new Map<string, TripBucket>();
  for (const entry of entries) {
    // Los reembolsos no forman su propia categoría: descuentan de donde salió el gasto, y si
    // no se sabe de dónde, quedan fuera del reparto en vez de inventar una porción negativa.
    if (entry.signedUSD <= 0) continue;
    const { id, name } = keyOf(entry);
    const bucket = map.get(id) ?? { id, name, total: 0, count: 0, share: 0 };
    bucket.total += entry.signedUSD;
    bucket.count += 1;
    map.set(id, bucket);
  }
  return [...map.values()]
    .map((b) => ({ ...b, total: round2(b.total), share: spend > 0 ? b.total / spend : 0 }))
    .sort((a, b) => b.total - a.total);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function summariseTrip(
  trip: Trip,
  transactions: Transaction[],
  items: TripItem[] = [],
  categories: Category[] = [],
  paymentMethods: PaymentMethod[] = []
): TripSummary {
  const entries = resolveTripEntries(trip, transactions, items);
  const days = tripDayCount(trip.start_date, trip.end_date);

  let spend = 0;
  let refunds = 0;
  let prepaid = 0;
  let onTrip = 0;
  let after = 0;

  for (const e of entries) {
    if (e.signedUSD >= 0) spend += e.signedUSD;
    else refunds += -e.signedUSD;

    // El tramo se decide por la fecha, no por el signo: un reembolso acreditado al volver
    // pertenece al tramo de después, en negativo.
    if (e.isPrepaid) prepaid += e.signedUSD;
    else if (e.isAfter) after += e.signedUSD;
    else onTrip += e.signedUSD;
  }

  const categoryName = new Map(categories.map((c) => [c.id, c.name]));
  const methodName = new Map(paymentMethods.map((p) => [p.id, p.name]));

  const byCategory = bucketise(entries, spend, (e) => {
    const id = e.transaction.category_id;
    return id
      ? { id, name: categoryName.get(id) ?? SIN_CATEGORIA }
      : { id: "none", name: SIN_CATEGORIA };
  });
  const byPaymentMethod = bucketise(entries, spend, (e) => {
    const id = e.transaction.payment_method_id;
    return id ? { id, name: methodName.get(id) ?? SIN_MEDIO } : { id: "none", name: SIN_MEDIO };
  });

  // Serie diaria sobre el rango completo: los días en cero son parte del relato, y sin ellos
  // la curva comprime el tiempo y exagera el ritmo.
  const perDate = new Map<string, { spend: number; refunds: number }>();
  for (const e of entries) {
    if (e.isPrepaid) continue; // va en la base del acumulado, no en un día
    // Lo que impactó después de volver se imputa al último día del viaje. Sin esto la curva
    // cerraba en una cifra distinta del titular —el tax free acreditado al volver quedaba
    // sólo en el número de arriba— y dos números que tienen que ser el mismo no lo eran.
    const date = e.isAfter ? trip.end_date : e.transaction.transaction_date;
    const slot = perDate.get(date) ?? { spend: 0, refunds: 0 };
    if (e.signedUSD >= 0) slot.spend += e.signedUSD;
    else slot.refunds += -e.signedUSD;
    perDate.set(date, slot);
  }

  // El prepago no tiene un día dentro del viaje, así que arranca como base del acumulado:
  // la curva empieza en lo que el viaje ya costaba antes de salir.
  let running = prepaid;
  const daily: TripDay[] = tripDateRange(trip.start_date, trip.end_date).map((date) => {
    const slot = perDate.get(date) ?? { spend: 0, refunds: 0 };
    const net = slot.spend - slot.refunds;
    running += net;
    return {
      date,
      spend: round2(slot.spend),
      refunds: round2(slot.refunds),
      net: round2(net),
      cumulative: round2(running),
    };
  });

  const byWeek: TripWeek[] = [];
  for (let i = 0; i < daily.length; i += 7) {
    const chunk = daily.slice(i, i + 7);
    byWeek.push({
      index: byWeek.length + 1,
      start: chunk[0].date,
      end: chunk[chunk.length - 1].date,
      spend: round2(chunk.reduce((sum, d) => sum + d.spend, 0)),
    });
  }

  const spendDays = daily.filter((d) => d.spend > 0);
  const biggestDay = spendDays.reduce<{ date: string; total: number } | null>(
    (best, d) => (best && best.total >= d.spend ? best : { date: d.date, total: d.spend }),
    null
  );

  const topExpenses = entries
    .filter((e) => e.signedUSD > 0)
    .sort((a, b) => b.signedUSD - a.signedUSD)
    .slice(0, 10);

  return {
    entries,
    days,
    spend: round2(spend),
    refunds: round2(refunds),
    net: round2(spend - refunds),
    prepaid: round2(prepaid),
    onTrip: round2(onTrip),
    after: round2(after),
    perDay: round2(onTrip / days),
    daysWithSpend: spendDays.length,
    quietDays: days - spendDays.length,
    byCategory,
    byPaymentMethod,
    daily,
    byWeek,
    biggestDay,
    topExpenses,
  };
}
