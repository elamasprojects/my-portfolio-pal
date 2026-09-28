-- Ajuste de saldo, segunda vuelta del code review.
--
-- El ancla (20260928130000) trataba "fechado antes del día del ajuste" como "ya incluido en el
-- saldo tipeado". Casi siempre es así, pero el review encontró cuatro formas en que no:
--
-- 1. Una reversión real se perdía. Mercury revierte un cargo del 25/09 el 30/09: el import lo
--    borra en blando con `reverted_by_sync` y el banco devuelve la plata, pero la fila es
--    anterior al ancla y el trigger no la devolvía. Lo mismo al revivir un cargo que se asentó
--    por otro monto. Ahora un cambio de estado hecho por el sync (la fila entra o sale marcada
--    `reverted_by_sync`) SIEMPRE mueve el saldo: es plata que se movió después del ajuste.
--    Un borrado manual de una fila vieja sigue sin moverlo: eso es limpiar un duplicado, y
--    el duplicado nunca estuvo en el banco.
--
-- 2. Lo fechado a futuro quedaba en el limbo. El trigger resta una fila apenas se carga,
--    aunque sea del mes que viene (un alquiler del 05/10 cargado el 20/09). El ajuste pisaba
--    el saldo con el del banco, que todavía no la incluye, pero la fila seguía viva: borrarla
--    devolvía una plata que nunca se había restado, y el 05/10 nadie la restaba. Ahora el
--    ajuste respeta la convención de la app: saldo = saldo real tipeado + efecto de lo
--    fechado después del día del ajuste. Queda guardado en `future_net`.
--
-- 3. El corte de día no coincidía con las fechas de Mercury. El import fecha cada cargo con
--    el día UTC de `postedAt`; las cargas manuales, con el día local. A las 21:30 de Buenos
--    Aires ya es el día siguiente en UTC, así que un cargo de Mercury de esa noche caía
--    "después" de un ajuste hecho a las 22 y se restaba dos veces. Ahora las filas de Mercury
--    se comparan contra el día UTC del ajuste y las demás contra el día de Buenos Aires.
--
-- 4. `balance_effect` era STABLE y leía el ancla de la foto de la sentencia. Si un INSERT
--    esperaba detrás del lock del ajuste, al seguir veía el ancla vieja y restaba sobre el
--    saldo recién tipeado. Ahora es VOLATILE: lee el ancla que haya al momento de ejecutarse.

alter table public.pf_balance_adjustments
  add column if not exists future_net numeric not null default 0;

drop function if exists public.balance_effect(uuid, numeric, numeric, text, date, timestamptz);

create or replace function public.balance_effect(
  p_account_id uuid,
  p_amount_usd numeric,
  p_original_amount numeric,
  p_original_currency text,
  p_transaction_date date,
  p_created_at timestamptz,
  p_external_source text,
  p_force boolean default false
)
returns numeric
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_currency text;
  v_anchor timestamptz;
  v_anchor_day date;
begin
  select currency, balance_anchor_at into v_currency, v_anchor
    from public.financial_accounts where id = p_account_id;

  if v_anchor is not null and not p_force then
    -- Cada fila contra el día en el que está fechada: UTC para Mercury, Buenos Aires para el
    -- resto (ver punto 3 del encabezado).
    v_anchor_day := case when p_external_source = 'mercury'
                         then (v_anchor at time zone 'UTC')::date
                         else (v_anchor at time zone 'America/Argentina/Buenos_Aires')::date end;
    if p_transaction_date < v_anchor_day
       or (p_transaction_date = v_anchor_day and coalesce(p_created_at, now()) <= v_anchor) then
      return 0;
    end if;
  end if;

  if v_anchor is not null and v_currency = 'ARS' and p_original_currency = 'ARS' and p_original_amount is not null then
    return p_original_amount;
  end if;
  return coalesce(p_amount_usd, 0);
end;
$$;

revoke all on function public.balance_effect(uuid, numeric, numeric, text, date, timestamptz, text, boolean) from public, anon, authenticated;

create or replace function public.sync_financial_account_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_acc_id uuid;
  v_force boolean := false;
begin
  -- Un borrado o un revive hecho por el sync de Mercury es plata que se movió de verdad:
  -- pasa por encima del ancla (punto 1 del encabezado).
  if tg_op = 'UPDATE'
     and (old.deleted_at is null) <> (new.deleted_at is null)
     and (coalesce(old.extracted_fields ? 'reverted_by_sync', false)
          or coalesce(new.extracted_fields ? 'reverted_by_sync', false)) then
    v_force := true;
  end if;

  if tg_op = 'DELETE' or tg_op = 'UPDATE' then
    if old.deleted_at is null then
      v_source_acc_id := old.account_id;
      if v_source_acc_id is null and old.payment_method_id is not null then
        select account_id into v_source_acc_id from public.payment_methods where id = old.payment_method_id;
      end if;

      if old.type = 'income' and v_source_acc_id is not null then
        update public.financial_accounts
           set current_balance = current_balance
             - public.balance_effect(v_source_acc_id, old.amount_usd, old.original_amount, old.original_currency, old.transaction_date, old.created_at, old.external_source, v_force)
         where id = v_source_acc_id;
      elsif (old.type = 'expense' or old.type = 'investment') and v_source_acc_id is not null then
        update public.financial_accounts
           set current_balance = current_balance
             + public.balance_effect(v_source_acc_id, old.amount_usd, old.original_amount, old.original_currency, old.transaction_date, old.created_at, old.external_source, v_force)
         where id = v_source_acc_id;
      elsif old.type = 'transfer' then
        if v_source_acc_id is not null then
          update public.financial_accounts
             set current_balance = current_balance
               + public.balance_effect(v_source_acc_id, old.amount_usd, old.original_amount, old.original_currency, old.transaction_date, old.created_at, old.external_source, v_force)
           where id = v_source_acc_id;
        end if;
        if old.destination_account_id is not null then
          update public.financial_accounts
             set current_balance = current_balance
               - public.balance_effect(old.destination_account_id, old.amount_usd, old.original_amount, old.original_currency, old.transaction_date, old.created_at, old.external_source, v_force)
           where id = old.destination_account_id;
        end if;
      end if;
    end if;
  end if;

  if tg_op = 'INSERT' or tg_op = 'UPDATE' then
    if new.deleted_at is null then
      v_source_acc_id := new.account_id;
      if v_source_acc_id is null and new.payment_method_id is not null then
        select account_id into v_source_acc_id from public.payment_methods where id = new.payment_method_id;
      end if;

      if new.type = 'income' and v_source_acc_id is not null then
        update public.financial_accounts
           set current_balance = current_balance
             + public.balance_effect(v_source_acc_id, new.amount_usd, new.original_amount, new.original_currency, new.transaction_date, new.created_at, new.external_source, v_force)
         where id = v_source_acc_id;
      elsif (new.type = 'expense' or new.type = 'investment') and v_source_acc_id is not null then
        update public.financial_accounts
           set current_balance = current_balance
             - public.balance_effect(v_source_acc_id, new.amount_usd, new.original_amount, new.original_currency, new.transaction_date, new.created_at, new.external_source, v_force)
         where id = v_source_acc_id;
      elsif new.type = 'transfer' then
        if v_source_acc_id is not null then
          update public.financial_accounts
             set current_balance = current_balance
               - public.balance_effect(v_source_acc_id, new.amount_usd, new.original_amount, new.original_currency, new.transaction_date, new.created_at, new.external_source, v_force)
           where id = v_source_acc_id;
        end if;
        if new.destination_account_id is not null then
          update public.financial_accounts
             set current_balance = current_balance
               + public.balance_effect(new.destination_account_id, new.amount_usd, new.original_amount, new.original_currency, new.transaction_date, new.created_at, new.external_source, v_force)
           where id = new.destination_account_id;
        end if;
      end if;
    end if;
  end if;

  return null;
end;
$$;

create or replace function public.adjust_account_balance(
  p_account_id uuid,
  p_real_balance numeric,
  p_note text default null
)
returns public.pf_balance_adjustments
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.financial_accounts;
  v_row public.pf_balance_adjustments;
  v_future numeric := 0;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if p_real_balance is null then
    raise exception 'Falta el saldo real';
  end if;

  select * into v_account
    from public.financial_accounts
   where id = p_account_id and user_id = auth.uid()
   for update;

  if not found then
    raise exception 'Cuenta no encontrada';
  end if;

  -- El ancla primero: con ella puesta, `balance_effect` devuelve 0 para todo lo ya incluido y
  -- el efecto real para lo fechado después del día del ajuste (punto 2 del encabezado).
  update public.financial_accounts set balance_anchor_at = now() where id = p_account_id;

  select coalesce(sum(
           case
             when t.type = 'income' and coalesce(t.account_id, pm.account_id) = p_account_id then 1
             when t.type in ('expense', 'investment') and coalesce(t.account_id, pm.account_id) = p_account_id then -1
             when t.type = 'transfer' and t.destination_account_id = p_account_id then 1
             when t.type = 'transfer' and coalesce(t.account_id, pm.account_id) = p_account_id then -1
             else 0
           end
           * public.balance_effect(p_account_id, t.amount_usd, t.original_amount, t.original_currency,
                                   t.transaction_date, t.created_at, t.external_source)
         ), 0)
    into v_future
    from public.transactions t
    left join public.payment_methods pm on pm.id = t.payment_method_id
   where t.user_id = auth.uid()
     and t.deleted_at is null
     and (coalesce(t.account_id, pm.account_id) = p_account_id or t.destination_account_id = p_account_id);

  update public.financial_accounts
     set current_balance = p_real_balance + v_future, updated_at = now()
   where id = p_account_id;

  insert into public.pf_balance_adjustments (user_id, account_id, balance_before, balance_after, currency, note, future_net)
  values (auth.uid(), p_account_id, coalesce(v_account.current_balance, 0), p_real_balance,
          coalesce(v_account.currency, 'USD'), nullif(trim(p_note), ''), v_future)
  returning * into v_row;

  return v_row;
end;
$$;
