import { ThesisAlertsBanner } from "@/components/strategy/ThesisAlertsBanner";
import { InvestmentRulesDashboard } from "@/components/strategy/InvestmentRulesDashboard";
import { OpenTradeThesesDashboard } from "@/components/strategy/OpenTradeThesesDashboard";
import { CandidateWatchlistDashboard } from "@/components/strategy/CandidateWatchlistDashboard";
import { GameReviewDashboard } from "@/components/strategy/GameReviewDashboard";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Target, Scale, Eye, Award, Compass } from "lucide-react";

export function EstrategiaView() {
  return (
    <div className="space-y-8 pb-12">
      {/* HEADER SECTION */}
      <div className="border-b border-border/40 pb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Compass className="h-6 w-6 text-primary" />
          Estrategia & Disciplina de Inversión
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Reglas operativas declaradas, auditoría de tesis pre-trade, Game Review retroactivo y alertas.
        </p>
      </div>

      {/* THESIS ALERTS BANNER (Target Reached / Invalidación Hit) */}
      <ThesisAlertsBanner />

      {/* MAIN STRATEGY TABS */}
      <Tabs defaultValue="gamereview" className="space-y-6">
        <TabsList className="bg-muted/60 p-1 border border-border/60">
          <TabsTrigger value="gamereview" className="text-xs font-semibold flex items-center gap-1.5">
            <Award className="h-3.5 w-3.5 text-primary" />
            Game Review Retroactivo
          </TabsTrigger>
          <TabsTrigger value="theses" className="text-xs font-semibold flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" />
            Tesis Abiertas
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs font-semibold flex items-center gap-1.5">
            <Scale className="h-3.5 w-3.5" />
            Reglas de Inversión
          </TabsTrigger>
          <TabsTrigger value="watchlist" className="text-xs font-semibold flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" />
            Watchlist Candidatas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="gamereview" className="space-y-6">
          <GameReviewDashboard />
        </TabsContent>

        <TabsContent value="theses" className="space-y-6">
          <OpenTradeThesesDashboard />
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
