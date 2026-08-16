import { useMemo, useState } from "react";
import { useAddTrade } from "@/hooks/usePortfolio";
import { useBrokers } from "@/hooks/useBrokers";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Banknote, Loader2 } from "lucide-react";

type TradeType = "buy" | "sell" | "dividend";

export interface AddTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselected operation type when opened from a contextual action. */
  defaultTradeType?: TradeType;
  defaultSymbol?: string;
}

const TYPE_OPTIONS: { value: TradeType; label: string; icon: typeof ArrowDownLeft }[] = [
  { value: "buy", label: "Compra", icon: ArrowDownLeft },
  { value: "sell", label: "Venta", icon: ArrowUpRight },
  { value: "dividend", label: "Dividendo", icon: Banknote },
];

function todayLocalISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function AddTradeDialog({
  open,
  onOpenChange,
  defaultTradeType = "buy",
  defaultSymbol = "",
}: AddTradeDialogProps) {
  const addTrade = useAddTrade();
  const { data: brokers = [] } = useBrokers();
  const { venta: mepRate = 0 } = useDolarMEP();

  const [tradeType, setTradeType] = useState<TradeType>(defaultTradeType);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [assetName, setAssetName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"USD" | "ARS">("USD");
  const [tradeDate, setTradeDate] = useState(todayLocalISO());
  const [brokerId, setBrokerId] = useState<string>("none");
  const [notes, setNotes] = useState("");

  // Pre-trade thesis (R4): mandatory on buys.
  const [entryThesis, setEntryThesis] = useState("");
  const [targetPrice, setTargetPrice] = useState("");
  const [invalidationCondition, setInvalidationCondition] = useState("");

  const [errors, setErrors] = useState<string[]>([]);

  const isDividend = tradeType === "dividend";
  const isBuy = tradeType === "buy";

  const total = useMemo(() => {
    const p = parseFloat(price);
    if (!Number.isFinite(p) || p <= 0) return null;
    if (isDividend) return p;
    const q = parseFloat(quantity);
    if (!Number.isFinite(q) || q <= 0) return null;
    return q * p;
  }, [price, quantity, isDividend]);

  const totalUSD = useMemo(() => {
    if (total === null) return null;
    if (currency === "USD") return total;
    return mepRate > 0 ? total / mepRate : null;
  }, [total, currency, mepRate]);

  function reset() {
    setTradeType(defaultTradeType);
    setSymbol(defaultSymbol);
    setAssetName("");
    setQuantity("");
    setPrice("");
    setCurrency("USD");
    setTradeDate(todayLocalISO());
    setBrokerId("none");
    setNotes("");
    setEntryThesis("");
    setTargetPrice("");
    setInvalidationCondition("");
    setErrors([]);
  }

  function validate(): string[] {
    const errs: string[] = [];

    if (!symbol.trim()) errs.push("El ticker es obligatorio.");

    const p = parseFloat(price);
    if (!Number.isFinite(p) || p <= 0) {
      errs.push(isDividend ? "El monto del dividendo debe ser mayor a 0." : "El precio debe ser mayor a 0.");
    }

    if (!isDividend) {
      const q = parseFloat(quantity);
      if (!Number.isFinite(q) || q <= 0) errs.push("La cantidad debe ser mayor a 0.");
    }

    if (currency === "ARS" && !(mepRate > 0)) {
      errs.push("No hay cotización MEP disponible para convertir montos en pesos.");
    }

    if (!tradeDate) errs.push("La fecha es obligatoria.");

    // R4: a buy without a declared thesis is exactly the decision this app exists to audit.
    if (isBuy) {
      if (entryThesis.trim().length < 10) {
        errs.push("Por qué entro: mínimo 10 caracteres.");
      }
      const target = parseFloat(targetPrice);
      if (!Number.isFinite(target) || target <= 0) {
        errs.push("El precio de salida / target debe ser mayor a 0.");
      }
      if (invalidationCondition.trim().length < 10) {
        errs.push("Qué la invalidaría: mínimo 10 caracteres.");
      }
    }

    return errs;
  }

  async function handleSubmit() {
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;

    try {
      await addTrade.mutateAsync({
        tradeType,
        symbol,
        assetName: assetName || symbol,
        quantity: isDividend ? undefined : parseFloat(quantity),
        price: parseFloat(price),
        currency,
        mepRate: currency === "ARS" ? mepRate : null,
        tradeDate,
        brokerId: brokerId === "none" ? null : brokerId,
        notes: notes.trim() || null,
        entryThesis: isBuy ? entryThesis.trim() : null,
        targetPriceARS: isBuy ? parseFloat(targetPrice) : null,
        invalidationCondition: isBuy ? invalidationCondition.trim() : null,
      });

      const label = isDividend ? "Dividendo" : isBuy ? "Compra" : "Venta";
      toast.success(`${label} registrada: ${symbol.trim().toUpperCase()}`);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      const msg: string = err?.message || "No se pudo registrar la operación.";
      // The validate_sell_quantity trigger rejects selling more than the ledger holds.
      if (/insufficient shares/i.test(msg)) {
        setErrors(["No tenés suficientes unidades registradas para vender esa cantidad."]);
      } else {
        setErrors([msg]);
      }
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Registrar Operación</DialogTitle>
          <DialogDescription className="text-xs">
            Compras, ventas y dividendos de tu cartera de inversiones.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {errors.length > 0 && (
            <ul className="text-xs text-destructive font-medium bg-destructive/10 p-2.5 rounded space-y-1 list-disc list-inside">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          {/* Operation type */}
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map((opt) => {
              const active = tradeType === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTradeType(opt.value)}
                  aria-pressed={active}
                  className={`flex flex-col items-center justify-center gap-1 rounded-lg border py-2.5 text-xs font-semibold transition-colors ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <opt.icon className="h-4 w-4" />
                  {opt.label}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="trade-symbol" className="text-xs">Ticker</Label>
              <Input
                id="trade-symbol"
                placeholder="AAPL"
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                autoComplete="off"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="trade-name" className="text-xs">Nombre (opcional)</Label>
              <Input
                id="trade-name"
                placeholder="Apple Inc."
                value={assetName}
                onChange={(e) => setAssetName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {!isDividend && (
              <div className="space-y-1">
                <Label htmlFor="trade-qty" className="text-xs">Cantidad</Label>
                <Input
                  id="trade-qty"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="10"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="trade-price" className="text-xs">
                {isDividend ? "Monto recibido" : "Precio por unidad"}
              </Label>
              <Input
                id="trade-price"
                type="number"
                step="any"
                min="0"
                placeholder={isDividend ? "125.40" : "230.15"}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            {isDividend && (
              <div className="space-y-1">
                <Label className="text-xs">Moneda</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as "USD" | "ARS")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">US$</SelectItem>
                    <SelectItem value="ARS">AR$</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {!isDividend && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Moneda</Label>
                <Select value={currency} onValueChange={(v) => setCurrency(v as "USD" | "ARS")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">US$</SelectItem>
                    <SelectItem value="ARS">AR$</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="trade-date" className="text-xs">Fecha</Label>
                <Input
                  id="trade-date"
                  type="date"
                  value={tradeDate}
                  onChange={(e) => setTradeDate(e.target.value)}
                />
              </div>
            </div>
          )}

          {isDividend && (
            <div className="space-y-1">
              <Label htmlFor="trade-date-div" className="text-xs">Fecha</Label>
              <Input
                id="trade-date-div"
                type="date"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
              />
            </div>
          )}

          {brokers.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs">Broker (opcional)</Label>
              <Select value={brokerId} onValueChange={setBrokerId}>
                <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin asignar</SelectItem>
                  {brokers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {total !== null && (
            <p className="text-xs text-muted-foreground">
              Total: {currency === "ARS" ? "AR$ " : "US$ "}
              {total.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
              {currency === "ARS" && totalUSD !== null && (
                <> · US$ {totalUSD.toLocaleString("es-AR", { maximumFractionDigits: 2 })} al MEP {mepRate.toLocaleString("es-AR")}</>
              )}
            </p>
          )}

          {/* R4: Pre-trade thesis, mandatory on buys */}
          {isBuy && (
            <div className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <p className="text-xs font-semibold text-primary">Tesis previa a la compra (obligatoria)</p>

              <div className="space-y-1">
                <Label htmlFor="thesis-why" className="text-xs">Por qué entro</Label>
                <Textarea
                  id="thesis-why"
                  rows={2}
                  placeholder="Ej: earnings del Q1 con crecimiento de ingresos > 15%"
                  value={entryThesis}
                  onChange={(e) => setEntryThesis(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="thesis-target" className="text-xs">Precio de salida / target</Label>
                <Input
                  id="thesis-target"
                  type="number"
                  step="any"
                  min="0"
                  placeholder="300"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="thesis-invalidation" className="text-xs">Qué la invalidaría</Label>
                <Textarea
                  id="thesis-invalidation"
                  rows={2}
                  placeholder="Ej: pierde el soporte de 180 o cae la facturación dos trimestres seguidos"
                  value={invalidationCondition}
                  onChange={(e) => setInvalidationCondition(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="trade-notes" className="text-xs">Notas (opcional)</Label>
            <Textarea
              id="trade-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={addTrade.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={addTrade.isPending}>
            {addTrade.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Registrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
