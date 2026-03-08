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
import { toast } from "sonner";
import { Search, Tag, TrendingUp, Calculator, Plus, Loader2 } from "lucide-react";

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

  const symbolResolved = assetName.trim() !== "" && price.trim() !== "";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !portfolio) return;

    setSubmitting(true);
    try {
      const { error } = await supabase.from("trades").insert({
        portfolio_id: portfolio.id,
        user_id: user.id,
        symbol: symbol.toUpperCase(),
        asset_name: assetName,
        asset_type: assetType as any,
        trade_type: tradeType as any,
        quantity: parseFloat(quantity),
        price_per_unit: parseFloat(price),
        trade_date: new Date(tradeDate).toISOString(),
        notes: notes || null,
      });

      if (error) throw error;

      toast.success(`${tradeType.toUpperCase()} ${symbol.toUpperCase()} added!`);
      queryClient.invalidateQueries({ queryKey: ["trades"] });

      setSymbol("");
      setAssetName("");
      setQuantity("");
      setPrice("");
      setNotes("");
      setTradeDate(new Date().toISOString().split("T")[0]);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const total = parseFloat(quantity || "0") * parseFloat(price || "0");

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Add Trade</h1>
        <p className="text-muted-foreground text-sm">Log a new buy or sell</p>
      </div>

      <Card className="border-border/50 overflow-hidden">
        <CardHeader>
          <CardTitle className="text-lg">New Trade</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-0">
            {/* Symbol Lookup Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Symbol Lookup</span>
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

            {/* Asset Details Section */}
            <div className={`space-y-3 transition-opacity ${!symbolResolved ? "opacity-40 pointer-events-none" : ""}`}>
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Asset Details</span>
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
                    <Select value={tradeType} onValueChange={setTradeType} disabled={!symbolResolved}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="buy">Buy</SelectItem>
                        <SelectItem value="sell">Sell</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <Separator className="my-5" />

            {/* Trade Details Section */}
            <div className={`space-y-3 transition-opacity ${!symbolResolved ? "opacity-40 pointer-events-none" : ""}`}>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Trade Details</span>
              </div>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="quantity" className="text-xs text-muted-foreground">Quantity</Label>
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
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Calculator className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">Order Summary</span>
              </div>
              <div className="grid grid-cols-2 gap-1 text-sm">
                <span className="text-muted-foreground">Quantity:</span>
                <span className="text-right font-mono">{quantity || "—"}</span>
                <span className="text-muted-foreground">Price per Unit:</span>
                <span className="text-right font-mono">{price ? `$${parseFloat(price).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "—"}</span>
                <span className="text-muted-foreground">Total:</span>
                <span className="text-right font-mono font-semibold">
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
            <Plus className="h-4 w-4 mr-2" />
            {submitting ? "Adding..." : `Add ${tradeType.toUpperCase()}`}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default AddTrade;
