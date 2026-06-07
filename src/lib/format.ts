// Shared currency formatters (USD / ARS via MEP). Single source of truth for the
// $-symbol + K/M-abbreviation rules used by the dashboard, demo, and watch.
import { convertUsdToArs } from "@/hooks/useDolarMEP";

export type Currency = "USD" | "ARS";

export interface Formatters {
  fmt: (v: number) => string;
  fmtCompact: (v: number) => string;
  cx: (usd: number) => number;
  currencySymbol: string;
}

export function makeFormatters(currency: Currency, mepRate: number): Formatters {
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
