import { useState } from "react";
import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemo } from "../DemoContext";
import { SectionCard } from "../components/SectionCard";
import { Chip } from "../components/Chip";

interface Player {
  name: string;
  returnPct: number;
  trades: number;
  winRate: number;
  you?: boolean;
}

const PEERS: Player[] = [
  { name: "María", returnPct: 22.1, trades: 140, winRate: 71 },
  { name: "Axel", returnPct: 12.4, trades: 88, winRate: 64 },
  { name: "Diego", returnPct: -3.2, trades: 54, winRate: 49 },
];

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function PlayersScreen() {
  const { data } = useDemo();
  const [tab, setTab] = useState<"leaderboard" | "compare">("leaderboard");

  const me: Player = {
    name: "You",
    returnPct: data.totalPnlPct,
    trades: data.totalTrades,
    winRate: data.performance.win_rate,
    you: true,
  };

  const board = [me, ...PEERS].sort((a, b) => b.returnPct - a.returnPct);
  const leader = board[0];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <Chip active={tab === "leaderboard"} onClick={() => setTab("leaderboard")}>
          Leaderboard
        </Chip>
        <Chip active={tab === "compare"} onClick={() => setTab("compare")}>
          Compare
        </Chip>
      </div>

      {tab === "leaderboard" ? (
        <SectionCard title="This month" bodyClassName="space-y-2">
          {board.map((p, i) => {
            const pos = p.returnPct >= 0;
            return (
              <div
                key={p.name}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3",
                  p.you ? "border-primary/40 bg-primary/5" : "bg-card",
                )}
              >
                <div className="w-5 text-center font-mono text-sm font-bold text-muted-foreground">{i + 1}</div>
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-secondary/40 text-xs font-bold">
                  {initials(p.name)}
                  {i === 0 && <Crown className="absolute -right-1.5 -top-2 h-4 w-4 text-primary" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">
                    {p.name}
                    {p.you && <span className="ml-1 text-xs text-primary">(you)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.trades} trades · {p.winRate.toFixed(0)}% win
                  </p>
                </div>
                <span className={cn("font-mono text-sm font-bold", pos ? "text-gain" : "text-loss")}>
                  {pos ? "+" : ""}
                  {p.returnPct.toFixed(1)}%
                </span>
              </div>
            );
          })}
        </SectionCard>
      ) : (
        <SectionCard title={`You vs ${leader.you ? PEERS[0].name : leader.name}`}>
          <div className="grid grid-cols-2 gap-3">
            {[me, leader.you ? PEERS[0] : leader].map((p, idx) => {
              const pos = p.returnPct >= 0;
              return (
                <div key={idx} className="rounded-xl border bg-card p-4 text-center">
                  <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-secondary/40 text-sm font-bold">
                    {initials(p.name)}
                  </div>
                  <p className="text-sm font-semibold">{p.name}</p>
                  <p className={cn("mt-1 font-mono text-xl font-bold", pos ? "text-gain" : "text-loss")}>
                    {pos ? "+" : ""}
                    {p.returnPct.toFixed(1)}%
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.trades} trades · {p.winRate.toFixed(0)}% win
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-center text-xs text-muted-foreground">Peer figures are illustrative (prototype).</p>
        </SectionCard>
      )}
    </div>
  );
}
