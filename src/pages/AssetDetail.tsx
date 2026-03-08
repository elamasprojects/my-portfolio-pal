import { useParams, useNavigate } from "react-router-dom";
import { useTrades, computeHoldings } from "@/hooks/usePortfolio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const AssetDetail = () => {
  const { symbol } = useParams<{ symbol: string }>();
  const navigate = useNavigate();
  const { data: trades = [], isLoading } = useTrades();

  const assetTrades = trades.filter((t) => t.symbol === symbol);
  const holdings = computeHoldings(assetTrades);
  const holding = holdings[0];

  if (isLoading) {
    return <div className="animate-pulse text-muted-foreground text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold font-mono tracking-tight">{symbol}</h1>
          <p className="text-muted-foreground text-sm">{holding?.asset_name || "Asset detail"}</p>
        </div>
      </div>

      {holding && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Quantity</p>
              <p className="text-xl font-bold font-mono mt-1">{holding.net_quantity}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Avg Cost</p>
              <p className="text-xl font-bold font-mono mt-1">${holding.avg_cost.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Invested</p>
              <p className="text-xl font-bold font-mono mt-1">${holding.total_invested.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Type</p>
              <p className="text-xl font-bold capitalize mt-1">{holding.asset_type}</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Trade History</CardTitle>
        </CardHeader>
        <CardContent>
          {assetTrades.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetTrades.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-muted-foreground">{new Date(t.trade_date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <span className={t.trade_type === "buy" ? "text-gain" : "text-loss"}>
                        {t.trade_type.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">{t.quantity}</TableCell>
                    <TableCell className="text-right font-mono">${Number(t.price_per_unit).toFixed(2)}</TableCell>
                    <TableCell className="text-right font-mono">${Number(t.total_amount).toFixed(2)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{t.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-8">No trades for this asset</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AssetDetail;
