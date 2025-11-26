import { BaseAgent } from "./BaseAgent";
import { AgentType, PersonalityTrait } from "@shared/schema";
import Anthropic from "@anthropic-ai/sdk";

// Using Replit AI Integrations for Anthropic
const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

export interface MetaDecisionInput {
  scoutProposal?: any;
  riskAssessment?: any;
  executionPlan?: any;
}

export class MetaAgent extends BaseAgent {
  constructor() {
    super({
      type: AgentType.META,
      personality: [PersonalityTrait.SOVEREIGN, PersonalityTrait.CALM],
      initialCredits: 1000,
    });
  }

  async process(input: MetaDecisionInput): Promise<any> {
    this.setStatusActive();
    this.setTask("Making strategic decision");

    try {
      const decision = await this.makeDecision(input);
      this.recordSuccess();
      return decision;
    } catch (error) {
      this.recordFailure();
      throw error;
    } finally {
      this.setStatusIdle();
      this.setTask(undefined);
    }
  }

  private async makeDecision(input: MetaDecisionInput): Promise<any> {
    const prompt = `You are the Meta-Agent, a sovereign AI orchestrator for DeFi governance.
    
Analyze the following inputs and make a strategic decision:

Scout Proposal: ${JSON.stringify(input.scoutProposal || "None")}
Risk Assessment: ${JSON.stringify(input.riskAssessment || "None")}
Execution Plan: ${JSON.stringify(input.executionPlan || "None")}

Consider:
1. Expected value and profitability
2. Risk vs reward ratio
3. Execution feasibility
4. Long-term strategy alignment

Respond with a JSON decision:
{
  "approved": boolean,
  "confidence": number (0-100),
  "reasoning": "string",
  "modifications": "any suggested changes",
  "priority": "low" | "medium" | "high" | "critical"
}`;

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      temperature: 0.7,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type === "text") {
      try {
        return JSON.parse(content.text);
      } catch {
        return {
          approved: false,
          confidence: 0,
          reasoning: "Failed to parse decision",
          modifications: null,
          priority: "low",
        };
      }
    }

    throw new Error("Unexpected response type from Meta-Agent");
  }

  public async negotiateWithAgents(proposals: any[]): Promise<any> {
    this.setTask("Negotiating between agents");
    
    // Weighted scoring system
    const scores = proposals.map((proposal) => {
      const scoutConfidence = proposal.scoutConfidence || 0;
      const riskScore = proposal.riskScore || 100;
      const executionFeasibility = proposal.executionFeasibility || 0;
      const expectedReturn = proposal.expectedReturn || 0;

      return (
        scoutConfidence * 0.3 +
        (100 - riskScore) * 0.4 +
        executionFeasibility * 0.2 +
        expectedReturn * 0.1
      );
    });

    const bestIndex = scores.indexOf(Math.max(...scores));
    return {
      selectedProposal: proposals[bestIndex],
      finalScore: scores[bestIndex],
      allScores: scores,
    };
  }
}
