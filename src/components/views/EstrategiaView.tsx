import { ThesisAlertsBanner } from "@/components/strategy/ThesisAlertsBanner";
import { InvestmentRulesDashboard } from "@/components/strategy/InvestmentRulesDashboard";
import { OpenTradeThesesDashboard } from "@/components/strategy/OpenTradeThesesDashboard";
import { CandidateWatchlistDashboard } from "@/components/strategy/CandidateWatchlistDashboard";
import { GameReviewDashboard } from "@/components/strategy/GameReviewDashboard";
import { PerformanceMetricsDashboard } from "@/components/strategy/PerformanceMetricsDashboard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Target, Scale, Eye, Award, Compass, BarChart3 } from "lucide-react";

export function EstrategiaView() {
  return (
    <div className="space-y-8 pb-12">
      {/* HEADER SECTION */}
      <div className="border-b border-border/40 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Compass className="h-6 w-6 text-primary" />
          Estrategia
        </h1>
      </div>

      {/* THESIS ALERTS BANNER (Target Reached / Invalidación Hit) */}
      <ThesisAlertsBanner />

      {/* MAIN STRATEGY TABS */}
      <Tabs defaultValue="gamereview" className="space-y-6">
        <TabsList className="flex w-full justify-start gap-1 overflow-x-auto border border-border/60 bg-muted/60 p-1">
          <TabsTrigger value="gamereview" className="shrink-0 text-xs font-semibold flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-primary" />
            Review
          </TabsTrigger>
          <TabsTrigger value="theses" className="shrink-0 text-xs font-semibold flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Tesis
          </TabsTrigger>
          <TabsTrigger value="metrics" className="shrink-0 text-xs font-semibold flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Métricas
          </TabsTrigger>
          <TabsTrigger value="rules" className="shrink-0 text-xs font-semibold flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5" />
            Reglas
          </TabsTrigger>
          <TabsTrigger value="watchlist" className="shrink-0 text-xs font-semibold flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Watchlist
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gamereview" className="space-y-6">
          <GameReviewDashboard />
        </TabsContent>

        <TabsContent value="theses" className="space-y-6">
          <OpenTradeThesesDashboard />
        </TabsContent>

        <TabsContent value="metrics" className="space-y-6">
          <PerformanceMetricsDashboard />
        </TabsContent>

        <TabsContent value="rules" className="space-y-6">
          <InvestmentRulesDashboard />
        </TabsContent>

        <TabsContent value="watchlist" className="space-y-6">
          <CandidateWatchlistDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
