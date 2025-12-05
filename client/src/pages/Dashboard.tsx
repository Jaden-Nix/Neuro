import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/Header";
import { NeuroNetCore } from "@/components/NeuroNetCore";
import { RiskHeatmap } from "@/components/RiskHeatmap";
import { MetricsDashboard } from "@/components/MetricsDashboard";
import { DeveloperPanel } from "@/components/DeveloperPanel";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { cacheMetrics, cachedMetrics } from "@/lib/queryClient";
import { TrendingUp, TrendingDown, Zap, RefreshCw, ArrowRight, Brain, Sparkles } from "lucide-react";
import { Link } from "wouter";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } }
};

import type {
  Agent,
  SystemState,
  LiveMetrics,
  LogEntry,
  AgentCreditScore,
  MemoryEntry,
  SimulationBranch,
} from "@shared/schema";

interface VillageSignal {
  id: string;
  agentId: string;
  agentName?: string;
  agentRole?: string;
  symbol: string;
  direction: "long" | "short";
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2?: number;
  takeProfit3?: number;
  confidence: number;
  timeframe: string;
  reasoning: string;
  technicalAnalysis?: {
    pattern: string;
    indicators: string[];
    keyLevels: { support: number; resistance: number };
  };
  riskReward: number;
  positionSize: string;
  status: "pending" | "active" | "hit_tp" | "hit_sl" | "expired" | "cancelled";
  validators?: Array<{
    agentId: string;
    agentName: string;
    agrees: boolean;
    comment: string;
  }>;
  createdAt: number;
}

export default function Dashboard() {
  const { toast } = useToast();
  const [devPanelOpen, setDevPanelOpen] = useState(false);
  const [previousMetrics, setPreviousMetrics] = useState<LiveMetrics | null>(null);

  const wsState = useWebSocket();

  const { data: systemState } = useQuery<SystemState>({
    queryKey: ["/api/system/state"],
    refetchInterval: 5000,
  });

  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    refetchInterval: 5000,
  });

  const { data: fetchedMetrics } = useQuery<LiveMetrics>({
    queryKey: ["/api/metrics"],
    refetchInterval: 5000,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });

  const { data: villageSignals = [], refetch: refetchSignals } = useQuery<VillageSignal[]>({
    queryKey: ["/api/village/signals"],
    refetchInterval: 10000,
  });

  const metrics = fetchedMetrics || wsState.metrics || cachedMetrics;

  useEffect(() => {
    if (fetchedMetrics) {
      cacheMetrics(fetchedMetrics);
    }
  }, [fetchedMetrics]);

  useEffect(() => {
    if (metrics && metrics !== previousMetrics) {
      setPreviousMetrics(metrics);
    }
  }, [metrics, previousMetrics]);

  const { data: fetchedLogs = [] } = useQuery<LogEntry[]>({
    queryKey: ["/api/logs"],
    refetchInterval: wsState.connected ? 10000 : 1000,
  });

  const { data: fetchedCreditScores = [] } = useQuery<AgentCreditScore[]>({
    queryKey: ["/api/credits"],
    refetchInterval: wsState.connected ? 10000 : 3000,
  });

  const creditScores = wsState.credits.length > 0 ? wsState.credits : fetchedCreditScores;

  const { data: memoryEntries = [] } = useQuery<MemoryEntry[]>({
    queryKey: ["/api/memory"],
    refetchInterval: 5000,
  });

  const { data: fetchedSimulations = [] } = useQuery<SimulationBranch[]>({
    queryKey: ["/api/simulations"],
    refetchInterval: wsState.connected ? 10000 : 3000,
  });

  const logs = useMemo(() => {
    const allLogs = [...fetchedLogs, ...wsState.logs];
    const seenIds = new Set<string>();
    const uniqueLogs = allLogs.filter(log => {
      if (seenIds.has(log.id)) return false;
      seenIds.add(log.id);
      return true;
    });
    return uniqueLogs.sort((a, b) => a.timestamp - b.timestamp).slice(-200);
  }, [fetchedLogs, wsState.logs]);
  const simulationTree = wsState.simulations.length > 0 ? wsState.simulations : fetchedSimulations;

  const activeSignals = villageSignals.filter(s => s.status === "active").slice(0, 4);

  const defaultMetrics: LiveMetrics = {
    ethPriceUsd: metrics?.ethPriceUsd ?? cachedMetrics?.ethPriceUsd ?? 3600,
    btcPriceUsd: metrics?.btcPriceUsd ?? cachedMetrics?.btcPriceUsd ?? 96000,
    totalTvlUsd: metrics?.totalTvlUsd ?? cachedMetrics?.totalTvlUsd ?? 0,
    gasPriceGwei: metrics?.gasPriceGwei ?? 25,
    activeAgents: metrics?.activeAgents ?? 10,
    totalSignals: metrics?.totalSignals ?? activeSignals.length,
    avgWinRate: metrics?.avgWinRate ?? 0,
    totalTrades: metrics?.totalTrades ?? 0,
    riskLevel: metrics?.riskLevel ?? 50,
    activeDebates: metrics?.activeDebates ?? 0,
    timestamp: Date.now(),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header
        systemHealth={systemState?.systemHealth || 85}
        activeAgents={systemState?.activeAgents?.length || agents.length}
        chainStatus="connected"
        onOpenDevPanel={() => setDevPanelOpen(true)}
      />

      <main className="flex-1 pt-4 pb-8 px-6 overflow-auto">
        <motion.div 
          className="container mx-auto space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={itemVariants}>
            <MetricsDashboard metrics={defaultMetrics} previousMetrics={previousMetrics} />
          </motion.div>

          {activeSignals.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card className="shadow-sm border-border/60 dark:border-border/40 bg-card/80 backdrop-blur-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-yellow-500" />
                      <CardTitle className="text-base">Active Trading Signals</CardTitle>
                      <Badge variant="secondary">{activeSignals.length}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => refetchSignals()} data-testid="button-refresh-dashboard-signals">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Link href="/trading">
                        <Button variant="outline" size="sm" data-testid="button-view-all-signals">
                          View All
                          <ArrowRight className="h-4 w-4 ml-1" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                    <AnimatePresence mode="popLayout">
                      {activeSignals.map((signal, idx) => (
                        <motion.div
                          key={signal.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: idx * 0.05 }}
                          className={`border rounded-lg p-3 transition-colors ${
                            signal.direction === "long"
                              ? "border-green-500/30 bg-green-500/5 dark:bg-green-500/10"
                              : "border-red-500/30 bg-red-500/5 dark:bg-red-500/10"
                          }`}
                          data-testid={`signal-card-${signal.id}`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              {signal.direction === "long" ? (
                                <TrendingUp className="h-4 w-4 text-green-500" />
                              ) : (
                                <TrendingDown className="h-4 w-4 text-red-500" />
                              )}
                              <span className="font-semibold text-sm">{signal.symbol}</span>
                            </div>
                            <Badge 
                              variant={signal.direction === "long" ? "default" : "destructive"}
                              className="text-xs"
                            >
                              {signal.direction.toUpperCase()}
                            </Badge>
                          </div>
                          
                          <div className="space-y-1 text-xs text-muted-foreground">
                            <div className="flex justify-between">
                              <span>Entry:</span>
                              <span className="text-foreground font-mono">
                                ${signal.entry != null ? (signal.entry < 0.01 ? signal.entry.toExponential(2) : signal.entry.toLocaleString(undefined, {maximumFractionDigits: 2})) : "Market"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>SL:</span>
                              <span className="text-red-500 font-mono">
                                ${signal.stopLoss != null ? (signal.stopLoss < 0.01 ? signal.stopLoss.toExponential(2) : signal.stopLoss.toLocaleString(undefined, {maximumFractionDigits: 2})) : "-"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>TP:</span>
                              <span className="text-green-500 font-mono">
                                ${signal.takeProfit1 != null ? (signal.takeProfit1 < 0.01 ? signal.takeProfit1.toExponential(2) : signal.takeProfit1.toLocaleString(undefined, {maximumFractionDigits: 2})) : "-"}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>R:R:</span>
                              <span className="text-foreground font-medium">
                                1:{signal.riskReward?.toFixed(1) || "2.0"}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 pt-2 border-t border-border/50 flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">By {signal.agentName || "Agent"}</span>
                            <span className={`font-medium ${
                              signal.confidence >= 0.7 ? "text-green-500" : 
                              signal.confidence >= 0.5 ? "text-yellow-500" : "text-red-500"
                            }`}>
                              {(signal.confidence * 100).toFixed(0)}% conf
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <Card className="h-full shadow-sm border-border/60 dark:border-border/40 bg-card/80 backdrop-blur-sm">
                <CardContent className="p-5">
                  <NeuroNetCore
                    agents={agents}
                    systemHealth={systemState?.systemHealth || 85}
                  />
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants} className="space-y-4">
              <Card className="shadow-sm border-border/60 dark:border-border/40 bg-card/80 backdrop-blur-sm">
                <CardContent className="p-5">
                  <RiskHeatmap />
                </CardContent>
              </Card>

              <Link href="/insights">
                <Card className="shadow-sm border-border/60 dark:border-border/40 bg-card/80 backdrop-blur-sm hover-elevate cursor-pointer group">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Brain className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">AI Insights</h3>
                        <p className="text-xs text-muted-foreground">DeFi opportunities</p>
                      </div>
                      <ArrowRight className="h-4 w-4 ml-auto text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      View yield opportunities analyzed by Scout, Risk, and Execution agents
                    </p>
                  </CardContent>
                </Card>
              </Link>

            </motion.div>
          </div>
        </motion.div>
      </main>

      <DeveloperPanel
        isOpen={devPanelOpen}
        onClose={() => setDevPanelOpen(false)}
        logs={logs}
        creditScores={creditScores}
        memoryEntries={memoryEntries}
        simulationTree={simulationTree}
      />
    </div>
  );
}
