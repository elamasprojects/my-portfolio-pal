import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n";
import { cn } from "@/lib/utils";
import { useWatchlist } from "@/hooks/useWatchlist";

interface SymResult {
  symbol: string;
  description: string;
}

/** Button + dialog to search a ticker (search-symbol edge fn) and add it to the watchlist. */
export function AddToWatchlistButton({ className, size = "sm" }: { className?: string; size?: "sm" | "default" }) {
  const { t } = useLanguage();
  const { items, add } = useWatchlist();
  const owned = new Set(items.map((w) => w.symbol.toUpperCase()));
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SymResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const { data, error } = await supabase.functions.invoke("search-symbol", { body: { query: q.trim() } });
        setResults(!error && data?.results ? (data.results as SymResult[]) : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  const onPick = async (r: SymResult) => {
    try {
      await add(r.symbol, r.description);
      toast.success(t("watchlist.added", { symbol: r.symbol.toUpperCase() }));
      setOpen(false);
      setQ("");
      setResults([]);
    } catch {
      toast.error(t("watchlist.addError"));
    }
  };

  return (
    <>
      <Button size={size} className={className} onClick={() => setOpen(true)}>
        <Plus className="mr-1 h-4 w-4" />
        {t("watchlist.add")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("watchlist.addTitle")}</DialogTitle>
          </DialogHeader>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("watchlist.searchPlaceholder")}
              className="h-11 pl-9"
            />
          </div>
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            ) : results.length > 0 ? (
              <div className="space-y-1">
                {results.map((r) => {
                  const already = owned.has(r.symbol.toUpperCase());
                  return (
                    <button
                      key={r.symbol}
                      type="button"
                      disabled={already}
                      onClick={() => onPick(r)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                        already ? "opacity-50" : "hover:bg-accent",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="font-mono text-sm font-semibold">{r.symbol}</span>{" "}
                        <span className="text-xs text-muted-foreground">{r.description}</span>
                      </span>
                      {already ? (
                        <Check className="h-4 w-4 shrink-0 text-gain" />
                      ) : (
                        <Plus className="h-4 w-4 shrink-0 text-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            ) : q.trim().length >= 2 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("watchlist.noResults")}</p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
