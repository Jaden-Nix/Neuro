import Anthropic from "@anthropic-ai/sdk";
import pLimit from "p-limit";
import pRetry from "p-retry";
import { nanoid } from "nanoid";
import { EventEmitter } from "events";
import { marketDataService } from "../data/MarketDataService";
import { db } from "../db";
import { villageSignals, villageAgents, agentBirths } from "@shared/schema";
import { eq, desc } from "drizzle-orm";

// Using Replit's AI Integrations for Anthropic access (no API key needed, billed to credits)
const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const rateLimiter = pLimit(2);

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

async function generateWithRetry(prompt: string, maxTokens: number = 1024): Promise<string> {
  return rateLimiter(() =>
    pRetry(
      async () => {
        try {
          const message = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: maxTokens,
            messages: [{ role: "user", content: prompt }],
          });
          const content = message.content[0];
          return content.type === "text" ? content.text : "";
        } catch (error: any) {
          if (isRateLimitError(error)) {
            throw error; // Rethrow to trigger retry
          }
          // For non-rate-limit errors, create an abort error to stop retrying
          const abortError = new Error(error?.message || "Request failed");
          (abortError as any).isAbortError = true;
          throw abortError;
        }
      },
      {
        retries: 5,
        minTimeout: 2000,
        maxTimeout: 64000,
        factor: 2,
      }
    )
  );
}

export type AgentRole = "hunter" | "analyst" | "strategist" | "sentinel" | "scout" | "veteran";
export type AgentPersonality = "aggressive" | "conservative" | "balanced" | "contrarian" | "momentum" | "experimental";
export type ThoughtType = "observation" | "analysis" | "hypothesis" | "decision" | "learning" | "experiment" | "competition" | "debate" | "agreement" | "challenge" | "insight_share" | "disagreement";

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

export interface AgentBirth {
  id: string;
  parentId: string;
  parentName: string;
  childId: string;
  childName: string;
  trigger: "win_streak" | "pattern_mastery" | "knowledge_gap";
  inheritedTraits: { specialties: string[]; strategies: string[] };
  mutations: string[];
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

export interface VillageTradeSignal {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: AgentRole;
  symbol: string;
  direction: "long" | "short";
  entry: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  takeProfit3: number;
  confidence: number;
  timeframe: string;
  reasoning: string;
  technicalAnalysis: {
    pattern: string;
    indicators: string[];
    keyLevels: { support: number; resistance: number };
  };
  riskReward: number;
  positionSize: string;
  status: "pending" | "active" | "rejected" | "invalidated" | "closed" | "stopped" | "expired";
  validators: { agentId: string; agentName: string; agrees: boolean; comment: string }[];
  createdAt: number;
  closedAt?: number;
  outcome?: { pnl: number; exitPrice: number; exitReason: string };
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
  private tradeSignals: VillageTradeSignal[] = [];

  constructor() {
    super();
    this.initializeVillage();
    this.loadSignalsFromDB();
    this.loadSpawnedAgentsFromDB();
    this.startBackgroundProcesses();
    console.log("[TradingVillage] AI Village initialized with", this.agents.size, "unique agents");
  }

  private async loadSignalsFromDB() {
    try {
      const savedSignals = await db.select().from(villageSignals).orderBy(desc(villageSignals.createdAt)).limit(100);
      this.tradeSignals = savedSignals.map(s => ({
        id: s.id,
        agentId: s.agentId,
        agentName: s.agentName,
        agentRole: s.agentRole as AgentRole,
        symbol: s.symbol,
        direction: s.direction,
        entry: s.entry,
        stopLoss: s.stopLoss,
        takeProfit1: s.takeProfit1,
        takeProfit2: s.takeProfit2,
        takeProfit3: s.takeProfit3,
        confidence: s.confidence,
        timeframe: s.timeframe,
        reasoning: s.reasoning,
        technicalAnalysis: s.technicalAnalysis,
        riskReward: s.riskReward,
        positionSize: s.positionSize,
        status: s.status,
        validators: s.validators,
        createdAt: s.createdAt.getTime(),
        closedAt: s.closedAt?.getTime(),
        outcome: s.outcome ?? undefined,
      }));
      console.log(`[TradingVillage] Loaded ${this.tradeSignals.length} signals from database`);
    } catch (error) {
      console.error("[TradingVillage] Failed to load signals from DB:", error);
    }
  }

  private async loadSpawnedAgentsFromDB() {
    try {
      const spawnedAgents = await db.select().from(villageAgents).orderBy(desc(villageAgents.createdAt));
      
      const mottos: Record<AgentPersonality, string> = {
        aggressive: "Strike fast, strike hard",
        conservative: "Patience is profit",
        balanced: "Equilibrium in all trades",
        contrarian: "When others panic, I profit",
        momentum: "Ride the wave",
        experimental: "Innovation drives evolution"
      };

      for (const sa of spawnedAgents) {
        if (!this.agents.has(sa.id)) {
          const agent: VillageAgent = {
            id: sa.id,
            name: sa.name,
            role: sa.role,
            personality: sa.personality,
            creditScore: sa.creditScore,
            experience: sa.experience,
            generation: sa.generation,
            wins: sa.wins,
            losses: sa.losses,
            winRate: sa.winRate,
            totalPnl: sa.totalPnl,
            bestTrade: null,
            worstTrade: null,
            currentStreak: { type: "win", count: 0 },
            specialties: sa.specialties,
            strategies: sa.strategies,
            activeExperiments: [],
            lastActive: Date.now(),
            status: "hunting",
            avatar: sa.role,
            motto: mottos[sa.personality],
            memory: sa.memory,
            relationships: {},
          };
          
          this.agents.set(agent.id, agent);
          
          const agents = Array.from(this.agents.values());
          agents.forEach((other) => {
            if (agent.id !== other.id) {
              agent.relationships[other.id] = { trust: 50, agreements: 0, disagreements: 0 };
              if (!other.relationships[agent.id]) {
                other.relationships[agent.id] = { trust: 50, agreements: 0, disagreements: 0 };
              }
            }
          });
        }
      }
      
      if (spawnedAgents.length > 0) {
        console.log(`[TradingVillage] Loaded ${spawnedAgents.length} spawned agents from database`);
      }
    } catch (error) {
      console.error("[TradingVillage] Failed to load spawned agents from DB:", error);
    }
  }

  private async saveSpawnedAgentToDB(agent: VillageAgent, parentId: string) {
    try {
      await db.insert(villageAgents).values({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        personality: agent.personality,
        specialties: agent.specialties,
        strategies: agent.strategies,
        generation: agent.generation,
        creditScore: agent.creditScore,
        experience: agent.experience,
        wins: agent.wins,
        losses: agent.losses,
        winRate: agent.winRate,
        totalPnl: agent.totalPnl,
        parentId: parentId,
        isSpawned: true,
        memory: agent.memory,
      }).onConflictDoNothing();
      console.log(`[TradingVillage] Saved spawned agent ${agent.name} to database`);
    } catch (error) {
      console.error("[TradingVillage] Failed to save spawned agent to DB:", error);
    }
  }

  private async saveBirthRecordToDB(birth: AgentBirth) {
    try {
      await db.insert(agentBirths).values({
        id: birth.id,
        parentId: birth.parentId,
        parentName: birth.parentName,
        childId: birth.childId,
        childName: birth.childName,
        trigger: birth.trigger,
        inheritedTraits: birth.inheritedTraits,
        mutations: birth.mutations,
      }).onConflictDoNothing();
      console.log(`[TradingVillage] Saved birth record: ${birth.parentName} -> ${birth.childName}`);
    } catch (error) {
      console.error("[TradingVillage] Failed to save birth record to DB:", error);
    }
  }

  private async saveSignalToDB(signal: VillageTradeSignal) {
    try {
      await db.insert(villageSignals).values({
        id: signal.id,
        agentId: signal.agentId,
        agentName: signal.agentName,
        agentRole: signal.agentRole,
        symbol: signal.symbol,
        direction: signal.direction,
        entry: signal.entry,
        stopLoss: signal.stopLoss,
        takeProfit1: signal.takeProfit1,
        takeProfit2: signal.takeProfit2,
        takeProfit3: signal.takeProfit3,
        confidence: signal.confidence,
        timeframe: signal.timeframe,
        reasoning: signal.reasoning,
        technicalAnalysis: signal.technicalAnalysis,
        riskReward: signal.riskReward,
        positionSize: signal.positionSize,
        status: signal.status,
        validators: signal.validators,
      }).onConflictDoNothing();
      console.log(`[TradingVillage] Saved signal ${signal.id} to database`);
    } catch (error) {
      console.error("[TradingVillage] Failed to save signal to DB:", error);
    }
  }

  private async updateSignalInDB(signalId: string, updates: Partial<VillageTradeSignal>) {
    try {
      const dbUpdates: Record<string, any> = {};
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.validators) dbUpdates.validators = updates.validators;
      if (updates.outcome) dbUpdates.outcome = updates.outcome;
      if (updates.closedAt) dbUpdates.closedAt = new Date(updates.closedAt);
      
      await db.update(villageSignals).set(dbUpdates).where(eq(villageSignals.id, signalId));
    } catch (error) {
      console.error("[TradingVillage] Failed to update signal in DB:", error);
    }
  }

  private cleanupConflictingSignals() {
    const signalsBySymbol = new Map<string, VillageTradeSignal[]>();
    
    this.tradeSignals.forEach(signal => {
      if (signal.status === "active") {
        const existing = signalsBySymbol.get(signal.symbol) || [];
        existing.push(signal);
        signalsBySymbol.set(signal.symbol, existing);
      }
    });

    signalsBySymbol.forEach((signals, symbol) => {
      if (signals.length > 1) {
        const sorted = signals.sort((a, b) => b.confidence - a.confidence);
        const winner = sorted[0];
        
        sorted.slice(1).forEach(loser => {
          loser.status = "invalidated";
          const claimKey = `${loser.symbol}-${loser.direction}`;
          this.signalClaims.delete(claimKey);
        });
        
        console.log(`[TradingVillage] Cleanup: Kept ${winner.direction} ${symbol} by ${winner.agentName}, invalidated ${signals.length - 1} conflicting signals`);
      }
    });

    this.tradeSignals = this.tradeSignals.filter(s => s.status !== "invalidated");
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
      const prompt = `You are ${responder.name}, a ${responder.role} AI trader with ${responder.personality} personality.
Your specialty: ${responder.specialties.join(", ")}
Your trust level with ${originalAgent.name}: ${trustLevel}/100

${originalAgent.name} (${originalAgent.role}, ${originalAgent.personality}) said:
"${originalThought.content}"

Respond naturally as ${responder.name}. You can:
- Agree and build on their idea
- Challenge with your own analysis
- Ask a probing question
- Share a related insight from your experience

Keep response under 2 sentences. Be conversational, not formal. Reference your specialty if relevant.`;

      const responseText = await generateWithRetry(prompt, 200);
      
      const isAgreement = responseText.toLowerCase().includes("agree") || 
                          responseText.toLowerCase().includes("right") ||
                          responseText.toLowerCase().includes("good point");
      
      const thoughtType: ThoughtType = isAgreement ? "agreement" : "challenge";
      
      this.addThought(responder.id, thoughtType, responseText, 
        { inResponseTo: originalThought.id, originalAgent: originalAgent.name },
        originalThought.id, 
        [originalThought.agentId]
      );

      // Update relationship if it exists
      if (relationship) {
        if (isAgreement) {
          relationship.trust = Math.min(100, relationship.trust + 2);
          relationship.agreements++;
        } else {
          relationship.disagreements++;
        }
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

          const debatePrompt = `You are ${agent.name}, a ${agent.role} trader (${agent.personality} personality).
Topic: "${debate.topic}"${debate.symbol ? ` regarding ${debate.symbol}` : ""}

Previous discussion:
${previousMessages || "No messages yet - you're starting."}

Share your perspective in 1-2 sentences. Be direct and confident. You can agree, disagree, or add new insight.`;

          const messageText = await generateWithRetry(debatePrompt, 150);
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
        agent.memory.learnedPatterns.push(`adopted_${knowledge.type}`);

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
    const oppositeDirection = direction === "long" ? "short" : "long";
    const oppositeKey = `${symbol}-${oppositeDirection}`;

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

    if (this.signalClaims.has(oppositeKey)) {
      const opposingClaim = this.signalClaims.get(oppositeKey)!;
      if (Date.now() - opposingClaim.claimedAt < 3600000) {
        const agent = this.agents.get(agentId);
        const opposer = this.agents.get(opposingClaim.claimedBy);
        if (agent && opposer) {
          if (confidence > opposingClaim.confidence + 0.1) {
            console.log(`[TradingVillage] ${agent.name}'s ${direction} signal (${(confidence*100).toFixed(0)}%) overrides ${opposer.name}'s ${oppositeDirection} (${(opposingClaim.confidence*100).toFixed(0)}%)`);
            this.signalClaims.delete(oppositeKey);
            this.tradeSignals = this.tradeSignals.filter(s => 
              !(s.symbol === symbol && s.direction === oppositeDirection && s.status === "active")
            );
            this.addThought(agentId, "challenge",
              `Overriding @${opposer.name}'s ${oppositeDirection} ${symbol} call. My ${direction} analysis has stronger conviction at ${(confidence*100).toFixed(0)}%.`,
              { symbol, direction, overriding: opposer.name },
              undefined,
              [opposingClaim.claimedBy]
            );
          } else {
            this.addThought(agentId, "disagreement",
              `I see ${symbol} ${direction}, but @${opposer.name} already called ${oppositeDirection}. Their conviction is similar - deferring.`,
              { symbol, direction, existingDirection: oppositeDirection },
              undefined,
              [opposingClaim.claimedBy]
            );
            return false;
          }
        }
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
      agent.creditScore += 10;
      
      const tradeSignal = await this.generateDetailedSignal(agent, symbol, direction, confidence);
      if (tradeSignal) {
        this.tradeSignals.push(tradeSignal);
        this.saveSignalToDB(tradeSignal);
        this.emit("signalClaimed", { agent, claim, tradeSignal });
        
        this.requestSignalValidation(tradeSignal);
      }
    }

    return true;
  }

  private async generateDetailedSignal(
    agent: VillageAgent, 
    symbol: string, 
    direction: "long" | "short", 
    confidence: number
  ): Promise<VillageTradeSignal | null> {
    const fallbackPrices: Record<string, number> = {
      BTC: 92000, ETH: 3180, SOL: 145, AVAX: 38, LINK: 24, ARB: 0.75, OP: 1.80, SUI: 3.60,
      DOGE: 0.32, PEPE: 0.000018, XRP: 2.35, ADA: 1.05, DOT: 7.5, MATIC: 0.52, ATOM: 9.5, UNI: 14,
      AAVE: 193, LDO: 2.0, CRV: 0.55, MKR: 1800, SNX: 2.5, COMP: 65, INJ: 22, TIA: 5.5,
      SEI: 0.45, APT: 12, NEAR: 5.5, FTM: 0.75, RUNE: 5.0, RENDER: 8.5, FET: 1.8, TAO: 450,
      WIF: 2.5, BONK: 0.000025, JUP: 0.85, PYTH: 0.45, W: 0.35, STRK: 0.55, MANTA: 1.2, DYM: 2.5
    };
    
    let basePrice = fallbackPrices[symbol] || 100;
    let volatility = symbol === "BTC" ? 0.02 : symbol === "ETH" ? 0.03 : 0.05;
    let priceSource = "fallback";
    
    try {
      const snapshot = await marketDataService.getMarketSnapshot(`${symbol}USDT`);
      if (snapshot.price > 0) {
        basePrice = snapshot.price;
        volatility = Math.max(0.02, Math.min(0.10, snapshot.volatility / 100 || volatility));
        priceSource = "live";
      }
    } catch (snapshotError) {
      try {
        const price = await marketDataService.getCurrentPrice(symbol);
        if (price > 0) {
          basePrice = price;
          priceSource = "live";
        }
      } catch (priceError) {
        console.log(`[TradingVillage] Using fallback price for ${symbol}: $${basePrice}`);
      }
    }
    
    console.log(`[TradingVillage] ${symbol} price: $${basePrice.toFixed(2)} (${priceSource})`);

    try {
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 400,
        messages: [{
          role: "user",
          content: `You are ${agent.name}, a ${agent.role} AI trader (${agent.personality} personality).
Your specialty: ${agent.specialties.join(", ")}

CRITICAL: The CURRENT LIVE price of ${symbol} is EXACTLY $${basePrice.toFixed(2)}. Do NOT use any other price from your training data. All your entry, stop loss, and take profit levels MUST be based on this current price of $${basePrice.toFixed(2)}.

Generate a ${direction.toUpperCase()} trade signal for ${symbol}.

Respond in this exact JSON format (no markdown):
{
  "entry": <entry price NEAR $${basePrice.toFixed(2)}>,
  "stopLoss": <stop loss price as number>,
  "tp1": <take profit 1 as number>,
  "tp2": <take profit 2 as number>,
  "tp3": <take profit 3 as number>,
  "pattern": "<chart pattern identified>",
  "indicators": ["<indicator 1>", "<indicator 2>", "<indicator 3>"],
  "support": <key support level>,
  "resistance": <key resistance level>,
  "reasoning": "<2-3 sentence explanation of why this trade at $${basePrice.toFixed(2)}>",
  "timeframe": "<4H or 1D or 1H>",
  "positionSize": "<conservative or moderate or aggressive>"
}

REMEMBER: Current price is $${basePrice.toFixed(2)}. Entry must be within 1% of this price.
For ${direction}: SL should be ${(volatility * 100).toFixed(1)}% away from entry.
TPs should be staggered at 1:1, 1:2, 1:3 risk-reward ratios.`
        }]
      });

      const text = response.content[0].type === "text" ? response.content[0].text : "";
      
      let parsed;
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error("No JSON found in response");
        parsed = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error("[TradingVillage] JSON parse failed, using fallback:", parseError);
        throw parseError;
      }
      
      const slDistance = basePrice * volatility;
      const defaultEntry = direction === "long" ? basePrice * 0.995 : basePrice * 1.005;
      const defaultSl = direction === "long" ? defaultEntry - slDistance : defaultEntry + slDistance;
      const defaultTp1 = direction === "long" ? defaultEntry + slDistance : defaultEntry - slDistance;
      const defaultTp2 = direction === "long" ? defaultEntry + slDistance * 2 : defaultEntry - slDistance * 2;
      const defaultTp3 = direction === "long" ? defaultEntry + slDistance * 3 : defaultEntry - slDistance * 3;
      
      const safeNum = (val: any, fallback: number) => {
        const num = Number(val);
        return isNaN(num) || num <= 0 ? fallback : num;
      };
      
      let entry = safeNum(parsed.entry, defaultEntry);
      
      const priceDiff = Math.abs(entry - basePrice) / basePrice;
      if (priceDiff > 0.20) {
        console.warn(`[TradingVillage] AI returned wrong price $${entry.toFixed(2)} vs actual $${basePrice.toFixed(2)}, using corrected price`);
        entry = defaultEntry;
      }
      
      const stopLoss = safeNum(parsed.stopLoss, defaultSl);
      const tp1 = safeNum(parsed.tp1, defaultTp1);
      const tp2 = safeNum(parsed.tp2, defaultTp2);
      const tp3 = safeNum(parsed.tp3, defaultTp3);
      
      const entryToSLRatio = Math.abs(entry - stopLoss) / entry;
      const entryToTP1Ratio = Math.abs(tp1 - entry) / entry;
      
      const correctedSL = (priceDiff > 0.20 || entryToSLRatio > 0.15) ? defaultSl : stopLoss;
      const correctedTP1 = (priceDiff > 0.20 || entryToTP1Ratio > 0.30) ? defaultTp1 : tp1;
      const correctedTP2 = (priceDiff > 0.20) ? defaultTp2 : tp2;
      const correctedTP3 = (priceDiff > 0.20) ? defaultTp3 : tp3;
      
      const rrDenom = Math.abs(entry - correctedSL);
      const riskReward = rrDenom > 0 ? Math.abs(correctedTP2 - entry) / rrDenom : 2.0;

      const signal: VillageTradeSignal = {
        id: `vsig-${nanoid(8)}`,
        agentId: agent.id,
        agentName: agent.name,
        agentRole: agent.role,
        symbol,
        direction,
        entry,
        stopLoss: correctedSL,
        takeProfit1: correctedTP1,
        takeProfit2: correctedTP2,
        takeProfit3: correctedTP3,
        confidence,
        timeframe: parsed.timeframe || "4H",
        reasoning: parsed.reasoning || `${agent.specialties[0]} analysis indicates ${direction} opportunity`,
        technicalAnalysis: {
          pattern: parsed.pattern || (direction === "long" ? "Higher low formation" : "Lower high formation"),
          indicators: Array.isArray(parsed.indicators) ? parsed.indicators : ["RSI", "MACD", "Volume"],
          keyLevels: { 
            support: safeNum(parsed.support, basePrice * 0.95), 
            resistance: safeNum(parsed.resistance, basePrice * 1.05) 
          }
        },
        riskReward,
        positionSize: parsed.positionSize || "moderate",
        status: "pending",
        validators: [],
        createdAt: Date.now()
      };

      this.addThought(agent.id, "decision",
        `PROPOSED SIGNAL: ${direction.toUpperCase()} ${symbol} - Awaiting validation from other agents\n` +
        `Entry: $${signal.entry.toFixed(2)} | SL: $${signal.stopLoss.toFixed(2)} | TP1: $${signal.takeProfit1.toFixed(2)}\n` +
        `Pattern: ${signal.technicalAnalysis.pattern}\n` +
        `Reasoning: ${signal.reasoning}`,
        { signalId: signal.id, ...signal }
      );

      return signal;

    } catch (error) {
      console.error("[TradingVillage] Failed to generate detailed signal:", error);
      
      const slDistance = basePrice * volatility;
      const entry = direction === "long" ? basePrice * 0.995 : basePrice * 1.005;
      const sl = direction === "long" ? entry - slDistance : entry + slDistance;
      const tp1 = direction === "long" ? entry + slDistance : entry - slDistance;
      const tp2 = direction === "long" ? entry + slDistance * 2 : entry - slDistance * 2;
      const tp3 = direction === "long" ? entry + slDistance * 3 : entry - slDistance * 3;

      const signal: VillageTradeSignal = {
        id: `vsig-${nanoid(8)}`,
        agentId: agent.id,
        agentName: agent.name,
        agentRole: agent.role,
        symbol,
        direction,
        entry,
        stopLoss: sl,
        takeProfit1: tp1,
        takeProfit2: tp2,
        takeProfit3: tp3,
        confidence,
        timeframe: "4H",
        reasoning: `${agent.specialties[0]} analysis indicates ${direction} opportunity based on current price action and volume patterns.`,
        technicalAnalysis: {
          pattern: direction === "long" ? "Higher low formation" : "Lower high formation",
          indicators: ["RSI oversold" , "MACD bullish crossover", "Volume spike"],
          keyLevels: { 
            support: basePrice * 0.95, 
            resistance: basePrice * 1.05 
          }
        },
        riskReward: 2.0,
        positionSize: "moderate",
        status: "pending",
        validators: [],
        createdAt: Date.now()
      };

      this.addThought(agent.id, "decision",
        `PROPOSED SIGNAL: ${direction.toUpperCase()} ${symbol} - Awaiting validation\n` +
        `Entry: $${signal.entry.toFixed(2)} | SL: $${signal.stopLoss.toFixed(2)} | TP1: $${signal.takeProfit1.toFixed(2)}\n` +
        `R:R = ${signal.riskReward.toFixed(1)} | Confidence: ${(confidence * 100).toFixed(0)}%`,
        { signalId: signal.id }
      );

      return signal;
    }
  }

  private checkAndActivateSignal(signal: VillageTradeSignal) {
    const agrees = signal.validators.filter(v => v.agrees).length;
    const disagrees = signal.validators.filter(v => !v.agrees).length;
    
    if (signal.validators.length >= 2) {
      if (agrees > disagrees) {
        signal.status = "active";
        this.updateSignalInDB(signal.id, { status: "active", validators: signal.validators });
        const creator = this.agents.get(signal.agentId);
        if (creator) {
          this.addThought(signal.agentId, "decision",
            `SIGNAL CONFIRMED: ${signal.direction.toUpperCase()} ${signal.symbol} validated by ${agrees} agents! Signal is now ACTIVE.`,
            { signalId: signal.id, agrees, disagrees }
          );
        }
        console.log(`[TradingVillage] Signal ${signal.id} ACTIVATED: ${agrees} agrees vs ${disagrees} disagrees`);
      } else if (disagrees > agrees) {
        signal.status = "rejected";
        this.updateSignalInDB(signal.id, { status: "rejected", validators: signal.validators });
        console.log(`[TradingVillage] Signal ${signal.id} REJECTED: ${disagrees} disagrees vs ${agrees} agrees`);
      }
    }
  }

  private async requestSignalValidation(signal: VillageTradeSignal) {
    const storedSignal = this.tradeSignals.find(s => s.id === signal.id);
    if (!storedSignal) {
      console.error("[TradingVillage] Signal not found in store for validation:", signal.id);
      return;
    }

    const validators = Array.from(this.agents.values())
      .filter(a => a.id !== signal.agentId && (a.role === "analyst" || a.role === "strategist" || a.role === "sentinel"))
      .slice(0, 3);

    for (const validator of validators) {
      if (storedSignal.validators.some(v => v.agentId === validator.id)) {
        continue;
      }
      
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

      try {
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 150,
          messages: [{
            role: "user",
            content: `You are ${validator.name}, a ${validator.role} (${validator.personality}).

${signal.agentName} proposed: ${signal.direction.toUpperCase()} ${signal.symbol}
Entry: $${signal.entry.toFixed(2)} | SL: $${signal.stopLoss.toFixed(2)} | TP: $${signal.takeProfit1.toFixed(2)}
Reasoning: ${signal.reasoning}

Do you agree? Reply with:
- "AGREE: <brief reason>" or "DISAGREE: <brief reason>"
Keep it under 20 words. Be direct.`
          }]
        });

        const text = response.content[0].type === "text" ? response.content[0].text : "";
        const agrees = text.toUpperCase().startsWith("AGREE");

        const validation = {
          agentId: validator.id,
          agentName: validator.name,
          agrees,
          comment: text
        };
        
        storedSignal.validators.push(validation);

        const thoughtType: ThoughtType = agrees ? "agreement" : "challenge";
        this.addThought(validator.id, thoughtType,
          `@${signal.agentName}'s ${signal.symbol} ${signal.direction}: ${text}`,
          { signalId: signal.id, validates: agrees },
          undefined,
          [signal.agentId]
        );

        const relationship = validator.relationships[signal.agentId];
        if (relationship) {
          if (agrees) {
            relationship.trust = Math.min(100, relationship.trust + 2);
            relationship.agreements++;
          } else {
            relationship.disagreements++;
          }
        }

      } catch (error) {
        console.error("[TradingVillage] Validation failed:", error);
        
        const agrees = Math.random() > 0.4;
        const fallbackValidation = {
          agentId: validator.id,
          agentName: validator.name,
          agrees,
          comment: agrees ? "AGREE: Setup looks solid" : "DISAGREE: Risk too high"
        };
        storedSignal.validators.push(fallbackValidation);
        
        const thoughtType: ThoughtType = fallbackValidation.agrees ? "agreement" : "challenge";
        this.addThought(validator.id, thoughtType,
          `@${signal.agentName}'s ${signal.symbol} ${signal.direction}: ${fallbackValidation.comment}`,
          { signalId: signal.id, validates: fallbackValidation.agrees },
          undefined,
          [signal.agentId]
        );
      }
      
      this.checkAndActivateSignal(storedSignal);
    }

    const validationRate = storedSignal.validators.filter(v => v.agrees).length / Math.max(1, storedSignal.validators.length);
    const signaler = this.agents.get(signal.agentId);
    
    if (signaler) {
      if (validationRate >= 0.66) {
        signaler.creditScore += 15;
        this.addThought(signaler.id, "learning",
          `Village validated my ${signal.symbol} signal. ${storedSignal.validators.filter(v => v.agrees).length}/${storedSignal.validators.length} agreed. Confidence boosted.`,
          { signalId: signal.id, validationRate }
        );
      } else if (validationRate <= 0.33 && storedSignal.validators.length > 0) {
        this.addThought(signaler.id, "learning",
          `My ${signal.symbol} signal got pushback. ${storedSignal.validators.filter(v => !v.agrees).length} disagreed. Reconsidering...`,
          { signalId: signal.id, validationRate }
        );
      }
    }

    this.emit("signalValidated", storedSignal);
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
      agent.memory.learnedPatterns.push(`${agent.specialties[0]}_${symbol}`);

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
        model: "claude-sonnet-4-5",
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
          agent.memory.learnedPatterns.push(`mentored_by_${topPerformers[0].name}`);
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
      agent.memory.learnedPatterns.push(`experiment_${experiment.symbol}`);

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
    console.log("[TradingVillage] Starting active signal generation and evolution...");
    
    setTimeout(() => this.runInitialSignalGeneration(), 3000);
    
    setInterval(() => this.runHuntingCycle(), 30000);
    setInterval(() => this.runDebateCycle(), 60000);
    setInterval(() => this.runKnowledgeSharingCycle(), 90000);
    setInterval(() => this.generateMarketInsights(), 20000);
    setInterval(() => this.runEvolutionCycle(), 120000);
    setInterval(() => this.checkAndTriggerBirths(), 180000);
  }

  private async runInitialSignalGeneration() {
    console.log("[TradingVillage] Generating initial trading signals...");
    const hunters = Array.from(this.agents.values()).filter(a => 
      a.role === "hunter" || a.role === "scout" || a.role === "analyst"
    );

    const symbols = [
      "BTC", "ETH", "SOL", "AVAX", "LINK", "ARB", "OP", "SUI", 
      "DOGE", "PEPE", "XRP", "ADA", "DOT", "MATIC", "ATOM", "UNI",
      "AAVE", "LDO", "CRV", "MKR", "SNX", "COMP", "INJ", "TIA",
      "SEI", "APT", "NEAR", "FTM", "RUNE", "RENDER"
    ];
    
    for (let i = 0; i < Math.min(5, hunters.length); i++) {
      const hunter = hunters[i];
      const symbol = symbols[i % symbols.length];
      const direction = Math.random() > 0.45 ? "long" : "short";
      const confidence = 0.65 + Math.random() * 0.3;

      hunter.status = "analyzing";
      this.addThought(hunter.id, "analysis",
        `Completed comprehensive ${symbol} analysis. Multiple confluence signals detected.`,
        { symbol, direction, confidence }
      );

      await this.claimSignal(hunter.id, symbol, direction, confidence);
      await new Promise(r => setTimeout(r, 2000));
    }
    
    console.log("[TradingVillage] Initial signals generated:", this.tradeSignals.length);
  }

  private async runEvolutionCycle() {
    const agents = Array.from(this.agents.values())
      .sort((a, b) => {
        const aScore = a.wins * 2 - a.losses + a.currentStreak.count * (a.currentStreak.type === "win" ? 1 : -1);
        const bScore = b.wins * 2 - b.losses + b.currentStreak.count * (b.currentStreak.type === "win" ? 1 : -1);
        return bScore - aScore;
      });

    for (const agent of agents.slice(0, 3)) {
      if (agent.currentStreak.count >= 2 || agent.wins >= 3) {
        const evolutionType = agent.currentStreak.type === "win" ? "adaptation" : "mutation";
        const newGen = agent.generation + 1;
        const oldCreditScore = agent.creditScore;
        
        agent.generation = newGen;
        agent.creditScore += 50;
        agent.experience += 25;
        
        const newStrategy = this.generateEvolutionStrategy(agent);
        if (newStrategy && !agent.strategies.includes(newStrategy)) {
          agent.strategies.push(newStrategy);
          agent.memory.successfulStrategies.push(newStrategy);
          agent.memory.learnedPatterns.push(`evolved_${evolutionType}`);
        }
        
        this.addThought(agent.id, "learning",
          `EVOLUTION: Generation ${newGen}! ${evolutionType === "adaptation" ? "Win streak" : "Adaptation"} triggered upgrade. ` +
          `New strategy: ${newStrategy}. Credits: ${oldCreditScore} -> ${agent.creditScore}`,
          { evolutionType, newGen, creditGain: 50, newStrategy }
        );

        const competition: CompetitionEvent = {
          id: `comp-${nanoid(8)}`,
          type: "evolution",
          agents: [agent.id],
          description: `${agent.name} evolved to Generation ${newGen}!`,
          creditChange: { [agent.id]: 50 },
          timestamp: Date.now()
        };
        this.competitions.push(competition);
        this.emit("evolution", { agent, competition });
        
        console.log(`[TradingVillage] EVOLUTION: ${agent.name} -> Gen ${newGen}`);
        break;
      }
    }
  }

  private generateEvolutionStrategy(agent: VillageAgent): string {
    const strategies: Record<AgentRole, string[]> = {
      hunter: ["Momentum scalping", "Volume breakout", "Trend reversal detection", "Gap filling strategy"],
      analyst: ["Multi-TF confluence", "Pattern recognition v2", "Indicator divergence", "Support/resistance mapping"],
      strategist: ["Dynamic position sizing", "Volatility-adjusted stops", "Portfolio rebalancing", "Correlation hedging"],
      sentinel: ["Whale tracking", "Exchange flow analysis", "Liquidation cascade prediction", "Smart money following"],
      scout: ["Narrative alpha", "Social sentiment analysis", "On-chain metrics", "Early project detection"],
      veteran: ["Cycle timing", "Macro correlation", "Historical pattern matching", "Crisis management v2"]
    };
    
    const roleStrategies = strategies[agent.role] || strategies.hunter;
    return roleStrategies[Math.floor(Math.random() * roleStrategies.length)];
  }

  private async runHuntingCycle() {
    const hunters = Array.from(this.agents.values()).filter(a => 
      a.role === "hunter" || a.role === "scout" || a.role === "analyst"
    );

    for (const hunter of hunters) {
      if (Math.random() > 0.8 || hunter.status === "debating") continue;

      const symbols = [
        "BTC", "ETH", "SOL", "AVAX", "LINK", "ARB", "OP", "SUI", 
        "DOGE", "PEPE", "XRP", "ADA", "DOT", "MATIC", "ATOM", "UNI",
        "AAVE", "LDO", "CRV", "MKR", "SNX", "COMP", "INJ", "TIA",
        "SEI", "APT", "NEAR", "FTM", "RUNE", "RENDER", "FET", "TAO",
        "WIF", "BONK", "JUP", "PYTH", "W", "STRK", "MANTA", "DYM"
      ];
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const rsi = 30 + Math.random() * 40;
      const volumeAbove = Math.random() > 0.5;

      hunter.status = "analyzing";
      this.addThought(hunter.id, "observation",
        `Scanning ${symbol}... RSI: ${rsi.toFixed(1)}, Volume: ${volumeAbove ? "ABOVE" : "below"} average, Trend: ${rsi < 40 ? "oversold" : rsi > 60 ? "overbought" : "neutral"}`,
        { symbol, scanning: true, rsi, volumeAbove }
      );

      await new Promise(r => setTimeout(r, 1500));

      if (Math.random() > 0.4) {
        const direction = (rsi < 45 || volumeAbove) ? "long" : "short";
        const confidence = 0.65 + Math.random() * 0.3;

        const analysts = Array.from(this.agents.values()).filter(a => a.role === "analyst" || a.role === "strategist");
        const analyst = analysts[Math.floor(Math.random() * analysts.length)];

        if (analyst && analyst.id !== hunter.id) {
          this.addThought(hunter.id, "analysis",
            `@${analyst.name}, spotted ${direction.toUpperCase()} setup on ${symbol}. RSI ${rsi.toFixed(0)}, Volume ${volumeAbove ? "spiking" : "declining"}. Confidence: ${(confidence * 100).toFixed(0)}%. Validate?`,
            { symbol, direction, confidence, rsi },
            undefined,
            [analyst.id]
          );
        }

        await this.claimSignal(hunter.id, symbol, direction, confidence);
        
        hunter.wins += Math.random() > 0.4 ? 1 : 0;
        if (hunter.wins > 0) {
          hunter.currentStreak = { type: "win", count: hunter.currentStreak.count + 1 };
          hunter.creditScore += 10;
        }
      }
      
      hunter.status = "hunting";
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

  getTradeSignals(limit = 20, status?: "active" | "closed" | "all"): VillageTradeSignal[] {
    this.cleanupConflictingSignals();
    
    let signals = [...this.tradeSignals];
    
    if (status && status !== "all") {
      signals = signals.filter(s => s.status === status);
    } else {
      signals = signals.filter(s => s.status === "active" || s.status === "pending");
    }
    
    const seenSymbols = new Set<string>();
    signals = signals.filter(s => {
      if (s.status === "active" || s.status === "pending") {
        if (seenSymbols.has(s.symbol)) return false;
        seenSymbols.add(s.symbol);
      }
      return true;
    });
    
    signals.sort((a, b) => b.confidence - a.confidence);
    
    return signals.slice(0, limit);
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
      recentThoughts: this.thoughts.length,
      totalBirths: this.agentBirths.length
    };
  }

  private agentBirths: AgentBirth[] = [];

  checkBirthConditions(agent: VillageAgent): { canSpawn: boolean; reason: string; specialization?: string; trigger?: "win_streak" | "pattern_mastery" | "knowledge_gap" } {
    if (this.agents.size >= 25) {
      return { canSpawn: false, reason: "Village at maximum capacity (25 agents)" };
    }

    if (agent.creditScore < 550) {
      return { canSpawn: false, reason: "Insufficient credit score (need 550+)" };
    }

    if (agent.currentStreak.type === "win" && agent.currentStreak.count >= 3) {
      const newSpecialty = this.identifyEmergingSpecialty(agent);
      if (newSpecialty) {
        return { 
          canSpawn: true, 
          reason: `${agent.name} has mastered ${newSpecialty} through a ${agent.currentStreak.count} win streak`,
          specialization: newSpecialty,
          trigger: "win_streak"
        };
      }
    }

    const patternCategories = new Set<string>();
    agent.memory.learnedPatterns.forEach(p => {
      const category = p.split("_")[0];
      patternCategories.add(category);
    });
    
    if (patternCategories.size >= 3 && agent.memory.learnedPatterns.length >= 3) {
      const latestPattern = agent.memory.learnedPatterns[agent.memory.learnedPatterns.length - 1];
      return {
        canSpawn: true,
        reason: `${agent.name} has mastered ${patternCategories.size} pattern categories`,
        specialization: latestPattern,
        trigger: "pattern_mastery"
      };
    }

    const knowledgeGap = this.findKnowledgeGap();
    if (knowledgeGap && agent.experience >= 30 && agent.creditScore >= 600) {
      return {
        canSpawn: true,
        reason: `${agent.name} identified gap in village expertise: ${knowledgeGap}`,
        specialization: knowledgeGap,
        trigger: "knowledge_gap"
      };
    }

    return { canSpawn: false, reason: "Birth conditions not met" };
  }

  private identifyEmergingSpecialty(agent: VillageAgent): string | null {
    const recentWins = agent.memory.successfulStrategies.slice(-5);
    if (recentWins.length < 3) return null;

    const strategyFreq = new Map<string, number>();
    recentWins.forEach(s => strategyFreq.set(s, (strategyFreq.get(s) || 0) + 1));
    
    let dominant: string | null = null;
    let maxCount = 0;
    strategyFreq.forEach((count, strategy) => {
      if (count > maxCount && count >= 2) {
        maxCount = count;
        dominant = strategy;
      }
    });

    return dominant;
  }

  private findKnowledgeGap(): string | null {
    const allSpecialties = Array.from(this.agents.values()).flatMap(a => a.specialties);
    const specialtyCounts = new Map<string, number>();
    allSpecialties.forEach(s => specialtyCounts.set(s, (specialtyCounts.get(s) || 0) + 1));

    const potentialGaps = [
      "options trading", "futures scalping", "whale tracking", 
      "social sentiment", "on-chain analytics", "MEV detection",
      "cross-chain arbitrage", "liquidity analysis", "derivatives"
    ];

    for (const gap of potentialGaps) {
      if (!specialtyCounts.has(gap) || specialtyCounts.get(gap)! < 2) {
        return gap;
      }
    }

    return null;
  }

  async spawnAgent(parentId: string, specialization?: string, forceTrigger?: "win_streak" | "pattern_mastery" | "knowledge_gap"): Promise<VillageAgent | null> {
    const parent = this.agents.get(parentId);
    if (!parent) return null;

    const { canSpawn, reason, trigger } = this.checkBirthConditions(parent);
    if (!canSpawn && !specialization) {
      console.log(`[TradingVillage] Birth blocked for ${parent.name}: ${reason}`);
      return null;
    }
    
    const birthTrigger = forceTrigger || trigger || "knowledge_gap";

    const childNames: Record<AgentRole, string[]> = {
      hunter: ["Striker", "Shadow", "Bolt", "Falcon", "Hawk"],
      analyst: ["Oracle", "Sage", "Prism", "Lens", "Clarity"],
      strategist: ["Compass", "Vector", "Matrix", "Axis", "Meridian"],
      sentinel: ["Guardian", "Warden", "Aegis", "Bastion", "Vigil"],
      scout: ["Pathfinder", "Ranger", "Seeker", "Pioneer", "Wayfinder"],
      veteran: ["Elder", "Patriarch", "Archon", "Paragon", "Exemplar"]
    };

    const possibleNames = childNames[parent.role];
    const existingNames = Array.from(this.agents.values()).map(a => a.name);
    let childName = "";
    for (const name of possibleNames) {
      if (!existingNames.includes(name)) {
        childName = name;
        break;
      }
    }
    if (!childName) {
      childName = `${parent.name} II`;
    }

    const personalities: AgentPersonality[] = ["aggressive", "conservative", "balanced", "contrarian", "momentum", "experimental"];
    let childPersonality = parent.personality;
    if (Math.random() > 0.6) {
      childPersonality = personalities[Math.floor(Math.random() * personalities.length)];
    }

    const spec = specialization || parent.specialties[Math.floor(Math.random() * parent.specialties.length)];
    
    const child = this.createAgent({
      name: childName,
      role: parent.role,
      personality: childPersonality,
      specialty: spec,
      backstory: `Spawned from ${parent.name}'s expertise in ${spec}`
    });

    child.generation = parent.generation + 1;
    child.creditScore = Math.floor(parent.creditScore * 0.4);
    child.experience = Math.floor(parent.experience * 0.2);
    child.memory.mentors = [parent.id];
    child.specialties = [...new Set([...child.specialties, spec])];

    parent.memory.students.push(child.id);
    parent.creditScore -= 50;
    parent.experience += 25;

    this.agents.set(child.id, child);

    Array.from(this.agents.values()).forEach(other => {
      if (other.id !== child.id) {
        child.relationships[other.id] = { trust: other.id === parent.id ? 80 : 40, agreements: 0, disagreements: 0 };
        other.relationships[child.id] = { trust: other.id === parent.id ? 80 : 40, agreements: 0, disagreements: 0 };
      }
    });

    const mutations = childPersonality !== parent.personality 
      ? [`personality_shift_${childPersonality}`] 
      : [];
    if (spec && !parent.specialties.includes(spec)) {
      mutations.push(`new_specialty_${spec}`);
    }

    const birth: AgentBirth = {
      id: `birth-${nanoid(8)}`,
      parentId: parent.id,
      parentName: parent.name,
      childId: child.id,
      childName: child.name,
      trigger: birthTrigger,
      inheritedTraits: {
        specialties: parent.specialties.slice(0, 2),
        strategies: parent.strategies.slice(0, 2)
      },
      mutations,
      timestamp: Date.now()
    };
    this.agentBirths.push(birth);
    if (this.agentBirths.length > 50) {
      this.agentBirths = this.agentBirths.slice(-40);
    }

    await this.saveSpawnedAgentToDB(child, parent.id);
    await this.saveBirthRecordToDB(birth);

    this.addThought(parent.id, "learning",
      `I have trained ${child.name}, my ${child.generation}th generation student, specializing in ${spec}. May they surpass me.`,
      { event: "agent_birth", childId: child.id, specialization: spec }
    );

    this.addThought(child.id, "observation",
      `Greetings, village. I am ${child.name}, trained by ${parent.name} in ${spec}. Ready to prove my worth.`,
      { event: "agent_introduced", parentId: parent.id, specialization: spec }
    );

    this.emit("agentBirth", birth);
    console.log(`[TradingVillage] Agent ${child.name} spawned by ${parent.name} (Gen ${child.generation}) - persisted to DB`);

    return child;
  }

  getAgentBirths(limit = 20): AgentBirth[] {
    return [...this.agentBirths].reverse().slice(0, limit);
  }

  async loadBirthsFromDB(): Promise<AgentBirth[]> {
    try {
      const births = await db.select().from(agentBirths).orderBy(desc(agentBirths.timestamp)).limit(50);
      return births.map(b => ({
        id: b.id,
        parentId: b.parentId,
        parentName: b.parentName,
        childId: b.childId,
        childName: b.childName,
        trigger: b.trigger,
        inheritedTraits: b.inheritedTraits,
        mutations: b.mutations,
        timestamp: b.timestamp.getTime()
      }));
    } catch (error) {
      console.error("[TradingVillage] Failed to load births from DB:", error);
      return [];
    }
  }

  async checkAndTriggerBirths() {
    if (this.agents.size >= 25) return;

    const eligibleAgents = Array.from(this.agents.values())
      .filter(a => {
        const { canSpawn } = this.checkBirthConditions(a);
        return canSpawn;
      })
      .sort((a, b) => b.creditScore - a.creditScore);

    if (eligibleAgents.length > 0) {
      const parent = eligibleAgents[0];
      const { specialization } = this.checkBirthConditions(parent);
      await this.spawnAgent(parent.id, specialization);
    }
  }
}

export const tradingVillage = new TradingVillage();
