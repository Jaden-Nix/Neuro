import { BaseAgent } from "./BaseAgent";
import { AgentType, PersonalityTrait } from "@shared/schema";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ExecutionInput {
  proposal: any;
  riskAssessment: any;
  walletAddress?: string;
}

export class ExecutionAgent extends BaseAgent {
  constructor() {
    super({
      type: AgentType.EXECUTION,
      personality: [PersonalityTrait.PRECISE, PersonalityTrait.COLD],
      initialCredits: 500,
    });
  }

  async process(input: ExecutionInput): Promise<any> {
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

  private async planExecution(input: ExecutionInput): Promise<any> {
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

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      temperature: 0.2,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type === "text") {
      try {
        return JSON.parse(content.text);
      } catch {
        return {
          feasible: false,
          gasEstimate: 0,
          steps: [],
          totalValue: "0",
          successProbability: 0,
          warnings: ["Failed to create execution plan"],
        };
      }
    }

    throw new Error("Unexpected response from Execution Agent");
  }
}
