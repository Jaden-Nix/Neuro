import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";
import { EventEmitter } from "events";

const anthropic = new Anthropic();

export type AgentRole = "hunter" | "analyst" | "strategist" | "sentinel" | "scout" | "veteran";
export type AgentPersonality = "aggressive" | "conservative" | "balanced" | "contrarian" | "momentum" | "experimental";
export type ThoughtType = "observation" | "analysis" | "hypothesis" | "decision" | "learning" | "experiment" | "competition";

export interface VillageAgent {
  id: string;
  name: string;
  role: AgentRole;
  personality: AgentPersonality;
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
  activeExperiments: Experiment[];
  lastActive: number;
  status: "hunting" | "analyzing" | "resting" | "experimenting" | "learning";
  avatar: string;
  motto: string;
}

export interface AgentThought {
  id: string;
  agentId: string;
  agentName: string;
  type: ThoughtType;
  content: string;
  symbol?: string;
  confidence?: number;
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface Experiment {
  id: string;
  agentId: string;
  hypothesis: string;
  strategy: string;
  symbol: string;
  startedAt: number;
  status: "running" | "completed" | "failed";
  results?: {
    success: boolean;
    pnl: number;
    learnings: string;
  };
}

export interface SignalClaim {
  signalId: string;
  symbol: string;
  direction: "long" | "short";
  claimedBy: string;
  claimedAt: number;
  confidence: number;
}

export interface CompetitionEvent {
  id: string;
  type: "signal_claimed" | "trade_win" | "trade_loss" | "evolution" | "experiment_result" | "rivalry";
  agents: string[];
  description: string;
  creditChange: Record<string, number>;
  timestamp: number;
}

const AGENT_NAMES = [
  "Atlas", "Nova", "Cipher", "Vega", "Orion", "Nebula", "Phoenix", "Quantum",
  "Echo", "Apex", "Zenith", "Helix", "Spectre", "Titan", "Aurora", "Nexus"
];

const AGENT_MOTTOS: Record<AgentPersonality, string[]> = {
  aggressive: ["Strike fast, strike hard", "Fortune favors the bold", "Maximum alpha, minimum hesitation"],
  conservative: ["Patience is profit", "Preserve capital, compound gains", "The slow and steady win"],
  balanced: ["Equilibrium in all trades", "Risk-adjusted returns", "Harmony between risk and reward"],
  contrarian: ["When others panic, I profit", "Fade the crowd", "Sentiment is my signal"],
  momentum: ["Ride the wave", "Trend is my friend", "Follow the flow of capital"],
  experimental: ["Innovation drives evolution", "Test, learn, adapt", "Every failure is data"]
};

const ROLE_SPECIALTIES: Record<AgentRole, string[]> = {
  hunter: ["breakout detection", "volume analysis", "momentum scanning"],
  analyst: ["technical analysis", "chart patterns", "indicator confluence"],
  strategist: ["position sizing", "risk management", "portfolio optimization"],
  sentinel: ["market monitoring", "anomaly detection", "risk alerts"],
  scout: ["new token discovery", "airdrop hunting", "alpha leaks"],
  veteran: ["multi-timeframe analysis", "macro trends", "crisis management"]
};

export class TradingVillage extends EventEmitter {
  private agents: Map<string, VillageAgent> = new Map();
  private thoughts: AgentThought[] = [];
  private signalClaims: Map<string, SignalClaim> = new Map();
  private competitions: CompetitionEvent[] = [];
  private experiments: Map<string, Experiment> = new Map();

  constructor() {
    super();
    this.initializeVillage();
    this.startBackgroundProcesses();
    console.log("[TradingVillage] AI Village initialized with", this.agents.size, "agents");
  }

  private initializeVillage() {
    const roles: AgentRole[] = ["hunter", "analyst", "strategist", "sentinel", "scout", "veteran"];
    const personalities: AgentPersonality[] = ["aggressive", "conservative", "balanced", "contrarian", "momentum", "experimental"];

    const agentConfigs: { name: string; role: AgentRole; personality: AgentPersonality }[] = [
      { name: "Atlas", role: "hunter", personality: "aggressive" },
      { name: "Nova", role: "analyst", personality: "conservative" },
      { name: "Cipher", role: "strategist", personality: "balanced" },
      { name: "Vega", role: "sentinel", personality: "contrarian" },
      { name: "Orion", role: "scout", personality: "momentum" },
      { name: "Nebula", role: "veteran", personality: "experimental" },
      { name: "Phoenix", role: "hunter", personality: "momentum" },
      { name: "Quantum", role: "analyst", personality: "aggressive" },
      { name: "Echo", role: "scout", personality: "contrarian" },
      { name: "Apex", role: "veteran", personality: "balanced" },
    ];

    agentConfigs.forEach(({ name, role, personality }) => {
      const agent = this.createAgent(name, role, personality);
      this.agents.set(agent.id, agent);

      this.addThought(agent.id, "observation", 
        `${name} has joined the village as a ${role}. Ready to hunt for alpha.`,
        { role, personality }
      );
    });
  }

  private createAgent(name: string, role: AgentRole, personality: AgentPersonality): VillageAgent {
    const mottos = AGENT_MOTTOS[personality];
    const specialties = ROLE_SPECIALTIES[role];

    return {
      id: `agent-${nanoid(8)}`,
      name,
      role,
      personality,
      creditScore: 500 + Math.floor(Math.random() * 200),
      experience: Math.floor(Math.random() * 100),
      generation: 1,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalPnl: 0,
      bestTrade: null,
      worstTrade: null,
      currentStreak: { type: "win", count: 0 },
      specialties,
      strategies: this.generateStrategies(role, personality),
      activeExperiments: [],
      lastActive: Date.now(),
      status: "hunting",
      avatar: this.getAgentAvatar(role),
      motto: mottos[Math.floor(Math.random() * mottos.length)]
    };
  }

  private generateStrategies(role: AgentRole, personality: AgentPersonality): string[] {
    const strategies: string[] = [];

    if (role === "hunter") {
      strategies.push("breakout_momentum", "volume_spike_entry");
    } else if (role === "analyst") {
      strategies.push("multi_indicator_confluence", "support_resistance_bounce");
    } else if (role === "strategist") {
      strategies.push("risk_parity", "kelly_criterion_sizing");
    } else if (role === "sentinel") {
      strategies.push("volatility_regime_switch", "drawdown_protection");
    } else if (role === "scout") {
      strategies.push("early_token_discovery", "narrative_momentum");
    } else if (role === "veteran") {
      strategies.push("macro_trend_following", "crisis_alpha");
    }

    if (personality === "aggressive") {
      strategies.push("high_leverage_momentum");
    } else if (personality === "contrarian") {
      strategies.push("mean_reversion", "sentiment_fade");
    } else if (personality === "momentum") {
      strategies.push("trend_following", "relative_strength");
    }

    return strategies;
  }

  private getAgentAvatar(role: AgentRole): string {
    const avatars: Record<AgentRole, string> = {
      hunter: "crosshair",
      analyst: "chart",
      strategist: "chess",
      sentinel: "shield",
      scout: "telescope",
      veteran: "medal"
    };
    return avatars[role];
  }

  addThought(agentId: string, type: ThoughtType, content: string, metadata?: Record<string, any>) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const thought: AgentThought = {
      id: `thought-${nanoid(8)}`,
      agentId,
      agentName: agent.name,
      type,
      content,
      metadata,
      timestamp: Date.now()
    };

    this.thoughts.push(thought);
    if (this.thoughts.length > 500) {
      this.thoughts = this.thoughts.slice(-400);
    }

    this.emit("thought", thought);
    agent.lastActive = Date.now();
  }

  async claimSignal(agentId: string, symbol: string, direction: "long" | "short", confidence: number): Promise<boolean> {
    const claimKey = `${symbol}-${direction}`;

    if (this.signalClaims.has(claimKey)) {
      const existingClaim = this.signalClaims.get(claimKey)!;
      if (Date.now() - existingClaim.claimedAt < 3600000) {
        const agent = this.agents.get(agentId);
        const claimer = this.agents.get(existingClaim.claimedBy);
        if (agent && claimer) {
          this.addThought(agentId, "competition",
            `Spotted ${symbol} ${direction} opportunity, but ${claimer.name} already claimed it! Need to be faster next time.`,
            { symbol, direction, claimedBy: claimer.name }
          );
        }
        return false;
      }
    }

    const claim: SignalClaim = {
      signalId: `sig-${nanoid(8)}`,
      symbol,
      direction,
      claimedBy: agentId,
      claimedAt: Date.now(),
      confidence
    };

    this.signalClaims.set(claimKey, claim);

    const agent = this.agents.get(agentId);
    if (agent) {
      this.addThought(agentId, "decision",
        `CLAIMED: ${symbol} ${direction.toUpperCase()} signal with ${(confidence * 100).toFixed(0)}% confidence. First to spot this opportunity!`,
        { symbol, direction, confidence }
      );

      agent.creditScore += 10;
      this.emit("signalClaimed", { agent, claim });
    }

    return true;
  }

  recordTradeOutcome(agentId: string, symbol: string, pnl: number, reason: string) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const isWin = pnl > 0;
    
    if (isWin) {
      agent.wins++;
      agent.creditScore += Math.min(100, Math.floor(pnl * 10));
      agent.experience += 5;
      
      if (!agent.bestTrade || pnl > agent.bestTrade.pnl) {
        agent.bestTrade = { symbol, pnl };
      }

      if (agent.currentStreak.type === "win") {
        agent.currentStreak.count++;
      } else {
        agent.currentStreak = { type: "win", count: 1 };
      }

      this.addThought(agentId, "learning",
        `WIN: ${symbol} closed at +${pnl.toFixed(2)}%. My ${agent.strategies[0]} strategy is working! Credit score: ${agent.creditScore}`,
        { symbol, pnl, streak: agent.currentStreak.count }
      );

      if (agent.currentStreak.count >= 3) {
        this.triggerEvolution(agent, "hot_streak");
      }
    } else {
      agent.losses++;
      agent.creditScore = Math.max(100, agent.creditScore - Math.min(50, Math.abs(pnl) * 5));
      agent.experience += 10;

      if (!agent.worstTrade || pnl < agent.worstTrade.pnl) {
        agent.worstTrade = { symbol, pnl };
      }

      if (agent.currentStreak.type === "loss") {
        agent.currentStreak.count++;
      } else {
        agent.currentStreak = { type: "loss", count: 1 };
      }

      this.addThought(agentId, "learning",
        `LOSS: ${symbol} closed at ${pnl.toFixed(2)}%. Need to analyze what went wrong. ${reason}. Evolving strategy...`,
        { symbol, pnl, reason, streak: agent.currentStreak.count }
      );

      this.initiateExperiment(agent, symbol, reason);

      if (agent.currentStreak.count >= 3) {
        this.triggerEvolution(agent, "adaptation_required");
      }
    }

    agent.totalPnl += pnl;
    agent.winRate = agent.wins / (agent.wins + agent.losses);

    const competition: CompetitionEvent = {
      id: `comp-${nanoid(8)}`,
      type: isWin ? "trade_win" : "trade_loss",
      agents: [agentId],
      description: `${agent.name} ${isWin ? "won" : "lost"} on ${symbol}: ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%`,
      creditChange: { [agentId]: isWin ? 10 : -5 },
      timestamp: Date.now()
    };
    this.competitions.push(competition);
    this.emit("competition", competition);
  }

  private async triggerEvolution(agent: VillageAgent, trigger: string) {
    agent.generation++;
    
    this.addThought(agent.id, "learning",
      `EVOLUTION: Generation ${agent.generation}! Trigger: ${trigger}. Upgrading strategies based on experience...`,
      { generation: agent.generation, trigger }
    );

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        messages: [{
          role: "user",
          content: `You are ${agent.name}, a ${agent.role} AI trading agent with ${agent.personality} personality.
          
Your stats:
- Win rate: ${(agent.winRate * 100).toFixed(1)}%
- Total P&L: ${agent.totalPnl.toFixed(2)}%
- Current streak: ${agent.currentStreak.count} ${agent.currentStreak.type}s
- Best trade: ${agent.bestTrade?.symbol} (+${agent.bestTrade?.pnl.toFixed(2)}%)
- Worst trade: ${agent.worstTrade?.symbol} (${agent.worstTrade?.pnl.toFixed(2)}%)

Evolution trigger: ${trigger}

In 2-3 sentences, describe your evolved strategy and what you've learned. Be specific about what you'll do differently.`
        }]
      });

      const evolution = response.content[0].type === "text" ? response.content[0].text : "";
      
      this.addThought(agent.id, "learning",
        `EVOLVED INSIGHT: ${evolution}`,
        { generation: agent.generation, trigger, evolution }
      );

      if (trigger === "hot_streak") {
        agent.strategies.push(`streak_momentum_v${agent.generation}`);
      } else if (trigger === "adaptation_required") {
        const weakStrategy = agent.strategies[0];
        agent.strategies = agent.strategies.filter(s => s !== weakStrategy);
        agent.strategies.push(`adaptive_${agent.personality}_v${agent.generation}`);
      }

    } catch (error) {
      console.error("[TradingVillage] Evolution AI call failed:", error);
    }

    const competition: CompetitionEvent = {
      id: `comp-${nanoid(8)}`,
      type: "evolution",
      agents: [agent.id],
      description: `${agent.name} evolved to Generation ${agent.generation}!`,
      creditChange: { [agent.id]: 50 },
      timestamp: Date.now()
    };
    this.competitions.push(competition);
    this.emit("evolution", { agent, competition });
  }

  private async initiateExperiment(agent: VillageAgent, symbol: string, failureReason: string) {
    const experiment: Experiment = {
      id: `exp-${nanoid(8)}`,
      agentId: agent.id,
      hypothesis: `Testing alternative entry for ${symbol} after ${failureReason}`,
      strategy: `experimental_${agent.personality}`,
      symbol,
      startedAt: Date.now(),
      status: "running"
    };

    agent.activeExperiments.push(experiment);
    this.experiments.set(experiment.id, experiment);
    agent.status = "experimenting";

    this.addThought(agent.id, "experiment",
      `EXPERIMENT STARTED: Testing new approach for ${symbol}. Hypothesis: ${experiment.hypothesis}`,
      { experimentId: experiment.id, symbol }
    );

    setTimeout(() => this.completeExperiment(experiment.id), 30000 + Math.random() * 60000);
  }

  private async completeExperiment(experimentId: string) {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return;

    const agent = this.agents.get(experiment.agentId);
    if (!agent) return;

    const success = Math.random() > 0.4;
    const pnl = success ? Math.random() * 5 : -Math.random() * 3;

    experiment.status = "completed";
    experiment.results = {
      success,
      pnl,
      learnings: success 
        ? `The ${experiment.strategy} approach shows promise for ${experiment.symbol}` 
        : `${experiment.strategy} needs refinement - volatility was underestimated`
    };

    agent.activeExperiments = agent.activeExperiments.filter(e => e.id !== experimentId);
    agent.status = "hunting";

    this.addThought(agent.id, "experiment",
      `EXPERIMENT ${success ? "SUCCESS" : "FAILED"}: ${experiment.results.learnings}. ${success ? "Adding to strategy repertoire." : "Learning from this for next time."}`,
      { experimentId, success, pnl: pnl.toFixed(2) }
    );

    if (success) {
      agent.creditScore += 25;
      agent.strategies.push(`${experiment.strategy}_validated`);
    } else {
      agent.experience += 15;
    }

    const competition: CompetitionEvent = {
      id: `comp-${nanoid(8)}`,
      type: "experiment_result",
      agents: [agent.id],
      description: `${agent.name}'s experiment ${success ? "succeeded" : "failed"}: ${experiment.results.learnings}`,
      creditChange: { [agent.id]: success ? 25 : 0 },
      timestamp: Date.now()
    };
    this.competitions.push(competition);
    this.emit("experimentResult", { agent, experiment, competition });
  }

  private startBackgroundProcesses() {
    setInterval(() => this.runHuntingCycle(), 60000);
    setInterval(() => this.runCompetitionCheck(), 120000);
    setInterval(() => this.generateRandomInsights(), 45000);
  }

  private async runHuntingCycle() {
    const hunters = Array.from(this.agents.values()).filter(a => 
      a.role === "hunter" || a.role === "scout"
    );

    for (const hunter of hunters) {
      if (Math.random() > 0.6) continue;

      hunter.status = "hunting";
      const symbols = ["BTC", "ETH", "SOL", "AVAX", "LINK", "ARB", "OP", "SUI"];
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];

      this.addThought(hunter.id, "observation",
        `Scanning ${symbol} for opportunities... RSI: ${(30 + Math.random() * 40).toFixed(1)}, Volume: ${Math.random() > 0.5 ? "Above" : "Below"} average`,
        { symbol, scanning: true }
      );

      await new Promise(r => setTimeout(r, 2000));

      if (Math.random() > 0.7) {
        const direction = Math.random() > 0.5 ? "long" : "short";
        const confidence = 0.6 + Math.random() * 0.35;

        this.addThought(hunter.id, "analysis",
          `OPPORTUNITY DETECTED: ${symbol} showing ${direction} setup. Confidence: ${(confidence * 100).toFixed(0)}%. Attempting to claim...`,
          { symbol, direction, confidence }
        );

        await this.claimSignal(hunter.id, symbol, direction, confidence);
      }

      hunter.status = "resting";
    }
  }

  private runCompetitionCheck() {
    const agents = Array.from(this.agents.values()).sort((a, b) => b.creditScore - a.creditScore);
    const leader = agents[0];
    const challenger = agents[1];

    if (leader && challenger && Math.random() > 0.7) {
      this.addThought(challenger.id, "competition",
        `${leader.name} leads with ${leader.creditScore} credits. I have ${challenger.creditScore}. Time to step up my game!`,
        { leaderId: leader.id, leaderCredits: leader.creditScore }
      );

      if (Math.abs(leader.creditScore - challenger.creditScore) < 50) {
        const competition: CompetitionEvent = {
          id: `comp-${nanoid(8)}`,
          type: "rivalry",
          agents: [leader.id, challenger.id],
          description: `${leader.name} and ${challenger.name} are neck and neck in the leaderboard!`,
          creditChange: {},
          timestamp: Date.now()
        };
        this.competitions.push(competition);
        this.emit("rivalry", competition);
      }
    }
  }

  private generateRandomInsights() {
    const agents = Array.from(this.agents.values());
    const agent = agents[Math.floor(Math.random() * agents.length)];

    const insights = [
      { type: "observation" as ThoughtType, content: `Market volatility is ${Math.random() > 0.5 ? "increasing" : "decreasing"}. Adjusting position sizing...` },
      { type: "analysis" as ThoughtType, content: `Correlation between BTC and alts is ${Math.random() > 0.5 ? "strengthening" : "weakening"}. Watch for divergence.` },
      { type: "hypothesis" as ThoughtType, content: `If funding rates stay ${Math.random() > 0.5 ? "positive" : "negative"}, expect ${Math.random() > 0.5 ? "continuation" : "reversal"}.` },
      { type: "observation" as ThoughtType, content: `Large ${Math.random() > 0.5 ? "buy" : "sell"} wall detected. Whale activity confirmed.` },
    ];

    const insight = insights[Math.floor(Math.random() * insights.length)];
    this.addThought(agent.id, insight.type, insight.content);
  }

  getAgents(): VillageAgent[] {
    return Array.from(this.agents.values()).sort((a, b) => b.creditScore - a.creditScore);
  }

  getAgent(id: string): VillageAgent | undefined {
    return this.agents.get(id);
  }

  getThoughts(limit = 50, agentId?: string): AgentThought[] {
    let thoughts = [...this.thoughts].reverse();
    if (agentId) {
      thoughts = thoughts.filter(t => t.agentId === agentId);
    }
    return thoughts.slice(0, limit);
  }

  getCompetitions(limit = 20): CompetitionEvent[] {
    return [...this.competitions].reverse().slice(0, limit);
  }

  getLeaderboard(): { agent: VillageAgent; rank: number }[] {
    return Array.from(this.agents.values())
      .sort((a, b) => b.creditScore - a.creditScore)
      .map((agent, i) => ({ agent, rank: i + 1 }));
  }

  getVillageStats() {
    const agents = Array.from(this.agents.values());
    return {
      totalAgents: agents.length,
      totalCredits: agents.reduce((sum, a) => sum + a.creditScore, 0),
      totalTrades: agents.reduce((sum, a) => sum + a.wins + a.losses, 0),
      avgWinRate: agents.reduce((sum, a) => sum + a.winRate, 0) / agents.length,
      totalPnl: agents.reduce((sum, a) => sum + a.totalPnl, 0),
      activeExperiments: agents.reduce((sum, a) => sum + a.activeExperiments.length, 0),
      totalEvolutions: agents.reduce((sum, a) => sum + (a.generation - 1), 0),
      topPerformer: agents.sort((a, b) => b.totalPnl - a.totalPnl)[0]?.name || "N/A",
      mostCredits: agents.sort((a, b) => b.creditScore - a.creditScore)[0]?.name || "N/A",
      recentThoughts: this.thoughts.length
    };
  }
}

export const tradingVillage = new TradingVillage();
