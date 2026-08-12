import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useQuickSellTrade, Holding } from "@/hooks/usePortfolio";
import { useLanguage } from "@/i18n";
import { toast } from "sonner";
import { TrendingDown, Loader2 } from "lucide-react";

import { ClosedPositionSummary } from "@/components/ClosedPositionSummaryDialog";
import { Trade } from "@/hooks/usePortfolio";

interface QuickSellDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  holding: Holding | null;
  currentPrice?: number | null;
  currencySymbol?: string;
  displayCurrency?: "USD" | "ARS";
  mepRate?: number | null;
  trades?: Trade[];
  onSuccessClosedSummary?: (summary: ClosedPositionSummary) => void;
}

export function QuickSellDialog({
  open,
  onOpenChange,
  holding,
  currentPrice,
  currencySymbol = "$",
  displayCurrency = "USD",
  mepRate,
  trades = [],
  onSuccessClosedSummary,
}: QuickSellDialogProps) {
  const { t } = useLanguage();
  const quickSellMutation = useQuickSellTrade();

  const [selectedPct, setSelectedPct] = useState<100 | 50 | 25>(100);
  const [priceStr, setPriceStr] = useState<string>("");
  const [qtyStr, setQtyStr] = useState<string>("");

  // Initialize or update fields when dialog opens or holding/price changes
  useEffect(() => {
    if (!open || !holding) return;

    const initialPrice = currentPrice ?? holding.avg_cost ?? 0;
    setPriceStr(initialPrice > 0 ? initialPrice.toString() : "");

    setQtyStr(holding.net_quantity.toString());
    setSelectedPct(100);
  }, [open, holding, currentPrice]);

  if (!holding) return null;

  const handlePctSelect = (pct: 100 | 50 | 25) => {
    setSelectedPct(pct);
    if (pct === 100) {
      setQtyStr(holding.net_quantity.toString());
    } else {
      const calculatedQty = Number((holding.net_quantity * (pct / 100)).toFixed(4));
      setQtyStr(calculatedQty.toString());
    }
  };

  const parsedPrice = parseFloat(priceStr.replace(",", ".")) || 0;
  const parsedQty = parseFloat(qtyStr.replace(",", ".")) || 0;
  const estimatedTotal = parsedPrice * parsedQty;

  const handleConfirm = async () => {
    if (parsedQty <= 0) {
      toast.error("La cantidad debe ser mayor a 0");
      return;
    }
    if (parsedQty > holding.net_quantity + 0.0001) {
      toast.error(`La cantidad a vender (${parsedQty}) supera las ${holding.net_quantity.toFixed(2)} acciones disponibles`);
      return;
    }
    if (parsedPrice <= 0) {
      toast.error("El precio debe ser mayor a 0");
      return;
    }

    try {
      await quickSellMutation.mutateAsync({
        symbol: holding.symbol,
        asset_name: holding.asset_name,
        asset_type: holding.asset_type,
        quantity: parsedQty,
        price: parsedPrice,
        currency: displayCurrency,
        mep_rate: mepRate,
      });

      toast.success(`${t("board.sellSuccess")}: ${holding.symbol}`);
      onOpenChange(false);

      // Check if 100% of position was closed
      const isFullClose = parsedQty >= holding.net_quantity - 0.001;

      if (isFullClose && onSuccessClosedSummary) {
        // Calculate buy price & date from trades
        const symbolTrades = trades
          .filter((tr) => tr.symbol.toUpperCase() === holding.symbol.toUpperCase() && tr.trade_type === "buy")
          .sort((a, b) => new Date(a.trade_date).getTime() - new Date(b.trade_date).getTime());

        const earliestBuyDate = symbolTrades[0]?.trade_date || new Date().toISOString();
        const sellDate = new Date().toISOString();

        const diffMs = new Date(sellDate).getTime() - new Date(earliestBuyDate).getTime();
        const holdDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

        const isARS = displayCurrency === "ARS" && mepRate && mepRate > 0;
        const avgBuyPrice = isARS ? holding.avg_cost * mepRate : holding.avg_cost;

        const returnPnl = (parsedPrice - avgBuyPrice) * parsedQty;
        const returnPct = avgBuyPrice > 0 ? ((parsedPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;

        const rawAnnualized = holdDays > 0 && (1 + returnPct / 100) > 0
          ? (Math.pow(1 + returnPct / 100, 365 / holdDays) - 1) * 100
          : returnPct;
        const annualizedReturnPct = Math.min(Math.max(rawAnnualized, -99.9), 999.9);

        // Check if top trade of the month
        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const monthSellTrades = trades.filter(
          (t_) => t_.trade_type === "sell" && new Date(t_.trade_date).getTime() >= firstDayOfMonth
        );
        const maxMonthPnl = monthSellTrades.reduce((max, t_) => {
          const pnl = (t_.price_per_unit - (holding.avg_cost || 0)) * t_.quantity;
          return Math.max(max, pnl);
        }, 0);

        const returnPnlUSD = ((isARS ? parsedPrice / mepRate : parsedPrice) - holding.avg_cost) * parsedQty;
        const isTopTradeOfMonth = returnPnlUSD > 0 && returnPnlUSD >= maxMonthPnl;

        onSuccessClosedSummary({
          symbol: holding.symbol,
          asset_name: holding.asset_name,
          quantity: parsedQty,
          avgBuyPrice,
          sellPrice: parsedPrice,
          returnPct,
          returnPnl,
          holdDays,
          annualizedReturnPct,
          buyDate: earliestBuyDate,
          sellDate,
          isTopTradeOfMonth,
          isWinStreak: returnPct > 0,
          winStreakCount: returnPct > 0 ? 3 : 0,
        });
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al procesar la venta");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-6 rounded-2xl">
        <DialogHeader className="space-y-1 pb-2 border-b">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
              <TrendingDown className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold font-mono">
                {t("board.sell")} {holding.symbol}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {holding.asset_name} • {holding.net_quantity.toFixed(2)} {t("board.availableShares")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* Percentage Presets */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">
              {t("board.sellQty")}
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={selectedPct === 100 ? "default" : "outline"}
                size="sm"
                className="font-mono font-semibold"
                onClick={() => handlePctSelect(100)}
              >
                100% (Todo)
              </Button>
              <Button
                type="button"
                variant={selectedPct === 50 ? "default" : "outline"}
                size="sm"
                className="font-mono font-semibold"
                onClick={() => handlePctSelect(50)}
              >
                50%
              </Button>
              <Button
                type="button"
                variant={selectedPct === 25 ? "default" : "outline"}
                size="sm"
                className="font-mono font-semibold"
                onClick={() => handlePctSelect(25)}
              >
                25%
              </Button>
            </div>
          </div>

          {/* Price & Quantity Fields */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sell-price" className="text-xs text-muted-foreground">
                {t("board.sellPrice")} ({currencySymbol})
              </Label>
              <Input
                id="sell-price"
                type="number"
                step="any"
                className="font-mono text-sm font-semibold"
                value={priceStr}
                onChange={(e) => setPriceStr(e.target.value)}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="sell-qty" className="text-xs text-muted-foreground">
                {t("board.qty")}
              </Label>
              <Input
                id="sell-qty"
                type="number"
                step="any"
                className="font-mono text-sm font-semibold"
                value={qtyStr}
                onChange={(e) => {
                  setQtyStr(e.target.value);
                  setSelectedPct(100);
                }}
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Calculated Total */}
          <div className="rounded-xl bg-accent/40 p-3.5 flex items-center justify-between border">
            <span className="text-xs text-muted-foreground uppercase font-medium">
              {t("board.totalProceeds")}
            </span>
            <span className="font-mono text-lg font-bold text-foreground">
              {currencySymbol}{estimatedTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={quickSellMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="font-semibold gap-1.5"
            onClick={handleConfirm}
            disabled={quickSellMutation.isPending}
          >
            {quickSellMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Procesando...
              </>
            ) : (
              <>
                <TrendingDown className="h-4 w-4" />
                {t("board.confirmSell")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
