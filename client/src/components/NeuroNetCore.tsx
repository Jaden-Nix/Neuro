import { motion } from "framer-motion";
import { Brain, Search, Shield, Zap } from "lucide-react";
import { AgentType, AgentStatus, type Agent } from "@shared/schema";

interface NeuroNetCoreProps {
  agents: Agent[];
  systemHealth: number;
}

const agentIcons = {
  [AgentType.META]: Brain,
  [AgentType.SCOUT]: Search,
  [AgentType.RISK]: Shield,
  [AgentType.EXECUTION]: Zap,
};

const agentColors = {
  [AgentType.META]: "text-meta",
  [AgentType.SCOUT]: "text-scout",
  [AgentType.RISK]: "text-risk",
  [AgentType.EXECUTION]: "text-execution",
};

export function NeuroNetCore({ agents, systemHealth }: NeuroNetCoreProps) {
  const metaAgent = agents.find((a) => a.type === AgentType.META);
  const subAgents = agents.filter((a) => a.type !== AgentType.META);

  return (
    <div className="relative flex items-center justify-center h-[400px] max-w-[500px] mx-auto" data-testid="neuronet-core">
      {/* Central Meta-Agent Node */}
      <motion.div
        className="relative z-10"
        animate={{
          scale: [1, 1.02, 1],
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      >
        <div
          className="relative w-40 h-40 md:w-48 md:h-48 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-xl border border-primary/30 flex items-center justify-center"
          data-testid="meta-agent-node"
        >
          {/* Pulsing Glow */}
          <motion.div
            className="absolute inset-0 rounded-full bg-primary/20"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 0.2, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Concentric Rings */}
          <div className="absolute inset-0 rounded-full border border-primary/20" />
          <div className="absolute inset-4 rounded-full border border-primary/15" />
          <div className="absolute inset-8 rounded-full border border-primary/10" />

          {/* Icon */}
          <div className="relative z-10 flex flex-col items-center gap-2">
            <Brain className="w-12 h-12 md:w-16 md:h-16 text-primary" />
            <div className="text-center">
              <p className="text-sm md:text-base font-display font-bold text-primary">Meta-Agent</p>
              <p className="text-xs text-muted-foreground">
                {metaAgent?.status || AgentStatus.IDLE}
              </p>
              {metaAgent?.personality && (
                <p className="text-xs text-blue-400 mt-1 italic">
                  {metaAgent.personality.slice(0, 2).join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* Health Indicator */}
          <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-card/90 backdrop-blur-sm border border-border">
            <p className="text-xs font-mono whitespace-nowrap">
              <span className="text-muted-foreground">Health:</span>{" "}
              <span className="text-primary font-semibold">{systemHealth}%</span>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Orbiting Sub-Agents */}
      {subAgents.map((agent, index) => {
        const Icon = agentIcons[agent.type];
        const colorClass = agentColors[agent.type];
        const angle = (index * 120) - 90; // 3 agents at 120 degrees apart, starting from top
        const radius = 150;
        const x = Math.cos((angle * Math.PI) / 180) * radius;
        const y = Math.sin((angle * Math.PI) / 180) * radius;

        return (
          <motion.div
            key={agent.id}
            className="absolute z-20"
            style={{
              left: "50%",
              top: "50%",
            }}
            animate={{
              x: [x, x * 1.05, x],
              y: [y, y * 1.05, y],
            }}
            transition={{
              duration: 3 + index * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            data-testid={`agent-node-${agent.type}`}
          >
            <div className="relative -translate-x-1/2 -translate-y-1/2">
              {/* Connecting Line */}
              <svg
                className="absolute pointer-events-none"
                style={{
                  left: "50%",
                  top: "50%",
                  width: Math.abs(x) + 150,
                  height: Math.abs(y) + 150,
                }}
              >
                <motion.line
                  x1="50%"
                  y1="50%"
                  x2={-x + 75}
                  y2={-y + 75}
                  stroke="hsl(var(--primary))"
                  strokeWidth="1"
                  strokeOpacity="0.3"
                  strokeDasharray="4 4"
                  animate={{
                    strokeDashoffset: [0, -8],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
              </svg>

              {/* Agent Node */}
              <div
                className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-card to-card/50 backdrop-blur-lg border-2 ${colorClass} border-opacity-50 flex items-center justify-center hover-elevate cursor-pointer group`}
              >
                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-transparent to-black/5" />
                
                <div className="relative z-10 flex flex-col items-center gap-1">
                  <Icon className={`w-6 h-6 md:w-8 md:h-8 ${colorClass}`} />
                  <div className="text-center">
                    <p className={`text-xs md:text-sm font-display font-medium ${colorClass}`}>
                      {agent.type.charAt(0).toUpperCase() + agent.type.slice(1)}
                    </p>
                    <p className="text-[10px] md:text-xs text-muted-foreground">{agent.status}</p>
                  </div>
                </div>

                {/* Hover Card */}
                <div className="absolute top-full mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                  <div className="bg-card border border-border rounded-lg p-3 shadow-lg min-w-[200px]">
                    <div className="space-y-2 text-xs">
                      <p className={`font-semibold capitalize ${colorClass}`}>{agent.type}</p>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Credit:</span>
                        <span className="font-mono font-semibold">{agent.creditScore}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Version:</span>
                        <span className="font-mono">v{agent.version}</span>
                      </div>
                      {agent.personality && (
                        <div className="pt-1 border-t border-border">
                          <p className="text-muted-foreground text-xs">Traits:</p>
                          <p className="text-blue-400 text-xs mt-0.5">{agent.personality.join(", ")}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
