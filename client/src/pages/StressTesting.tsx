import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  FlaskConical,
  Zap,
  TrendingDown,
  AlertTriangle,
  Activity,
  Play,
  Pause,
  RotateCcw,
  Check,
  X,
  Clock,
  Shield,
  DollarSign,
  BarChart3,
  Gauge,
  Brain,
  Search,
  Target,
  ChevronRight
} from "lucide-react";
type AgentTypeKey = "meta" | "scout" | "risk" | "execution";

const scenarioIcons: Record<string, typeof TrendingDown> = {
  flash_crash: TrendingDown,
  high_volatility: Activity,
  liquidity_crisis: DollarSign,
  chain_congestion: Clock,
  oracle_failure: AlertTriangle,
  mev_attack: Zap,
  custom: FlaskConical,
};

const agentIcons: Record<string, typeof Brain> = {
  meta: Brain,
  scout: Search,
  risk: Shield,
  execution: Target,
};

const severityColors: Record<string, string> = {
  low: "text-green-400 bg-green-500/10 border-green-500/30",
  medium: "text-yellow-400 bg-yellow-500/10 border-yellow-500/30",
  high: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  critical: "text-red-400 bg-red-500/10 border-red-500/30",
};

const scenarioPresets = [
  {
    type: "flash_crash",
    name: "Flash Crash Scenario",
    description: "Simulate a sudden 30% price drop across major assets",
    severity: "critical",
    parameters: { priceDropPercent: 30, durationSeconds: 60, affectedPairs: ["ETH/USDC", "BTC/USDC"] },
  },
  {
    type: "high_volatility",
    name: "High Volatility Event",
    description: "Extended period of extreme market volatility",
    severity: "high",
    parameters: { volatilityMultiplier: 5, durationMinutes: 30, marketSentiment: "panic" },
  },
  {
    type: "liquidity_crisis",
    name: "Liquidity Crisis",
    description: "Major liquidity withdrawal from DEX pools",
    severity: "high",
    parameters: { liquidityDropPercent: 80, affectedPools: ["Uniswap V3", "Curve"], spreadIncrease: 500 },
  },
  {
    type: "chain_congestion",
    name: "Chain Congestion",
    description: "Network congestion with high gas prices",
    severity: "medium",
    parameters: { gasMultiplier: 10, confirmationDelay: 30, pendingTxCount: 50000 },
  },
  {
    type: "oracle_failure",
    name: "Oracle Failure",
    description: "Price oracle becomes stale or returns incorrect data",
    severity: "critical",
    parameters: { affectedOracles: ["Chainlink", "Pyth"], staleTimeMinutes: 15, priceDeviation: 25 },
  },
  {
    type: "mev_attack",
    name: "MEV Attack",
    description: "Coordinated sandwich attack on protocol transactions",
    severity: "high",
    parameters: { attackerBots: 5, frontrunPercent: 2, victimTxCount: 100 },
  },
];

function AgentResponseCard({ agentType, response, isActive }: { agentType: string; response?: string; isActive: boolean }) {
  const Icon = agentIcons[agentType];
  
  return (
    <Card className={`transition-all ${isActive ? "border-primary" : ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-full ${isActive ? "bg-primary/20" : "bg-muted"}`}>
            <Icon className={`w-5 h-5 ${isActive ? "text-primary animate-pulse" : "text-muted-foreground"}`} />
          </div>
          <CardTitle className="text-sm capitalize">{agentType} Agent</CardTitle>
          {isActive && <Badge variant="default" className="ml-auto animate-pulse">Responding</Badge>}
        </div>
      </CardHeader>
      <CardContent>
        {response ? (
          <p className="text-sm leading-relaxed">{response}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Waiting for response...</p>
        )}
      </CardContent>
    </Card>
  );
}

function ScenarioPresetCard({ preset, onSelect }: { preset: typeof scenarioPresets[0]; onSelect: () => void }) {
  const Icon = scenarioIcons[preset.type] || FlaskConical;
  
  return (
    <Card className="hover-elevate cursor-pointer transition-all" onClick={onSelect}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${severityColors[preset.severity]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold">{preset.name}</h3>
              <Badge variant="outline" className={severityColors[preset.severity]}>
                {preset.severity}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{preset.description}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface LocalScenario {
  id: string;
  name: string;
  description: string;
  scenarioType: string;
  severity: string;
  status: string;
  createdAt: string;
  startedAt?: string;
  resultData?: {
    vulnerabilitiesFound?: { severity: string; description: string; mitigation: string }[];
    recommendations?: string[];
    agentPerformance?: Record<string, { decisionTime: number; accuracy: number; adaptability: number }>;
  };
  parameters?: Record<string, any>;
}

function LiveScenarioView({ scenario, onBack }: { scenario: LocalScenario; onBack: () => void }) {
  const [progress, setProgress] = useState(0);
  const [activeAgent, setActiveAgent] = useState<string | null>("meta");
  const [responses, setResponses] = useState<Record<string, string>>({
    meta: "",
    scout: "",
    risk: "",
    execution: "",
  });

  const completeScenario = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/stress/runs/${scenario.id}/execute`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stress/runs"] });
    },
  });

  useEffect(() => {
    if (scenario.status !== "running") return;

    const agents: string[] = ["meta", "scout", "risk", "execution"];
    const agentResponses: Record<string, string[]> = {
      meta: [
        "Detecting anomalous market conditions. Activating defensive protocols.",
        "System-wide coordination initiated. All agents switching to crisis mode.",
        "Risk parameters recalibrated. Reducing exposure by 50%.",
      ],
      scout: [
        "Scanning alternative liquidity sources across 5 DEXes.",
        "Identified 3 potential arbitrage opportunities despite chaos.",
        "Market depth analysis complete. Recommending position sizing adjustments.",
      ],
      risk: [
        "VaR limits exceeded. Implementing position reduction protocol.",
        "Correlation matrix updated for stressed conditions.",
        "Portfolio delta hedging initiated. Target: neutral exposure.",
      ],
      execution: [
        "Gas optimization engaged. Using private mempool for safety.",
        "Slippage tolerance adjusted to 5%. Implementing TWAP execution.",
        "Transaction routing through Flashbots to prevent sandwich attacks.",
      ],
    };

    let step = 0;
    const interval = setInterval(() => {
      step++;
      setProgress(Math.min(step * 5, 100));

      const agentIndex = Math.floor(step / 5) % agents.length;
      setActiveAgent(agents[agentIndex]);

      if (step % 5 === 0) {
        const agent = agents[(agentIndex + 3) % agents.length];
        const possibleResponses = agentResponses[agent];
        const newResponse = possibleResponses[Math.floor(Math.random() * possibleResponses.length)];
        setResponses(prev => ({
          ...prev,
          [agent]: prev[agent] ? prev[agent] + "\n\n" + newResponse : newResponse,
        }));
      }

      if (step >= 20) {
        clearInterval(interval);
        setActiveAgent(null);
        completeScenario.mutate();
      }
    }, 500);

    return () => clearInterval(interval);
  }, [scenario.status]);

  const Icon = scenarioIcons[scenario.scenarioType] || FlaskConical;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} data-testid="button-back-scenarios">
          <ChevronRight className="w-4 h-4 rotate-180 mr-2" />
          Back to Scenarios
        </Button>
        <Badge variant={scenario.status === "running" ? "default" : scenario.status === "completed" ? "secondary" : "destructive"}>
          {scenario.status === "running" && <Activity className="w-3 h-3 mr-1 animate-pulse" />}
          {scenario.status}
        </Badge>
      </div>

      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className={`p-3 rounded-lg ${severityColors[scenario.severity]}`}>
              <Icon className="w-8 h-8" />
            </div>
            <div className="flex-1">
              <CardTitle>{scenario.name}</CardTitle>
              <CardDescription>{scenario.description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Scenario Progress</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-3" />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(["meta", "scout", "risk", "execution"] as AgentTypeKey[]).map((agent) => (
              <AgentResponseCard
                key={agent}
                agentType={agent}
                response={responses[agent]}
                isActive={activeAgent === agent && scenario.status === "running"}
              />
            ))}
          </div>

          {scenario.status === "completed" && scenario.resultData && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Analysis Results
              </h3>
              
              {scenario.resultData.vulnerabilitiesFound && scenario.resultData.vulnerabilitiesFound.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Vulnerabilities Found</h4>
                  {scenario.resultData.vulnerabilitiesFound.map((vuln: { severity: string; description: string; mitigation: string }, idx: number) => (
                    <div key={idx} className={`p-3 rounded-lg border ${severityColors[vuln.severity]}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium capitalize">{vuln.severity}</span>
                      </div>
                      <p className="text-sm">{vuln.description}</p>
                      <p className="text-xs mt-1 opacity-75">Mitigation: {vuln.mitigation}</p>
                    </div>
                  ))}
                </div>
              )}

              {scenario.resultData.recommendations && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Recommendations</h4>
                  <div className="space-y-1">
                    {scenario.resultData.recommendations.map((rec: string, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 text-sm p-2 rounded bg-muted/50">
                        <Check className="w-4 h-4 text-green-400" />
                        {rec}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function NewScenarioDialog({ onCreated }: { onCreated: () => void }) {
  const [selectedPreset, setSelectedPreset] = useState<typeof scenarioPresets[0] | null>(null);
  const [open, setOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPreset) return;
      return apiRequest("POST", "/api/stress/runs", {
        name: selectedPreset.name,
        description: selectedPreset.description,
        scenarioType: selectedPreset.type,
        severity: selectedPreset.severity,
        parameters: selectedPreset.parameters,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stress/runs"] });
      setOpen(false);
      setSelectedPreset(null);
      onCreated();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-scenario">
          <FlaskConical className="w-4 h-4 mr-2" />
          New Stress Test
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Stress Test Scenario</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 pt-4">
          {scenarioPresets.map((preset) => (
            <ScenarioPresetCard
              key={preset.type}
              preset={preset}
              onSelect={() => setSelectedPreset(preset)}
            />
          ))}
        </div>
        {selectedPreset && (
          <div className="flex items-center justify-between pt-4 border-t">
            <div>
              <p className="font-medium">Selected: {selectedPreset.name}</p>
              <p className="text-sm text-muted-foreground">Ready to launch scenario</p>
            </div>
            <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              <Play className="w-4 h-4 mr-2" />
              {createMutation.isPending ? "Launching..." : "Launch Test"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ScenarioListCard({ scenario, onSelect }: { scenario: LocalScenario; onSelect: () => void }) {
  const Icon = scenarioIcons[scenario.scenarioType] || FlaskConical;
  
  return (
    <Card className="hover-elevate cursor-pointer transition-all" onClick={onSelect} data-testid={`card-scenario-${scenario.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${severityColors[scenario.severity]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-semibold truncate">{scenario.name}</h3>
              <Badge 
                variant={scenario.status === "running" ? "default" : scenario.status === "completed" ? "secondary" : "destructive"}
              >
                {scenario.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">{scenario.description}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {new Date(scenario.startedAt || scenario.createdAt).toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function StressTesting() {
  const [selectedScenario, setSelectedScenario] = useState<LocalScenario | null>(null);

  const { data: scenarios = [], isLoading } = useQuery<LocalScenario[]>({
    queryKey: ["/api/stress/runs"],
    refetchInterval: 3000,
  });

  if (selectedScenario) {
    const latest = scenarios.find(s => s.id === selectedScenario.id) || selectedScenario;
    return <LiveScenarioView scenario={latest} onBack={() => setSelectedScenario(null)} />;
  }

  const runningScenarios = scenarios.filter(s => s.status === "running");
  const completedScenarios = scenarios.filter(s => s.status === "completed");
  const totalVulnerabilities = completedScenarios.reduce((sum, s) => 
    sum + ((s.resultData?.vulnerabilitiesFound?.length) || 0), 0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" data-testid="text-stress-title">
            <FlaskConical className="w-8 h-8 text-primary" />
            Stress Testing Cinema
          </h1>
          <p className="text-muted-foreground mt-1">
            Simulate extreme market conditions and watch agents respond in real-time
          </p>
        </div>
        <NewScenarioDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/stress/runs"] })} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FlaskConical className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{scenarios.length}</p>
                <p className="text-sm text-muted-foreground">Total Tests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Activity className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{runningScenarios.length}</p>
                <p className="text-sm text-muted-foreground">Running</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Check className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{completedScenarios.length}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalVulnerabilities}</p>
                <p className="text-sm text-muted-foreground">Vulnerabilities</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {runningScenarios.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400 animate-pulse" />
            Running Tests
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {runningScenarios.map((scenario) => (
              <ScenarioListCard
                key={scenario.id}
                scenario={scenario}
                onSelect={() => setSelectedScenario(scenario)}
              />
            ))}
          </div>
        </div>
      )}

      {completedScenarios.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Completed Tests</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedScenarios.slice(0, 6).map((scenario) => (
              <ScenarioListCard
                key={scenario.id}
                scenario={scenario}
                onSelect={() => setSelectedScenario(scenario)}
              />
            ))}
          </div>
        </div>
      )}

      {scenarios.length === 0 && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <FlaskConical className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">No Stress Tests Yet</h3>
              <p className="text-muted-foreground mb-4">
                Launch a stress test to see how agents handle extreme market conditions
              </p>
              <NewScenarioDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/stress/runs"] })} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
