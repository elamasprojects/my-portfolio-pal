

# Plan: P&L Neto + Rediseño Completo del Dashboard

## 3 Grandes Cambios

### 1. Gráfico P&L con línea de P&L Neto (realizado + no realizado)

**`src/hooks/usePortfolio.tsx`**: Nueva función `computeCumulativePnLWithUnrealized(trades, marketPrices)`.
- En cada evento (sell/dividend), además del `cumulative_pnl` actual, calcula `net_pnl` = realizado acumulado + no realizado de posiciones abiertas (usando precios de mercado actuales como proxy del valor final).
- Actualizar `CumulativePnLPoint` para incluir `net_pnl`.

**`src/pages/Index.tsx`**: El AreaChart muestra 2 líneas: realizado (dorado) y neto (azul/verde), con leyenda.

### 2. Rediseño completo del Dashboard (Mobile + Desktop)

El dashboard actual tiene 8 columnas en la tabla de holdings (ilegible en mobile 407px), demasiadas metric cards apiladas, y falta un "hero" que muestre el valor total del portfolio de un vistazo.

**Nuevo layout**:

```text
MOBILE (407px):
┌─────────────────────┐
│ PORTFOLIO VALUE      │  Hero card: valor total + % cambio
│ $XX,XXX    +X.X%    │  Sub: cost basis → market value
└─────────────────────┘
┌────────┬────────────┐
│Realized│Unrealized  │  2x2 compact grid
├────────┼────────────┤
│Win Rate│   Cash     │
└────────┴────────────┘
┌─────────────────────┐
│ HOLDINGS (cards)    │  Cards verticales en vez de tabla
│ ┌─ AAPL ──────────┐ │  Cada card: symbol, qty, price,
│ │ 10 @ $150  +5%  │ │  market val, P&L con color
│ └─────────────────┘ │
│ ┌─ MSFT ──────────┐ │
│ │ 5 @ $380   -2%  │ │
│ └─────────────────┘ │
└─────────────────────┘
┌─────────────────────┐
│ ALLOCATION TABS     │  Tabs: Por Tipo | Por Activo
│ [Pie chart]         │  Tipo: stock/etf/crypto/bond/cash
│                     │  Activo: % por symbol individual
└─────────────────────┘
┌─────────────────────┐
│ P&L Over Time       │  2 líneas (realizado + neto)
└─────────────────────┘
┌─────────────────────┐
│ P&L by Asset (bars) │
└─────────────────────┘
┌─────────────────────┐
│ Recent Trades       │  Cards compactos en mobile
└─────────────────────┘

DESKTOP (1024px+):
┌────────────────────────────────────────────┐
│ Hero: Portfolio Value + mini metrics inline│
└────────────────────────────────────────────┘
┌──────────┬──────────┬──────────┬───────────┐
│Realized  │Unrealized│ Win Rate │   Cash    │
└──────────┴──────────┴──────────┴───────────┘
┌────────────────────────┬──────────────────┐
│ Holdings Table         │ Allocation Tabs  │
│ (symbol, qty, avg,     │ [Por Tipo]       │
│  price, mktVal, P&L%)  │ [Por Activo]     │
└────────────────────────┴──────────────────┘
┌────────────────────────────────────────────┐
│ P&L Over Time (2 lines + legend)          │
└────────────────────────────────────────────┘
┌──────────────────┬─────────────────────────┐
│ P&L by Asset     │ Recent Trades (table)   │
└──────────────────┴─────────────────────────┘
```

**Cambios concretos**:

- **Hero Card**: Valor total del portfolio (market value + cash), cambio % vs cost basis, sub-línea con dividendos y total trades.
- **Holdings en mobile**: Reemplazar tabla de 8 cols por cards verticales. Cada card muestra symbol (prominente), qty, avg cost, precio actual, market value, y P&L % con color. Clickeable → `/asset/:symbol`.
- **Holdings en desktop**: Tabla simplificada — quitar columna "Name" y "Type", dejar: Symbol, Qty, Avg Cost, Price, Market Val, P&L, P&L%.
- **Allocation con Tabs**: 2 vistas — "Por Tipo" (stock/etf/crypto/bond/cash como ahora) y "Por Activo" (pie por symbol individual, mostrando % de cada acción en el portfolio total).
- **Recent Trades en mobile**: Cards compactos con fecha, symbol, badge de tipo (BUY/SELL/DIV), y monto.
- **Stats secundarias** (holdings count, total trades, buys/sells, total return): mover a una fila compacta debajo del hero o eliminar redundancias.

### 3. Nota sobre distribución por país

La tabla `trades` no tiene campo `country`. Para agregar distribución geográfica se necesitaría:
- Opción A: Inferir país del símbolo (`.BA` = Argentina, sin sufijo = USA) — aproximado pero sin cambios en DB.
- Opción B: Agregar columna `country` a trades — preciso pero requiere migración y actualizar formularios.

**Propuesta**: Implementar Opción A (inferencia por sufijo) como un tab adicional "Por Mercado" en la sección de allocation. Esto cubre el 90% del caso de uso sin tocar la DB.

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/hooks/usePortfolio.tsx` | `computeCumulativePnLWithUnrealized()`, actualizar interface |
| `src/pages/Index.tsx` | Rediseño completo: hero, holdings cards (mobile), allocation tabs, P&L 2 líneas |
| `src/i18n/en.ts`, `es.ts` | ~10 keys nuevas (portfolioValue, netPnl, byType, byAsset, byMarket, etc.) |

