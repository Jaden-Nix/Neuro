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
  ChevronRight
} from "lucide-react";
type AgentTypeKey = "meta" | "scout" | "risk" | "execution";

interface AgentMutation {
  trait: string;
  previousValue: unknown;
  newValue: unknown;
  reason: string;
  performanceImpact?: number;
}

interface AgentEvolution {
  id: string;
  agentId: string;
  parentAgentId?: string | null;
  generation: number;
  mutations: AgentMutation[];
  inheritedTraits: string[];
  performanceScore: number;
  survivalScore: number;
  reproductionScore: number;
  spawnedAt: string | number;
  retiredAt?: string | number;
  retirementReason?: string;
}

const agentColors: Record<string, string> = {
  meta: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  scout: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  risk: "bg-red-500/20 text-red-400 border-red-500/30",
  execution: "bg-green-500/20 text-green-400 border-green-500/30",
};

const agentIcons: Record<string, typeof Brain> = {
  meta: Brain,
  scout: Search,
  risk: Shield,
  execution: Target,
};

function getAgentTypeFromId(agentId: string): string {
  if (agentId.includes("meta")) return "meta";
  if (agentId.includes("scout")) return "scout";
  if (agentId.includes("risk")) return "risk";
  if (agentId.includes("exec")) return "execution";
  return "meta";
}

function EvolutionNode({ evolution, isRoot, onClick }: { evolution: AgentEvolution; isRoot?: boolean; onClick: () => void }) {
  const agentType = getAgentTypeFromId(evolution.agentId);
  const Icon = agentIcons[agentType] || Brain;
  const isRetired = !!evolution.retiredAt;

  return (
    <div 
      className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all hover-elevate ${
        isRetired ? "opacity-60 border-dashed" : ""
      } ${agentColors[agentType]}`}
      onClick={onClick}
      data-testid={`card-evolution-${evolution.agentId}`}
    >
      {!isRoot && (
        <div className="absolute -top-8 left-1/2 w-px h-8 bg-border" />
      )}
      
      <div className="flex items-center gap-3 mb-3">
        <div className={`p-2 rounded-full ${agentColors[agentType]}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{evolution.agentId}</span>
            <Badge variant="outline" className="text-xs">Gen {evolution.generation}</Badge>
          </div>
          {isRetired && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Skull className="w-3 h-3" /> Retired
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="p-2 rounded bg-background/50">
          <Trophy className="w-4 h-4 mx-auto mb-1 text-yellow-400" />
          <p className="font-medium">{evolution.performanceScore}</p>
          <p className="text-muted-foreground">Perf</p>
        </div>
        <div className="p-2 rounded bg-background/50">
          <Shield className="w-4 h-4 mx-auto mb-1 text-green-400" />
          <p className="font-medium">{evolution.survivalScore}</p>
          <p className="text-muted-foreground">Surv</p>
        </div>
        <div className="p-2 rounded bg-background/50">
          <GitFork className="w-4 h-4 mx-auto mb-1 text-blue-400" />
          <p className="font-medium">{evolution.reproductionScore}</p>
          <p className="text-muted-foreground">Repro</p>
        </div>
      </div>

      {evolution.mutations.length > 0 && (
        <div className="mt-3 pt-2 border-t border-border/50">
          <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Dna className="w-3 h-3" />
            {evolution.mutations.length} mutations
          </p>
        </div>
      )}
    </div>
  );
}

function MutationCard({ mutation }: { mutation: AgentMutation }) {
  const isPositive = (mutation.performanceImpact || 0) > 0;
  
  return (
    <div className="p-3 rounded-lg bg-muted/50 border">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <Dna className="w-4 h-4 text-primary" />
          <span className="font-medium capitalize">{mutation.trait}</span>
        </div>
        {mutation.performanceImpact !== undefined && (
          <Badge variant={isPositive ? "default" : "destructive"} className="flex items-center gap-1">
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {isPositive ? "+" : ""}{mutation.performanceImpact}%
          </Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{mutation.reason}</p>
      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
        <span className="line-through opacity-50">{String(mutation.previousValue)}</span>
        <ChevronRight className="w-3 h-3" />
        <span className="font-medium text-foreground">{String(mutation.newValue)}</span>
      </div>
    </div>
  );
}

function EvolutionDetail({ evolution, onBack }: { evolution: AgentEvolution; onBack: () => void }) {
  const agentType = getAgentTypeFromId(evolution.agentId);
  const Icon = agentIcons[agentType] || Brain;

  const { data: children = [] } = useQuery<AgentEvolution[]>({
    queryKey: ["/api/evolution", { parentAgentId: evolution.agentId }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} data-testid="button-back-evolution">
          <ChevronRight className="w-4 h-4 rotate-180 mr-2" />
          Back to Tree
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-full ${agentColors[agentType]}`}>
                <Icon className="w-8 h-8" />
              </div>
              <div>
                <CardTitle className="flex items-center gap-2">
                  {evolution.agentId}
                  <Badge variant="outline">Generation {evolution.generation}</Badge>
                </CardTitle>
                <CardDescription>
                  {evolution.retiredAt 
                    ? `Retired: ${evolution.retirementReason || "Unknown reason"}`
                    : "Active in the gene pool"
                  }
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3 mb-6">
              <div className="text-center p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                <p className="text-3xl font-bold">{evolution.performanceScore}</p>
                <p className="text-sm text-muted-foreground">Performance Score</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                <Shield className="w-8 h-8 mx-auto mb-2 text-green-400" />
                <p className="text-3xl font-bold">{evolution.survivalScore}</p>
                <p className="text-sm text-muted-foreground">Survival Score</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <GitFork className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                <p className="text-3xl font-bold">{evolution.reproductionScore}</p>
                <p className="text-sm text-muted-foreground">Reproduction Score</p>
              </div>
            </div>

            <Tabs defaultValue="mutations">
              <TabsList>
                <TabsTrigger value="mutations">
                  <Dna className="w-4 h-4 mr-2" />
                  Mutations ({evolution.mutations.length})
                </TabsTrigger>
                <TabsTrigger value="traits">
                  <Sparkles className="w-4 h-4 mr-2" />
                  Inherited ({evolution.inheritedTraits.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="mutations" className="mt-4">
                {evolution.mutations.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Dna className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No mutations recorded</p>
                    <p className="text-sm">This agent is genetically pure</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {evolution.mutations.map((mutation, idx) => (
                      <MutationCard key={idx} mutation={mutation} />
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="traits" className="mt-4">
                {evolution.inheritedTraits.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Sparkles className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No inherited traits</p>
                    <p className="text-sm">First generation agent</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {evolution.inheritedTraits.map((trait, idx) => (
                      <Badge key={idx} variant="secondary" className="text-sm">
                        {trait}
                      </Badge>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
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
                    <p className="text-sm font-medium">Spawned</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(evolution.spawnedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {evolution.retiredAt && (
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-400" />
                    <div>
                      <p className="text-sm font-medium">Retired</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(evolution.retiredAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {evolution.parentAgentId && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GitBranch className="w-5 h-5" />
                  Lineage
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="p-3 rounded-lg bg-muted/50 border">
                  <p className="text-sm text-muted-foreground">Parent Agent</p>
                  <p className="font-medium">{evolution.parentAgentId}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {children.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <GitFork className="w-5 h-5" />
                  Offspring
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {children.map((child) => (
                    <div key={child.id} className="p-3 rounded-lg bg-muted/50 border">
                      <p className="font-medium">{child.agentId}</p>
                      <p className="text-xs text-muted-foreground">
                        Gen {child.generation} - Score: {child.performanceScore}
                      </p>
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

function EvolutionTree({ evolutions, onSelect }: { evolutions: AgentEvolution[]; onSelect: (e: AgentEvolution) => void }) {
  const generations = evolutions.reduce((acc, ev) => {
    const gen = ev.generation;
    if (!acc[gen]) acc[gen] = [];
    acc[gen].push(ev);
    return acc;
  }, {} as Record<number, AgentEvolution[]>);

  const sortedGens = Object.keys(generations).map(Number).sort((a, b) => a - b);

  if (sortedGens.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-12">
          <div className="text-center">
            <GitBranch className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            <h3 className="text-lg font-semibold mb-2">No Evolution Data Yet</h3>
            <p className="text-muted-foreground mb-4">
              Agent evolution tracking will appear as agents spawn and evolve
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {generations[gen].map((evolution) => (
              <EvolutionNode 
                key={evolution.id} 
                evolution={evolution} 
                isRoot={gen === 1}
                onClick={() => onSelect(evolution)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Evolution() {
  const [selectedEvolution, setSelectedEvolution] = useState<AgentEvolution | null>(null);

  const { data: evolutions = [], isLoading } = useQuery<AgentEvolution[]>({
    queryKey: ["/api/evolution"],
    refetchInterval: 5000,
  });

  const seedMutation = useMutation({
    mutationFn: async () => {
      const agents = [
        { agentId: "meta-001", parentAgentId: null, generation: 1, performanceScore: 85, survivalScore: 90, reproductionScore: 3 },
        { agentId: "scout-001", parentAgentId: null, generation: 1, performanceScore: 78, survivalScore: 85, reproductionScore: 2 },
        { agentId: "risk-001", parentAgentId: null, generation: 1, performanceScore: 92, survivalScore: 95, reproductionScore: 4 },
        { agentId: "exec-001", parentAgentId: null, generation: 1, performanceScore: 70, survivalScore: 75, reproductionScore: 1 },
        { agentId: "meta-002", parentAgentId: "meta-001", generation: 2, performanceScore: 88, survivalScore: 87, reproductionScore: 1, mutations: [{ trait: "risk_tolerance", previousValue: 0.5, newValue: 0.7, reason: "Adapted to volatile markets", performanceImpact: 5 }], inheritedTraits: ["cautious", "analytical"] },
        { agentId: "scout-002", parentAgentId: "scout-001", generation: 2, performanceScore: 82, survivalScore: 80, reproductionScore: 0, mutations: [{ trait: "speed", previousValue: 100, newValue: 150, reason: "Optimized for faster arbitrage", performanceImpact: 8 }], inheritedTraits: ["curious", "energetic"] },
      ];

      for (const agent of agents) {
        await apiRequest("POST", "/api/evolution", agent);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/evolution"] });
    },
  });

  if (selectedEvolution) {
    return <EvolutionDetail evolution={selectedEvolution} onBack={() => setSelectedEvolution(null)} />;
  }

  const totalAgents = evolutions.length;
  const activeAgents = evolutions.filter(e => !e.retiredAt).length;
  const totalMutations = evolutions.reduce((sum, e) => sum + e.mutations.length, 0);
  const avgPerformance = totalAgents > 0 
    ? Math.round(evolutions.reduce((sum, e) => sum + e.performanceScore, 0) / totalAgents)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" data-testid="text-evolution-title">
            <GitBranch className="w-8 h-8 text-primary" />
            Agent Evolution Tree
          </h1>
          <p className="text-muted-foreground mt-1">
            Track agent genealogy, mutations, and performance inheritance
          </p>
        </div>
        {evolutions.length === 0 && (
          <Button onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending} data-testid="button-seed-evolution">
            <Zap className="w-4 h-4 mr-2" />
            {seedMutation.isPending ? "Seeding..." : "Seed Demo Data"}
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <GitBranch className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalAgents}</p>
                <p className="text-sm text-muted-foreground">Total Agents</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Zap className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeAgents}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Dna className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalMutations}</p>
                <p className="text-sm text-muted-foreground">Mutations</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-yellow-500/10">
                <Trophy className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgPerformance}</p>
                <p className="text-sm text-muted-foreground">Avg Performance</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <EvolutionTree evolutions={evolutions} onSelect={setSelectedEvolution} />
    </div>
  );
}
