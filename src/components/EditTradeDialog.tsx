import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Trade } from "@/hooks/usePortfolio";
import { useTags, useTradeTagAssignments, useAssignTag, useRemoveTag } from "@/hooks/useTags";
import { useStrategies } from "@/hooks/useStrategies";
import { useUserBrokers } from "@/hooks/useBrokers";
import { useProfile } from "@/hooks/useProfile";
import { TagPicker } from "@/components/TagPicker";
import { useLanguage } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Trash2, Loader2, Copy, BookOpen } from "lucide-react";

interface EditTradeDialogProps {
  trade: Trade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTradeDialog({ trade, open, onOpenChange }: EditTradeDialogProps) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: allTags = [] } = useTags();
  const { data: assignments = [] } = useTradeTagAssignments(trade ? [trade.id] : []);
  const assignTag = useAssignTag();
  const removeTag = useRemoveTag();
  const { data: strategies } = useStrategies();
  const { data: userBrokers } = useUserBrokers();
  const { profile } = useProfile();

  const [symbol, setSymbol] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState("stock");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [tradeDate, setTradeDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [strategyId, setStrategyId] = useState<string>("none");
  const [brokerId, setBrokerId] = useState<string>("none");
  const [tradeCurrency, setTradeCurrency] = useState<string>("USD");
  const [mepRate, setMepRate] = useState("");

  useEffect(() => {
    if (trade) {
      setSymbol(trade.symbol);
      setAssetName(trade.asset_name);
      setAssetType(trade.asset_type);
      setQuantity(String(trade.quantity));
      setPrice(String(trade.price_per_unit));
      setTradeDate(new Date(trade.trade_date).toISOString().split("T")[0]);
      setNotes(trade.notes || "");
      setStrategyId(trade.strategy_id || "none");
      setBrokerId(trade.broker_id || "none");
      setTradeCurrency(trade.original_currency || "USD");
      setMepRate(trade.mep_rate != null ? String(trade.mep_rate) : "");
    }
  }, [trade]);

  useEffect(() => {
    if (trade) {
      const tagIds = assignments.filter((a) => a.trade_id === trade.id).map((a) => a.tag_id);
      setSelectedTagIds(tagIds);
    }
  }, [assignments, trade]);

  const handleSave = async () => {
    if (!trade) return;
    setSaving(true);
    try {
      // Recalculate commission based on selected broker
      const selectedUserBroker = profile?.brokers_enabled && brokerId !== "none"
        ? userBrokers?.find(ub => ub.broker_id === brokerId)
        : null;
      const commissionPct = selectedUserBroker?.commission_pct || 0;
      const finalTotal = parseFloat(quantity) * parseFloat(price);
      const commissionAmount = finalTotal * commissionPct / 100;

      const { error } = await supabase
        .from("trades")
        .update({
          symbol: symbol.toUpperCase(),
          asset_name: assetName,
          asset_type: assetType as any,
          quantity: parseFloat(quantity),
          price_per_unit: parseFloat(price),
          trade_date: new Date(tradeDate).toISOString(),
          notes: notes || null,
          strategy_id: strategyId === "none" ? null : strategyId,
          broker_id: brokerId === "none" ? null : brokerId,
          original_currency: tradeCurrency,
          commission_pct: commissionPct,
          commission_amount: commissionAmount,
          mep_rate: mepRate ? parseFloat(mepRate) : null,
        } as any)
        .eq("id", trade.id);

      if (error) throw error;

      // Sync tag assignments
      const currentTagIds = assignments.filter((a) => a.trade_id === trade.id).map((a) => a.tag_id);
      const toAdd = selectedTagIds.filter((id) => !currentTagIds.includes(id));
      const toRemove = currentTagIds.filter((id) => !selectedTagIds.includes(id));

      await Promise.all([
        ...toAdd.map((tagId) => assignTag.mutateAsync({ tradeId: trade.id, tagId })),
        ...toRemove.map((tagId) => removeTag.mutateAsync({ tradeId: trade.id, tagId })),
      ]);

      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio_positions"] });
      toast.success("Trade updated");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update trade");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!trade) return;
    const { error } = await supabase.from("trades").delete().eq("id", trade.id);
    if (error) {
      toast.error("Failed to delete trade");
    } else {
      toast.success("Trade deleted");
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio_positions"] });
      onOpenChange(false);
    }
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  if (!trade) return null;

  const isDividend = trade.trade_type === "dividend";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Edit Trade
            <Badge
              className={
                trade.trade_type === "buy"
                  ? "bg-gain/10 text-gain"
                  : trade.trade_type === "sell"
                  ? "bg-loss/10 text-loss"
                  : "bg-primary/10 text-primary"
              }
            >
              {trade.trade_type.toUpperCase()}
            </Badge>
            <span className="text-base ml-1" title={tradeCurrency}>
              {tradeCurrency === "ARS" ? "🇦🇷" : "🇺🇸"}
            </span>
          </DialogTitle>
          <DialogDescription>
            Modify the details of this trade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Symbol</Label>
              <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} className="font-mono uppercase" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Asset Name</Label>
              <Input value={assetName} onChange={(e) => setAssetName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Asset Type</Label>
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
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <Select value={tradeCurrency} onValueChange={setTradeCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">🇺🇸 USD</SelectItem>
                  <SelectItem value="ARS">🇦🇷 ARS</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {!isDividend && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Quantity</Label>
                <Input type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Price per Unit</Label>
                <Input type="number" step="any" value={price} onChange={(e) => setPrice(e.target.value)} className="font-mono" />
              </div>
            </div>
          )}

          {isDividend && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Amount Received</Label>
              <Input
                type="number"
                step="any"
                value={price}
                onChange={(e) => {
                  setPrice(e.target.value);
                  setQuantity("1");
                }}
                className="font-mono"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Trade Date</Label>
            <Input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} />
          </div>

          {tradeCurrency === "ARS" && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Dólar MEP Rate</Label>
              <Input
                type="number"
                step="any"
                placeholder="MEP rate at trade date"
                value={mepRate}
                onChange={(e) => setMepRate(e.target.value)}
                className="font-mono"
              />
              {!mepRate && (
                <p className="text-[10px] text-muted-foreground">
                  Ingresá el MEP de la fecha del trade para conversión correcta
                </p>
              )}
            </div>
          )}

          {trade.original_currency === "ARS" && trade.original_price != null && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Original price: 🇦🇷 ARS ${Number(trade.original_price).toFixed(2)}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {trade.journal_notes && (
            <div className="rounded-lg border border-border bg-accent/15 p-3 space-y-2.5 my-2 animate-in fade-in duration-200">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
                <BookOpen className="h-3.5 w-3.5" />
                <span>{t("addTrade.journalTitle")}</span>
              </div>
              <div className="space-y-2 text-xs divide-y divide-border/50">
                {Object.entries(trade.journal_notes as Record<string, string>).map(([key, val]) => {
                  const qNum = key.replace("q", "");
                  const qTranslationKey = `addTrade.journalQ${qNum}`;
                  return (
                    <div key={key} className="pt-2 first:pt-0">
                      <p className="font-semibold text-foreground mb-0.5 leading-relaxed">{t(qTranslationKey as any)}</p>
                      <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{val}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Strategy</Label>
              <Select value={strategyId} onValueChange={setStrategyId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {strategies?.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tags</Label>
              <TagPicker selectedTagIds={selectedTagIds} onToggle={handleTagToggle} />
            </div>
          </div>

          {profile?.brokers_enabled && userBrokers && userBrokers.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Broker</Label>
              <Select value={brokerId} onValueChange={setBrokerId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">—</SelectItem>
                  {userBrokers.map((ub) => (
                    <SelectItem key={ub.broker_id} value={ub.broker_id}>
                      {ub.broker?.name || ub.broker_id}
                      {ub.commission_pct > 0 ? ` (${ub.commission_pct}%)` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter className="flex !justify-between">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete trade?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this {trade.trade_type} of {trade.symbol}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams({
                  symbol: trade.symbol,
                  name: trade.asset_name,
                  type: trade.trade_type,
                  asset: trade.asset_type,
                  price: String(trade.price_per_unit),
                  ...(trade.notes ? { notes: trade.notes } : {}),
                });
                onOpenChange(false);
                navigate(`/add?${params.toString()}`);
              }}
            >
              <Copy className="h-4 w-4 mr-1" />
              Duplicate
            </Button>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
