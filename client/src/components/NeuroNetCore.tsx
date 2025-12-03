import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Search, Shield, Zap, Activity } from "lucide-react";
import { AgentType, AgentStatus, type Agent } from "@shared/schema";

interface NeuroNetCoreProps {
  agents: Agent[];
  systemHealth: number;
  activeAgentType?: AgentType | null;
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

const agentBgColors = {
  [AgentType.META]: "bg-meta",
  [AgentType.SCOUT]: "bg-scout",
  [AgentType.RISK]: "bg-risk",
  [AgentType.EXECUTION]: "bg-execution",
};

export function NeuroNetCore({ agents, systemHealth, activeAgentType }: NeuroNetCoreProps) {
  const metaAgent = agents.find((a) => a.type === AgentType.META);
  const subAgents = agents.filter((a) => a.type !== AgentType.META);
  const [delegatingTo, setDelegatingTo] = useState<AgentType | null>(null);
  const [pulseCount, setPulseCount] = useState(0);

  useEffect(() => {
    if (activeAgentType && activeAgentType !== AgentType.META) {
      setDelegatingTo(activeAgentType);
      setPulseCount(prev => prev + 1);
      const timer = setTimeout(() => setDelegatingTo(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [activeAgentType]);

  useEffect(() => {
    const interval = setInterval(() => {
      const randomAgent = subAgents[Math.floor(Math.random() * subAgents.length)];
      if (randomAgent && Math.random() > 0.7) {
        setDelegatingTo(randomAgent.type);
        setPulseCount(prev => prev + 1);
        setTimeout(() => setDelegatingTo(null), 1500);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [subAgents]);

  return (
    <div className="relative flex items-center justify-center h-[400px] max-w-[500px] mx-auto" data-testid="neuronet-core">
      {/* Background Neural Grid */}
      <div className="absolute inset-0 opacity-20">
        <svg className="w-full h-full" viewBox="0 0 400 400">
          <defs>
            <radialGradient id="neuralGradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              <stop offset="100%" stopColor="transparent" />
            </radialGradient>
          </defs>
          <circle cx="200" cy="200" r="180" fill="url(#neuralGradient)" />
          {[...Array(6)].map((_, i) => (
            <motion.circle
              key={i}
              cx="200"
              cy="200"
              r={60 + i * 25}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="0.5"
              strokeOpacity={0.1 + (0.1 * (6 - i))}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: i * 0.1 }}
            />
          ))}
        </svg>
      </div>

      {/* Central Meta-Agent Node with Heartbeat */}
      <motion.div
        className="relative z-10"
        animate={{
          scale: [1, 1.03, 1, 1.02, 1],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
          times: [0, 0.3, 0.5, 0.7, 1]
        }}
      >
        <div
          className="relative w-40 h-40 md:w-48 md:h-48 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-xl border border-primary/30 flex items-center justify-center"
          data-testid="meta-agent-node"
        >
          {/* Outer Pulse Ring */}
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-primary"
            animate={{
              scale: [1, 1.5, 1.8],
              opacity: [0.6, 0.2, 0],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeOut",
            }}
          />

          {/* Inner Pulsing Glow */}
          <motion.div
            className="absolute inset-0 rounded-full bg-primary/20"
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.4, 0.1, 0.4],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Heartbeat Effect */}
          <motion.div
            className="absolute inset-2 rounded-full bg-gradient-to-br from-primary/30 to-transparent"
            animate={{
              scale: [1, 1.05, 0.98, 1.02, 1],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          {/* Concentric Rings with Animation */}
          <motion.div 
            className="absolute inset-0 rounded-full border border-primary/20"
            animate={{ rotate: 360 }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          />
          <motion.div 
            className="absolute inset-4 rounded-full border border-primary/15"
            animate={{ rotate: -360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          />
          <motion.div 
            className="absolute inset-8 rounded-full border border-primary/10"
            animate={{ rotate: 360 }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          />

          {/* Icon with Breathing */}
          <div className="relative z-10 flex flex-col items-center gap-2">
            <motion.div
              animate={{
                scale: [1, 1.1, 1],
                filter: ["brightness(1)", "brightness(1.3)", "brightness(1)"]
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut",
              }}
            >
              <Brain className="w-12 h-12 md:w-16 md:h-16 text-primary drop-shadow-lg" />
            </motion.div>
            <div className="text-center">
              <p className="text-sm md:text-base font-display font-bold text-primary">Meta-Agent</p>
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                <Activity className="w-3 h-3" />
                {metaAgent?.status || AgentStatus.IDLE}
              </p>
              {metaAgent?.personality && (
                <p className="text-xs text-blue-400 mt-1 italic">
                  {metaAgent.personality.slice(0, 2).join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* Health Indicator with Animation */}
          <motion.div 
            className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full bg-card/90 backdrop-blur-sm border border-border"
            animate={{ y: [0, -2, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <p className="text-xs font-mono whitespace-nowrap flex items-center gap-1">
              <motion.span
                className={`w-1.5 h-1.5 rounded-full ${systemHealth > 80 ? 'bg-green-500' : systemHealth > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
              <span className="text-muted-foreground">Health:</span>{" "}
              <span className="text-primary font-semibold">{systemHealth}%</span>
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* Orbiting Sub-Agents with Delegation Lines */}
      {subAgents.map((agent, index) => {
        const Icon = agentIcons[agent.type];
        const colorClass = agentColors[agent.type];
        const bgColorClass = agentBgColors[agent.type];
        const angle = (index * 120) - 90;
        const radius = 150;
        const x = Math.cos((angle * Math.PI) / 180) * radius;
        const y = Math.sin((angle * Math.PI) / 180) * radius;
        const isActive = delegatingTo === agent.type;

        return (
          <motion.div
            key={agent.id}
            className="absolute z-20"
            style={{
              left: "50%",
              top: "50%",
            }}
            animate={{
              x: [x, x * 1.03, x],
              y: [y, y * 1.03, y],
            }}
            transition={{
              duration: 3 + index * 0.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            data-testid={`agent-node-${agent.type}`}
          >
            <div className="relative -translate-x-1/2 -translate-y-1/2">
              {/* Connecting Line with Pulse Effect */}
              <svg
                className="absolute pointer-events-none overflow-visible"
                style={{
                  left: "50%",
                  top: "50%",
                  width: 300,
                  height: 300,
                  transform: "translate(-150px, -150px)",
                }}
              >
                <defs>
                  <linearGradient id={`lineGradient-${agent.type}`} x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={`hsl(var(--${agent.type}))`} stopOpacity="0.8" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
                  </linearGradient>
                </defs>
                
                {/* Base Line */}
                <motion.line
                  x1={150}
                  y1={150}
                  x2={150 - x}
                  y2={150 - y}
                  stroke="hsl(var(--primary))"
                  strokeWidth={isActive ? "2" : "1"}
                  strokeOpacity={isActive ? 0.8 : 0.3}
                  strokeDasharray={isActive ? "0" : "4 4"}
                  animate={{
                    strokeDashoffset: isActive ? 0 : [0, -8],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />

                {/* Pulse traveling along the line when delegating */}
                <AnimatePresence>
                  {isActive && (
                    <motion.circle
                      key={`pulse-${pulseCount}`}
                      r="6"
                      fill={`hsl(var(--primary))`}
                      filter="url(#glow)"
                      initial={{ 
                        cx: 150, 
                        cy: 150,
                        opacity: 1,
                        scale: 0.5
                      }}
                      animate={{ 
                        cx: 150 - x, 
                        cy: 150 - y,
                        opacity: [1, 0.8, 0],
                        scale: [0.5, 1.2, 0.8]
                      }}
                      transition={{ 
                        duration: 0.8, 
                        ease: "easeOut" 
                      }}
                    />
                  )}
                </AnimatePresence>

                {/* Glow filter */}
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                    <feMerge>
                      <feMergeNode in="coloredBlur"/>
                      <feMergeNode in="SourceGraphic"/>
                    </feMerge>
                  </filter>
                </defs>
              </svg>

              {/* Agent Node */}
              <motion.div
                className={`relative w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-card to-card/50 backdrop-blur-lg border-2 ${colorClass} border-opacity-50 flex items-center justify-center hover-elevate cursor-pointer group`}
                animate={isActive ? {
                  scale: [1, 1.15, 1],
                  boxShadow: [
                    `0 0 0px hsl(var(--${agent.type}))`,
                    `0 0 30px hsl(var(--${agent.type}))`,
                    `0 0 0px hsl(var(--${agent.type}))`
                  ]
                } : {}}
                transition={{ duration: 0.5 }}
              >
                {/* Active Glow Ring */}
                <AnimatePresence>
                  {isActive && (
                    <motion.div
                      className={`absolute inset-0 rounded-full border-2 ${colorClass}`}
                      initial={{ scale: 1, opacity: 1 }}
                      animate={{ scale: 1.5, opacity: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.6 }}
                    />
                  )}
                </AnimatePresence>

                <div className="absolute inset-0 rounded-full bg-gradient-to-br from-transparent to-black/5" />
                
                <div className="relative z-10 flex flex-col items-center gap-1">
                  <motion.div
                    animate={isActive ? { 
                      scale: [1, 1.2, 1],
                      rotate: [0, 10, -10, 0]
                    } : {}}
                    transition={{ duration: 0.5 }}
                  >
                    <Icon className={`w-6 h-6 md:w-8 md:h-8 ${colorClass}`} />
                  </motion.div>
                  <div className="text-center">
                    <p className={`text-xs md:text-sm font-display font-medium ${colorClass}`}>
                      {agent.type.charAt(0).toUpperCase() + agent.type.slice(1)}
                    </p>
                    <p className="text-[10px] md:text-xs text-muted-foreground">
                      {isActive ? "ACTIVE" : agent.status}
                    </p>
                  </div>
                </div>

                {/* Credit Score Badge */}
                <motion.div
                  className={`absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${bgColorClass} text-white`}
                  animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {agent.creditScore}
                </motion.div>

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
              </motion.div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
