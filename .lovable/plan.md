

# Plan: Cash — Ventas No Reinvertidas

## Concepto

Cash = proceeds de todas las ventas + dividendos cobrados - costo de todas las compras realizadas **después** de la primera venta. Esto representa el capital liberado que no se reinvirtió.

Enfoque más simple y correcto: calcular cash **cronológicamente**. Una vez que ocurre la primera venta, el cash empieza a acumularse. Las compras posteriores lo reducen.

```text
cash = 0
for each trade (cronológico):
  if sell  → cash += proceeds (qty × price)
  if dividend → cash += amount
  if buy   → cash -= cost (qty × price)
  if cash < 0 → cash = 0  (compras iniciales no generan cash negativo)
```

## Cambios

### 1. Nueva función `computeCash` en `src/hooks/usePortfolio.tsx`

Recorre trades ordenados cronológicamente, acumula cash de sells/dividends y resta buys. Floor en 0 (no puede ser negativo — si compraste más de lo que vendiste, simplemente no tenés cash).

### 2. Dashboard `src/pages/Index.tsx`

- Llamar `computeCash(trades)` para obtener el saldo de liquidez.
- Agregar una nueva **Card** de "Cash Disponible" en el grid de métricas (al lado de Cost Basis, Market Value, etc.).
- Agregar "Cash" al **pie chart de allocation** como un segmento adicional con un color diferenciado (ej. azul claro).
- Incluir cash en el cálculo de **portfolio total** (market value + cash) para que los porcentajes de allocation reflejen la realidad.

### 3. Exportación `src/pages/ExportReport.tsx`

- Incluir cash en el reporte exportado como métrica adicional.

### 4. Traducciones `src/i18n/en.ts` y `es.ts`

- `board.cash`: "Cash Disponible" / "Available Cash"
- `board.cashTooltip`: texto explicativo

## Sin cambios en DB

Todo es cálculo client-side sobre los trades existentes. No se necesitan migraciones, nuevos tipos ni columnas.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/hooks/usePortfolio.tsx` | Nueva función `computeCash()` |
| `src/pages/Index.tsx` | Card de cash + allocation pie |
| `src/pages/ExportReport.tsx` | Incluir cash en reporte |
| `src/i18n/en.ts`, `es.ts` | 2-3 keys nuevas |

