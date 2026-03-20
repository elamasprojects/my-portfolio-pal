

# Plan: Herramientas Gratuitas de Captación (Calculadoras + Test de Riesgo)

## Contexto

La app actual ("Chess") es un portfolio tracker autenticado. El plan de negocio pide agregar **herramientas públicas gratuitas** (sin login) que atraigan tráfico y redirijan a exchanges via affiliate links. Estas herramientas son independientes del core de la app.

## Alcance técnico (lo que se puede construir en Lovable)

De las 6 implementaciones listadas, **3 son features de producto** y 3 son estrategia de marketing/B2B (UGC, acuerdos CPA, pauta). Solo las primeras 3 se implementan en código:

| Herramienta | Ruta | Auth requerida |
|---|---|---|
| Test de perfil de riesgo | `/tools/risk-profile` | No |
| Calculadora interés compuesto | `/tools/compound` | No |
| Simulador DCA retrospectivo | `/tools/dca` | No |

## Arquitectura

```text
/tools (landing de herramientas)
  ├── /tools/risk-profile   → cuestionario → resultado + CTA afiliado
  ├── /tools/compound       → inputs + gráfico proyección → CTA
  └── /tools/dca            → inputs + gráfico histórico → CTA
```

Todas las rutas son **públicas** (sin `ProtectedRoute`). Comparten un layout minimalista con header/footer (no el sidebar de la app).

## Implementaciones detalladas

### 1. Layout público para herramientas

**Archivo nuevo: `src/components/ToolsLayout.tsx`**
- Header con logo Chess + nav links a las 3 herramientas + botón "Registrarse"
- Footer con link a landing y copyright
- Slot para children

### 2. Landing de herramientas (`/tools`)

**Archivo nuevo: `src/pages/Tools.tsx`**
- Grid con 3 cards: cada herramienta con icono, título, descripción y link
- Hero breve explicando el valor ("Descubrí tu perfil inversor, calculá tus ganancias potenciales")

### 3. Test de perfil de riesgo (`/tools/risk-profile`)

**Archivo nuevo: `src/pages/RiskProfile.tsx`**
- 8-10 preguntas multiple choice (horizonte temporal, tolerancia a pérdidas, ingresos, experiencia, etc.)
- Step wizard con progress bar
- Al finalizar: puntaje → categoría (Conservador / Moderado / Agresivo / Muy Agresivo)
- Resultado: card con perfil + portafolio sugerido (allocations estáticas por categoría, ej: 60% bonds 40% stocks)
- **CTA**: botón "Empezá a invertir" con link de afiliado configurable (hardcoded inicialmente, luego parametrizable)
- Botón secundario "Registrate en Chess para trackear tu portafolio"

### 4. Calculadora de interés compuesto (`/tools/compound`)

**Archivo nuevo: `src/pages/CompoundCalculator.tsx`**
- Inputs: monto inicial, aporte mensual, plazo (años), tasa anual (con presets: S&P 500 ~10%, BTC ~50%, conservador ~5%)
- Gráfico de línea (recharts, ya instalado) mostrando crecimiento año a año
- Tabla resumen: capital invertido vs valor final vs ganancia
- **CTA**: "Invertí en [activo] ahora" con link de afiliado

### 5. Simulador DCA retrospectivo (`/tools/dca`)

**Archivo nuevo: `src/pages/DCASimulator.tsx`**
- Inputs: activo (BTC preseleccionado), monto periódico, frecuencia (diario/semanal/mensual), fecha inicio, fecha fin
- Datos: usar la API de CoinGecko `/coins/{id}/market_chart/range` (gratis, no necesita key) para precios históricos de BTC
- Edge function nueva `supabase/functions/dca-history/index.ts` que recibe `{coinId, from, to}` y devuelve precios históricos
- Cálculo client-side: iterar fechas, acumular unidades compradas a precio de cada período
- Gráfico: línea de capital invertido vs valor de mercado a lo largo del tiempo
- Resultado: total invertido, valor actual, rendimiento %
- **CTA**: "Empezá tu DCA hoy" con link de afiliado

### 6. Sistema de affiliate links

**Archivo nuevo: `src/config/affiliates.ts`**
- Objeto con links de afiliados por plataforma: `{ bingx: "https://...", cocos: "https://..." }`
- UTM params automáticos por herramienta (`?utm_source=chess&utm_medium=tool&utm_campaign=risk-profile`)
- Componente `<AffiliateButton>` reutilizable que trackea clicks (analytics event)

### 7. Routing

**Cambios en `src/App.tsx`**:
- Importar las 4 páginas nuevas + ToolsLayout
- Agregar rutas públicas:
  - `/tools` → Tools
  - `/tools/risk-profile` → RiskProfile
  - `/tools/compound` → CompoundCalculator  
  - `/tools/dca` → DCASimulator

### 8. Traducciones

**Cambios en `src/i18n/es.ts` y `src/i18n/en.ts`**:
- Agregar ~60 keys para las 3 herramientas (títulos, descripciones, labels de inputs, textos de resultados, CTAs)

## Archivos nuevos

| Archivo | Propósito |
|---|---|
| `src/components/ToolsLayout.tsx` | Layout público sin sidebar |
| `src/pages/Tools.tsx` | Landing de herramientas |
| `src/pages/RiskProfile.tsx` | Test de perfil de riesgo |
| `src/pages/CompoundCalculator.tsx` | Calculadora interés compuesto |
| `src/pages/DCASimulator.tsx` | Simulador DCA retrospectivo |
| `src/config/affiliates.ts` | Config de affiliate links |
| `supabase/functions/dca-history/index.ts` | Proxy CoinGecko para precios históricos |

## Archivos modificados

| Archivo | Cambio |
|---|---|
| `src/App.tsx` | 4 rutas públicas nuevas |
| `src/i18n/en.ts` | ~60 translation keys |
| `src/i18n/es.ts` | ~60 translation keys |
| `src/pages/Landing.tsx` | Agregar sección/link a `/tools` |
| `supabase/config.toml` | Config para `dca-history` function |

## Lo que NO se implementa (estrategia de marketing)

- UGC / avatares de IA → no es código, es operación de marketing
- Acuerdos B2B / CPA → negociación comercial, no feature
- Pauta publicitaria → se ejecuta en plataformas de ads externas

Estos ítems se resuelven una vez que las herramientas estén live y generando tráfico.

