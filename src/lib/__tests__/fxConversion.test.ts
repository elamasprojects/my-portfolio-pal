import { describe, it, expect } from "vitest";
import { resolveTransactionAmountUSD } from "@/lib/fxConversion";

/**
 * Regression cover for an AR$10.481 electricity bill stored as US$10.481.
 *
 * The row carried `fx_rate: 1` and `fx_source: 'dolarapi_mep'` — it claimed a MEP conversion it
 * never performed — so nothing about the stored data revealed the error.
 */
describe("resolveTransactionAmountUSD", () => {
  const MEP = 1543.6;

  it("converts a peso amount at the given rate", () => {
    const r = resolveTransactionAmountUSD({ amount: 10481, currency: "ARS", arsPerUsd: MEP });

    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    // 10481 / 1543.6 = 6.79, not 10481.
    expect(r.amountUSD).toBe(6.79);
    expect(r.fxRate).toBe(MEP);
    expect(r.fxSource).toBe("dolarapi_mep");
  });

  it("rejects a peso amount when no rate is available", () => {
    for (const arsPerUsd of [0, null, undefined, NaN, -1]) {
      const r = resolveTransactionAmountUSD({ amount: 10481, currency: "ARS", arsPerUsd });
      expect(r.status).toBe("unconvertible");
    }
  });

  it("leaves a dollar amount alone and reports it as native", () => {
    const r = resolveTransactionAmountUSD({ amount: 55.56, currency: "USD", arsPerUsd: MEP });

    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.amountUSD).toBe(55.56);
    expect(r.fxRate).toBe(1);
    expect(r.fxSource).toBe("native_usd");
  });

  it("treats a missing currency as USD", () => {
    const r = resolveTransactionAmountUSD({ amount: 10, currency: null });
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.amountUSD).toBe(10);
  });

  it("is case-insensitive about the currency code", () => {
    const r = resolveTransactionAmountUSD({ amount: 1543.6, currency: "ars", arsPerUsd: MEP });
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.amountUSD).toBe(1);
  });

  it("refuses a currency it holds no rate for instead of assuming dollars", () => {
    // These used to fall past the ARS branch and be written at face value as USD.
    for (const currency of ["EUR", "BRL"]) {
      const r = resolveTransactionAmountUSD({ amount: 100, currency, arsPerUsd: MEP });
      expect(r.status).toBe("unconvertible");
      if (r.status === "ok") return;
      expect(r.reason).toContain(currency);
    }
  });

  it("rejects a non-numeric amount", () => {
    const r = resolveTransactionAmountUSD({ amount: Number("abc"), currency: "USD" });
    expect(r.status).toBe("unconvertible");
  });

  it("rounds to cents", () => {
    const r = resolveTransactionAmountUSD({ amount: 1000, currency: "ARS", arsPerUsd: 3 });
    expect(r.status).toBe("ok");
    if (r.status !== "ok") return;
    expect(r.amountUSD).toBe(333.33);
  });

  it("never reports a source it did not use", () => {
    const usd = resolveTransactionAmountUSD({ amount: 10, currency: "USD", arsPerUsd: MEP });
    expect(usd.status === "ok" && usd.fxSource).toBe("native_usd");

    const ars = resolveTransactionAmountUSD({ amount: 10, currency: "ARS", arsPerUsd: MEP });
    expect(ars.status === "ok" && ars.fxSource).toBe("dolarapi_mep");
  });
});
