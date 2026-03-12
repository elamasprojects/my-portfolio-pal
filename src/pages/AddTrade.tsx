import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useStrategies, useDefaultStrategy } from "@/hooks/useStrategies";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useDolarMEP, convertArsToUsd } from "@/hooks/useDolarMEP";
import { CurrencyToggle } from "@/components/CurrencyToggle";
import { useActivePortfolio, useTrades, computeHoldings, Holding } from "@/hooks/usePortfolio";
import { usePortfolioPositions } from "@/hooks/usePortfolioPositions";
import { useAssignTag } from "@/hooks/useTags";
import { useUserBrokers, useDefaultBroker } from "@/hooks/useBrokers";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/i18n";
import { TagPicker } from "@/components/TagPicker";
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
import { Search, Tag, TrendingUp, Plus, Loader2, CheckCircle2, RotateCcw, ArrowDownLeft, ArrowUpRight, Banknote, PenLine, Camera, Upload, Info, SkipForward, X, ImagePlus } from "lucide-react";
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

interface QueueItem {
  file: File;
  status: "pending" | "analyzing" | "done" | "error";
  extractedData?: any;
  error?: string;
}

const AddTrade = () => {
  const { user } = useAuth();
  const { profile } = useProfile();
  const { venta: mepRate, isLoading: mepLoading } = useDolarMEP();
  const { portfolio } = useActivePortfolio();
  const { data: trades } = useTrades();
  const queryClient = useQueryClient();
  const assignTag = useAssignTag();
  const { t } = useLanguage();

  // Currency for input
  const [tradeCurrency, setTradeCurrency] = useState<"USD" | "ARS">("USD");
  const [currencyInitialized, setCurrencyInitialized] = useState(false);
  if (profile && !currencyInitialized) {
    setTradeCurrency((profile.default_currency as "USD" | "ARS") || "USD");
    setCurrencyInitialized(true);
  }

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
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>("none");

  // Dividend-specific
  const [dividendAmount, setDividendAmount] = useState("");

  // Symbol search state
  const [searchResults, setSearchResults] = useState<{ symbol: string; description: string }[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchingSymbol, setSearchingSymbol] = useState(false);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const searchDropdownRef = useRef<HTMLDivElement>(null);

  // MEP rate for ARS trades
  const [customMepRate, setCustomMepRate] = useState("");

  // Multi-image queue state
  const [screenshotQueue, setScreenshotQueue] = useState<QueueItem[]>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [submittedTrades, setSubmittedTrades] = useState<SubmittedTrade[]>([]);
  const [analyzingCount, setAnalyzingCount] = useState(0);
  const [analyzingTotal, setAnalyzingTotal] = useState(0);
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);

  // Broker state
  const { data: userBrokers } = useUserBrokers();
  const defaultBroker = useDefaultBroker();
  const [selectedBrokerId, setSelectedBrokerId] = useState<string>("none");

  const isMultiMode = screenshotQueue.length > 1;
  const queueTotal = screenshotQueue.length;

  // Set default broker when loaded
  useEffect(() => {
    if (defaultBroker && selectedBrokerId === "none") {
      setSelectedBrokerId(defaultBroker.broker_id);
    }
  }, [defaultBroker, selectedBrokerId]);

  // Analyze a single image and return extracted data
  const analyzeOneImage = useCallback(async (file: File): Promise<any> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        try {
          const { data, error } = await supabase.functions.invoke("analyze-trade-image", {
            body: { image: base64 },
          });
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          resolve({ ...data, _preview: base64 });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }, []);

  // Process multiple images with concurrency limit
  const processQueue = useCallback(async (files: File[]) => {
    const queue: QueueItem[] = files.map(f => ({ file: f, status: "pending" as const }));
    setScreenshotQueue(queue);
    setCurrentQueueIndex(0);
    setSubmittedTrades([]);
    setAnalyzingTotal(files.length);
    setAnalyzingCount(0);
    setAnalyzingImage(true);

    const CONCURRENCY = 3;
    let completed = 0;
    const results = [...queue];

    const processItem = async (index: number) => {
      results[index] = { ...results[index], status: "analyzing" };
      try {
        const data = await analyzeOneImage(files[index]);
        results[index] = { ...results[index], status: "done", extractedData: data };
      } catch (err: any) {
        results[index] = { ...results[index], status: "error", error: err.message };
      }
      completed++;
      setAnalyzingCount(completed);
      setScreenshotQueue([...results]);
    };

    // Process in batches of CONCURRENCY
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = [];
      for (let j = i; j < Math.min(i + CONCURRENCY, files.length); j++) {
        batch.push(processItem(j));
      }
      await Promise.all(batch);
    }

    setAnalyzingImage(false);

    // Find first successful item
    const firstSuccess = results.findIndex(r => r.status === "done");
    if (firstSuccess >= 0) {
      setCurrentQueueIndex(firstSuccess);
      populateFormFromData(results[firstSuccess].extractedData);
      setEntryMode("manual");
      const successCount = results.filter(r => r.status === "done").length;
      const errorCount = results.filter(r => r.status === "error").length;
      if (errorCount > 0) {
        toast.warning(`${successCount} analyzed, ${errorCount} failed`);
      } else {
        toast.success(`${successCount} image${successCount > 1 ? "s" : ""} analyzed! Review each trade.`);
      }
    } else {
      toast.error(t("addTrade.analyzeError"));
      setScreenshotQueue([]);
      setEntryMode("screenshot");
    }
  }, [analyzeOneImage, t]);

  const { data: positions = [] } = usePortfolioPositions();

  // Positions-based holdings for sell/dividend (source of truth from DB)
  const positionHoldings = useMemo(() => {
    return positions.map((p) => ({
      symbol: p.symbol,
      asset_name: p.symbol,
      asset_type: "stock" as string,
      net_quantity: p.quantity,
      avg_cost: p.avg_cost,
      total_invested: p.cost_basis,
    }));
  }, [positions]);

  // Enrich position holdings with asset names from trades
  const enrichedPositionHoldings = useMemo(() => {
    if (!trades) return positionHoldings;
    return positionHoldings.map((ph) => {
      const trade = trades.find((t) => t.symbol.toUpperCase() === ph.symbol.toUpperCase());
      return {
        ...ph,
        asset_name: trade?.asset_name || ph.symbol,
        asset_type: trade?.asset_type || "stock",
      };
    });
  }, [positionHoldings, trades]);

  const populateFormFromData = useCallback((data: any) => {
    if (data.trade_type) setTradeType(data.trade_type);
    if (data.symbol) setSymbol(data.symbol.toUpperCase());
    if (data.asset_name) setAssetName(data.asset_name);
    if (data.asset_type) setAssetType(data.asset_type);
    if (data.quantity) setQuantity(String(data.quantity));
    if (data.price_per_unit) setPrice(String(data.price_per_unit));
    if (data.trade_date) setTradeDate(data.trade_date);
    if (data.currency === "ARS") setTradeCurrency("ARS");
    else if (data.currency === "USD") setTradeCurrency("USD");
    if (data.quantity && data.price_per_unit) {
      setAmount(String((data.quantity * data.price_per_unit).toFixed(2)));
    }
    if (data._preview) setImagePreview(data._preview);
    fromScreenshotRef.current = true;
    setFormExpanded(true);
    userEditedPrice.current = false;
    userEditedName.current = false;

    // OCR sell flow: auto-select holding from positions and default to shares mode
    if (data.trade_type === "sell") {
      setInputMode("shares");
      const normalized = (data.symbol || "").toUpperCase().trim();
      const match = enrichedPositionHoldings.find(
        (h) => h.symbol.toUpperCase() === normalized
      );
      if (match) {
        setSelectedHolding(match.symbol);
        setFormExpanded(true);
        setSymbol(match.symbol);
        setAssetName(match.asset_name);
        setAssetType(match.asset_type);
        // Fetch current quote but preserve OCR price
        const ocrPrice = data.price_per_unit;
        setFetchingQuote(true);
        supabase.functions.invoke("fetch-quote", { body: { symbol: match.symbol } })
          .then(({ data: quoteData }) => {
            if (quoteData?.name && !userEditedName.current) setAssetName(quoteData.name);
            // Restore OCR price — don't let quote overwrite it
            if (ocrPrice) setPrice(String(ocrPrice));
          })
          .finally(() => setFetchingQuote(false));
      } else if (normalized) {
        toast.warning(`No tenés ${normalized} en cartera`);
      }
    }
  }, [enrichedPositionHoldings]);

  // Single image handler (legacy path)
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

        // Use unified populateFormFromData (handles sell matching, input mode, etc.)
        populateFormFromData({ ...data, _preview: base64 });
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
  }, [t, populateFormFromData]);

  // Drop is now handled to stage files
  // (handleDrop moved below handleFileChange)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => f.type.startsWith("image/"));
    if (files.length === 0) return;
    setStagedFiles(prev => [...prev, ...files].slice(0, 10));
    // Reset so same files can be re-selected
    e.target.value = "";
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
    if (files.length === 0) return;
    setStagedFiles(prev => [...prev, ...files].slice(0, 10));
  }, []);

  const removeStagedFile = useCallback((index: number) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleAnalyzeStaged = useCallback(() => {
    if (stagedFiles.length === 0) return;
    if (stagedFiles.length === 1) {
      handleImageUpload(stagedFiles[0]);
    } else {
      processQueue(stagedFiles);
    }
    setStagedFiles([]);
  }, [stagedFiles, handleImageUpload, processQueue]);

  // Strategies
  const { data: strategies } = useStrategies();
  const defaultStrategy = useDefaultStrategy();

  useEffect(() => {
    if (defaultStrategy && selectedStrategyId === "none") {
      setSelectedStrategyId(defaultStrategy.id);
    }
  }, [defaultStrategy, selectedStrategyId]);

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

  // Legacy holdings for buy flow only (computeHoldings still used where needed)
  const holdings = useMemo(() => {
    if (!trades) return [];
    return computeHoldings(trades);
  }, [trades]);

  // Deferred sell matching: retry when positions load after OCR
  useEffect(() => {
    if (
      tradeType === "sell" &&
      symbol &&
      !selectedHolding &&
      enrichedPositionHoldings.length > 0 &&
      fromScreenshotRef.current
    ) {
      const normalized = symbol.toUpperCase().trim();
      const match = enrichedPositionHoldings.find(
        (h) => h.symbol.toUpperCase() === normalized
      );
      if (match) {
        setSelectedHolding(match.symbol);
        setFormExpanded(true);
        setAssetName(match.asset_name);
        setAssetType(match.asset_type);
        setInputMode("shares");
      }
    }
  }, [tradeType, symbol, selectedHolding, enrichedPositionHoldings]);

  const [formExpanded, setFormExpanded] = useState(false);

  const symbolResolved = tradeType === "dividend"
    ? selectedHolding !== ""
    : assetName.trim() !== "" && (price.trim() !== "" || formExpanded);

  const availableShares = useMemo(() => {
    if (tradeType !== "sell" || !selectedHolding) return 0;
    const pos = positions.find((p) => p.symbol.toUpperCase() === selectedHolding.toUpperCase());
    return pos ? pos.quantity : 0;
  }, [tradeType, selectedHolding, positions]);

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

  // Symbol search: debounced search via edge function
  useEffect(() => {
    if (tradeType !== "buy") return;
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    if (!symbol.trim() || symbol.trim().length < 2) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      setSearchingSymbol(true);
      try {
        const { data, error } = await supabase.functions.invoke("search-symbol", {
          body: { query: symbol.trim() },
        });
        if (!error && data?.results?.length > 0) {
          setSearchResults(data.results);
          setShowSearchDropdown(true);
        } else {
          setSearchResults([]);
          setShowSearchDropdown(false);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearchingSymbol(false);
      }
    }, 400);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [symbol, tradeType]);

  // Close search dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchDropdownRef.current && !searchDropdownRef.current.contains(e.target as Node)) {
        setShowSearchDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSelect = (result: { symbol: string; description: string }) => {
    setSymbol(result.symbol);
    setAssetName(result.description);
    userEditedName.current = true;
    setShowSearchDropdown(false);
    setSearchResults([]);
  };

  // Auto-fill MEP rate when currency is ARS
  useEffect(() => {
    if (tradeCurrency === "ARS" && mepRate > 0 && !customMepRate) {
      setCustomMepRate(String(mepRate));
    }
  }, [tradeCurrency, mepRate]);

  // Warn when date changes to past for ARS
  const isToday = tradeDate === new Date().toISOString().split("T")[0];
  const effectiveMepRate = tradeCurrency === "ARS" && customMepRate
    ? parseFloat(customMepRate)
    : mepRate;

  const handleHoldingSelect = async (sym: string) => {
    setSelectedHolding(sym);
    setFormExpanded(true);
    const h = enrichedPositionHoldings.find((h) => h.symbol.toUpperCase() === sym.toUpperCase());
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

  // Advance to the next queue item after submit
  const advanceQueue = useCallback((newSubmittedTrade: SubmittedTrade) => {
    const newSubmittedTrades = [...submittedTrades, newSubmittedTrade];
    setSubmittedTrades(newSubmittedTrades);

    // Find next successful item in queue
    let nextIndex = -1;
    for (let i = currentQueueIndex + 1; i < screenshotQueue.length; i++) {
      if (screenshotQueue[i].status === "done") {
        nextIndex = i;
        break;
      }
    }

    if (nextIndex >= 0) {
      // More items to review
      setCurrentQueueIndex(nextIndex);
      resetFormFields();
      populateFormFromData(screenshotQueue[nextIndex].extractedData);
    } else {
      // All done — show batch confirmation
      setSubmittedTrade(null); // clear single trade
      setTimeout(() => {
        setFlipped(true);
        fireConfetti();
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 100);
    }
  }, [submittedTrades, currentQueueIndex, screenshotQueue, populateFormFromData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !portfolio) return;

    let finalQuantity: number;
    let finalPrice: number;
    let finalTotal: number;

    if (tradeType === "dividend") {
      finalQuantity = 1;
      finalPrice = parseFloat(dividendAmount);
      // Convert ARS dividend to USD
      if (tradeCurrency === "ARS" && effectiveMepRate > 0) {
        finalPrice = convertArsToUsd(finalPrice, effectiveMepRate);
      }
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

      // Convert ARS price to USD before storing
      if (tradeCurrency === "ARS" && effectiveMepRate > 0) {
        finalPrice = convertArsToUsd(finalPrice, effectiveMepRate);
        if (inputMode === "amount" && finalPrice > 0) {
          finalQuantity = convertArsToUsd(parseFloat(amount), effectiveMepRate) / finalPrice;
        }
      }

      finalTotal = finalQuantity * finalPrice;

      if (tradeType === "sell" && finalQuantity > availableShares) {
        toast.error(t("addTrade.notEnoughShares", { shares: availableShares.toFixed(4) }));
        return;
      }
    }

    setSubmitting(true);
    try {
      // Compute original price before conversion
      const originalPrice = tradeType === "dividend"
        ? parseFloat(dividendAmount)
        : parseFloat(price);

      // Broker commission calculation
      const selectedUserBroker = profile?.brokers_enabled && selectedBrokerId !== "none"
        ? userBrokers?.find(ub => ub.broker_id === selectedBrokerId)
        : null;
      const commissionPct = selectedUserBroker?.commission_pct || 0;
      const commissionAmount = finalTotal * commissionPct / 100;

      const { data: insertedTrade, error } = await supabase.from("trades").insert({
        portfolio_id: portfolio.id,
        user_id: user.id,
        symbol: symbol.toUpperCase(),
        asset_name: assetName,
        asset_type: assetType as any,
        trade_type: tradeType as any,
        strategy_id: selectedStrategyId === "none" ? null : selectedStrategyId,
        quantity: finalQuantity,
        price_per_unit: finalPrice,
        trade_date: new Date(tradeDate).toISOString(),
        notes: notes || null,
        original_currency: tradeCurrency,
        original_price: tradeCurrency === "ARS" ? originalPrice : null,
        broker_id: selectedBrokerId !== "none" ? selectedBrokerId : null,
        commission_amount: commissionAmount,
        mep_rate: tradeCurrency === "ARS" && effectiveMepRate > 0 ? effectiveMepRate : null,
      } as any).select("id").single();

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
      queryClient.invalidateQueries({ queryKey: ["portfolio_positions"] });

      const newTrade: SubmittedTrade = {
        symbol: symbol.toUpperCase(),
        assetName,
        tradeType,
        quantity: finalQuantity,
        price: finalPrice,
        total: finalTotal,
        tradeDate,
        notes,
      };

      // Multi-image mode: advance queue
      if (isMultiMode) {
        advanceQueue(newTrade);
      } else {
        // Single mode: show confirmation
        setSubmittedTrade(newTrade);
        setTimeout(() => {
          setFlipped(true);
          fireConfetti();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }, 100);
      }
    } catch (error: any) {
      const msg = error?.message || "";
      if (msg.includes("Insufficient shares")) {
        toast.error(t("addTrade.insufficientShares"));
      } else {
        toast.error(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetFormFields = () => {
    setSymbol("");
    setAssetName("");
    setAssetType("stock");
    setQuantity("");
    setPrice("");
    setAmount("");
    setNotes("");
    setTradeType("");
    setSelectedHolding("");
    userEditedPrice.current = false;
    userEditedName.current = false;
    setInputMode("amount");
    setSelectedTagIds([]);
    setSelectedStrategyId(defaultStrategy?.id || "none");
    setDividendAmount("");
    setTradeDate(new Date().toISOString().split("T")[0]);
    setImagePreview(null);
    setFormExpanded(false);
    setSelectedBrokerId(defaultBroker?.broker_id || "none");
  };

  const handleAddAnother = () => {
    setFlipped(false);
    setTimeout(() => {
      setEntryMode("");
      resetFormFields();
      setSubmittedTrade(null);
      setScreenshotQueue([]);
      setCurrentQueueIndex(0);
      setSubmittedTrades([]);
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
    userEditedPrice.current = false;
    userEditedName.current = false;
    setInputMode("amount");
    setSelectedTagIds([]);
    setSelectedStrategyId(defaultStrategy?.id || "none");
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

  // Skip current queue item
  const handleSkipTrade = useCallback(() => {
    let nextIndex = -1;
    for (let i = currentQueueIndex + 1; i < screenshotQueue.length; i++) {
      if (screenshotQueue[i].status === "done") {
        nextIndex = i;
        break;
      }
    }

    if (nextIndex >= 0) {
      setCurrentQueueIndex(nextIndex);
      resetFormFields();
      populateFormFromData(screenshotQueue[nextIndex].extractedData);
    } else {
      // No more items — show batch confirmation if any were submitted
      if (submittedTrades.length > 0) {
        setTimeout(() => {
          setFlipped(true);
          fireConfetti();
          window.scrollTo({ top: 0, behavior: "smooth" });
        }, 100);
      } else {
        toast.info("No trades submitted");
        handleAddAnother();
      }
    }
  }, [currentQueueIndex, screenshotQueue, submittedTrades, populateFormFromData]);

  const tradeTypeSelected = tradeType === "buy" || tradeType === "sell" || tradeType === "dividend";
  const canSell = enrichedPositionHoldings.length > 0;
  const canDividend = enrichedPositionHoldings.length > 0;

  // Commission calculation for display
  const selectedUserBroker = profile?.brokers_enabled && selectedBrokerId !== "none"
    ? userBrokers?.find(ub => ub.broker_id === selectedBrokerId)
    : null;
  const displayCommissionPct = selectedUserBroker?.commission_pct || 0;
  const displayCommissionAmount = total * displayCommissionPct / 100;
  const displayNetTotal = tradeType === "sell"
    ? total - displayCommissionAmount
    : total + displayCommissionAmount;

  // Compute queue position for display (1-based, counting only successful items)
  const successfulIndices = screenshotQueue
    .map((item, i) => item.status === "done" ? i : -1)
    .filter(i => i >= 0);
  const currentPositionInQueue = successfulIndices.indexOf(currentQueueIndex) + 1;
  const totalSuccessful = successfulIndices.length;

  // For batch confirmation
  const allSubmitted = isMultiMode ? submittedTrades : (submittedTrade ? [submittedTrade] : []);
  const batchGrandTotal = allSubmitted.reduce((sum, t) => sum + t.total, 0);

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
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{t("addTrade.newTrade")}</CardTitle>
                  {isMultiMode && entryMode === "manual" && (
                    <Badge variant="secondary" className="font-mono text-xs">
                      {currentPositionInQueue}/{totalSuccessful}
                    </Badge>
                  )}
                </div>
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

                      {/* Staging area: thumbnails of selected files */}
                      {stagedFiles.length > 0 && !analyzingImage && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap gap-2">
                            {stagedFiles.map((file, i) => (
                              <div key={i} className="relative group">
                                <img
                                  src={URL.createObjectURL(file)}
                                  alt={`Staged ${i + 1}`}
                                  className="h-16 w-16 object-cover rounded-md border border-border"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => { e.stopPropagation(); removeStagedFile(i); }}
                                  className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputRef.current?.click()}
                              className="text-xs"
                            >
                              <ImagePlus className="h-3.5 w-3.5 mr-1" />
                              {t("addTrade.addMoreImages")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={handleAnalyzeStaged}
                              className="text-xs"
                            >
                              {t("addTrade.analyzeAll")} ({stagedFiles.length})
                            </Button>
                          </div>
                        </div>
                      )}

                      <div
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`relative border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
                          analyzingImage
                            ? "border-primary/50 bg-primary/5"
                            : stagedFiles.length > 0
                            ? "border-primary/30 bg-primary/5"
                            : "border-border hover:border-primary/40 hover:bg-accent/30"
                        }`}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={handleFileChange}
                        />
                        {analyzingImage ? (
                          <>
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm font-medium text-primary">
                              {analyzingTotal > 1
                                ? t("addTrade.analyzingMultiple", { current: String(analyzingCount), total: String(analyzingTotal) })
                                : t("addTrade.analyzing")}
                            </p>
                          </>
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
                          setScreenshotQueue([]);
                          setStagedFiles([]);
                        }}
                        className="text-xs text-muted-foreground"
                      >
                        {t("addTrade.backToInput")}
                      </Button>
                    </div>
                  )}

                  {/* Step 1: Trade Type */}
                  {entryMode === "manual" && (<>
                  {/* Queue thumbnail strip */}
                  {isMultiMode && (
                    <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
                      {screenshotQueue.map((item, i) => {
                        if (item.status !== "done") return null;
                        const pos = successfulIndices.indexOf(i) + 1;
                        const isCurrent = i === currentQueueIndex;
                        const isSubmitted = submittedTrades.some((_, si) => {
                          // Check if this queue index was already submitted
                          const submittedIdx = successfulIndices[si];
                          return submittedIdx === i;
                        });
                        // Simpler check: submitted items are those before current in successful indices
                        const posInSuccessful = successfulIndices.indexOf(i);
                        const alreadyDone = posInSuccessful < successfulIndices.indexOf(currentQueueIndex)
                          || submittedTrades.length > posInSuccessful;
                        return (
                          <div
                            key={i}
                            className={`shrink-0 w-10 h-10 rounded-md border-2 flex items-center justify-center text-xs font-mono transition-all ${
                              isCurrent
                                ? "border-primary bg-primary/10 text-primary font-bold"
                                : posInSuccessful < currentPositionInQueue - 1
                                ? "border-gain/50 bg-gain/10 text-gain"
                                : "border-border bg-card text-muted-foreground"
                            }`}
                          >
                            {posInSuccessful < currentPositionInQueue - 1 ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              pos
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

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
                                setInputMode("shares");
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
                                {enrichedPositionHoldings.map((h) => (
                                  <SelectItem key={h.symbol} value={h.symbol}>
                                    {h.symbol} — {h.asset_name} ({h.net_quantity.toFixed(4)} {t("common.shares")})
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
                                  onChange={(e) => { setAssetName(e.target.value); userEditedName.current = true; }}
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
                          <CurrencyToggle value={tradeCurrency} onChange={setTradeCurrency} />
                        </div>
                        {tradeCurrency === "ARS" && mepRate > 0 && (
                          <p className="text-[10px] text-muted-foreground text-right">
                            Dólar MEP: ${mepRate.toFixed(2)}
                          </p>
                        )}

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
                                  onChange={(e) => { setPrice(e.target.value); userEditedPrice.current = true; }}
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

                        <div className="grid grid-cols-2 gap-3">
                          {/* Strategy */}
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t("strategy.select")}</Label>
                            <Select value={selectedStrategyId} onValueChange={setSelectedStrategyId}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">{t("strategy.none")}</SelectItem>
                                {strategies?.map((s) => (
                                  <SelectItem key={s.id} value={s.id}>
                                    {s.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Tags */}
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t("addTrade.tags")}</Label>
                            <div className="pt-1.5">
                              <TagPicker selectedTagIds={selectedTagIds} onToggle={handleTagToggle} />
                            </div>
                          </div>
                        </div>

                        {/* Broker selector (only if enabled) */}
                        {profile?.brokers_enabled && userBrokers && userBrokers.length > 0 && (tradeType === "buy" || tradeType === "sell") && (
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t("addTrade.broker")}</Label>
                            <Select value={selectedBrokerId} onValueChange={setSelectedBrokerId}>
                              <SelectTrigger>
                                <SelectValue placeholder={t("addTrade.selectBroker")} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">—</SelectItem>
                                {userBrokers.map((ub) => (
                                  <SelectItem key={ub.broker_id} value={ub.broker_id}>
                                    {ub.broker?.name || ub.broker_id}
                                    {ub.commission_pct > 0 ? ` (${ub.commission_pct}%)` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>

                      {/* Inline summary line */}
                      {total > 0 && (
                        <>
                          <Separator className="my-5" />
                          <div className="animate-in fade-in duration-200 rounded-lg bg-accent/50 p-3 text-center space-y-1">
                            {tradeType === "dividend" ? (
                              <span className="font-mono font-bold text-foreground">
                                {t("addTrade.dividend")}: {tradeCurrency === "ARS" ? "ARS$" : "$"}{total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <>
                                <span className="text-sm text-muted-foreground">
                                  {computedQuantity.toFixed(4)} {t("common.shares")} × {tradeCurrency === "ARS" ? "ARS$" : "$"}{parseFloat(price).toLocaleString("en-US", { minimumFractionDigits: 2 })} ={" "}
                                </span>
                                <span className="font-mono font-bold text-foreground">
                                  {tradeCurrency === "ARS" ? "ARS$" : "$"}{total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                {displayCommissionPct > 0 && (
                                  <div className="text-xs text-muted-foreground space-y-0.5 mt-1">
                                    <p>{t("addTrade.commission")}: {displayCommissionPct}% = {tradeCurrency === "ARS" ? "ARS$" : "$"}{displayCommissionAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                    <p className="font-semibold text-foreground">
                                      {tradeType === "sell" ? t("addTrade.netProceeds") : t("addTrade.totalCost")}: {tradeCurrency === "ARS" ? "ARS$" : "$"}{displayNetTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                            {tradeCurrency === "ARS" && mepRate > 0 && (
                              <p className="text-xs text-muted-foreground">
                                {t("addTrade.convertedToUsd", { amount: convertArsToUsd(total, mepRate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}
                              </p>
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
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold font-mono text-foreground">
                    {total > 0
                      ? displayCommissionPct > 0
                        ? `$${displayNetTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                        : `$${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "$0.00"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {isMultiMode && entryMode === "manual" && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSkipTrade}
                      className="text-muted-foreground"
                    >
                      <SkipForward className="h-4 w-4 mr-1" />
                      {t("addTrade.skipTrade")}
                    </Button>
                  )}
                  <Button onClick={handleSubmit} disabled={submitting || !symbolResolved || !tradeTypeSelected}>
                    {submitting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    {submitting
                      ? t("addTrade.adding")
                      : isMultiMode
                      ? t("addTrade.tradeOf", { current: String(currentPositionInQueue), total: String(totalSuccessful) })
                      : `${t("addTrade.addTrade")} ${tradeType ? tradeType.toUpperCase() : ""}`}
                  </Button>
                </div>
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
            {/* Batch confirmation (multi-image) */}
            {isMultiMode && submittedTrades.length > 0 && (
              <Card className="border-primary/30 overflow-hidden bg-gradient-to-br from-primary/10 to-card">
                <CardContent className="p-8 flex flex-col items-center text-center space-y-6">
                  <div className="h-16 w-16 rounded-full bg-gain/20 flex items-center justify-center">
                    <CheckCircle2 className="h-10 w-10 text-gain" />
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold">{t("addTrade.allTradesRecorded")}</h2>
                    <p className="text-muted-foreground text-sm">
                      {t("addTrade.batchSummary", { count: String(submittedTrades.length) })}
                    </p>
                  </div>

                  <Separator />

                  <div className="w-full space-y-2 text-left max-h-60 overflow-y-auto">
                    {submittedTrades.map((trade, i) => (
                      <div key={i} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-accent/30">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-sm">{trade.symbol}</span>
                          <Badge
                            className={`text-[10px] px-1.5 py-0 ${
                              trade.tradeType === "buy"
                                ? "bg-gain text-gain-foreground"
                                : trade.tradeType === "sell"
                                ? "bg-loss text-loss-foreground"
                                : "bg-primary text-primary-foreground"
                            }`}
                          >
                            {trade.tradeType.toUpperCase()}
                          </Badge>
                        </div>
                        <span className="font-mono text-sm">
                          ${trade.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))}
                  </div>

                  <Separator />

                  <div className="w-full flex items-center justify-between">
                    <span className="font-semibold">{t("addTrade.grandTotal")}</span>
                    <span className="font-mono font-bold text-xl">
                      ${batchGrandTotal.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <Button onClick={handleAddAnother} variant="outline" className="w-full mt-4">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    {t("addTrade.addAnother")}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Single trade confirmation */}
            {!isMultiMode && submittedTrade && (
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
