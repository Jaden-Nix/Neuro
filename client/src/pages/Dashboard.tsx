import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Header } from "@/components/Header";
import { NeuroNetCore } from "@/components/NeuroNetCore";
import { LogStream } from "@/components/LogStream";
import { RiskHeatmap } from "@/components/RiskHeatmap";
import { MetricsDashboard } from "@/components/MetricsDashboard";
import { LiveSystemStatus } from "@/components/LiveSystemStatus";
import { ControlPanel } from "@/components/ControlPanel";
import { TimeWarpSlider } from "@/components/TimeWarpSlider";
import { DeveloperPanel } from "@/components/DeveloperPanel";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiRequest, queryClient, cacheMetrics, cachedMetrics } from "@/lib/queryClient";
import { TrendingUp, TrendingDown, Zap, Target, AlertTriangle, RefreshCw, ArrowRight } from "lucide-react";
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
  ReplayEvent,
  TradingSignal,
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
  const [isSimulating, setIsSimulating] = useState(false);
  const [previousMetrics, setPreviousMetrics] = useState<LiveMetrics | null>(null);

  // WebSocket for real-time updates
  const wsState = useWebSocket();

  // Fetch system state
  const { data: systemState } = useQuery<SystemState>({
    queryKey: ["/api/system/state"],
    refetchInterval: 5000,
  });

  // Fetch agents
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    refetchInterval: 5000,
  });

  // Fetch metrics with caching
  const { data: fetchedMetrics } = useQuery<LiveMetrics>({
    queryKey: ["/api/metrics"],
    refetchInterval: 5000,
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: true,
  });

  // Fetch Trading Village signals for display on dashboard
  const { data: villageSignals = [], refetch: refetchSignals } = useQuery<VillageSignal[]>({
    queryKey: ["/api/village/signals"],
    refetchInterval: 10000,
  });

  // Use cached metrics initially, then switch to fetched data
  const metrics = fetchedMetrics || wsState.metrics || cachedMetrics;

  // Cache metrics when they change
  useEffect(() => {
    if (fetchedMetrics) {
      cacheMetrics(fetchedMetrics);
    }
  }, [fetchedMetrics]);

  // Track previous metrics for change calculations
  useEffect(() => {
    if (metrics && metrics !== previousMetrics) {
      setPreviousMetrics(metrics);
    }
  }, [metrics, previousMetrics]);

  // Use WebSocket logs if available, otherwise fetch
  const { data: fetchedLogs = [] } = useQuery<LogEntry[]>({
    queryKey: ["/api/logs"],
    refetchInterval: wsState.connected ? 10000 : 1000,
  });

  // Use WebSocket credits if available, otherwise fetch
  const { data: fetchedCreditScores = [] } = useQuery<AgentCreditScore[]>({
    queryKey: ["/api/credits"],
    refetchInterval: wsState.connected ? 10000 : 3000,
  });

  const creditScores = wsState.credits.length > 0 ? wsState.credits : fetchedCreditScores;

  // Fetch memory entries
  const { data: memoryEntries = [] } = useQuery<MemoryEntry[]>({
    queryKey: ["/api/memory"],
    refetchInterval: 5000,
  });

  // Fetch current opportunity
  const { data: currentOpportunity } = useQuery({
    queryKey: ["/api/opportunity"],
    refetchInterval: 5000,
  });

  // Use WebSocket simulations if available, otherwise fetch
  const { data: fetchedSimulations = [] } = useQuery<SimulationBranch[]>({
    queryKey: ["/api/simulations"],
    refetchInterval: wsState.connected ? 10000 : 3000,
  });

  // Fetch replay events
  const { data: replayEvents = [] } = useQuery<ReplayEvent[]>({
    queryKey: ["/api/replay/events"],
  });

  // Merge WebSocket and fetched data
  const logs = wsState.logs.length > 0 ? wsState.logs : fetchedLogs;
  const simulationTree = wsState.simulations.length > 0 ? wsState.simulations : fetchedSimulations;

  // Only show confirmed/active signals on Dashboard (pending ones go to Trading Advisor)
  const activeSignals = villageSignals.filter(s => s.status === "active").slice(0, 4);

  // Mutations for control actions
  const simulationMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/simulations/run", {
        timeHorizon: 60,
        branchCount: 5,
        predictionInterval: 10,
      });
    },
    onSuccess: (data: any) => {
      toast({
        title: "Simulation Complete",
        description: `Generated ${data.branches?.length || 5} prediction branches`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/simulations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
    },
    onError: () => {
      toast({
        title: "Simulation Failed",
        description: "An error occurred during simulation.",
        variant: "destructive",
      });
    },
  });

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", "/api/logs", {});
    },
    onSuccess: () => {
      toast({
        title: "Logs Cleared",
        description: "System logs have been cleared and archived",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
    },
    onError: () => {
      toast({
        title: "Clear Failed",
        description: "Could not clear logs",
        variant: "destructive",
      });
    },
  });

  const autonomousMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/autonomous/toggle", {});
    },
    onSuccess: (data: any) => {
      toast({
        title: data.autonomousMode ? "Autonomous Mode Activated" : "Autonomous Mode Deactivated",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/system/state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
    },
  });

  const handleRunSimulation = () => {
    setIsSimulating(true);
    simulationMutation.mutate();
    
    setTimeout(() => {
      if (simulationTree.length > 0) {
        const latestSim = simulationTree[0];
        apiRequest("POST", "/api/memory", {
          agentId: "system",
          agentType: "meta",
          eventType: "simulation_completed",
          outcome: latestSim.outcome,
          evScore: latestSim.evScore,
          predictions: latestSim.predictions,
          timestamp: Date.now(),
          description: `Simulation completed with EV Score: ${latestSim.evScore.toFixed(2)}. Outcome: ${latestSim.outcome}`
        } as any).catch(err => console.error("Failed to save memory:", err));
      }
      setIsSimulating(false);
    }, 3000);
  };

  const handleToggleAutonomous = () => {
    autonomousMutation.mutate();
  };

  const handleManualOverride = () => {
    toast({
      title: "Manual Override Activated",
      description: "All autonomous actions paused. Awaiting manual commands.",
    });
  };

  const handleReplay = () => {
    toast({
      title: "Replay Mode",
      description: "Use the timeline slider to navigate through past events.",
    });
  };

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

  const timelineEvents = replayEvents.map((event) => ({
    timestamp: event.timestamp,
    description: `${event.eventType}: ${JSON.stringify(event.data).slice(0, 100)}...`,
  }));

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
          {/* Metrics Dashboard */}
          <motion.div variants={itemVariants}>
            <MetricsDashboard metrics={defaultMetrics} previousMetrics={previousMetrics} />
          </motion.div>

          {/* Active Trading Signals Section */}
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

          {/* Main Grid Layout - Clean 4 Columns */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Column - Controls */}
            <motion.div variants={itemVariants} className="space-y-4">
              <Card className="shadow-sm border-border/60 dark:border-border/40 bg-card/80 backdrop-blur-sm">
                <CardContent className="p-5">
                  <ControlPanel
                    autonomousMode={systemState?.autonomousMode || false}
                    onRunSimulation={handleRunSimulation}
                    onToggleAutonomous={handleToggleAutonomous}
                    onManualOverride={handleManualOverride}
                    onReplay={handleReplay}
                    isSimulating={isSimulating}
                  />
                </CardContent>
              </Card>

              <Card className="shadow-sm border-border/60 dark:border-border/40 bg-card/80 backdrop-blur-sm">
                <CardContent className="p-5">
                  <RiskHeatmap />
                </CardContent>
              </Card>
            </motion.div>

            {/* Center - Core Visualization */}
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

            {/* Right Column - Logs */}
            <motion.div variants={itemVariants}>
              <Card className="h-full shadow-sm border-border/60 dark:border-border/40 bg-card/80 backdrop-blur-sm">
                <CardContent className="p-5 h-full flex flex-col">
                  <LogStream 
                    logs={logs}
                    onClearLogs={() => clearLogsMutation.mutate()}
                    isClearing={clearLogsMutation.isPending}
                  />
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Timeline Slider */}
          {timelineEvents.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card className="shadow-sm border-border/60 dark:border-border/40 bg-card/80 backdrop-blur-sm">
                <CardContent className="p-5">
                  <TimeWarpSlider events={timelineEvents} onTimeChange={(timestamp) => {
                    console.log("Timeline changed to:", new Date(timestamp).toISOString());
                  }} />
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Simulations Section - Compact */}
          {simulationTree.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card className="shadow-sm border-border/60 dark:border-border/40 bg-card/80 backdrop-blur-sm">
                <CardContent className="p-5">
                  <div className="mb-4">
                    <h3 className="text-base font-semibold mb-2">Future Trading Scenarios</h3>
                    <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg p-3.5 text-sm text-muted-foreground mb-4">
                      <p className="text-xs font-medium mb-2">What this shows:</p>
                      <ul className="space-y-1 text-xs list-disc list-inside text-muted-foreground/80">
                        <li><strong className="text-foreground">EV:</strong> Profit potential score (higher = better opportunity)</li>
                        <li><strong className="text-foreground">Viable/Risky:</strong> How safe this trade is</li>
                        <li><strong className="text-foreground">Yield:</strong> Money you could make if it works</li>
                      </ul>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-52 overflow-y-auto">
                    {simulationTree.slice(0, 6).map((sim, idx) => (
                      <motion.div 
                        key={sim.id} 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.05 }}
                        className={`border rounded-lg p-3.5 transition-colors ${
                          sim.outcome === "success" 
                            ? "border-green-500/30 bg-green-500/5 dark:bg-green-500/10" 
                            : sim.outcome === "failure" 
                              ? "border-red-500/30 bg-red-500/5 dark:bg-red-500/10" 
                              : "border-primary/20 bg-primary/5 dark:bg-primary/10"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            sim.outcome === "success" 
                              ? "bg-green-500/20 text-green-700 dark:text-green-400" 
                              : sim.outcome === "failure" 
                                ? "bg-red-500/20 text-red-700 dark:text-red-400" 
                                : "bg-primary/20 text-primary"
                          }`}>
                            {sim.outcome === "success" ? "Viable" : sim.outcome === "failure" ? "Risky" : "Pending"}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div className="font-medium">EV: <span className="text-foreground">{sim.evScore.toFixed(2)}</span></div>
                          {sim.predictions[0] && <div>Yield: <span className="text-foreground">{sim.predictions[0].yield.toFixed(1)}%</span></div>}
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </main>

      {/* Developer Panel */}
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
