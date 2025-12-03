import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
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
  AlertCircle,
  Link2
} from "lucide-react";
import { EvolutionProofs } from "@/components/EvolutionProofs";

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

const agentGlows: Record<string, string> = {
  Atlas: "shadow-purple-500/30",
  Vega: "shadow-blue-500/30",
  Nova: "shadow-orange-500/30",
  Sentinel: "shadow-green-500/30",
  Arbiter: "shadow-red-500/30"
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

function getAgentGlow(agentName: string): string {
  const baseName = getAgentBaseName(agentName);
  return agentGlows[baseName] || "shadow-primary/30";
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <Card className="overflow-visible">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <motion.div 
              className={`p-2 rounded-lg ${color}`}
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Icon className="w-5 h-5" />
            </motion.div>
            <div>
              <motion.p 
                className="text-2xl font-bold"
                key={String(value)}
                initial={{ scale: 1.2, color: "hsl(var(--primary))" }}
                animate={{ scale: 1, color: "hsl(var(--foreground))" }}
                transition={{ duration: 0.3 }}
              >
                {value}
              </motion.p>
              <p className="text-sm text-muted-foreground">{label}</p>
              {subValue && (
                <p className="text-xs text-muted-foreground">{subValue}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function EvolutionTimeline({ events }: { events: EvolutionEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        >
          <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-50" />
        </motion.div>
        <p>No evolution events yet</p>
        <p className="text-sm">Generate demo data to see agent evolution</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 relative">
      <div className="absolute left-6 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" />
      
      <AnimatePresence mode="popLayout">
        {events.map((event, index) => {
          const Icon = getAgentIcon(event.childAgentName);
          const isPositive = event.performanceImpact.roiChange > 0;

          return (
            <motion.div 
              key={event.id}
              initial={{ opacity: 0, x: -50, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 50, scale: 0.9 }}
              transition={{ 
                duration: 0.5, 
                delay: index * 0.1,
                type: "spring",
                stiffness: 100
              }}
              className={`relative p-4 rounded-lg border ml-8 ${getAgentColor(event.childAgentName)} shadow-lg ${getAgentGlow(event.childAgentName)}`}
              data-testid={`card-evolution-event-${event.id}`}
            >
              <motion.div
                className="absolute -left-10 top-4 w-4 h-4 rounded-full bg-primary border-2 border-background"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.1 + 0.2 }}
              >
                <motion.div
                  className="absolute inset-0 rounded-full bg-primary"
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.div>

              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex items-center gap-3">
                  <motion.div 
                    className="p-2 rounded-full bg-background/50"
                    animate={{ rotate: isPositive ? [0, 360] : [0, -10, 10, -10, 0] }}
                    transition={{ duration: isPositive ? 20 : 0.5, repeat: Infinity, repeatDelay: isPositive ? 0 : 3 }}
                  >
                    <Icon className="w-5 h-5" />
                  </motion.div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{event.parentAgentName}</span>
                      <motion.div
                        animate={{ x: [0, 5, 0] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <ArrowRight className="w-4 h-4 text-muted-foreground" />
                      </motion.div>
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
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.1 + 0.3, type: "spring" }}
                  >
                    <Badge 
                      variant={isPositive ? "default" : "destructive"} 
                      className="flex items-center gap-1"
                    >
                      {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                      {isPositive ? "+" : ""}{event.performanceImpact.roiChange.toFixed(1)}%
                    </Badge>
                  </motion.div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <motion.div 
                  className="p-2 rounded bg-background/30"
                  whileHover={{ scale: 1.02 }}
                >
                  <span className="text-xs text-muted-foreground mb-1 block">Mutation</span>
                  <span className="text-sm font-medium flex items-center gap-1">
                    <motion.span
                      animate={{ rotate: [0, 180, 360] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="inline-flex"
                    >
                      <Dna className="w-3 h-3" />
                    </motion.span>
                    {mutationTypeLabels[event.mutation.type] || event.mutation.type}
                  </span>
                </motion.div>
                <motion.div 
                  className="p-2 rounded bg-background/30"
                  whileHover={{ scale: 1.02 }}
                >
                  <p className="text-xs text-muted-foreground mb-1">Trigger</p>
                  <p className="text-sm font-medium capitalize">
                    {event.trigger.replace(/_/g, ' ')}
                  </p>
                </motion.div>
              </div>

              <motion.div 
                className="p-2 rounded bg-background/30"
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                transition={{ delay: index * 0.1 + 0.4 }}
              >
                <span className="text-xs text-muted-foreground mb-1 block">Parameter Change</span>
                <span className="text-sm flex items-center gap-2">
                  <motion.span 
                    className="opacity-60 line-through"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0.4 }}
                    transition={{ delay: index * 0.1 + 0.5 }}
                  >
                    {String(event.mutation.previousValue)}
                  </motion.span>
                  <ChevronRight className="w-3 h-3" />
                  <motion.span 
                    className="font-medium"
                    initial={{ scale: 1.5, color: "hsl(var(--primary))" }}
                    animate={{ scale: 1, color: "inherit" }}
                    transition={{ delay: index * 0.1 + 0.6 }}
                  >
                    {String(event.mutation.newValue)}
                  </motion.span>
                  <span className="text-xs text-muted-foreground">
                    ({event.mutation.parameterName})
                  </span>
                </span>
              </motion.div>

              <p className="text-sm text-muted-foreground mt-2 italic">
                "{event.reason}"
              </p>
            </motion.div>
          );
        })}
      </AnimatePresence>
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
      {entries.map(([type, stats], index) => {
        const intensity = stats.totalApplications / maxApplications;
        const isSuccessful = stats.successRate > 0.5;

        return (
          <motion.div 
            key={type} 
            className="space-y-1"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
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
              <motion.div 
                className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                  stats.totalApplications === 0 
                    ? "bg-muted-foreground/20" 
                    : isSuccessful 
                      ? "bg-green-500" 
                      : "bg-orange-500"
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${intensity * 100}%` }}
                transition={{ duration: 1, delay: index * 0.1 }}
              />
              {stats.totalApplications > 0 && isSuccessful && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                />
              )}
            </div>
            {stats.totalApplications > 0 && (
              <p className="text-xs text-muted-foreground">
                Avg impact: {stats.averagePerformanceImpact > 0 ? "+" : ""}{stats.averagePerformanceImpact.toFixed(1)}% ROI
              </p>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function GenealogyTreeView({ tree, onSelectAgent }: { 
  tree: GenealogyTree; 
  onSelectAgent: (agent: AgentGenealogy) => void;
}) {
  const [hoveredAgent, setHoveredAgent] = useState<string | null>(null);
  
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
            <motion.div
              animate={{ 
                rotate: [0, 360],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                rotate: { duration: 20, repeat: Infinity, ease: "linear" },
                scale: { duration: 2, repeat: Infinity }
              }}
            >
              <GitBranch className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
            </motion.div>
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
    <div className="space-y-6 relative">
      <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible" style={{ zIndex: 0 }}>
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
          </linearGradient>
        </defs>
      </svg>

      {sortedGens.map((gen, genIndex) => (
        <motion.div 
          key={gen} 
          className="relative"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: genIndex * 0.2 }}
        >
          <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-2 mb-4">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity, delay: genIndex * 0.3 }}
              >
                <Badge variant="outline" className="text-sm">
                  Generation {gen}
                </Badge>
              </motion.div>
              <span className="text-sm text-muted-foreground">
                {generations[gen].length} agent{generations[gen].length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
          
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {generations[gen].map((agent, agentIndex) => {
              const Icon = getAgentIcon(agent.agentName);
              const isHovered = hoveredAgent === agent.agentName;
              const isParentOfHovered = hoveredAgent && tree.edges.some(e => e.from === agent.agentName && e.to === hoveredAgent);
              const isChildOfHovered = hoveredAgent && tree.edges.some(e => e.to === agent.agentName && e.from === hoveredAgent);
              
              return (
                <motion.div
                  key={agent.agentName}
                  className={`relative p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    !agent.isActive ? "opacity-60 border-dashed" : ""
                  } ${getAgentColor(agent.agentName)} ${
                    isHovered || isParentOfHovered || isChildOfHovered ? `shadow-lg ${getAgentGlow(agent.agentName)}` : ""
                  }`}
                  onClick={() => onSelectAgent(agent)}
                  onMouseEnter={() => setHoveredAgent(agent.agentName)}
                  onMouseLeave={() => setHoveredAgent(null)}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ 
                    opacity: 1, 
                    scale: isHovered ? 1.05 : 1,
                    y: isHovered ? -5 : 0
                  }}
                  transition={{ 
                    delay: genIndex * 0.2 + agentIndex * 0.1,
                    type: "spring",
                    stiffness: 200
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  data-testid={`card-genealogy-${agent.agentName}`}
                >
                  {gen > 1 && (
                    <motion.div 
                      className="absolute -top-6 left-1/2 w-px h-6 bg-gradient-to-b from-primary/50 to-primary/20"
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: genIndex * 0.2 + agentIndex * 0.1 + 0.3 }}
                    />
                  )}
                  
                  <motion.div
                    className="absolute -inset-1 rounded-lg bg-gradient-to-br from-primary/20 to-transparent opacity-0"
                    animate={{ opacity: isHovered ? 0.5 : 0 }}
                  />

                  <div className="flex items-center gap-2 mb-3 relative z-10">
                    <motion.div 
                      className="p-2 rounded-full bg-background/50"
                      animate={agent.isActive ? { 
                        scale: [1, 1.1, 1],
                        rotate: [0, 5, -5, 0]
                      } : {}}
                      transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                    >
                      <Icon className="w-4 h-4" />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{agent.agentName}</p>
                      {!agent.isActive && (
                        <motion.span 
                          className="text-xs flex items-center gap-1"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                        >
                          <Skull className="w-3 h-3" /> Retired
                        </motion.span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center text-xs relative z-10">
                    <motion.div 
                      className="p-1.5 rounded bg-background/50"
                      whileHover={{ scale: 1.05 }}
                    >
                      <Trophy className="w-3 h-3 mx-auto mb-0.5 text-yellow-400" />
                      <p className="font-medium">{agent.cumulativePerformance.toFixed(1)}%</p>
                    </motion.div>
                    <motion.div 
                      className="p-1.5 rounded bg-background/50"
                      whileHover={{ scale: 1.05 }}
                    >
                      <GitFork className="w-3 h-3 mx-auto mb-0.5 text-blue-400" />
                      <p className="font-medium">{agent.totalDescendants}</p>
                    </motion.div>
                  </div>

                  <div className="mt-2 relative z-10">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Lineage</span>
                      <span>{agent.lineageStrength.toFixed(0)}%</span>
                    </div>
                    <div className="relative h-1 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-primary"
                        initial={{ width: 0 }}
                        animate={{ width: `${agent.lineageStrength}%` }}
                        transition={{ duration: 1, delay: genIndex * 0.2 + agentIndex * 0.1 + 0.5 }}
                      />
                    </div>
                  </div>

                  {agent.children.length > 0 && (
                    <motion.div
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: genIndex * 0.2 + agentIndex * 0.1 + 0.6 }}
                    >
                      <Badge className="text-[10px] px-1.5 py-0 bg-blue-500/20 text-blue-400 border-blue-500/30">
                        {agent.children.length} child{agent.children.length !== 1 ? "ren" : ""}
                      </Badge>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </motion.div>
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
    <motion.div 
      className="space-y-6"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={onBack} data-testid="button-back-genealogy">
          <ChevronRight className="w-4 h-4 rotate-180 mr-2" />
          Back to Tree
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 overflow-visible">
          <CardHeader>
            <div className="flex items-center gap-4">
              <motion.div 
                className={`p-3 rounded-full ${getAgentColor(agent.agentName)}`}
                animate={{ 
                  scale: [1, 1.1, 1],
                  rotate: [0, 5, -5, 0]
                }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Icon className="w-8 h-8" />
              </motion.div>
              <div>
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  {agent.agentName}
                  <Badge variant="outline">Generation {agent.generation}</Badge>
                  {agent.isActive ? (
                    <motion.div
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    >
                      <Badge variant="default" className="bg-green-500/20 text-green-400">Active</Badge>
                    </motion.div>
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
              <motion.div 
                className="text-center p-4 rounded-lg bg-yellow-500/10 border border-yellow-500/30"
                whileHover={{ scale: 1.02 }}
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                </motion.div>
                <p className="text-3xl font-bold">{agent.cumulativePerformance.toFixed(1)}%</p>
                <p className="text-sm text-muted-foreground">Cumulative ROI</p>
              </motion.div>
              <motion.div 
                className="text-center p-4 rounded-lg bg-green-500/10 border border-green-500/30"
                whileHover={{ scale: 1.02 }}
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Sparkles className="w-8 h-8 mx-auto mb-2 text-green-400" />
                </motion.div>
                <p className="text-3xl font-bold">{agent.lineageStrength.toFixed(0)}%</p>
                <p className="text-sm text-muted-foreground">Lineage Strength</p>
              </motion.div>
              <motion.div 
                className="text-center p-4 rounded-lg bg-blue-500/10 border border-blue-500/30"
                whileHover={{ scale: 1.02 }}
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                >
                  <GitFork className="w-8 h-8 mx-auto mb-2 text-blue-400" />
                </motion.div>
                <p className="text-3xl font-bold">{agent.totalDescendants}</p>
                <p className="text-sm text-muted-foreground">Descendants</p>
              </motion.div>
            </div>

            <Separator className="my-4" />

            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Evolution History
            </h3>

            {agentEvents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                  <Dna className="w-12 h-12 mx-auto mb-3 opacity-50" />
                </motion.div>
                <p>No evolution events for this agent</p>
              </div>
            ) : (
              <EvolutionTimeline events={agentEvents} />
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Timeline
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 relative">
                  <div className="absolute left-1 top-0 bottom-0 w-px bg-gradient-to-b from-green-400 via-primary/30 to-red-400/30" />
                  
                  <motion.div 
                    className="flex items-center gap-3 relative"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                  >
                    <motion.div 
                      className="w-2 h-2 rounded-full bg-green-400 relative z-10"
                      animate={{ scale: [1, 1.5, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                    <div>
                      <p className="text-sm font-medium">Created</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(agent.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </motion.div>
                  {agent.retiredAt && (
                    <motion.div 
                      className="flex items-center gap-3 relative"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 }}
                    >
                      <div className="w-2 h-2 rounded-full bg-red-400 relative z-10" />
                      <div>
                        <p className="text-sm font-medium">Retired</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(agent.retiredAt).toLocaleString()}
                        </p>
                      </div>
                    </motion.div>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {agent.parentName && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GitBranch className="w-5 h-5" />
                    Parent
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <motion.div 
                    className={`p-3 rounded-lg border ${getAgentColor(agent.parentName)}`}
                    whileHover={{ scale: 1.02 }}
                  >
                    <p className="font-medium">{agent.parentName}</p>
                    <p className="text-xs text-muted-foreground">Previous generation</p>
                  </motion.div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {agent.children.length > 0 && (
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <GitFork className="w-5 h-5" />
                    Children ({agent.children.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {agent.children.map((child, index) => (
                      <motion.div 
                        key={child} 
                        className={`p-3 rounded-lg border ${getAgentColor(child)}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        <p className="font-medium">{child}</p>
                        <p className="text-xs text-muted-foreground">Evolved offspring</p>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
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
    return (
      <div className="p-6">
        <AgentDetail agent={selectedAgent} onBack={() => setSelectedAgent(null)} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <motion.div 
        className="flex items-center justify-between gap-4 flex-wrap"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            >
              <Dna className="w-8 h-8 text-primary" />
            </motion.div>
            Evolution Engine
          </h1>
          <p className="text-muted-foreground mt-1">
            Track agent mutations, lineages, and performance evolution
          </p>
        </div>
        <Button 
          onClick={() => generateDemoMutation.mutate()}
          disabled={generateDemoMutation.isPending}
          className="flex items-center gap-2"
          data-testid="button-generate-evolution"
        >
          {generateDemoMutation.isPending ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <RefreshCw className="w-4 h-4" />
            </motion.div>
          ) : (
            <Zap className="w-4 h-4" />
          )}
          Generate Evolution
        </Button>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          icon={Activity} 
          label="Total Generations" 
          value={stats?.totalGenerations || 0}
          color="bg-purple-500/20 text-purple-400" 
        />
        <StatCard 
          icon={Dna} 
          label="Total Mutations" 
          value={stats?.totalMutations || 0}
          color="bg-blue-500/20 text-blue-400" 
        />
        <StatCard 
          icon={Brain} 
          label="Active Agents" 
          value={`${stats?.activeAgents || 0} / ${stats?.totalAgents || 0}`}
          subValue={`${stats?.retiredAgents || 0} retired`}
          color="bg-green-500/20 text-green-400" 
        />
        <StatCard 
          icon={Trophy} 
          label="Avg Lineage" 
          value={`${(stats?.averageLineageStrength || 0).toFixed(0)}%`}
          subValue={stats?.mostSuccessfulMutation ? `Best: ${mutationTypeLabels[stats.mostSuccessfulMutation] || stats.mostSuccessfulMutation}` : undefined}
          color="bg-yellow-500/20 text-yellow-400" 
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-xl grid-cols-4">
          <TabsTrigger value="timeline" data-testid="tab-evolution-timeline">
            <Activity className="w-4 h-4 mr-2" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="genealogy" data-testid="tab-evolution-genealogy">
            <GitBranch className="w-4 h-4 mr-2" />
            Genealogy
          </TabsTrigger>
          <TabsTrigger value="heatmap" data-testid="tab-evolution-heatmap">
            <Flame className="w-4 h-4 mr-2" />
            Heatmap
          </TabsTrigger>
          <TabsTrigger value="onchain" data-testid="tab-evolution-onchain">
            <Link2 className="w-4 h-4 mr-2" />
            On-Chain
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="w-5 h-5" />
                Evolution Timeline
              </CardTitle>
              <CardDescription>
                Recent agent mutations and their performance impacts
              </CardDescription>
            </CardHeader>
            <CardContent>
              {historyLoading ? (
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <RefreshCw className="w-8 h-8 text-muted-foreground" />
                  </motion.div>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                Agent Genealogy Tree
              </CardTitle>
              <CardDescription>
                Visualize agent lineages and evolutionary branches
              </CardDescription>
            </CardHeader>
            <CardContent>
              {treeLoading ? (
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <RefreshCw className="w-8 h-8 text-muted-foreground" />
                  </motion.div>
                </div>
              ) : (
                <GenealogyTreeView 
                  tree={tree || { nodes: [], edges: [] }} 
                  onSelectAgent={setSelectedAgent}
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heatmap" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Mutation Heatmap
              </CardTitle>
              <CardDescription>
                Analyze which mutations are most successful
              </CardDescription>
            </CardHeader>
            <CardContent>
              {statsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  >
                    <RefreshCw className="w-8 h-8 text-muted-foreground" />
                  </motion.div>
                </div>
              ) : stats?.mutationHeatmap ? (
                <MutationHeatmap heatmap={stats.mutationHeatmap} />
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No mutation data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onchain" className="mt-6">
          <EvolutionProofs />
        </TabsContent>
      </Tabs>
    </div>
  );
}
