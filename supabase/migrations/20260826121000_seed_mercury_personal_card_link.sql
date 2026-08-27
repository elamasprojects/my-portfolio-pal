-- Vincula la tarjeta personal de Mercury (••6066) con el medio de pago y la
-- cuenta que ya existen en el módulo de finanzas.
--
-- El UUID de la tarjeta viene de Mercury (GET /api/v1/cards), no lo genera esta
-- base, así que va literal: es un identificador externo, no una FK. Los IDs
-- locales se resuelven por nombre para no clavar IDs generados.
--
-- **Acotado a un usuario a propósito.** Matchear sólo por nombre de medio de
-- pago recorre todas las cuentas: en una base donde dos personas nombren igual
-- al suyo, esto insertaría dos vínculos a la MISMA tarjeta con distinto
-- `user_id` — que `on conflict (user_id, mercury_card_id)` no frena, porque el
-- par es distinto. La migración 173000 agrega después un índice único global
-- sobre `mercury_card_id`, así que ese segundo vínculo no sólo mezclaría
-- ledgers: haría fallar el `db reset` entero. El dueño se resuelve por email,
-- que es estable y no es un ID generado.
--
-- `account_id` se setea explícito porque "Mercury Debit Card" hoy no tiene
-- `account_id` propio: si se dejara derivar, el trigger de saldos no
-- encontraría cuenta y `financial_accounts.Mercury` nunca se movería.
insert into public.mercury_card_links (
  user_id, mercury_card_id, label, payment_method_id, account_id, is_active, lookback_days
)
select
  pm.user_id,
  '78a5d670-6b28-11f1-b796-273fbe970a5c',
  'Ezequiel tarjeta personal ••6066',
  pm.id,
  (
    -- Escalar y ordenado: dos cuentas con el mismo nombre elegirían una al azar,
    -- y es la columna que decide qué saldo mueve el trigger.
    select fa.id from public.financial_accounts fa
    where fa.user_id = pm.user_id and fa.name = 'Mercury'
    order by fa.created_at
    limit 1
  ),
  true,
  30
from public.payment_methods pm
where pm.name = 'Mercury Debit Card'
  and pm.user_id = (select id from auth.users where email = 'ezequiellamas@gmail.com')
order by pm.created_at
limit 1
on conflict (user_id, mercury_card_id) do nothing;
