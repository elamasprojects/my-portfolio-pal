import type { NewTransactionItem } from "@/hooks/useFinance";
import type { ReceiptMeta } from "@/types/finance";

/** Un renglon tal como lo devuelve `extract-finance-input`: todo opcional, todo sospechoso. */
export interface ExtractedLineItem {
  description?: string;
  raw_description?: string;
  quantity?: number | string;
  unit?: string;
  unit_price?: number | string;
  line_total?: number | string;
  discount?: number | string;
  category_hint?: string;
}

/**
 * El rubro de un producto, cerrado a proposito.
 *
 * Si esto fuera texto libre el modelo escribiria "carniceria" hoy, "carne" mañana y "meat"
 * pasado, y la pregunta que justifica guardar el detalle -- en que rubro se me va la plata del
 * super -- daria tres respuestas distintas para lo mismo. Un set cerrado nace sucio o no nace;
 * limpiarlo despues, sobre cientos de tickets, es mucho mas caro que acotarlo ahora.
 *
 * El corte es por gondola de supermercado argentino, no por nutriente: es como esta impreso el
 * ticket y como uno piensa la compra.
 */
export const PRODUCT_CATEGORIES = [
  "carniceria",
  "verduleria",
  "fiambreria",
  "lacteos",
  "panaderia",
  "almacen",
  "congelados",
  "bebidas",
  "alcohol",
  "limpieza",
  "perfumeria",
  "mascotas",
  "bazar",
  "otros",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

/**
 * Lo que el modelo suele escribir cuando se sale del set. No es una taxonomia paralela: es el
 * colchon para que un sinonimo obvio no termine en `otros` y desaparezca de la metrica.
 */
const CATEGORY_ALIASES: Record<string, ProductCategory> = {
  carne: "carniceria",
  carnes: "carniceria",
  pollo: "carniceria",
  meat: "carniceria",
  achuras: "carniceria",
  frutas: "verduleria",
  verduras: "verduleria",
  "frutas y verduras": "verduleria",
  produce: "verduleria",
  fiambres: "fiambreria",
  quesos: "fiambreria",
  lacteo: "lacteos",
  leche: "lacteos",
  dairy: "lacteos",
  huevos: "lacteos",
  pan: "panaderia",
  bakery: "panaderia",
  secos: "almacen",
  despensa: "almacen",
  pantry: "almacen",
  groceries: "almacen",
  congelado: "congelados",
  frozen: "congelados",
  bebida: "bebidas",
  gaseosas: "bebidas",
  drinks: "bebidas",
  vinos: "alcohol",
  vino: "alcohol",
  cerveza: "alcohol",
  bebidas_alcoholicas: "alcohol",
  "bebidas alcoholicas": "alcohol",
  cleaning: "limpieza",
  higiene: "perfumeria",
  "higiene personal": "perfumeria",
  tocador: "perfumeria",
  cosmetica: "perfumeria",
  mascota: "mascotas",
  pets: "mascotas",
  hogar: "bazar",
  otro: "otros",
  other: "otros",
};

/**
 * Lleva lo que dijo el modelo al set cerrado. Lo que no entra devuelve null, no "otros": un
 * rubro que no se pudo determinar y un rubro que es genuinamente "otros" son cosas distintas,
 * y mezclarlos infla la unica categoria que no se puede accionar.
 */
export function normalizeProductCategory(raw?: string | null): ProductCategory | null {
  if (!raw) return null;
  const key = raw
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if ((PRODUCT_CATEGORIES as readonly string[]).includes(key)) return key as ProductCategory;
  return CATEGORY_ALIASES[key] ?? null;
}

/** El extractor emite numeros o strings segun el dia; lo que no sea numero no se inventa. */
export function toNum(v: number | string | undefined | null): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * Pasa los renglones leidos a filas listas para `transaction_items`.
 *
 * Los importes NO se convierten a dolares: quedan en la moneda del ticket, que es como estan
 * impresos y como se pueden verificar contra la foto. El equivalente en USD lo guarda la fila
 * madre una sola vez, con su `fx_rate`; hacerlo renglon por renglon daria una columna de
 * numeros que no figura en ningun papel y que ademas no sumaria el total por redondeo.
 */
export function normalizeLineItems(
  raw: ExtractedLineItem[] | undefined | null,
  currency: string,
): NewTransactionItem[] {
  return (raw || [])
    .map((li) => ({
      description: (li.description || li.raw_description || "").trim(),
      raw_description: li.raw_description ?? null,
      quantity: toNum(li.quantity),
      unit: li.unit ?? null,
      unit_price: toNum(li.unit_price),
      line_total: toNum(li.line_total) ?? Number.NaN,
      discount: toNum(li.discount),
      category_hint: normalizeProductCategory(li.category_hint),
      currency: (currency || "ARS").toUpperCase(),
    }))
    // Un renglon sin nombre o sin importe no es un renglon: es ruido de OCR, y guardarlo
    // ensucia justo la busqueda por producto que motiva guardar el detalle.
    .filter((li) => li.description.length > 0 && Number.isFinite(li.line_total));
}

export interface ReceiptReconciliation {
  /** Suma de los renglones, en la moneda del ticket. */
  sum: number;
  /** Lo que los renglones deberian dar una vez aplicados los descuentos del pie. */
  expected: number;
  discounts: number;
  /** El TOTAL impreso, o 0 cuando no se pudo leer (foto cortada). */
  printed: number;
  /** printed − expected. Positivo: falta un renglon. Negativo: se leyo uno de mas. */
  gap: number;
  /** La brecha no se explica con los descuentos impresos y hay que mirarla. */
  unexplained: boolean;
  isTruncated: boolean;
}

/**
 * Compara la suma de los renglones contra el total impreso.
 *
 * En un ticket argentino los dos numeros casi nunca coinciden: los descuentos se aplican al
 * pie, no linea por linea. Eso esta bien y por eso se restan antes de comparar. Lo que no esta
 * bien es una foto cortada -- ahi la diferencia es plata que no se ve y el total cargado queda
 * corto, que es exactamente el caso del ticket de Carrefour que disparo todo esto.
 *
 * La tolerancia es medio punto porcentual (minimo 1 en la moneda del ticket) para no marcar en
 * amarillo el redondeo del IVA de cada linea.
 */
export function reconcileReceipt(
  items: Pick<NewTransactionItem, "line_total">[],
  meta?: ReceiptMeta | null,
): ReceiptReconciliation {
  const sum = items.reduce((acc, it) => acc + (Number(it.line_total) || 0), 0);
  const discounts = Number(meta?.discounts_total) || 0;
  const printed = Number(meta?.printed_total) || 0;
  const expected = sum - discounts;
  const gap = printed > 0 ? printed - expected : 0;

  return {
    sum,
    expected,
    discounts,
    printed,
    gap,
    unexplained: printed > 0 && Math.abs(gap) > Math.max(1, printed * 0.005),
    isTruncated: Boolean(meta?.is_truncated),
  };
}
