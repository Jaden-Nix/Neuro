import { BaseAgent } from "./BaseAgent";
import { AgentType, PersonalityTrait, type MLPrediction, type MLFeatureVector } from "@shared/schema";
import { claudeService, type MarketContext, type AgentDecision } from "../ai/ClaudeService";
import { mlPatternRecognition } from "../ml/MLPatternRecognition";

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
    try {
      const context: MarketContext = {
        symbol: input.scoutProposal?.details?.asset || "ETH",
        currentPrice: input.marketData?.price,
        priceChange24h: input.marketData?.previousPrice 
          ? ((input.marketData.price || 0) - input.marketData.previousPrice) / input.marketData.previousPrice * 100
          : undefined,
        volume24h: input.marketData?.volume,
        defiTVL: input.marketData?.tvl,
      };

      const scoutDecision: AgentDecision = {
        action: input.scoutProposal?.opportunityType || "HOLD",
        confidence: input.scoutProposal?.confidence || 50,
        reasoning: input.scoutProposal?.description || "",
        details: input.scoutProposal || {},
        timestamp: Date.now(),
      };

      const riskDecision: AgentDecision = {
        action: input.riskAssessment?.shouldVeto ? "VETO" : "APPROVE",
        confidence: 100 - (input.riskAssessment?.riskScore || 50),
        reasoning: input.riskAssessment?.reasoning || "",
        details: input.riskAssessment || {},
        timestamp: Date.now(),
      };

      const executionDecision: AgentDecision = {
        action: input.executionPlan?.feasible ? "EXECUTE" : "ABORT",
        confidence: input.executionPlan?.successProbability || 50,
        reasoning: input.executionPlan?.warnings?.join("; ") || "",
        details: input.executionPlan || {},
        timestamp: Date.now(),
      };

      const decision = await claudeService.metaOrchestration(
        context,
        scoutDecision,
        riskDecision,
        executionDecision
      );

      const metaDecision: MetaDecision = {
        approved: decision.details?.approved || decision.action === "EXECUTE",
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        modifications: decision.details?.modifications || null,
        priority: (decision.details?.priority as any) || "medium",
      };

      if (input.mlPrediction) {
        metaDecision.mlInsights = {
          successProbability: input.mlPrediction.successProbability,
          riskAdjustedScore: input.mlPrediction.riskAdjustedScore,
          clusterLabel: input.mlPrediction.clusterLabel,
          features: input.mlPrediction.features,
        };
      }

      return metaDecision;
    } catch (error) {
      console.error("[MetaAgent] Decision failed, using fallback:", error);
      return this.getFallbackDecision(input);
    }
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
