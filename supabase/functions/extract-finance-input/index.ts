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
    const { image, text, userCategories, userPaymentMethods, userAccounts } = await req.json();

    if (!image && !text) {
      return new Response(JSON.stringify({ error: "No image or text provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const categoriesContext = (userCategories || [])
      .map((c: any) => `- ${c.name} (type: ${c.type}, keywords: ${(c.keywords || []).join(", ")})`)
      .join("\n");

    const accountsContext = (userAccounts || userPaymentMethods || [])
      .map((acc: any) => `- ${acc.name} (currency: ${acc.currency}, patterns: ${(acc.detection_patterns || acc.aliases || []).join(", ")})`)
      .join("\n");

    const systemPrompt = `You are a financial transaction extractor for a personal finance system.
Extract structured transactions from the user's input (image of a receipt/bank app, free text, or audio transcript).

CRITICAL EXTRACTION & EXCLUSION RULES:
1. EXCLUDE REVERTED: Do NOT extract transactions labeled "Reverted", "Cancelada", or "Anulada".
2. EXCLUDE TOP-UPS: Do NOT extract wallet top-ups or balance reloads (e.g., "Card payment +774.50 USDC" or "Ingreso de dinero").
3. EXCLUDE CONVERSION LEGS (DOLARAPP RULE): In DolarApp, every ARS purchase generates 2 lines: the ARS purchase and the conversion leg USDc->ARS. Extract ONLY the USDc line (the real USD cost). Never extract both.
4. MERCADO PAGO RULE: If a receipt says "Dinero disponible: $20.093,31", that is the transaction amount paid, not remaining balance.
5. MULTI-ITEM PURCHASES: If a purchase has multiple distinct products (e.g., Mercado Libre with 1 Charger and 1 Pillow), extract separate transaction items.
6. NORMALIZATION: Clean merchant names (e.g. "MERPAGO*TDHUEVOS" -> "TD Huevos", "SUPERM COTO MC 60" -> "Coto", "SumUp *Pepino Pizza" -> "Pepino Pizza").
7. MULTI-CURRENCY: Detect ARS vs USD vs EUR vs BRL. Argentine amounts with thousands separators like "35.000" or "35 000" are ARS. DolarApp amounts showing USDc are USD. Pix transactions in Brazil are BRL.

AVAILABLE USER CATEGORIES:
${categoriesContext || "Food, House, Travel, Salidas, Entertainment, Tech, Tools & Software, Payments & Loans, Healthcare, UGC Studio Income, AI Freelance Dev, Dividends, Trading P&L, Investment Contribution"}

AVAILABLE USER FINANCIAL ACCOUNTS / MEDIOS:
${accountsContext || "DolarApp, Mercado Pago, Bank USD, Bank ARS, Billetera Efectivo, Binance, Crypto, Payoneer"}
`;

    const userContent: any[] = [];
    if (text) {
      userContent.push({
        type: "text",
        text: `Extract financial transactions from this text/description:\n${text}`,
      });
    }
    if (image) {
      userContent.push({
        type: "image_url",
        image_url: { url: image },
      });
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
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "record_transactions",
              description: "Record one or more extracted personal finance transactions",
              parameters: {
                type: "object",
                properties: {
                  transactions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        name: { type: "string", description: "Cleaned merchant/concept name" },
                        raw_merchant: { type: "string", description: "Raw name from receipt" },
                        amount: { type: "number", description: "Amount in original currency" },
                        currency: { type: "string", enum: ["ARS", "USD", "EUR", "BRL"], description: "Currency of transaction" },
                        amount_usd: { type: "number", description: "Estimated or direct USD amount" },
                        type: { type: "string", enum: ["income", "expense", "transfer", "investment"], description: "Type of movement" },
                        category_name: { type: "string", description: "Best matching category name" },
                        account_name: { type: "string", description: "Best matching financial account (e.g. DolarApp, Mercado Pago, Bank USD, Bank ARS, Billetera Efectivo)" },
                        payment_method_name: { type: "string", description: "Best matching payment method / account name" },
                        transaction_date: { type: "string", description: "YYYY-MM-DD date of transaction" },
                        confidence: { type: "string", enum: ["high", "medium", "low"], description: "Confidence score" },
                        needs_review: { type: "boolean", description: "True if category or payment method is uncertain" },
                        suggested_new_category: { type: "string", description: "If concept doesn't fit existing categories, suggested new category name" },
                      },
                      required: ["name", "amount", "currency", "type", "confidence"],
                    },
                  },
                },
                required: ["transactions"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "record_transactions" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`AI Gateway error ${response.status}: ${errText}`);
    }

    const resJson = await response.json();
    const toolCall = resJson.choices?.[0]?.message?.tool_calls?.[0];
    let extracted = [];
    if (toolCall?.function?.arguments) {
      const args = JSON.parse(toolCall.function.arguments);
      extracted = args.transactions || [];
    }

    return new Response(JSON.stringify({ transactions: extracted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Failed to extract" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
