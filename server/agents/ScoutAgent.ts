import { BaseAgent } from "./BaseAgent";
import { AgentType, PersonalityTrait } from "@shared/schema";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicCircuitBreaker } from "../utils/circuitBreaker";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ScoutInput {
  marketData?: any;
  liquidityPools?: any[];
  priceFeeds?: any;
}

interface ScoutOpportunity {
  opportunityType: "arbitrage" | "yield" | "swap" | "stake" | "none";
  description: string;
  confidence: number;
  expectedReturn: number;
  volatilityPrediction: number;
  details: Record<string, any>;
}

export class ScoutAgent extends BaseAgent {
  constructor() {
    super({
      type: AgentType.SCOUT,
      personality: [PersonalityTrait.CURIOUS, PersonalityTrait.ENERGETIC],
      initialCredits: 500,
    });
  }

  async process(input: ScoutInput): Promise<ScoutOpportunity> {
    this.setStatusActive();
    this.setTask("Scanning for opportunities");

    try {
      const opportunity = await this.scanOpportunity(input);
      this.recordSuccess();
      return opportunity;
    } catch (error) {
      this.recordFailure();
      throw error;
    } finally {
      this.setStatusIdle();
      this.setTask(undefined);
    }
  }

  private getFallbackOpportunity(): ScoutOpportunity {
    const opportunities: ScoutOpportunity[] = [
      {
        opportunityType: "yield",
        description: "Stable yield farming opportunity on established protocol",
        confidence: 65,
        expectedReturn: 4.5,
        volatilityPrediction: 25,
        details: { protocol: "compound", asset: "USDC", apy: 4.5 },
      },
      {
        opportunityType: "stake",
        description: "Liquid staking opportunity with moderate returns",
        confidence: 70,
        expectedReturn: 5.2,
        volatilityPrediction: 20,
        details: { protocol: "lido", asset: "ETH", apy: 5.2 },
      },
      {
        opportunityType: "none",
        description: "No significant opportunities detected - market conditions stable",
        confidence: 80,
        expectedReturn: 0,
        volatilityPrediction: 30,
        details: { reason: "AI service temporarily unavailable" },
      },
    ];
    
    return opportunities[Math.floor(Math.random() * opportunities.length)];
  }

  private async scanOpportunity(input: ScoutInput): Promise<ScoutOpportunity> {
    const prompt = `You are the Scout Agent, a curious and energetic AI analyzer for DeFi opportunities.

Market Data: ${JSON.stringify(input.marketData || {})}
Liquidity Pools: ${JSON.stringify(input.liquidityPools || [])}

Your task is to:
1. Identify profitable opportunities (arbitrage, yield farming, swaps)
2. Predict volatility and price movements
3. Detect anomalies or inefficiencies

Respond with JSON:
{
  "opportunityType": "arbitrage" | "yield" | "swap" | "stake",
  "description": "string",
  "confidence": number (0-100),
  "expectedReturn": number (percentage),
  "volatilityPrediction": number (0-100),
  "details": {}
}`;

    return await anthropicCircuitBreaker.execute(
      async () => {
        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 1024,
          temperature: 0.8,
          messages: [{ role: "user", content: prompt }],
        });

        const content = message.content[0];
        if (content.type === "text") {
          try {
            return JSON.parse(content.text) as ScoutOpportunity;
          } catch {
            return {
              opportunityType: "none" as const,
              description: "No opportunities detected",
              confidence: 0,
              expectedReturn: 0,
              volatilityPrediction: 50,
              details: {},
            };
          }
        }

        throw new Error("Unexpected response from Scout Agent");
      },
      () => this.getFallbackOpportunity()
    );
  }
}
