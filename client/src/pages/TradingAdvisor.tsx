import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  RefreshCw,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Brain,
  Coins,
  Clock,
  ChevronRight,
  Shield,
  AlertTriangle,
  Gift,
  Sparkles,
  BarChart3,
  Radar,
  CheckCircle2,
  XCircle,
  Timer,
  Percent,
  DollarSign,
  LineChart,
  ExternalLink,
  Users,
  Trophy,
} from "lucide-react";

interface TradingSignal {
  id: string;
  symbol: string;
  direction: "long" | "short";
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  confidence: number;
  timeframe: string;
  exchange: string;
  reasoning: string;
  indicators: {
    rsi: number;
    macd: { line: number; signal: number; histogram: number };
    ema20: number;
    ema50: number;
    volume24h: number;
    volatility: number;
  };
  status: "active" | "closed" | "expired";
  createdAt: number;
  expiresAt: number;
  agentId: string;
}

interface TradeOutcome {
  id: string;
  signalId: string;
  exitPrice: number;
  exitReason: string;
  profitLoss: number;
  profitLossPercent: number;
  duration: number;
  closedAt: number;
  evolutionTriggered: boolean;
}

interface AirdropOpportunity {
  id: string;
  protocol: string;
  chain: string;
  type: "retroactive" | "non_retroactive" | "testnet" | "social";
  estimatedValue: string;
  confidence: number;
  requirements: string[];
  deadline?: number;
  status: "active" | "claimed" | "expired";
  link: string;
  description: string;
  difficulty: "easy" | "medium" | "hard";
  timeRequired: string;
}

interface TradingPerformance {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgWinPercent: number;
  avgLossPercent: number;
  profitFactor: number;
  sharpeRatio: number;
  maxDrawdown: number;
  totalPnlPercent: number;
  bestTrade: { symbol: string; pnl: number };
  worstTrade: { symbol: string; pnl: number };
  currentStreak: { type: "win" | "loss"; count: number };
  byTimeframe: Record<string, any>;
  byExchange: Record<string, any>;
  evolutionCount: number;
  lastUpdated: number;
}

interface VillageAgent {
  id: string;
  name: string;
  role: "hunter" | "analyst" | "strategist" | "sentinel" | "scout" | "veteran";
  personality: "aggressive" | "conservative" | "balanced" | "contrarian" | "momentum" | "experimental";
  creditScore: number;
  experience: number;
  generation: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  bestTrade: { symbol: string; pnl: number } | null;
  worstTrade: { symbol: string; pnl: number } | null;
  currentStreak: { type: "win" | "loss"; count: number };
  specialties: string[];
  strategies: string[];
  status: "hunting" | "analyzing" | "resting" | "experimenting" | "learning";
  avatar: string;
  motto: string;
}

interface AgentThought {
  id: string;
  agentId: string;
  agentName: string;
  type: "observation" | "analysis" | "hypothesis" | "decision" | "learning" | "experiment" | "competition";
  content: string;
  symbol?: string;
  confidence?: number;
  metadata?: Record<string, any>;
  timestamp: number;
}

interface VillageStats {
  totalAgents: number;
  totalCredits: number;
  totalTrades: number;
  avgWinRate: number;
  totalPnl: number;
  activeExperiments: number;
  totalEvolutions: number;
  topPerformer: string;
  mostCredits: string;
  recentThoughts: number;
}

const EXCHANGE_INFO: Record<string, { label: string; color: string }> = {
  binance: { label: "Binance", color: "text-yellow-500" },
  hyperliquid: { label: "Hyperliquid", color: "text-cyan-500" },
  coinbase: { label: "Coinbase", color: "text-blue-500" },
  bybit: { label: "Bybit", color: "text-orange-500" },
};

const CHAIN_INFO: Record<string, { color: string }> = {
  ethereum: { color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  base: { color: "bg-blue-600/10 text-blue-600 border-blue-600/30" },
  arbitrum: { color: "bg-sky-500/10 text-sky-500 border-sky-500/30" },
  optimism: { color: "bg-red-500/10 text-red-500 border-red-500/30" },
  zksync: { color: "bg-purple-500/10 text-purple-500 border-purple-500/30" },
  starknet: { color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/30" },
  solana: { color: "bg-violet-500/10 text-violet-500 border-violet-500/30" },
  sui: { color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30" },
};

const AIRDROP_TYPE_INFO: Record<string, { label: string; color: string }> = {
  retroactive: { label: "Retroactive", color: "bg-green-500/10 text-green-500 border-green-500/30" },
  non_retroactive: { label: "Non-Retro", color: "bg-blue-500/10 text-blue-500 border-blue-500/30" },
  testnet: { label: "Testnet", color: "bg-purple-500/10 text-purple-500 border-purple-500/30" },
  social: { label: "Social", color: "bg-pink-500/10 text-pink-500 border-pink-500/30" },
};

const ROLE_INFO: Record<string, { label: string; color: string; icon: string }> = {
  hunter: { label: "Hunter", color: "text-orange-500 bg-orange-500/10", icon: "crosshair" },
  analyst: { label: "Analyst", color: "text-blue-500 bg-blue-500/10", icon: "chart" },
  strategist: { label: "Strategist", color: "text-purple-500 bg-purple-500/10", icon: "chess" },
  sentinel: { label: "Sentinel", color: "text-green-500 bg-green-500/10", icon: "shield" },
  scout: { label: "Scout", color: "text-cyan-500 bg-cyan-500/10", icon: "telescope" },
  veteran: { label: "Veteran", color: "text-yellow-500 bg-yellow-500/10", icon: "medal" },
};

const PERSONALITY_INFO: Record<string, { label: string; color: string }> = {
  aggressive: { label: "Aggressive", color: "text-red-500" },
  conservative: { label: "Conservative", color: "text-blue-500" },
  balanced: { label: "Balanced", color: "text-green-500" },
  contrarian: { label: "Contrarian", color: "text-purple-500" },
  momentum: { label: "Momentum", color: "text-orange-500" },
  experimental: { label: "Experimental", color: "text-pink-500" },
};

const STATUS_INFO: Record<string, { label: string; color: string }> = {
  hunting: { label: "Hunting", color: "bg-orange-500" },
  analyzing: { label: "Analyzing", color: "bg-blue-500" },
  resting: { label: "Resting", color: "bg-gray-500" },
  experimenting: { label: "Experimenting", color: "bg-purple-500" },
  learning: { label: "Learning", color: "bg-green-500" },
};

const THOUGHT_TYPE_INFO: Record<string, { color: string }> = {
  observation: { color: "border-l-blue-500" },
  analysis: { color: "border-l-cyan-500" },
  hypothesis: { color: "border-l-purple-500" },
  decision: { color: "border-l-green-500" },
  learning: { color: "border-l-yellow-500" },
  experiment: { color: "border-l-pink-500" },
  competition: { color: "border-l-orange-500" },
};

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function SignalCard({ signal, onClose }: { signal: TradingSignal; onClose: (id: string, price: number) => void }) {
  const isLong = signal.direction === "long";
  const riskDiff = Math.abs(signal.entryPrice - signal.stopLoss);
  const rewardDiff = Math.abs(signal.takeProfit1 - signal.entryPrice);
  const riskReward = riskDiff > 0 ? (rewardDiff / riskDiff).toFixed(1) : "N/A";
  const potentialGain = signal.entryPrice > 0 ? (((signal.takeProfit1 - signal.entryPrice) / signal.entryPrice) * 100).toFixed(1) : "0";
  const potentialLoss = signal.entryPrice > 0 ? (((signal.entryPrice - signal.stopLoss) / signal.entryPrice) * 100).toFixed(1) : "0";
  const timeRemaining = signal.expiresAt - Date.now();
  const isExpiring = timeRemaining < 3600000;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      layout
    >
      <Card className={`relative overflow-visible ${isLong ? "border-l-4 border-l-green-500" : "border-l-4 border-l-red-500"}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-md ${isLong ? "bg-green-500/10" : "bg-red-500/10"}`}>
                {isLong ? (
                  <TrendingUp className="h-5 w-5 text-green-500" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-red-500" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {signal.symbol}
                  <Badge variant="outline" className={isLong ? "border-green-500/30 text-green-500" : "border-red-500/30 text-red-500"}>
                    {signal.direction.toUpperCase()}
                  </Badge>
                </CardTitle>
                <CardDescription className="flex items-center gap-2">
                  <span className={EXCHANGE_INFO[signal.exchange]?.color || "text-muted-foreground"}>
                    {EXCHANGE_INFO[signal.exchange]?.label || signal.exchange}
                  </span>
                  <span className="text-muted-foreground/50">|</span>
                  <span>{signal.timeframe}</span>
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-right">
                <div className="text-sm text-muted-foreground">Confidence</div>
                <div className="text-lg font-bold">{(signal.confidence * 100).toFixed(0)}%</div>
              </div>
              <div className={`h-12 w-12 rounded-full flex items-center justify-center ${
                signal.confidence >= 0.8 ? "bg-green-500/20" : 
                signal.confidence >= 0.6 ? "bg-yellow-500/20" : "bg-red-500/20"
              }`}>
                <Brain className={`h-6 w-6 ${
                  signal.confidence >= 0.8 ? "text-green-500" : 
                  signal.confidence >= 0.6 ? "text-yellow-500" : "text-red-500"
                }`} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-muted/50 rounded-md p-3">
              <div className="text-xs text-muted-foreground mb-1">Entry</div>
              <div className="font-mono font-semibold">${signal.entryPrice.toLocaleString()}</div>
            </div>
            <div className="bg-red-500/10 rounded-md p-3">
              <div className="text-xs text-red-500 mb-1 flex items-center gap-1">
                <Shield className="h-3 w-3" /> Stop Loss
              </div>
              <div className="font-mono font-semibold text-red-500">${signal.stopLoss.toLocaleString()}</div>
            </div>
            <div className="bg-green-500/10 rounded-md p-3">
              <div className="text-xs text-green-500 mb-1 flex items-center gap-1">
                <Target className="h-3 w-3" /> TP1
              </div>
              <div className="font-mono font-semibold text-green-500">${signal.takeProfit1.toLocaleString()}</div>
            </div>
            <div className="bg-green-500/5 rounded-md p-3">
              <div className="text-xs text-green-500/70 mb-1 flex items-center gap-1">
                <Target className="h-3 w-3" /> TP2/TP3
              </div>
              <div className="font-mono text-sm text-green-500/70">
                ${signal.takeProfit2.toLocaleString()} / ${signal.takeProfit3.toLocaleString()}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <Percent className="h-4 w-4 text-muted-foreground" />
                <span className="text-green-500">+{potentialGain}%</span>
                <span className="text-muted-foreground">/</span>
                <span className="text-red-500">-{potentialLoss}%</span>
              </div>
              <div className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                <span>R:R {riskReward}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isExpiring && (
                <Badge variant="outline" className="border-orange-500/30 text-orange-500">
                  <Timer className="h-3 w-3 mr-1" />
                  Expiring soon
                </Badge>
              )}
              <span className="text-muted-foreground text-xs">{formatTimeAgo(signal.createdAt)}</span>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
              <Activity className="h-4 w-4" /> Indicators
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">RSI:</span>
                <span className={signal.indicators.rsi > 70 ? "text-red-500" : signal.indicators.rsi < 30 ? "text-green-500" : ""}>
                  {signal.indicators.rsi.toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MACD:</span>
                <span className={signal.indicators.macd.histogram > 0 ? "text-green-500" : "text-red-500"}>
                  {signal.indicators.macd.histogram.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Volatility:</span>
                <span>{(signal.indicators.volatility * 100).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="text-sm text-muted-foreground mb-1 flex items-center gap-1">
              <Sparkles className="h-4 w-4" /> AI Reasoning
            </div>
            <p className="text-sm leading-relaxed">{signal.reasoning}</p>
          </div>

          {signal.status === "active" && (
            <div className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => onClose(signal.id, signal.takeProfit1)}
                data-testid={`button-close-signal-${signal.id}`}
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Close at TP1
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="flex-1 border-red-500/30 text-red-500"
                onClick={() => onClose(signal.id, signal.stopLoss)}
                data-testid={`button-stop-signal-${signal.id}`}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Close at SL
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AirdropCard({ airdrop }: { airdrop: AirdropOpportunity }) {
  const typeInfo = AIRDROP_TYPE_INFO[airdrop.type] || { label: airdrop.type, color: "bg-muted" };
  const chainInfo = CHAIN_INFO[airdrop.chain] || { color: "bg-muted" };
  const daysLeft = airdrop.deadline ? Math.ceil((airdrop.deadline - Date.now()) / 86400000) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <Card className="hover-elevate">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{airdrop.protocol}</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={typeInfo.color}>
                {typeInfo.label}
              </Badge>
              <Badge variant="outline" className={chainInfo.color}>
                {airdrop.chain}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">{airdrop.description}</p>
          
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-xs text-muted-foreground">Est. Value</div>
                <div className="font-semibold text-green-500">{airdrop.estimatedValue}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Confidence</div>
                <div className="font-semibold">{(airdrop.confidence * 100).toFixed(0)}%</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Difficulty</div>
                <Badge variant="outline" className={
                  airdrop.difficulty === "easy" ? "border-green-500/30 text-green-500" :
                  airdrop.difficulty === "medium" ? "border-yellow-500/30 text-yellow-500" :
                  "border-red-500/30 text-red-500"
                }>
                  {airdrop.difficulty}
                </Badge>
              </div>
            </div>
            {daysLeft !== null && (
              <Badge variant={daysLeft < 7 ? "destructive" : "outline"}>
                <Clock className="h-3 w-3 mr-1" />
                {daysLeft} days left
              </Badge>
            )}
          </div>

          <div>
            <div className="text-xs text-muted-foreground mb-2">Requirements</div>
            <div className="flex flex-wrap gap-1">
              {airdrop.requirements.map((req, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {req}
                </Badge>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Timer className="h-3 w-3" />
              ~{airdrop.timeRequired}
            </span>
            <Button size="sm" variant="ghost" asChild>
              <a href={airdrop.link} target="_blank" rel="noopener noreferrer" data-testid={`link-airdrop-${airdrop.id}`}>
                Learn More <ExternalLink className="h-3 w-3 ml-1" />
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function VillageAgentCard({ agent, rank }: { agent: VillageAgent; rank: number }) {
  const roleInfo = ROLE_INFO[agent.role] || { label: agent.role, color: "text-gray-500 bg-gray-500/10" };
  const personalityInfo = PERSONALITY_INFO[agent.personality] || { label: agent.personality, color: "text-gray-500" };
  const statusInfo = STATUS_INFO[agent.status] || { label: agent.status, color: "bg-gray-500" };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
    >
      <Card className="hover-elevate">
        <CardContent className="pt-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`relative p-3 rounded-full ${roleInfo.color}`}>
                <Brain className="h-5 w-5" />
                <div className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ${statusInfo.color} ring-2 ring-background`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{agent.name}</span>
                  <Badge variant="outline" className="text-xs">Gen {agent.generation}</Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className={roleInfo.color.split(" ")[0]}>{roleInfo.label}</span>
                  <span className="text-muted-foreground/50">|</span>
                  <span className={personalityInfo.color}>{personalityInfo.label}</span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold">{agent.creditScore}</div>
              <div className="text-xs text-muted-foreground">credits</div>
            </div>
          </div>

          <div className="mt-3 text-xs text-muted-foreground italic">"{agent.motto}"</div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="bg-muted/50 rounded-md p-2">
              <div className="font-semibold">{(agent.winRate * 100).toFixed(0)}%</div>
              <div className="text-xs text-muted-foreground">Win Rate</div>
            </div>
            <div className="bg-muted/50 rounded-md p-2">
              <div className={`font-semibold ${agent.totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                {agent.totalPnl >= 0 ? "+" : ""}{agent.totalPnl.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">P&L</div>
            </div>
            <div className="bg-muted/50 rounded-md p-2">
              <div className="font-semibold">{agent.wins}W/{agent.losses}L</div>
              <div className="text-xs text-muted-foreground">Record</div>
            </div>
          </div>

          {agent.currentStreak.count > 0 && (
            <div className={`mt-2 text-xs text-center py-1 rounded-md ${
              agent.currentStreak.type === "win" ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
            }`}>
              {agent.currentStreak.count} {agent.currentStreak.type} streak
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ThoughtStream({ thoughts }: { thoughts: AgentThought[] }) {
  return (
    <ScrollArea className="h-[400px] pr-4">
      <div className="space-y-2">
        {thoughts.map((thought) => {
          const typeInfo = THOUGHT_TYPE_INFO[thought.type] || { color: "border-l-gray-500" };
          return (
            <motion.div
              key={thought.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className={`p-3 rounded-md bg-muted/30 border-l-4 ${typeInfo.color}`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{thought.agentName}</span>
                  <Badge variant="outline" className="text-xs capitalize">{thought.type}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">{formatTimeAgo(thought.timestamp)}</span>
              </div>
              <p className="text-sm text-muted-foreground">{thought.content}</p>
            </motion.div>
          );
        })}
        {thoughts.length === 0 && (
          <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
            <Brain className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Agents are thinking...</p>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

function PerformanceMetrics({ performance }: { performance: TradingPerformance }) {
  const winRate = performance.winRate ?? 0;
  const totalPnl = performance.totalPnlPercent ?? 0;
  const profitFactor = performance.profitFactor ?? 0;
  const sharpeRatio = performance.sharpeRatio ?? 0;
  const avgWin = performance.avgWinPercent ?? 0;
  const avgLoss = performance.avgLossPercent ?? 0;
  const maxDrawdown = performance.maxDrawdown ?? 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Win Rate</div>
              <div className="text-2xl font-bold">{(winRate * 100).toFixed(1)}%</div>
            </div>
            <div className={`p-2 rounded-full ${winRate >= 0.5 ? "bg-green-500/10" : "bg-red-500/10"}`}>
              <Target className={`h-5 w-5 ${winRate >= 0.5 ? "text-green-500" : "text-red-500"}`} />
            </div>
          </div>
          <Progress value={winRate * 100} className="mt-2 h-1" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Total P&L</div>
              <div className={`text-2xl font-bold ${totalPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)}%
              </div>
            </div>
            <div className={`p-2 rounded-full ${totalPnl >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
              <DollarSign className={`h-5 w-5 ${totalPnl >= 0 ? "text-green-500" : "text-red-500"}`} />
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            {performance.totalTrades} trades | {performance.wins}W / {performance.losses}L
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Profit Factor</div>
              <div className="text-2xl font-bold">{profitFactor.toFixed(2)}</div>
            </div>
            <div className={`p-2 rounded-full ${profitFactor >= 1 ? "bg-green-500/10" : "bg-red-500/10"}`}>
              <LineChart className={`h-5 w-5 ${profitFactor >= 1 ? "text-green-500" : "text-red-500"}`} />
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Avg Win: +{avgWin.toFixed(2)}% | Loss: -{Math.abs(avgLoss).toFixed(2)}%
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
              <div className="text-2xl font-bold">{sharpeRatio.toFixed(2)}</div>
            </div>
            <div className={`p-2 rounded-full ${sharpeRatio >= 1 ? "bg-green-500/10" : "bg-yellow-500/10"}`}>
              <BarChart3 className={`h-5 w-5 ${sharpeRatio >= 1 ? "text-green-500" : "text-yellow-500"}`} />
            </div>
          </div>
          <div className="text-xs text-muted-foreground mt-2">
            Max DD: -{Math.abs(maxDrawdown).toFixed(2)}%
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function TradingAdvisor() {
  const { toast } = useToast();
  const [selectedExchange, setSelectedExchange] = useState<string>("all");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("BTC-USD");

  const { data: signals = [], isLoading: signalsLoading, refetch: refetchSignals } = useQuery<TradingSignal[]>({
    queryKey: ["/api/trading/signals"],
    refetchInterval: 30000,
  });

  const { data: performance, isLoading: performanceLoading } = useQuery<TradingPerformance>({
    queryKey: ["/api/trading/performance"],
    refetchInterval: 60000,
  });

  const { data: airdrops = [], isLoading: airdropsLoading } = useQuery<AirdropOpportunity[]>({
    queryKey: ["/api/airdrops"],
    refetchInterval: 120000,
  });

  const { data: outcomes = [] } = useQuery<TradeOutcome[]>({
    queryKey: ["/api/trading/outcomes"],
  });

  const { data: villageAgents = [], isLoading: villageLoading } = useQuery<VillageAgent[]>({
    queryKey: ["/api/village/agents"],
    refetchInterval: 15000,
  });

  const { data: villageThoughts = [] } = useQuery<AgentThought[]>({
    queryKey: ["/api/village/thoughts"],
    refetchInterval: 10000,
  });

  const { data: villageStats } = useQuery<VillageStats>({
    queryKey: ["/api/village/stats"],
    refetchInterval: 30000,
  });

  const generateSignalMutation = useMutation({
    mutationFn: async (params: { symbol: string; exchange: string; timeframe: string }) => {
      const res = await apiRequest("POST", "/api/trading/signals/generate", params);
      return res.json() as Promise<TradingSignal | { message: string }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/signals"] });
      if ("id" in data) {
        toast({
          title: "New Signal Generated",
          description: `${data.direction.toUpperCase()} ${data.symbol} with ${(data.confidence * 100).toFixed(0)}% confidence`,
        });
      } else {
        toast({
          title: "No Signal Found",
          description: "Market conditions don't meet criteria for a high-confidence signal",
        });
      }
    },
    onError: () => {
      toast({
        title: "Generation Failed",
        description: "Could not generate trading signal",
        variant: "destructive",
      });
    },
  });

  const scanMarketsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/trading/signals/scan", { 
        symbols: ["BTC", "ETH", "SOL", "AVAX", "LINK", "ARB"] 
      });
      return res.json() as Promise<{ signals: TradingSignal[]; count: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/signals"] });
      toast({
        title: "Market Scan Complete",
        description: `Found ${data.count} trading opportunities`,
      });
    },
  });

  const closeSignalMutation = useMutation({
    mutationFn: async ({ id, exitPrice }: { id: string; exitPrice: number }) => {
      const res = await apiRequest("POST", `/api/trading/signals/${id}/close`, { 
        exitPrice, 
        exitReason: "manual" 
      });
      return res.json() as Promise<TradeOutcome>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/trading/signals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/outcomes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trading/performance"] });
      const profit = data.profitLossPercent;
      toast({
        title: profit >= 0 ? "Trade Closed - Profit" : "Trade Closed - Loss",
        description: `${profit >= 0 ? "+" : ""}${profit.toFixed(2)}% ${data.evolutionTriggered ? "(Evolution triggered)" : ""}`,
        variant: profit >= 0 ? "default" : "destructive",
      });
    },
  });

  const activeSignals = signals.filter(s => s.status === "active");
  const closedSignals = signals.filter(s => s.status === "closed");
  const activeAirdrops = airdrops.filter(a => a.status === "active");

  const filteredSignals = selectedExchange === "all" 
    ? activeSignals 
    : activeSignals.filter(s => s.exchange === selectedExchange);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Brain className="h-7 w-7 text-primary" />
            Trading Advisor
          </h1>
          <p className="text-muted-foreground mt-1">
            AI-powered trading signals, market analysis, and airdrop opportunities
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
            <SelectTrigger className="w-32" data-testid="select-symbol">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BTC-USD">BTC/USD</SelectItem>
              <SelectItem value="ETH-USD">ETH/USD</SelectItem>
              <SelectItem value="SOL-USD">SOL/USD</SelectItem>
              <SelectItem value="AVAX-USD">AVAX/USD</SelectItem>
              <SelectItem value="LINK-USD">LINK/USD</SelectItem>
              <SelectItem value="ARB-USD">ARB/USD</SelectItem>
            </SelectContent>
          </Select>
          <Button
            onClick={() => generateSignalMutation.mutate({ 
              symbol: selectedSymbol, 
              exchange: "binance", 
              timeframe: "4h" 
            })}
            disabled={generateSignalMutation.isPending}
            data-testid="button-generate-signal"
          >
            {generateSignalMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Generate Signal
          </Button>
          <Button
            variant="outline"
            onClick={() => scanMarketsMutation.mutate()}
            disabled={scanMarketsMutation.isPending}
            data-testid="button-scan-markets"
          >
            {scanMarketsMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Radar className="h-4 w-4 mr-2" />
            )}
            Scan All
          </Button>
        </div>
      </div>

      {performance && <PerformanceMetrics performance={performance} />}

      <Tabs defaultValue="village" className="space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="village" className="flex items-center gap-2" data-testid="tab-village">
            <Sparkles className="h-4 w-4" />
            AI Village
            <Badge variant="secondary" className="ml-1">{villageAgents.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="signals" className="flex items-center gap-2" data-testid="tab-signals">
            <Activity className="h-4 w-4" />
            Signals
            {activeSignals.length > 0 && (
              <Badge variant="secondary" className="ml-1">{activeSignals.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="airdrops" className="flex items-center gap-2" data-testid="tab-airdrops">
            <Gift className="h-4 w-4" />
            Airdrops
            {activeAirdrops.length > 0 && (
              <Badge variant="secondary" className="ml-1">{activeAirdrops.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2" data-testid="tab-history">
            <Clock className="h-4 w-4" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="village" className="space-y-6">
          {villageStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div className="text-xs text-muted-foreground">Agents</div>
                  </div>
                  <div className="text-xl font-bold mt-1">{villageStats.totalAgents}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Coins className="h-4 w-4 text-yellow-500" />
                    <div className="text-xs text-muted-foreground">Total Credits</div>
                  </div>
                  <div className="text-xl font-bold mt-1">{villageStats.totalCredits.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-500" />
                    <div className="text-xs text-muted-foreground">Total Trades</div>
                  </div>
                  <div className="text-xl font-bold mt-1">{villageStats.totalTrades}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <div className="text-xs text-muted-foreground">Avg Win Rate</div>
                  </div>
                  <div className="text-xl font-bold mt-1">{(villageStats.avgWinRate * 100).toFixed(0)}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-500" />
                    <div className="text-xs text-muted-foreground">Evolutions</div>
                  </div>
                  <div className="text-xl font-bold mt-1">{villageStats.totalEvolutions}</div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-orange-500" />
                    <div className="text-xs text-muted-foreground">Experiments</div>
                  </div>
                  <div className="text-xl font-bold mt-1">{villageStats.activeExperiments}</div>
                </CardContent>
              </Card>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Agent Leaderboard
                </CardTitle>
                <CardDescription>Ranked by credit score and performance</CardDescription>
              </CardHeader>
              <CardContent>
                {villageLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div className="space-y-3">
                    {villageAgents.slice(0, 6).map((agent, index) => (
                      <VillageAgentCard key={agent.id} agent={agent} rank={index} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Brain className="h-5 w-5 text-purple-500" />
                  Agent Thought Stream
                </CardTitle>
                <CardDescription>Real-time insights and decisions from the village</CardDescription>
              </CardHeader>
              <CardContent>
                <ThoughtStream thoughts={villageThoughts} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="signals" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Select value={selectedExchange} onValueChange={setSelectedExchange}>
                <SelectTrigger className="w-40" data-testid="select-exchange">
                  <SelectValue placeholder="All Exchanges" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Exchanges</SelectItem>
                  <SelectItem value="binance">Binance</SelectItem>
                  <SelectItem value="hyperliquid">Hyperliquid</SelectItem>
                  <SelectItem value="coinbase">Coinbase</SelectItem>
                  <SelectItem value="bybit">Bybit</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="sm" onClick={() => refetchSignals()} data-testid="button-refresh-signals">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {signalsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSignals.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Radar className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Active Signals</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Generate a new signal or scan all markets to find trading opportunities
                </p>
                <Button onClick={() => scanMarketsMutation.mutate()} disabled={scanMarketsMutation.isPending}>
                  <Radar className="h-4 w-4 mr-2" />
                  Scan Markets
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <AnimatePresence mode="popLayout">
                {filteredSignals.map((signal) => (
                  <SignalCard
                    key={signal.id}
                    signal={signal}
                    onClose={(id, price) => closeSignalMutation.mutate({ id, exitPrice: price })}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        <TabsContent value="airdrops" className="space-y-4">
          {airdropsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : activeAirdrops.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Gift className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Active Airdrops</h3>
                <p className="text-muted-foreground text-center">
                  Check back soon for new airdrop opportunities
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeAirdrops.map((airdrop) => (
                <AirdropCard key={airdrop.id} airdrop={airdrop} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Trade History</CardTitle>
              <CardDescription>Past trading signals and their outcomes</CardDescription>
            </CardHeader>
            <CardContent>
              {outcomes.length === 0 && closedSignals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No trade history yet</p>
                </div>
              ) : (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {outcomes.map((outcome) => (
                      <div
                        key={outcome.id}
                        className={`flex items-center justify-between p-3 rounded-md border ${
                          outcome.profitLoss >= 0 ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-md ${outcome.profitLoss >= 0 ? "bg-green-500/10" : "bg-red-500/10"}`}>
                            {outcome.profitLoss >= 0 ? (
                              <ArrowUpRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">Signal #{outcome.signalId.slice(-8)}</div>
                            <div className="text-xs text-muted-foreground">
                              {outcome.exitReason} | {formatDuration(outcome.duration)}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={`font-bold ${outcome.profitLoss >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {outcome.profitLossPercent >= 0 ? "+" : ""}{outcome.profitLossPercent.toFixed(2)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            ${Math.abs(outcome.profitLoss).toFixed(2)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {closedSignals.map((signal) => (
                      <div
                        key={signal.id}
                        className="flex items-center justify-between p-3 rounded-md border border-muted"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-md ${signal.direction === "long" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                            {signal.direction === "long" ? (
                              <TrendingUp className="h-4 w-4 text-green-500" />
                            ) : (
                              <TrendingDown className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium">{signal.symbol}</div>
                            <div className="text-xs text-muted-foreground">
                              {signal.direction.toUpperCase()} | {signal.exchange}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary">Closed</Badge>
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatTimeAgo(signal.createdAt)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
