// Watchlist of tickers the user doesn't own yet (live quotes are fetched by callers).
// Shared by the demo prototype, the production /watchlist page, and the watch view.
export interface WatchItem {
  symbol: string;
  name: string;
}

const WATCH_UNIVERSE: WatchItem[] = [
  { symbol: "VOO", name: "Vanguard S&P 500 ETF" },
  { symbol: "NVDA", name: "NVIDIA Corp." },
  { symbol: "TSLA", name: "Tesla, Inc." },
  { symbol: "KO", name: "The Coca-Cola Company" },
  { symbol: "MELI", name: "MercadoLibre, Inc." },
  { symbol: "AMZN", name: "Amazon.com, Inc." },
];

export function makeWatchlist(ownedSymbols: string[]): WatchItem[] {
  const owned = new Set(ownedSymbols.map((s) => s.toUpperCase()));
  return WATCH_UNIVERSE.filter((w) => !owned.has(w.symbol));
}
