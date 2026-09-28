# Ajuste de saldo

## El problema

`financial_accounts.current_balance` lo mueven sólo los triggers de `transactions`. Las
transferencias entre cuentas propias casi nunca se cargan, así que los saldos derivan: al
28/09/2026 DolarApp figuraba con US$ -4.636 y Payoneer con US$ -3.491. Cargar cada
transferencia no va a pasar; conciliar una vez por mes sí.

## Las definiciones

1. **El ajuste no es una transacción.** Si fuera ingreso o gasto, cada conciliación ensuciaría
   el Sankey, los gráficos y la tasa de ahorro. Vive en `pf_balance_adjustments` y toca el
   saldo directo.
2. **El saldo va en la moneda de la cuenta**, igual que lo lee `/finance`.
3. **Una sola puerta**: `adjust_account_balance(account, real, note)` mueve el saldo y escribe
   el historial en la misma transacción. La tabla es de sólo lectura para el cliente.

## Qué se construyó

| Pieza | Qué hace |
| --- | --- |
| `pf_balance_adjustments` | Historial: antes, después, diferencia (generada), moneda, nota |
| `adjust_account_balance` | `security definer`, valida dueño, `FOR UPDATE`, ajusta y registra |
| `src/lib/balanceAdjustment.ts` | Parseo de montos (`1.234,56` y `1,234.56`), qué cuentas cambian, días desde el último ajuste |
| `useBalanceAdjustments` | Historial + mutación (una RPC por cuenta, en serie) |
| `BalanceAdjustDialog` | Todas las cuentas activas; vacío = no tocar; muestra la diferencia antes de guardar |
| `/finance` | Botón "Ajustar saldos" en el desglose por cuenta, con punto ámbar si pasó más de un mes |

## Lo que cambió después del code review

El review encontró dos formas en que un saldo recién ajustado volvía a derivar solo
(migración `20260928130000_balance_anchor_and_ars.sql`):

1. **Lo anterior al ajuste se contaba dos veces.** Un cargo que el import de Mercury trae
   días después, un duplicado viejo que se borra o un monto viejo que se corrige volvían a
   mover un saldo que ya los incluía. Ahora cada cuenta guarda `balance_anchor_at` y el
   trigger ignora las filas fechadas antes del día del ajuste (hora de Buenos Aires); las del
   mismo día cuentan sólo si se crearon después.
2. **Las cuentas en pesos se movían en dólares.** El trigger restaba `amount_usd` a una
   cuenta ARS. Ahora, en una cuenta ARS **ya conciliada**, una fila con original en ARS mueve
   el saldo por el monto en pesos. Antes del primer ajuste se deja como estaba: ese saldo se
   armó en dólares y mezclarle pesos lo empeoraría.

Probado en una transacción revertida, como el dueño: cuenta sin ancla (resta dólares como
antes), ajuste de ARQ a $100.000, gasto de hoy de $12.000 (queda en $88.000), gasto viejo
cargado tarde (no mueve) y borrado de una fila vieja (no mueve).

## Lo que NO entra

- Deshacer un ajuste desde la UI (queda el historial con el "antes" para hacerlo a mano).
- Convertir filas en dólares cargadas contra una cuenta en pesos: no hay tipo de cambio
  guardado confiable; siguen restando `amount_usd`.

## Verificación

- RPC probada impersonando al dueño (ajusta y registra) y a otro usuario ("Cuenta no encontrada").
- `npx vitest run src/lib/__tests__/balanceAdjustment.test.ts`
