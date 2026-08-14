import { useState, useMemo } from "react";
import { useTrades, computeHoldings, Holding } from "@/hooks/usePortfolio";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { QuickSellDialog } from "@/components/QuickSellDialog";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Target, AlertTriangle, ArrowRight } from "lucide-react";

export function ThesisAlertsBanner() {
  const { data: trades = [] } = useTrades();
  const holdings = useMemo(() => computeHoldings(trades), [trades]);
  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const { prices: marketPrices } = useMarketPrices(symbols);
  const { venta: mepRate = 1200 } = useDolarMEP();

  const [quickSellOpen, setQuickSellOpen] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<Holding | null>(null);
  const [sellPrice, setSellPrice] = useState<number | null>(null);

  // Compute active alerts
  const alerts = useMemo(() => {
    const activeAlerts: {
      type: "target" | "invalidation";
      symbol: string;
      holding: Holding;
      currentPriceARS: number;
      targetPriceARS?: number;
      invalidationText?: string;
      currentPriceUSD: number;
    }[] = [];

    const effectiveRate = mepRate > 0 ? mepRate : 1200;

    for (const h of holdings) {
      const symbolTrades = trades.filter((t) => t.symbol === h.symbol && t.trade_type === "buy");
      const latestBuyTrade = symbolTrades[symbolTrades.length - 1];
      if (!latestBuyTrade) continue;

      const targetPriceARS = latestBuyTrade.target_price_ars;
      const invalidationCondition = latestBuyTrade.invalidation_condition;
      const currentPriceUSD = marketPrices.get(h.symbol.toUpperCase()) || h.avg_cost;
      const currentPriceARS = currentPriceUSD * effectiveRate;

      // 1. Target Reached Check
      if (targetPriceARS && targetPriceARS > 0 && currentPriceARS >= targetPriceARS) {
        activeAlerts.push({
          type: "target",
          symbol: h.symbol,
          holding: h,
          currentPriceARS,
          targetPriceARS,
          currentPriceUSD,
        });
      }

      // 2. Invalidation Check (if current price drops significantly below average cost e.g. 15% or hits invalidation level)
      if (currentPriceARS < h.avg_cost * effectiveRate * 0.85) {
        activeAlerts.push({
          type: "invalidation",
          symbol: h.symbol,
          holding: h,
          currentPriceARS,
          invalidationText: invalidationCondition || "Pérdida superior al 15% respecto al precio promedio de compra.",
          currentPriceUSD,
        });
      }
    }

    return activeAlerts;
  }, [holdings, trades, marketPrices, mepRate]);

  if (alerts.length === 0) {
    return null;
  }

  const handleOpenExit = (holding: Holding, priceUSD: number) => {
    setSelectedHolding(holding);
    setSellPrice(priceUSD);
    setQuickSellOpen(true);
  };

  return (
    <div className="space-y-3">
      {alerts.map((alert, i) => (
        <Alert
          key={`${alert.symbol}_${alert.type}_${i}`}
          className={
            alert.type === "target"
              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
              : "bg-amber-500/10 border-amber-500/40 text-amber-400"
          }
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full">
            <div className="flex items-start gap-3">
              {alert.type === "target" ? (
                <Target className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <AlertTitle className="text-sm font-bold flex items-center gap-2">
                  {alert.type === "target" ? (
                    <span>🎯 Target Reached: {alert.symbol}</span>
                  ) : (
                    <span>⚠️ Invalidación Hit: {alert.symbol}</span>
                  )}
                </AlertTitle>
                <AlertDescription className="text-xs mt-1 text-foreground/90">
                  {alert.type === "target" ? (
                    <>
                      Cotización actual ($ {alert.currentPriceARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}) alcanzó o superó el precio objetivo ($ {alert.targetPriceARS?.toLocaleString("es-AR")}).
                    </>
                  ) : (
                    <>
                      {alert.invalidationText} (Cotización actual: $ {alert.currentPriceARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}).
                    </>
                  )}
                </AlertDescription>
              </div>
            </div>

            <Button
              variant={alert.type === "target" ? "default" : "destructive"}
              size="sm"
              onClick={() => handleOpenExit(alert.holding, alert.currentPriceUSD)}
              className="text-xs font-semibold shrink-0"
            >
              Ejecutar Salida Planificada (1-Click)
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        </Alert>
      ))}

      <QuickSellDialog
        open={quickSellOpen}
        onOpenChange={setQuickSellOpen}
        holding={selectedHolding}
        currentPrice={sellPrice}
        currencySymbol="US$"
        displayCurrency="USD"
        mepRate={mepRate}
        trades={trades}
      />
    </div>
  );
}
