# Biblioteca personal — libros, cursos, mentores y negocios

## El problema

Todo el historial de formación y de negocios ya está escrito en el segundo cerebro
(`elamas-second-brain`): 17 libros, 5 cursos, 11 mentores/referentes y 14 negocios, cada uno
en su nota con frontmatter. Pero vive en Obsidian: no hay una vista que diga de un vistazo
"leí 15 libros, tuve 10 mentores, armé 14 negocios y 9 siguen activos", ni se puede actualizar
desde el celular. La app ya es el sistema personal de todos los días (inversiones, finanzas,
viajes); la biblioteca es la parte que faltaba.

## La forma

```
vault (.md + frontmatter) ──parseVaultNote──▶ scripts/library-from-vault.ts ──(login como el usuario, RLS)──▶ pf_library_items ──▶ /biblioteca
                                                                                                                  ▲
                                                                                        alta / edición a mano ────┘
```

## Definiciones que sostienen el diseño

- **La vault es la fuente; la tabla es la vista.** El script es idempotente por
  `(user_id, source_path)`: re-correrlo actualiza, no duplica. Lo cargado a mano
  (`source_path` NULL) no se toca. Una nota borrada de la vault **no** se borra de la tabla:
  es historial.
- **Una tabla con `kind`, no cuatro.** Libro, curso, mentor y negocio comparten el 90% de los
  campos y la pantalla los busca juntos. Lo específico va a `extras` (revenue, platform…).
- **El puntaje se guarda como está.** Notion mezcla escala 1–10 y estrellas; convertir al
  guardar sería inventar un número. Se normaliza a /10 sólo para mostrar (`normalizeScore`,
  estrellas × 2), y lo vacío es `null`, no 0.
- **Una plantilla sin llenar no es un aprendizaje.** `extractSection` descarta bullets vacíos
  ("- Qué apliqué:") y las notas "> Pendiente / Completar": mostrarlas como "lo que me quedó"
  sería afirmar que hay algo ahí.

## Qué entra de la vault

| kind | De dónde | Qué queda afuera |
| --- | --- | --- |
| book | `conocimiento/libros/*` con `type: libro` | `_index`, cuestionarios |
| course | `conocimiento/cursos/*` con `type: curso` | `_index` |
| mentor | `personas/**` con `relationship` mentor* o referente* | familia, pareja, partners, clientes |
| venture | `proyectos/*`, `negocio/*` con `type` proyecto/negocio | `status: idea`, `oferta-escalera`, `*-situacion-*`, `*-llc`, `archivo` |

## Paso por paso

1. **Base** — `supabase/migrations/20260925120000_create_library_items.sql`: tabla, índice
   único parcial `(user_id, source_path)`, RLS de las 4 operaciones con `auth.uid() = user_id`.
   Sin CHECK en `status`: la vault puede sumar estados y el sync no tiene que voltearse.
2. **Lógica pura** — `src/lib/library.ts` (+ test): parser de frontmatter mínimo, clasificación,
   extracción de resumen/aprendizaje, `normalizeScore`, `progressBucket`, `libraryStats`,
   `venturesTimeline`, `matchesQuery`.
3. **Sync** — `scripts/library-from-vault.ts`. Entra con email/clave del usuario y la clave
   pública: las filas pasan por RLS y quedan a su nombre; no usa service key.
   `LIB_EMAIL=.. LIB_PASSWORD=.. npx vite-node scripts/library-from-vault.ts -- ../elamas-second-brain`
4. **Hook** — `src/hooks/useLibrary.tsx` (lista, alta, edición, borrado).
5. **Pantalla** — `/biblioteca` (`ProtectedRoute`), entrada en el menú del avatar junto a
   Viajes. Contadores que son pestañas, filtro por estado, búsqueda sin acentos, timeline de
   negocios, detalle con edición de estado / puntaje / "lo que me quedó".

## Lo que NO entra

- Escribir de vuelta a la vault (la edición en la app se pisa en el próximo sync; la pantalla lo avisa).
- Sync automático (cron): el script se corre a mano, igual que la vault se actualiza a mano.
- Cruce con finanzas (cuánto costó cada curso/mentoría contra `transactions`) — ver ideas abajo.
- i18n: sigue el patrón de Viajes (español directo).

## Ideas para después

- **Costo de formación**: vincular un curso/mentor a sus `transactions` (como `pf_trip_items`)
  → "invertí US$ X en formación este año" y ROI contra ingresos del negocio.
- **Meta de lectura anual** y racha, en el panel de progreso.
- **Libros de inversión ↔ estrategia**: mostrar "El inversor inteligente" en `/strategy`
  junto a las reglas de disciplina que salieron de él.
- **Sync programado** desde la rutina semanal de `repo-sync` de la vault.

## Verificación

- 47 notas importadas en el usuario 409422f9…: book 17, course 5, mentor 11, venture 14.
  Segunda corrida: 0 nuevas, 47 actualizadas (idempotente).
- Lint limpio en los archivos tocados; `tsc` 0 errores; 382/382 tests; build OK.
- Recorrido logueado en 1280×900 y 375×812: datos reales, sin scroll horizontal, CTA
  "Guardar" visible en mobile.
