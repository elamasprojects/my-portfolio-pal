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

const RANGE_MAP: Record<string, { yahoo: string; cgDays: string }> = {
  '1M':  { yahoo: '1mo',  cgDays: '30' },
  '3M':  { yahoo: '3mo',  cgDays: '90' },
  '6M':  { yahoo: '6mo',  cgDays: '180' },
  '1Y':  { yahoo: '1y',   cgDays: '365' },
  'ALL': { yahoo: '10y',  cgDays: 'max' },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbol, range = '1Y' } = await req.json();
    if (!symbol) {
      return new Response(JSON.stringify({ error: 'symbol required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const rangeCfg = RANGE_MAP[range] || RANGE_MAP['1Y'];
    const lower = symbol.toLowerCase();
    const isCrypto = !!cryptoMap[lower];

    // Try Yahoo Finance first (stocks/ETFs)
    if (!isCrypto) {
      try {
        const yUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol.toUpperCase())}?range=${rangeCfg.yahoo}&interval=1d`;
        const yRes = await fetch(yUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
        });
        if (yRes.ok) {
          const yData = await yRes.json();
          const result = yData?.chart?.result?.[0];
          if (result?.timestamp?.length) {
            const ts = result.timestamp;
            const quotes = result.indicators?.quote?.[0];
            if (quotes) {
              const candles = ts.map((t: number, i: number) => ({
                time: t,
                open: quotes.open?.[i] ?? null,
                high: quotes.high?.[i] ?? null,
                low: quotes.low?.[i] ?? null,
                close: quotes.close?.[i] ?? null,
              })).filter((c: any) => c.close !== null);

              if (candles.length > 0) {
                return new Response(JSON.stringify({ candles }), {
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                });
              }
            }
          }
        }
      } catch { /* fall through */ }
    }

    // CoinGecko fallback for crypto
    const coinId = cryptoMap[lower] || lower;
    try {
      const cgUrl = rangeCfg.cgDays === 'max'
        ? `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=max`
        : `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=${rangeCfg.cgDays}`;
      const cgRes = await fetch(cgUrl);
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
