const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Symbols that are genuinely crypto. The CoinGecko lookup is restricted to this list.
 *
 * It used to be a blanket fallback: any symbol Finnhub could not price was lowercased and asked
 * of CoinGecko as a coin id. A BYMA ticker that happens to collide with a token name would then
 * come back with that token's price, presented as the stock's, with no signal that anything
 * went wrong.
 */
const CRYPTO_IDS: Record<string, string> = {
  btc: 'bitcoin', bitcoin: 'bitcoin', eth: 'ethereum', ethereum: 'ethereum',
  sol: 'solana', ada: 'cardano', xrp: 'ripple', dot: 'polkadot',
  doge: 'dogecoin', avax: 'avalanche-2', matic: 'matic-network',
  link: 'chainlink', uni: 'uniswap', ltc: 'litecoin', atom: 'cosmos',
  near: 'near', apt: 'aptos', arb: 'arbitrum', op: 'optimism',
  sui: 'sui', bnb: 'binancecoin', shib: 'shiba-inu',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, assetType } = await req.json();
    if (!symbol) {
      return json({ error: 'Symbol required' }, 400);
    }

    const apiKey = Deno.env.get('finnhub_api_key');
    const upper = String(symbol).toUpperCase();
    const lower = String(symbol).toLowerCase();

    // Try Finnhub first (stocks/ETFs)
    const [quoteRes, profileRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${upper}&token=${apiKey}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${upper}&token=${apiKey}`),
    ]);

    const quote = await quoteRes.json();
    const profile = await profileRes.json();

    if (quote.c && quote.c > 0) {
      // profile2 carries the listing's own currency and exchange. Both were fetched and
      // discarded before, so a BYMA quote in pesos reached the app as a bare number that every
      // consumer added up as dollars.
      return json({
        price: quote.c,
        previousClose: quote.pc || 0,
        name: profile.name || '',
        symbol: upper,
        currency: (profile.currency || 'USD').toUpperCase(),
        exchange: profile.exchange || '',
      });
    }

    // CoinGecko, only for symbols that are actually crypto.
    const coinId = CRYPTO_IDS[lower] ?? (assetType === 'crypto' ? lower : null);
    if (coinId) {
      try {
        const cgRes = await fetch(
          `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`
        );
        if (cgRes.ok) {
          const coin = await cgRes.json();
          const currentPrice = coin.market_data?.current_price?.usd || 0;
          const change24h = coin.market_data?.price_change_24h || 0;
          if (currentPrice > 0) {
            return json({
              price: currentPrice,
              previousClose: currentPrice - change24h,
              name: coin.name || '',
              symbol: upper,
              currency: 'USD',
              exchange: 'CRYPTO',
            });
          }
        }
      } catch {
        // fall through to "no quote"
      }
    }

    // No quote. Callers fall back to cost basis rather than to an invented price.
    return json({
      price: 0, previousClose: 0, name: '', symbol: upper, currency: 'USD', exchange: '',
    });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
