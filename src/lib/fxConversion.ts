/**
 * Converting a captured amount into the USD figure the ledger stores.
 *
 * Every `transactions.amount_usd` is dollars. Getting here wrong does not look like a bug in the
 * UI — it looks like a real expense — so this is deliberately strict: an amount that cannot be
 * converted with a rate we actually have is rejected, never stored at face value.
 *
 * The failure this replaces: an AR$10.481 electricity bill was written as US$10.481, with
 * `fx_rate: 1` and `fx_source: 'dolarapi_mep'` — a row claiming it had been converted at the MEP
 * rate while carrying no conversion at all.
 */

/** Currencies the extractor is allowed to emit. */
export type CapturedCurrency = "USD" | "ARS" | "EUR" | "BRL";

export interface ConversionInput {
  /** Amount as captured, in `currency`. */
  amount: number;
  currency: string | null | undefined;
  /** ARS per USD (the MEP rate). 0 or absent means "no rate available". */
  arsPerUsd?: number | null;
}

/**
 * Discriminated on a string rather than a boolean: this project compiles with
 * `strictNullChecks: false`, under which TypeScript does not narrow a union by a boolean
 * literal property, so callers could not reach `reason` after checking the flag.
 */
export type ConversionResult =
  | {
      status: "ok";
      amountUSD: number;
      /** Units of `currency` per USD. 1 for a native USD amount. */
      fxRate: number;
      /** Where the rate came from. Only ever claims a source that was actually used. */
      fxSource: "native_usd" | "dolarapi_mep";
    }
  | { status: "unconvertible"; reason: string };

const CENTS = 100;

/**
 * Resolves the USD amount for a captured transaction.
 *
 * Note what this function does *not* accept: an `amount_usd` supplied by the extraction model.
 * That field is documented in the extractor's schema as "estimated or direct", i.e. a guess made
 * by a model with no access to a live rate, and it used to take precedence over this conversion.
 * The rate we fetch wins; the model's arithmetic does not get a vote.
 */
export function resolveTransactionAmountUSD(input: ConversionInput): ConversionResult {
  const amount = Number(input.amount);
  if (!Number.isFinite(amount)) {
    return { status: "unconvertible", reason: "El monto no es un número válido." };
  }

  const currency = String(input.currency ?? "USD").toUpperCase();

  if (currency === "USD") {
    return {
      status: "ok",
      amountUSD: Math.round(amount * CENTS) / CENTS,
      fxRate: 1,
      fxSource: "native_usd",
    };
  }

  if (currency === "ARS") {
    const rate = Number(input.arsPerUsd);
    if (!Number.isFinite(rate) || rate <= 0) {
      // Storing it anyway is what produced a peso amount sitting in a dollar column.
      return {
        status: "unconvertible",
        reason:
          "No hay cotización del dólar disponible para convertir un monto en pesos. " +
          "Reintentá en unos segundos.",
      };
    }
    return {
      status: "ok",
      amountUSD: Math.round((amount / rate) * CENTS) / CENTS,
      fxRate: rate,
      fxSource: "dolarapi_mep",
    };
  }

  // EUR and BRL reach here: the extractor can emit them and we hold no rate for either. They
  // used to fall through the `currency === "ARS"` check and be written as if they were dollars.
  return {
    status: "unconvertible",
    reason: `No hay cotización disponible para convertir montos en ${currency}.`,
  };
}
