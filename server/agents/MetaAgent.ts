import { BaseAgent } from "./BaseAgent";
import { AgentType, PersonalityTrait } from "@shared/schema";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicCircuitBreaker } from "../utils/circuitBreaker";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface MetaDecisionInput {
  scoutProposal?: any;
  riskAssessment?: any;
  executionPlan?: any;
}

interface MetaDecision {
  approved: boolean;
  confidence: number;
  reasoning: string;
  modifications: any;
  priority: "low" | "medium" | "high" | "critical";
}

export class MetaAgent extends BaseAgent {
  constructor() {
    super({
      type: AgentType.META,
      personality: [PersonalityTrait.SOVEREIGN, PersonalityTrait.CALM],
      initialCredits: 1000,
    });
  }

  async process(input: MetaDecisionInput): Promise<MetaDecision> {
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

  private getFallbackDecision(input: MetaDecisionInput): MetaDecision {
    const executionPlan = input.executionPlan || {};
    const riskAssessment = input.riskAssessment || {};
    
    const executionFeasible = executionPlan.feasible !== false;
    const riskAcceptable = (riskAssessment.riskScore || 50) < 70;
    const successProbability = executionPlan.successProbability || 50;
    
    const approved = executionFeasible && riskAcceptable && successProbability > 40;
    const confidence = Math.round((100 - (riskAssessment.riskScore || 50)) * 0.6 + successProbability * 0.4);
    
    return {
      approved,
      confidence,
      reasoning: approved 
        ? "Fallback analysis: Risk and execution parameters within acceptable thresholds"
        : "Fallback analysis: Parameters exceed safety thresholds - manual review recommended",
      modifications: null,
      priority: confidence > 70 ? "high" : confidence > 40 ? "medium" : "low",
    };
  }

  private async makeDecision(input: MetaDecisionInput): Promise<MetaDecision> {
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

    return await anthropicCircuitBreaker.execute(
      async () => {
        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 1024,
          temperature: 0.7,
          messages: [{ role: "user", content: prompt }],
        });

        const content = message.content[0];
        if (content.type === "text") {
          try {
            return JSON.parse(content.text) as MetaDecision;
          } catch {
            return this.getFallbackDecision(input);
          }
        }

        throw new Error("Unexpected response type from Meta-Agent");
      },
      () => this.getFallbackDecision(input)
    );
  }

  public async negotiateWithAgents(proposals: any[]): Promise<any> {
    this.setTask("Negotiating between agents");
    
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
