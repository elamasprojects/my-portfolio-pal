# Períodos del Sankey y gráficos de Movimientos

## El problema

- El Sankey de `/finance` mostraba **siempre el histórico entero** (US$ 90.847 de flujo al
  27/09/2026). No había forma de ver cómo viene el mes, que es lo que uno viene a mirar.
- El gráfico se desbordaba por debajo de su tarjeta: el SVG calcula su alto según la cantidad
  de categorías y estaba metido en una caja fija de 320 px.
- En `/movements` no había ninguna vista agregada: para saber si este mes se gasta más que el
  anterior había que sumar filas a mano.
- De yapa: el desglose al hacer clic en un nodo de gasto del Sankey siempre venía vacío.
  Filtraba por `t.category?.name`, que nunca llega (la consulta de transacciones no hace el
  join), así que todo gasto caía en "Otros Gastos".

## Las definiciones que sostienen el diseño

1. **Un solo módulo decide los períodos** (`src/lib/financePeriods.ts`). El Sankey, el feed y
   los gráficos cortan igual; si "mes anterior" empezara distinto en cada pantalla, los totales
   no cerrarían entre sí.
2. **El año en curso se compara contra el mismo tramo del año pasado** (1/1 al mismo día), no
   contra el año entero: nueve meses contra doce siempre darían "este año gastás menos".
3. **La línea es acumulada, alineada por posición** (día 12 contra día 12). Responde "¿voy
   gastando más o menos que el mes pasado a esta altura?"; el gasto diario es ruido.
4. **`investment` cuenta como egreso**, igual que en el Sankey, para que el margen de
   `/movements` y el "Excedente Neto" de `/finance` den lo mismo para el mismo período.

## Qué se construyó

| Pieza | Qué hace |
| --- | --- |
| `financePeriods.ts` | `resolvePeriod`, `previousPeriod`, `flowTotals`, `categoryBreakdown`, `buildPeriodSeries` — puro, con tests |
| `PeriodToggle` | Los períodos como botones juntos (rótulos cortos en el teléfono) |
| `PatrimonioView` | Selector de período en el Sankey, default **Mes actual**; sin alto fijo |
| `SankeyFlowChart` | Recibe `categories` y resuelve el nombre de categoría igual que el builder del Sankey |
| `MovimientosView` | El desplegable de ventana pasa a botones: 30 días · Mes anterior · Año en curso · Histórico |
| `FlowChartsCard` | Tarjeta colapsada con Ingresos / Egresos / Margen y su variación; abierta, tres gráficos en fila, en línea (con el período anterior punteado) o en torta por categoría |

Comparaciones: 30 días → 30 previos; mes actual → mes anterior; mes anterior → el anterior a
ese; año en curso → mismo tramo del año pasado; histórico → sin comparación.

## Lo que NO entra

- Los gráficos siguen al período, no al filtro de tipo ni al buscador ni a "Pendientes".
- Las ventanas "Últimos 3 meses" y "Último año" del feed se reemplazan por las pedidas.
- Sin cambios de base: todo se calcula sobre las transacciones que ya estaban en caché.

## Datos (no código)

Viaje **San Luis 2026** (19–24/09/2026) cargado en `pf_trips`, con cuatro gastos: bus de ida,
costos compartidos, hongos y bus de vuelta (US$ 236,15). Lo demás que cae en esas fechas
(Edesur, súper, colectivo, kiosko) quedó excluido con `pf_trip_items`.

## Cómo se verifica

- `npx vitest run src/lib/__tests__/financePeriods.test.ts`
- `/finance`: el Sankey arranca en Mes actual; Histórico vuelve a dar US$ 90.847.
- `/movements`: abrir "Gráficos del período", alternar Línea/Torta y los cuatro períodos.
