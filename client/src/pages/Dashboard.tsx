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
    refetchInterval: wsState.connected ? 10000 : 1000, // Less frequent if WS connected
  });

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
  const metrics = wsState.metrics || fetchedMetrics;
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
        <div className="container mx-auto space-y-8">
          {/* Metrics Dashboard */}
          <MetricsDashboard metrics={defaultMetrics} />

          {/* Main Grid Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left Column - Live Status, Control Panel & Risk Heatmap */}
            <div className="space-y-6">
              <LiveSystemStatus />
              
              <Card>
                <CardContent className="p-6">
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
                <CardContent className="p-6">
                  <RiskHeatmap />
                </CardContent>
              </Card>
            </div>

            {/* Center Column - NeuroNet Core */}
            <div className="xl:col-span-1">
              <Card className="h-full">
                <CardContent className="p-6">
                  <NeuroNetCore
                    agents={agents}
                    systemHealth={systemState?.systemHealth || 85}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Log Stream */}
            <div className="space-y-6">
              <Card className="h-[600px]">
                <CardContent className="p-6 h-full">
                  <LogStream logs={logs} />
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Timeline */}
          <TimeWarpSlider events={timelineEvents} />

          {/* Simulations Section */}
          {simulationTree.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-bold mb-4">Simulation Predictions</h3>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {simulationTree.map((sim, idx) => (
                    <div key={sim.id} className="border border-border rounded-md p-3 bg-card/50">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-sm">Branch {idx + 1}</span>
                        <span className={`text-xs px-2 py-1 rounded-md ${sim.outcome === "pending" ? "bg-blue-500/20" : "bg-green-500/20"}`}>
                          {sim.outcome || "pending"}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {sim.predictions.slice(0, 2).map((pred, pidx) => (
                          <div key={pidx} className="space-y-1">
                            <div className="text-muted-foreground">Price: ${pred.price.toFixed(2)}</div>
                            <div className="text-muted-foreground">Yield: {(pred.yield * 100).toFixed(2)}%</div>
                          </div>
                        ))}
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
