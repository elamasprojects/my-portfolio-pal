import { useState, useMemo, useCallback } from "react";
import { useTrades, Trade } from "@/hooks/usePortfolio";
import { useTags, useTradeTagAssignments, useAssignTag } from "@/hooks/useTags";
import { EditTradeDialog } from "@/components/EditTradeDialog";
import { TagBadges, TagPicker } from "@/components/TagPicker";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Search, Download, Trash2, Tag } from "lucide-react";

function generateCSV(trades: Trade[], tagMap: Map<string, string[]>, tags: { id: string; name: string }[]): string {
  const tagNameMap = new Map(tags.map((t) => [t.id, t.name]));
  const headers = ["Date", "Symbol", "Name", "Type", "Asset", "Quantity", "Price", "Total", "Notes", "Tags"];
  const rows = trades.map((t) => {
    const tradeTagIds = tagMap.get(t.id) || [];
    const tagNames = tradeTagIds.map((id) => tagNameMap.get(id) || "").filter(Boolean).join("; ");
    return [
      new Date(t.trade_date).toLocaleDateString(),
      t.symbol,
      t.asset_name,
      t.trade_type,
      t.asset_type,
      t.trade_type === "dividend" ? "" : String(t.quantity),
      t.trade_type === "dividend" ? "" : String(t.price_per_unit),
      String(t.total_amount),
      t.notes || "",
      tagNames,
    ];
  });

  const escape = (v: string) => (v.includes(",") || v.includes('"') || v.includes("\n") ? `"${v.replace(/"/g, '""')}"` : v);
  return [headers.join(","), ...rows.map((r) => r.map(escape).join(","))].join("\n");
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const TradeLog = () => {
  const { data: trades = [], isLoading } = useTrades();
  const { data: tags = [] } = useTags();
  const queryClient = useQueryClient();
  const assignTag = useAssignTag();
  const tradeIds = useMemo(() => trades.map((t) => t.id), [trades]);
  const { data: tagAssignments = [] } = useTradeTagAssignments(tradeIds);

  const [filterType, setFilterType] = useState("all");
  const [filterAsset, setFilterAsset] = useState("all");
  const [filterTag, setFilterTag] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [editTrade, setEditTrade] = useState<Trade | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const tagMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const a of tagAssignments) {
      const arr = map.get(a.trade_id) || [];
      arr.push(a.tag_id);
      map.set(a.trade_id, arr);
    }
    return map;
  }, [tagAssignments]);

  const filtered = trades.filter((t) => {
    if (filterType !== "all" && t.trade_type !== filterType) return false;
    if (filterAsset !== "all" && t.asset_type !== filterAsset) return false;
    if (filterTag !== "all") {
      const tTagIds = tagMap.get(t.id) || [];
      if (!tTagIds.includes(filterTag)) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!t.symbol.toLowerCase().includes(q) && !t.asset_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const selectionMode = selectedIds.size > 0;
  const allFilteredSelected = filtered.length > 0 && filtered.every((t) => selectedIds.has(t.id));

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((t) => t.id)));
    }
  }, [allFilteredSelected, filtered]);

  const handleBulkDelete = async () => {
    setBulkDeleting(true);
    try {
      const { error } = await supabase.from("trades").delete().in("id", [...selectedIds]);
      if (error) throw error;
      toast.success(`Deleted ${selectedIds.size} trades`);
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["trades"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setBulkDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleBulkTag = async (tagId: string) => {
    try {
      await Promise.all(
        [...selectedIds].map((tradeId) => assignTag.mutateAsync({ tradeId, tagId }))
      );
      toast.success(`Tagged ${selectedIds.size} trades`);
      queryClient.invalidateQueries({ queryKey: ["trade_tag_assignments"] });
    } catch {
      toast.error("Failed to tag some trades");
    }
  };

  const handleExport = (tradesToExport: Trade[]) => {
    const csv = generateCSV(tradesToExport, tagMap, tags);
    downloadCSV(csv, `trades_${new Date().toISOString().split("T")[0]}.csv`);
    toast.success(`Exported ${tradesToExport.length} trades`);
  };

  if (isLoading) {
    return <div className="animate-pulse text-muted-foreground text-center py-12">Loading trades...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trade Log</h1>
        <p className="text-muted-foreground text-sm">All your transactions</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search symbol or name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Trade type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="buy">Buy</SelectItem>
            <SelectItem value="sell">Sell</SelectItem>
            <SelectItem value="dividend">Dividend</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAsset} onValueChange={setFilterAsset}>
          <SelectTrigger className="w-32">
            <SelectValue placeholder="Asset type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assets</SelectItem>
            <SelectItem value="stock">Stock</SelectItem>
            <SelectItem value="etf">ETF</SelectItem>
            <SelectItem value="crypto">Crypto</SelectItem>
            <SelectItem value="bond">Bond</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
        {tags.length > 0 && (
          <Select value={filterTag} onValueChange={setFilterTag}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button variant="outline" size="sm" onClick={() => handleExport(filtered)} className="ml-auto">
          <Download className="h-4 w-4 mr-1" />
          Export CSV
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allFilteredSelected}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Tags</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow
                    key={t.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => {
                      if (!selectionMode) setEditTrade(t);
                    }}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(t.id)}
                        onCheckedChange={() => toggleSelect(t.id)}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{new Date(t.trade_date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono font-semibold text-primary">{t.symbol}</TableCell>
                    <TableCell className="text-muted-foreground">{t.asset_name}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        t.trade_type === "buy"
                          ? "bg-gain/10 text-gain"
                          : t.trade_type === "sell"
                          ? "bg-loss/10 text-loss"
                          : "bg-primary/10 text-primary"
                      }`}>
                        {t.trade_type.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">{t.asset_type}</TableCell>
                    <TableCell className="text-right font-mono">
                      {t.trade_type === "dividend" ? "—" : t.quantity}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {t.trade_type === "dividend" ? "—" : `$${Number(t.price_per_unit).toFixed(2)}`}
                    </TableCell>
                    <TableCell className="text-right font-mono">${Number(t.total_amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <TagBadges tagIds={tagMap.get(t.id) || []} tags={tags} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-12">
              {trades.length === 0 ? "No trades yet" : "No trades match your filters"}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Floating bulk action bar */}
      {selectionMode && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-popover border border-border rounded-xl shadow-lg px-4 py-3 flex items-center gap-3">
          <span className="text-sm font-medium">{selectedIds.size} selected</span>
          <div className="h-5 w-px bg-border" />
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete
          </Button>
          {tags.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Tag className="h-4 w-4 mr-1" />
                  Tag
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-2" align="center" side="top">
                <div className="space-y-1">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => handleBulkTag(tag.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent text-left"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      {tag.name}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const selected = trades.filter((t) => selectedIds.has(t.id));
              handleExport(selected);
            }}
          >
            <Download className="h-4 w-4 mr-1" />
            Export
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} trades?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. All selected trades will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? "Deleting..." : "Delete All"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <EditTradeDialog trade={editTrade} open={!!editTrade} onOpenChange={(open) => !open && setEditTrade(null)} />
    </div>
  );
};

export default TradeLog;
