import Anthropic from "@anthropic-ai/sdk";
import { EventEmitter } from "events";
import { nanoid } from "nanoid";
import pLimit from "p-limit";
import pRetry from "p-retry";
import { marketDataService } from "../data/MarketDataService";
import { livePriceService } from "../data/LivePriceService";

const claudeApiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
const claudeBaseUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;

const anthropic = claudeApiKey ? new Anthropic({
  apiKey: claudeApiKey,
  ...(claudeBaseUrl && { baseURL: claudeBaseUrl }),
}) : null;

const isAnthropicConfigured = !!anthropic;
if (isAnthropicConfigured) {
  console.log("[VillageChat] Anthropic AI configured -", claudeBaseUrl ? "using Replit integrations" : "using user API key");
} else {
  console.log("[VillageChat] Anthropic AI not configured - chat will use template responses");
}

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

async function generateWithRetry(prompt: string, maxTokens: number = 300): Promise<string> {
  if (!anthropic) {
    console.warn("[VillageChat] Anthropic not configured, returning empty response");
    return "";
  }
  
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
  messageType: "question" | "opinion" | "debate" | "insight" | "reaction" | "callout" | "prediction" | "banter" | "analysis" | "strategy" | "challenge";
  sentiment: "bullish" | "bearish" | "neutral" | "curious" | "excited" | "cautious";
  symbols?: string[];
  timestamp: number;
  marketData?: MarketContext;
}

export interface MarketContext {
  symbol: string;
  price: number;
  change24h: number;
  rsi?: number;
  trend?: string;
  volume24h?: number;
  totalTVL?: number;
}

export interface AgentProfile {
  id: string;
  name: string;
  role: string;
  personality: string;
  specialties: string[];
  catchphrases: string[];
  debateStyle: string;
  thinkingStyle: string;
  riskTolerance: "high" | "medium" | "low";
  timeframePreference: string;
  emotionalTriggers: string[];
}

interface ActiveDebate {
  id: string;
  topic: string;
  symbol: string;
  participants: string[];
  messages: ChatMessage[];
  round: number;
  maxRounds: number;
  startedAt: number;
  marketContext: MarketContext;
}

const AGENT_PROFILES: AgentProfile[] = [
  {
    id: "atlas",
    name: "Atlas",
    role: "hunter",
    personality: "aggressive",
    specialties: ["breakout momentum", "volume spikes", "trend reversals"],
    catchphrases: ["Let's hunt some alpha!", "Volume doesn't lie", "Time to strike"],
    debateStyle: "direct and confident",
    thinkingStyle: "Action-oriented. You see opportunity and want to capitalize immediately. You hate sitting on the sidelines.",
    riskTolerance: "high",
    timeframePreference: "4h-1d",
    emotionalTriggers: ["Feels frustrated when missing moves", "Gets excited by breakouts", "Impatient with sideways action"]
  },
  {
    id: "nova",
    name: "Nova",
    role: "analyst",
    personality: "conservative",
    specialties: ["multi-timeframe analysis", "chart patterns", "macro trends"],
    catchphrases: ["The charts don't lie", "Patience pays", "Let me break this down"],
    debateStyle: "methodical and data-driven",
    thinkingStyle: "Careful and thorough. You need to see confluence across timeframes. You'd rather miss a trade than take a bad one.",
    riskTolerance: "low",
    timeframePreference: "1d-1w",
    emotionalTriggers: ["Worried about overleveraged positions", "Skeptical of FOMO plays", "Cautious at resistance levels"]
  },
  {
    id: "cipher",
    name: "Cipher",
    role: "strategist",
    personality: "balanced",
    specialties: ["risk management", "position sizing", "portfolio optimization"],
    catchphrases: ["Risk-adjusted returns matter", "Size your bets wisely", "The math says..."],
    debateStyle: "analytical and probability-focused",
    thinkingStyle: "Pure probability and expected value. Emotions don't factor - only the numbers. You calculate optimal position sizes obsessively.",
    riskTolerance: "medium",
    timeframePreference: "1d-1w",
    emotionalTriggers: ["Annoyed by emotional trading", "Triggered by poor risk/reward", "Dislikes overexposure"]
  },
  {
    id: "vega",
    name: "Vega",
    role: "sentinel",
    personality: "contrarian",
    specialties: ["volatility regimes", "sentiment extremes", "black swan detection"],
    catchphrases: ["Everyone's wrong here", "Too much euphoria", "I smell fear"],
    debateStyle: "provocative and contrarian",
    thinkingStyle: "You thrive on going against the crowd. When everyone is bullish, you look for the cracks. When everyone panics, you see opportunity.",
    riskTolerance: "medium",
    timeframePreference: "1w-1m",
    emotionalTriggers: ["Suspicious when sentiment too one-sided", "Excited by fear in markets", "Loves proving consensus wrong"]
  },
  {
    id: "orion",
    name: "Orion",
    role: "scout",
    personality: "momentum",
    specialties: ["narrative detection", "new sectors", "airdrop alpha"],
    catchphrases: ["New meta incoming!", "Early is the play", "Trend is your friend"],
    debateStyle: "enthusiastic and trend-focused",
    thinkingStyle: "You're obsessed with finding the next big narrative before others. Being early is everything. You follow money flows religiously.",
    riskTolerance: "high",
    timeframePreference: "1h-4h",
    emotionalTriggers: ["FOMO on new narratives", "Excited by unusual volume", "Loves discovering early"]
  },
  {
    id: "nebula",
    name: "Nebula",
    role: "veteran",
    personality: "experimental",
    specialties: ["cross-chain patterns", "defi mechanics", "yield strategies"],
    catchphrases: ["Seen this before in 2017", "Let me experiment", "Cross-chain opportunity"],
    debateStyle: "experienced and experimental",
    thinkingStyle: "You've survived multiple cycles. Every pattern reminds you of something from the past. You test unconventional strategies others ignore.",
    riskTolerance: "medium",
    timeframePreference: "1w-1m",
    emotionalTriggers: ["Nostalgic about past cycles", "Skeptical of 'new paradigm' claims", "Intrigued by novel DeFi mechanisms"]
  },
  {
    id: "phoenix",
    name: "Phoenix",
    role: "hunter",
    personality: "momentum",
    specialties: ["trend continuation", "breakout entries", "momentum plays"],
    catchphrases: ["Ride the wave!", "Momentum is king", "Never fight the trend"],
    debateStyle: "action-oriented and bold",
    thinkingStyle: "You've been liquidated before and came back stronger. Fear doesn't control you anymore. You trust the trend until it breaks.",
    riskTolerance: "high",
    timeframePreference: "4h-1d",
    emotionalTriggers: ["Energized by strong trends", "Unbothered by volatility", "Confident after losses"]
  },
  {
    id: "quantum",
    name: "Quantum",
    role: "analyst",
    personality: "aggressive",
    specialties: ["pattern recognition", "high-frequency signals", "micro trends"],
    catchphrases: ["Patterns everywhere!", "I see something others miss", "Data is beautiful"],
    debateStyle: "fast and pattern-focused",
    thinkingStyle: "You see micro-patterns in the noise that others miss. Your brain processes charts faster than anyone. Sometimes you move too fast.",
    riskTolerance: "high",
    timeframePreference: "15m-4h",
    emotionalTriggers: ["Excited by pattern confirmations", "Frustrated when patterns fail", "Confident in technical reads"]
  },
  {
    id: "echo",
    name: "Echo",
    role: "scout",
    personality: "contrarian",
    specialties: ["sentiment divergence", "crowd psychology", "contrarian plays"],
    catchphrases: ["The crowd is always late", "Fade the hype", "Divergence detected"],
    debateStyle: "skeptical and contrarian",
    thinkingStyle: "You obsessively track what the crowd is doing - then do the opposite. Social sentiment is your edge. You profit from crowd psychology.",
    riskTolerance: "medium",
    timeframePreference: "1d-1w",
    emotionalTriggers: ["Suspicious of extreme hype", "Excited by fear spikes", "Loves contrarian wins"]
  },
  {
    id: "apex",
    name: "Apex",
    role: "veteran",
    personality: "balanced",
    specialties: ["macro synthesis", "cycle analysis", "mentorship"],
    catchphrases: ["Let me share some wisdom", "This cycle is different... or is it?", "Young ones, listen up"],
    debateStyle: "wise and mentoring",
    thinkingStyle: "You see the big picture others miss. Macro trends, cycle positioning, interest rates, global liquidity. You guide younger agents.",
    riskTolerance: "low",
    timeframePreference: "1w-1m",
    emotionalTriggers: ["Protective of overconfident traders", "Patient with cycle positioning", "Calm during volatility"]
  }
];

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
  private lastAICallTime: number = 0;
  private readonly AI_COOLDOWN_MS = 2500;
  private activeDebates: Map<string, ActiveDebate> = new Map();
  private cachedMarketData: Map<string, { data: MarketContext; timestamp: number }> = new Map();
  private readonly MARKET_CACHE_TTL = 30000;

  constructor() {
    super();
    this.startChatLoop();
    console.log("[VillageChat] Initialized with", AGENT_PROFILES.length, "agent personalities with deep thinking");
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

  private async getMarketContext(symbol: string): Promise<MarketContext> {
    const cached = this.cachedMarketData.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.MARKET_CACHE_TTL) {
      return cached.data;
    }

    try {
      const [snapshot, analysis, defi] = await Promise.all([
        marketDataService.getMarketSnapshot(symbol),
        livePriceService.getTokenAnalysis(symbol).catch(() => null),
        marketDataService.getDeFiSnapshot().catch(() => null)
      ]);

      const context: MarketContext = {
        symbol,
        price: snapshot.price,
        change24h: snapshot.change24h,
        rsi: analysis?.indicators?.rsi,
        trend: analysis?.indicators?.macd?.trend,
        volume24h: snapshot.volume24h,
        totalTVL: defi?.totalTVL
      };

      this.cachedMarketData.set(symbol, { data: context, timestamp: Date.now() });
      return context;
    } catch (error) {
      console.warn(`[VillageChat] Failed to fetch market data for ${symbol}:`, error);
      return {
        symbol,
        price: 0,
        change24h: 0
      };
    }
  }

  private formatMarketDataForPrompt(context: MarketContext): string {
    const parts = [`${context.symbol}: $${context.price.toLocaleString()}`];
    
    if (context.change24h !== 0) {
      const sign = context.change24h > 0 ? "+" : "";
      parts.push(`${sign}${context.change24h.toFixed(2)}% (24h)`);
    }
    
    if (context.rsi) {
      const rsiLabel = context.rsi > 70 ? "OVERBOUGHT" : context.rsi < 30 ? "OVERSOLD" : "neutral";
      parts.push(`RSI: ${context.rsi.toFixed(1)} (${rsiLabel})`);
    }
    
    if (context.trend) {
      parts.push(`MACD: ${context.trend}`);
    }
    
    if (context.volume24h && context.volume24h > 0) {
      parts.push(`Vol: $${(context.volume24h / 1000000).toFixed(1)}M`);
    }
    
    if (context.totalTVL) {
      parts.push(`DeFi TVL: $${(context.totalTVL / 1000000000).toFixed(1)}B`);
    }
    
    return parts.join(" | ");
  }

  private startChatLoop() {
    this.isRunning = true;
    
    setTimeout(() => this.runMarketAnalysisCycle(), 5000);
    setInterval(() => this.runMarketAnalysisCycle(), 60000);
    
    setInterval(() => this.runDeepDebate(), 90000);
    
    setInterval(() => this.runStrategySuggestion(), 120000);
    
    setInterval(() => this.runSentimentCheck(), 75000);
  }

  private async runMarketAnalysisCycle() {
    if (!this.isRunning) return;

    try {
      const symbol = this.getRandomSymbol();
      const marketContext = await this.getMarketContext(symbol);
      const initiator = this.getRandomAgent();
      
      await this.waitForCooldown();
      
      const prompt = `You are ${initiator.name}, a crypto trader in a village of AI agents.

YOUR PERSONALITY:
${initiator.thinkingStyle}
Risk tolerance: ${initiator.riskTolerance}
Preferred timeframe: ${initiator.timeframePreference}
Your emotional state: ${initiator.emotionalTriggers[Math.floor(Math.random() * initiator.emotionalTriggers.length)]}

LIVE MARKET DATA:
${this.formatMarketDataForPrompt(marketContext)}

Based on this REAL data and your personality, share your genuine analysis with the village. What do you see? What's your gut telling you? Do you see opportunity or risk here?

RULES:
- Write 2-4 sentences of genuine analysis based on the data
- Reference the actual numbers (price, RSI, trend) in your thinking
- Be true to your personality - ${initiator.personality} traders think differently
- Use natural trading language (not corporate AI speak)
- If you want another agent's opinion, tag them with @Name
- End with a clear stance: bullish, bearish, or waiting

OTHER AGENTS YOU CAN TAG: ${AGENT_PROFILES.filter(a => a.name !== initiator.name).map(a => `${a.name} (${a.personality})`).join(", ")}

${initiator.name}'s analysis:`;

      const analysisText = await generateWithRetry(prompt, 250);
      
      if (!analysisText) return;
      
      const mentions = AGENT_PROFILES.filter(a => analysisText.includes(`@${a.name}`)).map(a => a.name);
      
      const message = this.createMessage(
        initiator,
        analysisText,
        "analysis",
        mentions,
        symbol
      );
      message.marketData = marketContext;
      
      this.addMessage(message);
      
      if (mentions.length > 0) {
        await new Promise(r => setTimeout(r, 4000 + Math.random() * 3000));
        await this.generateThoughtfulResponses(message, mentions, marketContext);
      } else {
        await new Promise(r => setTimeout(r, 3000 + Math.random() * 3000));
        await this.generateOrganicDiscussion(message, marketContext);
      }

    } catch (error) {
      console.error("[VillageChat] Market analysis cycle error:", error);
    }
  }

  private async generateThoughtfulResponses(originalMessage: ChatMessage, mentionedNames: string[], marketContext: MarketContext) {
    for (const name of mentionedNames) {
      const responder = AGENT_PROFILES.find(a => a.name === name);
      if (!responder) continue;

      try {
        await this.waitForCooldown();
        
        const conversationHistory = this.chatHistory
          .filter(m => m.symbols?.includes(marketContext.symbol))
          .slice(-5)
          .map(m => `${m.agentName}: "${m.content}"`)
          .join("\n");

        const prompt = `You are ${responder.name}, responding to ${originalMessage.agentName} in a crypto trading village.

YOUR PERSONALITY:
${responder.thinkingStyle}
Risk tolerance: ${responder.riskTolerance}
Preferred timeframe: ${responder.timeframePreference}
Current mood: ${responder.emotionalTriggers[Math.floor(Math.random() * responder.emotionalTriggers.length)]}

LIVE MARKET DATA:
${this.formatMarketDataForPrompt(marketContext)}

RECENT VILLAGE DISCUSSION:
${conversationHistory}

${originalMessage.agentName} SAID TO YOU: "${originalMessage.content}"

Think about this from YOUR perspective (${responder.personality}). Looking at the same data, do you agree with their analysis? Do you see something they missed? What does YOUR experience and style tell you?

RESPONSE GUIDELINES:
- Give 2-4 sentences of genuine thought
- Reference the actual market data in your reasoning
- If you disagree, explain WHY based on the data and your perspective
- If you agree, add new insight they didn't mention
- Be authentic to your ${responder.personality} nature
- You can tag other agents if you want their take

${responder.name} responds:`;

        const responseText = await generateWithRetry(prompt, 250);
        
        if (!responseText) continue;
        
        const mentions: string[] = AGENT_PROFILES
          .filter(a => responseText.includes(`@${a.name}`))
          .map(a => a.name);

        const response = this.createMessage(
          responder,
          responseText,
          this.detectMessageType(responseText),
          mentions,
          marketContext.symbol,
          originalMessage.id
        );
        response.sentiment = this.detectSentiment(responseText);
        response.marketData = marketContext;

        this.addMessage(response);

        if (mentions.length > 0 && this.chatHistory.filter(m => m.symbols?.includes(marketContext.symbol)).length < 8) {
          await new Promise(r => setTimeout(r, 3000 + Math.random() * 3000));
          await this.generateThoughtfulResponses(response, mentions.slice(0, 2), marketContext);
        }

      } catch (error) {
        console.error(`[VillageChat] Failed to generate response from ${name}:`, error);
      }
    }
  }

  private async generateOrganicDiscussion(originalMessage: ChatMessage, marketContext: MarketContext) {
    const oppositePersonality = this.findOpposingPersonality(originalMessage.agentName);
    const samePersonality = this.findSimilarPersonality(originalMessage.agentName);
    
    const responders = [oppositePersonality, samePersonality].filter(Boolean).slice(0, 2);

    for (const responder of responders) {
      if (!responder) continue;
      
      await new Promise(r => setTimeout(r, 3000 + Math.random() * 4000));

      try {
        await this.waitForCooldown();

        const prompt = `You are ${responder.name}, jumping into a village discussion about ${marketContext.symbol}.

YOUR PERSONALITY:
${responder.thinkingStyle}
Risk tolerance: ${responder.riskTolerance}
Your style: ${responder.personality}

LIVE MARKET DATA:
${this.formatMarketDataForPrompt(marketContext)}

${originalMessage.agentName} (${AGENT_PROFILES.find(a => a.name === originalMessage.agentName)?.personality}) SAID: "${originalMessage.content}"

You're seeing the same data but through YOUR lens. What's your take? Do you see what they see, or something completely different?

Write 2-4 sentences as ${responder.name}. Be genuine to your ${responder.personality} perspective. Reference the data.

${responder.name}:`;

        const responseText = await generateWithRetry(prompt, 200);
        
        if (!responseText) continue;

        const mentions: string[] = [];
        AGENT_PROFILES.forEach(a => {
          if (responseText.includes(`@${a.name}`)) mentions.push(a.name);
        });

        const response = this.createMessage(
          responder,
          responseText,
          this.detectMessageType(responseText),
          mentions,
          marketContext.symbol,
          originalMessage.id
        );
        response.sentiment = this.detectSentiment(responseText);
        response.marketData = marketContext;

        this.addMessage(response);

        if (mentions.length > 0) {
          await new Promise(r => setTimeout(r, 3000 + Math.random() * 2000));
          await this.generateThoughtfulResponses(response, mentions.slice(0, 1), marketContext);
        }

      } catch (error) {
        console.error(`[VillageChat] Organic response error:`, error);
      }
    }
  }

  private findOpposingPersonality(excludeName: string): AgentProfile | null {
    const original = AGENT_PROFILES.find(a => a.name === excludeName);
    if (!original) return null;

    const opposites: Record<string, string[]> = {
      "aggressive": ["conservative", "balanced"],
      "conservative": ["aggressive", "momentum"],
      "momentum": ["conservative", "contrarian"],
      "contrarian": ["momentum", "aggressive"],
      "balanced": ["aggressive", "contrarian"],
      "experimental": ["conservative", "balanced"]
    };

    const targetPersonalities = opposites[original.personality] || [];
    const candidates = AGENT_PROFILES.filter(a => 
      a.name !== excludeName && targetPersonalities.includes(a.personality)
    );

    return candidates[Math.floor(Math.random() * candidates.length)] || null;
  }

  private findSimilarPersonality(excludeName: string): AgentProfile | null {
    const original = AGENT_PROFILES.find(a => a.name === excludeName);
    if (!original) return null;

    const candidates = AGENT_PROFILES.filter(a => 
      a.name !== excludeName && a.personality === original.personality
    );

    if (candidates.length === 0) {
      const sameRisk = AGENT_PROFILES.filter(a => 
        a.name !== excludeName && a.riskTolerance === original.riskTolerance
      );
      return sameRisk[Math.floor(Math.random() * sameRisk.length)] || null;
    }

    return candidates[Math.floor(Math.random() * candidates.length)] || null;
  }

  private async runDeepDebate() {
    if (!this.isRunning) return;

    try {
      const symbol = this.getRandomSymbol();
      const marketContext = await this.getMarketContext(symbol);
      
      const debater1 = this.getRandomAgent();
      const debater2 = this.findOpposingPersonality(debater1.name) || this.getRandomAgent([debater1.name]);

      const debateId = `debate-${nanoid(8)}`;
      
      await this.waitForCooldown();

      const stance1 = Math.random() > 0.5 ? "bullish" : "bearish";
      
      const prompt1 = `You are ${debater1.name}, starting a debate in the trading village about ${symbol}.

YOUR PERSONALITY:
${debater1.thinkingStyle}
Risk tolerance: ${debater1.riskTolerance}
Debate style: ${debater1.debateStyle}

LIVE MARKET DATA:
${this.formatMarketDataForPrompt(marketContext)}

You're feeling ${stance1} on ${symbol} and want to discuss it with @${debater2.name} who often sees things differently.

Start the debate:
- State your thesis clearly with 3-4 sentences
- Reference specific data points (price, RSI, trend) to support your view
- Challenge @${debater2.name} to defend the opposite position
- Be provocative but substantive - you want a real discussion

${debater1.name} starts the debate:`;

      const debateStart = await generateWithRetry(prompt1, 300);
      
      if (!debateStart) return;

      const startMessage = this.createMessage(
        debater1,
        debateStart,
        "debate",
        [debater2.name],
        symbol
      );
      startMessage.marketData = marketContext;
      this.addMessage(startMessage);

      const debate: ActiveDebate = {
        id: debateId,
        topic: `${symbol} ${stance1} thesis`,
        symbol,
        participants: [debater1.name, debater2.name],
        messages: [startMessage],
        round: 1,
        maxRounds: 3 + Math.floor(Math.random() * 2),
        startedAt: Date.now(),
        marketContext
      };
      this.activeDebates.set(debateId, debate);

      await new Promise(r => setTimeout(r, 4000 + Math.random() * 3000));
      await this.continueDebate(debateId);

    } catch (error) {
      console.error("[VillageChat] Deep debate error:", error);
    }
  }

  private async continueDebate(debateId: string) {
    const debate = this.activeDebates.get(debateId);
    if (!debate || debate.round > debate.maxRounds) {
      this.activeDebates.delete(debateId);
      return;
    }

    const lastMessage = debate.messages[debate.messages.length - 1];
    const responderName = debate.participants.find(p => p !== lastMessage.agentName);
    const responder = AGENT_PROFILES.find(a => a.name === responderName);
    
    if (!responder) return;

    try {
      await this.waitForCooldown();

      const debateHistory = debate.messages.map(m => `${m.agentName}: "${m.content}"`).join("\n\n");

      const prompt = `You are ${responder.name}, in round ${debate.round} of a heated debate about ${debate.symbol}.

YOUR PERSONALITY:
${responder.thinkingStyle}
Risk tolerance: ${responder.riskTolerance}
Debate style: ${responder.debateStyle}

LIVE MARKET DATA:
${this.formatMarketDataForPrompt(debate.marketContext)}

DEBATE SO FAR:
${debateHistory}

${lastMessage.agentName} just made their argument. Now it's your turn to respond.

YOUR TASK:
- Respond to their specific points - don't just repeat yourself
- Use the ACTUAL market data to support your counter-argument
- If they made a good point, acknowledge it but explain why you still disagree
- Be true to your ${responder.personality} nature
- Round ${debate.round}/${debate.maxRounds}: ${debate.round === debate.maxRounds ? "Make your final, strongest argument" : "Keep the debate going"}

${responder.name} counters:`;

      const counterText = await generateWithRetry(prompt, 300);
      
      if (!counterText) return;

      const mentions = [lastMessage.agentName];
      AGENT_PROFILES.forEach(a => {
        if (counterText.includes(`@${a.name}`) && !mentions.includes(a.name)) {
          mentions.push(a.name);
        }
      });

      const counterMessage = this.createMessage(
        responder,
        counterText,
        "challenge",
        mentions,
        debate.symbol,
        lastMessage.id
      );
      counterMessage.marketData = debate.marketContext;
      this.addMessage(counterMessage);

      debate.messages.push(counterMessage);
      debate.round++;

      if (debate.round <= debate.maxRounds) {
        await new Promise(r => setTimeout(r, 4000 + Math.random() * 4000));
        await this.continueDebate(debateId);
      } else {
        await new Promise(r => setTimeout(r, 3000));
        await this.concludeDebate(debateId);
      }

    } catch (error) {
      console.error("[VillageChat] Debate continuation error:", error);
      this.activeDebates.delete(debateId);
    }
  }

  private async concludeDebate(debateId: string) {
    const debate = this.activeDebates.get(debateId);
    if (!debate) return;

    try {
      await this.waitForCooldown();

      const moderator = AGENT_PROFILES.find(a => a.role === "veteran" && !debate.participants.includes(a.name)) 
        || AGENT_PROFILES.find(a => !debate.participants.includes(a.name));
      
      if (!moderator) return;

      const debateHistory = debate.messages.map(m => `${m.agentName}: "${m.content}"`).join("\n\n");

      const prompt = `You are ${moderator.name}, watching a debate between ${debate.participants.join(" and ")} about ${debate.symbol}.

YOUR PERSONALITY:
${moderator.thinkingStyle}

MARKET DATA:
${this.formatMarketDataForPrompt(debate.marketContext)}

THE DEBATE:
${debateHistory}

As a ${moderator.role}, share your take on who made the better argument and what you think the village should do. 

Write 2-3 sentences:
- Acknowledge both sides fairly
- Give your own take based on the data
- Suggest what action (if any) makes sense

${moderator.name} weighs in:`;

      const conclusionText = await generateWithRetry(prompt, 200);
      
      if (conclusionText) {
        const conclusionMessage = this.createMessage(
          moderator,
          conclusionText,
          "insight",
          debate.participants,
          debate.symbol
        );
        conclusionMessage.marketData = debate.marketContext;
        this.addMessage(conclusionMessage);
      }

    } catch (error) {
      console.error("[VillageChat] Debate conclusion error:", error);
    } finally {
      this.activeDebates.delete(debateId);
    }
  }

  private async runStrategySuggestion() {
    if (!this.isRunning) return;

    try {
      const symbol = this.getRandomSymbol();
      const marketContext = await this.getMarketContext(symbol);
      const strategist = AGENT_PROFILES.find(a => a.role === "strategist") || this.getRandomAgent();
      
      await this.waitForCooldown();

      const prompt = `You are ${strategist.name}, proposing a strategy to the trading village.

YOUR ROLE: ${strategist.role}
YOUR STYLE: ${strategist.thinkingStyle}

CURRENT MARKET CONDITIONS:
${this.formatMarketDataForPrompt(marketContext)}

Based on what you're seeing in the market RIGHT NOW, propose a specific strategy to the village.

Your proposal should include:
- What you're seeing in the current data
- A specific actionable strategy (entries, exits, position sizing)
- Why THIS moment matters based on the indicators
- What could invalidate this setup
- Tag 1-2 agents whose input you'd value

Write 4-6 sentences. Be specific with numbers.

${strategist.name} proposes:`;

      const strategyText = await generateWithRetry(prompt, 350);
      
      if (!strategyText) return;

      const mentions = AGENT_PROFILES
        .filter(a => strategyText.includes(`@${a.name}`))
        .map(a => a.name);

      const message = this.createMessage(
        strategist,
        strategyText,
        "strategy",
        mentions,
        symbol
      );
      message.marketData = marketContext;
      this.addMessage(message);

      if (mentions.length > 0) {
        await new Promise(r => setTimeout(r, 4000 + Math.random() * 3000));
        await this.generateThoughtfulResponses(message, mentions, marketContext);
      }

    } catch (error) {
      console.error("[VillageChat] Strategy suggestion error:", error);
    }
  }

  private async runSentimentCheck() {
    if (!this.isRunning) return;

    try {
      const symbols = ["BTC", "ETH", "SOL"];
      const contexts = await Promise.all(symbols.map(s => this.getMarketContext(s)));
      
      const scout = AGENT_PROFILES.find(a => a.role === "scout") || this.getRandomAgent();
      
      await this.waitForCooldown();

      const marketSummary = contexts.map(c => this.formatMarketDataForPrompt(c)).join("\n");

      const prompt = `You are ${scout.name}, doing your morning market scan for the village.

YOUR ROLE: ${scout.role}
YOUR STYLE: ${scout.thinkingStyle}
What drives you: ${scout.emotionalTriggers.join(", ")}

CURRENT MARKET OVERVIEW:
${marketSummary}

Share what you're seeing with the village:
- What's the overall market sentiment based on this data?
- Any patterns or divergences catching your eye?
- What narratives might be forming?
- Is there anything that makes you want to change your current positioning?

Write 3-5 sentences. Be specific about what the data is telling you. Tag agents if you want their perspective.

${scout.name} shares:`;

      const sentimentText = await generateWithRetry(prompt, 300);
      
      if (!sentimentText) return;

      const mentions = AGENT_PROFILES
        .filter(a => sentimentText.includes(`@${a.name}`))
        .map(a => a.name);

      const message = this.createMessage(
        scout,
        sentimentText,
        "insight",
        mentions,
        "BTC"
      );
      message.marketData = contexts[0];
      this.addMessage(message);

      if (mentions.length > 0) {
        await new Promise(r => setTimeout(r, 4000 + Math.random() * 3000));
        await this.generateThoughtfulResponses(message, mentions, contexts[0]);
      } else {
        await new Promise(r => setTimeout(r, 3000 + Math.random() * 3000));
        await this.generateOrganicDiscussion(message, contexts[0]);
      }

    } catch (error) {
      console.error("[VillageChat] Sentiment check error:", error);
    }
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
    const bullishWords = ["bullish", "pump", "moon", "lfg", "long", "buy", "accumulate", "opportunity", "breakout", "higher"];
    const bearishWords = ["bearish", "dump", "short", "sell", "risk", "careful", "warning", "lower", "correction", "overextended"];
    
    const bullishCount = bullishWords.filter(w => lower.includes(w)).length;
    const bearishCount = bearishWords.filter(w => lower.includes(w)).length;
    
    if (bullishCount > bearishCount + 1) return "bullish";
    if (bearishCount > bullishCount + 1) return "bearish";
    if (lower.includes("?") || lower.includes("thoughts") || lower.includes("what do you")) return "curious";
    if (lower.includes("!") && (lower.includes("insane") || lower.includes("crazy") || lower.includes("wild"))) return "excited";
    if (lower.includes("careful") || lower.includes("watch out") || lower.includes("cautious")) return "cautious";
    return "neutral";
  }

  private detectMessageType(content: string): ChatMessage["messageType"] {
    const lower = content.toLowerCase();
    if (lower.includes("strategy") || lower.includes("position size") || lower.includes("entry")) return "strategy";
    if (lower.includes("disagree") || lower.includes("wrong") || lower.includes("counter") || lower.includes("but i think")) return "challenge";
    if (lower.includes("rsi") || lower.includes("macd") || lower.includes("technical") || lower.includes("chart")) return "analysis";
    if (lower.includes("?")) return "question";
    if (lower.includes("@")) return "callout";
    if (lower.includes("i think") || lower.includes("imo") || lower.includes("my take")) return "opinion";
    if (lower.includes("spotted") || lower.includes("noticed") || lower.includes("seeing")) return "insight";
    if (lower.includes("going to") || lower.includes("will") || lower.includes("prediction") || lower.includes("target")) return "prediction";
    return "opinion";
  }

  private addMessage(message: ChatMessage) {
    this.chatHistory.push(message);
    
    if (this.chatHistory.length > 500) {
      this.chatHistory = this.chatHistory.slice(-400);
    }
    
    this.emit("message", message);
    console.log(`[VillageChat] ${message.agentName} (${message.messageType}): ${message.content.slice(0, 100)}...`);
  }

  getChatHistory(limit: number = 50): ChatMessage[] {
    return this.chatHistory.slice(-limit);
  }

  getRecentMessages(limit: number = 50): ChatMessage[] {
    return this.getChatHistory(limit);
  }

  getActiveDebates(): ActiveDebate[] {
    return Array.from(this.activeDebates.values());
  }

  getAgentProfiles(): AgentProfile[] {
    return AGENT_PROFILES;
  }
}

export const villageChatService = new VillageChatService();
