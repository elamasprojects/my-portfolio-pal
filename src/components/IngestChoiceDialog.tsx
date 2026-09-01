import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CandlestickChart, Receipt, ChevronRight } from "lucide-react";

/**
 * Lo que pregunta el "+" antes de abrir nada.
 *
 * El botón caía derecho en la ingesta de finanzas, así que registrar una compra o una venta
 * no tenía entrada: el formulario seguía en el código pero nada lo abría. Son dos ledgers
 * distintos —`trades` y `transactions`, con sus propios triggers— y la pregunta de cuál es
 * la única que el usuario puede contestar.
 */

interface IngestChoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPickTrade: () => void;
  onPickTransaction: () => void;
}

export function IngestChoiceDialog({
  open,
  onOpenChange,
  onPickTrade,
  onPickTransaction,
}: IngestChoiceDialogProps) {
  const options = [
    {
      key: "trade",
      icon: CandlestickChart,
      title: "Operación",
      detail: "Compra o venta de un activo",
      onPick: onPickTrade,
    },
    {
      key: "transaction",
      icon: Receipt,
      title: "Movimiento",
      detail: "Un gasto o un ingreso",
      onPick: onPickTransaction,
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-border/60 bg-card p-4 shadow-2xl sm:p-5">
        <DialogHeader>
          <DialogTitle className="font-serif text-lg text-primary">
            ¿Qué querés registrar?
          </DialogTitle>
          <DialogDescription className="text-xs">
            Cada uno va a su propio registro.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2.5 pt-1">
          {options.map(({ key, icon: Icon, title, detail, onPick }) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                onOpenChange(false);
                onPick();
              }}
              className="group flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3.5 text-left transition-all hover:border-primary/60 hover:bg-muted/50 active:scale-[.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <Icon className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-foreground">{title}</span>
                <span className="block truncate text-xs text-muted-foreground">{detail}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default IngestChoiceDialog;
