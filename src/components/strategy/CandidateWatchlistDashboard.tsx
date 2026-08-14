import { useState, useMemo } from "react";
import { useCandidateWatchlist } from "@/hooks/useCandidateWatchlist";
import { CandidateWatchlistItem } from "@/types/thesis";
import { PreTradeThesisModal } from "@/components/discipline/PreTradeThesisModal";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { useDolarMEP } from "@/hooks/useDolarMEP";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Eye, Plus, Trash2, ShoppingBag, ArrowUpRight, ArrowDownRight } from "lucide-react";

export function CandidateWatchlistDashboard() {
  const { items, addItem, removeItem } = useCandidateWatchlist();
  const symbols = useMemo(() => items.map((i) => i.symbol), [items]);
  const { prices: marketPrices } = useMarketPrices(symbols);
  const { venta: mepRate = 1200 } = useDolarMEP();

  // Add Candidate Modal State
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [symbol, setSymbol] = useState("");
  const [category, setCategory] = useState<"equity" | "bond" | "cedear" | "crypto">("cedear");
  const [targetEntry, setTargetEntry] = useState<number | "">("");
  const [targetExit, setTargetExit] = useState<number | "">("");
  const [invalidationPrice, setInvalidationPrice] = useState<number | "">("");
  const [entryThesis, setEntryThesis] = useState("");
  const [invalidationCondition, setInvalidationCondition] = useState("");
  const [formError, setFormError] = useState("");

  // Buy Execution Modal State
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateWatchlistItem | null>(null);

  const handleCreateCandidate = () => {
    if (!symbol.trim()) {
      setFormError("El símbolo es obligatorio.");
      return;
    }
    if (!targetEntry || Number(targetEntry) <= 0) {
      setFormError("El precio de entrada objetivo debe ser mayor a 0.");
      return;
    }
    if (!targetExit || Number(targetExit) <= Number(targetEntry)) {
      setFormError("El precio objetivo de salida debe ser mayor al precio de entrada.");
      return;
    }
    if (!invalidationPrice || Number(invalidationPrice) >= Number(targetEntry)) {
      setFormError("El nivel de invalidación debe ser menor al precio de entrada.");
      return;
    }
    if (!entryThesis || entryThesis.trim().length < 10) {
      setFormError("La tesis de entrada debe tener al menos 10 caracteres.");
      return;
    }
    if (!invalidationCondition || invalidationCondition.trim().length < 10) {
      setFormError("La condición de invalidación debe tener al menos 10 caracteres.");
      return;
    }

    setFormError("");
    addItem({
      symbol: symbol.trim().toUpperCase(),
      assetCategory: category,
      targetEntryPriceARS: Number(targetEntry),
      targetExitPriceARS: Number(targetExit),
      invalidationPriceARS: Number(invalidationPrice),
      entryThesis: entryThesis.trim(),
      invalidationCondition: invalidationCondition.trim(),
    });

    // Reset form
    setSymbol("");
    setTargetEntry("");
    setTargetExit("");
    setInvalidationPrice("");
    setEntryThesis("");
    setInvalidationCondition("");
    setAddModalOpen(false);
  };

  const handleOpenBuyExecution = (candidate: CandidateWatchlistItem) => {
    setSelectedCandidate(candidate);
    setBuyModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-card border border-border/80">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Watchlist de Oportunidades Candidatas ({items.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Activos bajo seguimiento con zona de entrada especificada y tesis previa cargada.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setAddModalOpen(true)} className="bg-primary text-primary-foreground font-semibold text-xs">
            <Plus className="h-4 w-4 mr-1" />
            Añadir Candidata
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Símbolo / Categoría</TableHead>
                <TableHead>Tesis de Entrada</TableHead>
                <TableHead className="text-right">Entrada Objetivo (ARS)</TableHead>
                <TableHead className="text-right">Target Salida (ARS)</TableHead>
                <TableHead className="text-right">Distancia a Entrada</TableHead>
                <TableHead className="text-center">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-sm">
                    No hay activos en la watchlist de candidatas.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((cand) => {
                  const effectiveRate = mepRate > 0 ? mepRate : 1200;
                  const liveUSD = marketPrices.get(cand.symbol.toUpperCase());
                  const liveARS = liveUSD ? liveUSD * effectiveRate : cand.targetEntryPriceARS;

                  // Distance % to entry
                  const distPct = ((liveARS - cand.targetEntryPriceARS) / cand.targetEntryPriceARS) * 100;
                  const inEntryZone = Math.abs(distPct) <= 2;

                  return (
                    <TableRow key={cand.id} className="hover:bg-muted/40">
                      <TableCell className="font-bold text-foreground">
                        <div className="flex items-center gap-2">
                          <span>{cand.symbol}</span>
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {cand.assetCategory}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <p className="text-xs text-foreground font-medium line-clamp-2">{cand.entryThesis}</p>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          Invalidación: $ {cand.invalidationPriceARS.toLocaleString("es-AR")}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        $ {cand.targetEntryPriceARS.toLocaleString("es-AR")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-emerald-400 font-semibold">
                        $ {cand.targetExitPriceARS.toLocaleString("es-AR")}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        <Badge
                          variant="secondary"
                          className={
                            inEntryZone
                              ? "bg-emerald-500/20 text-emerald-400 font-bold"
                              : distPct > 0
                              ? "bg-primary/10 text-primary"
                              : "bg-amber-500/10 text-amber-400"
                          }
                        >
                          {distPct >= 0 ? `+${distPct.toFixed(1)}%` : `${distPct.toFixed(1)}%`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => handleOpenBuyExecution(cand)}
                            className="h-7 text-xs px-2.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold"
                          >
                            <ShoppingBag className="h-3.5 w-3.5 mr-1" />
                            Ejecutar Compra
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(cand.id)}
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

      {/* ADD CANDIDATE MODAL */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Añadir Activo Candidato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-xs">
            {formError && <div className="p-2 rounded bg-destructive/10 text-destructive font-medium">{formError}</div>}
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Símbolo (Ticker)</Label>
                <Input
                  placeholder="ej. AAPL, NVDA"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Categoría</Label>
                <Select value={category} onValueChange={(val: any) => setCategory(val)}>
                  <SelectTrigger className="text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cedear">CEDEAR</SelectItem>
                    <SelectItem value="equity">Acción ARS</SelectItem>
                    <SelectItem value="bond">Bono / Título</SelectItem>
                    <SelectItem value="crypto">Cripto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Entrada (ARS)</Label>
                <Input
                  type="number"
                  placeholder="14500"
                  value={targetEntry}
                  onChange={(e) => setTargetEntry(e.target.value ? Number(e.target.value) : "")}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Target (ARS)</Label>
                <Input
                  type="number"
                  placeholder="18500"
                  value={targetExit}
                  onChange={(e) => setTargetExit(e.target.value ? Number(e.target.value) : "")}
                  className="text-xs font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Stop (ARS)</Label>
                <Input
                  type="number"
                  placeholder="13200"
                  value={invalidationPrice}
                  onChange={(e) => setInvalidationPrice(e.target.value ? Number(e.target.value) : "")}
                  className="text-xs font-mono"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Tesis de Entrada (Pre-Trade, min 10 chars)</Label>
              <Textarea
                placeholder="Razón analítica para compra..."
                value={entryThesis}
                onChange={(e) => setEntryThesis(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Condición de Invalidación (min 10 chars)</Label>
              <Textarea
                placeholder="Condición conceptual de stop..."
                value={invalidationCondition}
                onChange={(e) => setInvalidationCondition(e.target.value)}
                rows={2}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateCandidate}>
              Guardar Candidata
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PRE-FILL PRE-TRADE THESIS MODAL FOR BUY EXECUTION */}
      <PreTradeThesisModal
        open={buyModalOpen}
        onOpenChange={setBuyModalOpen}
        onSubmit={(thesis) => {
          toast.success(`✓ Tesis lista para compra de ${selectedCandidate?.symbol}`);
          setBuyModalOpen(false);
        }}
      />
    </div>
  );
}
