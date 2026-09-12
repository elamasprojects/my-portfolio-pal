-- El detalle del ticket, que hasta ahora se tiraba.
--
-- La ingesta de comprobantes (`extract-finance-input` + OmnibarFinance) leia la foto, sacaba
-- UNA fila -- comercio, monto, categoria -- y descartaba todo lo demas: que compraste, a que
-- precio, y la imagen misma. `transactions.receipt_url` existia desde el primer dia y estaba
-- en NULL en las 565 filas. Un gasto de supermercado quedaba como "Disco, US$ 44,42, Food".
--
-- Dos piezas para que no se pierda mas:
--   1. `transaction_items`: una fila por producto del ticket, en la moneda del ticket.
--   2. el bucket privado `receipts`: la foto original, para poder volver a leerla.

create table if not exists public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- El orden del ticket. Sin esto la lista vuelve en el orden que quiera Postgres y deja de
  -- ser comparable contra la foto, que es justo para lo que uno la abre.
  position integer not null default 0,
  -- Nombre legible; `raw_description` guarda el mamarracho original del ticket
  -- ("GALLETITAS E CHIPS COPLER"), porque la normalizacion la hace un modelo y hay que poder
  -- auditar que fue lo que leyo.
  description text not null,
  raw_description text,
  -- 3 unidades, o 0.884 kg de asado: por eso es numeric y viene con unidad.
  quantity numeric,
  unit text,
  unit_price numeric,
  -- Lo unico obligatorio del renglon: lo que efectivamente sumo al ticket.
  line_total numeric not null,
  -- Descuento de la linea, positivo. Los tickets argentinos descuentan al final y por eso el
  -- total nunca cierra con la suma de los renglones; guardarlo aparte deja explicar la brecha.
  discount numeric,
  -- Moneda del TICKET, no la de la transaccion. La fila madre guarda su equivalente en USD;
  -- los renglones se quedan en pesos, que es como estan impresos.
  currency text not null default 'ARS',
  category_hint text,
  created_at timestamptz not null default now()
);

create index if not exists transaction_items_transaction_idx
  on public.transaction_items (transaction_id, position);

-- Para la pregunta que justifica todo esto: "cuanto gaste en yerba este año".
create index if not exists transaction_items_user_description_idx
  on public.transaction_items (user_id, lower(description));

alter table public.transaction_items enable row level security;

drop policy if exists "transaction_items_select_own" on public.transaction_items;
create policy "transaction_items_select_own" on public.transaction_items
  for select using (auth.uid() = user_id);

drop policy if exists "transaction_items_insert_own" on public.transaction_items;
create policy "transaction_items_insert_own" on public.transaction_items
  for insert with check (auth.uid() = user_id);

drop policy if exists "transaction_items_update_own" on public.transaction_items;
create policy "transaction_items_update_own" on public.transaction_items
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "transaction_items_delete_own" on public.transaction_items;
create policy "transaction_items_delete_own" on public.transaction_items
  for delete using (auth.uid() = user_id);

-- La foto del ticket. Privado a proposito: un comprobante lleva nombre de comercio, fecha,
-- hora y a veces los ultimos digitos de la tarjeta. Se lee con URL firmada, no publica.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

-- Cada uno en su carpeta: el primer segmento del path es el user_id.
drop policy if exists "receipts_select_own" on storage.objects;
create policy "receipts_select_own" on storage.objects
  for select using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts_insert_own" on storage.objects;
create policy "receipts_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "receipts_delete_own" on storage.objects;
create policy "receipts_delete_own" on storage.objects
  for delete using (
    bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text
  );

comment on table public.transaction_items is
  'Renglones del ticket de una transaccion. En la moneda del ticket; la fila madre guarda el USD.';
