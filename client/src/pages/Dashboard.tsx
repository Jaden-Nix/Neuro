import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Header } from "@/components/Header";
import { NeuroNetCore } from "@/components/NeuroNetCore";
import { LogStream } from "@/components/LogStream";
import { RiskHeatmap } from "@/components/RiskHeatmap";
import { MetricsDashboard } from "@/components/MetricsDashboard";
import { LiveSystemStatus } from "@/components/LiveSystemStatus";
import { ControlPanel } from "@/components/ControlPanel";
import { TimeWarpSlider } from "@/components/TimeWarpSlider";
import { DeveloperPanel } from "@/components/DeveloperPanel";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  Agent,
  SystemState,
  LiveMetrics,
  LogEntry,
  AgentCreditScore,
  MemoryEntry,
  SimulationBranch,
  ReplayEvent,
} from "@shared/schema";

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
    refetchInterval: 5000, // Reduced polling since we have WS
  });

  // Fetch agents
  const { data: agents = [] } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
    refetchInterval: 5000, // Reduced polling
  });

  // Use WebSocket metrics if available, otherwise fetch
  const { data: fetchedMetrics } = useQuery<LiveMetrics>({
    queryKey: ["/api/metrics"],
    refetchInterval: wsState.connected ? 10000 : 1000,
  });

  // Merge metrics from WebSocket or API
  const metrics = wsState.metrics || fetchedMetrics;

  // Track previous metrics for change calculations
  useEffect(() => {
    if (metrics && metrics !== previousMetrics) {
      setPreviousMetrics(metrics);
    }
  }, [metrics, previousMetrics]);

  // Use WebSocket logs if available, otherwise fetch
  const { data: fetchedLogs = [] } = useQuery<LogEntry[]>({
    queryKey: ["/api/logs"],
    refetchInterval: wsState.connected ? 10000 : 1000, // Less frequent if WS connected
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
      // Invalidate related queries
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
      // Invalidate system state
      queryClient.invalidateQueries({ queryKey: ["/api/system/state"] });
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
    },
  });

  const handleRunSimulation = () => {
    setIsSimulating(true);
    simulationMutation.mutate();
    setTimeout(() => setIsSimulating(false), 3000);
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
    walletBalanceEth: metrics?.walletBalanceEth ?? 0,
    tvlUsd: metrics?.tvlUsd ?? 0,
    currentAPY: metrics?.currentAPY ?? 0,
    riskLevel: metrics?.riskLevel ?? 0,
    activeOpportunities: metrics?.activeOpportunities ?? 0,
    pendingTransactions: metrics?.pendingTransactions ?? 0,
    gasPriceGwei: metrics?.gasPriceGwei ?? 0,
    ethPriceUsd: metrics?.ethPriceUsd ?? 0,
    timestamp: Date.now(),
  };

  const timelineEvents = replayEvents.map((event) => ({
    timestamp: event.timestamp,
    description: `${event.eventType}: ${JSON.stringify(event.data).slice(0, 100)}...`,
  }));

  return (
    <div className="min-h-screen bg-background">
      <Header
        systemHealth={systemState?.systemHealth || 85}
        activeAgents={systemState?.activeAgents?.length || agents.length}
        chainStatus="connected"
        onOpenDevPanel={() => setDevPanelOpen(true)}
      />

      <main className="pt-20 pb-8 px-6">
        <div className="container mx-auto space-y-6">
          {/* Metrics Dashboard */}
          <MetricsDashboard metrics={defaultMetrics} previousMetrics={previousMetrics} />

          {/* Main Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Left Column - Controls */}
            <div className="space-y-4">
              <Card>
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

              <Card>
                <CardContent className="p-5">
                  <RiskHeatmap />
                </CardContent>
              </Card>
            </div>

            {/* Center - Core */}
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardContent className="p-5">
                  <NeuroNetCore
                    agents={agents}
                    systemHealth={systemState?.systemHealth || 85}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Logs */}
            <div>
              <Card className="h-full">
                <CardContent className="p-5 h-full flex flex-col">
                  <LogStream 
                    logs={logs}
                    onClearLogs={() => clearLogsMutation.mutate()}
                    isClearing={clearLogsMutation.isPending}
                  />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Simulations Section - Compact */}
          {simulationTree.length > 0 && (
            <Card>
              <CardContent className="p-5">
                <h3 className="text-base font-semibold mb-3">Active Predictions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-52 overflow-y-auto">
                  {simulationTree.slice(0, 6).map((sim, idx) => (
                    <div key={sim.id} className={`border rounded-md p-3 ${sim.outcome === "success" ? "border-green-500/40 bg-green-500/5" : sim.outcome === "failure" ? "border-red-500/40 bg-red-500/5" : "border-blue-500/30 bg-blue-500/5"}`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-mono text-muted-foreground">#{idx + 1}</span>
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${sim.outcome === "success" ? "bg-green-500/30 text-green-700 dark:text-green-300" : sim.outcome === "failure" ? "bg-red-500/30 text-red-700 dark:text-red-300" : "bg-blue-500/20 text-blue-700 dark:text-blue-300"}`}>
                          {sim.outcome === "success" ? "Viable" : sim.outcome === "failure" ? "Risky" : "Pending"}
                        </span>
                      </div>
                      <div className="space-y-1 text-xs text-muted-foreground">
                        <div>EV: {sim.evScore.toFixed(2)}</div>
                        {sim.predictions[0] && <div>Yield: {sim.predictions[0].yield.toFixed(1)}%</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
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
