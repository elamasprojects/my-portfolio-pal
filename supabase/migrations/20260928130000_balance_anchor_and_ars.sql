-- Que un ajuste de saldo aguante: el ancla, y las cuentas en pesos.
--
-- Salió del code review del ajuste de saldo (20260928120000). Dos agujeros por los que un saldo
-- recién conciliado volvía a derivar solo:
--
-- 1. Lo anterior al ajuste se contaba dos veces. El ajuste fija el saldo a un número exacto
--    que YA incluye todo lo ocurrido hasta ese momento, pero el trigger seguía aplicando
--    cualquier cambio a filas viejas: un cargo de Mercury que el import trae días después,
--    un duplicado viejo que se borra, un monto de hace un mes que se corrige. Cada uno movía
--    otra vez un saldo que ya lo contemplaba.
--    Ahora la cuenta guarda `balance_anchor_at`, el momento del último ajuste, y el trigger
--    ignora las filas fechadas antes de ese día. Las del mismo día cuentan sólo si se crearon
--    después del ajuste: lo cargado antes ya estaba en el número que se tipeó.
--
-- 2. Las cuentas en pesos se movían en dólares. El saldo de una cuenta ARS está en pesos
--    (así lo lee /finance y así lo pide el ajuste), pero el trigger le restaba `amount_usd`:
--    un gasto de $12.000 le sacaba unos 8. Ahora, si la cuenta es ARS, ya fue conciliada y la
--    fila tiene su monto original en ARS, se usa ese. Sin conciliar se deja como estaba: ese
--    saldo se armó en dólares y mezclarle pesos lo empeoraría. Una fila en dólares contra una
--    cuenta en pesos sigue usando `amount_usd`, como antes: no hay un tipo de cambio
--    confiable guardado para convertirla, y adivinarlo sería peor.

alter table public.financial_accounts
  add column if not exists balance_anchor_at timestamptz;

-- Cuánto mueve una fila el saldo de una cuenta. 0 si la fila ya estaba contemplada en el
-- último ajuste de esa cuenta.
create or replace function public.balance_effect(
  p_account_id uuid,
  p_amount_usd numeric,
  p_original_amount numeric,
  p_original_currency text,
  p_transaction_date date,
  p_created_at timestamptz
)
returns numeric
language plpgsql
stable
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

  if v_anchor is not null then
    -- El día del ajuste en hora argentina: un ajuste a las 22 hs de Buenos Aires ya es el día
    -- siguiente en UTC, y compararlo contra fechas locales correría el corte un día.
    v_anchor_day := (v_anchor at time zone 'America/Argentina/Buenos_Aires')::date;
    if p_transaction_date < v_anchor_day
       or (p_transaction_date = v_anchor_day and coalesce(p_created_at, now()) <= v_anchor) then
      return 0;
    end if;
  end if;

  -- Sólo en cuentas ya conciliadas. Antes del primer ajuste, el saldo de una cuenta ARS se
  -- armó sumando dólares; si borrar una fila vieja le devolviera pesos, le metería 50.000 donde
  -- se habían restado 30. Con ancla, las filas viejas ya no la tocan y el saldo es de pesos.
  if v_anchor is not null and v_currency = 'ARS' and p_original_currency = 'ARS' and p_original_amount is not null then
    return p_original_amount;
  end if;
  return coalesce(p_amount_usd, 0);
end;
$$;

revoke all on function public.balance_effect(uuid, numeric, numeric, text, date, timestamptz) from public, anon, authenticated;

-- Misma estructura que antes; cambia sólo el monto, que ahora sale de `balance_effect`.
create or replace function public.sync_financial_account_balance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source_acc_id uuid;
begin
  if tg_op = 'DELETE' or tg_op = 'UPDATE' then
    if old.deleted_at is null then
      v_source_acc_id := old.account_id;
      if v_source_acc_id is null and old.payment_method_id is not null then
        select account_id into v_source_acc_id from public.payment_methods where id = old.payment_method_id;
      end if;

      if old.type = 'income' and v_source_acc_id is not null then
        update public.financial_accounts
           set current_balance = current_balance
             - public.balance_effect(v_source_acc_id, old.amount_usd, old.original_amount, old.original_currency, old.transaction_date, old.created_at)
         where id = v_source_acc_id;
      elsif (old.type = 'expense' or old.type = 'investment') and v_source_acc_id is not null then
        update public.financial_accounts
           set current_balance = current_balance
             + public.balance_effect(v_source_acc_id, old.amount_usd, old.original_amount, old.original_currency, old.transaction_date, old.created_at)
         where id = v_source_acc_id;
      elsif old.type = 'transfer' then
        if v_source_acc_id is not null then
          update public.financial_accounts
             set current_balance = current_balance
               + public.balance_effect(v_source_acc_id, old.amount_usd, old.original_amount, old.original_currency, old.transaction_date, old.created_at)
           where id = v_source_acc_id;
        end if;
        if old.destination_account_id is not null then
          update public.financial_accounts
             set current_balance = current_balance
               - public.balance_effect(old.destination_account_id, old.amount_usd, old.original_amount, old.original_currency, old.transaction_date, old.created_at)
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
             + public.balance_effect(v_source_acc_id, new.amount_usd, new.original_amount, new.original_currency, new.transaction_date, new.created_at)
         where id = v_source_acc_id;
      elsif (new.type = 'expense' or new.type = 'investment') and v_source_acc_id is not null then
        update public.financial_accounts
           set current_balance = current_balance
             - public.balance_effect(v_source_acc_id, new.amount_usd, new.original_amount, new.original_currency, new.transaction_date, new.created_at)
         where id = v_source_acc_id;
      elsif new.type = 'transfer' then
        if v_source_acc_id is not null then
          update public.financial_accounts
             set current_balance = current_balance
               - public.balance_effect(v_source_acc_id, new.amount_usd, new.original_amount, new.original_currency, new.transaction_date, new.created_at)
           where id = v_source_acc_id;
        end if;
        if new.destination_account_id is not null then
          update public.financial_accounts
             set current_balance = current_balance
               + public.balance_effect(new.destination_account_id, new.amount_usd, new.original_amount, new.original_currency, new.transaction_date, new.created_at)
           where id = new.destination_account_id;
        end if;
      end if;
    end if;
  end if;

  return null;
end;
$$;

-- El ajuste fija el ancla junto con el saldo: desde acá, lo anterior ya está contemplado.
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

  update public.financial_accounts
     set current_balance = p_real_balance, balance_anchor_at = now(), updated_at = now()
   where id = p_account_id;

  insert into public.pf_balance_adjustments (user_id, account_id, balance_before, balance_after, currency, note)
  values (auth.uid(), p_account_id, coalesce(v_account.current_balance, 0), p_real_balance,
          coalesce(v_account.currency, 'USD'), nullif(trim(p_note), ''))
  returning * into v_row;

  return v_row;
end;
$$;
