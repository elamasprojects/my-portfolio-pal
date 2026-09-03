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
import { ArrowDownLeft, ArrowUpRight, Banknote, Loader2, Upload, Trash2, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type TradeType = "buy" | "sell" | "dividend";

/**
 * Una operación leída de un comprobante, esperando confirmación.
 *
 * Se subía de a una imagen, así que una tanda de diez órdenes eran diez pasadas por el mismo
 * diálogo. Cada fila guarda su propia copia de los campos: el formulario edita una por vez y
 * la devuelve acá, y recién el botón del pie escribe todas.
 */
interface BatchItem {
  key: string;
  fileName: string;
  tradeType: TradeType;
  symbol: string;
  assetName: string;
  quantity: string;
  price: string;
  currency: "USD" | "ARS";
  tradeDate: string;
  brokerId: string;
  notes: string;
  isPlannedExit: boolean;
  entryThesis: string;
  targetPrice: string;
  invalidationCondition: string;
  /** La lectura de este comprobante falló; la fila se muestra para corregirla o descartarla. */
  error?: string;
}

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

  /*
    Al sacar el bloqueo de la fricción, toda venta manual entraba con `is_planned_exit: false`
    — y la regla B1 del Game Review califica de "Blunder" una salida no planificada por debajo
    de la invalidación. Un stop-loss disciplinado quedaba castigado por no tener dónde
    declararse. Acá se declara.
  */
  const [isPlannedExit, setIsPlannedExit] = useState(false);

  // La tanda leída y, cuando el formulario está editando una de sus filas, cuál.
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  // El broker marcado como predeterminado entra solo. Antes había que elegirlo en cada alta,
  // incluso operando siempre con el mismo.
  const defaultApplied = useRef(false);
  useEffect(() => {
    // Una sola vez por alta. Mirando `brokerId` en las dependencias, elegir "Sin asignar"
    // devolvía el valor a "none" y el efecto volvía a poner el predeterminado encima.
    if (defaultApplied.current || brokers.length === 0) return;
    defaultApplied.current = true;
    const preferido = brokers.find((b) => b.isDefault) ?? (brokers.length === 1 ? brokers[0] : null);
    if (preferido) setBrokerId(preferido.id);
  }, [brokers]);

  // Subir el comprobante del broker y dejar que la IA lo lea. Sólo se permitía para gastos,
  // así que una orden ejecutada había que tipearla entera desde la captura que ya tenías.
  const [isReading, setIsReading] = useState(false);
  const receiptInput = useRef<HTMLInputElement>(null);

  /** Deja el input listo para volver a elegir el mismo archivo. */
  const clearReceipt = () => {
    if (receiptInput.current) receiptInput.current.value = "";
  };

  /** Los campos del formulario, tal como están, como fila de la tanda. */
  const snapshot = (key: string, fileName: string): BatchItem => ({
    key,
    fileName,
    tradeType,
    symbol,
    assetName,
    quantity,
    price,
    currency,
    tradeDate,
    brokerId,
    notes,
    isPlannedExit,
    entryThesis,
    targetPrice,
    invalidationCondition,
  });

  /** Y al revés: una fila vuelve al formulario para editarla. */
  const hydrate = (item: BatchItem) => {
    setTradeType(item.tradeType);
    setSymbol(item.symbol);
    setAssetName(item.assetName);
    setQuantity(item.quantity);
    setPrice(item.price);
    setCurrency(item.currency);
    setTradeDate(item.tradeDate);
    setBrokerId(item.brokerId);
    setNotes(item.notes);
    setIsPlannedExit(item.isPlannedExit);
    setEntryThesis(item.entryThesis);
    setTargetPrice(item.targetPrice);
    setInvalidationCondition(item.invalidationCondition);
    setErrors([]);
  };

  /** Lee un comprobante y devuelve la operación, sin tocar el formulario. */
  async function readOne(file: File, key: string): Promise<BatchItem> {
    const base = snapshot(key, file.name);
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

      const leida: "USD" | "ARS" =
        data?.currency === "ARS" || data?.currency === "USD" ? data.currency : base.currency;

      // Un objetivo escrito en la moneda anterior —así lo abre el watchlist— guardado tal cual
      // queda errado por el factor del MEP.
      let target = base.targetPrice;
      if (leida !== base.currency && target.trim() !== "") {
        const n = parseFloat(target);
        if (Number.isFinite(n) && mepRate > 0) {
          target = String(Number((leida === "USD" ? n / mepRate : n * mepRate).toFixed(4)));
        } else {
          target = "";
        }
      }

      return {
        ...base,
        tradeType: (data?.trade_type as TradeType) ?? base.tradeType,
        symbol: data?.symbol ? String(data.symbol).toUpperCase() : base.symbol,
        assetName: data?.asset_name ? String(data.asset_name) : base.assetName,
        quantity: data?.quantity != null ? String(data.quantity) : base.quantity,
        price: data?.price_per_unit != null ? String(data.price_per_unit) : base.price,
        currency: leida,
        targetPrice: target,
        tradeDate: data?.trade_date ? String(data.trade_date).slice(0, 10) : base.tradeDate,
      };
    } catch (err) {
      // La tanda no se cae por un comprobante ilegible: la fila entra marcada, para
      // corregirla a mano o descartarla.
      return {
        ...base,
        error: err instanceof Error ? err.message : "No se pudo leer el comprobante",
      };
    }
  }

  /**
   * Lee todos los comprobantes de una. En serie a propósito: son llamadas a un modelo, y
   * disparar quince en paralelo es la forma más rápida de comerse el límite de la API.
   */
  const readReceipts = async (files: File[]) => {
    if (files.length === 0) return;
    setIsReading(true);
    setProgress({ done: 0, total: files.length });
    try {
      const leidos: BatchItem[] = [];
      for (const [i, file] of files.entries()) {
        leidos.push(await readOne(file, `${Date.now()}-${i}`));
        setProgress({ done: i + 1, total: files.length });
      }
      setBatch((prev) => [...prev, ...leidos]);
      setEditingKey(null);
      setStep("review");

      const fallidos = leidos.filter((x) => x.error).length;
      if (fallidos > 0) {
        toast.warning(
          fallidos === leidos.length
            ? "No se pudo leer ningún comprobante. Revisá los datos a mano."
            : `${fallidos} de ${leidos.length} no se pudieron leer: quedaron marcados.`
        );
      }
    } finally {
      setIsReading(false);
      setProgress(null);
      if (receiptInput.current) receiptInput.current.value = "";
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
    setIsPlannedExit(false);
    setBatch([]);
    setEditingKey(null);
    defaultApplied.current = false;
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

  /** Guarda la fila editada y vuelve a la lista, sin escribir nada todavía. */
  function applyEdit() {
    const errs = validate();
    setErrors(errs);
    if (errs.length > 0) return;
    setBatch((prev) =>
      prev.map((it) =>
        it.key === editingKey ? { ...snapshot(it.key, it.fileName), error: undefined } : it
      )
    );
    setEditingKey(null);
    setStep("review");
  }

  /** Escribe una operación. Devuelve el error si falló, para no cortar la tanda entera. */
  async function insertOne(item: BatchItem): Promise<string | null> {
    try {
      await addTrade.mutateAsync({
        tradeType: item.tradeType,
        symbol: item.symbol,
        assetName: item.assetName || item.symbol,
        quantity: item.tradeType === "dividend" ? undefined : parseFloat(item.quantity),
        price: parseFloat(item.price),
        currency: item.currency,
        mepRate: item.currency === "ARS" ? mepRate : null,
        tradeDate: item.tradeDate,
        brokerId: item.brokerId === "none" ? null : item.brokerId,
        isPlannedExit: item.tradeType === "sell" ? item.isPlannedExit : undefined,
        notes: item.notes.trim() || null,
        entryThesis: item.tradeType === "buy" ? item.entryThesis.trim() || null : null,
        targetPrice:
          item.tradeType === "buy" && item.targetPrice.trim() !== ""
            ? parseFloat(item.targetPrice)
            : null,
        invalidationCondition:
          item.tradeType === "buy" ? item.invalidationCondition.trim() || null : null,
      });
      return null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "No se pudo registrar la operación.";
      return /insufficient shares/i.test(msg)
        ? "No tenés suficientes unidades registradas para vender esa cantidad."
        : msg;
    }
  }

  /**
   * Registra la tanda entera. Una que falle no arrastra a las demás: las que entraron salen
   * de la lista y las que no quedan con su motivo, así reintentar no duplica lo ya escrito.
   */
  async function handleSubmitBatch() {
    const fallidas: BatchItem[] = [];
    let ok = 0;
    for (const item of batch) {
      const error = await insertOne(item);
      if (error) fallidas.push({ ...item, error });
      else ok += 1;
    }

    if (ok > 0) {
      toast.success(ok === 1 ? "Operación registrada" : `${ok} operaciones registradas`);
    }
    if (fallidas.length > 0) {
      setBatch(fallidas);
      setErrors([
        fallidas.length === 1
          ? `No se registró ${fallidas[0].symbol}: ${fallidas[0].error}`
          : `${fallidas.length} operaciones no se registraron. Revisalas abajo.`,
      ]);
      setStep("review");
      return;
    }

    reset();
    onOpenChange(false);
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
        isPlannedExit: tradeType === "sell" ? isPlannedExit : undefined,
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
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              if (files.length > 0) readReceipts(files);
            }}
          />
          {/* La miniatura mostraba un archivo; con varios, el progreso va en la zona misma. */}
            <button
              type="button"
              onClick={() => receiptInput.current?.click()}
              disabled={isReading}
              className="group w-full rounded-xl border-2 border-dashed disabled:opacity-60 border-border/70 bg-muted/15 p-3 text-center transition-colors hover:bg-muted/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Upload className="mx-auto h-5 w-5 text-muted-foreground transition-colors group-hover:text-primary" />
              <span className="mt-1 block text-xs font-semibold">
                {isReading
                  ? `Leyendo ${progress?.done ?? 0} de ${progress?.total ?? 0}…`
                  : "Subí las capturas de tus órdenes"}
              </span>
              <span className="block text-[11px] text-muted-foreground">
                Podés elegir varias de una: compras y ventas juntas
              </span>
            </button>

          {step === "capture" && (
            <button
              type="button"
              onClick={() => setStep("form")}
              disabled={isReading}
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              {/* Con la lectura en vuelo, lo que se tipeara lo pisaba la respuesta al llegar. */}
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
                La tanda leída, en modo lectura. Se muestra para confirmar, no para completar:
                si está bien —que es lo normal— alcanza con un botón. Cada fila se puede editar
                o descartar por su cuenta, y una que no se pudo leer queda marcada en vez de
                tumbar el resto.
              */}
              <ul className="space-y-2">
                {batch.map((it) => {
                  const cant = parseFloat(it.quantity);
                  const precio = parseFloat(it.price);
                  const bruto =
                    it.tradeType === "dividend"
                      ? precio
                      : Number.isFinite(cant) && Number.isFinite(precio)
                      ? cant * precio
                      : null;
                  return (
                    <li
                      key={it.key}
                      className={`rounded-xl border p-3 ${
                        it.error ? "border-destructive/50 bg-destructive/5" : "border-border/60 bg-muted/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-sm font-semibold">
                            <span
                              className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                it.tradeType === "buy"
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : it.tradeType === "sell"
                                  ? "bg-rose-500/15 text-rose-400"
                                  : "bg-primary/15 text-primary"
                              }`}
                            >
                              {TYPE_OPTIONS.find((o) => o.value === it.tradeType)?.label ?? it.tradeType}
                            </span>
                            <span className="min-w-0 truncate">
                              {it.symbol || "—"}
                              {it.assetName ? ` · ${it.assetName}` : ""}
                            </span>
                          </p>
                          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                            {it.tradeType === "dividend" ? "" : `${it.quantity || "—"} × `}
                            {it.currency === "ARS" ? "AR$" : "US$"} {it.price || "—"}
                            {" · "}
                            {it.tradeDate.split("-").reverse().join("/")}
                          </p>
                          {it.error && (
                            <p className="mt-1.5 text-[11px] text-destructive">{it.error}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          {bruto !== null && (
                            <span className="font-mono text-sm font-bold tabular-nums">
                              {it.currency === "ARS" ? "AR$ " : "US$ "}
                              {bruto.toLocaleString("es-AR", { maximumFractionDigits: 2 })}
                            </span>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Editar ${it.symbol || it.fileName}`}
                            onClick={() => {
                              hydrate(it);
                              setEditingKey(it.key);
                              setStep("form");
                            }}
                            className="h-7 w-7 text-muted-foreground hover:bg-primary/10 hover:text-primary"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Descartar ${it.symbol || it.fileName}`}
                            onClick={() => setBatch((prev) => prev.filter((x) => x.key !== it.key))}
                            className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>

              {batch.length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Descartaste todas las operaciones.
                </p>
              )}

              {/* Editar es la salida rara; confirmar es lo que se hace casi siempre. */}
              <div className="grid grid-cols-5 gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (batch.length === 1) {
                      hydrate(batch[0]);
                      setEditingKey(batch[0].key);
                      setStep("form");
                    } else {
                      // Con varias, el 20% suma comprobantes a la misma tanda.
                      receiptInput.current?.click();
                    }
                  }}
                  disabled={addTrade.isPending || isReading}
                  className="col-span-1 h-12"
                >
                  {batch.length === 1 ? "Editar" : "Sumar"}
                </Button>
                <Button
                  onClick={handleSubmitBatch}
                  disabled={addTrade.isPending || isReading || batch.length === 0}
                  className="col-span-4 h-12 text-sm font-bold"
                >
                  {addTrade.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                  {batch.length === 1
                    ? "Confirmar y registrar"
                    : `Registrar ${batch.length} operaciones`}
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

          <div className="space-y-1">
            <Label htmlFor="trade-broker" className="text-xs">Broker (opcional)</Label>
            {brokers.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                Todavía no tenés brokers cargados. Se agregan en Ajustes y aparecen acá.
              </p>
            ) : (
            <div className="space-y-1">
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
          </div>

          {tradeType === "sell" && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-3">
              <input
                type="checkbox"
                checked={isPlannedExit}
                onChange={(e) => setIsPlannedExit(e.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span className="min-w-0">
                <span className="block text-xs font-semibold">Salida planificada</span>
                <span className="block text-[11px] text-muted-foreground">
                  La vendí en el nivel que había declarado, no por impulso. Sin esto, el Game
                  Review califica de blunder una salida por debajo de la invalidación.
                </span>
              </span>
            </label>
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
              <p className="text-xs font-semibold text-primary">Tesis previa a la compra (opcional)</p>

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
            <Button
              variant="outline"
              onClick={() => {
                if (editingKey) {
                  // Editando una fila, cancelar descarta los cambios de esa fila, no la tanda.
                  setEditingKey(null);
                  setErrors([]);
                  setStep("review");
                  return;
                }
                // El diálogo no se desmonta: sin esto, la próxima apertura mostraba el alta
                // abandonada, ya cargada y en el paso del formulario.
                reset();
                onOpenChange(false);
              }}
              disabled={addTrade.isPending}
            >
              {editingKey ? "Volver" : "Cancelar"}
            </Button>
            <Button
              onClick={editingKey ? applyEdit : handleSubmit}
              disabled={addTrade.isPending}
            >
              {addTrade.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editingKey ? "Guardar cambios" : "Registrar"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
