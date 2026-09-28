import { describe, it, expect } from "vitest";
import { parseAmountInput, planAdjustments, daysSince } from "@/lib/balanceAdjustment";

describe("parseAmountInput", () => {
  // Leer mal un monto mueve el patrimonio sin que la pantalla lo delate.
  it("entiende las dos convenciones de separadores", () => {
    expect(parseAmountInput("1.234,56")).toBe(1234.56);
    expect(parseAmountInput("1,234.56")).toBe(1234.56);
    expect(parseAmountInput("1234,5")).toBe(1234.5);
    expect(parseAmountInput("1234.56")).toBe(1234.56);
  });

  it("un separador seguido de tres dígitos es de miles, no decimal", () => {
    expect(parseAmountInput("1.500")).toBe(1500);
    expect(parseAmountInput("1,500")).toBe(1500);
    expect(parseAmountInput("1.580.294")).toBe(1580294);
  });

  it("acepta símbolos de moneda, espacios y negativos", () => {
    expect(parseAmountInput("US$ 2.476,23")).toBe(2476.23);
    expect(parseAmountInput("$ 150000")).toBe(150000);
    expect(parseAmountInput("-35,5")).toBe(-35.5);
  });

  // Vacío es "no tocar esta cuenta"; convertirlo en cero la vaciaría.
  it("vacío o basura es null, no cero", () => {
    expect(parseAmountInput("")).toBeNull();
    expect(parseAmountInput("   ")).toBeNull();
    expect(parseAmountInput("abc")).toBeNull();
    expect(parseAmountInput("12a")).toBeNull();
  });

  it("cero tipeado sí es cero", () => {
    expect(parseAmountInput("0")).toBe(0);
  });
});

describe("planAdjustments", () => {
  it("manda sólo las cuentas con un saldo nuevo y distinto", () => {
    const plan = planAdjustments([
      { accountId: "a", current: -4636.23, input: "120" },
      { accountId: "b", current: 686, input: "686" },
      { accountId: "c", current: 50, input: "" },
      { accountId: "d", current: 10, input: "xx" },
    ]);
    expect(plan).toEqual([{ accountId: "a", before: -4636.23, after: 120, delta: 4756.23 }]);
  });

  it("no guarda diferencias de redondeo", () => {
    expect(planAdjustments([{ accountId: "a", current: 10.001, input: "10" }])).toEqual([]);
  });

  it("poner una cuenta en cero es un ajuste válido", () => {
    expect(planAdjustments([{ accountId: "a", current: 3631, input: "0" }])[0].delta).toBe(-3631);
  });
});

describe("daysSince", () => {
  it("cuenta días enteros y null si nunca se ajustó", () => {
    const now = new Date("2026-09-28T12:00:00Z");
    expect(daysSince("2026-09-18T13:00:00Z", now)).toBe(9);
    expect(daysSince(null, now)).toBeNull();
  });
});
