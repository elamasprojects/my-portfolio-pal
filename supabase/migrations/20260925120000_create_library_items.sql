-- La biblioteca personal: libros, cursos, mentores y negocios creados.
--
-- Todo esto ya vive en el segundo cerebro (elamas-second-brain), en notas .md con
-- frontmatter. El problema es que ahí se consulta abriendo Obsidian: no hay una vista que
-- diga "leí 14 libros, hice 5 cursos, tuve 5 mentores y armé 12 negocios" junto al resto
-- de la vida financiera. Esta tabla es esa vista, no una segunda fuente de verdad.
--
-- Una sola tabla con `kind` y no cuatro: las cuatro cosas comparten el 90% de los campos
-- (título, estado, área, puntaje, fechas, resumen, "qué me dejó") y la pantalla las busca
-- juntas. Lo específico de cada tipo va en `extras`.

create table if not exists public.pf_library_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('book', 'course', 'mentor', 'venture')),
  title text not null,
  -- Autor del libro, instructor del curso, rol del mentor, rol en el negocio.
  subtitle text,
  -- Se guarda el estado tal cual lo escribe la vault (leído / leyendo / pendiente / activo /
  -- archivado / pausado / idea). Sin CHECK a propósito: la vault puede sumar un estado y la
  -- sincronización no tiene que voltearse por eso; la pantalla agrupa lo que conoce.
  status text,
  area text,
  categories text[] not null default '{}',
  -- Puntaje tal cual en la vault ("6", "⭐️⭐️⭐️⭐️"). Las dos escalas conviven en Notion y
  -- convertir una a la otra sería inventar un número; se normaliza sólo para mostrar.
  score_label text,
  format text,
  started_on text,
  ended_on text,
  summary text,
  key_learning text,
  outcome text,
  url text,
  content_potential text,
  extras jsonb not null default '{}',
  -- Ruta de la nota en la vault. Es la clave de la sincronización: re-importar actualiza la
  -- misma fila en vez de duplicarla. NULL = cargado a mano desde la app.
  source_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Una nota de la vault es una sola fila por usuario. Sin esto, cada re-sync duplicaría la
-- biblioteca entera.
create unique index if not exists pf_library_items_user_source_uidx
  on public.pf_library_items (user_id, source_path)
  where source_path is not null;

create index if not exists pf_library_items_user_kind_idx
  on public.pf_library_items (user_id, kind);

alter table public.pf_library_items enable row level security;

drop policy if exists "Users can view their own library" on public.pf_library_items;
create policy "Users can view their own library"
  on public.pf_library_items for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can create their own library items" on public.pf_library_items;
create policy "Users can create their own library items"
  on public.pf_library_items for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own library items" on public.pf_library_items;
create policy "Users can update their own library items"
  on public.pf_library_items for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own library items" on public.pf_library_items;
create policy "Users can delete their own library items"
  on public.pf_library_items for delete to authenticated
  using (auth.uid() = user_id);
