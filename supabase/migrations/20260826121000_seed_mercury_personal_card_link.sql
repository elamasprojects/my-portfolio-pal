-- Vincula la tarjeta personal de Mercury (••6066) con el medio de pago y la
-- cuenta que ya existen en el módulo de finanzas.
--
-- El UUID de la tarjeta viene de Mercury (GET /api/v1/cards), no lo genera esta
-- base, así que va literal: es un identificador externo, no una FK. Los IDs
-- locales se resuelven por nombre para no clavar IDs generados.
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
  fa.id,
  true,
  30
from public.payment_methods pm
left join public.financial_accounts fa
  on fa.user_id = pm.user_id and fa.name = 'Mercury'
where pm.name = 'Mercury Debit Card'
on conflict (user_id, mercury_card_id) do nothing;
