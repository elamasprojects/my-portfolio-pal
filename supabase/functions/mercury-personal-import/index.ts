import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

const MERCURY_BASE = "https://api.mercury.com/api/v1";

function createAdminClient(url: string, serviceRoleKey: string) {
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Inferido de la llamada real. `ReturnType<typeof createClient>` a secas resuelve
// los genericos por default y deja los builders de tabla en `never`, con lo cual
// cualquier .insert()/.update() no compila.
type AdminClient = ReturnType<typeof createAdminClient>;

// Mercury solo movio la plata de verdad cuando la transaccion llega a "sent".
// "pending" es una autorizacion que el comercio todavia puede no capturar, y
// "failed" / "cancelled" / "reversed" / "blocked" son cobros que nunca pasaron.
// Importar cualquiera de esos anota un gasto por plata que no se gasto -- y como
// `transactions` tiene triggers que mueven `current_balance`, ademas descuadra
// el saldo de la tarjeta.
const IMPORTABLE_STATUS = "sent";

// Techo de paginacion. Una tarjeta en una ventana de 30 dias entra holgada en
// una pagina; el tope existe para que un cursor que no avanza no cicle para
// siempre.
const MAX_PAGES = 20;
const PAGE_SIZE = 500;

interface MercuryTx {
  id: string;
  amount: number;
  status?: string;
  cardId?: string;
  accountId?: string;
  bankDescription?: string;
  counterpartyName?: string;
  merchantName?: string;
  note?: string;
  externalMemo?: string;
  kind?: string;
  mercuryCategory?: string;
  postedAt?: string;
  createdAt?: string;
}

interface CardLink {
  id: string;
  user_id: string;
  mercury_card_id: string;
  label: string;
  payment_method_id: string | null;
  account_id: string | null;
  lookback_days: number;
}

interface CategoryRow {
  id: string;
  name: string;
  type: string;
  keywords: string[] | null;
  aliases: string[] | null;
  sort_order: number | null;
}

interface ImportedRow {
  mercury_id: string;
  type: "expense" | "income";
  name: string;
  amount: number;
  transaction_date: string;
  category: string | null;
  needs_review: boolean;
}

interface SkippedRow {
  mercury_id: string;
  reason: "ya_importada" | "no_liquidada" | "monto_cero" | "error";
  status?: string;
  detail?: string;
}

interface RevertedRow {
  mercury_id: string;
  status: string;
}

interface LinkResult {
  link: string;
  startDate?: string;
  endDate?: string;
  imported: ImportedRow[];
  skipped: SkippedRow[];
  reverted: RevertedRow[];
  foreign?: number;
  error?: string;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalize(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Trae las transacciones de UNA tarjeta.
 *
 * `cardId` es un filtro real del endpoint (repetible), asi que el recorte pasa
 * en el servidor de Mercury y nunca baja el resto de la cuenta. Aun asi, quien
 * consume esto vuelve a chequear `tx.cardId`: si algun dia la API ignorara el
 * parametro, el recorte se caeria en silencio y se importaria la cuenta entera.
 *
 * No se manda `status`: hacen falta tambien las que NO estan en "sent" para
 * poder revertir lo que ya se habia importado y despues se cayo.
 */
async function fetchCardTransactions(
  cardId: string,
  startDate: string,
  endDate: string,
  mercuryToken: string,
): Promise<MercuryTx[]> {
  const headers = {
    Authorization: `Bearer ${mercuryToken}`,
    Accept: "application/json",
  };

  const all: MercuryTx[] = [];
  const seen = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams();
    params.set("cardId", cardId);
    params.set("start", startDate);
    params.set("end", endDate);
    params.set("limit", String(PAGE_SIZE));
    params.set("order", "desc");
    if (cursor) params.set("start_after", cursor);

    const res = await fetch(`${MERCURY_BASE}/transactions?${params.toString()}`, {
      method: "GET",
      headers,
    });
    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`Mercury ${res.status}: ${detail.slice(0, 300)}`);
    }

    const data = await res.json();
    const batch: MercuryTx[] = Array.isArray(data)
      ? data
      : (data?.transactions ?? data?.data ?? []);

    let added = 0;
    for (const tx of batch) {
      if (!tx?.id || seen.has(tx.id)) continue;
      seen.add(tx.id);
      all.push(tx);
      added++;
    }

    const nextPage: string | null = Array.isArray(data) ? null : (data?.page?.nextPage ?? null);
    // Cortar tambien si el cursor no avanzo: sin esto una pagina repetida
    // consumiria las 20 vueltas al pedo.
    if (!nextPage || nextPage === cursor || added === 0) break;
    cursor = nextPage;
  }

  return all;
}

/**
 * Merchant type de Mercury -> nombre de categoria.
 *
 * Existe porque el match por keywords, al exigir palabra completa, no puede
 * llegar a nombres pegados como "Hostelworld" o "PALMERSLODGESWISS" -- y
 * aflojar esa regla haria que "bar" matcheara "BARBERSHOP" en silencio.
 * `mercuryCategory` no es texto libre: lo clasifica Mercury, asi que usarlo no
 * arrastra ese riesgo. Se resuelve por nombre contra las categorias que el
 * usuario realmente tiene; si no existe, simplemente no matchea.
 */
const MERCURY_CATEGORY_MAP: Record<string, string> = {
  lodging: "Travel",
  othertravel: "Travel",
  travel: "Travel",
  airlines: "Travel",
  transportation: "Travel",
  rideshare: "Travel",
  taxi: "Travel",
  fuel: "Travel",
  foodandbeverage: "Food",
  restaurants: "Food",
  groceries: "Food",
  software: "Tools & Software",
  saas: "Tools & Software",
  subscriptions: "Tools & Software",
  medical: "Healthcare",
  healthcare: "Healthcare",
  pharmacy: "Healthcare",
  insurance: "Healthcare",
  entertainment: "Entertainment",
  retail: "Salidas",
  shopping: "Salidas",
  clothing: "Salidas",
  utilities: "House",
  rent: "House",
  telecom: "Payments & Loans",
};

/**
 * Categoriza contra las categorias que el usuario ya tiene.
 *
 * Match por palabra completa, no por substring suelto: "bar" no puede llevarse
 * puesto "BARBERSHOP". Gana la keyword mas larga, que es la mas especifica.
 * Devuelve null cuando no hay match, y el que llama marca `needs_review` para
 * que la fila caiga en la cola de revision en vez de quedar mal clasificada.
 */
function matchCategory(
  haystack: string,
  mercuryCategory: string | null | undefined,
  categories: CategoryRow[],
  wantedType: "expense" | "income",
): { id: string; name: string } | null {
  const text = normalize(haystack);
  let best: { id: string; name: string; length: number } | null = null;

  for (const cat of categories) {
    if (cat.type !== wantedType && cat.type !== "both") continue;
    const terms = [...(cat.keywords ?? []), ...(cat.aliases ?? [])];
    for (const rawTerm of terms) {
      const term = normalize(String(rawTerm ?? "")).trim();
      if (term.length < 3) continue;
      const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegex(term)}([^a-z0-9]|$)`, "u");
      if (!pattern.test(text)) continue;
      if (!best || term.length > best.length) {
        best = { id: cat.id, name: cat.name, length: term.length };
      }
    }
  }

  if (best) return { id: best.id, name: best.name };

  // Sin match por keywords: cae al merchant type que ya trae Mercury.
  const mapped = mercuryCategory
    ? MERCURY_CATEGORY_MAP[normalize(mercuryCategory).replace(/[^a-z0-9]/g, "")]
    : undefined;
  if (!mapped) return null;

  const byName = categories.find(
    (c) => c.name === mapped && (c.type === wantedType || c.type === "both"),
  );
  return byName ? { id: byName.id, name: byName.name } : null;
}

async function syncLink(
  admin: AdminClient,
  link: CardLink,
  categories: CategoryRow[],
  mercuryToken: string,
  overrideStart?: string,
  overrideEnd?: string,
): Promise<LinkResult> {
  const now = new Date();
  const endDate = overrideEnd ?? now.toISOString().slice(0, 10);
  const startDate = overrideStart ??
    new Date(now.getTime() - link.lookback_days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

  const imported: ImportedRow[] = [];
  const skipped: SkippedRow[] = [];
  const reverted: RevertedRow[] = [];

  const fetched = await fetchCardTransactions(
    link.mercury_card_id,
    startDate,
    endDate,
    mercuryToken,
  );

  // Segunda linea de defensa sobre el recorte por tarjeta. El filtro ya lo hizo
  // Mercury; esto garantiza que un cambio de la API no derrame gastos de otras
  // tarjetas -- de la empresa, por ejemplo -- dentro de las finanzas personales.
  const txs = fetched.filter((tx) => tx.cardId === link.mercury_card_id);
  const foreign = fetched.length - txs.length;
  if (foreign > 0) {
    console.warn(
      `[${link.label}] Mercury devolvio ${foreign} transaccion(es) de otra tarjeta; descartadas`,
    );
  }

  if (txs.length === 0) {
    return { link: link.label, startDate, endDate, imported, skipped, reverted, foreign };
  }

  // Que hay ya importado de esta tanda.
  const ids = txs.map((t) => t.id);
  const { data: existingRows, error: existingErr } = await admin
    .from("transactions")
    .select("id, external_id, deleted_at")
    .eq("user_id", link.user_id)
    .eq("external_source", "mercury")
    .in("external_id", ids);
  if (existingErr) throw new Error(`lookup de duplicados fallo: ${existingErr.message}`);

  const existing = new Map<string, { id: string; deleted_at: string | null }>();
  for (const row of existingRows ?? []) {
    const r = row as { id: string; external_id: string; deleted_at: string | null };
    existing.set(r.external_id, { id: r.id, deleted_at: r.deleted_at });
  }

  for (const tx of txs) {
    const status = (tx.status ?? "unknown").toLowerCase();
    const prior = existing.get(tx.id);
    const isLive = Boolean(prior) && prior!.deleted_at === null;

    // Reconciliacion. Un cobro puede entrar como "sent" y caerse despues. Lo que
    // se haya anotado por una transaccion que ya no esta en "sent" es plata que
    // no se gasto: se borra en blando, y el trigger de saldos devuelve el monto
    // a la tarjeta. Si mas adelante llega a "sent" de verdad, la corrida
    // siguiente la vuelve a importar.
    if (isLive && status !== IMPORTABLE_STATUS) {
      const { error: delErr } = await admin
        .from("transactions")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", prior!.id)
        .eq("user_id", link.user_id);
      if (delErr) {
        console.error("revert fallo", tx.id, delErr);
        continue;
      }
      reverted.push({ mercury_id: tx.id, status });
      continue;
    }

    if (prior) {
      skipped.push({ mercury_id: tx.id, reason: "ya_importada" });
      continue;
    }

    if (status !== IMPORTABLE_STATUS) {
      skipped.push({ mercury_id: tx.id, reason: "no_liquidada", status });
      continue;
    }

    const rawAmount = Number(tx.amount ?? 0);
    if (rawAmount === 0) {
      skipped.push({ mercury_id: tx.id, reason: "monto_cero" });
      continue;
    }

    // Mercury firma en negativo la plata que sale. Un monto positivo es un
    // reembolso o un credito: entra como ingreso para que el saldo de la tarjeta
    // vuelva a su lugar, nunca como gasto.
    const isExpense = rawAmount < 0;
    const type: "expense" | "income" = isExpense ? "expense" : "income";
    const amount = Math.abs(rawAmount);

    const merchant = tx.counterpartyName || tx.merchantName || tx.bankDescription || "Mercury";
    // `mercuryCategory` va aparte, no aca: es una etiqueta de Mercury, no texto
    // del comercio, y mezclarla daria matches por casualidad contra keywords.
    const haystack = [
      tx.counterpartyName,
      tx.merchantName,
      tx.bankDescription,
      tx.note,
      tx.externalMemo,
    ].filter(Boolean).join(" ");

    const category = matchCategory(haystack, tx.mercuryCategory, categories, type);
    const transactionDate = (tx.postedAt || tx.createdAt || new Date().toISOString()).slice(0, 10);

    const { error: insErr } = await admin.from("transactions").insert({
      user_id: link.user_id,
      type,
      name: merchant,
      raw_merchant: tx.bankDescription || merchant,
      amount_usd: amount,
      transaction_date: transactionDate,
      category_id: category?.id ?? null,
      payment_method_id: link.payment_method_id,
      account_id: link.account_id,
      // Mercury liquida en USD, asi que no hay conversion que hacer.
      original_amount: amount,
      original_currency: "USD",
      fx_rate: 1,
      fx_source: "native_usd",
      source: "mercury",
      external_source: "mercury",
      external_id: tx.id,
      // La categoria salio de una heuristica sobre el texto del comercio, no de
      // una decision del usuario: sin match va a la cola de revision.
      confidence: category ? "medium" : "low",
      needs_review: !category,
      notes: null,
      extracted_fields: {
        mercury_card_id: link.mercury_card_id,
        mercury_card_label: link.label,
        mercury_status: status,
        mercury_kind: tx.kind ?? null,
        mercury_category: tx.mercuryCategory ?? null,
        bank_description: tx.bankDescription ?? null,
        posted_at: tx.postedAt ?? null,
      },
    });

    if (insErr) {
      // 23505 = el indice unico (user_id, external_source, external_id) freno un
      // duplicado que la lectura previa no vio, p.ej. dos corridas en paralelo.
      // Es exactamente lo que el indice tiene que hacer, no un error.
      if ((insErr as { code?: string }).code === "23505") {
        skipped.push({ mercury_id: tx.id, reason: "ya_importada" });
        continue;
      }
      console.error("insert fallo", tx.id, insErr);
      skipped.push({ mercury_id: tx.id, reason: "error", detail: insErr.message });
      continue;
    }

    imported.push({
      mercury_id: tx.id,
      type,
      name: merchant,
      amount,
      transaction_date: transactionDate,
      category: category?.name ?? null,
      needs_review: !category,
    });
  }

  await admin
    .from("mercury_card_links")
    .update({ last_synced_at: new Date().toISOString() })
    .eq("id", link.id);

  return { link: link.label, startDate, endDate, imported, skipped, reverted, foreign };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const admin = createAdminClient(supabaseUrl, serviceRoleKey);

    // Doble puerta: el secreto del cron para la corrida automatica, o el JWT del
    // dueno para el boton de la UI. `verify_jwt` esta en false porque el cron no
    // manda JWT, asi que la unica autenticacion es esta -- no hay camino sin ella.
    let scopedUserId: string | null = null;
    const incomingCronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");

    const { data: cronCfg } = await admin
      .from("app_config")
      .select("value")
      .eq("key", "cron_secret_mercury_personal_import")
      .maybeSingle();
    const cronSecret = (cronCfg?.value as string | null) ?? null;

    if (cronSecret && incomingCronSecret && incomingCronSecret === cronSecret) {
      scopedUserId = null; // corrida del cron: todos los vinculos activos
    } else if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error: userError } = await admin.auth.getUser(token);
      if (userError || !user) return jsonResponse({ error: "No autorizado" }, 401);
      // Un usuario solo puede sincronizar sus propios vinculos.
      scopedUserId = user.id;
    } else {
      return jsonResponse({ error: "No autorizado" }, 401);
    }

    // Recien despues de autenticar. Chequearlo antes le contaba a cualquiera que
    // pasara por la URL como esta configurado el backend.
    const mercuryToken = Deno.env.get("MERCURY_API_TOKEN");
    if (!mercuryToken) {
      return jsonResponse({ error: "MERCURY_API_TOKEN no esta configurado en este proyecto" }, 500);
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const overrideStart: string | undefined = body?.startDate;
    const overrideEnd: string | undefined = body?.endDate;

    let linkQuery = admin
      .from("mercury_card_links")
      .select("id, user_id, mercury_card_id, label, payment_method_id, account_id, lookback_days")
      .eq("is_active", true);
    if (scopedUserId) linkQuery = linkQuery.eq("user_id", scopedUserId);
    // Permite sincronizar una sola tarjeta cuando hay varias vinculadas.
    if (body?.cardId) linkQuery = linkQuery.eq("mercury_card_id", body.cardId);

    const { data: links, error: linksErr } = await linkQuery;
    if (linksErr) throw new Error(`no se pudieron leer los vinculos: ${linksErr.message}`);

    if (!links || links.length === 0) {
      return jsonResponse({
        results: [],
        totalImported: 0,
        totalReverted: 0,
        totalAmount: 0,
        message: "No hay ninguna tarjeta vinculada y activa. Sin vinculo no se importa nada.",
      });
    }

    // Las categorias se leen una sola vez y se comparten entre vinculos.
    const userIds = [...new Set((links as CardLink[]).map((l) => l.user_id))];
    const { data: cats, error: catsErr } = await admin
      .from("pf_categories")
      .select("id, name, type, keywords, aliases, sort_order, user_id, archived")
      .eq("archived", false)
      .or(`user_id.is.null,user_id.in.(${userIds.join(",")})`)
      .order("sort_order", { ascending: true });
    if (catsErr) throw new Error(`no se pudieron leer las categorias: ${catsErr.message}`);
    const categories = (cats ?? []) as unknown as CategoryRow[];

    const results: LinkResult[] = [];
    for (const link of links as CardLink[]) {
      try {
        results.push(await syncLink(admin, link, categories, mercuryToken, overrideStart, overrideEnd));
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        console.error(`sync fallo para ${link.label}`, message);
        results.push({ link: link.label, error: message, imported: [], skipped: [], reverted: [] });
      }
    }

    const totalImported = results.reduce((acc, r) => acc + r.imported.length, 0);
    const totalReverted = results.reduce((acc, r) => acc + r.reverted.length, 0);
    const totalNeedsReview = results.reduce(
      (acc, r) => acc + r.imported.filter((i) => i.needs_review).length,
      0,
    );
    // Solo suma gastos: mezclar reembolsos en el mismo total daria un neto que no
    // es ni lo gastado ni lo devuelto.
    const totalAmount = results.reduce(
      (acc, r) => acc + r.imported.reduce((a, i) => a + (i.type === "expense" ? i.amount : 0), 0),
      0,
    );
    const failed = results.filter((r) => Boolean(r.error));

    // Un fallo de Mercury no puede devolver 200: la UI lo leeria como "no habia
    // nada para importar" y el cron lo contaria como corrida sana.
    const status = failed.length === results.length && failed.length > 0 ? 502 : 200;

    return jsonResponse({
      results,
      totalImported,
      totalReverted,
      totalNeedsReview,
      totalAmount,
      failed: failed.length,
    }, status);
  } catch (err) {
    console.error("mercury-personal-import error:", err);
    const message = err instanceof Error ? err.message : "Error interno";
    return jsonResponse({ error: message }, 500);
  }
});
