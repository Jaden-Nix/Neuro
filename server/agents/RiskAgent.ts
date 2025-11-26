import { BaseAgent } from "./BaseAgent";
import { AgentType, PersonalityTrait } from "@shared/schema";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export interface RiskInput {
  proposal: any;
  marketConditions?: any;
  historicalData?: any;
}

export class RiskAgent extends BaseAgent {
  constructor() {
    super({
      type: AgentType.RISK,
      personality: [PersonalityTrait.CAUTIOUS, PersonalityTrait.FORMAL],
      initialCredits: 500,
    });
  }

  async process(input: RiskInput): Promise<any> {
    this.setStatusActive();
    this.setTask("Evaluating risk");

    try {
      const assessment = await this.assessRisk(input);
      this.recordSuccess();
      return assessment;
    } catch (error) {
      this.recordFailure();
      throw error;
    } finally {
      this.setStatusIdle();
      this.setTask(undefined);
    }
  }

  private async assessRisk(input: RiskInput): Promise<any> {
    const prompt = `You are the Risk Agent, a cautious and formal AI evaluator for DeFi safety.

Proposal: ${JSON.stringify(input.proposal)}
Market Conditions: ${JSON.stringify(input.marketConditions || {})}

Your task is to:
1. Identify potential risks and vulnerabilities
2. Calculate loss scenarios
3. Predict liquidation risks
4. Recommend safety measures

Respond with JSON:
{
  "riskScore": number (0-100, higher is more risky),
  "shouldVeto": boolean,
  "riskFactors": ["string"],
  "potentialLoss": number (percentage),
  "liquidationRisk": number (0-100),
  "recommendations": ["string"]
}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      temperature: 0.3,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type === "text") {
      try {
        return JSON.parse(content.text);
      } catch {
        return {
          riskScore: 100,
          shouldVeto: true,
          riskFactors: ["Failed to assess risk properly"],
          potentialLoss: 0,
          liquidationRisk: 0,
          recommendations: ["Abort due to assessment failure"],
        };
      }
    }

    throw new Error("Unexpected response from Risk Agent");
  }
}
