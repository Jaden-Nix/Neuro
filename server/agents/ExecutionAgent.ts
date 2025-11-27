import { BaseAgent } from "./BaseAgent";
import { AgentType, PersonalityTrait } from "@shared/schema";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicCircuitBreaker } from "../utils/circuitBreaker";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ExecutionInput {
  proposal: any;
  riskAssessment: any;
  walletAddress?: string;
}

interface ExecutionPlan {
  feasible: boolean;
  gasEstimate: number;
  steps: Array<{
    action: string;
    contract: string;
    parameters: Record<string, any>;
    estimatedGas: number;
  }>;
  totalValue: string;
  successProbability: number;
  warnings: string[];
}

export class ExecutionAgent extends BaseAgent {
  constructor() {
    super({
      type: AgentType.EXECUTION,
      personality: [PersonalityTrait.PRECISE, PersonalityTrait.COLD],
      initialCredits: 500,
    });
  }

  async process(input: ExecutionInput): Promise<ExecutionPlan> {
    this.setStatusExecuting();
    this.setTask("Planning execution");

    try {
      const executionPlan = await this.planExecution(input);
      this.recordSuccess();
      return executionPlan;
    } catch (error) {
      this.recordFailure();
      throw error;
    } finally {
      this.setStatusIdle();
      this.setTask(undefined);
    }
  }

  private getFallbackExecutionPlan(input: ExecutionInput): ExecutionPlan {
    const proposal = input.proposal || {};
    const riskAssessment = input.riskAssessment || {};
    
    const isFeasible = riskAssessment.riskScore < 70;
    const successProbability = Math.max(0, 100 - (riskAssessment.riskScore || 30));
    
    return {
      feasible: isFeasible,
      gasEstimate: 150000,
      steps: [
        {
          action: proposal.opportunityType || "evaluate",
          contract: "0x0000000000000000000000000000000000000000",
          parameters: { type: proposal.opportunityType },
          estimatedGas: 150000,
        },
      ],
      totalValue: "0",
      successProbability,
      warnings: [
        "AI analysis unavailable - using conservative execution plan",
        isFeasible ? "Proceeding with standard execution" : "Risk threshold exceeded - manual review recommended",
      ],
    };
  }

  private async planExecution(input: ExecutionInput): Promise<ExecutionPlan> {
    const prompt = `You are the Execution Agent, a precise and cold AI executor for DeFi transactions.

Proposal: ${JSON.stringify(input.proposal)}
Risk Assessment: ${JSON.stringify(input.riskAssessment)}

Your task is to:
1. Create a safe transaction plan
2. Calculate optimal gas costs
3. Define execution steps
4. Estimate success probability

Respond with JSON:
{
  "feasible": boolean,
  "gasEstimate": number,
  "steps": [
    {
      "action": "string",
      "contract": "string",
      "parameters": {},
      "estimatedGas": number
    }
  ],
  "totalValue": string,
  "successProbability": number (0-100),
  "warnings": ["string"]
}`;

    return await anthropicCircuitBreaker.execute(
      async () => {
        const message = await anthropic.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 1024,
          temperature: 0.2,
          messages: [{ role: "user", content: prompt }],
        });

        const content = message.content[0];
        if (content.type === "text") {
          try {
            return JSON.parse(content.text) as ExecutionPlan;
          } catch {
            return this.getFallbackExecutionPlan(input);
          }
        }

        throw new Error("Unexpected response from Execution Agent");
      },
      () => this.getFallbackExecutionPlan(input)
    );
  }
}
