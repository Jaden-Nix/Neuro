import { BaseAgent } from "./BaseAgent";
import { AgentType, PersonalityTrait } from "@shared/schema";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ScoutInput {
  marketData?: any;
  liquidityPools?: any[];
  priceFeeds?: any;
}

export class ScoutAgent extends BaseAgent {
  constructor() {
    super({
      type: AgentType.SCOUT,
      personality: [PersonalityTrait.CURIOUS, PersonalityTrait.ENERGETIC],
      initialCredits: 500,
    });
  }

  async process(input: ScoutInput): Promise<any> {
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

  private async scanOpportunity(input: ScoutInput): Promise<any> {
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

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      temperature: 0.8,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type === "text") {
      try {
        return JSON.parse(content.text);
      } catch {
        return {
          opportunityType: "none",
          description: "No opportunities detected",
          confidence: 0,
          expectedReturn: 0,
          volatilityPrediction: 50,
          details: {},
        };
      }
    }

    throw new Error("Unexpected response from Scout Agent");
  }
}
