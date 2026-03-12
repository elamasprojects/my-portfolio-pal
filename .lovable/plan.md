

# Etapas 1-2: Edición Completa, Búsqueda por Nombre, MEP Histórico

## Etapa 1.1 — Edición completa de trades (EditTradeDialog)

**Problema actual**: Faltan campos editables: strategy, broker, trade_type, original_currency. Además se envía `total_amount` manualmente, lo cual viola la restricción de columna generada.

**Cambios en `src/components/EditTradeDialog.tsx`**:
- Agregar estados para `strategyId`, `brokerId`, `tradeCurrency` (original_currency)
- Agregar selectores de Strategy y Broker (reutilizando hooks `useStrategies`, `useUserBrokers`)
- Mostrar trade_type como badge no-editable (cambiar tipo de trade es peligroso por triggers de posiciones)
- Quitar `total_amount` del payload de update (columna generada)
- Agregar recálculo de `commission_amount` al guardar basado en broker seleccionado
- Importar `useStrategies`, `useUserBrokers`, `useProfile`
- Pre-cargar valores desde `trade.strategy_id`, `trade.broker_id`, `trade.original_currency`

## Etapa 1.2 — Búsqueda por nombre de empresa

**Problema actual**: El input de symbol en AddTrade solo busca por ticker exacto. Finnhub ofrece `/search?q=query` que devuelve matches con `{description, symbol}`.

**Cambios**:

1. **Nuevo edge function `search-symbol/index.ts`**:
   - Recibe `{ query: string }`
   - Llama a `https://finnhub.io/api/v1/search?q=${query}&token=${apiKey}`
   - Devuelve array de `{ symbol, description }` (top 8 results, filtrado a stocks/ETFs)

2. **En `src/pages/AddTrade.tsx`** (solo modo buy):
   - Reemplazar el `<Input>` de symbol por un combo con dropdown de resultados
   - Debounce de 400ms al escribir → llamar a `search-symbol`
   - Mostrar dropdown con resultados: `MSFT — Microsoft Corp`
   - Al seleccionar, setear `symbol` y `assetName`, luego fetch-quote para el precio
   - Mantener el input libre (si el usuario escribe un ticker directo, funciona como hoy)

## Etapa 2.1 — MEP histórico por fecha de trade

**Problema**: Trades de fechas pasadas usan el MEP de hoy, no el de la fecha del trade.

**Cambios**:

1. **Migration**: `ALTER TABLE trades ADD COLUMN mep_rate numeric;`

2. **API check**: `dolarapi.com` no tiene endpoint histórico confiable. Solución: input manual con auto-fill del MEP actual si fecha = hoy.

3. **En AddTrade.tsx**:
   - Si `tradeCurrency === "ARS"`, mostrar campo "Dólar MEP" pre-llenado con el rate actual
   - Si el usuario cambia la fecha a una pasada, mostrar warning "Verificá el MEP de esa fecha" y hacer el campo editable
   - Guardar `mep_rate` en el insert payload
   - Usar `mep_rate` (si existe) en vez del rate actual para la conversión

4. **En EditTradeDialog**: mostrar `mep_rate` como campo editable para trades ARS

5. **Actualizar `usePortfolio` y hooks de conversión** para usar `trade.mep_rate` cuando esté disponible

## Etapa 3 — CEDEARs (fuera de scope por ahora)

Requiere tabla de ratios + seed data + lógica de conversión. Se deja para una iteración futura.

## Resumen de archivos

| Archivo | Cambio |
|---|---|
| `src/components/EditTradeDialog.tsx` | Agregar strategy, broker, currency, quitar total_amount, recalcular comisión |
| `supabase/functions/search-symbol/index.ts` | Nuevo: búsqueda por nombre via Finnhub /search |
| `supabase/config.toml` | Agregar config para `search-symbol` |
| `src/pages/AddTrade.tsx` | Dropdown de búsqueda por nombre en modo buy, campo MEP editable para ARS |
| Migration SQL | `ALTER TABLE trades ADD COLUMN mep_rate numeric;` |
| `src/integrations/supabase/types.ts` | Se actualiza automáticamente |

