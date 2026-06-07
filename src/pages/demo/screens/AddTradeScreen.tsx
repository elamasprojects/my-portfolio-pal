import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Banknote, Check } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useDemo } from "../DemoContext";

type TType = "buy" | "sell" | "dividend";

export function AddTradeScreen() {
  const { fmt, setScreen } = useDemo();
  const [type, setType] = useState<TType>("buy");
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [mode, setMode] = useState<"shares" | "amount">("shares");
  const [amount, setAmount] = useState("");

  const computedQty = mode === "amount" && parseFloat(price) > 0 ? parseFloat(amount || "0") / parseFloat(price) : parseFloat(qty || "0");
  // In amount mode the total is simply the amount entered (independent of price).
  const total =
    type === "dividend" || mode === "amount" ? parseFloat(amount || "0") : computedQty * parseFloat(price || "0");

  const submit = () => {
    if (!symbol.trim()) {
      toast.error("Enter a symbol");
      return;
    }
    toast.success("Prototype — nothing was saved to your account.");
    setSymbol("");
    setQty("");
    setPrice("");
    setAmount("");
  };

  const TypeBtn = ({ value, label, Icon, tone }: { value: TType; label: string; Icon: typeof Banknote; tone: string }) => (
    <button
      type="button"
      onClick={() => setType(value)}
      className={cn(
        "flex h-14 flex-1 items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold transition-all",
        type === value ? tone : "border-border bg-card text-foreground hover:border-primary/40",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div>
        <h1 className="text-xl font-bold">Add a trade</h1>
        <p className="text-sm text-muted-foreground">Record a buy, sell, or dividend.</p>
      </div>

      <div className="flex gap-3">
        <TypeBtn value="buy" label="Buy" Icon={ArrowDownLeft} tone="border-gain bg-gain/10 text-gain" />
        <TypeBtn value="sell" label="Sell" Icon={ArrowUpRight} tone="border-loss bg-loss/10 text-loss" />
        <TypeBtn value="dividend" label="Dividend" Icon={Banknote} tone="border-primary bg-primary/10 text-primary" />
      </div>

      <div className="space-y-4 rounded-xl border bg-card p-4">
        <div className="space-y-1.5">
          <Label htmlFor="d-sym">Symbol</Label>
          <Input id="d-sym" value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())} placeholder="AAPL, MSFT, BTC…" className="h-11 font-mono uppercase" />
        </div>

        {type !== "dividend" ? (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("shares")}
                className={cn("h-9 flex-1 rounded-lg border text-sm font-medium", mode === "shares" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}
              >
                By shares
              </button>
              <button
                type="button"
                onClick={() => setMode("amount")}
                className={cn("h-9 flex-1 rounded-lg border text-sm font-medium", mode === "amount" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground")}
              >
                By amount
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {mode === "shares" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="d-qty">Quantity</Label>
                  <Input id="d-qty" value={qty} onChange={(e) => setQty(e.target.value)} placeholder="0" inputMode="decimal" className="h-11 font-mono" />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label htmlFor="d-amt">Amount</Label>
                  <Input id="d-amt" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" inputMode="decimal" className="h-11 font-mono" />
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="d-price">Price</Label>
                <Input id="d-price" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0" inputMode="decimal" className="h-11 font-mono" />
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-1.5">
            <Label htmlFor="d-div">Dividend amount</Label>
            <Input id="d-div" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" inputMode="decimal" className="h-11 font-mono" />
          </div>
        )}

        <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2.5">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-mono text-base font-bold">{fmt.fmt(fmt.cx(isFinite(total) ? total : 0))}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" className="h-12 flex-1" onClick={() => setScreen("dashboard")}>
          Cancel
        </Button>
        <Button className="h-12 flex-1" onClick={submit}>
          <Check className="mr-1.5 h-4 w-4" />
          Add trade
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">Prototype — submissions are not saved.</p>
    </div>
  );
}
