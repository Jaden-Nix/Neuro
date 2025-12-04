import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import pLimit from "p-limit";
import pRetry, { AbortError } from "p-retry";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

const claudeLimit = pLimit(2);
const geminiLimit = pLimit(2);

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

export type AIProvider = "claude" | "gemini" | "hybrid";

export interface HybridAIConfig {
  primaryProvider: AIProvider;
  fallbackProvider: AIProvider;
  scoutProvider: AIProvider;
  riskProvider: AIProvider;
  executionProvider: AIProvider;
  metaProvider: AIProvider;
}

const defaultConfig: HybridAIConfig = {
  primaryProvider: "hybrid",
  fallbackProvider: "claude",
  scoutProvider: "gemini",
  riskProvider: "claude",
  executionProvider: "gemini",
  metaProvider: "claude",
};

export class HybridAIService {
  private config: HybridAIConfig;
  private isClaudeConfigured: boolean;
  private isGeminiConfigured: boolean;

  constructor(config: Partial<HybridAIConfig> = {}) {
    this.config = { ...defaultConfig, ...config };
    
    this.isClaudeConfigured = !!(
      process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY &&
      process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL
    );
    
    this.isGeminiConfigured = !!(
      process.env.AI_INTEGRATIONS_GEMINI_API_KEY &&
      process.env.AI_INTEGRATIONS_GEMINI_BASE_URL
    );
    
    console.log(`[HybridAI] Initialized - Claude: ${this.isClaudeConfigured ? 'ready' : 'not configured'}, Gemini: ${this.isGeminiConfigured ? 'ready' : 'not configured'}`);
  }

  async queryWithClaude(systemPrompt: string, userPrompt: string, maxTokens: number = 2048): Promise<string> {
    if (!this.isClaudeConfigured) {
      throw new Error("Claude not configured");
    }

    return claudeLimit(() =>
      pRetry(
        async () => {
          try {
            const message = await anthropic.messages.create({
              model: "claude-sonnet-4-5",
              max_tokens: maxTokens,
              system: systemPrompt,
              messages: [{ role: "user", content: userPrompt }],
            });

            const content = message.content[0];
            if (content.type === "text") {
              return content.text;
            }
            throw new Error("Unexpected response type");
          } catch (error: any) {
            if (isRateLimitError(error)) {
              throw error;
            }
            throw new AbortError(error);
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

  async queryWithGemini(prompt: string, maxTokens: number = 2048): Promise<string> {
    if (!this.isGeminiConfigured) {
      throw new Error("Gemini not configured");
    }

    return geminiLimit(() =>
      pRetry(
        async () => {
          try {
            const response = await gemini.models.generateContent({
              model: "gemini-2.5-flash",
              contents: prompt,
              config: {
                maxOutputTokens: maxTokens,
              },
            });
            return response.text || "";
          } catch (error: any) {
            if (isRateLimitError(error)) {
              throw error;
            }
            throw new AbortError(error);
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

  async query(
    agentType: "scout" | "risk" | "execution" | "meta" | "general",
    systemPrompt: string,
    userPrompt: string,
    maxTokens: number = 2048
  ): Promise<{ response: string; provider: AIProvider }> {
    let provider: AIProvider;
    
    switch (agentType) {
      case "scout":
        provider = this.config.scoutProvider;
        break;
      case "risk":
        provider = this.config.riskProvider;
        break;
      case "execution":
        provider = this.config.executionProvider;
        break;
      case "meta":
        provider = this.config.metaProvider;
        break;
      default:
        provider = this.config.primaryProvider;
    }

    if (provider === "hybrid") {
      provider = agentType === "scout" || agentType === "execution" ? "gemini" : "claude";
    }

    const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;

    try {
      if (provider === "gemini" && this.isGeminiConfigured) {
        const response = await this.queryWithGemini(fullPrompt, maxTokens);
        return { response, provider: "gemini" };
      } else if (provider === "claude" && this.isClaudeConfigured) {
        const response = await this.queryWithClaude(systemPrompt, userPrompt, maxTokens);
        return { response, provider: "claude" };
      } else if (this.isGeminiConfigured) {
        const response = await this.queryWithGemini(fullPrompt, maxTokens);
        return { response, provider: "gemini" };
      } else if (this.isClaudeConfigured) {
        const response = await this.queryWithClaude(systemPrompt, userPrompt, maxTokens);
        return { response, provider: "claude" };
      } else {
        throw new Error("No AI providers configured");
      }
    } catch (error) {
      console.error(`[HybridAI] ${provider} failed, trying fallback...`, error);
      
      const fallbackProvider = provider === "gemini" ? "claude" : "gemini";
      
      try {
        if (fallbackProvider === "gemini" && this.isGeminiConfigured) {
          const response = await this.queryWithGemini(fullPrompt, maxTokens);
          return { response, provider: "gemini" };
        } else if (fallbackProvider === "claude" && this.isClaudeConfigured) {
          const response = await this.queryWithClaude(systemPrompt, userPrompt, maxTokens);
          return { response, provider: "claude" };
        }
      } catch (fallbackError) {
        console.error(`[HybridAI] Fallback also failed:`, fallbackError);
      }
      
      throw error;
    }
  }

  async scoutAnalysis(marketData: any): Promise<{ decision: any; provider: AIProvider }> {
    const systemPrompt = `You are SCOUT, an elite DeFi opportunity scanner. Analyze market data and identify profitable opportunities.

RESPOND WITH VALID JSON ONLY:
{
  "opportunityType": "arbitrage|yield|momentum|accumulation|breakout|none",
  "description": "Clear actionable description",
  "confidence": 0-100,
  "expectedReturn": number,
  "risk": "low|medium|high",
  "timeframe": "minutes|hours|days",
  "action": "BUY|SELL|HOLD|STAKE",
  "reasoning": "Detailed analysis",
  "signals": ["signal1", "signal2"],
  "entryPrice": number,
  "stopLoss": number,
  "takeProfit": number
}`;

    const userPrompt = `Analyze this market data and provide a trading signal:
${JSON.stringify(marketData, null, 2)}`;

    const { response, provider } = await this.query("scout", systemPrompt, userPrompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { decision: JSON.parse(jsonMatch[0]), provider };
      }
    } catch (e) {
      console.error("[HybridAI] Failed to parse scout response:", e);
    }
    
    return {
      decision: {
        opportunityType: "none",
        description: "Analysis in progress",
        confidence: 50,
        action: "HOLD",
        reasoning: response,
      },
      provider,
    };
  }

  async riskAssessment(opportunity: any, marketData: any): Promise<{ decision: any; provider: AIProvider }> {
    const systemPrompt = `You are RISK, the vigilant guardian of capital. Assess risks thoroughly.

RESPOND WITH VALID JSON ONLY:
{
  "riskScore": 0-100,
  "shouldVeto": boolean,
  "vetoReason": "reason if vetoing",
  "riskFactors": ["risk1", "risk2"],
  "potentialLoss": number,
  "mitigations": ["mitigation1", "mitigation2"],
  "reasoning": "Detailed risk analysis",
  "safePositionSize": number
}`;

    const userPrompt = `Assess the risk of this opportunity:
Opportunity: ${JSON.stringify(opportunity, null, 2)}
Market Data: ${JSON.stringify(marketData, null, 2)}`;

    const { response, provider } = await this.query("risk", systemPrompt, userPrompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { decision: JSON.parse(jsonMatch[0]), provider };
      }
    } catch (e) {
      console.error("[HybridAI] Failed to parse risk response:", e);
    }
    
    return {
      decision: {
        riskScore: 50,
        shouldVeto: false,
        riskFactors: ["Analysis pending"],
        reasoning: response,
      },
      provider,
    };
  }

  async executionPlanning(opportunity: any, riskAssessment: any): Promise<{ decision: any; provider: AIProvider }> {
    const systemPrompt = `You are EXECUTION, the precision transaction architect. Plan optimal execution.

RESPOND WITH VALID JSON ONLY:
{
  "feasible": boolean,
  "executionPlan": [{"step": 1, "action": "description", "estimatedGas": number}],
  "totalGasEstimate": number,
  "expectedSlippage": number,
  "successProbability": 0-100,
  "timing": "immediate|wait_for_gas|scheduled",
  "warnings": ["warning1"],
  "reasoning": "Detailed execution analysis"
}`;

    const userPrompt = `Plan execution for:
Opportunity: ${JSON.stringify(opportunity, null, 2)}
Risk Assessment: ${JSON.stringify(riskAssessment, null, 2)}`;

    const { response, provider } = await this.query("execution", systemPrompt, userPrompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { decision: JSON.parse(jsonMatch[0]), provider };
      }
    } catch (e) {
      console.error("[HybridAI] Failed to parse execution response:", e);
    }
    
    return {
      decision: {
        feasible: false,
        successProbability: 30,
        warnings: ["Analysis pending"],
        reasoning: response,
      },
      provider,
    };
  }

  async metaDecision(
    scoutDecision: any,
    riskDecision: any,
    executionDecision: any,
    marketData: any
  ): Promise<{ decision: any; provider: AIProvider }> {
    const systemPrompt = `You are META, the sovereign orchestrator. Make the final strategic decision.

RESPOND WITH VALID JSON ONLY:
{
  "finalDecision": "EXECUTE|HOLD|ABORT|MODIFY",
  "approved": boolean,
  "confidence": 0-100,
  "reasoning": "Strategic reasoning integrating all inputs",
  "modifications": {"key": "value"},
  "priority": "critical|high|medium|low",
  "portfolioImpact": "description",
  "nextActions": ["action1", "action2"],
  "tradingCall": {
    "symbol": "BTC/USD",
    "direction": "long|short",
    "entry": number,
    "stopLoss": number,
    "takeProfit1": number,
    "takeProfit2": number,
    "leverage": number,
    "size": "percentage of portfolio"
  }
}`;

    const userPrompt = `Make final decision based on:
Scout Analysis: ${JSON.stringify(scoutDecision, null, 2)}
Risk Assessment: ${JSON.stringify(riskDecision, null, 2)}
Execution Plan: ${JSON.stringify(executionDecision, null, 2)}
Market Data: ${JSON.stringify(marketData, null, 2)}`;

    const { response, provider } = await this.query("meta", systemPrompt, userPrompt);
    
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return { decision: JSON.parse(jsonMatch[0]), provider };
      }
    } catch (e) {
      console.error("[HybridAI] Failed to parse meta response:", e);
    }
    
    return {
      decision: {
        finalDecision: "HOLD",
        approved: false,
        confidence: 50,
        reasoning: response,
        priority: "low",
      },
      provider,
    };
  }

  async generateTradingSignal(symbol: string, marketData: any): Promise<{
    hasSignal: boolean;
    direction: "long" | "short";
    entry: number;
    stopLoss: number;
    takeProfit1: number;
    takeProfit2: number;
    takeProfit3: number;
    confidence: number;
    reasoning: string;
    provider: AIProvider;
  } | null> {
    const systemPrompt = `You are an expert trading signal generator. Analyze market data and provide actionable trading signals.

RESPOND WITH VALID JSON ONLY:
{
  "hasSignal": boolean,
  "direction": "long|short",
  "entry": number,
  "stopLoss": number,
  "takeProfit1": number,
  "takeProfit2": number,
  "takeProfit3": number,
  "confidence": 0-100,
  "reasoning": "Detailed trading rationale",
  "patterns": ["pattern1", "pattern2"],
  "indicators": {"rsi": number, "macd": "bullish|bearish", "trend": "up|down|sideways"}
}`;

    const userPrompt = `Generate a trading signal for ${symbol}:
${JSON.stringify(marketData, null, 2)}

Provide a clear BUY or SELL signal with entry, stop loss, and take profit levels.`;

    try {
      const { response, provider } = await this.query("scout", systemPrompt, userPrompt);
      
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return { ...parsed, provider };
      }
    } catch (e) {
      console.error("[HybridAI] Failed to generate trading signal:", e);
    }
    
    return null;
  }

  getStatus(): { claude: boolean; gemini: boolean; mode: string } {
    return {
      claude: this.isClaudeConfigured,
      gemini: this.isGeminiConfigured,
      mode: this.isClaudeConfigured && this.isGeminiConfigured ? "hybrid" : 
            this.isClaudeConfigured ? "claude-only" : 
            this.isGeminiConfigured ? "gemini-only" : "none",
    };
  }
}

export const hybridAI = new HybridAIService();
