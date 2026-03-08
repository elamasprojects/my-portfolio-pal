import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActivePortfolio, useTrades, computeHoldings, Holding } from "@/hooks/usePortfolio";
import { useAssignTag } from "@/hooks/useTags";
import { TagPicker } from "@/components/TagPicker";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { toast } from "sonner";
import { Search, Tag, TrendingUp, Plus, Loader2, CheckCircle2, RotateCcw, ArrowDownLeft, ArrowUpRight, Banknote, PenLine, Camera, Upload, Info } from "lucide-react";
import confetti from "canvas-confetti";
import tradeScreenshotExample from "@/assets/trade-screenshot-example.jpg";

interface SubmittedTrade {
  symbol: string;
  assetName: string;
  tradeType: string;
  quantity: number;
  price: number;
  total: number;
  tradeDate: string;
  notes: string;
}

const AddTrade = () => {
  const { user } = useAuth();
  const { portfolio } = useActivePortfolio();
  const { data: trades } = useTrades();
  const queryClient = useQueryClient();
  const assignTag = useAssignTag();
  const { t } = useLanguage();

  const [entryMode, setEntryMode] = useState<"" | "manual" | "screenshot">("");
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fromScreenshotRef = useRef(false);
  const userEditedPrice = useRef(false);
  const userEditedName = useRef(false);

  const [tradeType, setTradeType] = useState<string>("");
  const [symbol, setSymbol] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<string>("stock");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const [inputMode, setInputMode] = useState<"shares" | "amount">("amount");
  const [amount, setAmount] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [submittedTrade, setSubmittedTrade] = useState<SubmittedTrade | null>(null);
  const [selectedHolding, setSelectedHolding] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Dividend-specific
  const [dividendAmount, setDividendAmount] = useState("");

  // Image analysis handler
  const handleImageUpload = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      setImagePreview(base64);
      setAnalyzingImage(true);

      try {
        const { data, error } = await supabase.functions.invoke("analyze-trade-image", {
          body: { image: base64 },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        // Auto-populate fields
        if (data.trade_type) setTradeType(data.trade_type);
        if (data.symbol) setSymbol(data.symbol.toUpperCase());
        if (data.asset_name) setAssetName(data.asset_name);
        if (data.asset_type) setAssetType(data.asset_type);
        if (data.quantity) setQuantity(String(data.quantity));
        if (data.price_per_unit) setPrice(String(data.price_per_unit));
        if (data.trade_date) setTradeDate(data.trade_date);

        // Auto-populate amount from quantity * price
        if (data.quantity && data.price_per_unit) {
          setAmount(String((data.quantity * data.price_per_unit).toFixed(2)));
        }

        // Mark as from screenshot so quote fetch only updates asset name
        fromScreenshotRef.current = true;
        // Switch to manual mode for review
        setEntryMode("manual");
        toast.success("Trade data extracted! Review and submit.");
      } catch (err: any) {
        console.error("Image analysis error:", err);
        toast.error(err.message || t("addTrade.analyzeError"));
      } finally {
        setAnalyzingImage(false);
      }
    };
    reader.readAsDataURL(file);
  }, [t]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
  }, [handleImageUpload]);

  // URL params pre-fill (for duplicate trade)
  const [searchParams, setSearchParams] = useSearchParams();
  const prefillApplied = useRef(false);
  useEffect(() => {
    if (prefillApplied.current) return;
    const pSymbol = searchParams.get("symbol");
    if (!pSymbol) return;
    prefillApplied.current = true;
    const pType = searchParams.get("type") || "buy";
    setTradeType(pType);
    setSymbol(pSymbol);
    setAssetName(searchParams.get("name") || "");
    setAssetType(searchParams.get("asset") || "stock");
    setPrice(searchParams.get("price") || "");
    setNotes(searchParams.get("notes") || "");
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const holdings = useMemo(() => {
    if (!trades) return [];
    return computeHoldings(trades);
  }, [trades]);

  const symbolResolved = tradeType === "dividend"
    ? selectedHolding !== ""
    : assetName.trim() !== "" && price.trim() !== "";

  const availableShares = useMemo(() => {
    if (tradeType !== "sell" || !selectedHolding) return 0;
    const h = holdings.find((h) => h.symbol === selectedHolding);
    return h ? h.net_quantity : 0;
  }, [tradeType, selectedHolding, holdings]);

  const computedQuantity =
    tradeType === "dividend"
      ? 1
      : inputMode === "amount" && parseFloat(price) > 0 && parseFloat(amount) > 0
      ? parseFloat(amount) / parseFloat(price)
      : parseFloat(quantity || "0");

  const total =
    tradeType === "dividend"
      ? parseFloat(dividendAmount || "0")
      : computedQuantity * parseFloat(price || "0");

  // Auto-fetch quote when symbol changes (buy mode)
  useEffect(() => {
    if (tradeType !== "buy") return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!symbol.trim()) return;

    debounceRef.current = setTimeout(async () => {
      setFetchingQuote(true);
      try {
        const { data, error } = await supabase.functions.invoke("fetch-quote", {
          body: { symbol: symbol.trim() },
        });
        if (!error && data) {
          // If data came from screenshot, only update asset name — preserve AI-extracted price/date
          if (fromScreenshotRef.current) {
            if (data.name && !userEditedName.current) setAssetName(data.name);
            fromScreenshotRef.current = false;
          } else {
            if (data.price > 0 && !userEditedPrice.current) setPrice(String(data.price));
            if (data.name && !userEditedName.current) setAssetName(data.name);
          }
        }
      } catch {
      } finally {
        setFetchingQuote(false);
      }
    }, 500);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [symbol, tradeType]);

  const handleHoldingSelect = async (sym: string) => {
    setSelectedHolding(sym);
    const h = holdings.find((h) => h.symbol === sym);
    if (!h) return;

    setSymbol(h.symbol);
    setAssetName(h.asset_name);
    setAssetType(h.asset_type);

    if (tradeType === "dividend") return; // No price needed for dividends

    setPrice(String(h.avg_cost));

    setFetchingQuote(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-quote", {
        body: { symbol: sym },
      });
      if (!error && data) {
        if (data.price > 0 && !userEditedPrice.current) setPrice(String(data.price));
        if (data.name && !userEditedName.current) setAssetName(data.name);
      }
    } catch {
    } finally {
      setFetchingQuote(false);
    }
  };

  const fireConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#d4a843", "#f5e6c8", "#c0c0c0", "#b8860b", "#e8d5a3"],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !portfolio) return;

    let finalQuantity: number;
    let finalPrice: number;
    let finalTotal: number;

    if (tradeType === "dividend") {
      finalQuantity = 1;
      finalPrice = parseFloat(dividendAmount);
      finalTotal = finalPrice;
      if (isNaN(finalPrice) || finalPrice <= 0) {
        toast.error(t("addTrade.validDividend"));
        return;
      }
    } else {
      finalQuantity =
        inputMode === "amount" && parseFloat(price) > 0
          ? parseFloat(amount) / parseFloat(price)
          : parseFloat(quantity);
      finalPrice = parseFloat(price);
      finalTotal = finalQuantity * finalPrice;

      if (tradeType === "sell" && finalQuantity > availableShares) {
        toast.error(t("addTrade.notEnoughShares", { shares: availableShares.toFixed(4) }));
        return;
      }
    }

    setSubmitting(true);
    try {
      const { data: insertedTrade, error } = await supabase.from("trades").insert({
        portfolio_id: portfolio.id,
        user_id: user.id,
        symbol: symbol.toUpperCase(),
        asset_name: assetName,
        asset_type: assetType as any,
        trade_type: tradeType as any,
        quantity: finalQuantity,
        price_per_unit: finalPrice,
        
        trade_date: new Date(tradeDate).toISOString(),
        notes: notes || null,
      }).select("id").single();

      if (error) throw error;

      // Assign tags
      if (insertedTrade && selectedTagIds.length > 0) {
        await Promise.all(
          selectedTagIds.map((tagId) =>
            assignTag.mutateAsync({ tradeId: insertedTrade.id, tagId })
          )
        );
      }

      queryClient.invalidateQueries({ queryKey: ["trades"] });

      setSubmittedTrade({
        symbol: symbol.toUpperCase(),
        assetName,
        tradeType,
        quantity: finalQuantity,
        price: finalPrice,
        total: finalTotal,
        tradeDate,
        notes,
      });

      setTimeout(() => {
        setFlipped(true);
        fireConfetti();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddAnother = () => {
    setFlipped(false);
    setTimeout(() => {
      setEntryMode("");
      setTradeType("");
      setSymbol("");
      setAssetName("");
      setQuantity("");
      setPrice("");
      setAmount("");
      setNotes("");
      setTradeDate(new Date().toISOString().split("T")[0]);
      setInputMode("amount");
      setSelectedHolding("");
      setSubmittedTrade(null);
      setSelectedTagIds([]);
      setDividendAmount("");
      setImagePreview(null);
      userEditedPrice.current = false;
      userEditedName.current = false;
    }, 600);
  };

  const resetFields = () => {
    setSymbol("");
    setAssetName("");
    setAssetType("stock");
    setQuantity("");
    setPrice("");
    setAmount("");
    setNotes("");
    setSelectedHolding("");
    setInputMode("amount");
    setSelectedTagIds([]);
    setDividendAmount("");
  };

  const handleMaxQuantity = () => {
    if (inputMode === "shares") {
      setQuantity(String(availableShares));
    } else if (parseFloat(price) > 0) {
      setAmount(String((availableShares * parseFloat(price)).toFixed(2)));
    }
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const tradeTypeSelected = tradeType === "buy" || tradeType === "sell" || tradeType === "dividend";
  const canSell = holdings.length > 0;
  const canDividend = holdings.length > 0;

  return (
    <div className={`max-w-lg mx-auto transition-all duration-700 ${flipped ? "py-8" : ""}`}>
      <div className="mb-6">
        <h1 className="text-2xl chess-title">{t("addTrade.title")}</h1>
        <p className="text-muted-foreground text-sm">{t("addTrade.subtitle")}</p>
      </div>

      {/* 3D Flip Container */}
      <div className="relative" style={{ perspective: "1200px" }}>
        <div
          className="relative w-full transition-transform duration-700"
          style={{
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* ===== FRONT: Form ===== */}
          <div className="w-full" style={{ backfaceVisibility: "hidden" }}>
            <Card className="border-border/50 overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">{t("addTrade.newTrade")}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-0">
                  {/* Entry Mode Selector */}
                  {entryMode === "" && (
                    <div className="space-y-3 mb-5">
                      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("addTrade.inputMethod")}</span>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => setEntryMode("manual")}
                          className="flex-1 h-20 rounded-xl text-sm font-semibold transition-all flex flex-col items-center justify-center gap-1.5 border-2 border-border bg-card hover:border-primary/50 text-foreground"
                        >
                          <PenLine className="h-5 w-5 text-primary" />
                          {t("addTrade.inputManual")}
                        </button>
                        <div className="flex-1 relative">
                          <button
                            type="button"
                            onClick={() => setEntryMode("screenshot")}
                            className="w-full h-20 rounded-xl text-sm font-semibold transition-all flex flex-col items-center justify-center gap-1.5 border-2 border-border bg-card hover:border-primary/50 text-foreground"
                          >
                            <Camera className="h-5 w-5 text-primary" />
                            {t("addTrade.inputScreenshot")}
                          </button>
                          <HoverCard openDelay={200}>
                            <HoverCardTrigger asChild>
                              <button type="button" className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors">
                                <Info className="h-3 w-3 text-muted-foreground" />
                              </button>
                            </HoverCardTrigger>
                            <HoverCardContent className="w-[50vw] max-w-lg" side="top">
                              <div className="space-y-2">
                                <p className="text-xs text-muted-foreground">
                                  {t("addTrade.tooltipHint")}
                                </p>
                                <img
                                  src={tradeScreenshotExample}
                                  alt="Trade screenshot example"
                                  className="rounded-md border border-border w-full"
                                />
                              </div>
                            </HoverCardContent>
                          </HoverCard>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Screenshot Upload */}
                  {entryMode === "screenshot" && (
                    <div className="space-y-3 mb-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("addTrade.uploadScreenshot")}</span>
                        <HoverCard openDelay={200}>
                          <HoverCardTrigger asChild>
                            <button type="button" className="h-5 w-5 rounded-full bg-muted flex items-center justify-center hover:bg-accent transition-colors">
                              <Info className="h-3 w-3 text-muted-foreground" />
                            </button>
                          </HoverCardTrigger>
                          <HoverCardContent className="w-[50vw] max-w-lg" side="top">
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground">
                                {t("addTrade.tooltipHint")}
                              </p>
                              <img
                                src={tradeScreenshotExample}
                                alt="Trade screenshot example"
                                className="rounded-md border border-border w-full"
                              />
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </div>
                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                          analyzingImage
                            ? "border-primary/50 bg-primary/5"
                            : "border-border hover:border-primary/40 hover:bg-accent/30"
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleFileChange}
                        />
                        {analyzingImage ? (
                          <>
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm font-medium text-primary">{t("addTrade.analyzing")}</p>
                          </>
                        ) : imagePreview ? (
                          <img src={imagePreview} alt="Uploaded" className="max-h-40 rounded-md" />
                        ) : (
                          <>
                            <Upload className="h-8 w-8 text-muted-foreground" />
                            <p className="text-sm font-medium text-foreground">{t("addTrade.dropImage")}</p>
                            <p className="text-xs text-muted-foreground">{t("addTrade.supportedFormats")}</p>
                          </>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEntryMode("");
                          setImagePreview(null);
                        }}
                        className="text-xs text-muted-foreground"
                      >
                        {t("addTrade.backToInput")}
                      </Button>
                    </div>
                  )}

                  {/* Step 1: Trade Type */}
                  {entryMode === "manual" && (<>
                  <div className="space-y-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("addTrade.opening")}</span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setTradeType("buy");
                          resetFields();
                        }}
                        className={`flex-1 h-14 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 border-2 ${
                          tradeType === "buy"
                            ? "border-gain bg-gain/10 text-gain shadow-md"
                            : "border-border bg-card hover:border-gain/50 text-foreground"
                        }`}
                      >
                        <ArrowDownLeft className="h-4 w-4" />
                        {t("addTrade.buy")}
                      </button>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                if (!canSell) return;
                                setTradeType("sell");
                                resetFields();
                              }}
                              className={`flex-1 h-14 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 border-2 ${
                                !canSell
                                  ? "border-border bg-card opacity-40 cursor-not-allowed text-muted-foreground"
                                  : tradeType === "sell"
                                  ? "border-loss bg-loss/10 text-loss shadow-md"
                                  : "border-border bg-card hover:border-loss/50 text-foreground"
                              }`}
                            >
                              <ArrowUpRight className="h-4 w-4" />
                              {t("addTrade.sell")}
                            </button>
                          </TooltipTrigger>
                          {!canSell && (
                            <TooltipContent>
                              <p>{t("addTrade.addBuyFirst")}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => {
                                if (!canDividend) return;
                                setTradeType("dividend");
                                resetFields();
                              }}
                              className={`flex-1 h-14 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 border-2 ${
                                !canDividend
                                  ? "border-border bg-card opacity-40 cursor-not-allowed text-muted-foreground"
                                  : tradeType === "dividend"
                                  ? "border-primary bg-primary/10 text-primary shadow-md"
                                  : "border-border bg-card hover:border-primary/50 text-foreground"
                              }`}
                            >
                              <Banknote className="h-4 w-4" />
                              {t("addTrade.dividend")}
                            </button>
                          </TooltipTrigger>
                          {!canDividend && (
                            <TooltipContent>
                              <p>{t("addTrade.addBuyFirst")}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* Step 2: Symbol / Holdings Picker */}
                  {tradeTypeSelected && (
                    <>
                      <Separator className="my-5" />
                      <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("addTrade.position")}</span>
                        {tradeType === "buy" ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Search className="h-4 w-4 text-primary" />
                              <span className="text-sm font-bold">{t("addTrade.symbolLookup")}</span>
                              {fetchingQuote && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                            </div>
                            <Input
                              placeholder="AAPL, BTC, MSFT..."
                              value={symbol}
                              onChange={(e) => setSymbol(e.target.value)}
                              className="font-mono uppercase"
                              required
                            />
                            {symbolResolved && (
                              <p className="text-xs text-muted-foreground">
                                {t("addTrade.found")}: <span className="font-medium text-foreground">{assetName}</span> — $
                                {parseFloat(price).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <Search className="h-4 w-4 text-primary" />
                              <span className="text-sm font-bold">
                                {tradeType === "dividend" ? t("addTrade.selectAsset") : t("addTrade.selectAssetToSell")}
                              </span>
                              {fetchingQuote && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                            </div>
                            <Select value={selectedHolding} onValueChange={handleHoldingSelect}>
                              <SelectTrigger>
                                <SelectValue placeholder={t("addTrade.chooseAsset")} />
                              </SelectTrigger>
                              <SelectContent>
                                {holdings.map((h) => (
                                  <SelectItem key={h.symbol} value={h.symbol}>
                                    {h.symbol} — {h.asset_name} ({h.net_quantity.toFixed(2)} {t("common.shares")})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {tradeType === "sell" && selectedHolding && symbolResolved && (
                              <p className="text-xs text-muted-foreground">
                                {t("addTrade.currentPrice")}: <span className="font-medium text-foreground">${parseFloat(price).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                {" · "}{availableShares.toFixed(2)} {t("addTrade.sharesAvailable")}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}

                  {/* Step 3: Asset Details (buy only) + Trade Details */}
                  {tradeTypeSelected && symbolResolved && (
                    <>
                      {tradeType === "buy" && (
                        <>
                          <Separator className="my-5" />
                          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("addTrade.execute")}</span>
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4 text-primary" />
                              <span className="text-sm font-bold">{t("addTrade.assetDetails")}</span>
                            </div>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <Label htmlFor="assetName" className="text-xs text-muted-foreground">
                                  {t("addTrade.assetName")}
                                </Label>
                                <Input
                                  id="assetName"
                                  placeholder="Apple Inc."
                                  value={assetName}
                                  onChange={(e) => setAssetName(e.target.value)}
                                  required
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs text-muted-foreground">{t("addTrade.assetType")}</Label>
                                <Select value={assetType} onValueChange={setAssetType}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="stock">{t("addTrade.stock")}</SelectItem>
                                    <SelectItem value="etf">{t("addTrade.etf")}</SelectItem>
                                    <SelectItem value="crypto">{t("addTrade.crypto")}</SelectItem>
                                    <SelectItem value="bond">{t("addTrade.bond")}</SelectItem>
                                    <SelectItem value="other">{t("addTrade.other")}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      <Separator className="my-5" />

                      <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300 delay-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" />
                            <span className="text-sm font-bold">
                              {tradeType === "dividend" ? t("addTrade.dividendDetails") : t("addTrade.tradeDetails")}
                            </span>
                          </div>
                        </div>

                        {tradeType === "dividend" ? (
                          <div className="space-y-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="dividendAmount" className="text-xs text-muted-foreground">
                                {t("addTrade.amountReceived")}
                              </Label>
                              <Input
                                id="dividendAmount"
                                type="number"
                                step="any"
                                placeholder="50.00"
                                value={dividendAmount}
                                onChange={(e) => setDividendAmount(e.target.value)}
                                className="font-mono"
                                required
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="tradeDate" className="text-xs text-muted-foreground">
                                {t("addTrade.dateReceived")}
                              </Label>
                              <Input
                                id="tradeDate"
                                type="date"
                                value={tradeDate}
                                onChange={(e) => setTradeDate(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="notes" className="text-xs text-muted-foreground">
                                {t("addTrade.notes")}
                              </Label>
                              <Textarea
                                id="notes"
                                placeholder="Quarterly dividend, etc."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              {inputMode === "shares" ? (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <Label htmlFor="quantity" className="text-xs text-muted-foreground">
                                      {t("addTrade.shares")}
                                    </Label>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <span className="text-foreground font-medium">{t("addTrade.shares")}</span>
                                      <Switch
                                        checked={false}
                                        onCheckedChange={(checked) => {
                                          setInputMode(checked ? "amount" : "shares");
                                          setAmount("");
                                          setQuantity("");
                                        }}
                                        className="scale-75"
                                      />
                                      <span>{t("addTrade.amount")}</span>
                                    </div>
                                  </div>
                                  <div className="flex gap-1.5">
                                    <Input
                                      id="quantity"
                                      type="number"
                                      step="any"
                                      placeholder="10"
                                      value={quantity}
                                      onChange={(e) => setQuantity(e.target.value)}
                                      className="font-mono"
                                      required
                                      max={tradeType === "sell" ? availableShares : undefined}
                                    />
                                    {tradeType === "sell" && availableShares > 0 && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0 text-xs h-10 px-2.5"
                                        onClick={handleMaxQuantity}
                                      >
                                        {t("addTrade.max")}
                                      </Button>
                                    )}
                                  </div>
                                  {tradeType === "sell" && availableShares > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      {availableShares.toFixed(4)} {t("addTrade.sharesAvailable")}
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  <div className="flex items-center justify-between">
                                    <Label htmlFor="amount" className="text-xs text-muted-foreground">
                                      {t("addTrade.dollarAmount")}
                                    </Label>
                                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <span>{t("addTrade.shares")}</span>
                                      <Switch
                                        checked={inputMode === "amount"}
                                        onCheckedChange={(checked) => {
                                          setInputMode(checked ? "amount" : "shares");
                                          setAmount("");
                                          setQuantity("");
                                        }}
                                        className="scale-75"
                                      />
                                      <span className="text-foreground font-medium">{t("addTrade.amount")}</span>
                                    </div>
                                  </div>
                                  <div className="flex gap-1.5">
                                    <Input
                                      id="amount"
                                      type="number"
                                      step="any"
                                      placeholder="1,500.00"
                                      value={amount}
                                      onChange={(e) => setAmount(e.target.value)}
                                      className="font-mono"
                                      required
                                      max={tradeType === "sell" && parseFloat(price) > 0 ? availableShares * parseFloat(price) : undefined}
                                    />
                                    {tradeType === "sell" && availableShares > 0 && (
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="shrink-0 text-xs h-10 px-2.5"
                                        onClick={handleMaxQuantity}
                                      >
                                        {t("addTrade.max")}
                                      </Button>
                                    )}
                                  </div>
                                  {parseFloat(amount) > 0 && parseFloat(price) > 0 && (
                                    <p className="text-xs text-muted-foreground">
                                      ≈ {(parseFloat(amount) / parseFloat(price)).toFixed(4)} {t("common.shares")}
                                      {tradeType === "sell" && ` / ${availableShares.toFixed(4)} available`}
                                    </p>
                                  )}
                                </div>
                              )}
                              <div className="space-y-1.5">
                                <Label htmlFor="price" className="text-xs text-muted-foreground">
                                  {t("addTrade.pricePerUnit")}
                                </Label>
                                <Input
                                  id="price"
                                  type="number"
                                  step="any"
                                  placeholder="150.00"
                                  value={price}
                                  onChange={(e) => setPrice(e.target.value)}
                                  className="font-mono"
                                  required
                                />
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="tradeDate" className="text-xs text-muted-foreground">
                                {t("addTrade.tradeDate")}
                              </Label>
                              <Input
                                id="tradeDate"
                                type="date"
                                value={tradeDate}
                                onChange={(e) => setTradeDate(e.target.value)}
                              />
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="notes" className="text-xs text-muted-foreground">
                                {t("addTrade.notes")}
                              </Label>
                              <Textarea
                                id="notes"
                                placeholder="Earnings play, DCA, etc."
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={2}
                              />
                            </div>
                          </div>
                        )}

                        {/* Tags */}
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">{t("addTrade.tags")}</Label>
                          <TagPicker selectedTagIds={selectedTagIds} onToggle={handleTagToggle} />
                        </div>
                      </div>

                      {/* Inline summary line */}
                      {total > 0 && (
                        <>
                          <Separator className="my-5" />
                          <div className="animate-in fade-in duration-200 rounded-lg bg-accent/50 p-3 text-center">
                            {tradeType === "dividend" ? (
                              <span className="font-mono font-bold text-foreground">
                                {t("addTrade.dividend")}: ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <>
                                <span className="text-sm text-muted-foreground">
                                  {computedQuantity.toFixed(4)} {t("common.shares")} × ${parseFloat(price).toLocaleString("en-US", { minimumFractionDigits: 2 })} ={" "}
                                </span>
                                <span className="font-mono font-bold text-foreground">
                                  ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  )}
                  </>)}
                </form>
              </CardContent>

              {/* Footer */}
              <div className="border-t border-border bg-card rounded-b-lg p-4 flex items-center justify-between">
                <span className="text-lg font-bold font-mono text-foreground">
                  {total > 0
                    ? `$${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "$0.00"}
                </span>
                <Button onClick={handleSubmit} disabled={submitting || !symbolResolved || !tradeTypeSelected}>
                  {submitting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  {submitting ? t("addTrade.adding") : `${t("addTrade.addTrade")} ${tradeType ? tradeType.toUpperCase() : ""}`}
                </Button>
              </div>
            </Card>
          </div>

          {/* ===== BACK: Confirmation ===== */}
          <div
            className="w-full absolute top-0 left-0"
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
            }}
          >
            {submittedTrade && (
              <Card className="border-primary/30 overflow-hidden bg-gradient-to-br from-primary/10 to-card">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                  <div className="h-16 w-16 rounded-full bg-gain/20 flex items-center justify-center">
                    <CheckCircle2 className="h-10 w-10 text-gain" />
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold">
                      {submittedTrade.tradeType === "dividend" ? t("addTrade.dividendRecorded") : t("addTrade.tradeSubmitted")}
                    </h2>
                    <p className="text-muted-foreground text-sm">{t("addTrade.tradeRecorded")}</p>
                  </div>

                  <Separator />

                  <div className="w-full space-y-3 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">{t("addTrade.symbol")}</span>
                      <span className="font-mono font-bold text-lg">{submittedTrade.symbol}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">{t("addTrade.asset")}</span>
                      <span className="text-sm font-medium">{submittedTrade.assetName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">{t("addTrade.type")}</span>
                      <Badge
                        className={
                          submittedTrade.tradeType === "buy"
                            ? "bg-gain text-gain-foreground"
                            : submittedTrade.tradeType === "sell"
                            ? "bg-loss text-loss-foreground"
                            : "bg-primary text-primary-foreground"
                        }
                      >
                        {submittedTrade.tradeType.toUpperCase()}
                      </Badge>
                    </div>

                    <Separator />

                    {submittedTrade.tradeType !== "dividend" && (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-sm">{t("addTrade.shares")}</span>
                          <span className="font-mono">{submittedTrade.quantity.toFixed(4)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground text-sm">{t("addTrade.price")}</span>
                          <span className="font-mono">
                            ${submittedTrade.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">{t("addTrade.date")}</span>
                      <span className="text-sm">
                        {new Date(submittedTrade.tradeDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <span className="font-semibold">
                        {submittedTrade.tradeType === "dividend" ? t("addTrade.amount") : t("addTrade.total")}
                      </span>
                      <span className="font-mono font-bold text-xl">
                        ${submittedTrade.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <Button onClick={handleAddAnother} variant="outline" className="w-full mt-4">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {t("addTrade.addAnother")}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddTrade;
