import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const finnhubKey = Deno.env.get("finnhub_api_key")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 1. Get all distinct symbols from portfolio_positions
    const { data: positions, error: posErr } = await supabase
      .from("portfolio_positions")
      .select("symbol, user_id, portfolio_id, quantity");

    if (posErr) throw posErr;
    if (!positions || positions.length === 0) {
      return new Response(
        JSON.stringify({ message: "No positions found", inserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build unique symbols list (US stocks only)
    const symbolSet = new Set<string>();
    for (const p of positions) {
      const sym = p.symbol.toUpperCase();
      if (!sym.includes(".")) {
        symbolSet.add(sym);
      }
    }
    const symbols = Array.from(symbolSet);

    // Date range: past 8 days to today
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 8);
    const toStr = today.toISOString().split("T")[0];
    const fromStr = from.toISOString().split("T")[0];

    let totalInserted = 0;
    const errors: string[] = [];
    const checked: string[] = [];

    // 2. For each symbol, try Finnhub stock/dividend2 (free) then fall back to basic-financials
    for (const symbol of symbols) {
      try {
        // Try the dividend2 endpoint first (basic dividends - free tier)
        const url = `https://finnhub.io/api/v1/stock/dividend2?symbol=${symbol}&token=${finnhubKey}`;
        const res = await fetch(url);

        if (res.ok) {
          const data = await res.json();
          // dividend2 returns { currentDividendYieldTTM, dividendPerShareAnnual, ... }
          // It doesn't have historical dates, so we use basic-financials for that
        }

        // Use the company basic financials to check current dividend data
        const finUrl = `https://finnhub.io/api/v1/stock/metric?symbol=${symbol}&metric=all&token=${finnhubKey}`;
        const finRes = await fetch(finUrl);

        if (!finRes.ok) {
          errors.push(`${symbol}: metrics HTTP ${finRes.status}`);
          await sleep(1200);
          continue;
        }

        const finData = await finRes.json();
        const metric = finData?.metric;

        if (!metric) {
          await sleep(1200);
          continue;
        }

        // Check if there's dividend data
        const dividendPerShareAnnual = metric.dividendPerShareAnnual;
        const dividendYield = metric.currentDividendYieldTTM;
        const exDividendDate = metric.dividendPayDateForward;

        checked.push(symbol);

        // If there's no dividend data or yield is 0, skip
        if (!dividendPerShareAnnual || dividendPerShareAnnual <= 0) {
          await sleep(1200);
          continue;
        }

        // Calculate quarterly dividend (approximate)
        const quarterlyDiv = dividendPerShareAnnual / 4;

        // Check if ex-dividend date falls within our window
        // The forward ex-date from metrics might be in the past 7 days
        if (exDividendDate) {
          const exDate = new Date(exDividendDate);
          const fromDate = new Date(fromStr);
          const toDate = new Date(toStr);

          if (exDate >= fromDate && exDate <= toDate) {
            // Find all holders
            const holders = positions.filter(
              (p) => p.symbol.toUpperCase() === symbol
            );

            for (const holder of holders) {
              const qty = Number(holder.quantity);
              if (qty <= 0) continue;

              const divDate = exDividendDate;

              // Deduplication check
              const { data: existing } = await supabase
                .from("trades")
                .select("id")
                .eq("user_id", holder.user_id)
                .eq("portfolio_id", holder.portfolio_id)
                .eq("symbol", holder.symbol)
                .eq("trade_type", "dividend")
                .gte("trade_date", `${divDate}T00:00:00`)
                .lte("trade_date", `${divDate}T23:59:59`)
                .limit(1);

              if (existing && existing.length > 0) continue;

              const totalAmount = quarterlyDiv * qty;
              const { error: insertErr } = await supabase
                .from("trades")
                .insert({
                  user_id: holder.user_id,
                  portfolio_id: holder.portfolio_id,
                  symbol: holder.symbol,
                  asset_name: holder.symbol,
                  asset_type: "stock",
                  trade_type: "dividend",
                  quantity: qty,
                  price_per_unit: quarterlyDiv,
                  total_amount: totalAmount,
                  trade_date: `${divDate}T00:00:00+00:00`,
                  original_currency: "USD",
                  notes: `Auto-detected dividend (pay date: ${divDate}, annual: $${dividendPerShareAnnual})`,
                });

              if (insertErr) {
                errors.push(`${symbol} insert: ${insertErr.message}`);
              } else {
                totalInserted++;
              }
            }
          }
        }
      } catch (e) {
        errors.push(`${symbol}: ${e.message}`);
      }

      await sleep(1200);
    }

    return new Response(
      JSON.stringify({
        message: "Dividend check complete",
        symbols_checked: checked.length,
        total_symbols: symbols.length,
        inserted: totalInserted,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
