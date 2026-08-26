import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export interface FrictionCoolingTimerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmSell: (rationale: string) => void;
  initialTimerSeconds?: number;
}

export function FrictionCoolingTimerModal({
  open,
  onOpenChange,
  onConfirmSell,
  initialTimerSeconds = 60,
}: FrictionCoolingTimerModalProps) {
  const [secondsRemaining, setSecondsRemaining] = useState(initialTimerSeconds);
  const [rationale, setRationale] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) {
      setSecondsRemaining(initialTimerSeconds);
      setRationale("");
      setError("");
      return;
    }

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [open, initialTimerSeconds]);

  const canSubmit = secondsRemaining === 0 && rationale.trim().length >= 20;

  const handleSubmit = () => {
    if (secondsRemaining > 0) {
      setError("Cooling-off timer must reach 0 before submitting.");
      return;
    }
    if (rationale.trim().length < 20) {
      setError("Written rationale must be at least 20 characters.");
      return;
    }
    setError("");
    onConfirmSell(rationale.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-amber-500">
            ⏳ Venta No Planificada — Tiempo de Enfriamiento (60s)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="text-center p-4 bg-muted/40 rounded-lg border border-border/40">
            <p className="text-xs text-muted-foreground uppercase font-mono">Tiempo Restante</p>
            <p className="text-3xl font-bold font-mono text-amber-500">{secondsRemaining}s</p>
          </div>

          {error && <div className="text-xs text-destructive font-medium bg-destructive/10 p-2 rounded">{error}</div>}

          <div className="space-y-1">
            <Label className="text-xs">Justificación Obligatoria de la Venta (min 20 caracteres)</Label>
            <Textarea
              placeholder="Describa el motivo detallado de salir antes de alcanzar la meta o invalidación..."
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
            />
            <p className="text-[10px] text-muted-foreground text-right font-mono">
              {rationale.trim().length} / 20 caracteres requeridos
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar Venta</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} variant="destructive">
            Confirmar Venta No Planificada
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export {
  validateUnplannedSellRationale,
  processSellExecution,
  type SellExecutionRequest,
} from "@/lib/disciplineFriction";


