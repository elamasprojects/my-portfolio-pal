import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Send,
  Loader2,
  Sparkles,
  Receipt,
  FileText,
  DollarSign,
  ArrowRight,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useCategories, usePaymentMethods, useTransactions } from "@/hooks/useFinance";
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
        },
      });

      if (error) throw error;

      const extractedList = data?.transactions || [];

      if (extractedList.length === 0) {
        // Fallback: simple heuristic regex parse
        const defaultPm = paymentMethods[0]?.id;
        const defaultCat = categories[0]?.id;

        // Try extracting numbers (e.g. "Coto 45000" or "Uber 15 usd")
        const numMatch = inputVal.match(/(\d+[\d\s.,]*)/);
        const rawAmount = numMatch ? parseFloat(numMatch[1].replace(/\s/g, "").replace(",", ".")) : 0;
        const isARS = !inputVal.toLowerCase().includes("usd") && rawAmount > 500;
        const amountUSD = isARS && mepRate && mepRate > 0 ? rawAmount / mepRate : rawAmount;

        if (rawAmount > 0 && defaultPm) {
          await addTransaction.mutateAsync({
            name: inputVal.replace(/(\d+[\d\s.,]*)/, "").trim() || "Gasto",
            amount_usd: amountUSD,
            original_amount: rawAmount,
            original_currency: isARS ? "ARS" : "USD",
            fx_rate: isARS ? mepRate : 1,
            payment_method_id: defaultPm,
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

        // Match payment method
        let matchedPm = paymentMethods.find(
          (pm) => pm.name.toLowerCase() === item.payment_method_name?.toLowerCase()
        );
        if (!matchedPm) {
          matchedPm = paymentMethods[0];
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
          payment_method_id: matchedPm?.id || paymentMethods[0]?.id,
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
      <DialogContent className="max-w-md bg-card p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-serif text-lg text-primary">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <span>Ingesta Rápida de Finanzas</span>
          </DialogTitle>
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

          {/* Screenshot Drop / Upload Zone */}
          {previewUrl ? (
            <div className="relative rounded-xl border bg-muted/40 p-2 text-center">
              <img
                src={previewUrl}
                alt="Comprobante"
                className="max-h-36 mx-auto rounded-lg object-contain shadow-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs text-destructive hover:bg-destructive/10"
                onClick={handleClearFile}
              >
                Eliminar imagen
              </Button>
            </div>
          ) : (
            <div
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer rounded-xl border border-dashed border-border/70 bg-muted/20 p-4 text-center hover:bg-accent/20 transition-colors"
            >
              <Upload className="mx-auto h-6 w-6 text-muted-foreground" />
              <p className="mt-1 text-xs font-medium text-foreground">
                Sube o arrastra una captura de comprobante
              </p>
              <p className="text-[10px] text-muted-foreground">
                Mercado Pago, DolarApp, Banco Ciudad, etc.
              </p>
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
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold flex items-center justify-center gap-2"
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
