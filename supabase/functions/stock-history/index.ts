const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const cryptoMap: Record<string, string> = {
  btc: 'bitcoin', eth: 'ethereum', sol: 'solana', ada: 'cardano',
  xrp: 'ripple', dot: 'polkadot', doge: 'dogecoin', avax: 'avalanche-2',
  matic: 'matic-network', link: 'chainlink', uni: 'uniswap', ltc: 'litecoin',
  atom: 'cosmos', near: 'near', apt: 'aptos', arb: 'arbitrum',
  op: 'optimism', sui: 'sui', bnb: 'binancecoin', shib: 'shiba-inu',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, from, to } = await req.json();
    if (!symbol || !from || !to) {
      return new Response(JSON.stringify({ error: 'symbol, from, to required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const apiKey = Deno.env.get('finnhub_api_key');
    const upper = symbol.toUpperCase();

    // Try Finnhub candles first
    const finnhubUrl = `https://finnhub.io/api/v1/stock/candle?symbol=${upper}&resolution=D&from=${from}&to=${to}&token=${apiKey}`;
    const fRes = await fetch(finnhubUrl);
    const fData = await fRes.json();

    if (fData.s === 'ok' && fData.c?.length > 0) {
      const candles = fData.t.map((t: number, i: number) => ({
        time: t,
        open: fData.o[i],
        high: fData.h[i],
        low: fData.l[i],
        close: fData.c[i],
      }));
      return new Response(JSON.stringify({ candles }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback: CoinGecko for crypto
    const lower = symbol.toLowerCase();
    const coinId = cryptoMap[lower] || lower;
    try {
      const cgRes = await fetch(
        `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=usd&from=${from}&to=${to}`
      );
      if (cgRes.ok) {
        const cgData = await cgRes.json();
        if (cgData.prices?.length > 0) {
          const candles = cgData.prices.map(([ts, price]: [number, number]) => ({
            time: Math.floor(ts / 1000),
            open: price,
            high: price,
            low: price,
            close: price,
          }));
          return new Response(JSON.stringify({ candles }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }
    } catch { /* ignore */ }

    return new Response(JSON.stringify({ candles: [] }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
