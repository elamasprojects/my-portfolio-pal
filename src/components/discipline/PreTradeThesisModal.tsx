import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { PreTradeThesis } from "@/types/thesis";

export interface PreTradeThesisModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (thesis: PreTradeThesis) => void;
}

export function PreTradeThesisModal({ open, onOpenChange, onSubmit }: PreTradeThesisModalProps) {
  const [entryThesis, setEntryThesis] = useState("");
  const [targetPriceUSD, setTargetPriceUSD] = useState<number | "">("");
  const [invalidationCondition, setInvalidationCondition] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!entryThesis || entryThesis.trim().length < 10) {
      setError("Reason for entry / Thesis must be at least 10 characters.");
      return;
    }
    if (!targetPriceUSD || Number(targetPriceUSD) <= 0) {
      setError("Exit target price must be greater than 0.");
      return;
    }
    if (!invalidationCondition || invalidationCondition.trim().length < 10) {
      setError("Invalidation condition must be at least 10 characters.");
      return;
    }

    setError("");
    onSubmit({
      entryThesis: entryThesis.trim(),
      targetPriceUSD: Number(targetPriceUSD),
      invalidationCondition: invalidationCondition.trim(),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Registrar Tesis de Inversión (Pre-Trade)</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {error && <div className="text-xs text-destructive font-medium bg-destructive/10 p-2 rounded">{error}</div>}
          <div className="space-y-1">
            <Label className="text-xs">Reason for Entry / Thesis (min 10 chars)</Label>
            <Textarea
              placeholder="e.g. Strong Q1 earnings expected with revenue growth > 15%"
              value={entryThesis}
              onChange={(e) => setEntryThesis(e.target.value)}
              rows={3}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Exit Target Price (US$)</Label>
            <Input
              type="number"
              placeholder="300"
              value={targetPriceUSD}
              onChange={(e) => setTargetPriceUSD(e.target.value === "" ? "" : Number(e.target.value))}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Invalidation Condition (min 10 chars)</Label>
            <Textarea
              placeholder="e.g. Price breaks below 800 ARS support or revenue drops"
              value={invalidationCondition}
              onChange={(e) => setInvalidationCondition(e.target.value)}
              rows={2}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>Confirmar Tesis</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type { PreTradeThesis };

/**
 * Pre-Trade Form Validator (R4)
 */
export function validatePreTradeThesisForm(input: {
  buyPriceARS: number;
  targetPriceARS: number;
  invalidationPriceARS: number;
  entryThesis: string;
  invalidationCondition: string;
}): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (input.targetPriceARS <= input.buyPriceARS) {
    errors.push('Exit target price must be greater than entry price');
  }
  if (input.invalidationPriceARS >= input.buyPriceARS) {
    errors.push('Invalidation price must be lower than entry price');
  }
  if (!input.entryThesis || input.entryThesis.trim().length < 10) {
    errors.push('Entry thesis must be at least 10 characters');
  }
  if (!input.invalidationCondition || input.invalidationCondition.trim().length < 10) {
    errors.push('Invalidation condition must be at least 10 characters');
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validates Pre-Trade Thesis fields according to R4.
 */
export function validatePreTradeThesis(
  thesis: Partial<PreTradeThesis>,
  /** Entry price in the same unit as `thesis.targetPriceUSD`. */
  buyPrice: number
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!thesis.entryThesis || thesis.entryThesis.trim().length < 10) {
    errors.push('Entry thesis must be at least 10 characters long.');
  }
  if (!thesis.targetPriceUSD || thesis.targetPriceUSD <= buyPrice) {
    errors.push('Target price must be greater than buy price.');
  }
  if (!thesis.invalidationCondition || thesis.invalidationCondition.trim().length < 10) {
    errors.push('Invalidation condition must be at least 10 characters long.');
  }
  return {
    valid: errors.length === 0,
    errors,
  };
}

