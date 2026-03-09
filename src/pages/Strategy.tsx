import { useState } from "react";
import { useStrategies, useCreateStrategy, useUpdateStrategy, useDeleteStrategy, useSetDefaultStrategy, Strategy } from "@/hooks/useStrategies";
import { useStrategyDashboard } from "@/hooks/useStrategyDashboard";
import { useTrades } from "@/hooks/usePortfolio";
import { useLanguage } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Star, Pencil, Trash2, TrendingUp, BarChart3, Waves, DollarSign, Target, Trophy, Percent } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from "recharts";

const ICON_MAP: Record<string, any> = {
  TrendingUp, BarChart3, Waves, DollarSign, Target,
};

const SUGGESTIONS = [
  { name: "Technical Analysis", description: "Chart patterns, indicators, and price action", icon: "BarChart3" },
  { name: "Elliott Wave", description: "Wave theory for market cycle prediction", icon: "Waves" },
  { name: "Fundamental Analysis", description: "Financial statements and intrinsic value", icon: "TrendingUp" },
  { name: "DCA", description: "Dollar-cost averaging into positions over time", icon: "DollarSign" },
  { name: "Swing Trading", description: "Medium-term trades capturing price swings", icon: "Target" },
];

const fmt = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const StrategyPage = () => {
  const { t } = useLanguage();
  const { data: strategies = [], isLoading } = useStrategies();
  const { data: trades = [] } = useTrades();
  const { data: dashboardData, isLoading: dashLoading } = useStrategyDashboard(trades);
  const createStrategy = useCreateStrategy();
  const updateStrategy = useUpdateStrategy();
  const deleteStrategy = useDeleteStrategy();
  const setDefault = useSetDefaultStrategy();

  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createStrategy.mutateAsync({ name: name.trim(), description: description.trim() || undefined, is_default: strategies.length === 0 });
      toast.success(t("strategy.created"));
      setName(""); setDescription(""); setShowAdd(false);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleUpdate = async () => {
    if (!editingId || !name.trim()) return;
    try {
      await updateStrategy.mutateAsync({ id: editingId, name: name.trim(), description: description.trim() || undefined });
      toast.success(t("strategy.updated"));
      setEditingId(null); setName(""); setDescription("");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteStrategy.mutateAsync(id);
      toast.success(t("strategy.deleted"));
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefault.mutateAsync(id);
      toast.success(t("strategy.setDefault"));
    } catch (e: any) { toast.error(e.message); }
  };

  const startEdit = (s: Strategy) => {
    setEditingId(s.id);
    setName(s.name);
    setDescription(s.description || "");
  };

  const handleSuggestion = async (s: typeof SUGGESTIONS[0]) => {
    try {
      await createStrategy.mutateAsync({ name: s.name, description: s.description, icon: s.icon, is_default: strategies.length === 0 });
      toast.success(t("strategy.created"));
    } catch (e: any) { toast.error(e.message); }
  };

  const IconFor = ({ icon }: { icon: string | null }) => {
    const Comp = ICON_MAP[icon || "TrendingUp"] || TrendingUp;
    return <Comp className="h-5 w-5 text-primary" />;
  };

  const hasTradesWithStrategy = dashboardData.some((d) => d.totalTrades > 0);
  const bestStrategy = dashboardData.find((d) => d.totalTrades > 0);
  const bestWinRate = [...dashboardData].filter((d) => d.sells > 0).sort((a, b) => b.winRate - a.winRate)[0];

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl chess-title">{t("strategy.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("strategy.subtitle")}</p>
        </div>
        <Dialog open={showAdd} onOpenChange={setShowAdd}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />{t("common.create")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("strategy.addTitle")}</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("strategy.name")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Swing Trading" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t("strategy.description")}</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("strategy.descPlaceholder")} rows={2} />
              </div>
              <Button onClick={handleCreate} disabled={!name.trim() || createStrategy.isPending} className="w-full">
                {createStrategy.isPending ? t("common.loading") : t("common.create")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Strategy list */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground animate-pulse">{t("common.loading")}</div>
      ) : strategies.length === 0 ? (
        <div className="space-y-6">
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Target className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground text-sm">{t("strategy.empty")}</p>
            </CardContent>
          </Card>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">{t("strategy.suggestions")}</p>
            <div className="grid gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.name}
                  onClick={() => handleSuggestion(s)}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent/50 transition-colors text-left"
                >
                  <IconFor icon={s.icon} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{s.description}</p>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {strategies.map((s) => (
              <Card key={s.id} className={s.is_default ? "border-primary/40" : ""}>
                <CardContent className="flex items-center gap-3 py-4 px-4">
                  <IconFor icon={s.icon} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{s.name}</span>
                      {s.is_default && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{t("strategy.default")}</Badge>}
                    </div>
                    {s.description && <p className="text-xs text-muted-foreground truncate">{s.description}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {!s.is_default && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleSetDefault(s.id)} title={t("strategy.setDefault")}>
                        <Star className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Dialog open={editingId === s.id} onOpenChange={(open) => { if (!open) setEditingId(null); }}>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(s)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>{t("strategy.editTitle")}</DialogTitle></DialogHeader>
                        <div className="space-y-3 pt-2">
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t("strategy.name")}</Label>
                            <Input value={name} onChange={(e) => setName(e.target.value)} />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs text-muted-foreground">{t("strategy.description")}</Label>
                            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
                          </div>
                          <Button onClick={handleUpdate} disabled={!name.trim() || updateStrategy.isPending} className="w-full">
                            {updateStrategy.isPending ? t("common.loading") : t("common.save")}
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t("strategy.deleteTitle")}</AlertDialogTitle>
                          <AlertDialogDescription>{t("strategy.deleteDesc")}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(s.id)}>{t("common.delete")}</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Suggestions for adding more */}
            <div className="pt-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{t("strategy.suggestions")}</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTIONS.filter((s) => !strategies.some((st) => st.name === s.name)).map((s) => (
                  <button
                    key={s.name}
                    onClick={() => handleSuggestion(s)}
                    className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs hover:bg-accent/50 transition-colors"
                  >
                    <Plus className="h-3 w-3" /> {s.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Performance Dashboard */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-primary" />
              {t("strategy.dashboard")}
            </h2>

            {dashLoading ? (
              <div className="animate-pulse text-muted-foreground text-sm text-center py-8">{t("common.loading")}</div>
            ) : !hasTradesWithStrategy ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground text-sm">{t("strategy.noTradesYet")}</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Summary cards */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {bestStrategy && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Trophy className="h-3.5 w-3.5 text-primary" />
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Best Return</p>
                        </div>
                        <p className="text-sm font-semibold truncate">{bestStrategy.strategyName}</p>
                        <p className={`text-lg font-bold font-mono ${bestStrategy.totalReturn >= 0 ? "text-gain" : "text-loss"}`}>
                          {bestStrategy.totalReturn >= 0 ? "+" : ""}${fmt(bestStrategy.totalReturn)}
                        </p>
                      </CardContent>
                    </Card>
                  )}
                  {bestWinRate && (
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Percent className="h-3.5 w-3.5 text-primary" />
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Best Win Rate</p>
                        </div>
                        <p className="text-sm font-semibold truncate">{bestWinRate.strategyName}</p>
                        <p className="text-lg font-bold font-mono text-gain">{bestWinRate.winRate}%</p>
                      </CardContent>
                    </Card>
                  )}
                  <Card>
                    <CardContent className="p-4">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">{t("strategy.totalTrades")}</p>
                      <p className="text-lg font-bold font-mono">
                        {dashboardData.reduce((s, d) => s + d.totalTrades, 0)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        across {dashboardData.filter((d) => d.totalTrades > 0).length} strategies
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {/* Return bar chart */}
                {dashboardData.filter((d) => d.totalTrades > 0).length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">{t("strategy.totalReturn")} by Strategy</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div style={{ height: Math.max(dashboardData.filter((d) => d.totalTrades > 0).length * 48, 120) }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart
                            data={dashboardData.filter((d) => d.totalTrades > 0)}
                            layout="vertical"
                            margin={{ top: 5, right: 20, bottom: 5, left: 90 }}
                          >
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis type="number" tickFormatter={(v) => `$${v}`} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                            <YAxis type="category" dataKey="strategyName" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} width={80} />
                            <ReferenceLine x={0} stroke="hsl(var(--border))" />
                            <Tooltip
                              formatter={(value: number) => [`$${fmt(value)}`, t("strategy.totalReturn")]}
                              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--popover-foreground))" }}
                            />
                            <Bar dataKey="totalReturn" name={t("strategy.totalReturn")} radius={[0, 4, 4, 0]}>
                              {dashboardData.filter((d) => d.totalTrades > 0).map((d) => (
                                <Cell key={d.strategyId} fill={d.totalReturn >= 0 ? "hsl(var(--gain))" : "hsl(var(--loss))"} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Detail table */}
                <Card>
                  <CardContent className="p-0">
                    <div className="overflow-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("strategy.name")}</TableHead>
                            <TableHead className="text-right">{t("strategy.totalTrades")}</TableHead>
                            <TableHead className="text-right">{t("strategy.buys")}</TableHead>
                            <TableHead className="text-right">{t("strategy.sells")}</TableHead>
                            <TableHead className="text-right">{t("strategy.winRate")}</TableHead>
                            <TableHead className="text-right">{t("strategy.avgReturn")}</TableHead>
                            <TableHead className="text-right">{t("strategy.realizedPnl")}</TableHead>
                            <TableHead className="text-right">{t("strategy.dividends")}</TableHead>
                            <TableHead className="text-right">{t("strategy.totalReturn")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {dashboardData.map((d) => (
                            <TableRow key={d.strategyId} className={d.totalTrades === 0 ? "opacity-40" : ""}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <IconFor icon={d.strategyIcon} />
                                  <span className="text-sm font-medium">{d.strategyName}</span>
                                  {d.isDefault && <Badge variant="secondary" className="text-[10px] px-1 py-0">{t("strategy.default")}</Badge>}
                                </div>
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">{d.totalTrades}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{d.buys}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{d.sells}</TableCell>
                              <TableCell className="text-right font-mono text-sm">{d.sells > 0 ? `${d.winRate}%` : "—"}</TableCell>
                              <TableCell className={`text-right font-mono text-sm ${d.avgReturnPerSell >= 0 ? "text-gain" : "text-loss"}`}>
                                {d.sells > 0 ? `${d.avgReturnPerSell >= 0 ? "+" : ""}$${fmt(d.avgReturnPerSell)}` : "—"}
                              </TableCell>
                              <TableCell className={`text-right font-mono text-sm ${d.realizedPnl >= 0 ? "text-gain" : "text-loss"}`}>
                                {d.realizedPnl >= 0 ? "+" : ""}${fmt(d.realizedPnl)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm text-gain">+${fmt(d.dividends)}</TableCell>
                              <TableCell className={`text-right font-mono text-sm font-semibold ${d.totalReturn >= 0 ? "text-gain" : "text-loss"}`}>
                                {d.totalReturn >= 0 ? "+" : ""}${fmt(d.totalReturn)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default StrategyPage;
