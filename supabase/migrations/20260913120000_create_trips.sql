-- Un viaje: la ventana de fechas, y las excepciones que la ventana no ve.
--
-- Filtrar los gastos de un viaje sólo por fecha miente en los dos sentidos, y el viaje a
-- Europa de 2026 muestra las dos caras:
--
--   * Lo prepago queda afuera. El vuelo BUE↔MAD se pagó el 22/05, un mes antes de salir, y
--     dos hospedajes el 20 y el 21/06. Son US$ 2.360 del viaje que ninguna ventana que
--     empiece el 24/06 puede contener — y son la parte más cara.
--   * Lo de casa queda adentro. La luz de Edesur siguió llegando en julio y agosto, y el día
--     de la vuelta entraron dos compras en pesos con una tarjeta local. Nada de eso es gasto
--     de viaje, pero cae justo dentro de la ventana.
--
-- Por eso el viaje se define con dos piezas: el rango, que resuelve la enorme mayoría sin
-- que haya que marcar nada, y `pf_trip_items`, que corrige las dos puntas a mano. La
-- pertenencia se resuelve como "está en el rango y no fue excluida, o fue incluida
-- explícitamente"; la regla vive en `src/lib/tripSummary.ts`, del lado que se puede probar.
--
-- El default cubre sólo gastos a propósito. Durante estos 77 días entraron US$ 14.210 de
-- ingresos de UGC Studio que no tienen nada que ver con el viaje: si el rango arrastrara todo
-- tipo de movimiento, el resumen abriría anunciando que el viaje dejó ganancia. Un ingreso
-- entra al viaje sólo si se lo incluye a mano, que es el caso real de los reembolsos de
-- tax free.

create table if not exists public.pf_trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  destination text,
  start_date date not null,
  end_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pf_trips_dates_ordered check (end_date >= start_date)
);

create index if not exists pf_trips_user_start_idx
  on public.pf_trips (user_id, start_date desc);

-- Las excepciones a la ventana. `mode` dice para qué lado corrige.
create table if not exists public.pf_trip_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  trip_id uuid not null references public.pf_trips (id) on delete cascade,
  transaction_id uuid not null references public.transactions (id) on delete cascade,
  mode text not null check (mode in ('include', 'exclude')),
  -- Por qué esta fila se sacó o se trajo. Se muestra en la pantalla: dentro de seis meses,
  -- "por qué el vuelo cuenta y la luz no" no se puede reconstruir del monto.
  reason text,
  created_at timestamptz not null default now()
);

-- Una transacción se resuelve una sola vez por viaje. Sin esto, una fila marcada 'include' y
-- 'exclude' a la vez haría que el total dependiera del orden en que volvieron las filas.
create unique index if not exists pf_trip_items_unique_per_trip
  on public.pf_trip_items (trip_id, transaction_id);

create index if not exists pf_trip_items_user_trip_idx
  on public.pf_trip_items (user_id, trip_id);

alter table public.pf_trips enable row level security;
alter table public.pf_trip_items enable row level security;

create policy "Users can view their own trips"
  on public.pf_trips for select
  to authenticated
  using (auth.uid() = user_id);

create policy "Users can create their own trips"
  on public.pf_trips for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own trips"
  on public.pf_trips for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own trips"
  on public.pf_trips for delete
  to authenticated
  using (auth.uid() = user_id);

-- El viaje referido tiene que ser del mismo usuario. `user_id = auth.uid()` sola dejaría
-- colgar una excepción de un viaje ajeno: el dueño de ese viaje no la vería (no es su
-- user_id) pero su total cambiaría igual.
create policy "Users can view their own trip items"
  on public.pf_trip_items for select
  to authenticated
  using (
    auth.uid() = user_id
    and exists (select 1 from public.pf_trips t where t.id = trip_id and t.user_id = auth.uid())
  );

create policy "Users can create their own trip items"
  on public.pf_trip_items for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.pf_trips t where t.id = trip_id and t.user_id = auth.uid())
    and exists (
      select 1 from public.transactions tx where tx.id = transaction_id and tx.user_id = auth.uid()
    )
  );

create policy "Users can update their own trip items"
  on public.pf_trip_items for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.pf_trips t where t.id = trip_id and t.user_id = auth.uid())
  );

create policy "Users can delete their own trip items"
  on public.pf_trip_items for delete
  to authenticated
  using (auth.uid() = user_id);

comment on table public.pf_trips is
  'Un viaje: ventana de fechas para resolver la mayoria de los gastos sin marcar nada a mano.';
comment on table public.pf_trip_items is
  'Excepciones a la ventana de un viaje: include trae lo prepago de antes de salir, exclude saca lo de casa que cayo adentro.';
