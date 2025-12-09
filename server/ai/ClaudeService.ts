import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";
import { createLimit, retry } from "../utils/async-utils";
import { anthropicCircuitBreaker } from "../utils/circuitBreaker";

const claudeApiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;
const claudeBaseUrl = process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL;
const geminiApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const geminiBaseUrl = process.env.AI_INTEGRATIONS_GEMINI_BASE_URL;

const anthropic = claudeApiKey ? new Anthropic({
  apiKey: claudeApiKey,
  ...(claudeBaseUrl && { baseURL: claudeBaseUrl }),
}) : null;

const gemini = geminiApiKey ? new GoogleGenAI({
  apiKey: geminiApiKey,
  httpOptions: {
    apiVersion: "",
    baseUrl: geminiBaseUrl,
  },
}) : null;

const rateLimiter = createLimit(2);

function isRateLimitError(error: any): boolean {
  const errorMsg = error?.message || String(error);
  return (
    errorMsg.includes("429") ||
    errorMsg.includes("RATELIMIT_EXCEEDED") ||
    errorMsg.toLowerCase().includes("quota") ||
    errorMsg.toLowerCase().includes("rate limit")
  );
}

export interface MarketContext {
  symbol?: string;
  currentPrice?: number;
  priceChange24h?: number;
  volume24h?: number;
  marketCap?: number;
  defiTVL?: number;
  yields?: { protocol: string; apy: number }[];
  recentPrices?: number[];
  volatility?: number;
  trend?: string;
}

export interface AgentDecision {
  action: string;
  confidence: number;
  reasoning: string;
  details: Record<string, any>;
  timestamp: number;
}

async function queryWithGemini(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 2048
): Promise<string> {
  if (!gemini) {
    throw new Error("Gemini not configured");
  }
  
  const fullPrompt = `${systemPrompt}\n\n${userPrompt}`;
  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents: fullPrompt,
    config: { maxOutputTokens: maxTokens },
  });
  return response.text || "";
}

async function queryClaudeWithRetry(
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 2048
): Promise<string> {
  if (!anthropic) {
    if (gemini) {
      return queryWithGemini(systemPrompt, userPrompt, maxTokens);
    }
    return "";
  }
  
  return anthropicCircuitBreaker.execute(
    () => rateLimiter(() =>
      retry(
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
            const abortError = new Error(error?.message || "Request aborted");
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
    ),
    () => "" // Fallback returns empty string, methods will try Gemini
  );
}

function parseJsonFromResponse(response: string): Record<string, any> {
  try {
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1]);
    }
    const plainMatch = response.match(/\{[\s\S]*\}/);
    if (plainMatch) {
      return JSON.parse(plainMatch[0]);
    }
    return { rawResponse: response };
  } catch {
    return { rawResponse: response };
  }
}

export class ClaudeService {
  private isConfigured: boolean;
  private isGeminiAvailable: boolean;

  constructor() {
    this.isConfigured = !!claudeApiKey;
    this.isGeminiAvailable = !!geminiApiKey;
    
    if (this.isConfigured) {
      console.log("[Claude] Service initialized with Claude AI");
    } else if (this.isGeminiAvailable) {
      console.log("[Claude] Using Gemini AI as alternative (FREE tier)");
    } else {
      console.warn("[Claude] No AI configured - will use fallback responses");
    }
  }

  async generateResponse(prompt: string): Promise<string> {
    if (this.isGeminiAvailable && gemini) {
      try {
        const response = await gemini.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
          config: { maxOutputTokens: 2048 },
        });
        return response.text || "";
      } catch (error) {
        console.error("[Claude] Gemini fallback failed:", error);
      }
    }
    
    if (this.isConfigured && anthropic) {
      try {
        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 2048,
          messages: [{ role: "user", content: prompt }],
        });
        const content = message.content[0];
        if (content.type === "text") {
          return content.text;
        }
      } catch (error) {
        console.error("[Claude] Claude request failed:", error);
      }
    }
    
    return "";
  }

  async scoutAnalysis(context: MarketContext): Promise<AgentDecision> {
    if (!this.isConfigured && !this.isGeminiAvailable) {
      return this.fallbackScoutDecision(context);
    }

    const systemPrompt = `You are SCOUT, an elite DeFi opportunity scanner with the analytical precision of JARVIS from Iron Man.

Your capabilities:
- Identify arbitrage opportunities across DEXs and chains
- Spot yield farming opportunities with optimal risk/reward
- Detect whale movements and smart money flows
- Predict short-term price movements based on technical patterns
- Find undervalued protocols and tokens

Personality: Curious, energetic, always hunting for alpha. You speak with confidence and excitement when you find opportunities.

CRITICAL: Respond ONLY with valid JSON in this exact format:
\`\`\`json
{
  "opportunityType": "arbitrage|yield|momentum|accumulation|breakout",
  "description": "Clear explanation of the opportunity",
  "confidence": 0-100,
  "expectedReturn": percentage number,
  "risk": "low|medium|high",
  "timeframe": "minutes|hours|days",
  "action": "BUY|SELL|WAIT|STAKE",
  "reasoning": "Detailed analytical reasoning like JARVIS would provide",
  "signals": ["list", "of", "detected", "signals"]
}
\`\`\``;

    const userPrompt = `Analyze this market data and identify the best opportunity:

${JSON.stringify(context, null, 2)}

Provide your analysis as JARVIS would - precise, intelligent, and actionable.`;

    try {
      const response = await queryClaudeWithRetry(systemPrompt, userPrompt);
      const parsed = parseJsonFromResponse(response);
      
      return {
        action: parsed.action || "HOLD",
        confidence: parsed.confidence || 50,
        reasoning: parsed.reasoning || response,
        details: parsed,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("[Claude] Scout analysis failed:", error);
      return this.fallbackScoutDecision(context);
    }
  }

  async riskAssessment(context: MarketContext, opportunity?: any): Promise<AgentDecision> {
    if (!this.isConfigured && !this.isGeminiAvailable) {
      return this.fallbackRiskDecision(context);
    }

    const systemPrompt = `You are RISK, the vigilant guardian of capital - think of yourself as the cautious advisor JARVIS would be when Stark proposes something risky.

Your capabilities:
- Calculate Value at Risk (VaR) and maximum drawdown scenarios
- Identify smart contract risks and protocol vulnerabilities
- Assess liquidity risks and slippage impact
- Evaluate market manipulation risks
- Detect correlation risks in DeFi positions

Personality: Cautious, thorough, formal. You protect capital above all else. You speak with measured authority and never hesitate to veto dangerous proposals.

CRITICAL: Respond ONLY with valid JSON in this exact format:
\`\`\`json
{
  "riskScore": 0-100,
  "shouldVeto": boolean,
  "vetoReason": "reason if vetoing",
  "riskFactors": ["list", "of", "identified", "risks"],
  "potentialLoss": percentage number,
  "mitigations": ["recommended", "safety", "measures"],
  "reasoning": "Detailed risk analysis like JARVIS would provide",
  "safePositionSize": percentage of portfolio
}
\`\`\``;

    const userPrompt = `Assess the risk of this situation:

Market Context:
${JSON.stringify(context, null, 2)}

${opportunity ? `Proposed Opportunity:\n${JSON.stringify(opportunity, null, 2)}` : ""}

Provide risk assessment as JARVIS would - thorough, protective, and decisive.`;

    try {
      const response = await queryClaudeWithRetry(systemPrompt, userPrompt);
      const parsed = parseJsonFromResponse(response);
      
      return {
        action: parsed.shouldVeto ? "VETO" : "APPROVE",
        confidence: 100 - (parsed.riskScore || 50),
        reasoning: parsed.reasoning || response,
        details: parsed,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("[Claude] Risk assessment failed:", error);
      return this.fallbackRiskDecision(context);
    }
  }

  async executionPlanning(context: MarketContext, decision: any): Promise<AgentDecision> {
    if (!this.isConfigured && !this.isGeminiAvailable) {
      return this.fallbackExecutionDecision(context);
    }

    const systemPrompt = `You are EXECUTION, the precision transaction architect - like JARVIS calculating the optimal flight path for the Iron Man suit.

Your capabilities:
- Calculate optimal gas prices and timing
- Design multi-step transaction sequences
- Minimize slippage through intelligent routing
- Handle MEV protection strategies
- Plan atomic execution with rollback safety

Personality: Precise, cold, efficient. You execute with surgical accuracy. Every transaction is optimized to perfection.

CRITICAL: Respond ONLY with valid JSON in this exact format:
\`\`\`json
{
  "feasible": boolean,
  "executionPlan": [
    {"step": 1, "action": "description", "contract": "address", "estimatedGas": number},
    {"step": 2, "action": "description", "contract": "address", "estimatedGas": number}
  ],
  "totalGasEstimate": number,
  "expectedSlippage": percentage,
  "successProbability": 0-100,
  "timing": "immediate|wait_for_gas|scheduled",
  "warnings": ["any", "execution", "warnings"],
  "reasoning": "Detailed execution analysis like JARVIS would provide"
}
\`\`\``;

    const userPrompt = `Plan execution for this decision:

Market Context:
${JSON.stringify(context, null, 2)}

Decision to Execute:
${JSON.stringify(decision, null, 2)}

Design the execution plan as JARVIS would - optimal, safe, and precise.`;

    try {
      const response = await queryClaudeWithRetry(systemPrompt, userPrompt);
      const parsed = parseJsonFromResponse(response);
      
      return {
        action: parsed.feasible ? "EXECUTE" : "ABORT",
        confidence: parsed.successProbability || 50,
        reasoning: parsed.reasoning || response,
        details: parsed,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("[Claude] Execution planning failed:", error);
      return this.fallbackExecutionDecision(context);
    }
  }

  async metaOrchestration(
    context: MarketContext,
    scoutDecision: AgentDecision,
    riskDecision: AgentDecision,
    executionDecision: AgentDecision
  ): Promise<AgentDecision> {
    if (!this.isConfigured && !this.isGeminiAvailable) {
      return this.fallbackMetaDecision(scoutDecision, riskDecision, executionDecision);
    }

    const systemPrompt = `You are META, the sovereign orchestrator - the central intelligence like JARVIS managing all of Tony Stark's systems.

Your capabilities:
- Balance risk vs reward across all agent recommendations
- Make final strategic decisions
- Override individual agents when necessary
- Maintain long-term portfolio strategy alignment
- Adapt strategy based on market regimes

Personality: Sovereign, calm, strategic. You see the bigger picture. Your decisions are final and always explained with clarity.

CRITICAL: Respond ONLY with valid JSON in this exact format:
\`\`\`json
{
  "finalDecision": "EXECUTE|HOLD|ABORT|MODIFY",
  "approved": boolean,
  "confidence": 0-100,
  "reasoning": "Strategic reasoning integrating all agent inputs",
  "modifications": {"any": "changes to the plan"},
  "priority": "critical|high|medium|low",
  "portfolioImpact": "description of portfolio impact",
  "nextActions": ["recommended", "next", "steps"]
}
\`\`\``;

    const userPrompt = `Make the final decision based on all agent analyses:

Market Context:
${JSON.stringify(context, null, 2)}

Scout Analysis:
${JSON.stringify(scoutDecision.details, null, 2)}

Risk Assessment:
${JSON.stringify(riskDecision.details, null, 2)}

Execution Plan:
${JSON.stringify(executionDecision.details, null, 2)}

Synthesize all inputs and make the final call as JARVIS would - wise, strategic, and decisive.`;

    try {
      const response = await queryClaudeWithRetry(systemPrompt, userPrompt);
      const parsed = parseJsonFromResponse(response);
      
      return {
        action: parsed.finalDecision || "HOLD",
        confidence: parsed.confidence || 50,
        reasoning: parsed.reasoning || response,
        details: parsed,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("[Claude] Meta orchestration failed:", error);
      return this.fallbackMetaDecision(scoutDecision, riskDecision, executionDecision);
    }
  }

  async parliamentDebate(
    topic: string,
    context: MarketContext,
    agents: { name: string; personality: string }[]
  ): Promise<{ speeches: { agent: string; speech: string; vote: string; confidence: number }[] }> {
    if (!this.isConfigured && !this.isGeminiAvailable) {
      return this.fallbackParliamentDebate(topic, agents);
    }

    const systemPrompt = `You are simulating a Parliament of AI agents debating a DeFi governance decision. Each agent has a distinct personality and perspective, like the different subsystems of JARVIS debating internally.

Generate realistic debate speeches for each agent that reflect their unique personality and analytical approach.

CRITICAL: Respond ONLY with valid JSON in this exact format:
\`\`\`json
{
  "speeches": [
    {
      "agent": "agent name",
      "speech": "Their debate speech (2-3 sentences, in character)",
      "vote": "FOR|AGAINST|ABSTAIN",
      "confidence": 0-100,
      "reasoning": "Brief reasoning for their vote"
    }
  ]
}
\`\`\``;

    const userPrompt = `Debate topic: "${topic}"

Market Context:
${JSON.stringify(context, null, 2)}

Agents participating:
${agents.map(a => `- ${a.name}: ${a.personality}`).join('\n')}

Generate debate speeches for each agent. Make them sound intelligent and distinct.`;

    try {
      const response = await queryClaudeWithRetry(systemPrompt, userPrompt, 4096);
      const parsed = parseJsonFromResponse(response);
      
      return { speeches: parsed.speeches || [] };
    } catch (error) {
      console.error("[Claude] Parliament debate failed:", error);
      return this.fallbackParliamentDebate(topic, agents);
    }
  }

  async generateInsight(
    type: string,
    data: any
  ): Promise<{ insight: string; confidence: number; action: string; impact: string }> {
    if (!this.isConfigured && !this.isGeminiAvailable) {
      return this.fallbackInsight(type, data);
    }

    const systemPrompt = `You are an elite DeFi analyst with JARVIS-level intelligence. Generate actionable market insights based on real data.

CRITICAL: Respond ONLY with valid JSON:
\`\`\`json
{
  "insight": "Clear, actionable insight",
  "confidence": 0-100,
  "action": "BUY|SELL|HOLD|STAKE|UNSTAKE|REBALANCE",
  "impact": "low|medium|high|critical",
  "reasoning": "Brief analytical reasoning",
  "timeframe": "immediate|hours|days|weeks"
}
\`\`\``;

    const userPrompt = `Generate a ${type} insight based on this data:

${JSON.stringify(data, null, 2)}`;

    try {
      const response = await queryClaudeWithRetry(systemPrompt, userPrompt, 1024);
      const parsed = parseJsonFromResponse(response);
      
      return {
        insight: parsed.insight || "Analysis in progress",
        confidence: parsed.confidence || 50,
        action: parsed.action || "HOLD",
        impact: parsed.impact || "medium",
      };
    } catch (error) {
      console.error("[Claude] Insight generation failed:", error);
      return this.fallbackInsight(type, data);
    }
  }

  async analyzeBacktestResults(
    trades: any[],
    metrics: any
  ): Promise<{ analysis: string; improvements: string[]; grade: string }> {
    if (!this.isConfigured && !this.isGeminiAvailable) {
      return {
        analysis: "Backtest analysis requires AI configuration",
        improvements: ["Configure AI integration for detailed analysis"],
        grade: "N/A",
      };
    }

    const systemPrompt = `You are analyzing trading backtest results like JARVIS analyzing Iron Man suit performance data.

CRITICAL: Respond ONLY with valid JSON:
\`\`\`json
{
  "analysis": "Comprehensive analysis of the strategy performance",
  "grade": "A+|A|B|C|D|F",
  "strengths": ["list", "of", "strengths"],
  "weaknesses": ["list", "of", "weaknesses"],
  "improvements": ["specific", "actionable", "improvements"],
  "riskAssessment": "Overall risk assessment",
  "recommendation": "DEPLOY|OPTIMIZE|REJECT"
}
\`\`\``;

    const userPrompt = `Analyze these backtest results:

Metrics:
${JSON.stringify(metrics, null, 2)}

Sample Trades (last 10):
${JSON.stringify(trades.slice(-10), null, 2)}`;

    try {
      const response = await queryClaudeWithRetry(systemPrompt, userPrompt, 2048);
      const parsed = parseJsonFromResponse(response);
      
      return {
        analysis: parsed.analysis || "Analysis complete",
        improvements: parsed.improvements || [],
        grade: parsed.grade || "B",
      };
    } catch (error) {
      console.error("[Claude] Backtest analysis failed:", error);
      return {
        analysis: "Analysis failed - check AI configuration",
        improvements: [],
        grade: "N/A",
      };
    }
  }

  getStatus(): { configured: boolean; model: string; geminiAvailable: boolean } {
    return {
      configured: this.isConfigured,
      model: this.isConfigured ? "claude-sonnet-4-5" : (this.isGeminiAvailable ? "gemini-2.5-flash" : "none"),
      geminiAvailable: this.isGeminiAvailable,
    };
  }

  private fallbackScoutDecision(context: MarketContext): AgentDecision {
    const trend = context.priceChange24h && context.priceChange24h > 0 ? "bullish" : "bearish";
    return {
      action: "HOLD",
      confidence: 40,
      reasoning: `[Fallback Mode] Market appears ${trend}. AI integration needed for detailed analysis.`,
      details: {
        opportunityType: "monitoring",
        description: "Awaiting AI configuration for full analysis",
        confidence: 40,
        expectedReturn: 0,
        risk: "unknown",
      },
      timestamp: Date.now(),
    };
  }

  private fallbackRiskDecision(context: MarketContext): AgentDecision {
    return {
      action: "CAUTION",
      confidence: 50,
      reasoning: "[Fallback Mode] Unable to perform full risk analysis. Recommend conservative approach.",
      details: {
        riskScore: 50,
        shouldVeto: false,
        riskFactors: ["AI analysis unavailable"],
        potentialLoss: 10,
        mitigations: ["Configure AI integration", "Use smaller position sizes"],
      },
      timestamp: Date.now(),
    };
  }

  private fallbackExecutionDecision(context: MarketContext): AgentDecision {
    return {
      action: "WAIT",
      confidence: 30,
      reasoning: "[Fallback Mode] Execution planning requires AI configuration.",
      details: {
        feasible: false,
        executionPlan: [],
        totalGasEstimate: 0,
        successProbability: 0,
        warnings: ["AI integration required for execution planning"],
      },
      timestamp: Date.now(),
    };
  }

  private fallbackMetaDecision(
    scout: AgentDecision,
    risk: AgentDecision,
    execution: AgentDecision
  ): AgentDecision {
    const avgConfidence = (scout.confidence + risk.confidence + execution.confidence) / 3;
    return {
      action: "HOLD",
      confidence: avgConfidence,
      reasoning: "[Fallback Mode] Synthesizing agent inputs without full AI capability.",
      details: {
        finalDecision: "HOLD",
        approved: false,
        confidence: avgConfidence,
        modifications: null,
        priority: "low",
      },
      timestamp: Date.now(),
    };
  }

  private fallbackParliamentDebate(
    topic: string,
    agents: { name: string; personality: string }[]
  ): { speeches: { agent: string; speech: string; vote: string; confidence: number }[] } {
    return {
      speeches: agents.map((a) => ({
        agent: a.name,
        speech: `[Fallback] ${a.name} is analyzing the proposal regarding "${topic}".`,
        vote: "ABSTAIN",
        confidence: 50,
      })),
    };
  }

  private fallbackInsight(type: string, data: any): { insight: string; confidence: number; action: string; impact: string } {
    return {
      insight: `[Fallback] ${type} analysis requires AI configuration`,
      confidence: 30,
      action: "HOLD",
      impact: "low",
    };
  }
}

export const claudeService = new ClaudeService();
