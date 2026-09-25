/**
 * Carga (o re-sincroniza) la biblioteca personal desde el segundo cerebro.
 *
 *   LIB_EMAIL=... LIB_PASSWORD=... npx vite-node scripts/library-from-vault.ts -- ../elamas-second-brain
 *
 * Entra como el usuario, con la clave pública del `.env`: las filas pasan por la RLS de
 * `pf_library_items` igual que si las cargara la app, y quedan a nombre de quien se loguea.
 * No hace falta — ni se usa — el service key.
 *
 * Es idempotente: la clave es `source_path` (la ruta de la nota). Una nota ya cargada se
 * actualiza, una nueva se inserta, y lo cargado a mano desde la app (source_path NULL) no se
 * toca. Una nota borrada de la vault NO se borra acá: la biblioteca es historial, y perder
 * un libro porque se reorganizó una carpeta sería peor que tener uno de más.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseVaultNote, type LibraryItemInput } from "../src/lib/library";

const vault = process.argv.slice(2).filter((a) => a !== "--")[0];
const { LIB_EMAIL, LIB_PASSWORD } = process.env;
if (!vault || !LIB_EMAIL || !LIB_PASSWORD) {
  console.error("uso: LIB_EMAIL=.. LIB_PASSWORD=.. library-from-vault.ts -- <ruta-a-la-vault>");
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);

const DIRS = ["conocimiento/libros", "conocimiento/cursos", "personas", "proyectos", "negocio"];

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "referentes" ? walk(full) : [];
    return name.endsWith(".md") ? [full] : [];
  });
}

const rows: LibraryItemInput[] = DIRS.flatMap((d) => walk(join(vault, d)))
  .map((file) => parseVaultNote(relative(vault, file).split("\\").join("/"), readFileSync(file, "utf8")))
  .filter((r): r is LibraryItemInput => r !== null);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
  email: LIB_EMAIL,
  password: LIB_PASSWORD,
});
if (authError || !auth.user) throw authError ?? new Error("login fallido");
const userId = auth.user.id;

// El índice único es parcial (source_path not null) y PostgREST no puede apuntarle un
// `onConflict`; por eso se resuelve a mano: primero qué rutas ya existen.
const { data: existing, error: readError } = await supabase
  .from("pf_library_items")
  .select("id, source_path")
  .eq("user_id", userId)
  .not("source_path", "is", null);
if (readError) throw readError;
const idByPath = new Map((existing ?? []).map((r) => [r.source_path as string, r.id as string]));

let inserted = 0;
let updated = 0;
let failed = 0;
for (const row of rows) {
  const id = idByPath.get(row.source_path as string);
  const { error } = id
    ? await supabase
        .from("pf_library_items")
        .update({ ...row, updated_at: new Date().toISOString() })
        .eq("id", id)
    : await supabase.from("pf_library_items").insert({ ...row, user_id: userId });
  if (error) {
    failed += 1;
    console.error(`✗ ${row.source_path}: ${error.message}`);
  } else if (id) updated += 1;
  else inserted += 1;
}

console.log(`${rows.length} notas → ${inserted} nuevas, ${updated} actualizadas, ${failed} con error`);
process.exit(failed > 0 ? 1 : 0);
