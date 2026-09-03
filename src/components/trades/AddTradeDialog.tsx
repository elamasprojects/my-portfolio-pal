import { useEffect, useMemo, useRef, useState } from "react";
import { useAddTrade } from "@/hooks/usePortfolio";
import { useUserBrokers } from "@/hooks/useBrokers";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowDownLeft, ArrowUpRight, Banknote, Loader2, Upload, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type TradeType = "buy" | "sell" | "dividend";

export interface AddTradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Preselected operation type when opened from a contextual action. */
  defaultTradeType?: TradeType;
  defaultSymbol?: string;
  /**
   * Prefill for the R4 thesis fields, used when the buy is executed from a candidate that
   * already carries a written thesis. These are defaults for the form state, so mount the
   * dialog under a `key` tied to the source record when they change.
   */
  defaultEntryThesis?: string;
  defaultTargetPrice?: string;
  defaultInvalidationCondition?: string;
  defaultCurrency?: "USD" | "ARS";
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
  defaultEntryThesis = "",
  defaultTargetPrice = "",
  defaultInvalidationCondition = "",
  defaultCurrency = "USD",
}: AddTradeDialogProps) {
  const addTrade = useAddTrade();
  // Los tuyos, no los 23 del catálogo: el selector ofrecía brokers en los que nunca operaste.
  const { data: userBrokers = [] } = useUserBrokers();
  const brokers = useMemo(
    () =>
      userBrokers
        .filter((ub) => ub.broker)
        .map((ub) => ({ id: ub.broker!.id, name: ub.broker!.name, isDefault: ub.is_default })),
    [userBrokers]
  );
  const { venta: mepRate = 0 } = useDolarMEP();

  const [tradeType, setTradeType] = useState<TradeType>(defaultTradeType);
  const [symbol, setSymbol] = useState(defaultSymbol);
  const [assetName, setAssetName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState<"USD" | "ARS">(defaultCurrency);
  const [tradeDate, setTradeDate] = useState(todayLocalISO());
  const [brokerId, setBrokerId] = useState<string>("none");
  const [notes, setNotes] = useState("");

  // Pre-trade thesis (R4): mandatory on buys.
  const [entryThesis, setEntryThesis] = useState(defaultEntryThesis);
  const [targetPrice, setTargetPrice] = useState(defaultTargetPrice);
  const [invalidationCondition, setInvalidationCondition] = useState(defaultInvalidationCondition);

  const [errors, setErrors] = useState<string[]>([]);

  /*
    El diálogo abría pidiendo los diez campos de la operación. Ahora son tres momentos: subir
    el comprobante, mirar lo que se leyó, y confirmar. Los campos aparecen sólo si hacen falta
    —porque la lectura salió mal, o porque se carga a mano—, que es la minoría de las veces.
  */
  const [step, setStep] = useState<"capture" | "review" | "form">("capture");

  // El broker marcado como predeterminado entra solo. Antes había que elegirlo en cada alta,
  // incluso operando siempre con el mismo.
  useEffect(() => {
    if (brokerId !== "none") return;
    const preferido = brokers.find((b) => b.isDefault) ?? (brokers.length === 1 ? brokers[0] : null);
    if (preferido) setBrokerId(preferido.id);
  }, [brokers, brokerId]);

  // Subir el comprobante del broker y dejar que la IA lo lea. Sólo se permitía para gastos,
  // así que una orden ejecutada había que tipearla entera desde la captura que ya tenías.
  const [receipt, setReceipt] = useState<{ url: string; name: string } | null>(null);
  const [isReading, setIsReading] = useState(false);
  const receiptInput = useRef<HTMLInputElement>(null);

  const clearReceipt = () => {
    setReceipt((prev) => {
      if (prev) URL.revokeObjectURL(prev.url);
      return null;
    });
    if (receiptInput.current) receiptInput.current.value = "";
  };

  const readReceipt = async (file: File) => {
    clearReceipt();
    setReceipt({ url: URL.createObjectURL(file), name: file.name });
    setIsReading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data, error } = await supabase.functions.invoke("analyze-trade-image", {
        body: { image: base64 },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Lo leído se propone, no se guarda: los campos quedan editables y el alta sigue
      // siendo el mismo botón de siempre.
      if (data?.trade_type) setTradeType(data.trade_type as TradeType);
      if (data?.symbol) setSymbol(String(data.symbol).toUpperCase());
      if (data?.asset_name) setAssetName(String(data.asset_name));
      if (data?.quantity != null) setQuantity(String(data.quantity));
      if (data?.price_per_unit != null) setPrice(String(data.price_per_unit));
      if (data?.currency === "ARS" || data?.currency === "USD") setCurrency(data.currency);
      if (data?.trade_date) setTradeDate(String(data.trade_date).slice(0, 10));

      setStep("review");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "No se pudo leer el comprobante"
      );
      clearReceipt();
      // Lo leído no sirvió, pero lo que ya se tipeó sí: se abre el formulario en vez de
      // dejar al usuario de vuelta en una zona de subida vacía.
      setStep("form");
    } finally {
      setIsReading(false);
    }
  };

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
    setCurrency(defaultCurrency);
    setTradeDate(todayLocalISO());
    setBrokerId("none");
    setNotes("");
    setEntryThesis(defaultEntryThesis);
    setTargetPrice(defaultTargetPrice);
    setInvalidationCondition(defaultInvalidationCondition);
    setErrors([]);
    // El comprobante también: si no, la captura de la orden anterior queda colgada arriba
    // del formulario en blanco —y su object URL sin revocar— como si fuera de esta.
    clearReceipt();
    setStep("capture");
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

    /*
      La tesis, el target y la invalidación quedan opcionales. Eran obligatorios para que una
      compra no entrara sin declararse, pero este formulario registra una compra ya ejecutada:
      exigirlos no cambia la decisión, sólo impide anotar el hecho. Lo que sí se conserva es
      que un target mal escrito no pase como número.
    */
    if (isBuy && targetPrice.trim() !== "") {
      const target = parseFloat(targetPrice);
      if (!Number.isFinite(target) || target <= 0) {
        errs.push("El precio de salida / target debe ser mayor a 0.");
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
        entryThesis: isBuy ? entryThesis.trim() || null : null,
        // Entered in `currency`; buildTradeRow normalises it to USD like the price.
        targetPrice: isBuy && targetPrice.trim() !== "" ? parseFloat(targetPrice) : null,
        invalidationCondition: isBuy ? invalidationCondition.trim() || null : null,
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
          {/* Comprobante primero: leerlo llena el formulario y evita tipear la orden entera. */}
          <input
            ref={receiptInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) readReceipt(f);
            }}
          />
          {receipt ? (
            <div className="flex items-center gap-3 rounded-xl border bg-muted/30 p-2.5">
              <img
                src={receipt.url}
                alt="Comprobante de la operación"
                className="h-14 w-14 rounded-lg border object-cover"
              />
              <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {isReading ? "Leyendo el comprobante…" : receipt.name}
              </p>
              {isReading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
              ) : (
                <button
                  type="button"
                  onClick={clearReceipt}
                  aria-label="Quitar comprobante"
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => receiptInput.current?.click()}
              className="group w-full rounded-xl border-2 border-dashed border-border/70 bg-muted/15 p-3 text-center transition-colors hover:bg-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Upload className="mx-auto h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
              <span className="mt-1 block text-xs font-semibold">
                Subí la captura de la orden
              </span>
              <span className="block text-[11px] text-muted-foreground">
                Se completan los campos y los revisás antes de guardar
              </span>
            </button>
          )}

          {step === "capture" && (
            <button
              type="button"
              onClick={() => setStep("form")}
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              O cargala a mano
            </button>
          )}

          {errors.length > 0 && (
            <ul className="text-xs text-destructive font-medium bg-destructive/10 p-2.5 rounded space-y-1 list-disc list-inside">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          {step === "review" && (
            <>
              {/*
                Lo leído, en modo lectura. Se muestra para confirmar, no para completar: si
                está bien —que es lo normal— alcanza con un botón.
              */}
              <dl className="divide-y divide-border/50 rounded-xl border border-border/60 bg-muted/20">
                {[
                  ["Operación", TYPE_OPTIONS.find((o) => o.value === tradeType)?.label ?? tradeType],
                  ["Activo", `${symbol.toUpperCase()}${assetName ? ` · ${assetName}` : ""}`],
                  ...(isDividend ? [] : [["Cantidad", quantity] as [string, string]]),
                  ["Precio por unidad", `${currency === "ARS" ? "AR$" : "US$"} ${price}`],
                  ["Fecha", tradeDate.split("-").reverse().join("/")],
                  ["Broker", brokers.find((b) => b.id === brokerId)?.name ?? "Sin asignar"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-3 px-3 py-2">
                    <dt className="text-xs text-muted-foreground">{k}</dt>
                    <dd className="min-w-0 truncate text-right text-sm font-medium">{v}</dd>
                  </div>
                ))}
                {total !== null && (
                  <div className="flex items-baseline justify-between gap-3 bg-muted/30 px-3 py-2.5">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Total
                    </dt>
                    <dd className="font-mono text-base font-bold tabular-nums">
                      {currency === "ARS" ? "AR$ " : "US$ "}
                      {total.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                    </dd>
                  </div>
                )}
              </dl>

              {/* Editar es la salida rara; confirmar es lo que se hace casi siempre. */}
              <div className="grid grid-cols-5 gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("form")}
                  disabled={addTrade.isPending}
                  className="col-span-1 h-12"
                >
                  Editar
                </Button>
                <Button
                  onClick={handleSubmit}
                  disabled={addTrade.isPending}
                  className="col-span-4 h-12 text-sm font-bold"
                >
                  {addTrade.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  Confirmar y registrar
                </Button>
              </div>
            </>
          )}

          {step === "form" && (
          <>
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
              <Label htmlFor="trade-broker" className="text-xs">Broker (opcional)</Label>
              <Select value={brokerId} onValueChange={setBrokerId}>
                <SelectTrigger id="trade-broker" aria-label="Broker (opcional)">
                  <SelectValue placeholder="Sin asignar" />
                </SelectTrigger>
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
                <Label htmlFor="thesis-target" className="text-xs">
                  Precio de salida / target ({currency === "ARS" ? "AR$" : "US$"})
                </Label>
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
          </>
          )}
        </div>

        {step === "form" && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={addTrade.isPending}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={addTrade.isPending}>
              {addTrade.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Registrar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
