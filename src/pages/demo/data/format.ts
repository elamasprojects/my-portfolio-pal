// Demo-local formatters (mirrors the pattern in src/pages/Index.tsx:56-65, kept isolated).
import { convertUsdToArs } from "@/hooks/useDolarMEP";
import type { DemoCurrency, Formatters } from "./types";

export function makeFormatters(currency: DemoCurrency, mepRate: number): Formatters {
  const isARS = currency === "ARS";
  const cx = (usd: number) => (isARS ? convertUsdToArs(usd, mepRate) : usd);
  const currencySymbol = isARS ? "ARS$" : "$";
  const fmt = (v: number) =>
    `${currencySymbol}${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtCompact = (v: number) => {
    const abs = Math.abs(v);
    if (abs >= 1_000_000) return `${currencySymbol}${(v / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${currencySymbol}${(v / 1_000).toFixed(1)}K`;
    return fmt(v);
  };
  return { fmt, fmtCompact, cx, currencySymbol };
}

/** Signed percent, e.g. +1.8% / -2.3% */
export function signedPct(v: number, digits = 1): string {
  return `${v >= 0 ? "+" : ""}${v.toFixed(digits)}%`;
}

/** Signed prefix for a pre-formatted currency string. */
export function sign(v: number): string {
  return v >= 0 ? "+" : "";
}
