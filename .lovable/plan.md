
# Plan: Auto-análisis de 1 imagen + Fix precio OCR en ventas

## Parte 1 — Auto-análisis al subir 1 sola imagen

### Comportamiento actual
En `src/pages/AddTrade.tsx`, al soltar/seleccionar imágenes:
- `handleFileChange` y `handleDrop` agregan los archivos a `stagedFiles`.
- El usuario debe pulsar **"Analizar Todo"** para disparar el análisis (incluso con 1 sola imagen).

### Cambio propuesto
Modificar `handleFileChange` y `handleDrop` para que, si:
- El usuario seleccionó/soltó exactamente **1 imagen**, **Y**
- No hay imágenes previas en `stagedFiles`, **Y**
- No hay un análisis en curso (`!analyzingImage`)

→ se llame directamente a `handleImageUpload(file)` sin pasar por staging.

Si hay múltiples imágenes, o ya había alguna en staging, se mantiene el flujo actual con el botón "Analizar Todo" (para permitir agregar más antes de procesar).

### Archivos
- `src/pages/AddTrade.tsx` — modificar `handleFileChange` y `handleDrop` (~líneas 325-338).

---

## Parte 2 — Fix del precio leído como 449.77 en lugar de 500

### Diagnóstico
El screenshot muestra `500 USD` como precio unitario, pero el modelo de visión (Gemini 2.5 Flash, en `supabase/functions/analyze-trade-image/index.ts`) devuelve `449.77`. Causas probables:

1. **Confusión entre "precio unitario" y "monto neto recibido"**: en pantallas de venta de brokers argentinos suele aparecer el precio bruto (500), comisiones, y el neto acreditado (~449.77). El modelo agarra el número equivocado.
2. **Prompt poco específico** sobre qué número priorizar como `price_per_unit`.
3. **No hay validación cruzada**: si el screenshot muestra `quantity × price = total`, el modelo no chequea consistencia.

### Cambios propuestos

**A) Mejorar el prompt de extracción** (`supabase/functions/analyze-trade-image/index.ts`):
- Agregar instrucción explícita: el `price_per_unit` debe ser el **precio bruto por unidad antes de comisiones/impuestos**, NO el neto acreditado/debitado.
- Pedir que prefiera el número etiquetado como "Precio", "Price", "Cotización", "Limit price" sobre "Neto", "Net", "Total a recibir", "Importe acreditado".
- Pedir que valide internamente: `quantity × price_per_unit ≈ subtotal/total bruto`. Si no cuadra, reconsiderar qué número es el precio.

**B) Agregar campos opcionales al schema** para mejorar robustez:
- `gross_amount` (subtotal bruto = qty × price antes de comisiones), opcional.
- `net_amount` (monto neto post-comisiones), opcional.
- Esto le da al modelo "lugares" donde poner los otros números, evitando que confunda neto con precio.

**C) Validación client-side en `populateFormFromData`** (`src/pages/AddTrade.tsx`):
- Si `gross_amount` viene del OCR y `quantity × price_per_unit` difiere >5% de `gross_amount`, recalcular `price = gross_amount / quantity` y registrar warning en consola.
- Mantener `price_per_unit` como fuente principal cuando coincida con el subtotal.

**D) Subir el modelo (opcional)**: considerar `google/gemini-2.5-pro` solo para la función de extracción (más caro pero más preciso con números). Lo dejo como opción a confirmar — por defecto seguimos con `2.5-flash` y mejoramos solo el prompt + schema.

### Archivos
- `supabase/functions/analyze-trade-image/index.ts` — actualizar system prompt, descripción del campo `price_per_unit`, agregar `gross_amount` y `net_amount` opcionales al schema.
- `src/pages/AddTrade.tsx` — en `populateFormFromData`, validar coherencia entre `quantity`, `price_per_unit` y `gross_amount` cuando esté disponible.

---

## Resumen de archivos modificados

| # | Archivo | Cambio |
|---|---------|--------|
| 1 | `src/pages/AddTrade.tsx` | Auto-análisis cuando se carga 1 sola imagen + validación de coherencia precio×qty=total |
| 2 | `supabase/functions/analyze-trade-image/index.ts` | Prompt más estricto sobre precio bruto vs neto + nuevos campos opcionales en el schema |

## Pregunta abierta
¿Querés que también probemos subir el modelo de visión a `gemini-2.5-pro` solo para esta función, o preferís quedarte con `flash` y solo ajustar prompt+schema? (Pro es ~5-10× más caro por imagen pero suele ser más preciso con números pequeños y layouts densos.)
