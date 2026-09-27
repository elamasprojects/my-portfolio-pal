import { describe, it, expect } from "vitest";
import type { Transaction } from "@/types/finance";
import {
  resolvePeriod,
  previousPeriod,
  flowTotals,
  categoryBreakdown,
  buildPeriodSeries,
  isInRange,
} from "@/lib/financePeriods";

const NOW = new Date(2026, 8, 27, 15, 0); // 27/09/2026

let n = 0;
function tx(date: string, type: string, usd: number, extra: Partial<Transaction> = {}): Transaction {
  return {
    id: `t${n++}`,
    user_id: "u",
    type,
    name: "x",
    amount_usd: usd,
    transaction_date: date,
    ...extra,
  } as unknown as Transaction;
}

const ymd = (d?: Date) => (d ? `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}` : undefined);

describe("resolvePeriod / previousPeriod", () => {
  it("mes actual es el mes de calendario entero y se compara contra el anterior completo", () => {
    const r = resolvePeriod("this_month", NOW);
    expect(ymd(r.start)).toBe("2026-9-1");
    expect(ymd(r.end)).toBe("2026-9-30");
    const p = previousPeriod("this_month", NOW)!;
    expect(ymd(p.start)).toBe("2026-8-1");
    expect(ymd(p.end)).toBe("2026-8-31");
  });

  it("mes anterior se compara contra el anterior al anterior", () => {
    const p = previousPeriod("last_month", NOW)!;
    expect(ymd(p.start)).toBe("2026-7-1");
    expect(ymd(p.end)).toBe("2026-7-31");
  });

  // Comparar nueve meses contra doce siempre daría que este año se gasta menos.
  it("el año en curso se compara contra el mismo tramo del año pasado, no el año entero", () => {
    const p = previousPeriod("ytd", NOW)!;
    expect(ymd(p.start)).toBe("2025-1-1");
    expect(ymd(p.end)).toBe("2025-9-27");
  });

  it("un 29/2 compara contra el 28/2 del año anterior, no contra el 1/3", () => {
    const p = previousPeriod("ytd", new Date(2028, 1, 29))!;
    expect(ymd(p.end)).toBe("2027-2-28");
  });

  // El feed ya contaba así la ventana: hoy y los 29 días anteriores.
  it("últimos 30 días incluye hoy y 29 días atrás, y queda abierto hacia adelante", () => {
    const r = resolvePeriod("30d", NOW);
    expect(ymd(r.start)).toBe("2026-8-29");
    expect(r.end).toBeUndefined();
    expect(isInRange("2026-08-29", r)).toBe(true);
    expect(isInRange("2026-08-28", r)).toBe(false);
  });

  it("histórico no tiene contra qué compararse", () => {
    expect(resolvePeriod("all", NOW)).toEqual({});
    expect(previousPeriod("all", NOW)).toBeNull();
  });
});

describe("flowTotals", () => {
  // Si acá no contara como egreso, el margen daría distinto que el Excedente Neto del Sankey.
  it("cuenta las inversiones como egreso, igual que el Sankey", () => {
    const t = flowTotals(
      [tx("2026-09-10", "income", 100), tx("2026-09-11", "expense", 30), tx("2026-09-12", "investment", 20)],
      resolvePeriod("this_month", NOW),
    );
    expect(t).toEqual({ income: 100, expense: 50, margin: 50 });
  });

  it("ignora borrados, montos no positivos y filas fuera del rango", () => {
    const t = flowTotals(
      [
        tx("2026-09-10", "expense", 30, { deleted_at: "2026-09-11" } as Partial<Transaction>),
        tx("2026-09-10", "expense", 0),
        tx("2026-08-31", "expense", 99),
        tx("2026-09-01", "expense", 5),
      ],
      resolvePeriod("this_month", NOW),
    );
    expect(t.expense).toBe(5);
  });
});

describe("categoryBreakdown", () => {
  it("agrupa lo chico en Resto y ordena de mayor a menor", () => {
    const cats = ["a", "b", "c"].map((id) => ({ id, name: id.toUpperCase() })) as never[];
    const rows = [
      tx("2026-09-02", "expense", 10, { category_id: "a" }),
      tx("2026-09-02", "expense", 30, { category_id: "b" }),
      tx("2026-09-02", "expense", 5, { category_id: "c" }),
      tx("2026-09-02", "expense", 1),
    ];
    const slices = categoryBreakdown(rows, cats, resolvePeriod("this_month", NOW), "expense", 3);
    expect(slices).toEqual([
      { name: "B", value: 30 },
      { name: "A", value: 10 },
      { name: "Resto", value: 6 },
    ]);
  });
});

describe("buildPeriodSeries", () => {
  it("acumula por día, corta la línea actual en hoy y alinea el mes anterior día a día", () => {
    const rows = [
      tx("2026-09-01", "expense", 10),
      tx("2026-09-27", "expense", 5),
      tx("2026-08-01", "expense", 7),
      tx("2026-08-31", "expense", 3),
    ];
    const s = buildPeriodSeries(rows, "this_month", NOW);
    expect(s.granularity).toBe("day");
    // Agosto tiene 31 días: el eje llega al 31 para que la punteada no quede cortada.
    expect(s.points).toHaveLength(31);
    expect(s.points[0].expense).toBe(10);
    expect(s.points[26].expense).toBe(15);
    // El futuro no es cero: después de hoy la serie actual no tiene valor.
    expect(s.points[27].expense).toBeNull();
    expect(s.points[0].prevExpense).toBe(7);
    expect(s.points[30].prevExpense).toBe(10);
  });

  it("el margen es ingreso menos egreso acumulados", () => {
    const s = buildPeriodSeries(
      [tx("2026-09-02", "income", 100), tx("2026-09-03", "expense", 40)],
      "this_month",
      NOW,
    );
    expect(s.points[1].margin).toBe(100);
    expect(s.points[2].margin).toBe(60);
  });

  it("año en curso agrupa por mes y compara contra los mismos meses del año pasado", () => {
    const s = buildPeriodSeries(
      [tx("2026-01-15", "income", 50), tx("2025-01-10", "income", 20), tx("2025-12-10", "income", 999)],
      "ytd",
      NOW,
    );
    expect(s.granularity).toBe("month");
    expect(s.points).toHaveLength(9);
    expect(s.points[0].income).toBe(50);
    expect(s.points[0].prevIncome).toBe(20);
    // Diciembre 2025 está fuera del tramo comparable.
    expect(s.points[8].prevIncome).toBe(20);
  });

  it("histórico arranca en el primer movimiento y no tiene línea punteada", () => {
    const s = buildPeriodSeries([tx("2026-05-03", "expense", 1)], "all", NOW);
    expect(s.points).toHaveLength(5); // may..sep
    expect(s.points.every((p) => p.prevExpense === null)).toBe(true);
  });
});
