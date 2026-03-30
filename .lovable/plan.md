

# Plan: Rediseño de Export Report (Mobile + Desktop)

## Problema

La página `/export` tiene un card con aspect-ratio fijo de 1200x630 (optimizado para Twitter). En mobile (407px), esto resulta en un card de apenas ~213px de alto donde todo el contenido se comprime: textos ilegibles, pie chart minúsculo, stats cortados. Los botones de acción también se desbordan horizontalmente.

## Solución

Separar la **vista previa visual** (lo que se exporta/comparte) del **layout de la página**. La card exportable mantiene su ratio 1200x630 para PDF/Twitter, pero la página muestra el contenido de forma responsive.

### Cambios en `src/pages/ExportReport.tsx`

**1. Header y controles (mobile-friendly)**
- Botones apilados verticalmente en mobile, horizontales en desktop
- Toggle de tema más compacto

**2. Dos modos de visualización:**

- **Card exportable** (hidden ref div): Se mantiene el div con aspect-ratio 1200x630 pero se oculta visualmente (`position: absolute, left: -9999px`). Solo se usa para `html2canvas` al exportar PDF o compartir.

- **Preview responsive** (lo que el usuario ve): Renderizar el mismo contenido pero con layout adaptable:
  - Mobile: stats en grid 2x2, pie chart debajo a ancho completo, holdings como lista vertical
  - Desktop: layout similar al actual pero sin restricción de aspect-ratio

```text
MOBILE:
┌─────────────────────┐
│ 📥 Portfolio        │
│ [☀️/🌙] [PDF] [X]  │  ← botones stack o wrap
└─────────────────────┘
┌─────────────────────┐
│ Avatar + Username   │
│ Portfolio • Date    │
└─────────────────────┘
┌──────────┬──────────┐
│ Invested │ Mkt Val  │  2x2 grid
├──────────┼──────────┤
│ Unreal.  │ Realized │
├──────────┼──────────┤
│ Cash     │ Win Rate │
└──────────┴──────────┘
┌─────────────────────┐
│ [Pie Chart grande]  │  ancho completo, 250px height
└─────────────────────┘
┌─────────────────────┐
│ Holdings badges     │
└─────────────────────┘

DESKTOP:
┌────────────────────────────────────┐
│ Header + controles en línea       │
└────────────────────────────────────┘
┌────────────────────────────────────┐
│ Card preview (aspect-ratio, como  │
│ ahora pero visible y scrollable)  │
└────────────────────────────────────┘
```

**3. La card oculta para exportación** usa `min-width: 1200px` y `min-height: 630px` con tamaños de fuente fijos en px (no rem), garantizando que el PNG/PDF siempre se vea bien independientemente del viewport.

### Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/pages/ExportReport.tsx` | Separar preview responsive de card exportable, layout mobile-first |

