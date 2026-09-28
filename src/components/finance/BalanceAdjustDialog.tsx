import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import type { FinancialAccount } from "@/types/finance";
import { useBalanceAdjustments } from "@/hooks/useBalanceAdjustments";
import { daysSince, parseAmountInput, planAdjustments } from "@/lib/balanceAdjustment";
import { cn } from "@/lib/utils";

/**
 * Poner las cuentas en su saldo real, todas en una pasada.
 *
 * Existe porque las transferencias entre cuentas propias no se cargan: la plata sale de una y
 * entra en otra sin que la app se entere, y los saldos derivan hasta quedar negativos. En vez
 * de cargar cada transferencia, una vez por mes se tipea lo que dice cada app del banco y la
 * diferencia queda registrada como ajuste — sin tocar ingresos ni gastos.
 *
 * Un campo vacío es "esta cuenta no se toca", no cero.
 */

/** En la moneda de la cuenta, que es como se guarda el saldo. */
function fmt(n: number, currency: string): string {
  const s = n.toLocaleString("es-AR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${currency === "ARS" ? "$" : "US$"} ${s}`;
}

export function BalanceAdjustDialog({
  accounts,
  open,
  onOpenChange,
}: {
  accounts: FinancialAccount[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { lastByAccount, adjust } = useBalanceAdjustments();
  const queryClient = useQueryClient();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  // Cada apertura arranca limpia: lo tipeado la vez anterior ya se guardó o se descartó.
  // Y trae los saldos frescos: el sync de Mercury corre solo, y una diferencia calculada contra
  // el saldo de hace una hora puede no ser la real.
  useEffect(() => {
    if (open) {
      setInputs({});
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["financial_accounts"] });
    }
  }, [open, queryClient]);

  const plan = useMemo(
    () =>
      planAdjustments(
        accounts.map((a) => ({
          accountId: a.id,
          current: Number(a.current_balance) || 0,
          input: inputs[a.id] ?? "",
        })),
      ),
    [accounts, inputs],
  );

  const submit = async () => {
    if (plan.length === 0) return;
    try {
      const rows = await adjust.mutateAsync({ plan, note: note.trim() || undefined });
      const withFuture = rows.filter((r) => Math.abs(Number(r.future_net) || 0) >= 0.005).length;
      toast.success(rows.length === 1 ? "Saldo ajustado" : `${rows.length} saldos ajustados`, {
        // El saldo que queda puede no ser el tipeado: la app ya descuenta lo cargado a futuro.
        description:
          withFuture > 0
            ? "Algunas cuentas tienen movimientos con fecha futura: el saldo que ves ya los descuenta."
            : undefined,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo ajustar el saldo");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[60] w-[calc(100vw-2rem)] sm:w-full sm:max-w-lg max-h-[85dvh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>Ajustar saldos</DialogTitle>
          <DialogDescription>
            Escribí lo que dice cada cuenta hoy. La diferencia queda registrada como ajuste y no
            cuenta como ingreso ni gasto. Si el saldo está bien, escribí el mismo número para
            confirmarlo. Lo que cargues después con fecha anterior ya no mueve ese saldo, porque
            ya estaba incluido. Dejá vacío lo que no quieras tocar.
          </DialogDescription>
        </DialogHeader>

        <ul className="space-y-2">
          {accounts.map((acc) => {
            const current = Number(acc.current_balance) || 0;
            const raw = inputs[acc.id] ?? "";
            const parsed = parseAmountInput(raw);
            const invalid = raw.trim() !== "" && parsed === null;
            const delta = parsed === null ? null : Math.round((parsed - current) * 100) / 100;
            const last = lastByAccount.get(acc.id);
            const days = daysSince(last?.created_at);
            return (
              <li key={acc.id} className="rounded-xl border border-border/60 bg-background/40 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-foreground">{acc.name}</span>
                  <span className="shrink-0 text-[10px] font-mono uppercase text-muted-foreground">
                    {acc.currency}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">
                    En la app:{" "}
                    <span className={cn("font-mono tabular-nums", current < 0 ? "text-rose-400" : "text-foreground")}>
                      {fmt(current, acc.currency)}
                    </span>
                  </span>
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    {days === null ? "Nunca ajustada" : days === 0 ? "Ajustada hoy" : `Ajustada hace ${days} d`}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Input
                    inputMode="decimal"
                    placeholder="Saldo real"
                    value={raw}
                    onChange={(e) => setInputs((s) => ({ ...s, [acc.id]: e.target.value }))}
                    aria-invalid={invalid}
                    aria-label={`Saldo real de ${acc.name}`}
                    className={cn("h-9 font-mono text-sm", invalid && "border-destructive")}
                  />
                  <span
                    className={cn(
                      "w-28 shrink-0 text-right font-mono text-xs tabular-nums",
                      invalid
                        ? "text-destructive"
                        : delta === null || Math.abs(delta) < 0.005
                          ? "text-muted-foreground"
                          : delta > 0
                            ? "text-emerald-400"
                            : "text-rose-400",
                    )}
                  >
                    {invalid
                      ? "No es un número"
                      : delta === null
                        ? "—"
                        : Math.abs(delta) < 0.005
                          ? "Confirma"
                          : `${delta > 0 ? "+" : "−"}${fmt(Math.abs(delta), acc.currency)}`}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>

        <Input
          placeholder="Nota (opcional): ej. conciliación de fin de mes"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-9 text-sm"
        />

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={adjust.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={plan.length === 0 || adjust.isPending}>
            {adjust.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {plan.length === 0
              ? "Ajustar"
              : plan.length === 1
                ? "Guardar 1 cuenta"
                : `Guardar ${plan.length} cuentas`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
