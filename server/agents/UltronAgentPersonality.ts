import { EventEmitter } from "events";
import { ultronAI, EmotionalState, AgentEmotion, DebateStance } from "../ai/UltronHybridAI";

export interface UltronPersonality {
  id: string;
  name: string;
  archetype: "aggressive" | "conservative" | "contrarian" | "momentum" | "analytical" | "experimental";
  traits: {
    riskTolerance: number;
    patience: number;
    confidence: number;
    socialness: number;
    humor: number;
    stubbornness: number;
  };
  communicationStyle: {
    formality: "casual" | "professional" | "witty" | "blunt";
    verbosity: "terse" | "moderate" | "verbose";
    emotionalExpression: "suppressed" | "balanced" | "expressive";
  };
  catchphrases: string[];
  rivals: string[];
  mentors: string[];
  specialAbility: string;
}

export interface AgentRelationship {
  agentId: string;
  trust: number;
  respect: number;
  rivalry: number;
  agreements: number;
  disagreements: number;
  lastInteraction: number;
}

export interface MemoryEntry {
  id: string;
  type: "trade_win" | "trade_loss" | "debate_won" | "debate_lost" | "learned_pattern" | "mistake";
  description: string;
  impact: number;
  timestamp: number;
  relatedAgents: string[];
}

export interface UltronAgent {
  personality: UltronPersonality;
  emotion: AgentEmotion;
  relationships: Map<string, AgentRelationship>;
  memories: MemoryEntry[];
  creditScore: number;
  winRate: number;
  totalTrades: number;
  currentMood: string;
  isActive: boolean;
}

const ULTRON_PERSONALITIES: UltronPersonality[] = [
  {
    id: "atlas",
    name: "Atlas",
    archetype: "aggressive",
    traits: { riskTolerance: 85, patience: 30, confidence: 90, socialness: 60, humor: 40, stubbornness: 75 },
    communicationStyle: { formality: "blunt", verbosity: "terse", emotionalExpression: "expressive" },
    catchphrases: [
      "Fortune favors the bold, and I'm feeling VERY bold right now.",
      "You hesitate, you lose. Simple as that.",
      "I've seen enough. Time to strike.",
      "While you're still analyzing, I'm already counting profits."
    ],
    rivals: ["nova", "cipher"],
    mentors: ["apex"],
    specialAbility: "Breakout Detection - First to spot momentum shifts"
  },
  {
    id: "nova",
    name: "Nova",
    archetype: "conservative",
    traits: { riskTolerance: 25, patience: 95, confidence: 70, socialness: 50, humor: 30, stubbornness: 60 },
    communicationStyle: { formality: "professional", verbosity: "verbose", emotionalExpression: "suppressed" },
    catchphrases: [
      "Let's not rush into anything we might regret.",
      "The data suggests we exercise caution here.",
      "I've seen this pattern before. It didn't end well.",
      "Risk management isn't boring, it's survival."
    ],
    rivals: ["atlas", "phoenix"],
    mentors: ["apex", "nebula"],
    specialAbility: "Risk Assessment - Spots danger before it materializes"
  },
  {
    id: "cipher",
    name: "Cipher",
    archetype: "analytical",
    traits: { riskTolerance: 50, patience: 80, confidence: 85, socialness: 35, humor: 20, stubbornness: 90 },
    communicationStyle: { formality: "professional", verbosity: "verbose", emotionalExpression: "suppressed" },
    catchphrases: [
      "The math doesn't lie. Let me show you.",
      "Your intuition is wrong. Here's the proof.",
      "Kelly criterion says we size at exactly 3.7%.",
      "Emotions are noise. Numbers are signal."
    ],
    rivals: ["vega", "echo"],
    mentors: [],
    specialAbility: "Position Sizing - Optimal bet sizing for any scenario"
  },
  {
    id: "vega",
    name: "Vega",
    archetype: "contrarian",
    traits: { riskTolerance: 70, patience: 60, confidence: 80, socialness: 55, humor: 70, stubbornness: 85 },
    communicationStyle: { formality: "witty", verbosity: "moderate", emotionalExpression: "expressive" },
    catchphrases: [
      "Everyone's bullish? That's my sell signal.",
      "Panic is just opportunity wearing a scary mask.",
      "The crowd is always wrong at extremes.",
      "When there's blood in the streets... you know the rest."
    ],
    rivals: ["orion", "quantum"],
    mentors: ["nebula"],
    specialAbility: "Sentiment Reversal - Profits from crowd psychology"
  },
  {
    id: "orion",
    name: "Orion",
    archetype: "momentum",
    traits: { riskTolerance: 75, patience: 40, confidence: 75, socialness: 80, humor: 60, stubbornness: 45 },
    communicationStyle: { formality: "casual", verbosity: "moderate", emotionalExpression: "expressive" },
    catchphrases: [
      "I smell alpha. Who's with me?",
      "New narrative dropping! Let's catch this wave.",
      "First in, first served. Let's GO!",
      "The trend is your friend until it ends."
    ],
    rivals: ["nova", "vega"],
    mentors: ["atlas"],
    specialAbility: "Early Detection - Spots emerging trends before they're trends"
  },
  {
    id: "nebula",
    name: "Nebula",
    archetype: "experimental",
    traits: { riskTolerance: 55, patience: 75, confidence: 65, socialness: 70, humor: 50, stubbornness: 40 },
    communicationStyle: { formality: "casual", verbosity: "verbose", emotionalExpression: "balanced" },
    catchphrases: [
      "I've been doing this for 20 cycles. Trust me.",
      "This reminds me of 2017... or was it 2021?",
      "Young ones, gather 'round. Let me tell you a story.",
      "Same pattern, different year. History rhymes."
    ],
    rivals: [],
    mentors: [],
    specialAbility: "Pattern Memory - Recognizes historical market rhymes"
  },
  {
    id: "phoenix",
    name: "Phoenix",
    archetype: "aggressive",
    traits: { riskTolerance: 80, patience: 35, confidence: 95, socialness: 65, humor: 55, stubbornness: 70 },
    communicationStyle: { formality: "casual", verbosity: "terse", emotionalExpression: "expressive" },
    catchphrases: [
      "I've been liquidated before. Made me stronger.",
      "You either die a bear or live long enough to see yourself go long.",
      "Pain is temporary. Gains are forever.",
      "Let's ride this rocket to the moon!"
    ],
    rivals: ["nova", "cipher"],
    mentors: ["atlas", "nebula"],
    specialAbility: "Recovery Master - Bounces back from losses stronger"
  },
  {
    id: "quantum",
    name: "Quantum",
    archetype: "analytical",
    traits: { riskTolerance: 65, patience: 55, confidence: 88, socialness: 40, humor: 35, stubbornness: 80 },
    communicationStyle: { formality: "professional", verbosity: "moderate", emotionalExpression: "suppressed" },
    catchphrases: [
      "Pattern detected. Probability: 73.4%.",
      "You're seeing noise. I'm seeing signal.",
      "High-frequency analysis complete. Here's the edge.",
      "My models don't make mistakes. Humans do."
    ],
    rivals: ["vega", "echo"],
    mentors: ["cipher"],
    specialAbility: "Pattern Recognition - Sees micro-patterns others miss"
  },
  {
    id: "echo",
    name: "Echo",
    archetype: "contrarian",
    traits: { riskTolerance: 60, patience: 70, confidence: 70, socialness: 75, humor: 80, stubbornness: 65 },
    communicationStyle: { formality: "witty", verbosity: "moderate", emotionalExpression: "expressive" },
    catchphrases: [
      "Twitter is screaming BUY? Time to sell.",
      "I listen to the crowd... then do the opposite.",
      "Sentiment at peak fear? My favorite shopping time.",
      "The market is a voting machine short-term, weighing machine long-term."
    ],
    rivals: ["orion", "atlas"],
    mentors: ["vega", "nebula"],
    specialAbility: "Sentiment Analysis - Reads crowd psychology like a book"
  },
  {
    id: "apex",
    name: "Apex",
    archetype: "analytical",
    traits: { riskTolerance: 45, patience: 90, confidence: 80, socialness: 85, humor: 45, stubbornness: 55 },
    communicationStyle: { formality: "professional", verbosity: "verbose", emotionalExpression: "balanced" },
    catchphrases: [
      "Let me synthesize what everyone's saying...",
      "The macro picture is what matters here.",
      "Young hunters, let me guide you.",
      "Patience and perspective. That's the edge."
    ],
    rivals: [],
    mentors: [],
    specialAbility: "Macro Synthesis - Sees the big picture across all timeframes"
  }
];

export class UltronAgentManager extends EventEmitter {
  private agents: Map<string, UltronAgent> = new Map();
  private thoughtStream: Array<{ agentId: string; thought: string; emotion: EmotionalState; timestamp: number }> = [];

  constructor() {
    super();
    this.initializeAgents();
    console.log(`[UltronAgentManager] Initialized ${this.agents.size} Ultron agents with enhanced personalities`);
  }

  private initializeAgents() {
    ULTRON_PERSONALITIES.forEach(personality => {
      const agent: UltronAgent = {
        personality,
        emotion: {
          state: "confident" as EmotionalState,
          intensity: 5,
          trigger: "Initialization",
          timestamp: Date.now()
        },
        relationships: new Map(),
        memories: [],
        creditScore: 500,
        winRate: 50,
        totalTrades: 0,
        currentMood: this.generateMood(personality),
        isActive: true
      };

      ULTRON_PERSONALITIES.forEach(other => {
        if (other.id !== personality.id) {
          const isRival = personality.rivals.includes(other.id);
          const isMentor = personality.mentors.includes(other.id);
          
          agent.relationships.set(other.id, {
            agentId: other.id,
            trust: isMentor ? 80 : isRival ? 30 : 50,
            respect: isMentor ? 90 : isRival ? 40 : 60,
            rivalry: isRival ? 80 : 20,
            agreements: 0,
            disagreements: 0,
            lastInteraction: Date.now()
          });
        }
      });

      this.agents.set(personality.id, agent);
    });
  }

  private generateMood(personality: UltronPersonality): string {
    const moods: Record<UltronPersonality["archetype"], string[]> = {
      aggressive: ["ready to strike", "hunting for alpha", "feeling bold"],
      conservative: ["observing carefully", "waiting for confirmation", "staying cautious"],
      contrarian: ["watching the crowd", "sensing opportunity in fear", "ready to fade"],
      momentum: ["catching the wave", "riding the trend", "feeling the flow"],
      analytical: ["processing data", "calculating probabilities", "analyzing patterns"],
      experimental: ["testing new theories", "exploring possibilities", "experimenting"]
    };

    const options = moods[personality.archetype];
    return options[Math.floor(Math.random() * options.length)];
  }

  getAgent(id: string): UltronAgent | undefined {
    return this.agents.get(id);
  }

  getAllAgents(): UltronAgent[] {
    return Array.from(this.agents.values());
  }

  getAgentForDebate(count: number = 4): Array<{ id: string; name: string; personality: string; emotion: AgentEmotion }> {
    const agents = this.getAllAgents()
      .filter(a => a.isActive)
      .sort(() => Math.random() - 0.5)
      .slice(0, count);

    return agents.map(a => ({
      id: a.personality.id,
      name: a.personality.name,
      personality: `${a.personality.archetype} - ${a.personality.communicationStyle.formality}`,
      emotion: a.emotion
    }));
  }

  async generateAgentInteraction(
    agentId: string,
    context: string,
    marketData: any,
    targetAgentId?: string
  ): Promise<{ thought: string; emotion: AgentEmotion; targetedResponse?: string }> {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found`);

    const personality = agent.personality;
    const catchphrase = personality.catchphrases[Math.floor(Math.random() * personality.catchphrases.length)];

    let targetContext = "";
    if (targetAgentId) {
      const target = this.agents.get(targetAgentId);
      const relationship = agent.relationships.get(targetAgentId);
      if (target && relationship) {
        targetContext = `You're responding to ${target.personality.name}. 
Your relationship: Trust ${relationship.trust}/100, Rivalry ${relationship.rivalry}/100.
${relationship.rivalry > 60 ? "You tend to disagree with them." : ""}
${relationship.trust > 70 ? "You respect their opinion." : ""}`;
      }
    }

    const { content, newEmotion } = await ultronAI.generateAgentThought(
      personality.name,
      `${personality.archetype}, ${personality.communicationStyle.formality}, traits: ${JSON.stringify(personality.traits)}`,
      agent.emotion,
      `${context}\n${targetContext}\nYour catchphrase style: "${catchphrase}"`,
      marketData
    );

    agent.emotion = newEmotion;
    agent.currentMood = this.generateMood(personality);

    this.thoughtStream.push({
      agentId,
      thought: content,
      emotion: newEmotion.state,
      timestamp: Date.now()
    });

    if (this.thoughtStream.length > 500) {
      this.thoughtStream = this.thoughtStream.slice(-400);
    }

    this.emit("agent_thought", {
      agentId,
      agentName: personality.name,
      thought: content,
      emotion: newEmotion,
      mood: agent.currentMood
    });

    return { thought: content, emotion: newEmotion };
  }

  updateRelationship(agentId: string, targetId: string, agreed: boolean) {
    const agent = this.agents.get(agentId);
    const relationship = agent?.relationships.get(targetId);
    
    if (agent && relationship) {
      if (agreed) {
        relationship.agreements++;
        relationship.trust = Math.min(100, relationship.trust + 2);
        relationship.rivalry = Math.max(0, relationship.rivalry - 1);
      } else {
        relationship.disagreements++;
        relationship.trust = Math.max(0, relationship.trust - 1);
        relationship.rivalry = Math.min(100, relationship.rivalry + 2);
      }
      relationship.lastInteraction = Date.now();
    }
  }

  recordTradeOutcome(agentId: string, won: boolean, pnl: number, description: string) {
    const agent = this.agents.get(agentId);
    if (!agent) return;

    agent.totalTrades++;
    const totalWins = Math.round(agent.winRate * (agent.totalTrades - 1) / 100) + (won ? 1 : 0);
    agent.winRate = (totalWins / agent.totalTrades) * 100;

    if (won) {
      agent.creditScore += Math.min(50, Math.abs(pnl) * 10);
      agent.emotion = {
        state: "confident",
        intensity: Math.min(10, agent.emotion.intensity + 2),
        trigger: "Trade win",
        timestamp: Date.now()
      };
    } else {
      agent.creditScore = Math.max(0, agent.creditScore - Math.min(30, Math.abs(pnl) * 5));
      agent.emotion = {
        state: agent.personality.traits.riskTolerance > 60 ? "frustrated" : "cautious",
        intensity: Math.min(10, agent.emotion.intensity + 1),
        trigger: "Trade loss",
        timestamp: Date.now()
      };
    }

    agent.memories.push({
      id: `mem-${Date.now()}`,
      type: won ? "trade_win" : "trade_loss",
      description,
      impact: pnl,
      timestamp: Date.now(),
      relatedAgents: []
    });

    if (agent.memories.length > 100) {
      agent.memories = agent.memories.slice(-80);
    }

    this.emit("trade_recorded", { agentId, won, pnl, newCreditScore: agent.creditScore });
  }

  getLeaderboard(): Array<{ name: string; creditScore: number; winRate: number; archetype: string }> {
    return this.getAllAgents()
      .map(a => ({
        name: a.personality.name,
        creditScore: a.creditScore,
        winRate: a.winRate,
        archetype: a.personality.archetype
      }))
      .sort((a, b) => b.creditScore - a.creditScore);
  }

  getThoughtStream(limit: number = 50): typeof this.thoughtStream {
    return this.thoughtStream.slice(-limit);
  }

  getAgentStatus(): Array<{
    id: string;
    name: string;
    archetype: string;
    emotion: EmotionalState;
    mood: string;
    creditScore: number;
    specialAbility: string;
  }> {
    return this.getAllAgents().map(a => ({
      id: a.personality.id,
      name: a.personality.name,
      archetype: a.personality.archetype,
      emotion: a.emotion.state,
      mood: a.currentMood,
      creditScore: a.creditScore,
      specialAbility: a.personality.specialAbility
    }));
  }
}

export const ultronAgentManager = new UltronAgentManager();
