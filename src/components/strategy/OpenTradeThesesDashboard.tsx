import { useState, useMemo } from "react";
import { useTrades, computeHoldings, Holding, Trade } from "@/hooks/usePortfolio";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useDolarMEP } from "@/hooks/useDolarMEP";
import { QuickSellDialog } from "@/components/QuickSellDialog";
import { PreTradeThesisModal } from "@/components/discipline/PreTradeThesisModal";
import { latestBuyForSymbol, thesisForSymbol } from "@/lib/thesis";
import type { PreTradeThesis } from "@/types/thesis";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ChessBadge } from "@/components/ui/ChessBadge";
import { toast } from "sonner";
import { Target, AlertTriangle, TrendingUp, TrendingDown, Edit3, CheckCircle2, ArrowUpDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

export function OpenTradeThesesDashboard() {
  const { data: trades = [] } = useTrades();
  const holdings = useMemo(() => computeHoldings(trades), [trades]);
  const symbols = useMemo(() => holdings.map((h) => h.symbol), [holdings]);
  const { prices: marketPrices } = useMarketPrices(symbols);
  const { venta: mepRate = 1200 } = useDolarMEP();
  const queryClient = useQueryClient();

  const effectiveRate = mepRate > 0 ? mepRate : 1200;

  // Quick Sell Modal
  const [quickSellOpen, setQuickSellOpen] = useState(false);
  const [selectedHoldingForSell, setSelectedHoldingForSell] = useState<Holding | null>(null);
  const [sellPrice, setSellPrice] = useState<number | null>(null);
  const [sellIsPlanned, setSellIsPlanned] = useState(false);

  // Edit Thesis Modal
  const [editThesisOpen, setEditThesisOpen] = useState(false);
  const [targetTradeIdForThesis, setTargetTradeIdForThesis] = useState<string | null>(null);

  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  // An exit only counts as planned once a declared level was actually reached. The button used
  // to claim "Salida Planificada" on every row, which meant an impulse sale was recorded as
  // planned and skipped the cooling-off period.
  const handleOpenSell = (holding: Holding, priceUSD: number, isPlanned: boolean) => {
    setSelectedHoldingForSell(holding);
    setSellPrice(priceUSD);
    setSellIsPlanned(isPlanned);
    setQuickSellOpen(true);
  };

  const handleOpenEditThesis = (tradeId: string) => {
    setTargetTradeIdForThesis(tradeId);
    setEditThesisOpen(true);
  };

  const handleSaveThesis = async (thesis: PreTradeThesis) => {
    if (!targetTradeIdForThesis) return;
    try {
      const { error } = await supabase
        .from("trades" as any)
        .update({
          entry_thesis: thesis.entryThesis,
          target_price_usd: thesis.targetPriceUSD,
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

  // Enriched rows with USD native calculations
  const enrichedRows = useMemo(() => {
    const list = holdings.map((h) => {
      const latestBuyTrade = latestBuyForSymbol(trades, h.symbol);
      const thesis = thesisForSymbol(trades, h.symbol);

      const rawEntryThesis = thesis.entryThesis || "Sin tesis registrada.";
      const rawInvalidation = thesis.invalidationCondition || "Sin invalidación definida.";

      const currentPriceUSD = marketPrices.get(h.symbol.toUpperCase()) || h.avg_cost;
      const buyPriceUSD = h.avg_cost;

      // Stored USD-normalised, same as `price_per_unit` — no currency guess.
      const targetPriceUSD = thesis.targetPriceUSD ?? 0;

      let progressPct = 0;
      if (targetPriceUSD > 0 && currentPriceUSD > 0) {
        progressPct = Math.min(100, Math.max(0, (currentPriceUSD / targetPriceUSD) * 100));
      }

      const targetHit = targetPriceUSD > 0 && currentPriceUSD >= targetPriceUSD;
      const invalidationHit = (currentPriceUSD < buyPriceUSD * 0.85);

      return {
        holding: h,
        latestBuyTrade,
        rawEntryThesis,
        rawInvalidation,
        buyPriceUSD,
        currentPriceUSD,
        targetPriceUSD,
        progressPct,
        targetHit,
        invalidationHit,
      };
    });

    return list.sort((a, b) => {
      return sortOrder === "desc" ? b.progressPct - a.progressPct : a.progressPct - b.progressPct;
    });
  }, [holdings, trades, marketPrices, sortOrder]);

  return (
    <div className="space-y-6">
      <Card className="bg-card border border-border/80 shadow-md">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              Tesis de Trades Abiertos ({enrichedRows.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Posiciones activas en USD vinculadas a su hipótesis de entrada, precio objetivo y avance.
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")}
            className="text-xs gap-1.5 border-border/60"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span>Ordenar por Avance ({sortOrder === "desc" ? "Mayor a Menor" : "Menor a Mayor"})</span>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent text-xs">
                  <TableHead>Símbolo</TableHead>
                  <TableHead>Tesis de Entrada (Pre-Trade)</TableHead>
                  <TableHead className="text-right">Precio Compra (USD)</TableHead>
                  <TableHead className="text-right">Precio Actual (USD)</TableHead>
                  <TableHead className="text-right">Objetivo Target (USD)</TableHead>
                  <TableHead className="text-center w-[150px]">Avance al Target</TableHead>
                  <TableHead className="text-center">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrichedRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                      No hay posiciones abiertas registradas.
                    </TableCell>
                  </TableRow>
                ) : (
                  enrichedRows.map(({ holding: h, latestBuyTrade, rawEntryThesis, rawInvalidation, buyPriceUSD, currentPriceUSD, targetPriceUSD, progressPct, targetHit, invalidationHit }) => {
                    return (
                      <TableRow key={h.symbol} className="hover:bg-muted/40 text-sm">
                        <TableCell className="font-bold text-foreground">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-base">{h.symbol}</span>
                            <Badge variant="outline" className="text-[10px]">
                              {h.net_quantity} u.
                            </Badge>
                            {targetHit && (
                              <ChessBadge evaluation="brillante" label="Target Alcanzado" size="xs" />
                            )}
                            {invalidationHit && !targetHit && (
                              <ChessBadge evaluation="imprecision" label="En Stop" size="xs" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-[280px]">
                          <p className="text-xs text-foreground font-medium line-clamp-2">{rawEntryThesis}</p>
                          <span className="text-[10px] text-muted-foreground block mt-0.5">
                            Stop: {rawInvalidation}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-muted-foreground">
                          US$ {buyPriceUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm font-bold text-foreground">
                          US$ {currentPriceUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-emerald-400 font-bold">
                          {targetPriceUSD > 0
                            ? `US$ ${targetPriceUSD.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center">
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
                                targetHit
                                  ? "bg-emerald-500 hover:bg-emerald-600 text-white"
                                  : "bg-primary text-primary-foreground"
                              }`}
                              onClick={() =>
                                handleOpenSell(h, currentPriceUSD, targetHit || invalidationHit)
                              }
                            >
                              <TrendingDown className="h-3.5 w-3.5 mr-1" />
                              {targetHit || invalidationHit ? "Salida Planificada" : "Vender"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
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
        mepRate={effectiveRate}
        trades={trades}
        isPlannedExit={sellIsPlanned}
      />

      {/*
        Keyed by the trade being edited: the modal keeps its field state internally, so a single
        un-keyed instance carried the previous row's thesis text into the next one — and that
        text could then be saved onto a different holding.
      */}
      <PreTradeThesisModal
        key={targetTradeIdForThesis ?? "none"}
        open={editThesisOpen}
        onOpenChange={setEditThesisOpen}
        onSubmit={handleSaveThesis}
      />
    </div>
  );
}
