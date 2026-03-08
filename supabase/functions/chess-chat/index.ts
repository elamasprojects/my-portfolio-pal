import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface Trade {
  id: string;
  symbol: string;
  asset_name: string;
  asset_type: string;
  trade_type: string;
  quantity: number;
  price_per_unit: number;
  total_amount: number | null;
  trade_date: string;
  notes: string | null;
  portfolio_id: string;
}

function computeContext(trades: Trade[], portfolioName: string) {
  // Holdings
  const holdingsMap = new Map<string, { buyQty: number; buyAmt: number; sellQty: number; sellAmt: number; asset_name: string; asset_type: string }>();
  let totalDividends = 0;
  let totalRealizedPnl = 0;
  let winningSells = 0;
  let totalSells = 0;

  const sorted = [...trades].sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());
  const avgCosts = new Map<string, { qty: number; avg: number }>();

  for (const t of sorted) {
    if (t.trade_type === "dividend") {
      totalDividends += Number(t.total_amount) || t.price_per_unit * t.quantity;
      continue;
    }

    const h = holdingsMap.get(t.symbol) || { buyQty: 0, buyAmt: 0, sellQty: 0, sellAmt: 0, asset_name: t.asset_name, asset_type: t.asset_type };
    const pos = avgCosts.get(t.symbol) || { qty: 0, avg: 0 };

    if (t.trade_type === "buy") {
      h.buyQty += t.quantity;
      h.buyAmt += t.quantity * t.price_per_unit;
      const totalCost = pos.avg * pos.qty + t.price_per_unit * t.quantity;
      pos.qty += t.quantity;
      pos.avg = pos.qty > 0 ? totalCost / pos.qty : 0;
    } else if (t.trade_type === "sell") {
      h.sellQty += t.quantity;
      h.sellAmt += t.quantity * t.price_per_unit;
      const pnl = (t.price_per_unit - pos.avg) * t.quantity;
      totalRealizedPnl += pnl;
      if (pnl > 0) winningSells++;
      totalSells++;
      pos.qty -= t.quantity;
      if (pos.qty <= 0) { pos.qty = 0; pos.avg = 0; }
    }

    holdingsMap.set(t.symbol, h);
    avgCosts.set(t.symbol, pos);
  }

  const holdings = Array.from(holdingsMap.entries()).map(([symbol, h]) => {
    const netQty = h.buyQty - h.sellQty;
    const avgCost = h.buyQty > 0 ? h.buyAmt / h.buyQty : 0;
    return { symbol, asset_name: h.asset_name, asset_type: h.asset_type, net_quantity: netQty, avg_cost: Math.round(avgCost * 100) / 100, total_invested: Math.round(avgCost * netQty * 100) / 100 };
  }).filter(h => h.net_quantity > 0);

  const totalInvested = holdings.reduce((s, h) => s + h.total_invested, 0);
  const winRate = totalSells > 0 ? Math.round((winningSells / totalSells) * 100) : 0;

  return {
    portfolio_name: portfolioName,
    total_trades: trades.length,
    total_invested: Math.round(totalInvested * 100) / 100,
    total_realized_pnl: Math.round(totalRealizedPnl * 100) / 100,
    total_dividends: Math.round(totalDividends * 100) / 100,
    win_rate: winRate,
    winning_sells: winningSells,
    total_sells: totalSells,
    holdings,
    allocation: holdings.map(h => ({ symbol: h.symbol, pct: totalInvested > 0 ? Math.round((h.total_invested / totalInvested) * 1000) / 10 : 0 })),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY is not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Auth user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claimsData.claims.sub as string;

    const { messages } = await req.json();

    // Fetch data with service role
    const admin = createClient(supabaseUrl, serviceRoleKey);

    const [tradesRes, portfoliosRes, tagsRes, assignmentsRes] = await Promise.all([
      admin.from("trades").select("*").eq("user_id", userId).order("trade_date", { ascending: false }).limit(200),
      admin.from("portfolios").select("*").eq("user_id", userId),
      admin.from("trade_tags").select("*").eq("user_id", userId),
      admin.from("trade_tag_assignments").select("*"),
    ]);

    const trades = (tradesRes.data || []) as Trade[];
    const portfolios = portfoliosRes.data || [];
    const tags = tagsRes.data || [];
    const assignments = assignmentsRes.data || [];

    // Filter assignments to user's trades
    const tradeIds = new Set(trades.map(t => t.id));
    const userAssignments = assignments.filter((a: any) => tradeIds.has(a.trade_id));

    // Build tag map
    const tagMap = new Map(tags.map((t: any) => [t.id, t.name]));
    const tradeTagNames = new Map<string, string[]>();
    for (const a of userAssignments) {
      const name = tagMap.get(a.tag_id);
      if (name) {
        const arr = tradeTagNames.get(a.trade_id) || [];
        arr.push(name);
        tradeTagNames.set(a.trade_id, arr);
      }
    }

    const portfolioName = portfolios[0]?.name || "Portfolio";
    const context = computeContext(trades, portfolioName);

    // Format trades for context (last 50 for detail)
    const recentTrades = trades.slice(0, 50).map(t => {
      const tgs = tradeTagNames.get(t.id);
      return `${t.trade_date.split("T")[0]} | ${t.trade_type.toUpperCase()} | ${t.symbol} (${t.asset_name}) | qty=${t.quantity} @ $${t.price_per_unit} | total=$${t.total_amount || (t.quantity * t.price_per_unit).toFixed(2)}${t.notes ? ` | notes: "${t.notes}"` : ""}${tgs ? ` | tags: ${tgs.join(", ")}` : ""}`;
    });

    const systemPrompt = `You are Chess, a personal portfolio analyst AI. You analyze the user's real trading data to provide insights, patterns, and actionable advice.

## User's Portfolio Data

**Portfolio:** ${context.portfolio_name}
**Total Trades:** ${context.total_trades}
**Total Invested (open positions):** $${context.total_invested.toLocaleString()}
**Realized P&L:** $${context.total_realized_pnl.toLocaleString()}
**Dividends Received:** $${context.total_dividends.toLocaleString()}
**Win Rate:** ${context.win_rate}% (${context.winning_sells}/${context.total_sells} winning sells)

### Current Holdings
${context.holdings.length > 0 ? context.holdings.map(h => `- ${h.symbol} (${h.asset_name}): ${h.net_quantity} units @ avg $${h.avg_cost} = $${h.total_invested.toLocaleString()}`).join("\n") : "No open positions."}

### Allocation
${context.allocation.map(a => `- ${a.symbol}: ${a.pct}%`).join("\n")}

### Recent Trades (last 50)
${recentTrades.join("\n")}

### Strategy Tags Used
${tags.length > 0 ? tags.map((t: any) => t.name).join(", ") : "None"}

## Instructions
- Answer based on the user's ACTUAL data above. Be specific with numbers.
- Use markdown formatting: bold for emphasis, tables when comparing, bullet points for lists.
- When asked about patterns, analyze trade dates, frequencies, win/loss patterns.
- For what-if scenarios, calculate using the actual holdings and costs.
- Be concise but thorough. Use a professional but friendly tone.
- If data is insufficient to answer, say so honestly.
- Always reference specific trades/symbols when relevant.
- Currency is USD unless stated otherwise.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds to your Lovable workspace." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chess-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
