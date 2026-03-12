
Objetivo: resolver definitivamente ventas (acciones disponibles), corregir el total final con comisión y dejar una base robusta para que no vuelva a romperse.

## Diagnóstico (por qué hoy falla)

1. **Ventas**
- Hoy la disponibilidad para vender se calcula en cliente (`computeHoldings(trades)`), no existe una fuente “oficial” en DB de posiciones por cuenta/portfolio/símbolo.
- Esa validación depende del estado local (query cargada, símbolo seleccionado, normalización), por eso puede mostrar `0.000` aunque haya compras registradas.
- No hay validación fuerte a nivel DB para impedir inconsistencias o para garantizar que una venta use posición real.

2. **Comisión en total final**
- La comisión se guarda (`commission_pct`, `commission_amount`), pero el monto mostrado en UI usa el subtotal (`quantity * price`) y **no** aplica neto con comisión.
- Resultado: se persiste comisión, pero el “precio final” visible queda incorrecto.

3. **Slider de comisión**
- Está muy sensible al tipo de dato/estado controlado.
- Si llega un valor no normalizado o hay re-render durante interacción, el drag puede sentirse “bloqueado”.

## Enfoque recomendado (mejor que solo “crear tabla y listo”)

Crear una **tabla de posiciones derivada y mantenida automáticamente** por la DB:
- `portfolio_positions` (user_id, portfolio_id, symbol, quantity, avg_cost, cost_basis, updated_at).
- Se actualiza por trigger cada vez que cambia `trades` (INSERT/UPDATE/DELETE).
- Y además agregar validación de venta en DB (no permitir vender más cantidad que disponible).

Esto es mejor que depender solo del frontend porque:
- hace la venta consistente en todos los dispositivos,
- evita desincronización de estado,
- deja un “ledger + posición” robusto para escalar.

## Plan de implementación

### Fase 1 — Backend de posiciones (núcleo)
1. Crear `public.portfolio_positions` con PK compuesta `(user_id, portfolio_id, symbol)`.
2. Agregar función `rebuild_position(user_id, portfolio_id, symbol)` que:
   - normaliza símbolo (`upper(trim(symbol))`),
   - recalcula cantidad neta desde `trades`,
   - recalcula costo promedio/cost basis considerando comisiones en compras.
3. Trigger `AFTER INSERT/UPDATE/DELETE` en `trades`:
   - reconstruye posición afectada (OLD y/o NEW símbolo/portfolio).
4. Trigger de validación `BEFORE INSERT/UPDATE` en `trades` para ventas:
   - bloquea operación si `sell_qty > available_qty`.
5. RLS en `portfolio_positions`:
   - lectura del dueño,
   - escritura solo vía trigger (o políticas owner-only si hiciera falta para operaciones internas).

### Fase 2 — Migración de cuentas actuales (backfill)
1. Ejecutar backfill para generar posiciones desde historial de `trades` existente.
2. Normalizar símbolos históricos (`upper(trim(symbol))`) para evitar duplicados lógicos (`aapl` vs `AAPL`).
3. Resolver inconsistencias históricas:
   - si hay neto <= 0, no crear posición abierta;
   - guardar reporte de anomalías (opcional) para auditoría.
4. No tocar `total_amount` desde cliente (es columna generada).

### Fase 3 — Frontend ventas en `/add`
1. Dejar de depender de `computeHoldings(trades)` para venta.
2. Consumir `portfolio_positions` (hook nuevo `usePortfolioPositions`).
3. Dropdown de activos y “acciones disponibles” salen de esa tabla.
4. En submit:
   - mantener validación UX en cliente,
   - y confiar en validación final DB (si falla, mostrar mensaje claro).

### Fase 4 — Comisión y total final visible
1. Calcular en UI:
   - `subtotal = qty * price`
   - `commission = subtotal * pct / 100`
   - `final`:
     - compra: `subtotal + commission`
     - venta: `subtotal - commission`
2. Mostrar desglose en resumen/fondo del form:
   - Subtotal
   - Comisión (% y monto)
   - Total final (neto)
3. Confirmación post-submit también debe mostrar total neto (no bruto).

### Fase 5 — Slider comisión estable
1. Normalizar valor a `Number(...)` antes de pasarlo al Slider.
2. Mantener estado local optimista durante drag (`onValueChange`) + persistencia en commit (`onValueCommit`).
3. Agregar fallback input numérico (0.0–1.5) para mobile/accesibilidad.

## Detalle técnico (resumen)
- Nueva fuente de verdad: `portfolio_positions`.
- Integridad garantizada en DB con triggers + validación de venta.
- Backfill para todos los usuarios actuales sin perder historial.
- UI de Add Trade pasa a leer posiciones persistidas.
- UI de total final pasa a mostrar neto con comisión.
- Se mantiene modelo ledger (`trades`) y se añade capa derivada para performance y consistencia.

## Criterios de éxito
1. Si hay compras previas, el activo aparece con cantidad correcta para vender.
2. No se puede vender más cantidad que la disponible (bloqueo DB + mensaje UI).
3. El total final mostrado en compra/venta refleja comisión correctamente.
4. Slider de comisión se mueve y persiste sin “rebote”.
5. Usuarios actuales migrados con posiciones generadas desde su historial.
