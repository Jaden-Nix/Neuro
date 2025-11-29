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
    const scoutProposal = input.scoutProposal || {};
    const riskAssessment = input.riskAssessment || {};
    const executionPlan = input.executionPlan || {};
    
    // STRICT REJECTION CRITERIA
    const scoutConfidence = scoutProposal.confidence || 0;
    const riskScore = riskAssessment.riskScore || 50;
    const shouldVeto = riskAssessment.shouldVeto === true;
    const expectedReturn = scoutProposal.expectedReturn || 0;
    
    // Reject if: Risk veto, low confidence, high risk, or low return
    const tooRisky = shouldVeto || riskScore > 65;
    const lowConfidence = scoutConfidence < 50;
    const lowReturn = expectedReturn < 2 && expectedReturn > 0;
    const notFeasible = executionPlan.feasible === false;
    
    const rejected = tooRisky || lowConfidence || lowReturn || notFeasible;
    
    const confidence = rejected 
      ? Math.max(10, Math.round(100 - riskScore - (100 - scoutConfidence)))
      : Math.round((scoutConfidence * 0.4 + (100 - riskScore) * 0.6));
    
    let reasoning = "";
    if (shouldVeto) {
      reasoning = `REJECTED: Risk Agent veto. Risk score ${riskScore}/100 exceeds safety threshold.`;
    } else if (riskScore > 65) {
      reasoning = `REJECTED: Risk score ${riskScore}/100 too high. Requires risk mitigation.`;
    } else if (scoutConfidence < 50) {
      reasoning = `REJECTED: Scout confidence ${scoutConfidence}% too low. Need higher conviction.`;
    } else if (lowReturn && expectedReturn > 0) {
      reasoning = `REJECTED: Expected return ${expectedReturn}% insufficient for risk profile.`;
    } else if (notFeasible) {
      reasoning = `REJECTED: Execution plan not feasible.`;
    } else {
      reasoning = `APPROVED: Risk ${riskScore}/100, Scout confidence ${scoutConfidence}%, Return ${expectedReturn}%. Conditions acceptable.`;
    }
    
    const decision: MetaDecision = {
      approved: !rejected,
      confidence,
      reasoning,
      modifications: rejected ? null : { suggestedSize: "Monitor execution" },
      priority: rejected ? "low" : scoutConfidence > 70 && riskScore < 40 ? "high" : "medium",
    };

    if (input.mlPrediction) {
      decision.mlInsights = {
        successProbability: input.mlPrediction.successProbability,
        riskAdjustedScore: input.mlPrediction.riskAdjustedScore,
        clusterLabel: input.mlPrediction.clusterLabel,
        features: input.mlPrediction.features,
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

    const prompt = `You are the Meta-Agent, a sovereign AI orchestrator for DeFi governance. YOU MUST MAKE HARD REJECTIONS WHEN CONDITIONS AREN'T MET.
    
Analyze the following inputs and make a strategic decision:

Scout Proposal: ${JSON.stringify(input.scoutProposal || "None")}
Risk Assessment: ${JSON.stringify(input.riskAssessment || "None")}
Execution Plan: ${JSON.stringify(input.executionPlan || "None")}
${mlInsightsSection}

APPROVAL THRESHOLDS - ENFORCE STRICTLY:
- Risk veto by Risk Agent? → REJECT (shouldVeto=true means NO)
- Scout confidence < 50%? → REJECT
- Risk score > 65? → REJECT
- Expected return < 2%? → REJECT for small positions
- No clear execution path? → REJECT

Consider:
1. Risk veto is FINAL - if shouldVeto is true, you MUST reject
2. Risk vs reward: Does expected return justify the risk? Calculate it.
3. Execution feasibility: Can this actually be done?
4. Scout confidence: Is Scout sure about this opportunity?

Respond with VALID JSON:
{
  "approved": boolean,
  "confidence": number (0-100, reflect uncertainty),
  "reasoning": "string with specific numbers and rejection reasons if rejected",
  "modifications": "specific changes to make this acceptable, or null if rejected",
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
