/**
 * La biblioteca personal: libros, cursos, mentores y negocios creados.
 *
 * Dos mitades, las dos puras para que se puedan probar:
 *
 *   1. `parseVaultNote` convierte una nota del segundo cerebro (Markdown + frontmatter) en una
 *      fila de `pf_library_items`. La usa `scripts/library-from-vault.ts`.
 *   2. Las reglas de pantalla: qué estado cuenta como "hecho", cómo se lee un puntaje escrito
 *      en dos escalas distintas, cómo se ordena la historia de negocios.
 */

export type LibraryKind = "book" | "course" | "mentor" | "venture";

export const LIBRARY_KINDS: LibraryKind[] = ["book", "course", "mentor", "venture"];

export interface LibraryItem {
  id: string;
  user_id: string;
  kind: LibraryKind;
  title: string;
  subtitle: string | null;
  status: string | null;
  area: string | null;
  categories: string[];
  score_label: string | null;
  format: string | null;
  started_on: string | null;
  ended_on: string | null;
  summary: string | null;
  key_learning: string | null;
  outcome: string | null;
  url: string | null;
  content_potential: string | null;
  extras: Record<string, unknown>;
  source_path: string | null;
  created_at?: string;
  updated_at?: string;
}

export type LibraryItemInput = Omit<LibraryItem, "id" | "user_id" | "created_at" | "updated_at">;

// ─── Parser de la vault ───────────────────────────────────────────────────────────────────

type Frontmatter = Record<string, string | string[]>;

/** Quita comillas envolventes y espacios. */
function clean(v: string): string {
  return v.trim().replace(/^["']|["']$/g, "").trim();
}

/**
 * YAML mínimo: el frontmatter de la vault sólo usa `clave: valor` y `clave: [a, b]`. Traer
 * una librería de YAML por esto sumaría una dependencia al bundle para leer cinco formas.
 */
export function parseFrontmatter(md: string): { data: Frontmatter; body: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: md };
  const data: Frontmatter = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-z_]+):\s*(.*)$/i);
    if (!kv) continue;
    const [, key, raw] = kv;
    const value = raw.trim();
    if (value.startsWith("[") && value.endsWith("]")) {
      data[key] = value
        .slice(1, -1)
        .split(",")
        .map(clean)
        .filter(Boolean);
    } else {
      data[key] = clean(value);
    }
  }
  return { data, body: m[2] };
}

/** `[[slug|Texto]]` → `Texto`, `[[slug]]` → `slug`, y fuera negritas. */
export function stripWikilinks(text: string): string {
  return text
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, (_, s: string) => s.replace(/-/g, " "))
    .replace(/\*\*/g, "")
    .trim();
}

/**
 * El cuerpo de la primera sección cuyo título matchea. Se corta en el próximo `## `.
 * Las líneas que son sólo un bullet vacío ("- En ventas:") o una nota de "completar" se
 * descartan: son plantillas sin llenar, y mostrarlas como aprendizaje sería mentir que hay
 * algo ahí.
 */
export function extractSection(body: string, heading: RegExp): string | null {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => /^##\s/.test(l) && heading.test(l));
  if (start === -1) return null;
  const out: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^##\s/.test(line)) break;
    if (/^\s*-\s*[^:]{0,60}:\s*$/.test(line.replace(/\*\*/g, ""))) continue;
    if (/complet|pendiente/i.test(line) && /^\s*>/.test(line)) continue;
    out.push(line);
  }
  const text = stripWikilinks(out.join("\n")).trim();
  return text.length > 0 ? text : null;
}

/** El "De qué va:" / "Qué es:" de la nota, o el primer párrafo después del título. */
export function extractSummary(body: string): string | null {
  const lead = body.match(/\*\*(De qué va|Qué es|Qué fue):\*\*\s*(.+)/i);
  if (lead) return stripWikilinks(lead[2]);
  const paragraphs = body
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith("#") && !p.startsWith(">") && !p.startsWith("|"));
  return paragraphs[0] ? stripWikilinks(paragraphs[0]) : null;
}

const str = (v: string | string[] | undefined): string | null => {
  if (v === undefined) return null;
  const s = Array.isArray(v) ? v.join(", ") : v;
  return s.trim() === "" ? null : s.trim();
};
const arr = (v: string | string[] | undefined): string[] =>
  v === undefined ? [] : Array.isArray(v) ? v : v ? [v] : [];

/**
 * Qué nota de la vault entra a qué `kind`. Devuelve null para lo que no es parte del
 * historial (índices, cuestionarios, familia, clientes, research).
 */
export function classifyNote(path: string, data: Frontmatter): LibraryKind | null {
  const file = path.split("/").pop() ?? "";
  if (file.startsWith("_") || /cuestionario/.test(file)) return null;
  const type = str(data.type);
  if (path.startsWith("conocimiento/libros/") && type === "libro") return "book";
  if (path.startsWith("conocimiento/cursos/") && type === "curso") return "course";
  if (path.startsWith("personas/")) {
    const rel = (str(data.relationship) ?? "").toLowerCase();
    // Los referentes entran: son mentoría a distancia (Hormozi, Munger). Familia, pareja,
    // partners y clientes no: son personas de la vida, no de la formación.
    if (rel.startsWith("mentor") || rel.startsWith("referente")) return "mentor";
    return null;
  }
  if (path.startsWith("proyectos/") || path.startsWith("negocio/")) {
    if (type !== "proyecto" && type !== "negocio") return null;
    // Una idea de oferta o una foto de situación no es un negocio creado.
    if (str(data.status) === "idea" || /situacion|oferta-escalera|-llc$/.test(file.replace(/\.md$/, ""))) {
      return null;
    }
    if (file === "archivo.md") return null;
    return "venture";
  }
  return null;
}

const LEARNING_HEADING = /🔑|aprendizaje|aprendí|lecci/i;

export function parseVaultNote(path: string, md: string): LibraryItemInput | null {
  const { data, body } = parseFrontmatter(md);
  const kind = classifyNote(path, data);
  if (!kind) return null;
  const title = str(data.title);
  if (!title) return null;

  const rawSubtitle =
    kind === "book"
      ? str(data.author)
      : kind === "course"
        ? str(data.instructor)
        : str(data.role);
  const subtitle = rawSubtitle ? stripWikilinks(rawSubtitle) : null;

  const extras: Record<string, unknown> = {};
  for (const key of ["platform", "relationship", "revenue", "stack", "company", "since"]) {
    const v = str(data[key]);
    if (v) extras[key] = v;
  }
  const aliases = arr(data.aliases);
  if (aliases.length) extras.aliases = aliases;

  return {
    kind,
    title,
    subtitle,
    status: str(data.status),
    area: str(data.area) ?? str(data.domain),
    categories: arr(data.category),
    score_label: str(data.score),
    format: str(data.format),
    started_on: str(data.read_start) ?? str(data.started) ?? str(data.date) ?? str(data.since),
    ended_on: str(data.read_end) ?? str(data.ended),
    summary: extractSummary(body),
    key_learning: extractSection(body, LEARNING_HEADING),
    outcome: str(data.outcome),
    url: str(data.url),
    content_potential: str(data.content_potential),
    extras,
    source_path: path,
  };
}

// ─── Reglas de pantalla ───────────────────────────────────────────────────────────────────

/**
 * El puntaje vive en dos escalas en Notion: un número (1–10) y estrellas (1–5). Para
 * comparar se lleva todo a /10; estrellas × 2. Lo que no es ninguna de las dos → null, no 0:
 * "sin puntaje" y "le puse cero" son cosas distintas.
 */
export function normalizeScore(label: string | null): number | null {
  if (!label) return null;
  const stars = (label.match(/⭐/g) ?? []).length;
  if (stars > 0) return Math.min(stars * 2, 10);
  const n = Number(label.replace(",", "."));
  if (Number.isFinite(n) && n > 0 && n <= 10) return n;
  return null;
}

/** Estados que cuentan como "lo hice / lo tuve". */
const DONE = new Set(["leído", "leido", "terminado", "completado", "archivado", "activo", "publicado"]);
const IN_PROGRESS = new Set(["leyendo", "en curso", "cursando"]);

export type ProgressBucket = "done" | "in_progress" | "pending";

export function progressBucket(item: Pick<LibraryItem, "kind" | "status">): ProgressBucket {
  const s = (item.status ?? "").toLowerCase();
  if (IN_PROGRESS.has(s)) return "in_progress";
  // Un mentor "futuro" o un negocio "idea" todavía no pasó.
  if (s === "pendiente" || s === "idea") return "pending";
  if (DONE.has(s) || s === "pausado") return "done";
  return "pending";
}

export interface LibraryStats {
  total: number;
  byKind: Record<LibraryKind, { total: number; done: number; inProgress: number; pending: number }>;
  activeVentures: number;
  averageBookScore: number | null;
}

export function libraryStats(items: LibraryItem[]): LibraryStats {
  const byKind = Object.fromEntries(
    LIBRARY_KINDS.map((k) => [k, { total: 0, done: 0, inProgress: 0, pending: 0 }])
  ) as LibraryStats["byKind"];
  const bookScores: number[] = [];
  let activeVentures = 0;

  for (const item of items) {
    const bucket = byKind[item.kind];
    if (!bucket) continue;
    bucket.total += 1;
    const p = progressBucket(item);
    if (p === "done") bucket.done += 1;
    else if (p === "in_progress") bucket.inProgress += 1;
    else bucket.pending += 1;
    if (item.kind === "venture" && item.status === "activo") activeVentures += 1;
    if (item.kind === "book") {
      const s = normalizeScore(item.score_label);
      if (s !== null) bookScores.push(s);
    }
  }

  return {
    total: items.length,
    byKind,
    activeVentures,
    averageBookScore: bookScores.length
      ? Math.round((bookScores.reduce((a, b) => a + b, 0) / bookScores.length) * 10) / 10
      : null,
  };
}

/** "2024-03 (aprox)" → "2024-03"; lo que no tenga año queda al final. */
export function sortKeyFromDate(value: string | null): string {
  const m = value?.match(/(\d{4})(?:-(\d{2}))?/);
  return m ? `${m[1]}-${m[2] ?? "00"}` : "0000-00";
}

/** La historia de negocios, del más reciente al más viejo. Sin fecha va al final. */
export function venturesTimeline(items: LibraryItem[]): LibraryItem[] {
  return items
    .filter((i) => i.kind === "venture")
    .sort((a, b) => sortKeyFromDate(b.started_on).localeCompare(sortKeyFromDate(a.started_on)));
}

/** Búsqueda sin acentos sobre título, subtítulo, área, categorías y aprendizaje. */
export function matchesQuery(item: LibraryItem, query: string): boolean {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = norm(query.trim());
  if (!q) return true;
  const hay = [item.title, item.subtitle, item.area, item.key_learning, item.summary, ...item.categories]
    .filter(Boolean)
    .join(" ");
  return norm(hay).includes(q);
}
