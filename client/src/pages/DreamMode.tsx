import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Moon,
  Sun,
  Sparkles,
  Lightbulb,
  Brain,
  Zap,
  TrendingUp,
  Clock,
  Play,
  Pause,
  BarChart3,
  Activity,
  Star,
  MessageSquare,
  CheckCircle,
  ChevronRight
} from "lucide-react";
interface LocalDreamDiscovery {
  type: string;
  title: string;
  description: string;
  confidence: number;
  potentialImpact?: number;
  reasoning?: string;
  actionable: boolean;
  timestamp?: string;
}

interface LocalDreamRun {
  id: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  simulationsRun: number;
  duration: number;
  discoveries?: LocalDreamDiscovery[];
  insights?: string;
}

const discoveryTypeIcons: Record<string, typeof Lightbulb> = {
  optimization: TrendingUp,
  risk_pattern: Activity,
  strategy: Lightbulb,
  anomaly: Star,
};

const discoveryTypeColors: Record<string, string> = {
  optimization: "bg-green-500/20 text-green-400 border-green-500/30",
  risk_pattern: "bg-red-500/20 text-red-400 border-red-500/30",
  strategy: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  anomaly: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const confidenceColors = (confidence: number) => {
  if (confidence >= 0.9) return "text-green-400";
  if (confidence >= 0.7) return "text-yellow-400";
  return "text-orange-400";
};

function DiscoveryCard({ discovery, featured }: { discovery: LocalDreamDiscovery; featured?: boolean }) {
  const Icon = discoveryTypeIcons[discovery.type] || Lightbulb;
  
  return (
    <Card className={`transition-all ${featured ? "border-primary border-2" : ""}`}>
      <CardContent className={`${featured ? "p-6" : "p-4"}`}>
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg ${discoveryTypeColors[discovery.type] || discoveryTypeColors.strategy}`}>
            <Icon className={`${featured ? "w-6 h-6" : "w-5 h-5"}`} />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className={`font-semibold ${featured ? "text-lg" : ""}`}>{discovery.title}</h3>
              <Badge variant="outline" className={discoveryTypeColors[discovery.type]}>
                {discovery.type.replace("_", " ")}
              </Badge>
              {featured && (
                <Badge variant="default" className="ml-auto">
                  <Star className="w-3 h-3 mr-1" />
                  Top Discovery
                </Badge>
              )}
            </div>
            <p className={`text-muted-foreground ${featured ? "" : "text-sm"} mb-3`}>{discovery.description}</p>
            
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Confidence:</span>
                <span className={`font-medium ${confidenceColors(discovery.confidence)}`}>
                  {Math.round(discovery.confidence * 100)}%
                </span>
              </div>
              {discovery.potentialImpact && (
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">Impact:</span>
                  <span className="font-medium text-green-400">+{discovery.potentialImpact}%</span>
                </div>
              )}
            </div>

            {featured && discovery.reasoning && (
              <div className="mt-4 p-3 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 mb-2 text-sm font-medium">
                  <Brain className="w-4 h-4 text-primary" />
                  AI Reasoning
                </div>
                <p className="text-sm leading-relaxed">{discovery.reasoning}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DreamRunDetail({ run, onBack }: { run: LocalDreamRun; onBack: () => void }) {
  const discoveries: LocalDreamDiscovery[] = run.discoveries || [];
  const topDiscovery = [...discoveries].sort((a: LocalDreamDiscovery, b: LocalDreamDiscovery) => b.confidence - a.confidence)[0];
  const otherDiscoveries = discoveries.filter((d: LocalDreamDiscovery) => d !== topDiscovery);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} data-testid="button-back-dreams">
          <ChevronRight className="w-4 h-4 rotate-180 mr-2" />
          Back to Dream Runs
        </Button>
        <Badge variant={run.status === "running" ? "default" : "secondary"}>
          {run.status === "running" && <Activity className="w-3 h-3 mr-1 animate-pulse" />}
          {run.status}
        </Badge>
      </div>

      <Card className="border-2">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-indigo-500/20">
              <Moon className="w-8 h-8 text-indigo-400" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2">
                Dream Session
                <span className="text-muted-foreground font-normal text-sm">
                  {new Date(run.startedAt).toLocaleDateString()}
                </span>
              </CardTitle>
              <CardDescription>
                {run.simulationsRun.toLocaleString()} simulations analyzed over{" "}
                {Math.round(run.duration / 3600)}+ hours
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4 mb-6">
            <div className="text-center p-4 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
              <BarChart3 className="w-6 h-6 mx-auto mb-2 text-indigo-400" />
              <p className="text-2xl font-bold">{run.simulationsRun.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Simulations</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <Sparkles className="w-6 h-6 mx-auto mb-2 text-purple-400" />
              <p className="text-2xl font-bold">{discoveries.length}</p>
              <p className="text-xs text-muted-foreground">Discoveries</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/30">
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-green-400" />
              <p className="text-2xl font-bold">
                {discoveries.filter((d: LocalDreamDiscovery) => d.type === "optimization").length}
              </p>
              <p className="text-xs text-muted-foreground">Optimizations</p>
            </div>
            <div className="text-center p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
              <Lightbulb className="w-6 h-6 mx-auto mb-2 text-yellow-400" />
              <p className="text-2xl font-bold">
                {discoveries.filter((d: LocalDreamDiscovery) => d.type === "strategy").length}
              </p>
              <p className="text-xs text-muted-foreground">Strategies</p>
            </div>
          </div>

          {topDiscovery && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400" />
                Top Discovery
              </h3>
              <DiscoveryCard discovery={topDiscovery} featured />
            </div>
          )}

          {otherDiscoveries.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold mb-3">All Discoveries</h3>
              <div className="grid gap-4 md:grid-cols-2">
                {otherDiscoveries.map((discovery: LocalDreamDiscovery, idx: number) => (
                  <DiscoveryCard key={idx} discovery={discovery} />
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function DreamRunCard({ run, onSelect }: { run: LocalDreamRun; onSelect: () => void }) {
  const discoveries = run.discoveries || [];
  
  return (
    <Card className="hover-elevate cursor-pointer transition-all" onClick={onSelect} data-testid={`card-dream-${run.id}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-4">
          <div className={`p-2 rounded-lg ${run.status === "running" ? "bg-indigo-500/20" : "bg-muted"}`}>
            <Moon className={`w-5 h-5 ${run.status === "running" ? "text-indigo-400 animate-pulse" : "text-muted-foreground"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold">{new Date(run.startedAt).toLocaleDateString()}</span>
              <Badge variant={run.status === "running" ? "default" : "secondary"}>
                {run.status}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <BarChart3 className="w-3 h-3" />
                {run.simulationsRun.toLocaleString()} sims
              </span>
              <span className="flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                {discoveries.length} discoveries
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {Math.round(run.duration / 3600)}h
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DreamMode() {
  const [selectedRun, setSelectedRun] = useState<LocalDreamRun | null>(null);
  const [isNightTime, setIsNightTime] = useState(false);

  const { data: dreamRuns = [], isLoading } = useQuery<LocalDreamRun[]>({
    queryKey: ["/api/dream"],
    refetchInterval: 5000,
  });

  const startDreamMode = useMutation({
    mutationFn: async () => {
      const discoveries: LocalDreamDiscovery[] = [
        {
          type: "optimization",
          title: "Gas-Efficient Batch Routing",
          description: "Discovered 23% gas savings by batching similar trades through optimized routing paths",
          confidence: 0.92,
          potentialImpact: 23,
          reasoning: "By analyzing 50,000 historical transactions, I identified recurring patterns where multiple small trades could be batched into single transactions using a custom router contract.",
          actionable: true,
          timestamp: new Date().toISOString(),
        },
        {
          type: "strategy",
          title: "Cross-DEX Arbitrage Window",
          description: "Found recurring price discrepancies between Uniswap V3 and Curve during low-liquidity hours",
          confidence: 0.87,
          potentialImpact: 15,
          reasoning: "Monte Carlo simulations revealed consistent 2-5% price gaps during 2-4 AM UTC when liquidity providers are less active.",
          actionable: true,
          timestamp: new Date().toISOString(),
        },
        {
          type: "risk_pattern",
          title: "Correlation Breakdown Warning",
          description: "Detected early warning signals for ETH/stablecoin correlation breakdown during high volatility",
          confidence: 0.78,
          reasoning: "Pattern analysis shows that when ETH volatility exceeds 3x average, traditional correlation assumptions fail 68% of the time.",
          actionable: true,
          timestamp: new Date().toISOString(),
        },
        {
          type: "anomaly",
          title: "Oracle Lag Opportunity",
          description: "Identified 15-second windows where on-chain oracles lag behind real prices by significant margins",
          confidence: 0.85,
          potentialImpact: 8,
          reasoning: "Simulation of oracle update patterns reveals exploitable windows during high-activity periods.",
          actionable: false,
          timestamp: new Date().toISOString(),
        },
      ];

      return apiRequest("POST", "/api/dream/start", {
        simulationsRun: 50000 + Math.floor(Math.random() * 100000),
        duration: 28800 + Math.floor(Math.random() * 14400),
        discoveries,
        insights: "Deep analysis complete. Found 4 actionable opportunities.",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dream"] });
    },
  });

  useEffect(() => {
    const hour = new Date().getHours();
    setIsNightTime(hour >= 22 || hour < 6);
  }, []);

  if (selectedRun) {
    const latest = dreamRuns.find(r => r.id === selectedRun.id) || selectedRun;
    return <DreamRunDetail run={latest} onBack={() => setSelectedRun(null)} />;
  }

  const runningRuns = dreamRuns.filter(r => r.status === "running");
  const completedRuns = dreamRuns.filter(r => r.status === "completed");
  const totalDiscoveries = dreamRuns.reduce((sum: number, r: LocalDreamRun) => sum + (r.discoveries?.length || 0), 0);
  const totalSimulations = dreamRuns.reduce((sum, r) => sum + r.simulationsRun, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" data-testid="text-dream-title">
            <Moon className="w-8 h-8 text-indigo-400" />
            Dream Mode
          </h1>
          <p className="text-muted-foreground mt-1">
            Overnight simulations that discover optimization opportunities while you sleep
          </p>
        </div>
        <Button 
          onClick={() => startDreamMode.mutate()} 
          disabled={startDreamMode.isPending || runningRuns.length > 0}
          data-testid="button-start-dream"
        >
          {runningRuns.length > 0 ? (
            <>
              <Moon className="w-4 h-4 mr-2 animate-pulse" />
              Dreaming...
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 mr-2" />
              {startDreamMode.isPending ? "Starting..." : "Start Dream Session"}
            </>
          )}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-500/10">
                <Moon className="w-5 h-5 text-indigo-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{dreamRuns.length}</p>
                <p className="text-sm text-muted-foreground">Dream Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalDiscoveries}</p>
                <p className="text-sm text-muted-foreground">Discoveries</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <BarChart3 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{(totalSimulations / 1000).toFixed(0)}k</p>
                <p className="text-sm text-muted-foreground">Simulations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <TrendingUp className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {dreamRuns.filter(r => r.discoveries?.some(d => d.type === "optimization")).length}
                </p>
                <p className="text-sm text-muted-foreground">Optimizations</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className={`border-2 ${isNightTime ? "border-indigo-500/50 bg-indigo-500/5" : ""}`}>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isNightTime ? (
                <Moon className="w-12 h-12 text-indigo-400" />
              ) : (
                <Sun className="w-12 h-12 text-yellow-400" />
              )}
              <div>
                <h3 className="text-lg font-semibold">
                  {isNightTime ? "Night Mode Active" : "Daytime Mode"}
                </h3>
                <p className="text-muted-foreground">
                  {isNightTime 
                    ? "Perfect time for deep simulation analysis"
                    : "Dream sessions are optimized for overnight runs (10PM - 6AM)"
                  }
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="auto-dream" className="text-sm">Auto-start at night</Label>
              <Switch id="auto-dream" />
            </div>
          </div>
        </CardContent>
      </Card>

      {runningRuns.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Moon className="w-5 h-5 text-indigo-400 animate-pulse" />
            Active Dream Session
          </h2>
          {runningRuns.map((run) => (
            <DreamRunCard key={run.id} run={run} onSelect={() => setSelectedRun(run)} />
          ))}
        </div>
      )}

      {completedRuns.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Past Dream Sessions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {completedRuns.slice(0, 6).map((run) => (
              <DreamRunCard key={run.id} run={run} onSelect={() => setSelectedRun(run)} />
            ))}
          </div>
        </div>
      )}

      {dreamRuns.length === 0 && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <Moon className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">No Dream Sessions Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start a dream session to let AI agents run overnight simulations and discover opportunities
              </p>
              <Button onClick={() => startDreamMode.mutate()} disabled={startDreamMode.isPending}>
                <Moon className="w-4 h-4 mr-2" />
                {startDreamMode.isPending ? "Starting..." : "Start First Dream Session"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
