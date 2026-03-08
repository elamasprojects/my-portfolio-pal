import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useTrades, Trade, computeHoldings } from "./usePortfolio";

export interface DisciplineRule {
  id?: string;
  user_id?: string;
  rule_type: string;
  rule_value: number | null;
  enabled: boolean;
}

export interface Violation {
  trade: Trade;
  rule_type: string;
  label: string;
  detail: string;
}

export interface RuleResult {
  rule_type: string;
  label: string;
  enabled: boolean;
  threshold: number | null;
  total_checked: number;
  violations_count: number;
  compliance_pct: number;
}

export interface DisciplineScore {
  overall: number;
  rules: RuleResult[];
  violations: Violation[];
}

const RULE_DEFAULTS: { rule_type: string; label: string; default_value: number; description: string }[] = [
  { rule_type: "max_position_pct", label: "Max Position Size", default_value: 10, description: "No single trade exceeds X% of total portfolio value" },
  { rule_type: "always_notes", label: "Always Add Notes", default_value: 1, description: "Every trade should have notes" },
  { rule_type: "max_trade_size", label: "Max Trade Amount", default_value: 5000, description: "No single trade total exceeds $X" },
  { rule_type: "min_diversification", label: "Min Assets Held", default_value: 3, description: "Portfolio holds at least N different symbols" },
];

export { RULE_DEFAULTS };

export function useDisciplineRules() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["discipline_rules", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("discipline_rules" as any)
        .select("*")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data as unknown as DisciplineRule[];
    },
    enabled: !!user,
  });
}

export function useUpsertRule() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rule: { id?: string; rule_type: string; rule_value: number | null; enabled: boolean }) => {
      if (rule.id) {
        const { error } = await supabase
          .from("discipline_rules" as any)
          .update({ rule_value: rule.rule_value, enabled: rule.enabled } as any)
          .eq("id", rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("discipline_rules" as any)
          .insert({ user_id: user!.id, rule_type: rule.rule_type, rule_value: rule.rule_value, enabled: rule.enabled } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["discipline_rules"] });
    },
  });
}

export function computeDiscipline(trades: Trade[], rules: DisciplineRule[]): DisciplineScore {
  const mergedRules = RULE_DEFAULTS.map((def) => {
    const saved = rules.find((r) => r.rule_type === def.rule_type);
    return {
      ...def,
      id: saved?.id,
      enabled: saved ? saved.enabled : true,
      threshold: saved?.rule_value ?? def.default_value,
    };
  });

  const holdings = computeHoldings(trades);
  const totalPortfolioValue = holdings.reduce((sum, h) => sum + h.total_invested, 0);
  const uniqueSymbols = new Set(holdings.map((h) => h.symbol)).size;

  const violations: Violation[] = [];
  const ruleResults: RuleResult[] = [];

  for (const rule of mergedRules) {
    if (!rule.enabled) {
      ruleResults.push({
        rule_type: rule.rule_type,
        label: rule.label,
        enabled: false,
        threshold: rule.threshold,
        total_checked: 0,
        violations_count: 0,
        compliance_pct: 100,
      });
      continue;
    }

    let checked = 0;
    let violated = 0;

    if (rule.rule_type === "max_position_pct") {
      for (const t of trades) {
        if (t.trade_type === "dividend") continue;
        checked++;
        const tradeTotal = t.quantity * t.price_per_unit;
        if (totalPortfolioValue > 0 && (tradeTotal / totalPortfolioValue) * 100 > rule.threshold) {
          violated++;
          violations.push({
            trade: t,
            rule_type: rule.rule_type,
            label: rule.label,
            detail: `Trade was ${((tradeTotal / totalPortfolioValue) * 100).toFixed(1)}% of portfolio (limit: ${rule.threshold}%)`,
          });
        }
      }
    } else if (rule.rule_type === "always_notes") {
      for (const t of trades) {
        checked++;
        if (!t.notes || t.notes.trim() === "") {
          violated++;
          violations.push({
            trade: t,
            rule_type: rule.rule_type,
            label: rule.label,
            detail: `Trade has no notes`,
          });
        }
      }
    } else if (rule.rule_type === "max_trade_size") {
      for (const t of trades) {
        if (t.trade_type === "dividend") continue;
        checked++;
        const tradeTotal = t.quantity * t.price_per_unit;
        if (tradeTotal > rule.threshold) {
          violated++;
          violations.push({
            trade: t,
            rule_type: rule.rule_type,
            label: rule.label,
            detail: `Trade total $${tradeTotal.toFixed(2)} exceeds limit of $${rule.threshold}`,
          });
        }
      }
    } else if (rule.rule_type === "min_diversification") {
      // This is a portfolio-level check, not per-trade
      checked = 1;
      if (uniqueSymbols < rule.threshold) {
        violated = 1;
        violations.push({
          trade: trades[0],
          rule_type: rule.rule_type,
          label: rule.label,
          detail: `Portfolio holds ${uniqueSymbols} assets (minimum: ${rule.threshold})`,
        });
      }
    }

    const compliance = checked > 0 ? ((checked - violated) / checked) * 100 : 100;
    ruleResults.push({
      rule_type: rule.rule_type,
      label: rule.label,
      enabled: true,
      threshold: rule.threshold,
      total_checked: checked,
      violations_count: violated,
      compliance_pct: Math.round(compliance),
    });
  }

  const enabledRules = ruleResults.filter((r) => r.enabled);
  const overall = enabledRules.length > 0
    ? Math.round(enabledRules.reduce((sum, r) => sum + r.compliance_pct, 0) / enabledRules.length)
    : 100;

  return { overall, rules: ruleResults, violations };
}
