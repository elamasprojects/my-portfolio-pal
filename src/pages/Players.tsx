import { useState, useMemo } from "react";
import { Users, UserPlus, Check, Clock, Search, Trophy, Plus, Crown, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAuth } from "@/hooks/useAuth";
import { useFollows } from "@/hooks/useFollows";
import { useLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid, LineChart, Line, Legend } from "recharts";
import { computeHoldings, computePerformance, computeCumulativePnL, useTrades, type Trade } from "@/hooks/usePortfolio";
import { subDays, subMonths } from "date-fns";

interface Profile {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  username: string | null;
}

export default function Players() {
  const { user } = useAuth();
  const { sentRequests, sendRequest } = useFollows();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedPlayer, setSelectedPlayer] = useState<Profile | null>(null);
  const [showCreateLeaderboard, setShowCreateLeaderboard] = useState(false);
  const [newLeaderboardName, setNewLeaderboardName] = useState("");
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"weekly" | "monthly">("monthly");

  // Search players
  const { data: results = [], isLoading } = useQuery({
    queryKey: ["player-search", search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, username")
        .or(`username.ilike.%${search}%,display_name.ilike.%${search}%`)
        .neq("id", user?.id || "")
        .limit(20);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: search.length >= 2,
  });

  // Connections
  const { data: connections = [], isLoading: loadingConnections } = useQuery({
    queryKey: ["my-connections", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("follow_requests")
        .select("requester_id, target_id")
        .eq("status", "accepted")
        .or(`requester_id.eq.${user.id},target_id.eq.${user.id}`);
      if (error) throw error;

      const otherIds = data.map((r) =>
        r.requester_id === user.id ? r.target_id : r.requester_id
      );
      if (otherIds.length === 0) return [];

      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, display_name, avatar_url, username")
        .in("id", otherIds);
      if (pErr) throw pErr;
      return profiles as Profile[];
    },
    enabled: !!user,
  });

  // Auto-select first connection
  const activePlayer = selectedPlayer || (connections.length > 0 ? connections[0] : null);

  // Fetch selected player summary
  const { data: playerSummary, isLoading: loadingSummary } = useQuery({
    queryKey: ["player-summary", activePlayer?.id],
    queryFn: async () => {
      if (!user || !activePlayer?.id) return null;
      const { data, error } = await supabase.rpc("get_player_summary_by_id" as any, {
        _requester_id: user.id,
        _target_id: activePlayer.id,
      });
      if (error) throw error;
      return data as any;
    },
    enabled: !!user && !!activePlayer?.id,
  });

  // Fetch player's trades directly (RLS allows connected users)
  const { data: playerTrades = [] } = useQuery({
    queryKey: ["player-trades", activePlayer?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", activePlayer!.id)
        .order("trade_date", { ascending: false });
      return (data || []) as Trade[];
    },
    enabled: !!activePlayer?.id,
  });

  // Compute holdings for pie chart
  const holdings = useMemo(() => computeHoldings(playerTrades), [playerTrades]);
  const totalInvested = useMemo(() => holdings.reduce((s, h) => s + h.total_invested, 0), [holdings]);
  const pieData = useMemo(() => 
    holdings.map(h => ({
      name: h.symbol,
      value: totalInvested > 0 ? Math.round((h.total_invested / totalInvested) * 1000) / 10 : 0,
      invested: h.total_invested,
    })),
    [holdings, totalInvested]
  );

  // Compute period PNL %
  const periodPnl = useMemo(() => {
    if (playerTrades.length === 0) return { pnl7d: null, pnl1m: null, pnl3m: null };
    const now = new Date();
    const perf = computePerformance(playerTrades);
    const costBasis = perf.total_cost_basis > 0 ? perf.total_cost_basis : perf.by_symbol.reduce((s, sp) => s + (sp.avg_cost * (sp.open_quantity + sp.total_sells)), 0);
    const totalInvestedForPct = costBasis > 0 ? costBasis : totalInvested;

    const computePeriodPnl = (sinceDate: Date) => {
      const periodTrades = playerTrades.filter(t => new Date(t.trade_date) >= sinceDate);
      const perf = computePerformance(periodTrades);
      const pnl = perf.total_realized_pnl + perf.total_dividends;
      if (totalInvestedForPct <= 0) return null;
      return Math.round((pnl / totalInvestedForPct) * 1000) / 10;
    };

    return {
      pnl7d: computePeriodPnl(subDays(now, 7)),
      pnl1m: computePeriodPnl(subMonths(now, 1)),
      pnl3m: computePeriodPnl(subMonths(now, 3)),
    };
  }, [playerTrades, totalInvested]);

  // Cumulative PNL for the player
  const playerCumulativePnl = useMemo(() => computeCumulativePnL(playerTrades), [playerTrades]);

  // Current user's trades for Compare tab
  const { data: myTrades = [] } = useTrades();
  const myHoldings = useMemo(() => computeHoldings(myTrades), [myTrades]);
  const myTotalInvested = useMemo(() => myHoldings.reduce((s, h) => s + h.total_invested, 0), [myHoldings]);
  const myPieData = useMemo(() =>
    myHoldings.map(h => ({
      name: h.symbol,
      value: myTotalInvested > 0 ? Math.round((h.total_invested / myTotalInvested) * 1000) / 10 : 0,
    })),
    [myHoldings, myTotalInvested]
  );
  const myCumulativePnl = useMemo(() => computeCumulativePnL(myTrades), [myTrades]);

  // Period PNL for current user
  const myPeriodPnl = useMemo(() => {
    if (myTrades.length === 0) return { pnl7d: null, pnl1m: null, pnl3m: null };
    const now = new Date();
    const perf = computePerformance(myTrades);
    const costBasis = perf.total_cost_basis > 0 ? perf.total_cost_basis : perf.by_symbol.reduce((s, sp) => s + (sp.avg_cost * (sp.open_quantity + sp.total_sells)), 0);
    const totalInvestedForPct = costBasis > 0 ? costBasis : myTotalInvested;
    const computePeriodPnl = (sinceDate: Date) => {
      const periodTrades = myTrades.filter(t => new Date(t.trade_date) >= sinceDate);
      const perf = computePerformance(periodTrades);
      const pnl = perf.total_realized_pnl + perf.total_dividends;
      if (totalInvestedForPct <= 0) return null;
      return Math.round((pnl / totalInvestedForPct) * 1000) / 10;
    };
    return {
      pnl7d: computePeriodPnl(subDays(now, 7)),
      pnl1m: computePeriodPnl(subMonths(now, 1)),
      pnl3m: computePeriodPnl(subMonths(now, 3)),
    };
  }, [myTrades, myTotalInvested]);

  // Merged cumulative PNL data for comparison chart
  const comparisonData = useMemo(() => {
    const dateMap = new Map<string, { date: string; you: number; them: number }>();
    for (const p of myCumulativePnl) {
      const entry = dateMap.get(p.date) || { date: p.date, you: 0, them: 0 };
      entry.you = p.cumulative_pnl;
      dateMap.set(p.date, entry);
    }
    for (const p of playerCumulativePnl) {
      const entry = dateMap.get(p.date) || { date: p.date, you: 0, them: 0 };
      entry.them = p.cumulative_pnl;
      dateMap.set(p.date, entry);
    }
    // Forward-fill values
    const sorted = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
    let lastYou = 0, lastThem = 0;
    for (const entry of sorted) {
      if (entry.you === 0 && lastYou !== 0 && !myCumulativePnl.some(p => p.date === entry.date)) entry.you = lastYou;
      if (entry.them === 0 && lastThem !== 0 && !playerCumulativePnl.some(p => p.date === entry.date)) entry.them = lastThem;
      lastYou = entry.you;
      lastThem = entry.them;
    }
    return sorted;
  }, [myCumulativePnl, playerCumulativePnl]);

  const { data: leaderboards = [] } = useQuery({
    queryKey: ["my-leaderboards", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("leaderboards")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const [selectedLeaderboard, setSelectedLeaderboard] = useState<string | null>(null);
  const activeLeaderboardId = selectedLeaderboard || (leaderboards.length > 0 ? leaderboards[0]?.id : null);

  // Rankings
  const { data: rankings, isLoading: loadingRankings } = useQuery({
    queryKey: ["leaderboard-rankings", activeLeaderboardId],
    queryFn: async () => {
      if (!activeLeaderboardId) return [];
      const { data, error } = await supabase.rpc("get_leaderboard_rankings", {
        _leaderboard_id: activeLeaderboardId,
      });
      if (error) throw error;
      if ((data as any)?.error) return [];
      return (data as any[]) || [];
    },
    enabled: !!activeLeaderboardId,
  });

  // Create leaderboard
  const createLeaderboard = useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("leaderboards")
        .insert({ creator_id: user.id, name })
        .select()
        .single();
      if (error) throw error;
      // Auto-add creator as member
      await supabase.from("leaderboard_members").insert({
        leaderboard_id: data.id,
        user_id: user.id,
        joined_at: new Date().toISOString(),
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-leaderboards"] });
      setShowCreateLeaderboard(false);
      setNewLeaderboardName("");
      toast.success(t("social.leaderboardCreated"));
    },
  });

  // Invite to leaderboard
  const inviteToLeaderboard = useMutation({
    mutationFn: async ({ leaderboardId, userId }: { leaderboardId: string; userId: string }) => {
      const { error } = await supabase.from("leaderboard_members").insert({
        leaderboard_id: leaderboardId,
        user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["leaderboard-rankings"] });
      toast.success(t("social.playerInvited"));
    },
  });

  const getRequestStatus = (targetId: string) => {
    const req = sentRequests.find((r) => r.target_id === targetId);
    return req?.status || null;
  };

  const handleRequest = (targetId: string) => {
    sendRequest.mutate(targetId, {
      onSuccess: () => toast.success(t("social.requestSent")),
      onError: (err: any) => toast.error(err.message),
    });
  };

  const hasConnections = connections.length > 0;

  // ---- NO CONNECTIONS: Show search prominently ----
  if (!loadingConnections && !hasConnections) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl chess-title flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            {t("social.playersTitle")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("social.playersSubtitle")}</p>
        </div>
        <Input
          placeholder={t("social.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search.length < 2 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("social.typeToSearch")}</p>
        ) : isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("common.loading")}</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("social.noPlayersFound")}</p>
        ) : (
          <div className="space-y-2">
            {results.map((p) => (
              <SearchResultCard key={p.id} profile={p} status={getRequestStatus(p.id)} onRequest={handleRequest} t={t} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ---- HAS CONNECTIONS: Dashboard view ----
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl chess-title flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" />
            {t("social.playersTitle")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Search popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon"><Search className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-80">
              <Input
                placeholder={t("social.searchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mb-3"
              />
              {search.length >= 2 && (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {isLoading ? (
                    <p className="text-xs text-muted-foreground text-center py-4">{t("common.loading")}</p>
                  ) : results.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">{t("social.noPlayersFound")}</p>
                  ) : (
                    results.map((p) => (
                      <SearchResultCard key={p.id} profile={p} status={getRequestStatus(p.id)} onRequest={handleRequest} t={t} compact />
                    ))
                  )}
                </div>
              )}
            </PopoverContent>
          </Popover>
          {/* Connections popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="icon"><Users className="h-4 w-4" /></Button>
            </PopoverTrigger>
            <PopoverContent className="w-72">
              <p className="text-sm font-medium mb-2">{t("social.myConnections")}</p>
              <div className="space-y-1 max-h-60 overflow-y-auto">
                {connections.map((c) => (
                  <button
                    key={c.id}
                    className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-muted text-left transition-colors"
                    onClick={() => setSelectedPlayer(c)}
                  >
                    <Avatar className="h-7 w-7">
                      {c.avatar_url && <AvatarImage src={c.avatar_url} />}
                      <AvatarFallback className="text-[10px]">
                        {(c.username || "?").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm truncate">{c.username || c.display_name}</span>
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Connection switcher row */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {connections.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelectedPlayer(c)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm transition-colors ${
              activePlayer?.id === c.id
                ? "border-primary bg-primary/10 text-primary"
                : "border-border hover:border-primary/30"
            }`}
          >
            <Avatar className="h-5 w-5">
              {c.avatar_url && <AvatarImage src={c.avatar_url} />}
              <AvatarFallback className="text-[8px]">
                {(c.username || "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="truncate max-w-[100px]">{c.username || c.display_name}</span>
          </button>
        ))}
      </div>

      {/* Main content tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="w-full">
          <TabsTrigger value="overview" className="flex-1">{t("social.overview")}</TabsTrigger>
          <TabsTrigger value="leaderboard" className="flex-1">
            <Trophy className="h-4 w-4 mr-1" /> {t("social.leaderboard")}
          </TabsTrigger>
        </TabsList>

        {/* ---- OVERVIEW TAB ---- */}
        <TabsContent value="overview">
          {loadingSummary ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}><CardContent className="p-4"><Skeleton className="h-8 w-20" /><Skeleton className="h-4 w-16 mt-2" /></CardContent></Card>
              ))}
            </div>
          ) : playerSummary?.error ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("social.notAuthorized")}</p>
          ) : playerSummary ? (
            <div>
              {/* Player header */}
              <div className="flex items-center gap-4 mb-6">
                <Avatar className="h-14 w-14">
                  {playerSummary.avatar_url && <AvatarImage src={playerSummary.avatar_url} />}
                  <AvatarFallback className="text-lg">
                    {(playerSummary.username || playerSummary.display_name || "?").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-lg font-bold">{playerSummary.username || playerSummary.display_name || "Player"}</p>
                  {playerSummary.display_name && playerSummary.username && (
                    <p className="text-sm text-muted-foreground">{playerSummary.display_name}</p>
                  )}
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <StatCard label={t("social.totalTrades")} value={playerSummary.total_trades} />
                <StatCard label={t("social.holdingsCount")} value={playerSummary.holdings_count} />
                <StatCard label={t("social.winRate")} value={`${playerSummary.win_rate}%`} />
              </div>

              {/* Period PNL % cards */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <PnlCard label={t("social.pnl7d")} value={periodPnl.pnl7d} />
                <PnlCard label={t("social.pnl1m")} value={periodPnl.pnl1m} />
                <PnlCard label={t("social.pnl3m")} value={periodPnl.pnl3m} />
              </div>

              {/* Portfolio pie chart */}
              {pieData.length > 0 && (
                <Card>
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("social.portfolioAllocation")}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <PortfolioPieChart data={pieData} />
                  </CardContent>
                </Card>
              )}

              {/* Cumulative PNL timeline */}
              {playerCumulativePnl.length > 0 && (
                <Card className="mt-4">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-medium text-muted-foreground">{t("social.cumulativePnl")}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <CumulativePnlChart data={playerCumulativePnl} />
                  </CardContent>
                </Card>
              )}
            </div>
          ) : null}
        </TabsContent>

        {/* ---- LEADERBOARD TAB ---- */}
        <TabsContent value="leaderboard">
          <div className="space-y-4">
            {/* Leaderboard header */}
            <div className="flex items-center justify-between">
              {leaderboards.length > 0 && (
                <div className="flex gap-2 overflow-x-auto">
                  {leaderboards.map((lb) => (
                    <button
                      key={lb.id}
                      onClick={() => setSelectedLeaderboard(lb.id)}
                      className={`px-3 py-1 rounded-full border text-sm transition-colors ${
                        activeLeaderboardId === lb.id
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:border-primary/30"
                      }`}
                    >
                      {lb.name}
                    </button>
                  ))}
                </div>
              )}
              <Button size="sm" variant="outline" onClick={() => setShowCreateLeaderboard(true)}>
                <Plus className="h-4 w-4 mr-1" /> {t("social.createLeaderboard")}
              </Button>
            </div>

            {/* Create leaderboard dialog */}
            <Dialog open={showCreateLeaderboard} onOpenChange={setShowCreateLeaderboard}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("social.createLeaderboard")}</DialogTitle>
                  <DialogDescription>{t("social.leaderboardName")}</DialogDescription>
                </DialogHeader>
                <Input
                  placeholder={t("social.leaderboardName")}
                  value={newLeaderboardName}
                  onChange={(e) => setNewLeaderboardName(e.target.value)}
                />
                <Button
                  onClick={() => newLeaderboardName.trim() && createLeaderboard.mutate(newLeaderboardName.trim())}
                  disabled={!newLeaderboardName.trim() || createLeaderboard.isPending}
                >
                  {t("common.create")}
                </Button>
              </DialogContent>
            </Dialog>

            {activeLeaderboardId && (
              <>
                {/* Period toggle */}
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={leaderboardPeriod === "weekly" ? "default" : "outline"}
                    onClick={() => setLeaderboardPeriod("weekly")}
                  >
                    {t("social.thisWeek")}
                  </Button>
                  <Button
                    size="sm"
                    variant={leaderboardPeriod === "monthly" ? "default" : "outline"}
                    onClick={() => setLeaderboardPeriod("monthly")}
                  >
                    {t("social.thisMonth")}
                  </Button>
                </div>

                {/* Invite connections */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button size="sm" variant="outline">
                      <UserPlus className="h-4 w-4 mr-1" /> {t("social.inviteToLeaderboard")}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72">
                    <p className="text-sm font-medium mb-2">{t("social.inviteToLeaderboard")}</p>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {connections.map((c) => (
                        <div key={c.id} className="flex items-center justify-between p-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              {c.avatar_url && <AvatarImage src={c.avatar_url} />}
                              <AvatarFallback className="text-[8px]">
                                {(c.username || "?").slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{c.username || c.display_name}</span>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              inviteToLeaderboard.mutate({
                                leaderboardId: activeLeaderboardId,
                                userId: c.id,
                              })
                            }
                          >
                            <UserPlus className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Podium + Rankings */}
                {loadingRankings ? (
                  <div className="space-y-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-12 w-full" />
                    ))}
                  </div>
                ) : rankings && rankings.length > 0 ? (
                  <div className="space-y-6">
                    {/* Podium */}
                    <Podium
                      rankings={rankings}
                      period={leaderboardPeriod}
                      t={t}
                    />
                    {/* Full list */}
                    <div className="space-y-2">
                      {rankings.map((r: any, i: number) => {
                        const pnl = leaderboardPeriod === "weekly" ? Number(r.weekly_pnl) : Number(r.monthly_pnl);
                        return (
                          <Card key={r.user_id}>
                            <CardContent className="flex items-center gap-3 p-3">
                              <span className="text-sm font-mono w-6 text-center text-muted-foreground">#{i + 1}</span>
                              <Avatar className="h-8 w-8">
                                {r.avatar_url && <AvatarImage src={r.avatar_url} />}
                                <AvatarFallback className="text-[10px]">
                                  {(r.username || "?").slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm font-medium flex-1 truncate">{r.username || r.display_name}</span>
                              <span className={`text-sm font-mono font-bold ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                                ${pnl.toFixed(2)}
                              </span>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">{t("social.noRankings")}</p>
                )}
              </>
            )}

            {!activeLeaderboardId && leaderboards.length === 0 && (
              <div className="text-center py-12">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">{t("social.noLeaderboards")}</p>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---- Sub-components ----

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs text-muted-foreground font-normal">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className={`text-xl font-bold font-mono ${color || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function SearchResultCard({
  profile,
  status,
  onRequest,
  t,
  compact,
}: {
  profile: Profile;
  status: string | null;
  onRequest: (id: string) => void;
  t: (key: string) => string;
  compact?: boolean;
}) {
  return (
    <Card>
      <CardContent className={`flex items-center gap-3 ${compact ? "p-2" : "p-4"}`}>
        <Avatar className={compact ? "h-7 w-7" : "h-10 w-10"}>
          {profile.avatar_url && <AvatarImage src={profile.avatar_url} />}
          <AvatarFallback className="text-xs">
            {(profile.username || profile.display_name || "?").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className={`font-medium truncate ${compact ? "text-xs" : "text-sm"}`}>
            {profile.username || profile.display_name}
          </p>
        </div>
        {status === "accepted" ? (
          <Button size="sm" variant="secondary" disabled>
            <Check className="h-4 w-4 mr-1" /> {t("social.connected")}
          </Button>
        ) : status === "pending" ? (
          <Button size="sm" variant="outline" disabled>
            <Clock className="h-4 w-4 mr-1" /> {t("social.pending")}
          </Button>
        ) : (
          <Button size="sm" onClick={() => onRequest(profile.id)}>
            <UserPlus className="h-4 w-4 mr-1" /> {!compact && t("social.requestAccess")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function Podium({ rankings, period, t }: { rankings: any[]; period: string; t: (k: string) => string }) {
  const sorted = [...rankings].sort((a, b) => {
    const aVal = period === "weekly" ? Number(a.weekly_pnl) : Number(a.monthly_pnl);
    const bVal = period === "weekly" ? Number(b.weekly_pnl) : Number(b.monthly_pnl);
    return bVal - aVal;
  });
  const top3 = sorted.slice(0, 3);
  if (top3.length === 0) return null;

  const medals = [
    { icon: Crown, color: "text-yellow-500", bg: "bg-yellow-500/10", height: "h-28" },
    { icon: Medal, color: "text-gray-400", bg: "bg-gray-400/10", height: "h-20" },
    { icon: Medal, color: "text-amber-700", bg: "bg-amber-700/10", height: "h-16" },
  ];

  // Display order: 2nd, 1st, 3rd
  const displayOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3.length === 2 ? [top3[1], top3[0]] : [top3[0]];
  const medalOrder = top3.length >= 3 ? [1, 0, 2] : top3.length === 2 ? [1, 0] : [0];

  return (
    <div className="flex items-end justify-center gap-3 pt-6">
      {displayOrder.map((r, displayIdx) => {
        const rank = medalOrder[displayIdx];
        const medal = medals[rank];
        const MedalIcon = medal.icon;
        const pnl = period === "weekly" ? Number(r.weekly_pnl) : Number(r.monthly_pnl);
        return (
          <div key={r.user_id} className="flex flex-col items-center gap-2">
            <MedalIcon className={`h-5 w-5 ${medal.color}`} />
            <Avatar className="h-10 w-10 border-2 border-primary/30">
              {r.avatar_url && <AvatarImage src={r.avatar_url} />}
              <AvatarFallback className="text-xs">
                {(r.username || "?").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <p className="text-xs font-medium truncate max-w-[80px]">{r.username}</p>
            <div className={`${medal.bg} ${medal.height} w-20 rounded-t-lg flex items-center justify-center`}>
              <span className={`text-xs font-mono font-bold ${pnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                ${pnl.toFixed(0)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
  "hsl(262 83% 58%)",
  "hsl(0 84% 60%)",
  "hsl(199 89% 48%)",
  "hsl(330 81% 60%)",
];

function PortfolioPieChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <div className="w-full h-[250px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={90}
            innerRadius={45}
            dataKey="value"
            nameKey="name"
            label={({ name, value }) => `${name} ${value}%`}
            labelLine={false}
            strokeWidth={1}
            stroke="hsl(var(--background))"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [`${value}%`, ""]}
            contentStyle={{
              backgroundColor: "hsl(var(--background))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              fontSize: "12px",
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function PnlCard({ label, value }: { label: string; value: number | null }) {
  const display = value !== null ? `${value >= 0 ? "+" : ""}${value}%` : "—";
  const color = value === null ? "" : value >= 0 ? "text-green-500" : "text-red-500";
  return (
    <Card>
      <CardHeader className="pb-1 pt-4 px-4">
        <CardTitle className="text-xs text-muted-foreground font-normal">{label}</CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <p className={`text-xl font-bold font-mono ${color}`}>{display}</p>
      </CardContent>
    </Card>
  );
}
