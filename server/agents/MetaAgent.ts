import { BaseAgent } from "./BaseAgent";
import { AgentType, PersonalityTrait, type MLPrediction, type MLFeatureVector } from "@shared/schema";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicCircuitBreaker } from "../utils/circuitBreaker";
import { mlPatternRecognition } from "../ml/MLPatternRecognition";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface MetaDecisionInput {
  scoutProposal?: any;
  riskAssessment?: any;
  executionPlan?: any;
  mlPrediction?: MLPrediction;
  marketData?: {
    price?: number;
    previousPrice?: number;
    tvl?: number;
    previousTvl?: number;
    gasPrice?: number;
    volume?: number;
    previousVolume?: number;
  };
}

interface MetaDecision {
  approved: boolean;
  confidence: number;
  reasoning: string;
  modifications: any;
  priority: "low" | "medium" | "high" | "critical";
  mlInsights?: {
    successProbability: number;
    riskAdjustedScore: number;
    clusterLabel: string;
    features: MLFeatureVector;
  };
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
    this.setTask("Making strategic decision with ML insights");

    try {
      const mlPrediction = await this.getMLPrediction(input);
      const enhancedInput = { ...input, mlPrediction };
      const decision = await this.makeDecision(enhancedInput);
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

  private async getMLPrediction(input: MetaDecisionInput): Promise<MLPrediction | undefined> {
    try {
      if (input.mlPrediction) {
        return input.mlPrediction;
      }

      const opportunityId = input.scoutProposal?.id || `opp-${Date.now()}`;
      
      const features = mlPatternRecognition.extractFeatures(
        [],
        [],
        input.marketData
      );

      return mlPatternRecognition.predictSuccessProbability(opportunityId, features);
    } catch (error) {
      console.warn("ML prediction failed, proceeding without ML insights:", error);
      return undefined;
    }
  }

  private getFallbackDecision(input: MetaDecisionInput): MetaDecision {
    const executionPlan = input.executionPlan || {};
    const riskAssessment = input.riskAssessment || {};
    const mlPrediction = input.mlPrediction;
    
    const executionFeasible = executionPlan.feasible !== false;
    const riskAcceptable = (riskAssessment.riskScore || 50) < 70;
    
    let successProbability = executionPlan.successProbability || 50;
    if (mlPrediction) {
      successProbability = (successProbability + mlPrediction.successProbability) / 2;
    }
    
    const approved = executionFeasible && riskAcceptable && successProbability > 40;
    let confidence = Math.round((100 - (riskAssessment.riskScore || 50)) * 0.6 + successProbability * 0.4);
    
    if (mlPrediction) {
      confidence = Math.round((confidence * 0.6) + (mlPrediction.riskAdjustedScore * 0.4));
    }
    
    const decision: MetaDecision = {
      approved,
      confidence,
      reasoning: approved 
        ? `Analysis: Risk and execution parameters within acceptable thresholds${mlPrediction ? ` (ML Success Probability: ${mlPrediction.successProbability}%)` : ''}`
        : `Analysis: Parameters exceed safety thresholds - manual review recommended${mlPrediction ? ` (ML Risk Score: ${100 - mlPrediction.riskAdjustedScore})` : ''}`,
      modifications: null,
      priority: confidence > 70 ? "high" : confidence > 40 ? "medium" : "low",
    };

    if (mlPrediction) {
      decision.mlInsights = {
        successProbability: mlPrediction.successProbability,
        riskAdjustedScore: mlPrediction.riskAdjustedScore,
        clusterLabel: mlPrediction.clusterLabel,
        features: mlPrediction.features,
      };
    }

    return decision;
  }

  private async makeDecision(input: MetaDecisionInput): Promise<MetaDecision> {
    const mlInsightsSection = input.mlPrediction 
      ? `
ML Pattern Recognition Insights:
- Success Probability: ${input.mlPrediction.successProbability}%
- Risk-Adjusted Score: ${input.mlPrediction.riskAdjustedScore}
- Market Cluster: ${input.mlPrediction.clusterLabel}
- Expected Return: ${input.mlPrediction.expectedReturn / 100}%
- Price Volatility: ${input.mlPrediction.features.priceVolatility.toFixed(2)}%
- Agent Performance Index: ${input.mlPrediction.features.agentPerformance.toFixed(0)}
- Market Sentiment: ${input.mlPrediction.features.marketSentiment.toFixed(0)}
- Liquidity Depth: ${input.mlPrediction.features.liquidityDepth.toFixed(0)}`
      : "ML Prediction: Not available";

    const prompt = `You are the Meta-Agent, a sovereign AI orchestrator for DeFi governance with ML-enhanced decision making.
    
Analyze the following inputs and make a strategic decision:

Scout Proposal: ${JSON.stringify(input.scoutProposal || "None")}
Risk Assessment: ${JSON.stringify(input.riskAssessment || "None")}
Execution Plan: ${JSON.stringify(input.executionPlan || "None")}
${mlInsightsSection}

Consider:
1. Expected value and profitability (weight ML predictions heavily if available)
2. Risk vs reward ratio (use ML risk-adjusted score)
3. Execution feasibility
4. Long-term strategy alignment
5. Market cluster conditions (bullish/bearish/volatile/stable/sideways)
6. Agent performance metrics

If ML Success Probability is above 70%, lean toward approval unless risk is extreme.
If ML Success Probability is below 30%, require strong justification to approve.

Respond with a JSON decision:
{
  "approved": boolean,
  "confidence": number (0-100),
  "reasoning": "string (include ML insights in reasoning)",
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

  public async negotiateWithAgents(proposals: any[], marketData?: MetaDecisionInput["marketData"]): Promise<any> {
    this.setTask("Negotiating between agents with ML scoring");
    
    const scoredProposals = await Promise.all(
      proposals.map(async (proposal) => {
        const scoutConfidence = proposal.scoutConfidence || 0;
        const riskScore = proposal.riskScore || 100;
        const executionFeasibility = proposal.executionFeasibility || 0;
        const expectedReturn = proposal.expectedReturn || 0;

        let mlScore = 50;
        let mlPrediction: MLPrediction | undefined;
        
        try {
          const features = mlPatternRecognition.extractFeatures(
            [],
            [],
            marketData
          );
          mlPrediction = mlPatternRecognition.predictSuccessProbability(
            proposal.id || `proposal-${Date.now()}`,
            features
          );
          mlScore = mlPrediction.riskAdjustedScore;
        } catch (error) {
          console.warn("ML scoring failed for proposal:", error);
        }

        const baseScore =
          scoutConfidence * 0.2 +
          (100 - riskScore) * 0.3 +
          executionFeasibility * 0.15 +
          expectedReturn * 0.1 +
          mlScore * 0.25;

        return {
          proposal,
          score: baseScore,
          mlPrediction,
        };
      })
    );

    scoredProposals.sort((a, b) => b.score - a.score);
    const best = scoredProposals[0];

    return {
      selectedProposal: best.proposal,
      finalScore: best.score,
      allScores: scoredProposals.map(p => p.score),
      mlPrediction: best.mlPrediction,
      rankedProposals: scoredProposals.map(p => ({
        proposal: p.proposal,
        score: p.score,
        mlSuccessProbability: p.mlPrediction?.successProbability,
      })),
    };
  }

  public getMLService(): typeof mlPatternRecognition {
    return mlPatternRecognition;
  }
}
