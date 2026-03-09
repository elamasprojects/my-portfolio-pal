import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Trade } from "@/hooks/usePortfolio";
import { useTags, useTradeTagAssignments, useAssignTag, useRemoveTag } from "@/hooks/useTags";
import { TagPicker } from "@/components/TagPicker";
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
import { Trash2, Loader2, Copy } from "lucide-react";

interface EditTradeDialogProps {
  trade: Trade | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditTradeDialog({ trade, open, onOpenChange }: EditTradeDialogProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { data: allTags = [] } = useTags();
  const { data: assignments = [] } = useTradeTagAssignments(trade ? [trade.id] : []);
  const assignTag = useAssignTag();
  const removeTag = useRemoveTag();

  const [symbol, setSymbol] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetType, setAssetType] = useState("stock");
  const [quantity, setQuantity] = useState("");
  const [price, setPrice] = useState("");
  const [tradeDate, setTradeDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  useEffect(() => {
    if (trade) {
      setSymbol(trade.symbol);
      setAssetName(trade.asset_name);
      setAssetType(trade.asset_type);
      setQuantity(String(trade.quantity));
      setPrice(String(trade.price_per_unit));
      setTradeDate(new Date(trade.trade_date).toISOString().split("T")[0]);
      setNotes(trade.notes || "");
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
      const { error } = await supabase
        .from("trades")
        .update({
          symbol: symbol.toUpperCase(),
          asset_name: assetName,
          asset_type: assetType as any,
          quantity: parseFloat(quantity),
          price_per_unit: parseFloat(price),
          total_amount: parseFloat(quantity) * parseFloat(price),
          trade_date: new Date(tradeDate).toISOString(),
          notes: notes || null,
        })
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
      <DialogContent className="sm:max-w-md">
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
            <span className="text-base ml-1" title={trade.original_currency || "USD"}>
              {(trade.original_currency || "USD") === "ARS" ? "🇦🇷" : "🇺🇸"}
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

          {trade.original_currency === "ARS" && trade.original_price != null && (
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Original price: 🇦🇷 ARS ${Number(trade.original_price).toFixed(2)}
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Tags</Label>
            <TagPicker selectedTagIds={selectedTagIds} onToggle={handleTagToggle} />
          </div>
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
