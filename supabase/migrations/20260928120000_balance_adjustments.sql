-- Ajuste de saldo: poner una cuenta en el saldo real sin inventar un movimiento.
--
-- `financial_accounts.current_balance` lo mueven sólo los triggers de `transactions`. Eso
-- funciona mientras todo lo que pasa en una cuenta esté cargado, y no lo está: las
-- transferencias entre cuentas propias casi nunca se registran. Al 28/09/2026 DolarApp
-- figuraba con US$ -4.636 y Payoneer con US$ -3.491 — plata que salió de una cuenta y entró
-- en otra sin que la app se enterara.
--
-- La salida no es cargar cada transferencia (no va a pasar) sino, cada tanto, decirle a la app
-- cuánto hay de verdad. Dos decisiones:
--
--   * El ajuste NO es una transacción. Si fuera un ingreso o un gasto, cada conciliación
--     ensuciaría el Sankey, los gráficos y la tasa de ahorro con plata que no se ganó ni se
--     gastó. Vive en su propia tabla y toca el saldo directo.
--   * El saldo se expresa en la moneda de la CUENTA, igual que lo lee /finance (una cuenta
--     ARS se divide por el MEP al mostrarla). Por eso el ajuste guarda la moneda de la cuenta
--     en ese momento, no un monto en dólares.
--
-- La tabla es el historial: antes, después y la diferencia. Sin él un ajuste es un número que
-- cambió sin explicación, y dentro de un mes nadie sabe si la cuenta se corrigió a mano o si
-- un trigger se equivocó.

create table if not exists public.pf_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  account_id uuid not null references public.financial_accounts (id) on delete cascade,
  balance_before numeric not null,
  balance_after numeric not null,
  delta numeric generated always as (balance_after - balance_before) stored,
  currency text not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists pf_balance_adjustments_account_idx
  on public.pf_balance_adjustments (account_id, created_at desc);

alter table public.pf_balance_adjustments enable row level security;

-- Sólo lectura desde el cliente. La escritura pasa por `adjust_account_balance`, que es la
-- única puerta que mueve el saldo y el historial juntos: un INSERT suelto dejaría una fila de
-- historial sin que el saldo cambiara, y un historial que miente es peor que ninguno.
drop policy if exists "Users can view their own balance adjustments" on public.pf_balance_adjustments;
create policy "Users can view their own balance adjustments"
  on public.pf_balance_adjustments for select
  to authenticated
  using (auth.uid() = user_id);

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

  -- FOR UPDATE: si un trigger de `transactions` mueve la cuenta al mismo tiempo, el "antes"
  -- que se guarda tiene que ser el que se reemplazó, no uno de hace un instante.
  select * into v_account
    from public.financial_accounts
   where id = p_account_id and user_id = auth.uid()
   for update;

  if not found then
    raise exception 'Cuenta no encontrada';
  end if;

  update public.financial_accounts
     set current_balance = p_real_balance, updated_at = now()
   where id = p_account_id;

  insert into public.pf_balance_adjustments (user_id, account_id, balance_before, balance_after, currency, note)
  values (auth.uid(), p_account_id, coalesce(v_account.current_balance, 0), p_real_balance,
          coalesce(v_account.currency, 'USD'), nullif(trim(p_note), ''))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.adjust_account_balance(uuid, numeric, text) from public, anon;
grant execute on function public.adjust_account_balance(uuid, numeric, text) to authenticated;
