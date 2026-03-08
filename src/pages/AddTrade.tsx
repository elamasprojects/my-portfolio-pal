import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
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
import { toast } from "sonner";
import { Search, Tag, TrendingUp, Calculator, Plus, Loader2, CheckCircle2, RotateCcw } from "lucide-react";
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
  const queryClient = useQueryClient();

  const [symbol, setSymbol] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState<string>("stock");
  const [tradeType, setTradeType] = useState<string>("buy");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [tradeDate, setTradeDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [fetchingQuote, setFetchingQuote] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // New states
  const [inputMode, setInputMode] = useState<"shares" | "amount">("shares");
  const [amount, setAmount] = useState("");
  const [flipped, setFlipped] = useState(false);
  const [submittedTrade, setSubmittedTrade] = useState<SubmittedTrade | null>(null);

  const symbolResolved = assetName.trim() !== "" && price.trim() !== "";

  // Auto-calculate quantity when in amount mode
  const computedQuantity = inputMode === "amount" && parseFloat(price) > 0 && parseFloat(amount) > 0
    ? parseFloat(amount) / parseFloat(price)
    : parseFloat(quantity || "0");

  const total = computedQuantity * parseFloat(price || "0");

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!symbol.trim()) return;

    debounceRef.current = setTimeout(async () => {
      setFetchingQuote(true);
      try {
        const { data, error } = await supabase.functions.invoke('fetch-quote', {
          body: { symbol: symbol.trim() },
        });
        if (!error && data) {
          if (data.price > 0) setPrice(String(data.price));
          if (data.name) setAssetName(data.name);
        }
      } catch {} finally {
        setFetchingQuote(false);
      }
    }, 500);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [symbol]);

  const fireConfetti = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#3b82f6', '#60a5fa', '#93c5fd', '#22c55e', '#a855f7'],
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !portfolio) return;

    const finalQuantity = inputMode === "amount" && parseFloat(price) > 0
      ? parseFloat(amount) / parseFloat(price)
      : parseFloat(quantity);

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
      setSymbol("");
      setAssetName("");
      setQuantity("");
      setPrice("");
      setAmount("");
      setNotes("");
      setTradeDate(new Date().toISOString().split("T")[0]);
      setInputMode("shares");
      setTradeType("buy");
      setSubmittedTrade(null);
    }, 600);
  };

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
          <div
            className="w-full"
            style={{ backfaceVisibility: "hidden" }}
          >
            <Card className="border-border/50 overflow-hidden">
              <CardHeader>
                <CardTitle className="text-lg">New Trade</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-0">
                  {/* Symbol Lookup */}
                  <div className="space-y-3 border-l-2 border-primary/40 pl-4">
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
                        Found: <span className="font-medium text-foreground">{assetName}</span> — ${parseFloat(price).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </div>

                  <Separator className="my-5" />

                  {/* Asset Details */}
                  <div className={`space-y-3 border-l-2 pl-4 transition-all duration-500 ${symbolResolved ? "border-primary/40 opacity-100" : "border-muted opacity-30 pointer-events-none"}`}>
                    <div className="flex items-center gap-2">
                      <Tag className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold">Asset Details</span>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="assetName" className="text-xs text-muted-foreground">Asset Name</Label>
                        <Input
                          id="assetName"
                          placeholder="Apple Inc."
                          value={assetName}
                          onChange={(e) => setAssetName(e.target.value)}
                          disabled={!symbolResolved}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Asset Type</Label>
                          <Select value={assetType} onValueChange={setAssetType} disabled={!symbolResolved}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="stock">Stock</SelectItem>
                              <SelectItem value="etf">ETF</SelectItem>
                              <SelectItem value="crypto">Crypto</SelectItem>
                              <SelectItem value="bond">Bond</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs text-muted-foreground">Trade Type</Label>
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={!symbolResolved}
                              onClick={() => setTradeType("buy")}
                              className={`flex-1 h-10 rounded-md text-sm font-semibold transition-all ${
                                tradeType === "buy"
                                  ? "bg-gain text-gain-foreground shadow-sm"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                            >
                              Buy
                            </button>
                            <button
                              type="button"
                              disabled={!symbolResolved}
                              onClick={() => setTradeType("sell")}
                              className={`flex-1 h-10 rounded-md text-sm font-semibold transition-all ${
                                tradeType === "sell"
                                  ? "bg-loss text-loss-foreground shadow-sm"
                                  : "bg-muted text-muted-foreground hover:bg-muted/80"
                              }`}
                            >
                              Sell
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator className="my-5" />

                  {/* Trade Details */}
                  <div className={`space-y-3 border-l-2 pl-4 transition-all duration-500 ${symbolResolved ? "border-primary/40 opacity-100" : "border-muted opacity-30 pointer-events-none"}`}>
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
                          disabled={!symbolResolved}
                          className="scale-75"
                        />
                        <span className={inputMode === "amount" ? "text-foreground font-medium" : ""}>Amount</span>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {inputMode === "shares" ? (
                          <div className="space-y-1.5">
                            <Label htmlFor="quantity" className="text-xs text-muted-foreground">Shares</Label>
                            <Input
                              id="quantity"
                              type="number"
                              step="any"
                              placeholder="10"
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value)}
                              className="font-mono"
                              disabled={!symbolResolved}
                              required
                            />
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <Label htmlFor="amount" className="text-xs text-muted-foreground">Dollar Amount</Label>
                            <Input
                              id="amount"
                              type="number"
                              step="any"
                              placeholder="1,500.00"
                              value={amount}
                              onChange={(e) => setAmount(e.target.value)}
                              className="font-mono"
                              disabled={!symbolResolved}
                              required
                            />
                            {parseFloat(amount) > 0 && parseFloat(price) > 0 && (
                              <p className="text-xs text-muted-foreground">
                                ≈ {(parseFloat(amount) / parseFloat(price)).toFixed(4)} shares
                              </p>
                            )}
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <Label htmlFor="price" className="text-xs text-muted-foreground">Price per Unit ($)</Label>
                          <Input
                            id="price"
                            type="number"
                            step="any"
                            placeholder="150.00"
                            value={price}
                            onChange={(e) => setPrice(e.target.value)}
                            className="font-mono"
                            disabled={!symbolResolved}
                            required
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="tradeDate" className="text-xs text-muted-foreground">Trade Date</Label>
                        <Input
                          id="tradeDate"
                          type="date"
                          value={tradeDate}
                          onChange={(e) => setTradeDate(e.target.value)}
                          disabled={!symbolResolved}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="notes" className="text-xs text-muted-foreground">Notes (optional)</Label>
                        <Textarea
                          id="notes"
                          placeholder="Earnings play, DCA, etc."
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          rows={2}
                          disabled={!symbolResolved}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator className="my-5" />

                  {/* Order Summary */}
                  <div className="space-y-3 border-l-2 border-muted pl-4">
                    <div className="flex items-center gap-2">
                      <Calculator className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold">Order Summary</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1 text-sm">
                      <span className="text-muted-foreground">Shares:</span>
                      <span className="text-right font-mono">{computedQuantity > 0 ? computedQuantity.toFixed(4) : "—"}</span>
                      <span className="text-muted-foreground">Price per Unit:</span>
                      <span className="text-right font-mono">{price ? `$${parseFloat(price).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}</span>
                      <span className="text-muted-foreground font-semibold">Total:</span>
                      <span className="text-right font-mono font-bold text-foreground">
                        {total > 0 ? `$${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                      </span>
                    </div>
                  </div>
                </form>
              </CardContent>

              {/* Footer */}
              <div className="bg-muted rounded-b-lg p-4 flex items-center justify-between">
                <span className="text-lg font-bold font-mono">
                  {total > 0 ? `$${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "$0.00"}
                </span>
                <Button onClick={handleSubmit} disabled={submitting || !symbolResolved}>
                  {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                  {submitting ? "Adding..." : `Add ${tradeType.toUpperCase()}`}
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
                      <Badge className={submittedTrade.tradeType === "buy" ? "bg-gain text-gain-foreground" : "bg-loss text-loss-foreground"}>
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
                      <span className="font-mono">${submittedTrade.price.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground text-sm">Date</span>
                      <span className="text-sm">{new Date(submittedTrade.tradeDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Total</span>
                      <span className="font-mono font-bold text-xl">${submittedTrade.total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
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
