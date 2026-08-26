import { useMercuryCardLinks, useMercurySync } from "@/hooks/useMercurySync";
import { Button } from "@/components/ui/button";
import { Landmark, Loader2 } from "lucide-react";

/**
 * "hace 3 h", "ayer". Escrito a mano en vez de traer `date-fns/locale`: es la
 * unica fecha relativa de la app y el resto del repo importa date-fns sin
 * locales, asi que no vale sumar esa superficie por una linea de texto.
 */
function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "recien";

  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "recien";
  if (minutes < 60) return `hace ${minutes} min`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;

  const days = Math.floor(hours / 24);
  if (days === 1) return "ayer";
  if (days < 30) return `hace ${days} d`;

  const months = Math.floor(days / 30);
  return months === 1 ? "hace 1 mes" : `hace ${months} meses`;
}

/**
 * Dispara el import de gastos de las tarjetas de Mercury vinculadas.
 *
 * No se renderiza si no hay ningun vinculo activo: sin vinculo el boton no haria
 * nada, y mostrarlo sugeriria que la sincronizacion esta disponible cuando no lo
 * esta. El detalle del resultado lo informa el toast del hook.
 */
export function MercurySyncButton() {
  const { data: links = [], isLoading } = useMercuryCardLinks();
  const sync = useMercurySync();

  const activeLinks = links.filter((l) => l.is_active);
  if (isLoading || activeLinks.length === 0) return null;

  // El vinculo mas reciente marca el estado; con una sola tarjeta es el suyo.
  const lastSynced = activeLinks
    .map((l) => l.last_synced_at)
    .filter((d): d is string => Boolean(d))
    .sort()
    .pop();

  const title = activeLinks.length === 1
    ? `Importar gastos de ${activeLinks[0].label}`
    : `Importar gastos de ${activeLinks.length} tarjetas vinculadas`;

  return (
    <Button
      variant="outline"
      size="sm"
      title={title}
      disabled={sync.isPending}
      onClick={() => sync.mutate({})}
      className="border-violet-500/40 bg-violet-500/10 text-violet-400 hover:bg-violet-500/20 text-xs font-semibold gap-1.5"
    >
      {sync.isPending
        ? <Loader2 className="h-4 w-4 animate-spin" />
        : <Landmark className="h-4 w-4" />}
      <span>{sync.isPending ? "Sincronizando..." : "Mercury"}</span>
      {!sync.isPending && lastSynced && (
        <span className="hidden sm:inline text-[10px] font-normal opacity-70">
          {timeAgo(lastSynced)}
        </span>
      )}
    </Button>
  );
}
