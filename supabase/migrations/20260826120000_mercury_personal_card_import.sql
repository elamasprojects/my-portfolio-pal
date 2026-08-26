-- Importación automática de gastos desde una tarjeta de Mercury.
--
-- La regla que ordena todo el diseño: la extracción se acota a UNA tarjeta.
-- No se importa "lo de Mercury", se importa "lo de esta tarjeta", y la tarjeta
-- se declara acá, en `mercury_card_links`. Sin una fila activa no se trae nada:
-- el default es no importar, no importar todo.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Idempotencia real para transacciones de origen externo.
--
-- Hasta ahora `transactions` sólo recibía carga manual, así que no había forma
-- de decir "esta fila ES la transacción X del banco". Sin eso, cada corrida del
-- import volvería a insertar lo mismo, y como hay triggers que mueven
-- `current_balance` en cada INSERT, un doble import no ensucia sólo la lista:
-- descuadra el saldo. El índice único es lo que lo hace imposible, incluso si
-- dos corridas se pisan.
alter table public.transactions
  add column if not exists external_source text,
  add column if not exists external_id text;

comment on column public.transactions.external_source is
  'Sistema de origen cuando la fila no se cargó a mano (ej: ''mercury''). NULL = carga manual.';
comment on column public.transactions.external_id is
  'ID de la transacción en el sistema de origen. Junto a external_source y user_id es la clave de deduplicación.';

-- Parcial: no toca las filas manuales, que tienen ambas columnas en NULL y son
-- legítimamente indistinguibles entre sí.
create unique index if not exists transactions_external_ref_unique
  on public.transactions (user_id, external_source, external_id)
  where external_source is not null and external_id is not null;

-- Búsqueda por origen sin escanear la tabla entera en cada reconciliación.
create index if not exists transactions_external_source_idx
  on public.transactions (user_id, external_source)
  where external_source is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Qué tarjeta se importa, y adónde cae lo que se importa.
create table if not exists public.mercury_card_links (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- El UUID de la tarjeta en Mercury. Es el filtro que se manda a la API.
  mercury_card_id text not null,
  -- Para la UI: "Ezequiel tarjeta personal ••6066".
  label text not null,

  -- Destino. Los saldos los mantienen los triggers de `transactions`, así que
  -- apuntar esto mal no es cosmético: mueve el saldo de la cuenta equivocada.
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  account_id uuid references public.financial_accounts(id) on delete set null,

  is_active boolean not null default true,
  -- Ventana de relectura. Amplia a propósito: una compra tarda días en pasar de
  -- "pending" a "sent", y sólo se importa cuando llega a "sent". La corrida de
  -- mañana tiene que seguir alcanzando la compra de anteayer.
  lookback_days integer not null default 30
    check (lookback_days between 1 and 365),

  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Una tarjeta no puede estar vinculada dos veces para el mismo usuario: si no,
  -- cada corrida importaría cada gasto una vez por vínculo.
  unique (user_id, mercury_card_id)
);

alter table public.mercury_card_links enable row level security;

drop policy if exists "Users can manage own mercury card links" on public.mercury_card_links;
create policy "Users can manage own mercury card links"
  on public.mercury_card_links for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists mercury_card_links_active_idx
  on public.mercury_card_links (user_id) where is_active;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Config del backend (hoy: el secreto del cron).
--
-- Sin políticas de RLS: con RLS habilitada y cero policies, ningún cliente lee
-- ni escribe. Sólo la service role -- que las saltea -- llega, que es
-- exactamente quien tiene que llegar.
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_config enable row level security;

revoke all on public.app_config from anon, authenticated;

insert into public.app_config (key, value)
values (
  'cron_secret_mercury_personal_import',
  to_jsonb(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_mercury_card_links_updated_at on public.mercury_card_links;
create trigger trg_mercury_card_links_updated_at
  before update on public.mercury_card_links
  for each row execute function public.touch_updated_at();
