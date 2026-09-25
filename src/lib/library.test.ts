import { describe, it, expect } from "vitest";
import {
  parseVaultNote,
  normalizeScore,
  progressBucket,
  libraryStats,
  venturesTimeline,
  matchesQuery,
  extractSection,
  type LibraryItem,
} from "./library";

const book = `---
title: El inversor inteligente
type: libro
status: leído
tags: [libro, finanzas]
author: Benjamin Graham
area: Finanzas (Chess Investing)
category: [Investing, Finance]
score: ⭐️⭐️⭐️⭐️⭐️
format: libro
read_start: 2023-07-14
read_end: 2024-05-10
---

# El inversor inteligente

**De qué va:** La biblia del [[value-investing|value investing]].

## 🔑 Aprendizaje años después

Margen de seguridad siempre.

## Otra cosa
nada
`;

const item = (over: Partial<LibraryItem>): LibraryItem => ({
  id: "x", user_id: "u", kind: "book", title: "T", subtitle: null, status: null, area: null,
  categories: [], score_label: null, format: null, started_on: null, ended_on: null,
  summary: null, key_learning: null, outcome: null, url: null, content_potential: null,
  extras: {}, source_path: null, ...over,
});

describe("parseVaultNote", () => {
  it("convierte un libro de la vault en una fila con autor, fechas y aprendizaje", () => {
    const row = parseVaultNote("conocimiento/libros/el-inversor-inteligente.md", book)!;
    expect(row.kind).toBe("book");
    expect(row.subtitle).toBe("Benjamin Graham");
    expect(row.categories).toEqual(["Investing", "Finance"]);
    expect(row.started_on).toBe("2023-07-14");
    expect(row.summary).toBe("La biblia del value investing.");
    expect(row.key_learning).toBe("Margen de seguridad siempre.");
    // La ruta es la clave del upsert: sin ella cada re-sync duplica la biblioteca.
    expect(row.source_path).toBe("conocimiento/libros/el-inversor-inteligente.md");
  });

  it("deja afuera índices, cuestionarios y personas que no son mentores", () => {
    expect(parseVaultNote("conocimiento/libros/_index.md", book)).toBeNull();
    const familia = `---\ntitle: Laura\ntype: persona\nrelationship: familia\n---\n# Laura`;
    expect(parseVaultNote("personas/laura.md", familia)).toBeNull();
    const mentor = `---\ntitle: Claudio\ntype: persona\nrole: "Mentor IA"\nrelationship: mentor\n---\n# C`;
    expect(parseVaultNote("personas/claudio.md", mentor)?.kind).toBe("mentor");
  });

  it("una idea de oferta no es un negocio creado", () => {
    const idea = `---\ntitle: Oferta\ntype: negocio\nstatus: idea\n---\n# O`;
    expect(parseVaultNote("negocio/oferta-escalera.md", idea)).toBeNull();
  });
});

describe("extractSection", () => {
  // Una plantilla sin llenar mostrada como "aprendizaje" sería afirmar que hay algo ahí.
  it("descarta bullets vacíos y notas de 'completar'", () => {
    const body = `## 🔑 Qué aprendí de él\n> Completar vía [[cuestionario]].\n- En ventas:\n- **Qué apliqué:**\n`;
    expect(extractSection(body, /🔑/)).toBeNull();
  });
});

describe("hallazgos del code review", () => {
  it("'en-progreso' (como lo escribe la vault) cuenta como en curso", () => {
    expect(progressBucket({ kind: "course", status: "en-progreso" })).toBe("in_progress");
  });

  it("un separador o un bullet con sólo una pista entre paréntesis no es aprendizaje", () => {
    expect(extractSection("## 🔑 X\n\n---\n", /🔑/)).toBeNull();
    expect(extractSection("## 🔑 X\n- Score real hoy: (en Notion figura 4)\n", /🔑/)).toBeNull();
  });

  // agencia-ia.md es alias de advantx.md: importarlas a las dos duplica el negocio.
  it("una nota marcada alias no entra como negocio", () => {
    const alias = `---\ntitle: Agencia de IA\ntype: proyecto\nstatus: archivado\ntags: [proyecto, alias]\n---\n# A`;
    expect(parseVaultNote("proyectos/agencia-ia.md", alias)).toBeNull();
  });
});

describe("normalizeScore", () => {
  it("lleva estrellas y números a /10, y lo vacío queda null (no 0)", () => {
    expect(normalizeScore("⭐️⭐️⭐️⭐️")).toBe(8);
    expect(normalizeScore("6")).toBe(6);
    expect(normalizeScore("")).toBeNull();
    expect(normalizeScore("n/a")).toBeNull();
  });
});

describe("stats y timeline", () => {
  it("cuenta hechos, en curso y pendientes por tipo", () => {
    const s = libraryStats([
      item({ status: "leído", score_label: "6" }),
      item({ status: "pendiente" }),
      item({ status: "leyendo" }),
      item({ kind: "venture", status: "activo" }),
      item({ kind: "venture", status: "archivado" }),
    ]);
    expect(s.byKind.book).toEqual({ total: 3, done: 1, inProgress: 1, pending: 1 });
    expect(s.activeVentures).toBe(1);
    expect(s.averageBookScore).toBe(6);
  });

  it("un mentor futuro (status idea) no cuenta como hecho", () => {
    expect(progressBucket({ kind: "mentor", status: "idea" })).toBe("pending");
  });

  it("ordena negocios del más reciente al más viejo, sin fecha al final", () => {
    const t = venturesTimeline([
      item({ kind: "venture", title: "viejo", started_on: "2024-03 (aprox)" }),
      item({ kind: "venture", title: "sin fecha" }),
      item({ kind: "venture", title: "nuevo", started_on: "2026-06" }),
    ]);
    expect(t.map((i) => i.title)).toEqual(["nuevo", "viejo", "sin fecha"]);
  });

  it("busca sin acentos", () => {
    expect(matchesQuery(item({ title: "Cómo ganar amigos" }), "como")).toBe(true);
  });
});
