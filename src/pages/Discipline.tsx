import { useState } from "react";
import { Shield, ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTrades } from "@/hooks/usePortfolio";
import {
  useDisciplineRules,
  useUpsertRule,
  computeDiscipline,
  RULE_DEFAULTS,
  type DisciplineRule,
} from "@/hooks/useDiscipline";
import { format } from "date-fns";
import { useLanguage } from "@/i18n";

function ScoreGauge({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? "hsl(var(--gain))" : score >= 50 ? "hsl(40, 90%, 50%)" : "hsl(var(--loss))";

  return (
    <div className="relative flex items-center justify-center w-40 h-40 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" />
        <circle
          cx="60"
          cy="60"
          r="54"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-foreground font-mono">{score}</span>
        <span className="text-xs text-muted-foreground">/ 100</span>
      </div>
    </div>
  );
}

export default function Discipline() {
  const { t } = useLanguage();
  const { data: trades = [] } = useTrades();
  const { data: savedRules = [], isLoading } = useDisciplineRules();
  const upsertRule = useUpsertRule();
  const [violationsOpen, setViolationsOpen] = useState(false);

  const discipline = computeDiscipline(trades, savedRules);

  const handleToggle = (ruleType: string, enabled: boolean) => {
    const saved = savedRules.find((r) => r.rule_type === ruleType);
    const def = RULE_DEFAULTS.find((d) => d.rule_type === ruleType)!;
    upsertRule.mutate({
      id: saved?.id,
      rule_type: ruleType,
      rule_value: saved?.rule_value ?? def.default_value,
      enabled,
    });
  };

  const handleThreshold = (ruleType: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return;
    const saved = savedRules.find((r) => r.rule_type === ruleType);
    upsertRule.mutate({
      id: saved?.id,
      rule_type: ruleType,
      rule_value: num,
      enabled: saved?.enabled ?? true,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-pulse text-muted-foreground">Loading…</div>
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Shield className="h-16 w-16 text-muted-foreground/40" />
        <h2 className="text-xl font-semibold text-foreground">{t("discipline.noTrades")}</h2>
        <p className="text-muted-foreground text-center max-w-md">{t("discipline.noTradesDesc")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
          <h1 className="text-2xl chess-title flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            {t("discipline.title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("discipline.subtitle")}</p>
      </div>

      {/* Score */}
      <Card>
        <CardContent className="py-8">
          <ScoreGauge score={discipline.overall} />
          <p className="text-center text-sm text-muted-foreground mt-3">
            {discipline.overall >= 80
              ? t("discipline.excellent")
              : discipline.overall >= 50
              ? t("discipline.improve")
              : t("discipline.attention")}
          </p>
        </CardContent>
      </Card>

      {/* Rules Config + Compliance */}
      <div className="grid gap-4 md:grid-cols-2">
        {RULE_DEFAULTS.map((def) => {
          const result = discipline.rules.find((r) => r.rule_type === def.rule_type)!;
          const saved = savedRules.find((r) => r.rule_type === def.rule_type);
          const threshold = saved?.rule_value ?? def.default_value;
          const enabled = saved ? saved.enabled : true;

          return (
            <Card key={def.rule_type}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium">{def.label}</CardTitle>
                  <Switch
                    checked={enabled}
                    onCheckedChange={(v) => handleToggle(def.rule_type, v)}
                  />
                </div>
                <CardDescription className="text-xs">{def.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {def.rule_type !== "always_notes" && (
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">
                      {def.rule_type === "max_position_pct"
                        ? t("discipline.maxPct")
                        : def.rule_type === "max_trade_size"
                        ? t("discipline.maxDollar")
                        : t("discipline.minAssets")}
                    </Label>
                    <Input
                      type="number"
                      className="h-8 w-24 text-sm"
                      defaultValue={threshold}
                      onBlur={(e) => handleThreshold(def.rule_type, e.target.value)}
                      disabled={!enabled}
                    />
                  </div>
                )}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{t("discipline.compliance")}</span>
                    <span className="font-mono">{result.compliance_pct}%</span>
                  </div>
                  <Progress value={result.compliance_pct} className="h-2" />
                </div>
                {result.violations_count > 0 && (
                  <Badge variant="destructive" className="text-xs">
                    {result.violations_count} {result.violations_count > 1 ? t("discipline.violations") : t("discipline.violation")}
                  </Badge>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Violations */}
      {discipline.violations.length > 0 && (
        <Collapsible open={violationsOpen} onOpenChange={setViolationsOpen}>
          <Card>
            <CollapsibleTrigger className="w-full">
              <CardHeader className="flex flex-row items-center justify-between cursor-pointer">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <CardTitle className="text-sm font-medium">
                    {t("discipline.violationsTitle")} ({discipline.violations.length})
                  </CardTitle>
                </div>
                {violationsOpen ? (
                  <ChevronUp className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                )}
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                {discipline.violations.slice(0, 50).map((v, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"
                  >
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {v.label}
                    </Badge>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">
                        {v.trade.symbol} — {v.trade.trade_type.toUpperCase()}
                      </p>
                      <p className="text-xs text-muted-foreground">{v.detail}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(v.trade.trade_date), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
}
