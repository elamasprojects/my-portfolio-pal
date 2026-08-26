import { useState, useMemo } from "react";
import { useTrades, computeHoldings, Holding } from "@/hooks/usePortfolio";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { QuickSellDialog } from "@/components/QuickSellDialog";
import { thesisForSymbol } from "@/lib/thesis";
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
      targetPriceUSD?: number;
      invalidationText?: string;
      currentPriceUSD: number;
      /** False when no live quote was available, so the alert is never raised on stale cost. */
      hasLiveQuote: boolean;
    }[] = [];

    for (const h of holdings) {
      const thesis = thesisForSymbol(trades, h.symbol);

      // Without a live quote there is no evidence the target was reached; falling back to the
      // average cost would compare the position against itself.
      const livePriceUSD = marketPrices.get(h.symbol.toUpperCase());
      if (!livePriceUSD || livePriceUSD <= 0) continue;

      // Both sides are USD-normalised, so no exchange rate enters the comparison and a
      // devaluation cannot trip a target on its own.
      if (thesis.targetPriceUSD !== null && livePriceUSD >= thesis.targetPriceUSD) {
        activeAlerts.push({
          type: "target",
          symbol: h.symbol,
          holding: h,
          targetPriceUSD: thesis.targetPriceUSD,
          currentPriceUSD: livePriceUSD,
          hasLiveQuote: true,
        });
      }

      // Invalidation: the declared stop level when the user gave one, otherwise the 15%
      // drawdown rule against average cost.
      const invalidationHit =
        thesis.invalidationPriceUSD !== null
          ? livePriceUSD <= thesis.invalidationPriceUSD
          : h.avg_cost > 0 && livePriceUSD < h.avg_cost * 0.85;

      if (invalidationHit) {
        activeAlerts.push({
          type: "invalidation",
          symbol: h.symbol,
          holding: h,
          invalidationText:
            thesis.invalidationCondition ||
            "Pérdida superior al 15% respecto al precio promedio de compra.",
          currentPriceUSD: livePriceUSD,
          hasLiveQuote: true,
        });
      }
    }

    return activeAlerts;
  }, [holdings, trades, marketPrices]);

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
                      Cotización actual (US$ {alert.currentPriceUSD.toLocaleString("es-AR", { maximumFractionDigits: 2 })}) alcanzó o superó el precio objetivo (US$ {alert.targetPriceUSD?.toLocaleString("es-AR", { maximumFractionDigits: 2 })}).
                    </>
                  ) : (
                    <>
                      {alert.invalidationText} (Cotización actual: US$ {alert.currentPriceUSD.toLocaleString("es-AR", { maximumFractionDigits: 2 })}).
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
        // Reached from a target or invalidation alert: the level was declared up front, so
        // this exit is planned and skips the cooling-off period.
        isPlannedExit
      />
    </div>
  );
}
