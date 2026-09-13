import { describe, it, expect } from "vitest";
import {
  resolveTripEntries,
  summariseTrip,
  tripDayCount,
  tripDateRange,
  type Trip,
  type TripItem,
} from "@/lib/tripSummary";
import type { Category, PaymentMethod, Transaction } from "@/types/finance";

/**
 * Lo que estas pruebas cuidan es una sola cosa: que el total del viaje no sea "lo que cayó
 * entre dos fechas". Las dos puntas que la ventana se equivoca —el vuelo pagado un mes antes
 * y la boleta de luz de casa que llegó en pleno viaje— son justo las que mueven la cifra.
 */

const trip: Trip = {
  id: "t1",
  user_id: "u1",
  name: "Europa 2026",
  destination: "Europa",
  start_date: "2026-06-24",
  end_date: "2026-09-08",
};

let seq = 0;
const tx = (over: Partial<Transaction> = {}): Transaction =>
  ({
    id: `tx-${++seq}`,
    user_id: "u1",
    type: "expense",
    name: "Gasto",
    amount_usd: 10,
    transaction_date: "2026-07-01",
    category_id: "c-food",
    payment_method_id: "p-1",
    source: "manual",
    confidence: "high",
    needs_review: false,
    created_at: "2026-07-01T00:00:00Z",
    ...over,
  }) as Transaction;

const categories = [
  { id: "c-food", name: "Food" },
  { id: "c-travel", name: "Travel" },
] as unknown as Category[];

const paymentMethods = [
  { id: "p-1", name: "DolarApp Credit Card" },
  { id: "p-2", name: "Mercado Pago" },
] as unknown as PaymentMethod[];

describe("tripDayCount / tripDateRange", () => {
  it("cuenta los dos extremos: del 24/06 al 08/09 son 77 días, no 76", () => {
    expect(tripDayCount("2026-06-24", "2026-09-08")).toBe(77);
    expect(tripDayCount("2026-06-24", "2026-06-24")).toBe(1);
  });

  it("no devuelve cero aunque las fechas estén al revés, para no dividir por cero", () => {
    expect(tripDayCount("2026-09-08", "2026-06-24")).toBe(1);
  });

  it("enumera cada día del rango, sin saltarse el cambio de mes", () => {
    const range = tripDateRange("2026-06-29", "2026-07-02");
    expect(range).toEqual(["2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02"]);
  });
});

describe("resolveTripEntries", () => {
  it("toma los gastos de la ventana y deja afuera los de antes y después", () => {
    const dentro = tx({ transaction_date: "2026-07-01" });
    const antes = tx({ transaction_date: "2026-06-23" });
    const despues = tx({ transaction_date: "2026-09-09" });

    const ids = resolveTripEntries(trip, [dentro, antes, despues]).map((e) => e.transaction.id);
    expect(ids).toEqual([dentro.id]);
  });

  it("trae lo prepago cuando se lo incluye a mano, y lo marca como tal", () => {
    // El vuelo se pagó un mes antes de salir: ninguna ventana que arranque el 24/06 lo alcanza.
    const vuelo = tx({ transaction_date: "2026-05-22", amount_usd: 1079, name: "Vuelo TAP" });
    const items: TripItem[] = [
      { id: "i1", trip_id: "t1", transaction_id: vuelo.id, mode: "include", reason: "Vuelo" },
    ];

    const [entry] = resolveTripEntries(trip, [vuelo], items);
    expect(entry.transaction.id).toBe(vuelo.id);
    expect(entry.isPrepaid).toBe(true);
    expect(entry.inWindow).toBe(false);
    expect(entry.reason).toBe("Vuelo");
  });

  it("saca lo de casa que cayó dentro de la ventana", () => {
    const luz = tx({ transaction_date: "2026-07-27", name: "Edesur", amount_usd: 24.68 });
    const items: TripItem[] = [
      { id: "i1", trip_id: "t1", transaction_id: luz.id, mode: "exclude", reason: "Casa" },
    ];

    expect(resolveTripEntries(trip, [luz], items)).toHaveLength(0);
  });

  it("ignora las excepciones de otro viaje", () => {
    const gasto = tx({ transaction_date: "2026-07-01" });
    const deOtroViaje: TripItem[] = [
      { id: "i1", trip_id: "OTRO", transaction_id: gasto.id, mode: "exclude" },
    ];

    expect(resolveTripEntries(trip, [gasto], deOtroViaje)).toHaveLength(1);
  });

  it("un ingreso de la ventana no entra solo: sería el sueldo contado como viaje", () => {
    // Durante el viaje entraron más de US$ 14.000 de trabajo. Si la ventana los arrastrara,
    // el resumen abriría diciendo que el viaje dejó ganancia.
    const sueldo = tx({ type: "income", amount_usd: 7765, name: "Ganancias UGC" });
    expect(resolveTripEntries(trip, [sueldo])).toHaveLength(0);
  });

  it("un reembolso incluido a mano descuenta, no suma", () => {
    const gasto = tx({ amount_usd: 100 });
    const reembolso = tx({ type: "income", amount_usd: 68.91, name: "Refund Globalblue" });
    const items: TripItem[] = [
      { id: "i1", trip_id: "t1", transaction_id: reembolso.id, mode: "include" },
    ];

    const entries = resolveTripEntries(trip, [gasto, reembolso], items);
    expect(entries.find((e) => e.transaction.id === reembolso.id)?.signedUSD).toBe(-68.91);
  });

  it("una transferencia no entra ni marcada: mover plata propia no es gasto", () => {
    const movida = tx({ type: "transfer", amount_usd: 500 });
    const items: TripItem[] = [
      { id: "i1", trip_id: "t1", transaction_id: movida.id, mode: "include" },
    ];
    expect(resolveTripEntries(trip, [movida], items)).toHaveLength(0);
  });

  it("no cuenta lo borrado", () => {
    const borrado = tx({ deleted_at: "2026-07-02T00:00:00Z" } as Partial<Transaction>);
    expect(resolveTripEntries(trip, [borrado])).toHaveLength(0);
  });
});

describe("summariseTrip", () => {
  it("separa lo prepago del gasto en destino, y sólo reparte el segundo por día", () => {
    const vuelo = tx({ transaction_date: "2026-05-22", amount_usd: 1000 });
    const enDestino = tx({ transaction_date: "2026-07-01", amount_usd: 77 });
    const items: TripItem[] = [
      { id: "i1", trip_id: "t1", transaction_id: vuelo.id, mode: "include" },
    ];

    const s = summariseTrip(trip, [vuelo, enDestino], items);
    expect(s.prepaid).toBe(1000);
    expect(s.onTrip).toBe(77);
    expect(s.spend).toBe(1077);
    // 77 en destino sobre 77 días: un dólar por día. Repartir también el vuelo daría 13,99,
    // que no describe ningún día del viaje.
    expect(s.perDay).toBe(1);
  });

  it("el neto descuenta los reembolsos del bruto", () => {
    const gasto = tx({ amount_usd: 200 });
    const reembolso = tx({ type: "income", amount_usd: 50 });
    const items: TripItem[] = [
      { id: "i1", trip_id: "t1", transaction_id: reembolso.id, mode: "include" },
    ];

    const s = summariseTrip(trip, [gasto, reembolso], items);
    expect(s.spend).toBe(200);
    expect(s.refunds).toBe(50);
    expect(s.net).toBe(150);
  });

  it("el acumulado arranca en lo prepago, no en cero", () => {
    const vuelo = tx({ transaction_date: "2026-05-22", amount_usd: 1000 });
    const primerDia = tx({ transaction_date: "2026-06-24", amount_usd: 40 });
    const items: TripItem[] = [
      { id: "i1", trip_id: "t1", transaction_id: vuelo.id, mode: "include" },
    ];

    const s = summariseTrip(trip, [vuelo, primerDia], items);
    expect(s.daily[0].date).toBe("2026-06-24");
    expect(s.daily[0].cumulative).toBe(1040);
    expect(s.daily[s.daily.length - 1].cumulative).toBe(1040);
  });

  it("la serie diaria cubre el rango entero, incluidos los días sin gasto", () => {
    const corto: Trip = { ...trip, start_date: "2026-07-01", end_date: "2026-07-05" };
    const s = summariseTrip(corto, [tx({ transaction_date: "2026-07-03", amount_usd: 30 })]);

    expect(s.daily).toHaveLength(5);
    expect(s.daysWithSpend).toBe(1);
    expect(s.quietDays).toBe(4);
    expect(s.daily.map((d) => d.spend)).toEqual([0, 0, 30, 0, 0]);
  });

  it("agrupa por categoría y por medio de pago con su participación", () => {
    const s = summariseTrip(
      trip,
      [
        tx({ amount_usd: 75, category_id: "c-travel", payment_method_id: "p-1" }),
        tx({ amount_usd: 25, category_id: "c-food", payment_method_id: "p-2" }),
      ],
      [],
      categories,
      paymentMethods
    );

    expect(s.byCategory[0]).toMatchObject({ name: "Travel", total: 75, count: 1, share: 0.75 });
    expect(s.byCategory[1]).toMatchObject({ name: "Food", total: 25 });
    expect(s.byPaymentMethod.map((b) => b.name)).toEqual([
      "DolarApp Credit Card",
      "Mercado Pago",
    ]);
  });

  it("un gasto sin categoría cae en su propio grupo en vez de desaparecer del reparto", () => {
    const s = summariseTrip(trip, [tx({ amount_usd: 40, category_id: null })], [], categories);
    expect(s.byCategory).toEqual([
      { id: "none", name: "Sin categoría", total: 40, count: 1, share: 1 },
    ]);
  });

  it("los reembolsos no arman una categoría negativa", () => {
    const reembolso = tx({ type: "income", amount_usd: 50, category_id: "c-food" });
    const items: TripItem[] = [
      { id: "i1", trip_id: "t1", transaction_id: reembolso.id, mode: "include" },
    ];
    const s = summariseTrip(trip, [tx({ amount_usd: 100 }), reembolso], items, [], []);

    expect(s.byCategory.every((b) => b.total > 0)).toBe(true);
    expect(s.byCategory.reduce((a, b) => a + b.total, 0)).toBe(100);
  });

  it("señala el día más caro y ordena los gastos más grandes", () => {
    const s = summariseTrip(trip, [
      tx({ transaction_date: "2026-07-01", amount_usd: 10 }),
      tx({ transaction_date: "2026-08-15", amount_usd: 300 }),
      tx({ transaction_date: "2026-08-15", amount_usd: 20 }),
    ]);

    expect(s.biggestDay).toEqual({ date: "2026-08-15", total: 320 });
    expect(s.topExpenses.map((e) => e.signedUSD)).toEqual([300, 20, 10]);
  });

  it("la curva termina exactamente en el titular, con reembolso tardío incluido", () => {
    // El tax free se acreditó cuatro días después de volver. Antes quedaba sólo en el número
    // de arriba y la curva cerraba US$ 79,94 más alto que el total que decía la pantalla.
    const vuelo = tx({ transaction_date: "2026-05-22", amount_usd: 1000 });
    const enDestino = tx({ transaction_date: "2026-07-01", amount_usd: 500 });
    const tardio = tx({ transaction_date: "2026-09-12", type: "income", amount_usd: 79.94 });
    const items: TripItem[] = [
      { id: "i1", trip_id: "t1", transaction_id: vuelo.id, mode: "include" },
      { id: "i2", trip_id: "t1", transaction_id: tardio.id, mode: "include" },
    ];

    const s = summariseTrip(trip, [vuelo, enDestino, tardio], items);

    expect(s.net).toBe(1420.06);
    expect(s.daily[s.daily.length - 1].cumulative).toBe(s.net);
    // Y se imputa al último día del viaje, no a uno inventado fuera del rango.
    expect(s.daily[s.daily.length - 1].date).toBe("2026-09-08");
    expect(s.daily[s.daily.length - 1].refunds).toBe(79.94);
  });

  it("los tres tramos suman el neto, sin que sobre ni falte nada", () => {
    const vuelo = tx({ transaction_date: "2026-05-22", amount_usd: 1000 });
    const enDestino = tx({ transaction_date: "2026-07-01", amount_usd: 500 });
    const reembolsoEnViaje = tx({ transaction_date: "2026-08-12", type: "income", amount_usd: 8.54 });
    const tardio = tx({ transaction_date: "2026-09-12", type: "income", amount_usd: 79.94 });
    const items: TripItem[] = [
      { id: "i1", trip_id: "t1", transaction_id: vuelo.id, mode: "include" },
      { id: "i2", trip_id: "t1", transaction_id: reembolsoEnViaje.id, mode: "include" },
      { id: "i3", trip_id: "t1", transaction_id: tardio.id, mode: "include" },
    ];

    const s = summariseTrip(trip, [vuelo, enDestino, reembolsoEnViaje, tardio], items);

    expect(s.prepaid).toBe(1000);
    expect(s.onTrip).toBe(491.46);
    expect(s.after).toBe(-79.94);
    expect(Math.round((s.prepaid + s.onTrip + s.after) * 100) / 100).toBe(s.net);
  });

  it("agrupa en semanas de siete días, y la última queda corta si el viaje no cierra justo", () => {
    // Del 01 al 10 de julio son 10 días: dos semanas, la segunda de tres.
    const corto: Trip = { ...trip, start_date: "2026-07-01", end_date: "2026-07-10" };
    const s = summariseTrip(corto, [
      tx({ transaction_date: "2026-07-02", amount_usd: 20 }),
      tx({ transaction_date: "2026-07-09", amount_usd: 5 }),
    ]);

    expect(s.byWeek).toEqual([
      { index: 1, start: "2026-07-01", end: "2026-07-07", spend: 20 },
      { index: 2, start: "2026-07-08", end: "2026-07-10", spend: 5 },
    ]);
  });

  it("sin gastos no inventa un día más caro ni divide por cero", () => {
    const s = summariseTrip(trip, []);
    expect(s.biggestDay).toBeNull();
    expect(s.perDay).toBe(0);
    expect(s.net).toBe(0);
  });
});
