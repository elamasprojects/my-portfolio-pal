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
import { matchTradesFIFO, consumeOpenLotsFIFO, summariseExitsFIFO } from "@/lib/tradeMatching";

/**
 * Trims the float noise out of a share count for display.
 *
 * `net_quantity` is a running float sum, so it renders as 105.74550581601055 — digits past the
 * eighth are accumulated error, not shares. The exact figure for a full exit comes from the
 * ledger at submit time, so nothing depends on this string being complete.
 */
function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return "";
  return String(Number(qty.toFixed(8)));
}

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

  // `null` means the user typed their own quantity, so no preset is highlighted and the sale is
  // not treated as a full exit.
  const [selectedPct, setSelectedPct] = useState<100 | 50 | 25 | null>(100);
  const [priceStr, setPriceStr] = useState<string>("");
  const [qtyStr, setQtyStr] = useState<string>("");

  // Initialize or update fields when dialog opens or holding/price changes
  useEffect(() => {
    if (!open || !holding) return;

    const initialPrice = currentPrice ?? holding.avg_cost ?? 0;
    setPriceStr(initialPrice > 0 ? initialPrice.toString() : "");

    setQtyStr(formatQty(holding.net_quantity));
    setSelectedPct(100);
  }, [open, holding, currentPrice]);

  if (!holding) return null;

  const handlePctSelect = (pct: 100 | 50 | 25) => {
    setSelectedPct(pct);
    if (pct === 100) {
      setQtyStr(formatQty(holding.net_quantity));
    } else {
      const calculatedQty = Number((holding.net_quantity * (pct / 100)).toFixed(4));
      setQtyStr(calculatedQty.toString());
    }
  };

  // A full exit sends no quantity of its own: the mutation reads the exact figure off the
  // ledger. Anything else sells what the field says.
  const isSellAll = selectedPct === 100;

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
        sellAll: isSellAll,
      });

      toast.success(`${t("board.sellSuccess")}: ${holding.symbol}`);
      onOpenChange(false);

      // Check if 100% of position was closed
      const isFullClose = parsedQty >= holding.net_quantity - 0.001;

      if (isFullClose && onSuccessClosedSummary) {
        const sellDate = new Date().toISOString();
        const symbolTrades = trades.filter(
          (tr) => tr.symbol.toUpperCase() === holding.symbol.toUpperCase()
        );

        // The lots this sale actually consumes, oldest first. `trades` is the pre-sale ledger,
        // so its open lots are exactly what was on hand a moment ago. Reading "the first buy of
        // this symbol" instead dated the position back to an entry that had already been sold
        // off — a stock bought and sold four times reported the holding period of the very
        // first purchase.
        const { openLots } = matchTradesFIFO(symbolTrades);
        const consumed = consumeOpenLotsFIFO(openLots, parsedQty);

        const buyDate = consumed.earliestBuyDate ?? sellDate;
        const diffMs = new Date(sellDate).getTime() - new Date(buyDate).getTime();
        const holdDays = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));

        const isARS = displayCurrency === "ARS" && mepRate && mepRate > 0;
        // Cost of exactly the shares being sold, not the whole position's running average.
        const buyPriceUSD = consumed.quantity > 0 ? consumed.weightedBuyPrice : holding.avg_cost;
        const avgBuyPrice = isARS ? buyPriceUSD * mepRate : buyPriceUSD;

        const returnPnl = (parsedPrice - avgBuyPrice) * parsedQty;
        const returnPct = avgBuyPrice > 0 ? ((parsedPrice - avgBuyPrice) / avgBuyPrice) * 100 : 0;

        const rawAnnualized = holdDays > 0 && (1 + returnPct / 100) > 0
          ? (Math.pow(1 + returnPct / 100, 365 / holdDays) - 1) * 100
          : returnPct;
        const annualizedReturnPct = Math.min(Math.max(rawAnnualized, -99.9), 999.9);

        // Realised exits across the ledger, one entry per sale. `matchTradesFIFO` replays a
        // single lot queue, so it must be fed one symbol at a time — handing it every trade
        // let a sale of one ticker consume another ticker's buy lots. Its rows are also
        // per-lot, so they are folded back into the sale that produced them.
        const exits = summariseExitsFIFO(trades);

        const now = new Date();
        const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
        const maxMonthPnl = exits
          .filter((e) => new Date(e.sellDate).getTime() >= firstDayOfMonth)
          .reduce((max, e) => Math.max(max, e.pnl), 0);

        const returnPnlUSD =
          ((isARS ? parsedPrice / mepRate : parsedPrice) - buyPriceUSD) * parsedQty;
        const isTopTradeOfMonth = returnPnlUSD > 0 && returnPnlUSD >= maxMonthPnl;

        // Consecutive profitable exits ending with this one. The count was hardcoded to 3, so
        // closing a single trade in the green announced a "3x winning streak".
        let winStreakCount = 0;
        if (returnPnlUSD > 0) {
          winStreakCount = 1;
          for (let i = exits.length - 1; i >= 0; i--) {
            if (exits[i].pnl <= 0) break;
            winStreakCount += 1;
          }
        }

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
          buyDate,
          sellDate,
          isTopTradeOfMonth,
          isWinStreak: winStreakCount > 1,
          winStreakCount,
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
                  // Typing a quantity used to leave the 100% preset highlighted, so a partial
                  // sale was still submitted as a full exit.
                  setSelectedPct(null);
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
