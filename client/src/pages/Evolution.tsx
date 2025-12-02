import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  GitBranch,
  GitFork,
  Dna,
  TrendingUp,
  TrendingDown,
  Trophy,
  Clock,
  Zap,
  Brain,
  Shield,
  Search,
  Target,
  Skull,
  Sparkles,
  ChevronRight,
  Activity,
  BarChart3,
  Flame,
  LineChart,
  ArrowRight,
  RefreshCw,
  AlertCircle
} from "lucide-react";

interface MutationType {
  type: string;
  parameterName: string;
  previousValue: number | string | boolean;
  newValue: number | string | boolean;
  mutationStrength: number;
}

interface PerformanceImpact {
  roiBefore: number;
  roiAfter: number;
  roiChange: number;
  sharpeBefore: number;
  sharpeAfter: number;
  sharpeChange: number;
  winRateBefore: number;
  winRateAfter: number;
  winRateChange: number;
  drawdownBefore: number;
  drawdownAfter: number;
  drawdownChange: number;
}

interface EvolutionEvent {
  id: string;
  parentAgentName: string;
  childAgentName: string;
  parentGeneration: number;
  childGeneration: number;
  mutation: MutationType;
  trigger: string;
  reason: string;
  performanceImpact: PerformanceImpact;
  backtestScores: { before: number; after: number };
  timestamp: number;
}

interface MutationStats {
  type: string;
  totalApplications: number;
  successfulApplications: number;
  averagePerformanceImpact: number;
  successRate: number;
  lastApplied: number;
}

interface EvolutionStats {
  totalGenerations: number;
  totalMutations: number;
  totalAgents: number;
  activeAgents: number;
  retiredAgents: number;
  averageLineageStrength: number;
  mostSuccessfulMutation: string | null;
  mutationHeatmap: Record<string, MutationStats>;
  generationDistribution: Record<number, number>;
  performanceTrend: number[];
}

interface AgentGenealogy {
  agentName: string;
  generation: number;
  parentName: string | null;
  children: string[];
  totalDescendants: number;
  lineageStrength: number;
  createdAt: number;
  isActive: boolean;
  retiredAt?: number;
  retirementReason?: string;
  cumulativePerformance: number;
}

interface GenealogyTree {
  nodes: AgentGenealogy[];
  edges: { from: string; to: string }[];
}

const mutationTypeLabels: Record<string, string> = {
  threshold_adjustment: "Threshold Adjustment",
  risk_rebalancing: "Risk Rebalancing",
  source_weight_shift: "Source Weight Shift",
  new_signal_enabled: "New Signal Enabled",
  signal_disabled: "Signal Disabled",
  latency_penalty_reduction: "Latency Optimization",
  failover_strategy_update: "Failover Strategy",
  confidence_calibration: "Confidence Calibration",
  volatility_adaptation: "Volatility Adaptation",
  slippage_optimization: "Slippage Optimization"
};

const agentColors: Record<string, string> = {
  Atlas: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  Vega: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Nova: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  Sentinel: "bg-green-500/20 text-green-400 border-green-500/30",
  Arbiter: "bg-red-500/20 text-red-400 border-red-500/30"
};

const agentIcons: Record<string, typeof Brain> = {
  Atlas: Brain,
  Vega: Search,
  Nova: Target,
  Sentinel: Shield,
  Arbiter: Activity
};

function getAgentBaseName(agentName: string): string {
  return agentName.replace(/_v\d+$/, '');
}

function getAgentColor(agentName: string): string {
  const baseName = getAgentBaseName(agentName);
  return agentColors[baseName] || "bg-primary/20 text-primary border-primary/30";
}

function getAgentIcon(agentName: string): typeof Brain {
  const baseName = getAgentBaseName(agentName);
  return agentIcons[baseName] || Brain;
}

function StatCard({ icon: Icon, label, value, subValue, color }: {
  icon: typeof Brain;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm text-muted-foreground">{label}</p>
            {subValue && (
              <p className="text-xs text-muted-foreground">{subValue}</p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function EvolutionTimeline({ events }: { events: EvolutionEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p>No evolution events yet</p>
        <p className="text-sm">Generate demo data to see agent evolution</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const Icon = getAgentIcon(event.childAgentName);
        const isPositive = event.performanceImpact.roiChange > 0;

        return (
          <div 
            key={event.id} 
            className={`p-4 rounded-lg border ${getAgentColor(event.childAgentName)}`}
            data-testid={`card-evolution-event-${event.id}`}
          >
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-background/50">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{event.parentAgentName}</span>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                    <span className="font-semibold">{event.childAgentName}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  Gen {event.childGeneration}
                </Badge>
                <Badge 
                  variant={isPositive ? "default" : "destructive"} 
                  className="flex items-center gap-1"
                >
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {isPositive ? "+" : ""}{event.performanceImpact.roiChange.toFixed(1)}%
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-2 rounded bg-background/30">
                <p className="text-xs text-muted-foreground mb-1">Mutation</p>
                <p className="text-sm font-medium flex items-center gap-1">
                  <Dna className="w-3 h-3" />
                  {mutationTypeLabels[event.mutation.type] || event.mutation.type}
                </p>
              </div>
              <div className="p-2 rounded bg-background/30">
                <p className="text-xs text-muted-foreground mb-1">Trigger</p>
                <p className="text-sm font-medium capitalize">
                  {event.trigger.replace(/_/g, ' ')}
                </p>
              </div>
            </div>

            <div className="p-2 rounded bg-background/30">
              <p className="text-xs text-muted-foreground mb-1">Parameter Change</p>
              <p className="text-sm flex items-center gap-2">
                <span className="opacity-60 line-through">{String(event.mutation.previousValue)}</span>
                <ChevronRight className="w-3 h-3" />
                <span className="font-medium">{String(event.mutation.newValue)}</span>
                <span className="text-xs text-muted-foreground">
                  ({event.mutation.parameterName})
                </span>
              </p>
            </div>

            <p className="text-sm text-muted-foreground mt-2 italic">
              "{event.reason}"
            </p>
          </div>
        );
      })}
    </div>
  );
}

function MutationHeatmap({ heatmap }: { heatmap: Record<string, MutationStats> }) {
  const entries = Object.entries(heatmap).sort((a, b) => 
    b[1].totalApplications - a[1].totalApplications
  );

  const maxApplications = Math.max(...entries.map(([, stats]) => stats.totalApplications), 1);

  return (
    <div className="space-y-3">
      {entries.map(([type, stats]) => {
        const intensity = stats.totalApplications / maxApplications;
        const isSuccessful = stats.successRate > 0.5;

        return (
          <div key={type} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {mutationTypeLabels[type] || type}
              </span>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={stats.totalApplications > 0 ? (isSuccessful ? "default" : "secondary") : "outline"}
                  className="text-xs"
                >
                  {stats.totalApplications} uses
                </Badge>
                {stats.totalApplications > 0 && (
                  <span className={`text-xs ${isSuccessful ? "text-green-400" : "text-muted-foreground"}`}>
                    {(stats.successRate * 100).toFixed(0)}% success
                  </span>
                )}
              </div>
            </div>
            <div className="relative h-2 rounded-full bg-muted overflow-hidden">
              <div 
                className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                  stats.totalApplications === 0 
                    ? "bg-muted-foreground/20" 
                    : isSuccessful 
                      ? "bg-green-500" 
                      : "bg-orange-500"
                }`}
                style={{ width: `${intensity * 100}%` }}
              />
            </div>
            {stats.totalApplications > 0 && (
              <p className="text-xs text-muted-foreground">
                Avg impact: {stats.averagePerformanceImpact > 0 ? "+" : ""}{stats.averagePerformanceImpact.toFixed(1)}% ROI
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GenealogyTreeView({ tree, onSelectAgent }: { 
  tree: GenealogyTree; 
  onSelectAgent: (agent: AgentGenealogy) => void;
}) {
  const generations = tree.nodes.reduce((acc, node) => {
    const gen = node.generation;
    if (!acc[gen]) acc[gen] = [];
    acc[gen].push(node);
    return acc;
  }, {} as Record<number, AgentGenealogy[]>);

  const sortedGens = Object.keys(generations).map(Number).sort((a, b) => a - b);

  if (sortedGens.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12">
          <div className="text-center">
            <GitBranch className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No Genealogy Data Yet</h3>
            <p className="text-muted-foreground mb-4">
              Generate demo evolutions to see the agent family tree
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {sortedGens.map((gen) => (
        <div key={gen} className="relative">
          <div className="sticky top-0 z-10 bg-background py-2 mb-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                Generation {gen}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {generations[gen].length} agent{generations[gen].length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {generations[gen].map((agent) => {
              const Icon = getAgentIcon(agent.agentName);
              
              return (
                <div
                  key={agent.agentName}
                  className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all hover-elevate ${
                    !agent.isActive ? "opacity-60 border-dashed" : ""
                  } ${getAgentColor(agent.agentName)}`}
                  onClick={() => onSelectAgent(agent)}
                  data-testid={`card-genealogy-${agent.agentName}`}
                >
                  {gen > 1 && (
                    <div className="absolute -top-6 left-1/2 w-px h-6 bg-border" />
                  )}
                  
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 rounded-full bg-background/50">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{agent.agentName}</p>
                      {!agent.isActive && (
                        <span className="text-xs flex items-center gap-1">
                          <Skull className="w-3 h-3" /> Retired
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="p-1.5 rounded bg-background/50">
                      <Trophy className="w-3 h-3 mx-auto mb-0.5 text-yellow-400" />
                      <p className="font-medium">{agent.cumulativePerformance.toFixed(1)}%</p>
                    </div>
                    <div className="p-1.5 rounded bg-background/50">
                      <GitFork className="w-3 h-3 mx-auto mb-0.5 text-blue-400" />
                      <p className="font-medium">{agent.totalDescendants}</p>
                    </div>
                  </div>

                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Lineage</span>
                      <span>{agent.lineageStrength.toFixed(0)}%</span>
                    </div>
                    <Progress value={agent.lineageStrength} className="h-1" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function AgentDetail({ agent, onBack }: { agent: AgentGenealogy; onBack: () => void }) {
  const Icon = getAgentIcon(agent.agentName);

  const { data: events = [] } = useQuery<EvolutionEvent[]>({
    queryKey: ["/api/evolution/engine/history"],
  });

  const agentEvents = events.filter(
    e => e.parentAgentName === agent.agentName || e.childAgentName === agent.agentName
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} data-testid="button-back-genealogy">
          <ChevronRight className="w-4 h-4 rotate-180 mr-2" />
          Back to Tree
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${getAgentColor(agent.agentName)}`}>
                <Icon className="w-8 h-8" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {agent.agentName}
                  <Badge variant="outline">Generation {agent.generation}</Badge>
                  {agent.isActive ? (
                    <Badge variant="default" className="bg-green-500/20 text-green-400">Active</Badge>
                  ) : (
                    <Badge variant="secondary">Retired</Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  {agent.retiredAt 
                    ? `Retired: ${agent.retirementReason || "Unknown reason"}`
                    : "Active in the evolution pool"
                  }
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              <div className="text-center p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                <p className="text-3xl font-bold">{agent.cumulativePerformance.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Cumulative ROI</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <Sparkles className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p className="text-3xl font-bold">{agent.lineageStrength.toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground">Lineage Strength</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <GitFork className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                <p className="text-3xl font-bold">{agent.totalDescendants}</p>
                <p className="text-sm text-muted-foreground">Descendants</p>
              </div>
            </div>

            <Separator className="my-4" />

            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Evolution History
            </h3>

            {agentEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Dna className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No evolution events for this agent</p>
              </div>
            ) : (
              <EvolutionTimeline events={agentEvents} />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                  <div>
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(agent.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {agent.retiredAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <div>
                      <p className="text-sm font-medium">Retired</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(agent.retiredAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {agent.parentName && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  Parent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`p-3 rounded-lg border ${getAgentColor(agent.parentName)}`}>
                  <p className="font-medium">{agent.parentName}</p>
                  <p className="text-xs text-muted-foreground">Previous generation</p>
                </div>
              </CardContent>
            </Card>
          )}

          {agent.children.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GitFork className="w-5 h-5" />
                  Children ({agent.children.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {agent.children.map((child) => (
                    <div key={child} className={`p-3 rounded-lg border ${getAgentColor(child)}`}>
                      <p className="font-medium">{child}</p>
                      <p className="text-xs text-muted-foreground">Evolved offspring</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Evolution() {
  const [selectedAgent, setSelectedAgent] = useState<AgentGenealogy | null>(null);
  const [activeTab, setActiveTab] = useState("timeline");

  const { data: stats, isLoading: statsLoading } = useQuery<EvolutionStats>({
    queryKey: ["/api/evolution/engine/stats"],
    refetchInterval: 5000,
  });

  const { data: history = [], isLoading: historyLoading } = useQuery<EvolutionEvent[]>({
    queryKey: ["/api/evolution/engine/history"],
    refetchInterval: 5000,
  });

  const { data: tree, isLoading: treeLoading } = useQuery<GenealogyTree>({
    queryKey: ["/api/evolution/engine/genealogy"],
    refetchInterval: 5000,
  });

  const generateDemoMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/evolution/engine/demo");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evolution/engine/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/evolution/engine/history"] });
      queryClient.invalidateQueries({ queryKey: ["/api/evolution/engine/genealogy"] });
    },
  });

  if (selectedAgent) {
    return <AgentDetail agent={selectedAgent} onBack={() => setSelectedAgent(null)} />;
  }

  const isLoading = statsLoading || historyLoading || treeLoading;
  const hasData = (stats?.totalMutations ?? 0) > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" data-testid="text-evolution-title">
            <GitBranch className="w-8 h-8 text-primary" />
            Evolution Tree
          </h1>
          <p className="text-muted-foreground mt-1">
            Track agent genealogy, mutations, and performance inheritance
          </p>
        </div>
        <Button 
          onClick={() => generateDemoMutation.mutate()} 
          disabled={generateDemoMutation.isPending}
          data-testid="button-generate-demo"
        >
          {generateDemoMutation.isPending ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Zap className="w-4 h-4 mr-2" />
          )}
          {generateDemoMutation.isPending ? "Generating..." : "Generate Demo Evolutions"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard 
          icon={GitBranch}
          label="Generations"
          value={stats?.totalGenerations ?? 0}
          color="bg-primary/10 text-primary"
        />
        <StatCard 
          icon={Dna}
          label="Mutations"
          value={stats?.totalMutations ?? 0}
          color="bg-purple-500/10 text-purple-400"
        />
        <StatCard 
          icon={Zap}
          label="Active Agents"
          value={stats?.activeAgents ?? 0}
          subValue={`${stats?.retiredAgents ?? 0} retired`}
          color="bg-green-500/10 text-green-400"
        />
        <StatCard 
          icon={Sparkles}
          label="Avg Lineage"
          value={`${stats?.averageLineageStrength ?? 0}%`}
          color="bg-yellow-500/10 text-yellow-400"
        />
        <StatCard 
          icon={Trophy}
          label="Best Mutation"
          value={stats?.mostSuccessfulMutation 
            ? mutationTypeLabels[stats.mostSuccessfulMutation]?.split(' ')[0] || "-"
            : "-"
          }
          color="bg-orange-500/10 text-orange-400"
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="genealogy" className="flex items-center gap-2">
            <GitFork className="w-4 h-4" />
            Genealogy Tree
          </TabsTrigger>
          <TabsTrigger value="heatmap" className="flex items-center gap-2">
            <Flame className="w-4 h-4" />
            Mutation Heatmap
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Recent Evolution Events
              </CardTitle>
              <CardDescription>
                Latest mutations and performance changes across all agents
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ScrollArea className="h-[600px] pr-4">
                  <EvolutionTimeline events={history} />
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="genealogy" className="mt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : tree ? (
            <GenealogyTreeView 
              tree={tree} 
              onSelectAgent={setSelectedAgent}
            />
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-12">
                <div className="text-center">
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No genealogy data available</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="heatmap" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Flame className="w-5 h-5" />
                Mutation Success Heatmap
              </CardTitle>
              <CardDescription>
                Track which mutations have been most beneficial across generations
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : stats?.mutationHeatmap ? (
                <MutationHeatmap heatmap={stats.mutationHeatmap} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Flame className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No mutation data available</p>
                  <p className="text-sm">Generate demo evolutions to see the heatmap</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
