import { useEffect, useMemo, useState } from "react";
import { Plus, BookOpen, GraduationCap, Users, Rocket, Search, Trash2, Library } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useLibrary } from "@/hooks/useLibrary";
import {
  libraryStats,
  matchesQuery,
  normalizeScore,
  progressBucket,
  venturesTimeline,
  type LibraryItem,
  type LibraryKind,
  type ProgressBucket,
} from "@/lib/library";

/**
 * Biblioteca personal: lo que leí, cursé, de quién aprendí y qué negocios armé.
 *
 * Los datos vienen del segundo cerebro (`scripts/library-from-vault.ts`) y se pueden sumar o
 * corregir a mano acá. La vault sigue siendo donde se escribe en profundidad; esta pantalla
 * es para ver el historial entero de un vistazo, junto al resto de la vida financiera.
 */

const KIND_META: Record<LibraryKind, { label: string; singular: string; icon: typeof BookOpen; subtitleLabel: string }> = {
  book: { label: "Libros", singular: "Libro", icon: BookOpen, subtitleLabel: "Autor" },
  course: { label: "Cursos", singular: "Curso", icon: GraduationCap, subtitleLabel: "Instructor" },
  mentor: { label: "Mentores", singular: "Mentor", icon: Users, subtitleLabel: "Rol" },
  venture: { label: "Negocios", singular: "Negocio", icon: Rocket, subtitleLabel: "Mi rol" },
};

const STATUS_OPTIONS: Record<LibraryKind, string[]> = {
  book: ["leído", "leyendo", "pendiente"],
  course: ["leído", "leyendo", "pendiente"],
  mentor: ["activo", "archivado", "idea"],
  venture: ["activo", "pausado", "archivado", "idea"],
};

const BUCKET_LABEL: Record<ProgressBucket | "all", string> = {
  all: "Todos",
  done: "Hechos",
  in_progress: "En curso",
  pending: "Pendientes",
};

function StatusPill({ status }: { status: string | null }) {
  if (!status) return null;
  const tone =
    status === "activo" || status === "leyendo"
      ? "bg-primary/15 text-primary"
      : status === "pendiente" || status === "idea"
        ? "bg-muted text-muted-foreground"
        : "bg-secondary text-secondary-foreground";
  return <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", tone)}>{status}</span>;
}

function ScoreBadge({ label }: { label: string | null }) {
  const score = normalizeScore(label);
  if (score === null) return null;
  return (
    <span className="font-mono text-[11px] tabular-nums text-muted-foreground" title={`En la vault: ${label}`}>
      {score}/10
    </span>
  );
}

export default function Biblioteca() {
  const { items, isLoading, isError, addItem, updateItem, deleteItem } = useLibrary();
  const [kind, setKind] = useState<LibraryKind>("book");
  const [bucket, setBucket] = useState<ProgressBucket | "all">("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const stats = useMemo(() => libraryStats(items), [items]);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  const visible = useMemo(() => {
    const ofKind = kind === "venture" ? venturesTimeline(items) : items.filter((i) => i.kind === kind);
    return ofKind.filter(
      (i) => (bucket === "all" || progressBucket(i) === bucket) && matchesQuery(i, query)
    );
  }, [items, kind, bucket, query]);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-serif text-2xl font-bold tracking-tight text-foreground">Biblioteca</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            Lo que leí, cursé, de quién aprendí y lo que construí.
          </p>
        </div>
        <Button size="sm" onClick={() => setAdding(true)} className="shrink-0 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" /> Nuevo
        </Button>
      </div>

      {/* Los cuatro contadores son también las pestañas: tocar uno cambia de sección. */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(KIND_META) as LibraryKind[]).map((k) => {
          const meta = KIND_META[k];
          const s = stats.byKind[k];
          const Icon = meta.icon;
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k);
                setBucket("all");
              }}
              className={cn(
                "min-h-[44px] rounded-xl border bg-card p-3 text-left transition-colors",
                kind === k ? "border-primary/60 bg-primary/5" : "border-border/60 hover:bg-muted/30"
              )}
            >
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Icon className="h-3.5 w-3.5" /> {meta.label}
              </span>
              <span className="mt-1 block font-mono text-xl font-semibold tabular-nums text-foreground">
                {isLoading ? "—" : k === "venture" ? s.total : s.done}
              </span>
              <span className="block text-[10px] text-muted-foreground">
                {k === "venture"
                  ? `${stats.activeVentures} activos`
                  : k === "mentor"
                    ? `${s.pending} a futuro`
                    : `${s.inProgress} en curso · ${s.pending} pendientes`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Buscar en ${KIND_META[kind].label.toLowerCase()}…`}
            className="h-9 pl-8 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(BUCKET_LABEL) as (ProgressBucket | "all")[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(b)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] transition-colors",
                bucket === b ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              )}
            >
              {BUCKET_LABEL[b]}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2.5">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      ) : isError ? (
        <Card className="border border-border/70 bg-card">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No pudimos traer tu biblioteca. Probá de nuevo en unos segundos.
            </p>
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card className="border border-border/70 bg-card">
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Library className="h-7 w-7 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Tu biblioteca está vacía.</p>
            <p className="max-w-xs text-xs text-muted-foreground">
              Cargá tu primer libro con «Nuevo», o importá todo desde el segundo cerebro con
              <code className="mx-1 font-mono">scripts/library-from-vault.ts</code>.
            </p>
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <p className="py-8 text-center text-xs text-muted-foreground">
          Nada en {KIND_META[kind].label.toLowerCase()} con ese filtro.
        </p>
      ) : kind === "venture" ? (
        <ol className="relative space-y-3 border-l border-border/60 pl-4">
          {visible.map((item) => (
            <li key={item.id} className="relative">
              <span
                className={cn(
                  "absolute -left-[21px] top-4 h-2.5 w-2.5 rounded-full",
                  item.status === "activo" ? "bg-primary" : "bg-muted-foreground/40"
                )}
              />
              <ItemRow item={item} onOpen={() => setSelectedId(item.id)} showDate />
            </li>
          ))}
        </ol>
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => (
            <li key={item.id}>
              <ItemRow item={item} onOpen={() => setSelectedId(item.id)} />
            </li>
          ))}
        </ul>
      )}

      <DetailDialog
        item={selected}
        onClose={() => setSelectedId(null)}
        onSave={async (patch) => {
          if (!selected) return;
          try {
            await updateItem.mutateAsync({ id: selected.id, ...patch });
          } catch {
            // El toast de error ya lo muestra el hook; el diálogo queda abierto para reintentar.
          }
        }}
        onDelete={async () => {
          if (!selected) return;
          try {
            await deleteItem.mutateAsync(selected.id);
            setSelectedId(null);
          } catch {
            // idem: el hook avisa.
          }
        }}
        saving={updateItem.isPending}
      />

      <AddDialog
        open={adding}
        defaultKind={kind}
        onClose={() => setAdding(false)}
        saving={addItem.isPending}
        onSave={async (input) => {
          try {
            await addItem.mutateAsync(input);
            setAdding(false);
            setKind(input.kind);
          } catch {
            // el hook avisa
          }
        }}
      />
    </div>
  );
}

function ItemRow({ item, onOpen, showDate }: { item: LibraryItem; onOpen: () => void; showDate?: boolean }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-3 rounded-xl border border-border/60 bg-card p-3 text-left transition-colors hover:border-primary/50 hover:bg-muted/30"
    >
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{item.title}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {[showDate ? item.started_on : null, item.subtitle, showDate ? item.outcome : item.area]
            .filter(Boolean)
            .join(" · ") || "—"}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <StatusPill status={item.status} />
        <ScoreBadge label={item.score_label} />
      </span>
    </button>
  );
}

function DetailDialog({
  item,
  onClose,
  onSave,
  onDelete,
  saving,
}: {
  item: LibraryItem | null;
  onClose: () => void;
  onSave: (patch: { status: string | null; key_learning: string | null; score_label: string | null }) => Promise<void>;
  onDelete: () => Promise<void>;
  saving: boolean;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [learning, setLearning] = useState("");
  const [score, setScore] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Se resetea cuando cambia QUÉ ítem está abierto, no cada vez que se refresca la lista
  // (si escuchara al objeto, un refetch en el medio borraría lo que se está escribiendo).
  const itemId = item?.id;
  useEffect(() => {
    if (!item) return;
    setStatus(item.status);
    setLearning(item.key_learning ?? "");
    setScore(item.score_label ?? "");
    setConfirmDelete(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  if (!item) return null;
  const meta = KIND_META[item.kind];
  const dirty =
    status !== item.status || learning !== (item.key_learning ?? "") || score !== (item.score_label ?? "");

  return (
    <Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[75dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border border-border/60 bg-card">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg text-primary">{item.title}</DialogTitle>
          <DialogDescription className="text-xs">
            {[meta.singular, item.subtitle, item.area].filter(Boolean).join(" · ")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1 text-sm">
          {item.summary && <p className="text-muted-foreground">{item.summary}</p>}

          <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            {item.started_on && (
              <div>
                <dt className="text-muted-foreground">Desde</dt>
                <dd className="font-mono">{item.started_on}</dd>
              </div>
            )}
            {item.ended_on && (
              <div>
                <dt className="text-muted-foreground">Hasta</dt>
                <dd className="font-mono">{item.ended_on}</dd>
              </div>
            )}
            {item.format && (
              <div>
                <dt className="text-muted-foreground">Formato</dt>
                <dd>{item.format}</dd>
              </div>
            )}
            {item.categories.length > 0 && (
              <div>
                <dt className="text-muted-foreground">Categorías</dt>
                <dd>{item.categories.join(", ")}</dd>
              </div>
            )}
            {typeof item.extras?.revenue === "string" && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Facturación</dt>
                <dd>{item.extras.revenue}</dd>
              </div>
            )}
            {item.outcome && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Resultado</dt>
                <dd>{item.outcome}</dd>
              </div>
            )}
            {item.url && (
              <div className="col-span-2">
                <dt className="text-muted-foreground">Link</dt>
                <dd className="truncate">{item.url}</dd>
              </div>
            )}
          </dl>

          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS[item.kind].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatus(s)}
                  className={cn(
                    "min-h-[32px] rounded-full px-3 text-xs transition-colors",
                    status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {(item.kind === "book" || item.kind === "course") && (
            <div className="space-y-1.5">
              <Label htmlFor="lib-score" className="text-xs">
                Puntaje <span className="text-muted-foreground">(1–10 o ⭐)</span>
              </Label>
              <Input id="lib-score" value={score} onChange={(e) => setScore(e.target.value)} className="h-9 w-28 text-sm" />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="lib-learning" className="text-xs">
              {item.kind === "venture" ? "Qué aprendí" : "🔑 Lo que me quedó"}
            </Label>
            <Textarea
              id="lib-learning"
              value={learning}
              onChange={(e) => setLearning(e.target.value)}
              placeholder="Todavía no lo escribiste. Una o dos frases: qué aplicaste de verdad."
              className="min-h-[110px] text-sm"
            />
          </div>

          {item.source_path && (
            <p className="text-[10px] text-muted-foreground">
              Viene de la vault: <code className="font-mono">{item.source_path}</code>. Re-sincronizar
              pisa lo que cambies acá: si es un aprendizaje nuevo, anotalo también en la nota.
            </p>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            {confirmDelete ? (
              <Button variant="destructive" size="sm" onClick={onDelete} className="text-xs">
                Confirmar
              </Button>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)} className="gap-1 text-xs text-muted-foreground">
                <Trash2 className="h-3.5 w-3.5" /> Eliminar
              </Button>
            )}
            <Button
              size="sm"
              disabled={!dirty || saving}
              onClick={() =>
                onSave({
                  status,
                  key_learning: learning.trim() || null,
                  score_label: score.trim() || null,
                })
              }
            >
              {saving ? "Guardando…" : "Guardar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddDialog({
  open,
  defaultKind,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  defaultKind: LibraryKind;
  onClose: () => void;
  onSave: (input: { kind: LibraryKind; title: string; subtitle: string | null; status: string; started_on: string | null }) => Promise<void>;
  saving: boolean;
}) {
  const [kind, setKind] = useState<LibraryKind>(defaultKind);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [status, setStatus] = useState(STATUS_OPTIONS[defaultKind][0]);
  const [startedOn, setStartedOn] = useState("");

  // Al abrir, arranca en la pestaña que se estaba mirando.
  useEffect(() => {
    if (!open) return;
    setKind(defaultKind);
    setStatus(STATUS_OPTIONS[defaultKind][0]);
    setTitle("");
    setSubtitle("");
    setStartedOn("");
  }, [open, defaultKind]);

  const canSave = title.trim() !== "" && !saving;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[75dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-border/60 bg-card">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg text-primary">Agregar a la biblioteca</DialogTitle>
          <DialogDescription className="text-xs">Lo mínimo es el título; el resto se completa después.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(KIND_META) as LibraryKind[]).map((k) => {
              const Icon = KIND_META[k].icon;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    setKind(k);
                    setStatus(STATUS_OPTIONS[k][0]);
                  }}
                  className={cn(
                    "flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl border text-[10px]",
                    kind === k ? "border-primary/60 bg-primary/10 text-primary" : "border-border/60 text-muted-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {KIND_META[k].singular}
                </button>
              );
            })}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lib-title" className="text-xs">Título</Label>
            <Input id="lib-title" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lib-sub" className="text-xs">
              {KIND_META[kind].subtitleLabel} <span className="text-muted-foreground">(opcional)</span>
            </Label>
            <Input id="lib-sub" value={subtitle} onChange={(e) => setSubtitle(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lib-start" className="text-xs">
              Desde <span className="text-muted-foreground">(ej. 2025-03)</span>
            </Label>
            <Input id="lib-start" value={startedOn} onChange={(e) => setStartedOn(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_OPTIONS[kind].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={cn(
                  "min-h-[32px] rounded-full px-3 text-xs",
                  status === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <Button
            className="w-full"
            disabled={!canSave}
            onClick={() =>
              onSave({
                kind,
                title: title.trim(),
                subtitle: subtitle.trim() || null,
                status,
                started_on: startedOn.trim() || null,
              })
            }
          >
            {saving ? "Guardando…" : "Agregar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
