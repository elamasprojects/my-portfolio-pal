const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol } = await req.json();
    if (!symbol) {
      return new Response(JSON.stringify({ error: 'Symbol required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const apiKey = Deno.env.get('finnhub_api_key');
    const upper = symbol.toUpperCase();

    // Try Finnhub first (stocks/ETFs)
    const [quoteRes, profileRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${upper}&token=${apiKey}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${upper}&token=${apiKey}`),
    ]);

    const quote = await quoteRes.json();
    const profile = await profileRes.json();

    if (quote.c && quote.c > 0) {
      return new Response(JSON.stringify({
        price: quote.c,
        name: profile.name || '',
        symbol: upper,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fallback: try CoinGecko for crypto
    const lower = symbol.toLowerCase();
    // Map common ticker symbols to CoinGecko IDs
    const cryptoMap: Record<string, string> = {
      btc: 'bitcoin', eth: 'ethereum', sol: 'solana', ada: 'cardano',
      xrp: 'ripple', dot: 'polkadot', doge: 'dogecoin', avax: 'avalanche-2',
      matic: 'matic-network', link: 'chainlink', uni: 'uniswap', ltc: 'litecoin',
      atom: 'cosmos', near: 'near', apt: 'aptos', arb: 'arbitrum',
      op: 'optimism', sui: 'sui', bnb: 'binancecoin', shib: 'shiba-inu',
    };
    const coinId = cryptoMap[lower] || lower;

    try {
      const cgRes = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`
      );
      if (cgRes.ok) {
        const coin = await cgRes.json();
        return new Response(JSON.stringify({
          price: coin.market_data?.current_price?.usd || 0,
          name: coin.name || '',
          symbol: upper,
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    } catch {}

    // Neither worked — return zeros
    return new Response(JSON.stringify({
      price: 0, name: '', symbol: upper,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
