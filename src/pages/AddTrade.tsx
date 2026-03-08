import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDefaultPortfolio, useTrades, computeHoldings, Holding } from "@/hooks/usePortfolio";
import { useQueryClient } from "@tanstack/react-query";
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
import { toast } from "sonner";
import { Search, Tag, TrendingUp, Plus, Loader2, CheckCircle2, RotateCcw, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import confetti from "canvas-confetti";

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
  const { data: portfolio } = useDefaultPortfolio();
  const { data: trades } = useTrades();
  const queryClient = useQueryClient();

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

  const [inputMode, setInputMode] = useState<"shares" | "amount">("shares");
  const [amount, setAmount] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [submittedTrade, setSubmittedTrade] = useState<SubmittedTrade | null>(null);
  const [selectedHolding, setSelectedHolding] = useState<string>("");

  const holdings = useMemo(() => {
    if (!trades) return [];
    return computeHoldings(trades);
  }, [trades]);

  const symbolResolved = assetName.trim() !== "" && price.trim() !== "";

  const availableShares = useMemo(() => {
    if (tradeType !== "sell" || !selectedHolding) return 0;
    const h = holdings.find((h) => h.symbol === selectedHolding);
    return h ? h.net_quantity : 0;
  }, [tradeType, selectedHolding, holdings]);

  const computedQuantity =
    inputMode === "amount" && parseFloat(price) > 0 && parseFloat(amount) > 0
      ? parseFloat(amount) / parseFloat(price)
      : parseFloat(quantity || "0");

  const total = computedQuantity * parseFloat(price || "0");

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
          if (data.price > 0) setPrice(String(data.price));
          if (data.name) setAssetName(data.name);
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
    setPrice(String(h.avg_cost));

    setFetchingQuote(true);
    try {
      const { data, error } = await supabase.functions.invoke("fetch-quote", {
        body: { symbol: sym },
      });
      if (!error && data) {
        if (data.price > 0) setPrice(String(data.price));
        if (data.name) setAssetName(data.name);
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
      colors: ["#3b82f6", "#60a5fa", "#93c5fd", "#22c55e", "#a855f7"],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !portfolio) return;

    const finalQuantity =
      inputMode === "amount" && parseFloat(price) > 0
        ? parseFloat(amount) / parseFloat(price)
        : parseFloat(quantity);

    if (tradeType === "sell" && finalQuantity > availableShares) {
      toast.error(`You only have ${availableShares.toFixed(4)} shares available to sell.`);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("trades").insert({
        portfolio_id: portfolio.id,
        user_id: user.id,
        symbol: symbol.toUpperCase(),
        asset_name: assetName,
        asset_type: assetType as any,
        trade_type: tradeType as any,
        quantity: finalQuantity,
        price_per_unit: parseFloat(price),
        trade_date: new Date(tradeDate).toISOString(),
        notes: notes || null,
      });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["trades"] });

      setSubmittedTrade({
        symbol: symbol.toUpperCase(),
        assetName,
        tradeType,
        quantity: finalQuantity,
        price: parseFloat(price),
        total: finalQuantity * parseFloat(price),
        tradeDate,
        notes,
      });

      setTimeout(() => {
        setFlipped(true);
        fireConfetti();
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
      setTradeType("");
      setSymbol("");
      setAssetName("");
      setQuantity("");
      setPrice("");
      setAmount("");
      setNotes("");
      setTradeDate(new Date().toISOString().split("T")[0]);
      setInputMode("shares");
      setSelectedHolding("");
      setSubmittedTrade(null);
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
    setInputMode("shares");
  };

  const handleMaxQuantity = () => {
    if (inputMode === "shares") {
      setQuantity(String(availableShares));
    } else if (parseFloat(price) > 0) {
      setAmount(String((availableShares * parseFloat(price)).toFixed(2)));
    }
  };

  const tradeTypeSelected = tradeType === "buy" || tradeType === "sell";
  const canSell = holdings.length > 0;

  return (
    <div className={`max-w-lg mx-auto transition-all duration-700 ${flipped ? "py-8" : ""}`}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Add Trade</h1>
        <p className="text-muted-foreground text-sm">Log a new buy or sell</p>
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
                <CardTitle className="text-lg">New Trade</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-0">
                  {/* Step 1: Trade Type */}
                  <div className="space-y-3">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 1</span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setTradeType("buy");
                          resetFields();
                        }}
                        className={`flex-1 h-14 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 border-2 ${
                          tradeType === "buy"
                            ? "border-[hsl(var(--gain))] bg-[hsl(var(--gain))]/10 text-[hsl(var(--gain))] shadow-md"
                            : "border-border bg-card hover:border-[hsl(var(--gain))]/50 text-foreground"
                        }`}
                      >
                        <ArrowDownLeft className="h-4 w-4" />
                        Buy
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
                                  ? "border-[hsl(var(--loss))] bg-[hsl(var(--loss))]/10 text-[hsl(var(--loss))] shadow-md"
                                  : "border-border bg-card hover:border-[hsl(var(--loss))]/50 text-foreground"
                              }`}
                            >
                              <ArrowUpRight className="h-4 w-4" />
                              Sell
                            </button>
                          </TooltipTrigger>
                          {!canSell && (
                            <TooltipContent>
                              <p>Add a buy trade first</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* Step 2: Symbol / Holdings Picker — only shown after trade type selected */}
                  {tradeTypeSelected && (
                    <>
                      <Separator className="my-5" />
                      <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 2</span>
                        {tradeType === "buy" ? (
                          <>
                            <div className="flex items-center gap-2">
                              <Search className="h-4 w-4 text-primary" />
                              <span className="text-sm font-bold">Symbol Lookup</span>
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
                                Found: <span className="font-medium text-foreground">{assetName}</span> — $
                                {parseFloat(price).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                              </p>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex items-center gap-2">
                              <Search className="h-4 w-4 text-primary" />
                              <span className="text-sm font-bold">Select Asset to Sell</span>
                              {fetchingQuote && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                            </div>
                            <Select value={selectedHolding} onValueChange={handleHoldingSelect}>
                              <SelectTrigger>
                                <SelectValue placeholder="Choose an asset..." />
                              </SelectTrigger>
                              <SelectContent>
                                {holdings.map((h) => (
                                  <SelectItem key={h.symbol} value={h.symbol}>
                                    {h.symbol} — {h.asset_name} ({h.net_quantity.toFixed(2)} shares)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {selectedHolding && symbolResolved && (
                              <p className="text-xs text-muted-foreground">
                                Current price: <span className="font-medium text-foreground">${parseFloat(price).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                                {" · "}{availableShares.toFixed(2)} shares available
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    </>
                  )}

                  {/* Step 3: Asset Details (buy only) + Trade Details — only shown after symbol resolved */}
                  {tradeTypeSelected && symbolResolved && (
                    <>
                      {tradeType === "buy" && (
                        <>
                          <Separator className="my-5" />
                          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Step 3</span>
                            <div className="flex items-center gap-2">
                              <Tag className="h-4 w-4 text-primary" />
                              <span className="text-sm font-bold">Asset Details</span>
                            </div>
                            <div className="space-y-3">
                              <div className="space-y-1.5">
                                <Label htmlFor="assetName" className="text-xs text-muted-foreground">
                                  Asset Name
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
                                <Label className="text-xs text-muted-foreground">Asset Type</Label>
                                <Select value={assetType} onValueChange={setAssetType}>
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="stock">Stock</SelectItem>
                                    <SelectItem value="etf">ETF</SelectItem>
                                    <SelectItem value="crypto">Crypto</SelectItem>
                                    <SelectItem value="bond">Bond</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
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
                            <span className="text-sm font-bold">Trade Details</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className={inputMode === "shares" ? "text-foreground font-medium" : ""}>Shares</span>
                            <Switch
                              checked={inputMode === "amount"}
                              onCheckedChange={(checked) => {
                                setInputMode(checked ? "amount" : "shares");
                                setAmount("");
                                setQuantity("");
                              }}
                              className="scale-75"
                            />
                            <span className={inputMode === "amount" ? "text-foreground font-medium" : ""}>Amount</span>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            {inputMode === "shares" ? (
                              <div className="space-y-1.5">
                                <Label htmlFor="quantity" className="text-xs text-muted-foreground">
                                  Shares
                                </Label>
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
                                      Max
                                    </Button>
                                  )}
                                </div>
                                {tradeType === "sell" && availableShares > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    {availableShares.toFixed(4)} shares available
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-1.5">
                                <Label htmlFor="amount" className="text-xs text-muted-foreground">
                                  Dollar Amount
                                </Label>
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
                                      Max
                                    </Button>
                                  )}
                                </div>
                                {parseFloat(amount) > 0 && parseFloat(price) > 0 && (
                                  <p className="text-xs text-muted-foreground">
                                    ≈ {(parseFloat(amount) / parseFloat(price)).toFixed(4)} shares
                                    {tradeType === "sell" && ` / ${availableShares.toFixed(4)} available`}
                                  </p>
                                )}
                              </div>
                            )}
                            <div className="space-y-1.5">
                              <Label htmlFor="price" className="text-xs text-muted-foreground">
                                Price per Unit ($)
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
                              Trade Date
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
                              Notes (optional)
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
                      </div>

                      {/* Inline summary line */}
                      {total > 0 && (
                        <>
                          <Separator className="my-5" />
                          <div className="animate-in fade-in duration-200 rounded-lg bg-accent/50 p-3 text-center">
                            <span className="text-sm text-muted-foreground">
                              {computedQuantity.toFixed(4)} shares × ${parseFloat(price).toLocaleString("en-US", { minimumFractionDigits: 2 })} ={" "}
                            </span>
                            <span className="font-mono font-bold text-foreground">
                              ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </>
                      )}
                    </>
                  )}
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
                  {submitting ? "Adding..." : `Add ${tradeType ? tradeType.toUpperCase() : "Trade"}`}
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
                  <div className="h-16 w-16 rounded-full bg-[hsl(var(--gain))]/20 flex items-center justify-center">
                    <CheckCircle2 className="h-10 w-10 text-[hsl(var(--gain))]" />
                  </div>

                  <div className="space-y-1">
                    <h2 className="text-2xl font-bold">Trade Submitted!</h2>
                    <p className="text-muted-foreground text-sm">Your trade has been recorded successfully.</p>
                  </div>

                  <Separator />

                  <div className="w-full space-y-3 text-left">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Symbol</span>
                      <span className="font-mono font-bold text-lg">{submittedTrade.symbol}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Asset</span>
                      <span className="text-sm font-medium">{submittedTrade.assetName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Type</span>
                      <Badge
                        className={
                          submittedTrade.tradeType === "buy"
                            ? "bg-[hsl(var(--gain))] text-[hsl(var(--gain-foreground))]"
                            : "bg-[hsl(var(--loss))] text-[hsl(var(--loss-foreground))]"
                        }
                      >
                        {submittedTrade.tradeType.toUpperCase()}
                      </Badge>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Shares</span>
                      <span className="font-mono">{submittedTrade.quantity.toFixed(4)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Price</span>
                      <span className="font-mono">
                        ${submittedTrade.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Date</span>
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
                      <span className="font-semibold">Total</span>
                      <span className="font-mono font-bold text-xl">
                        ${submittedTrade.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <Button onClick={handleAddAnother} variant="outline" className="w-full mt-4">
                    <RotateCcw className="h-4 w-4 mr-2" />
                    Add Another Trade
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
