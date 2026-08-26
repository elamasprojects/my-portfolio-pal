import { useState } from "react";
import { useTrades } from "@/hooks/usePortfolio";
import { useDisciplineRules, useUpsertRule, computeDiscipline, RULE_DEFAULTS } from "@/hooks/useDiscipline";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ShieldAlert, CheckCircle2, AlertTriangle, Scale, Plus, Edit2 } from "lucide-react";

export function InvestmentRulesDashboard() {
  const { data: trades = [] } = useTrades();
  const { data: rules = [], isLoading } = useDisciplineRules();
  const upsertRule = useUpsertRule();

  const disciplineScore = computeDiscipline(trades, rules);

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedRuleType, setSelectedRuleType] = useState<string>("");
  const [ruleValue, setRuleValue] = useState<number | "">("");

  const handleToggleRule = async (ruleType: string, currentEnabled: boolean, threshold: number | null) => {
    const savedRule = rules.find((r) => r.rule_type === ruleType);
    try {
      await upsertRule.mutateAsync({
        id: savedRule?.id,
        rule_type: ruleType,
        rule_value: threshold,
        enabled: !currentEnabled,
      });
      toast.success("Regla de inversión actualizada");
    } catch (err: any) {
      toast.error("Error al actualizar regla");
    }
  };

  const handleSaveThreshold = async () => {
    if (!selectedRuleType || ruleValue === "") return;
    const savedRule = rules.find((r) => r.rule_type === selectedRuleType);
    try {
      await upsertRule.mutateAsync({
        id: savedRule?.id,
        rule_type: selectedRuleType,
        rule_value: Number(ruleValue),
        enabled: savedRule ? savedRule.enabled : true,
      });
      toast.success("Umbral de regla actualizado");
      setEditModalOpen(false);
    } catch (err: any) {
      toast.error("Error al guardar umbral");
    }
  };

  return (
    <div className="space-y-6">
      {/* DISCIPLINE SCORE SUMMARY TILE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-card border border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              Score de Disciplina
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-3">
              <span className={`text-4xl font-extrabold tracking-tight ${
                disciplineScore.overall >= 80 ? "text-emerald-400" : disciplineScore.overall >= 60 ? "text-amber-400" : "text-destructive"
              }`}>
                {disciplineScore.overall}%
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                cumplimiento de reglas declaradas
              </span>
            </div>
            <div className="w-full bg-secondary h-2.5 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  disciplineScore.overall >= 80 ? "bg-emerald-400" : disciplineScore.overall >= 60 ? "bg-amber-400" : "bg-destructive"
                }`}
                style={{ width: `${disciplineScore.overall}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2 bg-card border border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400" />
              Violaciones de Reglas Activas ({disciplineScore.violations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {disciplineScore.violations.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium py-3">
                <CheckCircle2 className="h-4 w-4" />
                No hay violaciones activas a las reglas de inversión declaradas. ¡Excelente disciplina!
              </div>
            ) : (
              <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                {disciplineScore.violations.map((v, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-destructive/10 border border-destructive/20 text-xs">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      <span className="font-bold text-foreground">{v.trade?.symbol || "Global"}:</span>
                      <span className="text-muted-foreground">{v.detail}</span>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-destructive/30 text-destructive">
                      {v.label}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* DECLARED RULES MANAGEMENT CARD */}
      <Card className="bg-card border border-border/80">
        <CardHeader>
          <CardTitle className="text-base font-semibold">Reglas de Inversión Declaradas</CardTitle>
          <CardDescription className="text-xs">
            Parámetros y límites cuantitativos para auditoría continua de disciplina operativa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {disciplineScore.rules.map((rule) => {
              const def = RULE_DEFAULTS.find((d) => d.rule_type === rule.rule_type);
              return (
                <div key={rule.rule_type} className="p-4 rounded-lg bg-background/60 border border-border/60 flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-foreground">{rule.label}</span>
                      <Badge variant="outline" className="text-[10px] font-mono">
                        {rule.compliance_pct}% Cumplimiento
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{def?.description}</p>
                    <div className="text-xs font-mono text-primary font-medium mt-2">
                      Umbral actual: {rule.threshold}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setSelectedRuleType(rule.rule_type);
                        setRuleValue(rule.threshold ?? 0);
                        setEditModalOpen(true);
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Switch
                      checked={rule.enabled}
                      onCheckedChange={() => handleToggleRule(rule.rule_type, rule.enabled, rule.threshold)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* EDIT RULE THRESHOLD MODAL */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Editar Umbral de Regla</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Nuevo Umbral</Label>
            <Input
              type="number"
              value={ruleValue}
              onChange={(e) => setRuleValue(e.target.value ? Number(e.target.value) : "")}
              className="text-sm font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSaveThreshold}>
              Guardar Umbral
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
