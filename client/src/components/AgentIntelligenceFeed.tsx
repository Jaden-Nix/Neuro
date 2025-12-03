import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Sparkles, TrendingUp, Shield, Zap, Eye, ChevronRight, Dna } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";

interface AgentThought {
  id: string;
  agentId: string;
  agentName: string;
  type: "analysis" | "insight" | "warning" | "opportunity" | "evolution";
  content: string;
  confidence?: number;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface EvolutionEvent {
  id: string;
  parentAgentName: string;
  childAgentName: string;
  mutation: {
    type: string;
    parameterName: string;
  };
  timestamp: number;
}

const thoughtIcons: Record<string, typeof Brain> = {
  analysis: Eye,
  insight: Sparkles,
  warning: Shield,
  opportunity: TrendingUp,
  evolution: Dna,
};

const thoughtColors: Record<string, string> = {
  analysis: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  insight: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  warning: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  opportunity: "text-green-400 bg-green-500/10 border-green-500/20",
  evolution: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
};

export function AgentIntelligenceFeed() {
  const { data: thoughts = [] } = useQuery<AgentThought[]>({
    queryKey: ["/api/village/thoughts"],
    refetchInterval: 5000,
  });

  const { data: evolutionHistory = [] } = useQuery<EvolutionEvent[]>({
    queryKey: ["/api/evolution/engine/history"],
    refetchInterval: 10000,
  });

  const evolutionThoughts: AgentThought[] = evolutionHistory.slice(0, 3).map(ev => ({
    id: `evo-${ev.id}`,
    agentId: ev.childAgentName,
    agentName: ev.childAgentName,
    type: "evolution" as const,
    content: `Evolved from ${ev.parentAgentName}: ${ev.mutation.type.replace(/_/g, " ")}`,
    timestamp: ev.timestamp,
  }));

  const allThoughts = [...thoughts.slice(0, 5), ...evolutionThoughts]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 8);

  const getTimeAgo = (timestamp: number) => {
    if (!timestamp || isNaN(timestamp)) return "now";
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 0) return "now";
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  return (
    <div className="space-y-3" data-testid="agent-intelligence-feed">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ 
              scale: [1, 1.1, 1],
              rotate: [0, 5, -5, 0]
            }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Brain className="w-4 h-4 text-primary" />
          </motion.div>
          <h3 className="text-sm font-semibold">AI Intelligence</h3>
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-purple-500"
            animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
        <Link href="/village" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1" data-testid="link-village-intelligence">
          Village <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <ScrollArea className="h-[200px]">
        <div className="space-y-2 pr-2">
          {allThoughts.length === 0 ? (
            <div className="text-center py-6">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              >
                <Brain className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
              </motion.div>
              <p className="text-sm text-muted-foreground">AI agents processing...</p>
              <p className="text-xs text-muted-foreground/50 mt-1">Thoughts will appear here</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {allThoughts.map((thought, idx) => {
                const Icon = thoughtIcons[thought.type] || Brain;
                const colorClass = thoughtColors[thought.type] || "text-muted-foreground bg-muted/10 border-muted/20";
                
                return (
                  <motion.div
                    key={thought.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: idx * 0.03 }}
                    className={`p-2.5 rounded-md border ${colorClass}`}
                    data-testid={`thought-${thought.id}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className={`p-1 rounded shrink-0 ${colorClass}`}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-medium truncate">
                            {thought.agentName}
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {thought.confidence && (
                              <Badge variant="outline" className="text-[9px] h-4">
                                {thought.confidence}%
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {getTimeAgo(thought.timestamp)}
                            </span>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {thought.content}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
