import { describe, it, expect } from "vitest";
import { normalizeLineItems, reconcileReceipt, toNum } from "@/lib/receiptItems";

describe("toNum", () => {
  it("acepta el decimal con coma que devuelve el extractor leyendo tickets argentinos", () => {
    expect(toNum("0,884")).toBe(0.884);
    expect(toNum(1720)).toBe(1720);
  });

  it("no inventa un cero cuando el dato no es un numero", () => {
    // Number("") es 0, no NaN: si esto devolviera 0, un renglon ilegible entraria como
    // producto gratis y la suma del ticket cerraria mal sin que nada lo marque.
    expect(toNum("")).toBeNull();
    expect(toNum("s/d")).toBeNull();
    expect(toNum(undefined)).toBeNull();
    expect(toNum(null)).toBeNull();
  });
});

describe("normalizeLineItems", () => {
  it("guarda cantidad, unidad y precio unitario tal como estan impresos", () => {
    const [item] = normalizeLineItems(
      [
        {
          description: "Roast beef",
          raw_description: "ROAST BEEF CHIRRIADO NOVILLITO",
          quantity: "0,884",
          unit: "kg",
          unit_price: 16905,
          line_total: 14947,
        },
      ],
      "ARS",
    );

    expect(item).toMatchObject({
      description: "Roast beef",
      raw_description: "ROAST BEEF CHIRRIADO NOVILLITO",
      quantity: 0.884,
      unit: "kg",
      unit_price: 16905,
      line_total: 14947,
      currency: "ARS",
    });
  });

  it("no convierte los importes a dolares: el renglon queda en la moneda del ticket", () => {
    const [item] = normalizeLineItems([{ description: "Yerba", line_total: 5160 }], "ars");
    expect(item.line_total).toBe(5160);
    expect(item.currency).toBe("ARS");
  });

  it("descarta el ruido de OCR en vez de guardarlo como producto", () => {
    const items = normalizeLineItems(
      [
        { description: "Galletitas Copler", line_total: 3400.8 },
        { description: "   ", line_total: 999 },
        { description: "Linea ilegible", line_total: "???" },
        { raw_description: "PAN DE VIENA", line_total: 5960 },
      ],
      "ARS",
    );

    // Sobreviven la fila buena y la que solo trae el texto crudo; las otras dos ensuciarian
    // la busqueda por producto, que es justo para lo que se guarda el detalle.
    expect(items.map((i) => i.description)).toEqual(["Galletitas Copler", "PAN DE VIENA"]);
  });

  it("devuelve vacio cuando el comprobante no tiene renglones", () => {
    expect(normalizeLineItems(undefined, "ARS")).toEqual([]);
    expect(normalizeLineItems([], "ARS")).toEqual([]);
  });
});

describe("reconcileReceipt", () => {
  const items = [{ line_total: 75050.64 }];

  it("no marca nada cuando el total impreso se explica con los descuentos del pie", () => {
    // El ticket de Disco: 75.050,64 de renglones − 4.356,75 de descuentos = 70.693,89 impreso.
    const r = reconcileReceipt(items, {
      discounts_total: 4356.75,
      printed_total: 70693.89,
    });

    expect(r.expected).toBeCloseTo(70693.89, 2);
    expect(r.unexplained).toBe(false);
  });

  it("marca la brecha cuando falta un renglon que el total impreso si contaba", () => {
    const r = reconcileReceipt([{ line_total: 50000 }], {
      discounts_total: 0,
      printed_total: 70693.89,
    });

    expect(r.gap).toBeCloseTo(20693.89, 2);
    expect(r.unexplained).toBe(true);
  });

  it("tolera el redondeo del IVA sin pintar todo de amarillo", () => {
    const r = reconcileReceipt([{ line_total: 70693.89 }], { printed_total: 70695 });
    expect(r.unexplained).toBe(false);
  });

  it("con la foto cortada no hay total impreso contra el cual conciliar", () => {
    // El caso Carrefour: la imagen corta en la seccion de descuentos. La suma de lo visible es
    // lo unico que hay, y no alcanza para afirmar que el gasto fue ese.
    const r = reconcileReceipt([{ line_total: 57658.05 }], { is_truncated: true });

    expect(r.printed).toBe(0);
    expect(r.gap).toBe(0);
    expect(r.unexplained).toBe(false);
    expect(r.isTruncated).toBe(true);
  });
});
