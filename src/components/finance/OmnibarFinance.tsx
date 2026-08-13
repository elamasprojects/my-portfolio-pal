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
  Sparkles,
  ClipboardPaste,
  Image as ImageIcon,
  Trash2,
  Plus,
} from "lucide-react";
import { useFinancialAccounts, useCategories, usePaymentMethods, useTransactions } from "@/hooks/useFinance";
import { useDolarMEP } from "@/hooks/useDolarMEP";
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync initial props when opened
  useEffect(() => {
    if (open) {
      if (initialText) setInputVal(initialText);
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
  const { mepRate } = useDolarMEP();

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
        const amountUSD = isARS && mepRate && mepRate > 0 ? rawAmount / mepRate : rawAmount;

        if (rawAmount > 0) {
          await addTransaction.mutateAsync({
            name: inputVal.replace(/(\d+[\d\s.,]*)/, "").trim() || "Gasto",
            amount_usd: amountUSD,
            original_amount: rawAmount,
            original_currency: isARS ? "ARS" : "USD",
            fx_rate: isARS ? mepRate : 1,
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

      // 2. Persist all extracted transactions
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
        if (!matchedAccount) {
          matchedAccount = accounts[0];
        }

        const isARS = item.currency === "ARS";
        const rate = isARS && mepRate && mepRate > 0 ? mepRate : 1;
        const finalAmountUSD =
          item.amount_usd || (isARS ? item.amount / rate : item.amount);

        await addTransaction.mutateAsync({
          name: item.name || "Gasto",
          raw_merchant: item.raw_merchant || item.name,
          amount_usd: Number(finalAmountUSD.toFixed(2)),
          type: item.type || "expense",
          transaction_date: item.transaction_date || new Date().toISOString().split("T")[0],
          original_amount: item.amount,
          original_currency: item.currency || "USD",
          fx_rate: rate,
          fx_source: isARS ? "dolarapi_mep" : "native_usd",
          category_id: matchedCat?.id || null,
          account_id: matchedAccount?.id || null,
          payment_method_id: matchedPm?.id || paymentMethods[0]?.id || null,
          confidence: item.confidence || "high",
          needs_review: item.needs_review || !matchedCat,
          source: selectedFile ? "screenshot" : "text",
          notes: item.suggested_new_category
            ? `Sugerencia: Crear categoría '${item.suggested_new_category}'`
            : undefined,
        });
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
      <DialogContent className="max-w-md bg-card p-4 sm:p-6 shadow-2xl border border-border/60">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between font-serif text-lg text-primary">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              <span>Ingesta Rápida de Finanzas</span>
            </div>
            <span className="text-[10px] font-mono text-muted-foreground bg-muted px-2 py-0.5 rounded border">
              ⌘K / Ctrl+K
            </span>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Ingesta rápida de comprobantes, gastos e ingresos con IA
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Text input with audio recorder */}
          <div className="flex items-center gap-2">
            <Input
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
              className="flex-1 font-mono text-sm"
              autoFocus
            />
            <AudioQuickRecorder onRecordedText={(txt) => setInputVal((prev) => `${prev} ${txt}`.trim())} />
          </div>

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

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Quick Preset Buttons */}
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-[11px] text-muted-foreground mr-1 self-center">Presets:</span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs rounded-full px-2.5 font-mono"
              onClick={() => setInputVal("Supermercado 35000")}
            >
              🛒 Super 35k
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs rounded-full px-2.5 font-mono"
              onClick={() => setInputVal("Cena 25 usd DolarApp")}
            >
              🍔 Cena $25
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs rounded-full px-2.5 font-mono"
              onClick={() => setInputVal("Uber 8500")}
            >
              🚗 Uber $8.5k
            </Button>
          </div>

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
