/**
 * Lo que decide un ajuste de saldo, fuera del diálogo para poder probarlo.
 *
 * El diálogo pide el saldo real de cada cuenta. De lo que se tipea depende cuánto se mueve el
 * patrimonio, así que leerlo mal no se nota en la pantalla: se nota al conciliar. "1.500" en
 * una cuenta en pesos son mil quinientos, no uno y medio.
 */

/**
 * Un monto tipeado a mano, en cualquiera de las dos convenciones.
 *
 * El separador decimal es el ÚLTIMO de los dos que aparezca, y sólo si le siguen uno o dos
 * dígitos: "1.234,56" y "1,234.56" son lo mismo, "1.500" y "1,500" son mil quinientos.
 * Devuelve null si no es un número — un campo vacío es "esta cuenta no se toca", no un cero.
 */
export function parseAmountInput(raw: string): number | null {
  const s = raw.trim().replace(/\s|US\$|\$/g, "");
  if (!s) return null;
  const negative = s.startsWith("-");
  const body = negative ? s.slice(1) : s;
  if (!/^[\d.,]+$/.test(body)) return null;

  const lastSep = Math.max(body.lastIndexOf("."), body.lastIndexOf(","));
  let intPart = body;
  let decPart = "";
  if (lastSep !== -1) {
    const tail = body.slice(lastSep + 1);
    const seps = body.match(/[.,]/g) ?? [];
    const sameSepRepeated = seps.length > 1 && seps.every((c) => c === body[lastSep]);
    // Uno o dos dígitos al final, y que ese separador no se repita como separador de miles.
    if (tail.length >= 1 && tail.length <= 2 && !sameSepRepeated) {
      intPart = body.slice(0, lastSep);
      decPart = tail;
    }
  }
  const digits = intPart.replace(/[.,]/g, "");
  if (!digits && !decPart) return null;
  const n = Number(`${digits || "0"}.${decPart || "0"}`);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export interface AdjustmentDraft {
  accountId: string;
  current: number;
  input: string;
}

export interface PlannedAdjustment {
  accountId: string;
  before: number;
  after: number;
  delta: number;
}

/**
 * Qué cuentas se ajustan: las que tienen un número válido y distinto del saldo actual.
 *
 * Una diferencia de menos de medio centavo no se manda: guardarla llenaría el historial de
 * "ajustes" de redondeo que no le dicen nada a nadie.
 */
export function planAdjustments(drafts: AdjustmentDraft[]): PlannedAdjustment[] {
  const out: PlannedAdjustment[] = [];
  for (const d of drafts) {
    const after = parseAmountInput(d.input);
    if (after === null) continue;
    const delta = Math.round((after - d.current) * 100) / 100;
    if (Math.abs(delta) < 0.005) continue;
    out.push({ accountId: d.accountId, before: d.current, after, delta });
  }
  return out;
}

/** Días desde el último ajuste, o null si nunca se ajustó. */
export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.floor((now.getTime() - t) / 86400000));
}
