import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { image } = await req.json();
    if (!image) {
      return new Response(JSON.stringify({ error: "No image provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a trade data extractor. You analyze screenshots of trade confirmations/orders and extract structured trade information. Look for buy/sell indicators, ticker symbols, quantities, prices, dates, asset names, and currency. Detect currency from context clues: if you see pesos, ARS, $AR, or Argentine broker interfaces (IOL, Balanz, Bull Market, PPI, Cocos Capital, ARQ), the currency is ARS. If you see USD, dollars, or US broker interfaces, the currency is USD. If you cannot determine a field, use null. IMPORTANT asset_type classification: Index ETFs like SPY, QQQ, IVV, VOO, FXI, EWZ, EEM, VTI, DIA, IWM, XLF, ARKK, VWO, MCHI should be classified as 'etf'. Argentine bonds like AL30, AL35, GD30, GD35, GD38, GD41, GD46, AE38, AL29, TX26, DICP, PARP, CUAP, Para and sovereign/corporate bonds should be classified as 'bond'. Mutual funds and FCI (Fondos Comunes de Inversión) should be classified as 'etf'. CEDEARs of ETFs are also 'etf'. Crypto assets like BTC, ETH, USDT are 'crypto'. Individual company stocks are 'stock'.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this trade screenshot and extract the trade details. Determine if it's a buy or sell based on context clues (e.g., 'compra'/'bought' = buy, 'venta'/'sold' = sell). Extract the ticker symbol, asset name, quantity, price per unit, trade date, asset type, and currency (ARS or USD).",
              },
              {
                type: "image_url",
                image_url: { url: image },
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_trade",
              description: "Extract structured trade data from a trade confirmation screenshot.",
              parameters: {
                type: "object",
                properties: {
                  trade_type: {
                    type: "string",
                    enum: ["buy", "sell"],
                    description: "Whether this is a buy or sell trade",
                  },
                  symbol: {
                    type: "string",
                    description: "The ticker symbol (e.g., AAPL, MSFT, BTC)",
                  },
                  asset_name: {
                    type: "string",
                    description: "Full name of the asset (e.g., Apple Inc.)",
                  },
                  asset_type: {
                    type: "string",
                    enum: ["stock", "etf", "crypto", "bond", "other"],
                    description: "Type of the asset",
                  },
                  quantity: {
                    type: "number",
                    description: "Number of shares/units traded",
                  },
                  price_per_unit: {
                    type: "number",
                    description: "Price per share/unit",
                  },
                  trade_date: {
                    type: "string",
                    description: "Trade date in YYYY-MM-DD format, or null if not found",
                  },
                  currency: {
                    type: "string",
                    enum: ["USD", "ARS"],
                    description: "Currency of the price. ARS for Argentine Pesos, USD for US Dollars. Detect from context: Argentine brokers (IOL, Balanz, Bull Market, PPI, Cocos), pesos symbol, or ARS text means ARS.",
                  },
                },
                required: ["trade_type", "symbol", "asset_name", "asset_type", "quantity", "price_per_unit", "currency"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_trade" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const text = await response.text();
      console.error("AI gateway error:", response.status, text);
      return new Response(JSON.stringify({ error: "Failed to analyze image" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      return new Response(JSON.stringify({ error: "Could not extract trade data from this image" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify(extracted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("analyze-trade-image error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
