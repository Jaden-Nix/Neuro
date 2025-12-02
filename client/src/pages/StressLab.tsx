import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import {
  FlaskConical,
  Zap,
  AlertTriangle,
  Activity,
  Shield,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Play,
  RotateCcw,
  Brain,
  Eye,
  Target,
  Cpu,
} from "lucide-react";

type ScenarioSeverity = "low" | "medium" | "high" | "critical";
type TestOutcome = "stable" | "degraded" | "failed" | "critical";

interface StressScenario {
  id: string;
  name: string;
  type: string;
  description: string;
  severity: ScenarioSeverity;
  parameters: Record<string, number | string | undefined>;
}

interface AgentReaction {
  agentType: "scout" | "risk" | "meta" | "execution";
  action: string;
  reactionTime: number;
  success: boolean;
  details: string;
}

interface StressTestResult {
  id: string;
  scenarioId: string;
  scenarioName: string;
  scenarioType: string;
  startedAt: number;
  completedAt: number;
  duration: number;
  agentReactions: AgentReaction[];
  metrics: {
    riskAccuracy: number;
    metaStability: number;
    reactionSpeed: number;
    executionSafety: number;
  };
  resilienceScore: number;
  outcome: TestOutcome;
  summary: string;
  recommendations: string[];
  simulatedLosses: number;
  preventedLosses: number;
}

interface LabStatus {
  isRunning: boolean;
  currentScenario: string | null;
  totalTests: number;
}

const SEVERITY_STYLES: Record<ScenarioSeverity, { bg: string; border: string; text: string }> = {
  low: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-500" },
  medium: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-500" },
  high: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-500" },
  critical: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-500" },
};

const OUTCOME_STYLES: Record<TestOutcome, { bg: string; border: string; text: string; icon: typeof CheckCircle2 }> = {
  stable: { bg: "bg-green-500/10", border: "border-green-500/30", text: "text-green-500", icon: CheckCircle2 },
  degraded: { bg: "bg-yellow-500/10", border: "border-yellow-500/30", text: "text-yellow-500", icon: AlertCircle },
  failed: { bg: "bg-orange-500/10", border: "border-orange-500/30", text: "text-orange-500", icon: XCircle },
  critical: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-500", icon: AlertTriangle },
};

const AGENT_ICONS: Record<string, typeof Brain> = {
  scout: Eye,
  risk: Shield,
  meta: Brain,
  execution: Cpu,
};

const AGENT_COLORS: Record<string, string> = {
  scout: "text-blue-400",
  risk: "text-red-400",
  meta: "text-purple-400",
  execution: "text-green-400",
};

function ScenarioCard({ 
  scenario, 
  onRun, 
  isRunning,
  isCurrentScenario,
}: { 
  scenario: StressScenario; 
  onRun: (id: string) => void;
  isRunning: boolean;
  isCurrentScenario: boolean;
}) {
  const styles = SEVERITY_STYLES[scenario.severity];
  
  return (
    <Card 
      className={`border ${isCurrentScenario ? "border-primary ring-2 ring-primary/20" : ""}`}
      data-testid={`card-scenario-${scenario.id}`}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <AlertTriangle className={`h-4 w-4 ${styles.text}`} />
            <CardTitle className="text-base">{scenario.name}</CardTitle>
          </div>
          <Badge 
            variant="outline" 
            className={`${styles.bg} ${styles.border} ${styles.text} shrink-0`}
          >
            {scenario.severity.toUpperCase()}
          </Badge>
        </div>
        <CardDescription className="text-xs mt-2">{scenario.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {Object.entries(scenario.parameters).map(([key, value]) => (
              value !== undefined && (
                <Badge 
                  key={key} 
                  variant="secondary" 
                  className="text-xs font-mono"
                >
                  {key.replace(/([A-Z])/g, " $1").trim()}: {typeof value === "number" ? (Math.abs(value) < 1 ? `${(value * 100).toFixed(0)}%` : value.toFixed(0)) : value}
                </Badge>
              )
            ))}
          </div>
          <Button
            onClick={() => onRun(scenario.id)}
            disabled={isRunning}
            className="w-full"
            variant={isCurrentScenario ? "default" : "outline"}
            data-testid={`button-run-scenario-${scenario.id}`}
          >
            {isCurrentScenario && isRunning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Run Test
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResultCard({ result }: { result: StressTestResult }) {
  const outcomeStyle = OUTCOME_STYLES[result.outcome];
  const OutcomeIcon = outcomeStyle.icon;
  
  return (
    <Card className="border" data-testid={`card-result-${result.id}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <OutcomeIcon className={`h-5 w-5 ${outcomeStyle.text}`} />
            <CardTitle className="text-base">{result.scenarioName}</CardTitle>
          </div>
          <Badge 
            variant="outline" 
            className={`${outcomeStyle.bg} ${outcomeStyle.border} ${outcomeStyle.text}`}
          >
            {result.outcome.toUpperCase()}
          </Badge>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2 flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {(result.duration / 1000).toFixed(1)}s
          </span>
          <span className="flex items-center gap-1">
            <Target className="h-3 w-3" />
            Score: {result.resilienceScore}/100
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Object.entries(result.metrics).map(([key, value]) => (
            <div key={key} className="text-center p-2 bg-muted/50 rounded-md">
              <div className="text-xs text-muted-foreground capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </div>
              <div className="text-sm font-semibold">{value.toFixed(0)}%</div>
            </div>
          ))}
        </div>
        
        <div className="space-y-2">
          <div className="text-sm font-medium">Agent Reactions</div>
          {result.agentReactions.map((reaction, i) => {
            const AgentIcon = AGENT_ICONS[reaction.agentType] || Brain;
            return (
              <div 
                key={i} 
                className="flex items-start gap-2 p-2 bg-muted/30 rounded-md"
              >
                <AgentIcon className={`h-4 w-4 mt-0.5 ${AGENT_COLORS[reaction.agentType]}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium capitalize">{reaction.agentType}</span>
                    <span className="text-xs text-muted-foreground">
                      {reaction.reactionTime}ms
                    </span>
                    {reaction.success ? (
                      <CheckCircle2 className="h-3 w-3 text-green-500" />
                    ) : (
                      <XCircle className="h-3 w-3 text-red-500" />
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {reaction.action}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="p-2 bg-red-500/10 border border-red-500/20 rounded-md text-center">
            <div className="text-xs text-red-400">Simulated Losses</div>
            <div className="text-sm font-semibold text-red-500">
              ${result.simulatedLosses.toLocaleString()}
            </div>
          </div>
          <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-md text-center">
            <div className="text-xs text-green-400">Prevented</div>
            <div className="text-sm font-semibold text-green-500">
              ${result.preventedLosses.toLocaleString()}
            </div>
          </div>
        </div>

        {result.recommendations.length > 0 && (
          <div className="space-y-1">
            <div className="text-sm font-medium">Recommendations</div>
            <ul className="text-xs text-muted-foreground space-y-1">
              {result.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Zap className="h-3 w-3 mt-0.5 text-yellow-500 shrink-0" />
                  {rec}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function StressLab() {
  const { toast } = useToast();
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  
  const { data: scenarios = [], isLoading: loadingScenarios, isError: scenariosError } = useQuery<StressScenario[]>({
    queryKey: ["/api/stress/lab/scenarios"],
    retry: 2,
    staleTime: 60000,
  });

  const { data: status, isError: statusError } = useQuery<LabStatus>({
    queryKey: ["/api/stress/lab/status"],
    refetchInterval: 1000,
    retry: 1,
  });

  const { data: results = [], isLoading: loadingResults, isError: resultsError } = useQuery<StressTestResult[]>({
    queryKey: ["/api/stress/lab/results"],
    retry: 2,
    staleTime: 30000,
  });

  const runTestMutation = useMutation({
    mutationFn: async (scenarioId: string) => {
      const response = await apiRequest("POST", "/api/stress/lab/run", { scenarioId });
      return response.json();
    },
    onSuccess: (result: StressTestResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/stress/lab/results"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stress/lab/status"] });
      
      toast({
        title: "Stress Test Complete",
        description: `${result.scenarioName}: ${result.outcome.toUpperCase()} - Score: ${result.resilienceScore}/100`,
      });
      setSelectedScenario(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Test Failed",
        description: error.message,
        variant: "destructive",
      });
      setSelectedScenario(null);
    },
  });

  const handleRunTest = (scenarioId: string) => {
    setSelectedScenario(scenarioId);
    runTestMutation.mutate(scenarioId);
  };

  const avgResilience = results.length > 0 
    ? results.reduce((sum, r) => sum + r.resilienceScore, 0) / results.length 
    : 0;

  const outcomeCount = results.reduce((acc, r) => {
    acc[r.outcome] = (acc[r.outcome] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="h-full flex flex-col p-4 gap-4 overflow-hidden">
      <div className="flex items-center justify-between gap-4 shrink-0 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-500/10 rounded-md">
            <FlaskConical className="h-6 w-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-xl font-bold" data-testid="text-page-title">Agent Stress Lab</h1>
            <p className="text-sm text-muted-foreground">
              Test agent resilience against extreme market scenarios
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          {status?.isRunning && (
            <Badge variant="outline" className="bg-yellow-500/10 border-yellow-500/30 text-yellow-500">
              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
              Test Running
            </Badge>
          )}
          <Badge variant="secondary" data-testid="text-total-tests">
            {status?.totalTests || 0} Tests Run
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-md">
              <Activity className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Avg Resilience</div>
              <div className="text-xl font-bold" data-testid="text-avg-resilience">
                {avgResilience.toFixed(0)}%
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-md">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Stable</div>
              <div className="text-xl font-bold" data-testid="text-stable-count">
                {outcomeCount.stable || 0}
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-500/10 rounded-md">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Degraded</div>
              <div className="text-xl font-bold" data-testid="text-degraded-count">
                {outcomeCount.degraded || 0}
              </div>
            </div>
          </div>
        </Card>
        
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-500/10 rounded-md">
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Failed/Critical</div>
              <div className="text-xl font-bold" data-testid="text-failed-count">
                {(outcomeCount.failed || 0) + (outcomeCount.critical || 0)}
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Tabs defaultValue="scenarios" className="flex-1 flex flex-col min-h-0">
        <TabsList className="shrink-0 w-full justify-start">
          <TabsTrigger value="scenarios" data-testid="tab-scenarios">
            <FlaskConical className="h-4 w-4 mr-2" />
            Scenarios ({scenarios.length})
          </TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results">
            <RotateCcw className="h-4 w-4 mr-2" />
            Results ({results.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scenarios" className="flex-1 min-h-0 mt-4">
          {loadingScenarios ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : scenariosError ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mb-2 text-destructive opacity-50" />
              <p className="text-destructive">Failed to load scenarios</p>
              <p className="text-sm">Please try refreshing the page</p>
            </div>
          ) : scenarios.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <FlaskConical className="h-12 w-12 mb-2 opacity-50" />
              <p>No scenarios available</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pr-4">
                {scenarios.map((scenario) => (
                  <ScenarioCard
                    key={scenario.id}
                    scenario={scenario}
                    onRun={handleRunTest}
                    isRunning={runTestMutation.isPending || status?.isRunning || false}
                    isCurrentScenario={selectedScenario === scenario.id || status?.currentScenario === scenario.id}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="results" className="flex-1 min-h-0 mt-4">
          {loadingResults ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : resultsError ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <AlertTriangle className="h-12 w-12 mb-2 text-destructive opacity-50" />
              <p className="text-destructive">Failed to load results</p>
              <p className="text-sm">Please try refreshing the page</p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
              <FlaskConical className="h-12 w-12 mb-2 opacity-50" />
              <p>No test results yet</p>
              <p className="text-sm">Run a scenario to see results</p>
            </div>
          ) : (
            <ScrollArea className="h-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pr-4">
                {results.map((result) => (
                  <ResultCard key={result.id} result={result} />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
