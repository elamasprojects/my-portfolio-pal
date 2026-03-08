import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDefaultPortfolio } from "@/hooks/usePortfolio";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";

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

      // Reset form but keep asset type
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

      <Card className="border-border/50">
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="symbol">Symbol</Label>
                <Input
                  id="symbol"
                  placeholder="AAPL"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  className="font-mono uppercase"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="assetName">Asset Name</Label>
                <Input
                  id="assetName"
                  placeholder="Apple Inc."
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Asset Type</Label>
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
              <div className="space-y-2">
                <Label>Trade Type</Label>
                <Select value={tradeType} onValueChange={setTradeType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="buy">Buy</SelectItem>
                    <SelectItem value="sell">Sell</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity">Quantity</Label>
                <Input
                  id="quantity"
                  type="number"
                  step="any"
                  placeholder="10"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="font-mono"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="price">Price per Unit ($)</Label>
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

            {total > 0 && (
              <div className="rounded-lg bg-muted p-3 text-center">
                <span className="text-xs text-muted-foreground uppercase tracking-wider">Total</span>
                <p className="text-xl font-bold font-mono mt-0.5">
                  ${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="tradeDate">Trade Date</Label>
              <Input
                id="tradeDate"
                type="date"
                value={tradeDate}
                onChange={(e) => setTradeDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Earnings play, DCA, etc."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              <Plus className="h-4 w-4 mr-2" />
              {submitting ? "Adding..." : `Add ${tradeType.toUpperCase()}`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AddTrade;
