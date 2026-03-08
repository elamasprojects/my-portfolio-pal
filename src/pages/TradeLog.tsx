import { useState } from "react";
import { useTrades, Trade } from "@/hooks/usePortfolio";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Trash2, Search } from "lucide-react";
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

const TradeLog = () => {
  const { data: trades = [], isLoading } = useTrades();
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState("all");
  const [filterAsset, setFilterAsset] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = trades.filter((t) => {
    if (filterType !== "all" && t.trade_type !== filterType) return false;
    if (filterAsset !== "all" && t.asset_type !== filterAsset) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      if (!t.symbol.toLowerCase().includes(q) && !t.asset_name.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("trades").delete().eq("id", id);
    if (error) {
      toast.error("Failed to delete trade");
    } else {
      toast.success("Trade deleted");
      queryClient.invalidateQueries({ queryKey: ["trades"] });
    }
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
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground">{new Date(t.trade_date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-mono font-semibold text-primary">{t.symbol}</TableCell>
                    <TableCell className="text-muted-foreground">{t.asset_name}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${t.trade_type === "buy" ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"}`}>
                        {t.trade_type.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="capitalize text-muted-foreground">{t.asset_type}</TableCell>
                    <TableCell className="text-right font-mono">{t.quantity}</TableCell>
                    <TableCell className="text-right font-mono">${Number(t.price_per_unit).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">${Number(t.total_amount).toFixed(2)}</TableCell>
                    <TableCell>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-loss">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete trade?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete this {t.trade_type} of {t.symbol}.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(t.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
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
    </div>
  );
};

export default TradeLog;
