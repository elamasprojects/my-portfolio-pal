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

    // Build unique symbols list
    const symbolSet = new Set<string>();
    for (const p of positions) {
      symbolSet.add(p.symbol.toUpperCase());
    }
    const symbols = Array.from(symbolSet);

    // Date range: past 8 days to today (overlap to avoid missing edge cases)
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 8);
    const toStr = today.toISOString().split("T")[0];
    const fromStr = from.toISOString().split("T")[0];

    let totalInserted = 0;
    const errors: string[] = [];

    // 2. For each symbol, query Finnhub dividends
    for (const symbol of symbols) {
      // Skip non-US symbols (Finnhub unlikely to have dividend data)
      if (symbol.includes(".")) {
        continue;
      }

      try {
        const url = `https://finnhub.io/api/v1/stock/dividend?symbol=${symbol}&from=${fromStr}&to=${toStr}&token=${finnhubKey}`;
        const res = await fetch(url);

        if (!res.ok) {
          errors.push(`${symbol}: HTTP ${res.status}`);
          await sleep(1000);
          continue;
        }

        const dividends = await res.json();

        if (!Array.isArray(dividends) || dividends.length === 0) {
          await sleep(1000);
          continue;
        }

        // 3. For each dividend event, check all holders
        for (const div of dividends) {
          const divAmount = div.amount;
          const exDate = div.exDate || div.date;
          if (!divAmount || !exDate) continue;

          // Find all users holding this symbol
          const holders = positions.filter(
            (p) => p.symbol.toUpperCase() === symbol
          );

          for (const holder of holders) {
            const qty = Number(holder.quantity);
            if (qty <= 0) continue;

            // Deduplication: check if dividend trade already exists
            const { data: existing } = await supabase
              .from("trades")
              .select("id")
              .eq("user_id", holder.user_id)
              .eq("portfolio_id", holder.portfolio_id)
              .eq("symbol", holder.symbol)
              .eq("trade_type", "dividend")
              .gte("trade_date", `${exDate}T00:00:00`)
              .lte("trade_date", `${exDate}T23:59:59`)
              .limit(1);

            if (existing && existing.length > 0) continue;

            // Insert dividend trade
            const totalAmount = divAmount * qty;
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
                price_per_unit: divAmount,
                total_amount: totalAmount,
                trade_date: `${exDate}T00:00:00+00:00`,
                original_currency: "USD",
                notes: `Auto-detected dividend (ex-date: ${exDate})`,
              });

            if (insertErr) {
              errors.push(
                `${symbol} insert for ${holder.user_id}: ${insertErr.message}`
              );
            } else {
              totalInserted++;
            }
          }
        }
      } catch (e) {
        errors.push(`${symbol}: ${e.message}`);
      }

      // Rate limiting: 1 second between Finnhub calls
      await sleep(1000);
    }

    return new Response(
      JSON.stringify({
        message: "Dividend check complete",
        symbols_checked: symbols.filter((s) => !s.includes(".")).length,
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
