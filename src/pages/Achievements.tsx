import { useTrades, usePortfolios } from "@/hooks/usePortfolio";
import { useTradeTagAssignments } from "@/hooks/useTags";
import { useAchievements } from "@/hooks/useAchievements";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Lock } from "lucide-react";
import { useMemo } from "react";

const Achievements = () => {
  const { data: trades = [], isLoading: tradesLoading } = useTrades();
  const { data: portfolios = [], isLoading: portfoliosLoading } = usePortfolios();
  const tradeIds = useMemo(() => trades.map((t) => t.id), [trades]);
  const { data: assignments = [] } = useTradeTagAssignments(tradeIds);

  const { statuses, progress, total, isLoading } = useAchievements(
    trades,
    portfolios,
    assignments.length
  );

  if (tradesLoading || portfoliosLoading || isLoading) {
    return <div className="animate-pulse text-muted-foreground text-center py-12">Loading...</div>;
  }

  const pct = total > 0 ? (progress / total) * 100 : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Achievements</h1>
        <p className="text-muted-foreground text-sm">
          {progress} of {total} unlocked
        </p>
      </div>

      <div className="space-y-2">
        <Progress value={pct} className="h-3" />
        <p className="text-xs text-muted-foreground text-right font-mono">{Math.round(pct)}%</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {statuses.map((a) => (
          <Card
            key={a.key}
            className={`transition-all ${
              a.unlocked
                ? "border-primary/30 bg-card"
                : "opacity-50 grayscale"
            }`}
          >
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="text-3xl flex-shrink-0">
                  {a.unlocked ? a.emoji : <Lock className="h-7 w-7 text-muted-foreground" />}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm">{a.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{a.description}</p>
                  {a.unlocked && a.unlockedAt && (
                    <p className="text-xs text-muted-foreground/60 mt-1.5 font-mono">
                      {new Date(a.unlockedAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Achievements;
