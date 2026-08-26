-- Una tarjeta de Mercury tiene un solo dueño.
--
-- El seed de `mercury_card_links` resuelve los IDs locales por nombre
-- (`where pm.name = 'Mercury Debit Card'`) sin filtrar por usuario. Hoy hay un
-- solo medio de pago con ese nombre, así que insertó una fila. Pero el UUID de
-- la tarjeta viene literal de Mercury: si mañana otra persona nombra igual a su
-- medio de pago, el seed le engancharía la tarjeta ajena y el cron le
-- importaría los movimientos de otro a su cuenta. `on conflict (user_id,
-- mercury_card_id)` no lo frena porque el par sería distinto.
--
-- El índice deja esa invariante en el esquema en vez de en la buena suerte del
-- match por nombre: un segundo vínculo a la misma tarjeta falla en vez de
-- mezclar ledgers en silencio.
create unique index if not exists mercury_card_links_card_id_unique
  on public.mercury_card_links (mercury_card_id);

comment on index public.mercury_card_links_card_id_unique is
  'Una tarjeta de Mercury pertenece a un unico usuario: impide vincular la misma mercury_card_id a dos cuentas.';
