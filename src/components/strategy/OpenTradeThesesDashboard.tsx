import { useState, useMemo } from "react";
import { useTrades, computeHoldings, Holding, Trade } from "@/hooks/usePortfolio";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { QuickSellDialog } from "@/components/QuickSellDialog";
import { PreTradeThesisModal } from "@/components/discipline/PreTradeThesisModal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Target, AlertTriangle, TrendingUp, TrendingDown, Edit3, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function OpenTradeThesesDashboard() {
  const { data: trades = [] } = useTrades();
  const holdings = useMemo(() => computeHoldings(trades), [trades]);
  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const { prices: marketPrices } = useMarketPrices(symbols);
  const { venta: mepRate = 1200 } = useDolarMEP();
  const queryClient = useQueryClient();

  // Quick Sell Modal
  const [quickSellOpen, setQuickSellOpen] = useState(false);
  const [selectedHoldingForSell, setSelectedHoldingForSell] = useState<Holding | null>(null);
  const [sellPrice, setSellPrice] = useState<number | null>(null);

  // Edit Thesis Modal
  const [editThesisOpen, setEditThesisOpen] = useState(false);
  const [targetTradeIdForThesis, setTargetTradeIdForThesis] = useState<string | null>(null);

  const handleOpenPlannedSell = (holding: Holding, price: number) => {
    setSelectedHoldingForSell(holding);
    setSellPrice(price);
    setQuickSellOpen(true);
  };

  const handleOpenEditThesis = (tradeId: string) => {
    setTargetTradeIdForThesis(tradeId);
    setEditThesisOpen(true);
  };

  const handleSaveThesis = async (thesis: { entryThesis: string; targetPriceARS: number; invalidationCondition: string }) => {
    if (!targetTradeIdForThesis) return;
    try {
      const { error } = await supabase
        .from("trades" as any)
        .update({
          entry_thesis: thesis.entryThesis,
          target_price_ars: thesis.targetPriceARS,
          invalidation_condition: thesis.invalidationCondition,
        })
        .eq("id", targetTradeIdForThesis);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      toast.success("✓ Tesis de inversión actualizada");
    } catch (err: any) {
      toast.error("Error al actualizar tesis");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border border-border/80">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Tesis de Trades Abiertos ({holdings.length})
          </CardTitle>
          <CardDescription className="text-xs">
            Posiciones activas vinculadas a su hipótesis de entrada, precio objetivo y condición conceptual de stop.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Símbolo</TableHead>
                <TableHead>Tesis de Entrada (Pre-Trade)</TableHead>
                <TableHead className="text-right">Precio Actual</TableHead>
                <TableHead className="text-right">Precio Objetivo</TableHead>
                <TableHead className="text-center">Progreso a Target</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {holdings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                    No hay posiciones abiertas registradas.
                  </TableCell>
                </TableRow>
              ) : (
                holdings.map((h) => {
                  const symbolTrades = trades.filter((t) => t.symbol === h.symbol && t.trade_type === "buy");
                  const latestBuyTrade = symbolTrades[symbolTrades.length - 1];

                  const rawEntryThesis = latestBuyTrade?.entry_thesis || "Sin tesis registrada.";
                  const rawTargetPriceARS = latestBuyTrade?.target_price_ars || 0;
                  const rawInvalidation = latestBuyTrade?.invalidation_condition || "Sin invalidación definida.";

                  const currentPriceUSD = marketPrices.get(h.symbol.toUpperCase()) || h.avg_cost;
                  const effectiveRate = mepRate > 0 ? mepRate : 1200;
                  const currentPriceARS = currentPriceUSD * effectiveRate;

                  // Target progress %
                  let progressPct = 0;
                  if (rawTargetPriceARS > 0 && currentPriceARS > 0) {
                    progressPct = Math.min(100, Math.max(0, (currentPriceARS / rawTargetPriceARS) * 100));
                  }

                  const targetHit = rawTargetPriceARS > 0 && currentPriceARS >= rawTargetPriceARS;

                  return (
                    <TableRow key={h.symbol} className="hover:bg-muted/40">
                      <TableCell className="font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{h.symbol}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {h.net_quantity} u.
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <p className="text-xs text-foreground font-medium line-clamp-2">{rawEntryThesis}</p>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Stop: {rawInvalidation}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        $ {currentPriceARS.toLocaleString("es-AR", { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-emerald-400 font-semibold">
                        {rawTargetPriceARS > 0 ? `$ ${rawTargetPriceARS.toLocaleString("es-AR")}` : "—"}
                      </TableCell>
                      <TableCell className="text-center w-[140px]">
                        <div className="space-y-1">
                          <Progress value={progressPct} className="h-2" />
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {progressPct.toFixed(0)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {latestBuyTrade && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              onClick={() => handleOpenEditThesis(latestBuyTrade.id)}
                              title="Editar Tesis"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="default"
                            size="sm"
                            className={`h-7 text-xs px-2.5 font-semibold ${
                              targetHit ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-primary text-primary-foreground"
                            }`}
                            onClick={() => handleOpenPlannedSell(h, currentPriceUSD)}
                          >
                            <TrendingDown className="h-3.5 w-3.5 mr-1" />
                            Salida Planificada
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* QUICK SELL DIALOG */}
      <QuickSellDialog
        open={quickSellOpen}
        onOpenChange={setQuickSellOpen}
        holding={selectedHoldingForSell}
        currentPrice={sellPrice}
        currencySymbol="US$"
        displayCurrency="USD"
        mepRate={mepRate}
        trades={trades}
      />

      {/* PRE-TRADE THESIS MODAL FOR EDITING */}
      <PreTradeThesisModal
        open={editThesisOpen}
        onOpenChange={setEditThesisOpen}
        onSubmit={handleSaveThesis}
      />
    </div>
  );
}
