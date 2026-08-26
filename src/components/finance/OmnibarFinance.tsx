import { useState, useRef, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Send,
  Loader2,
  ClipboardPaste,
  Image as ImageIcon,
  Trash2,
  Plus,
  Keyboard,
} from "lucide-react";
import { useFinancialAccounts, useCategories, usePaymentMethods, useTransactions } from "@/hooks/useFinance";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { resolveTransactionAmountUSD } from "@/lib/fxConversion";
import { supabase } from "@/integrations/supabase/client";
import { AudioQuickRecorder } from "@/components/finance/AudioQuickRecorder";
import { toast } from "sonner";

interface OmnibarFinanceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialText?: string;
  initialFile?: File | null;
}

export function OmnibarFinance({
  open,
  onOpenChange,
  initialText,
  initialFile,
}: OmnibarFinanceProps) {
  const [inputVal, setInputVal] = useState(initialText || "");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(initialFile || null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // The typing field is opt-in: tapping the keyboard button reveals it. Kept collapsed by
  // default so the sheet opens on the capture zone instead of on a keyboard.
  const [showTextInput, setShowTextInput] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial props when opened
  useEffect(() => {
    if (open) {
      if (initialText) {
        setInputVal(initialText);
        setShowTextInput(true);
      }
      if (initialFile) {
        setSelectedFile(initialFile);
        setPreviewUrl(URL.createObjectURL(initialFile));
      }
    }
  }, [open, initialText, initialFile]);

  // 1. Listen for global Paste (Ctrl+V / Cmd+V) when modal is open
  useEffect(() => {
    if (!open) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.startsWith("image/")) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            setSelectedFile(file);
            const url = URL.createObjectURL(file);
            setPreviewUrl(url);
            toast.success("✓ Captura pegada desde el portapapeles (Ctrl+V)");
          }
          break;
        }
      }
    };

    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("paste", handlePaste);
    };
  }, [open]);

  const { accounts } = useFinancialAccounts();
  const { categories } = useCategories();
  const { paymentMethods } = usePaymentMethods();
  const { addTransaction } = useTransactions();
  // useDolarMEP exposes the rate as `venta`; destructuring `mepRate` yielded undefined, so
  // an ARS amount skipped conversion and was stored as if it were dollars.
  const { venta: mepRate = 0 } = useDolarMEP();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  };

  // 2. 1-Tap Paste Button Handler for Mobile & Desktop
  const handlePasteFromClipboardButton = async () => {
    try {
      if (!navigator.clipboard?.read) {
        // Fallback if browser doesn't expose clipboard.read()
        const text = await navigator.clipboard?.readText?.();
        if (text?.trim()) {
          setInputVal((prev) => `${prev} ${text}`.trim());
          toast.success("Texto pegado desde el portapapeles");
        } else {
          toast.info("Usa Ctrl+V para pegar directamente tu captura");
        }
        return;
      }

      const clipboardItems = await navigator.clipboard.read();
      let foundImage = false;

      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith("image/"));
        if (imageType) {
          const blob = await item.getType(imageType);
          const file = new File([blob], `comprobante_${Date.now()}.png`, { type: imageType });
          setSelectedFile(file);
          const url = URL.createObjectURL(file);
          setPreviewUrl(url);
          foundImage = true;
          toast.success("✓ Captura pegada desde el portapapeles");
          break;
        }
      }

      if (!foundImage) {
        const text = await navigator.clipboard.readText();
        if (text?.trim()) {
          setInputVal((prev) => `${prev} ${text}`.trim());
          toast.success("Texto pegado desde el portapapeles");
        } else {
          toast.error("No se encontró ninguna imagen en el portapapeles. Copia una captura primero.");
        }
      }
    } catch (err: any) {
      console.warn("Clipboard read error:", err);
      toast.info("Presiona Ctrl+V o mantén presionado para pegar la captura");
    }
  };

  const parseAndSubmit = async () => {
    if (!inputVal.trim() && !selectedFile) {
      toast.error("Ingresa un texto o sube un comprobante");
      return;
    }

    setIsLoading(true);

    try {
      let imageBase64: string | null = null;
      if (selectedFile) {
        imageBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(selectedFile);
        });
      }

      // 1. Call AI Extractor Edge Function
      const { data, error } = await supabase.functions.invoke("extract-finance-input", {
        body: {
          text: inputVal.trim() || undefined,
          image: imageBase64 || undefined,
          userCategories: categories,
          userPaymentMethods: paymentMethods,
          userAccounts: accounts,
        },
      });

      if (error) throw error;

      const extractedList = data?.transactions || [];

      if (extractedList.length === 0) {
        // Fallback: simple heuristic regex parse
        const defaultAcc = accounts[0]?.id;
        const defaultPm = paymentMethods[0]?.id;
        const defaultCat = categories[0]?.id;

        // Try extracting numbers (e.g. "Coto 45000" or "Uber 15 usd")
        const numMatch = inputVal.match(/(\d+[\d\s.,]*)/);
        const rawAmount = numMatch ? parseFloat(numMatch[1].replace(/\s/g, "").replace(",", ".")) : 0;
        const isARS = !inputVal.toLowerCase().includes("usd") && rawAmount > 500;
        const converted = resolveTransactionAmountUSD({
          amount: rawAmount,
          currency: isARS ? "ARS" : "USD",
          arsPerUsd: mepRate,
        });

        if (rawAmount > 0 && converted.status !== "ok") {
          toast.error(converted.reason);
          return;
        }

        if (rawAmount > 0 && converted.status === "ok") {
          await addTransaction.mutateAsync({
            name: inputVal.replace(/(\d+[\d\s.,]*)/, "").trim() || "Gasto",
            amount_usd: converted.amountUSD,
            original_amount: rawAmount,
            original_currency: isARS ? "ARS" : "USD",
            fx_rate: converted.fxRate,
            fx_source: converted.fxSource,
            account_id: defaultAcc || null,
            payment_method_id: defaultPm || null,
            category_id: defaultCat || null,
            confidence: "medium",
            needs_review: true,
            source: selectedFile ? "screenshot" : "text",
          });
          setInputVal("");
          handleClearFile();
          onOpenChange(false);
          return;
        } else {
          toast.error("No se detectó monto válido. Intenta con 'Comercio 15000'");
          return;
        }
      }

      // 2. Persist all extracted transactions.
      // Anything we cannot convert is collected and surfaced instead of being written at face
      // value — a peso amount landing in a dollar column is invisible once it is stored.
      const skipped: string[] = [];

      for (const item of extractedList) {
        // Match category
        let matchedCat = categories.find(
          (c) => c.name.toLowerCase() === item.category_name?.toLowerCase()
        );
        if (!matchedCat && item.category_name) {
          matchedCat = categories.find((c) =>
            (c.keywords || []).some((kw) => item.name?.toLowerCase().includes(kw.toLowerCase()))
          );
        }

        // Match account directly or via payment method
        let matchedAccount = accounts.find(
          (acc) =>
            acc.name.toLowerCase() === (item.account_name || "").toLowerCase() ||
            acc.name.toLowerCase() === (item.payment_method_name || "").toLowerCase() ||
            (acc.detection_patterns || []).some(
              (p) =>
                (item.name || "").toLowerCase().includes(p.toLowerCase()) ||
                (item.payment_method_name || "").toLowerCase().includes(p.toLowerCase())
            )
        );

        let matchedPm = paymentMethods.find(
          (pm) => pm.name.toLowerCase() === item.payment_method_name?.toLowerCase()
        );

        if (!matchedAccount && matchedPm?.account_id) {
          matchedAccount = accounts.find((a) => a.id === matchedPm!.account_id);
        }

        // Falling back to the first account is a guess, and the balance trigger acts on it: an
        // Edesur bill paid from Mercado Pago was debited from the ARQ broker account without a
        // word. The guess still happens — leaving the account empty would strand the row — but
        // it is flagged for review instead of passing as a matched account.
        const accountWasGuessed = !matchedAccount;
        if (!matchedAccount) {
          matchedAccount = accounts[0];
        }

        // The rate we actually hold decides the amount. `item.amount_usd` is the extractor's
        // own estimate and used to take precedence over this conversion.
        const converted = resolveTransactionAmountUSD({
          amount: item.amount,
          currency: item.currency,
          arsPerUsd: mepRate,
        });

        if (converted.status !== "ok") {
          skipped.push(`${item.name || "Gasto"}: ${converted.reason}`);
          continue;
        }

        await addTransaction.mutateAsync({
          name: item.name || "Gasto",
          raw_merchant: item.raw_merchant || item.name,
          amount_usd: converted.amountUSD,
          type: item.type || "expense",
          transaction_date: item.transaction_date || new Date().toISOString().split("T")[0],
          original_amount: item.amount,
          original_currency: (item.currency || "USD").toUpperCase(),
          fx_rate: converted.fxRate,
          fx_source: converted.fxSource,
          category_id: matchedCat?.id || null,
          account_id: matchedAccount?.id || null,
          payment_method_id: matchedPm?.id || paymentMethods[0]?.id || null,
          confidence: item.confidence || "high",
          needs_review: item.needs_review || !matchedCat || accountWasGuessed,
          source: selectedFile ? "screenshot" : "text",
          notes: item.suggested_new_category
            ? `Sugerencia: Crear categoría '${item.suggested_new_category}'`
            : undefined,
        });
      }

      if (skipped.length > 0) {
        toast.error(
          skipped.length === 1
            ? `No se registró ${skipped[0]}`
            : `No se registraron ${skipped.length} movimientos: ${skipped.join(" · ")}`,
          { duration: 8000 }
        );
        // Keep the input and the receipt on screen so the capture can be retried once a rate
        // is available, rather than silently losing it.
        return;
      }

      setInputVal("");
      handleClearFile();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Error al procesar la entrada");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md rounded-2xl bg-card p-4 sm:p-6 shadow-2xl border border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 font-serif text-lg text-primary">
            <span className="min-w-0 truncate">Ingesta Rápida de Finanzas</span>
            <span className="hidden sm:inline-block shrink-0 text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border">
              ⌘K / Ctrl+K
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Ingesta rápida de comprobantes, gastos e ingresos con IA
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/*
            Upload first, typing second. Opening this sheet used to focus the text field and
            autoFocus popped the on-screen keyboard immediately, burying the capture zone —
            and a receipt screenshot is the faster path for almost every entry.
          */}
          {/* Screenshot Drop / Upload / Paste Zone */}
          {previewUrl ? (
            <div className="relative rounded-2xl border bg-muted/40 p-3 text-center space-y-2">
              <div className="relative inline-block">
                <img
                  src={previewUrl}
                  alt="Comprobante pegado"
                  className="max-h-40 mx-auto rounded-xl object-contain shadow-md border"
                />
                <button
                  type="button"
                  onClick={handleClearFile}
                  className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground p-1 rounded-full shadow hover:bg-destructive/90 transition-transform active:scale-95"
                  title="Quitar comprobante"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[11px] text-emerald-400 font-mono font-medium">
                ✓ Comprobante listo para procesar con IA
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer rounded-2xl border-2 border-dashed border-border/70 bg-muted/15 p-4 text-center hover:bg-muted/30 transition-all group"
              >
                <Upload className="mx-auto h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                <p className="mt-1 text-xs font-semibold text-foreground">
                  Arrastra o sube una captura de comprobante
                </p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">
                  Mercado Pago, DolarApp, Banco Ciudad, etc.
                </p>
              </div>

              {/* 1-Tap Paste from Clipboard button */}
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handlePasteFromClipboardButton}
                  className="w-full h-8 text-xs font-semibold gap-1.5 border-primary/30 bg-primary/5 hover:bg-primary/15 text-primary shadow-sm"
                >
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  <span>Pegar captura del Portapapeles</span>
                  <span className="hidden sm:inline text-[10px] font-mono opacity-75 font-normal">
                    (o presiona Ctrl+V)
                  </span>
                </Button>
              </div>
            </div>
          )}

          {/* Two ways in besides the receipt, as equal-weight round buttons: type, or dictate. */}
          <div className="flex items-center justify-center gap-2">
            <Button
              type="button"
              variant={showTextInput ? "default" : "outline"}
              size="icon"
              onClick={() => setShowTextInput((v) => !v)}
              aria-expanded={showTextInput}
              aria-controls="omnibar-text-input"
              aria-label={showTextInput ? "Ocultar el campo de texto" : "Escribir el movimiento"}
              title={showTextInput ? "Ocultar el campo de texto" : "Escribir el movimiento"}
              className="h-10 w-10 shrink-0 rounded-full"
            >
              <Keyboard className="h-4 w-4" />
            </Button>
            <AudioQuickRecorder onRecordedText={(txt) => {
              setShowTextInput(true);
              setInputVal((prev) => `${prev} ${txt}`.trim());
            }} />
          </div>

          {showTextInput && (
            <Input
              id="omnibar-text-input"
              placeholder="Ej: 'Coto 45000', 'Uber 12 usd DolarApp'..."
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  parseAndSubmit();
                }
              }}
              disabled={isLoading}
              // Focusing here is deliberate: the keyboard appears because the user asked for it.
              autoFocus
              className="w-full font-mono text-sm"
            />
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Submit Action */}
          <Button
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2 shadow-md h-10"
            onClick={parseAndSubmit}
            disabled={isLoading || (!inputVal.trim() && !selectedFile)}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Extrayendo con IA...</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                <span>Registrar Transacción</span>
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Natural Language Parser for Omnibar Finance Input (R1)
 */
export function parseOmnibarInput(input: string): { amountARS: number; category: string; cleanText: string } {
  // Strip emojis and unescaped quotes
  const cleanText = input.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}'"]/gu, '').trim();

  // Extract monetary amount: matches $15.500,50 or $15500.50 or 4500
  const match = cleanText.match(/\$?\s*([\d\.,]+)/);
  let amountARS = 0;
  if (match) {
    let rawNum = match[1];
    if (rawNum.includes('.') && rawNum.includes(',')) {
      // Argentine format 15.500,50 -> 15500.50
      rawNum = rawNum.replace(/\./g, '').replace(',', '.');
    } else if (rawNum.includes(',') && !rawNum.includes('.')) {
      rawNum = rawNum.replace(',', '.');
    }
    amountARS = parseFloat(rawNum) || 0;
  }

  let category = 'Otros';
  const lower = cleanText.toLowerCase();
  if (lower.includes('supermercado') || lower.includes('coto') || lower.includes('comida') || lower.includes('almuerzo')) {
    category = 'Comida';
  } else if (lower.includes('paypal') || lower.includes('servicio')) {
    category = 'Servicios';
  }

  return { amountARS, category, cleanText };
}

