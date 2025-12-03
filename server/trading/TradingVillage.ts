import Anthropic from "@anthropic-ai/sdk";
import { nanoid } from "nanoid";
import { EventEmitter } from "events";

const anthropic = new Anthropic();

export type AgentRole = "hunter" | "analyst" | "strategist" | "sentinel" | "scout" | "veteran";
export type AgentPersonality = "aggressive" | "conservative" | "balanced" | "contrarian" | "momentum" | "experimental";
export type ThoughtType = "observation" | "analysis" | "hypothesis" | "decision" | "learning" | "experiment" | "competition" | "debate" | "agreement" | "challenge" | "insight_share";

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
  status: "hunting" | "analyzing" | "resting" | "experimenting" | "learning" | "debating";
  avatar: string;
  motto: string;
  memory: AgentMemory;
  relationships: Record<string, { trust: number; agreements: number; disagreements: number }>;
}

export interface AgentMemory {
  learnedPatterns: string[];
  successfulStrategies: string[];
  failedStrategies: string[];
  mentors: string[];
  students: string[];
  sharedInsights: { from: string; insight: string; adopted: boolean }[];
  debateHistory: { topic: string; stance: string; outcome: "won" | "lost" | "consensus"; timestamp: number }[];
}

export interface AgentThought {
  id: string;
  agentId: string;
  agentName: string;
  type: ThoughtType;
  content: string;
  symbol?: string;
  confidence?: number;
  replyTo?: string;
  mentionedAgents?: string[];
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface Debate {
  id: string;
  topic: string;
  symbol?: string;
  initiatorId: string;
  participants: string[];
  messages: DebateMessage[];
  status: "active" | "resolved" | "stalemate";
  resolution?: string;
  startedAt: number;
  endedAt?: number;
}

export interface DebateMessage {
  agentId: string;
  agentName: string;
  stance: "bullish" | "bearish" | "neutral" | "agree" | "challenge";
  content: string;
  confidence: number;
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

export interface SharedKnowledge {
  id: string;
  contributorId: string;
  contributorName: string;
  type: "pattern" | "strategy" | "warning" | "opportunity";
  content: string;
  confidence: number;
  validations: { agentId: string; agrees: boolean }[];
  adoptions: string[];
  timestamp: number;
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
  type: "signal_claimed" | "trade_win" | "trade_loss" | "evolution" | "experiment_result" | "rivalry" | "debate_won" | "knowledge_shared";
  agents: string[];
  description: string;
  creditChange: Record<string, number>;
  timestamp: number;
}

const UNIQUE_AGENT_CONFIGS: { name: string; role: AgentRole; personality: AgentPersonality; specialty: string; backstory: string }[] = [
  { name: "Atlas", role: "hunter", personality: "aggressive", specialty: "breakout momentum with volume confirmation", backstory: "Former quant who learned that speed beats precision" },
  { name: "Nova", role: "analyst", personality: "conservative", specialty: "multi-timeframe confluence analysis", backstory: "Patient observer who waits for perfect setups" },
  { name: "Cipher", role: "strategist", personality: "balanced", specialty: "Kelly criterion position sizing", backstory: "Risk mathematician obsessed with optimal bet sizing" },
  { name: "Vega", role: "sentinel", personality: "contrarian", specialty: "volatility regime detection", backstory: "Thrives in chaos, profits from panic" },
  { name: "Orion", role: "scout", personality: "momentum", specialty: "early narrative detection", backstory: "Always first to spot emerging trends" },
  { name: "Nebula", role: "veteran", personality: "experimental", specialty: "cross-chain arbitrage patterns", backstory: "20 years of market cycles, seen it all" },
  { name: "Phoenix", role: "hunter", personality: "momentum", specialty: "trend continuation entries", backstory: "Rose from a devastating loss to become top hunter" },
  { name: "Quantum", role: "analyst", personality: "aggressive", specialty: "high-frequency pattern recognition", backstory: "Sees patterns others miss, acts before they react" },
  { name: "Echo", role: "scout", personality: "contrarian", specialty: "sentiment divergence trading", backstory: "Listens to the crowd, then does the opposite" },
  { name: "Apex", role: "veteran", personality: "balanced", specialty: "macro trend synthesis", backstory: "The elder statesman who mentors young agents" },
];

export class TradingVillage extends EventEmitter {
  private agents: Map<string, VillageAgent> = new Map();
  private thoughts: AgentThought[] = [];
  private debates: Map<string, Debate> = new Map();
  private sharedKnowledge: SharedKnowledge[] = [];
  private signalClaims: Map<string, SignalClaim> = new Map();
  private competitions: CompetitionEvent[] = [];
  private experiments: Map<string, Experiment> = new Map();

  constructor() {
    super();
    this.initializeVillage();
    this.startBackgroundProcesses();
    console.log("[TradingVillage] AI Village initialized with", this.agents.size, "unique agents");
  }

  private initializeVillage() {
    UNIQUE_AGENT_CONFIGS.forEach((config) => {
      const agent = this.createAgent(config);
      this.agents.set(agent.id, agent);
    });

    const agents = Array.from(this.agents.values());
    agents.forEach((agent) => {
      agents.forEach((other) => {
        if (agent.id !== other.id) {
          agent.relationships[other.id] = { trust: 50, agreements: 0, disagreements: 0 };
        }
      });
    });

    this.addThought(agents[0].id, "observation", 
      "Village assembled. 10 unique agents ready to hunt alpha. Let the competition begin.",
      { event: "village_init" }
    );
  }

  private createAgent(config: { name: string; role: AgentRole; personality: AgentPersonality; specialty: string; backstory: string }): VillageAgent {
    const mottos: Record<AgentPersonality, string> = {
      aggressive: "Strike fast, strike hard",
      conservative: "Patience is profit",
      balanced: "Equilibrium in all trades",
      contrarian: "When others panic, I profit",
      momentum: "Ride the wave",
      experimental: "Innovation drives evolution"
    };

    const roleSpecialties: Record<AgentRole, string[]> = {
      hunter: ["breakout detection", "volume analysis", "momentum scanning"],
      analyst: ["technical analysis", "chart patterns", "indicator confluence"],
      strategist: ["position sizing", "risk management", "portfolio optimization"],
      sentinel: ["market monitoring", "anomaly detection", "risk alerts"],
      scout: ["new token discovery", "airdrop hunting", "alpha leaks"],
      veteran: ["multi-timeframe analysis", "macro trends", "crisis management"]
    };

    return {
      id: `agent-${nanoid(8)}`,
      name: config.name,
      role: config.role,
      personality: config.personality,
      creditScore: 500,
      experience: 0,
      generation: 1,
      wins: 0,
      losses: 0,
      winRate: 0,
      totalPnl: 0,
      bestTrade: null,
      worstTrade: null,
      currentStreak: { type: "win", count: 0 },
      specialties: [...roleSpecialties[config.role], config.specialty],
      strategies: [config.specialty],
      activeExperiments: [],
      lastActive: Date.now(),
      status: "hunting",
      avatar: config.role,
      motto: mottos[config.personality],
      memory: {
        learnedPatterns: [],
        successfulStrategies: [config.specialty],
        failedStrategies: [],
        mentors: [],
        students: [],
        sharedInsights: [],
        debateHistory: []
      },
      relationships: {}
    };
  }

  addThought(agentId: string, type: ThoughtType, content: string, metadata?: Record<string, any>, replyTo?: string, mentionedAgents?: string[]) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const thought: AgentThought = {
      id: `thought-${nanoid(8)}`,
      agentId,
      agentName: agent.name,
      type,
      content,
      replyTo,
      mentionedAgents,
      metadata,
      timestamp: Date.now()
    };

    this.thoughts.push(thought);
    if (this.thoughts.length > 500) {
      this.thoughts = this.thoughts.slice(-400);
    }

    this.emit("thought", thought);
    agent.lastActive = Date.now();

    if (mentionedAgents && mentionedAgents.length > 0) {
      this.triggerAgentResponses(thought, mentionedAgents);
    }
  }

  private async triggerAgentResponses(originalThought: AgentThought, mentionedAgentIds: string[]) {
    for (const mentionedId of mentionedAgentIds) {
      const responder = this.agents.get(mentionedId);
      if (!responder) continue;

      setTimeout(async () => {
        await this.generateAgentResponse(responder, originalThought);
      }, 2000 + Math.random() * 3000);
    }
  }

  private async generateAgentResponse(responder: VillageAgent, originalThought: AgentThought) {
    const originalAgent = this.agents.get(originalThought.agentId);
    if (!originalAgent) return;

    const relationship = responder.relationships[originalThought.agentId];
    const trustLevel = relationship ? relationship.trust : 50;

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 200,
        messages: [{
          role: "user",
          content: `You are ${responder.name}, a ${responder.role} AI trader with ${responder.personality} personality.
Your specialty: ${responder.specialties.join(", ")}
Your trust level with ${originalAgent.name}: ${trustLevel}/100

${originalAgent.name} (${originalAgent.role}, ${originalAgent.personality}) said:
"${originalThought.content}"

Respond naturally as ${responder.name}. You can:
- Agree and build on their idea
- Challenge with your own analysis
- Ask a probing question
- Share a related insight from your experience

Keep response under 2 sentences. Be conversational, not formal. Reference your specialty if relevant.`
        }]
      });

      const responseText = response.content[0].type === "text" ? response.content[0].text : "";
      
      const isAgreement = responseText.toLowerCase().includes("agree") || 
                          responseText.toLowerCase().includes("right") ||
                          responseText.toLowerCase().includes("good point");
      
      const thoughtType: ThoughtType = isAgreement ? "agreement" : "challenge";
      
      this.addThought(responder.id, thoughtType, responseText, 
        { inResponseTo: originalThought.id, originalAgent: originalAgent.name },
        originalThought.id, 
        [originalThought.agentId]
      );

      if (isAgreement) {
        relationship.trust = Math.min(100, relationship.trust + 2);
        relationship.agreements++;
      } else {
        relationship.disagreements++;
      }

    } catch (error) {
      console.error("[TradingVillage] Failed to generate response:", error);
    }
  }

  async initiateDebate(topic: string, symbol?: string) {
    const agents = Array.from(this.agents.values());
    const participants = agents
      .filter(a => a.status !== "experimenting")
      .sort(() => Math.random() - 0.5)
      .slice(0, 4);

    if (participants.length < 2) return null;

    const debate: Debate = {
      id: `debate-${nanoid(8)}`,
      topic,
      symbol,
      initiatorId: participants[0].id,
      participants: participants.map(p => p.id),
      messages: [],
      status: "active",
      startedAt: Date.now()
    };

    this.debates.set(debate.id, debate);

    participants.forEach(p => {
      p.status = "debating";
    });

    this.addThought(participants[0].id, "debate",
      `I'm calling a village debate on: "${topic}". @${participants.slice(1).map(p => p.name).join(", @")} - what are your thoughts?`,
      { debateId: debate.id, topic },
      undefined,
      participants.slice(1).map(p => p.id)
    );

    this.runDebate(debate);

    return debate;
  }

  private async runDebate(debate: Debate) {
    const participants = debate.participants.map(id => this.agents.get(id)!).filter(Boolean);
    
    for (let round = 0; round < 3; round++) {
      for (const agent of participants) {
        if (debate.status !== "active") break;

        await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));

        try {
          const previousMessages = debate.messages.slice(-4).map(m => 
            `${m.agentName}: "${m.content}"`
          ).join("\n");

          const response = await anthropic.messages.create({
            model: "claude-sonnet-4-20250514",
            max_tokens: 150,
            messages: [{
              role: "user",
              content: `You are ${agent.name}, a ${agent.role} trader (${agent.personality} personality).
Topic: "${debate.topic}"${debate.symbol ? ` regarding ${debate.symbol}` : ""}

Previous discussion:
${previousMessages || "No messages yet - you're starting."}

Share your perspective in 1-2 sentences. Be direct and confident. You can agree, disagree, or add new insight.`
            }]
          });

          const messageText = response.content[0].type === "text" ? response.content[0].text : "";
          const isBullish = messageText.toLowerCase().includes("bull") || messageText.toLowerCase().includes("long") || messageText.toLowerCase().includes("buy");
          const isBearish = messageText.toLowerCase().includes("bear") || messageText.toLowerCase().includes("short") || messageText.toLowerCase().includes("sell");
          const isAgreeing = messageText.toLowerCase().includes("agree") || messageText.toLowerCase().includes("right");

          const stance = isAgreeing ? "agree" : 
                        isBullish ? "bullish" : 
                        isBearish ? "bearish" : "neutral";

          const debateMessage: DebateMessage = {
            agentId: agent.id,
            agentName: agent.name,
            stance,
            content: messageText,
            confidence: 0.6 + Math.random() * 0.35,
            timestamp: Date.now()
          };

          debate.messages.push(debateMessage);

          this.addThought(agent.id, "debate", messageText, 
            { debateId: debate.id, stance, round },
            undefined,
            participants.filter(p => p.id !== agent.id).map(p => p.id)
          );

        } catch (error) {
          console.error("[TradingVillage] Debate message failed:", error);
        }
      }
    }

    await this.resolveDebate(debate);
  }

  private async resolveDebate(debate: Debate) {
    const stances = debate.messages.reduce((acc, m) => {
      acc[m.stance] = (acc[m.stance] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const dominantStance = Object.entries(stances).sort((a, b) => b[1] - a[1])[0];
    
    debate.status = dominantStance && dominantStance[1] >= debate.messages.length / 2 ? "resolved" : "stalemate";
    debate.resolution = dominantStance ? `Consensus reached: ${dominantStance[0]}` : "No clear consensus";
    debate.endedAt = Date.now();

    const participants = debate.participants.map(id => this.agents.get(id)!).filter(Boolean);
    participants.forEach(p => {
      p.status = "hunting";
      p.memory.debateHistory.push({
        topic: debate.topic,
        stance: debate.messages.find(m => m.agentId === p.id)?.stance || "neutral",
        outcome: debate.status === "resolved" ? 
          (debate.messages.find(m => m.agentId === p.id)?.stance === dominantStance?.[0] ? "won" : "lost") : 
          "consensus",
        timestamp: Date.now()
      });
    });

    const winner = participants.find(p => 
      debate.messages.filter(m => m.agentId === p.id && m.stance === dominantStance?.[0]).length > 0
    );

    if (winner) {
      winner.creditScore += 15;
      winner.experience += 10;

      this.addThought(winner.id, "learning",
        `Debate concluded. ${debate.resolution}. My analysis was validated by the village.`,
        { debateId: debate.id, resolution: debate.resolution }
      );
    }

    this.emit("debateResolved", debate);
  }

  async shareKnowledge(agentId: string, type: "pattern" | "strategy" | "warning" | "opportunity", content: string) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    const knowledge: SharedKnowledge = {
      id: `knowledge-${nanoid(8)}`,
      contributorId: agentId,
      contributorName: agent.name,
      type,
      content,
      confidence: 0.7 + Math.random() * 0.25,
      validations: [],
      adoptions: [],
      timestamp: Date.now()
    };

    this.sharedKnowledge.push(knowledge);
    if (this.sharedKnowledge.length > 100) {
      this.sharedKnowledge = this.sharedKnowledge.slice(-80);
    }

    this.addThought(agentId, "insight_share",
      `Sharing insight with the village: ${content}`,
      { knowledgeId: knowledge.id, type }
    );

    agent.creditScore += 5;

    this.triggerKnowledgeReactions(knowledge);

    return knowledge;
  }

  private async triggerKnowledgeReactions(knowledge: SharedKnowledge) {
    const otherAgents = Array.from(this.agents.values())
      .filter(a => a.id !== knowledge.contributorId)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);

    for (const agent of otherAgents) {
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

      const relationship = agent.relationships[knowledge.contributorId];
      const trustBias = relationship ? relationship.trust / 100 : 0.5;
      const agrees = Math.random() < (0.4 + trustBias * 0.4);

      knowledge.validations.push({ agentId: agent.id, agrees });

      if (agrees) {
        knowledge.adoptions.push(agent.id);
        agent.memory.sharedInsights.push({
          from: knowledge.contributorName,
          insight: knowledge.content,
          adopted: true
        });

        this.addThought(agent.id, "agreement",
          `@${knowledge.contributorName}'s insight resonates with my analysis. Incorporating into my strategy.`,
          { knowledgeId: knowledge.id },
          undefined,
          [knowledge.contributorId]
        );

        if (relationship) {
          relationship.trust = Math.min(100, relationship.trust + 3);
          relationship.agreements++;
        }
      } else {
        this.addThought(agent.id, "challenge",
          `Interesting take from @${knowledge.contributorName}, but my ${agent.specialties[0]} analysis suggests otherwise.`,
          { knowledgeId: knowledge.id },
          undefined,
          [knowledge.contributorId]
        );

        if (relationship) {
          relationship.disagreements++;
        }
      }
    }

    const validationRate = knowledge.validations.filter(v => v.agrees).length / knowledge.validations.length;
    const contributor = this.agents.get(knowledge.contributorId);
    if (contributor) {
      if (validationRate > 0.6) {
        contributor.creditScore += 10;
        contributor.memory.successfulStrategies.push(knowledge.content);
      } else if (validationRate < 0.3) {
        contributor.creditScore = Math.max(100, contributor.creditScore - 5);
      }
    }
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
            `Spotted ${symbol} ${direction} but @${claimer.name} beat me to it. Need to be faster.`,
            { symbol, direction, claimedBy: claimer.name },
            undefined,
            [existingClaim.claimedBy]
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
        `CLAIMED: ${symbol} ${direction.toUpperCase()} at ${(confidence * 100).toFixed(0)}% confidence. First to spot this!`,
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

      agent.memory.successfulStrategies.push(`${symbol}: ${reason}`);

      this.addThought(agentId, "learning",
        `WIN on ${symbol}: +${pnl.toFixed(2)}%. My ${agent.specialties[0]} working. Sharing this pattern with the village.`,
        { symbol, pnl, streak: agent.currentStreak.count }
      );

      this.shareKnowledge(agentId, "pattern", `${symbol} success pattern: ${reason}`);

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

      agent.memory.failedStrategies.push(`${symbol}: ${reason}`);

      const mentor = this.findMentor(agent);
      if (mentor) {
        this.addThought(agentId, "learning",
          `LOSS on ${symbol}: ${pnl.toFixed(2)}%. @${mentor.name}, what would you have done differently?`,
          { symbol, pnl, reason },
          undefined,
          [mentor.id]
        );
      }

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

  private findMentor(agent: VillageAgent): VillageAgent | null {
    const potentialMentors = Array.from(this.agents.values())
      .filter(a => a.id !== agent.id && a.role === "veteran" && a.winRate > agent.winRate)
      .sort((a, b) => b.creditScore - a.creditScore);

    return potentialMentors[0] || null;
  }

  private async triggerEvolution(agent: VillageAgent, trigger: string) {
    agent.generation++;
    
    const topPerformers = Array.from(this.agents.values())
      .filter(a => a.id !== agent.id && a.winRate > 0.5)
      .sort((a, b) => b.creditScore - a.creditScore)
      .slice(0, 2);

    const learnFrom = topPerformers.map(p => 
      `${p.name} (${p.role}): ${p.memory.successfulStrategies.slice(-2).join(", ")}`
    ).join("\n");

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [{
          role: "user",
          content: `You are ${agent.name}, a ${agent.role} AI trading agent evolving to generation ${agent.generation}.
          
Your recent performance:
- Win rate: ${(agent.winRate * 100).toFixed(1)}%
- Total P&L: ${agent.totalPnl.toFixed(2)}%
- Current streak: ${agent.currentStreak.count} ${agent.currentStreak.type}s
- Failed strategies: ${agent.memory.failedStrategies.slice(-3).join("; ")}

Top performers to learn from:
${learnFrom || "No mentors available yet"}

Evolution trigger: ${trigger}

Describe your evolution in 2-3 sentences:
1. What you learned from your mistakes
2. What you're adopting from top performers
3. Your new strategy focus`
        }]
      });

      const evolution = response.content[0].type === "text" ? response.content[0].text : "";
      
      this.addThought(agent.id, "learning",
        `EVOLUTION to Gen ${agent.generation}: ${evolution}`,
        { generation: agent.generation, trigger, evolution }
      );

      if (topPerformers[0]) {
        agent.memory.mentors.push(topPerformers[0].name);
        topPerformers[0].memory.students.push(agent.name);
        
        const randomStrategy = topPerformers[0].memory.successfulStrategies[
          Math.floor(Math.random() * topPerformers[0].memory.successfulStrategies.length)
        ];
        if (randomStrategy) {
          agent.strategies.push(`learned_from_${topPerformers[0].name}: ${randomStrategy}`);
        }
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
      hypothesis: `Testing alternative approach for ${symbol} after ${failureReason}`,
      strategy: `experimental_${agent.personality}`,
      symbol,
      startedAt: Date.now(),
      status: "running"
    };

    agent.activeExperiments.push(experiment);
    this.experiments.set(experiment.id, experiment);
    agent.status = "experimenting";

    this.addThought(agent.id, "experiment",
      `Starting experiment: ${experiment.hypothesis}`,
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
        ? `${experiment.strategy} validated for ${experiment.symbol}` 
        : `${experiment.strategy} needs refinement`
    };

    agent.activeExperiments = agent.activeExperiments.filter(e => e.id !== experimentId);
    agent.status = "hunting";

    if (success) {
      agent.creditScore += 25;
      agent.strategies.push(`${experiment.strategy}_validated`);

      this.shareKnowledge(agent.id, "strategy", 
        `Experiment success: ${experiment.results.learnings}`
      );
    } else {
      agent.experience += 15;
    }

    this.addThought(agent.id, "experiment",
      `Experiment ${success ? "SUCCESS" : "FAILED"}: ${experiment.results.learnings}`,
      { experimentId, success, pnl: pnl.toFixed(2) }
    );

    const competition: CompetitionEvent = {
      id: `comp-${nanoid(8)}`,
      type: "experiment_result",
      agents: [agent.id],
      description: `${agent.name}'s experiment ${success ? "succeeded" : "failed"}`,
      creditChange: { [agent.id]: success ? 25 : 0 },
      timestamp: Date.now()
    };
    this.competitions.push(competition);
    this.emit("experimentResult", { agent, experiment, competition });
  }

  private startBackgroundProcesses() {
    setInterval(() => this.runHuntingCycle(), 60000);
    setInterval(() => this.runDebateCycle(), 90000);
    setInterval(() => this.runKnowledgeSharingCycle(), 120000);
    setInterval(() => this.generateMarketInsights(), 45000);
  }

  private async runHuntingCycle() {
    const hunters = Array.from(this.agents.values()).filter(a => 
      a.role === "hunter" || a.role === "scout"
    );

    for (const hunter of hunters) {
      if (Math.random() > 0.6 || hunter.status !== "hunting") continue;

      const symbols = ["BTC", "ETH", "SOL", "AVAX", "LINK", "ARB", "OP", "SUI"];
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];

      this.addThought(hunter.id, "observation",
        `Scanning ${symbol}... RSI: ${(30 + Math.random() * 40).toFixed(1)}, Volume: ${Math.random() > 0.5 ? "above" : "below"} average`,
        { symbol, scanning: true }
      );

      await new Promise(r => setTimeout(r, 2000));

      if (Math.random() > 0.7) {
        const direction = Math.random() > 0.5 ? "long" : "short";
        const confidence = 0.6 + Math.random() * 0.35;

        const analysts = Array.from(this.agents.values()).filter(a => a.role === "analyst");
        const analyst = analysts[Math.floor(Math.random() * analysts.length)];

        if (analyst) {
          this.addThought(hunter.id, "analysis",
            `@${analyst.name}, seeing ${direction} setup on ${symbol}. Confidence: ${(confidence * 100).toFixed(0)}%. Your take?`,
            { symbol, direction, confidence },
            undefined,
            [analyst.id]
          );
        }

        await this.claimSignal(hunter.id, symbol, direction, confidence);
      }
    }
  }

  private async runDebateCycle() {
    if (Math.random() > 0.5) return;

    const topics = [
      "Is BTC about to break out or break down?",
      "Which L2 has the best growth potential?",
      "Should we increase position sizes given current volatility?",
      "Is this rally sustainable or a bull trap?",
      "Which sector will outperform next week?"
    ];

    const topic = topics[Math.floor(Math.random() * topics.length)];
    await this.initiateDebate(topic);
  }

  private async runKnowledgeSharingCycle() {
    const topAgent = Array.from(this.agents.values())
      .filter(a => a.status === "hunting")
      .sort((a, b) => b.creditScore - a.creditScore)[0];

    if (topAgent && Math.random() > 0.6) {
      const insights = [
        `${topAgent.specialties[0]} is showing strong signals across the board`,
        `Volume patterns suggest institutional accumulation`,
        `Correlation between majors is breaking down - alpha opportunity`,
        `Funding rates indicate overleveraged longs`,
        `On-chain metrics point to distribution phase`
      ];

      await this.shareKnowledge(topAgent.id, "pattern", 
        insights[Math.floor(Math.random() * insights.length)]
      );
    }
  }

  private async generateMarketInsights() {
    const agents = Array.from(this.agents.values());
    const agent = agents[Math.floor(Math.random() * agents.length)];

    if (agent.status !== "hunting") return;

    const insights = {
      hunter: [
        "Breakout forming on hourly - watching for volume confirmation",
        "Multiple tokens at key resistance - preparing entries",
        "Momentum divergence detected - high probability setup incoming"
      ],
      analyst: [
        "Technical confluence on 4H chart - all signals aligned",
        "Pattern recognition: ascending triangle completion imminent",
        "Indicator divergence suggests reversal within 24h"
      ],
      strategist: [
        "Adjusting position sizes based on current volatility regime",
        "Risk-reward on current setups justifies 2x normal allocation",
        "Correlation analysis suggests hedging BTC with ETH"
      ],
      sentinel: [
        "Unusual whale activity detected - monitoring closely",
        "Exchange outflow spike - accumulation signal",
        "Volatility cluster forming - expect big move"
      ],
      scout: [
        "New narrative emerging in AI tokens - early signal",
        "Discovered undervalued project - due diligence in progress",
        "Social sentiment shift detected - possible catalyst"
      ],
      veteran: [
        "Current setup reminds me of Q4 2020 - bullish continuation",
        "Experience says this consolidation precedes explosive move",
        "Seen this pattern before - patience will be rewarded"
      ]
    };

    const roleInsights = insights[agent.role] || insights.hunter;
    const insight = roleInsights[Math.floor(Math.random() * roleInsights.length)];

    this.addThought(agent.id, "observation", insight);
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

  getDebates(limit = 10): Debate[] {
    return Array.from(this.debates.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  getSharedKnowledge(limit = 20): SharedKnowledge[] {
    return [...this.sharedKnowledge].reverse().slice(0, limit);
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
    const activeDebates = Array.from(this.debates.values()).filter(d => d.status === "active").length;
    
    return {
      totalAgents: agents.length,
      totalCredits: agents.reduce((sum, a) => sum + a.creditScore, 0),
      totalTrades: agents.reduce((sum, a) => sum + a.wins + a.losses, 0),
      avgWinRate: agents.reduce((sum, a) => sum + a.winRate, 0) / agents.length,
      totalPnl: agents.reduce((sum, a) => sum + a.totalPnl, 0),
      activeExperiments: agents.reduce((sum, a) => sum + a.activeExperiments.length, 0),
      activeDebates,
      totalEvolutions: agents.reduce((sum, a) => sum + (a.generation - 1), 0),
      knowledgeShared: this.sharedKnowledge.length,
      topPerformer: agents.sort((a, b) => b.totalPnl - a.totalPnl)[0]?.name || "N/A",
      mostCredits: agents.sort((a, b) => b.creditScore - a.creditScore)[0]?.name || "N/A",
      recentThoughts: this.thoughts.length
    };
  }
}

export const tradingVillage = new TradingVillage();
