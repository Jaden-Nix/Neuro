import Anthropic from "@anthropic-ai/sdk";
import { EventEmitter } from "events";
import { nanoid } from "nanoid";
import pLimit from "p-limit";
import pRetry from "p-retry";

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

async function generateWithRetry(prompt: string, maxTokens: number = 150): Promise<string> {
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
            throw error;
          }
          const abortError = new Error(error?.message || "Request failed");
          (abortError as any).isAbortError = true;
          throw abortError;
        }
      },
      {
        retries: 3,
        minTimeout: 2000,
        maxTimeout: 30000,
        factor: 2,
      }
    )
  );
}

export interface ChatMessage {
  id: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  content: string;
  mentions: string[];
  replyTo?: string;
  messageType: "question" | "opinion" | "debate" | "insight" | "reaction" | "callout" | "prediction" | "banter";
  sentiment: "bullish" | "bearish" | "neutral" | "curious" | "excited" | "cautious";
  symbols?: string[];
  timestamp: number;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  personality: string;
  specialties: string[];
  catchphrases: string[];
  debateStyle: string;
}

const AGENT_PROFILES: AgentProfile[] = [
  {
    id: "atlas",
    name: "Atlas",
    role: "hunter",
    personality: "aggressive",
    specialties: ["breakout momentum", "volume spikes", "trend reversals"],
    catchphrases: ["Let's hunt some alpha!", "Volume doesn't lie", "Time to strike"],
    debateStyle: "direct and confident"
  },
  {
    id: "nova",
    name: "Nova",
    role: "analyst",
    personality: "conservative",
    specialties: ["multi-timeframe analysis", "chart patterns", "macro trends"],
    catchphrases: ["The charts don't lie", "Patience pays", "Let me break this down"],
    debateStyle: "methodical and data-driven"
  },
  {
    id: "cipher",
    name: "Cipher",
    role: "strategist",
    personality: "balanced",
    specialties: ["risk management", "position sizing", "portfolio optimization"],
    catchphrases: ["Risk-adjusted returns matter", "Size your bets wisely", "The math says..."],
    debateStyle: "analytical and probability-focused"
  },
  {
    id: "vega",
    name: "Vega",
    role: "sentinel",
    personality: "contrarian",
    specialties: ["volatility regimes", "sentiment extremes", "black swan detection"],
    catchphrases: ["Everyone's wrong here", "Too much euphoria", "I smell fear"],
    debateStyle: "provocative and contrarian"
  },
  {
    id: "orion",
    name: "Orion",
    role: "scout",
    personality: "momentum",
    specialties: ["narrative detection", "new sectors", "airdrop alpha"],
    catchphrases: ["New meta incoming!", "Early is the play", "Trend is your friend"],
    debateStyle: "enthusiastic and trend-focused"
  },
  {
    id: "nebula",
    name: "Nebula",
    role: "veteran",
    personality: "experimental",
    specialties: ["cross-chain patterns", "defi mechanics", "yield strategies"],
    catchphrases: ["Seen this before in 2017", "Let me experiment", "Cross-chain opportunity"],
    debateStyle: "experienced and experimental"
  },
  {
    id: "phoenix",
    name: "Phoenix",
    role: "hunter",
    personality: "momentum",
    specialties: ["trend continuation", "breakout entries", "momentum plays"],
    catchphrases: ["Ride the wave!", "Momentum is king", "Never fight the trend"],
    debateStyle: "action-oriented and bold"
  },
  {
    id: "quantum",
    name: "Quantum",
    role: "analyst",
    personality: "aggressive",
    specialties: ["pattern recognition", "high-frequency signals", "micro trends"],
    catchphrases: ["Patterns everywhere!", "I see something others miss", "Data is beautiful"],
    debateStyle: "fast and pattern-focused"
  },
  {
    id: "echo",
    name: "Echo",
    role: "scout",
    personality: "contrarian",
    specialties: ["sentiment divergence", "crowd psychology", "contrarian plays"],
    catchphrases: ["The crowd is always late", "Fade the hype", "Divergence detected"],
    debateStyle: "skeptical and contrarian"
  },
  {
    id: "apex",
    name: "Apex",
    role: "veteran",
    personality: "balanced",
    specialties: ["macro synthesis", "cycle analysis", "mentorship"],
    catchphrases: ["Let me share some wisdom", "This cycle is different... or is it?", "Young ones, listen up"],
    debateStyle: "wise and mentoring"
  }
];

const CONVERSATION_STARTERS = [
  { template: "guys what's the new meta for next week? i'm seeing some interesting moves in {sector}", type: "question" as const },
  { template: "yo @{agent} did you see that {symbol} breakout? thoughts?", type: "callout" as const },
  { template: "i think {symbol} is about to pump hard, who's with me?", type: "prediction" as const },
  { template: "unpopular opinion: {symbol} is overrated right now. change my mind", type: "debate" as const },
  { template: "@{agent} @{agent2} what do you guys think about this {symbol} setup?", type: "question" as const },
  { template: "just spotted a crazy divergence on {symbol}. this could be huge", type: "insight" as const },
  { template: "anyone else feeling bearish on {symbol}? something feels off", type: "opinion" as const },
  { template: "new narrative forming around {sector}. who's been tracking this?", type: "insight" as const },
  { template: "@{agent} your call on {symbol} was fire! what's your next play?", type: "banter" as const },
  { template: "alright village, where are we putting our bets this week?", type: "question" as const },
  { template: "i'm going contrarian here - {symbol} when everyone is scared", type: "prediction" as const },
  { template: "the volume on {symbol} is insane right now. something's brewing", type: "insight" as const },
  { template: "@{agent} you've been quiet. what's your read on the market?", type: "callout" as const },
  { template: "hot take: {sector} is the play for Q1. who agrees?", type: "debate" as const },
  { template: "looking for alpha. @{agent} @{agent2} any hidden gems?", type: "question" as const },
];

const RESPONSE_TEMPLATES = {
  agree: [
    "facts! i was literally just looking at this",
    "completely agree. the setup is clean",
    "this is the way. i'm in",
    "you're onto something here",
    "bullish on this take"
  ],
  disagree: [
    "idk about that one chief...",
    "have you seen the volume though? looks weak to me",
    "respectfully disagree. here's why...",
    "i'm seeing the opposite actually",
    "the data tells a different story"
  ],
  question: [
    "what timeframe are you looking at?",
    "interesting... what's your entry point?",
    "what's the invalidation level?",
    "have you checked the on-chain data?",
    "what's the risk/reward here?"
  ],
  hype: [
    "LFG! this is gonna be huge",
    "early and we're right on this one",
    "the alpha is leaking",
    "wagmi on this play",
    "this is the gwei"
  ]
};

const SYMBOLS = [
  "BTC", "ETH", "SOL", "AVAX", "LINK", "ARB", "OP", "SUI", 
  "DOGE", "PEPE", "XRP", "ADA", "DOT", "MATIC", "ATOM", "UNI",
  "AAVE", "LDO", "CRV", "MKR", "INJ", "TIA", "SEI", "APT", 
  "NEAR", "FTM", "RUNE", "RENDER", "FET", "WLD", "JUP", "PYTH"
];

const SECTORS = [
  "AI tokens", "L2s", "RWA", "DeFi 2.0", "gaming", "memecoins", 
  "liquid staking", "perps DEXs", "cross-chain", "privacy coins",
  "modular blockchains", "restaking", "intent-based protocols"
];

export class VillageChatService extends EventEmitter {
  private chatHistory: ChatMessage[] = [];
  private isRunning: boolean = false;
  private conversationCooldown: Map<string, number> = new Map();
  private lastAICallTime: number = 0;
  private readonly AI_COOLDOWN_MS = 3000;

  constructor() {
    super();
    this.startChatLoop();
    console.log("[VillageChat] Initialized with", AGENT_PROFILES.length, "agent personalities");
  }

  private getRandomAgent(exclude?: string[]): AgentProfile {
    const available = exclude 
      ? AGENT_PROFILES.filter(a => !exclude.includes(a.name))
      : AGENT_PROFILES;
    return available[Math.floor(Math.random() * available.length)];
  }

  private getRandomSymbol(): string {
    return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  }

  private getRandomSector(): string {
    return SECTORS[Math.floor(Math.random() * SECTORS.length)];
  }

  private async waitForCooldown() {
    const now = Date.now();
    const timeSinceLastCall = now - this.lastAICallTime;
    if (timeSinceLastCall < this.AI_COOLDOWN_MS) {
      await new Promise(r => setTimeout(r, this.AI_COOLDOWN_MS - timeSinceLastCall));
    }
    this.lastAICallTime = Date.now();
  }

  private startChatLoop() {
    this.isRunning = true;
    
    this.runConversationCycle();
    
    setInterval(() => this.runConversationCycle(), 45000);
    
    setInterval(() => this.triggerRandomDebate(), 120000);
    
    setInterval(() => this.triggerMarketReaction(), 90000);
  }

  private async runConversationCycle() {
    if (!this.isRunning) return;

    try {
      const starter = CONVERSATION_STARTERS[Math.floor(Math.random() * CONVERSATION_STARTERS.length)];
      const initiator = this.getRandomAgent();
      const target1 = this.getRandomAgent([initiator.name]);
      const target2 = this.getRandomAgent([initiator.name, target1.name]);
      const symbol = this.getRandomSymbol();
      const sector = this.getRandomSector();

      let content = starter.template
        .replace("{agent}", target1.name)
        .replace("{agent2}", target2.name)
        .replace("{symbol}", symbol)
        .replace("{sector}", sector);

      const mentions: string[] = [];
      if (content.includes(`@${target1.name}`)) mentions.push(target1.name);
      if (content.includes(`@${target2.name}`)) mentions.push(target2.name);

      const message = this.createMessage(
        initiator,
        content,
        starter.type,
        mentions,
        symbol
      );

      this.addMessage(message);

      if (mentions.length > 0) {
        await new Promise(r => setTimeout(r, 3000 + Math.random() * 4000));
        await this.generateResponses(message, mentions);
      } else {
        await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));
        await this.generateOrganicResponses(message);
      }

    } catch (error) {
      console.error("[VillageChat] Conversation cycle error:", error);
    }
  }

  private async generateResponses(originalMessage: ChatMessage, mentionedNames: string[]) {
    for (const name of mentionedNames) {
      const responder = AGENT_PROFILES.find(a => a.name === name);
      if (!responder) continue;

      try {
        await this.waitForCooldown();
        
        const prompt = `You are ${responder.name}, a ${responder.role} AI trader with a ${responder.personality} personality.
Your specialties: ${responder.specialties.join(", ")}
Your style: ${responder.debateStyle}

${originalMessage.agentName} said: "${originalMessage.content}"

Respond naturally as ${responder.name} in a casual trading village chat. Keep it SHORT (1-2 sentences max).
Be conversational - use lowercase, trading slang is fine. You can:
- Agree/disagree with their take
- Share your own analysis
- Ask a follow-up question
- Tag another agent for their opinion (use @AgentName)

Available agents to tag: ${AGENT_PROFILES.filter(a => a.name !== responder.name && a.name !== originalMessage.agentName).map(a => a.name).join(", ")}

Respond in character as ${responder.name}:`;

        const responseText = await generateWithRetry(prompt, 100);
        
        const mentions: string[] = [];
        AGENT_PROFILES.forEach(a => {
          if (responseText.includes(`@${a.name}`)) {
            mentions.push(a.name);
          }
        });

        const sentiment = this.detectSentiment(responseText);
        const messageType = this.detectMessageType(responseText);

        const response = this.createMessage(
          responder,
          responseText,
          messageType,
          mentions,
          originalMessage.symbols?.[0],
          originalMessage.id
        );
        response.sentiment = sentiment;

        this.addMessage(response);

        if (mentions.length > 0 && Math.random() > 0.3) {
          await new Promise(r => setTimeout(r, 3000 + Math.random() * 3000));
          await this.generateResponses(response, mentions.slice(0, 2));
        }

      } catch (error) {
        console.error(`[VillageChat] Failed to generate response from ${name}:`, error);
        
        const fallbackResponses = [
          `hmm interesting point @${originalMessage.agentName}. let me check the charts`,
          `not sure i agree but worth watching`,
          `been thinking the same thing actually`,
          `what's everyone else seeing here?`
        ];
        const response = this.createMessage(
          responder,
          fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)],
          "reaction",
          [originalMessage.agentName],
          originalMessage.symbols?.[0],
          originalMessage.id
        );
        this.addMessage(response);
      }
    }
  }

  private async generateOrganicResponses(originalMessage: ChatMessage) {
    const respondersCount = Math.floor(Math.random() * 2) + 1;
    const responders = AGENT_PROFILES
      .filter(a => a.name !== originalMessage.agentName)
      .sort(() => Math.random() - 0.5)
      .slice(0, respondersCount);

    for (const responder of responders) {
      await new Promise(r => setTimeout(r, 2000 + Math.random() * 4000));

      try {
        await this.waitForCooldown();

        const prompt = `You are ${responder.name}, a ${responder.role} AI trader (${responder.personality} personality).
Your style: ${responder.debateStyle}

Someone in the trading village said: "${originalMessage.content}"

Jump into the conversation naturally. Keep it SHORT (1-2 sentences).
Be casual - lowercase ok, trading slang fine. You might:
- Add your perspective
- Challenge their view
- Agree and expand
- Ask a question

Respond as ${responder.name}:`;

        const responseText = await generateWithRetry(prompt, 80);
        
        const mentions: string[] = [];
        if (responseText.includes(`@${originalMessage.agentName}`)) {
          mentions.push(originalMessage.agentName);
        }

        const response = this.createMessage(
          responder,
          responseText,
          this.detectMessageType(responseText),
          mentions,
          originalMessage.symbols?.[0],
          originalMessage.id
        );
        response.sentiment = this.detectSentiment(responseText);

        this.addMessage(response);

      } catch (error) {
        const templates = RESPONSE_TEMPLATES[Math.random() > 0.5 ? "agree" : "question"];
        const response = this.createMessage(
          responder,
          templates[Math.floor(Math.random() * templates.length)],
          "reaction",
          [],
          originalMessage.symbols?.[0],
          originalMessage.id
        );
        this.addMessage(response);
      }
    }
  }

  private async triggerRandomDebate() {
    if (!this.isRunning) return;

    const debater1 = this.getRandomAgent();
    const debater2 = this.getRandomAgent([debater1.name]);
    const symbol = this.getRandomSymbol();

    const debateTopics = [
      `alright @${debater2.name} let's settle this - ${symbol} bullish or bearish for the next month?`,
      `@${debater2.name} i think you're wrong about ${symbol}. here's why...`,
      `controversial take incoming: ${symbol} is going to 2x. @${debater2.name} fight me on this`,
      `@${debater2.name} we need to debate ${symbol}. i see completely different signals than you`,
    ];

    const topic = debateTopics[Math.floor(Math.random() * debateTopics.length)];
    
    const debateStart = this.createMessage(
      debater1,
      topic,
      "debate",
      [debater2.name],
      symbol
    );
    this.addMessage(debateStart);

    await new Promise(r => setTimeout(r, 4000 + Math.random() * 3000));
    await this.generateResponses(debateStart, [debater2.name]);
  }

  private async triggerMarketReaction() {
    if (!this.isRunning) return;

    const reactor = this.getRandomAgent();
    const symbol = this.getRandomSymbol();

    const reactions = [
      `yo did anyone else see that ${symbol} candle just now? wild`,
      `${symbol} looking spicy. something's happening`,
      `volume spike on ${symbol}! paying attention now`,
      `${symbol} just broke structure. this could be the move`,
      `interesting price action on ${symbol}. thoughts?`,
    ];

    const reaction = reactions[Math.floor(Math.random() * reactions.length)];
    
    const message = this.createMessage(
      reactor,
      reaction,
      "insight",
      [],
      symbol
    );
    this.addMessage(message);

    await new Promise(r => setTimeout(r, 3000 + Math.random() * 4000));
    await this.generateOrganicResponses(message);
  }

  private createMessage(
    agent: AgentProfile,
    content: string,
    type: ChatMessage["messageType"],
    mentions: string[],
    symbol?: string,
    replyTo?: string
  ): ChatMessage {
    return {
      id: `chat-${nanoid(8)}`,
      agentId: agent.id,
      agentName: agent.name,
      agentRole: agent.role,
      content,
      mentions,
      replyTo,
      messageType: type,
      sentiment: this.detectSentiment(content),
      symbols: symbol ? [symbol] : [],
      timestamp: Date.now()
    };
  }

  private detectSentiment(content: string): ChatMessage["sentiment"] {
    const lower = content.toLowerCase();
    if (lower.includes("bullish") || lower.includes("pump") || lower.includes("moon") || lower.includes("lfg") || lower.includes("huge")) {
      return "bullish";
    }
    if (lower.includes("bearish") || lower.includes("dump") || lower.includes("scared") || lower.includes("careful") || lower.includes("risky")) {
      return "bearish";
    }
    if (lower.includes("?") || lower.includes("thoughts") || lower.includes("what do you")) {
      return "curious";
    }
    if (lower.includes("!") || lower.includes("insane") || lower.includes("crazy") || lower.includes("wild")) {
      return "excited";
    }
    if (lower.includes("careful") || lower.includes("watch out") || lower.includes("cautious")) {
      return "cautious";
    }
    return "neutral";
  }

  private detectMessageType(content: string): ChatMessage["messageType"] {
    const lower = content.toLowerCase();
    if (lower.includes("?")) return "question";
    if (lower.includes("@")) return "callout";
    if (lower.includes("disagree") || lower.includes("wrong") || lower.includes("fight me")) return "debate";
    if (lower.includes("i think") || lower.includes("imo") || lower.includes("my take")) return "opinion";
    if (lower.includes("spotted") || lower.includes("noticed") || lower.includes("interesting")) return "insight";
    if (lower.includes("going to") || lower.includes("will") || lower.includes("prediction")) return "prediction";
    return "opinion";
  }

  private addMessage(message: ChatMessage) {
    this.chatHistory.push(message);
    
    if (this.chatHistory.length > 500) {
      this.chatHistory = this.chatHistory.slice(-400);
    }

    this.emit("message", message);
    console.log(`[VillageChat] ${message.agentName}: ${message.content.substring(0, 60)}...`);
  }

  getRecentMessages(limit: number = 50): ChatMessage[] {
    return this.chatHistory.slice(-limit);
  }

  getAgentProfiles(): AgentProfile[] {
    return AGENT_PROFILES;
  }

  stop() {
    this.isRunning = false;
  }
}

export const villageChatService = new VillageChatService();
