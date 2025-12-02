import { BaseAgent } from "./BaseAgent";
import { AgentType, PersonalityTrait } from "@shared/schema";
import { claudeService, type MarketContext } from "../ai/ClaudeService";

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
    try {
      const context: MarketContext = {
        symbol: input.proposal?.details?.asset || "ETH",
        currentPrice: input.proposal?.details?.currentPrice,
      };

      const decision = await claudeService.executionPlanning(context, {
        proposal: input.proposal,
        riskAssessment: input.riskAssessment,
      });
      
      const executionPlan = decision.details?.executionPlan || [];
      
      return {
        feasible: decision.action === "EXECUTE",
        gasEstimate: decision.details?.totalGasEstimate || 150000,
        steps: executionPlan.map((step: any) => ({
          action: step.action || "execute",
          contract: step.contract || "0x0000000000000000000000000000000000000000",
          parameters: step.parameters || {},
          estimatedGas: step.estimatedGas || 50000,
        })),
        totalValue: "0",
        successProbability: decision.confidence,
        warnings: decision.details?.warnings || [],
      };
    } catch (error) {
      console.error("[ExecutionAgent] Planning failed, using fallback:", error);
      return this.getFallbackExecutionPlan(input);
    }
  }
}
