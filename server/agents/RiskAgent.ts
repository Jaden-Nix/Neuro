import { BaseAgent } from "./BaseAgent";
import { AgentType, PersonalityTrait, MEVRiskMetrics } from "@shared/schema";
import { flashbotsClient } from "../blockchain/FlashbotsClient";
import { parseEther } from "viem";
import Anthropic from "@anthropic-ai/sdk";
import { anthropicCircuitBreaker } from "../utils/circuitBreaker";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface RiskInput {
  proposal: any;
  marketConditions?: any;
  historicalData?: any;
  transactionData?: {
    value: string;
    to: string;
    data?: string;
  };
}

export interface MEVAnalysisInput {
  txValue: string;
  txTo: string;
  txData?: string;
  slippageTolerance?: number;
}

export interface SandwichDetectionResult {
  isLikelySandwich: boolean;
  confidence: number;
  frontrunnerAddress?: string;
  estimatedLoss: number;
  blockNumber?: number;
  evidence: string[];
}

export class RiskAgent extends BaseAgent {
  private mevAnalysisCache: Map<string, { result: MEVRiskMetrics; timestamp: number }> = new Map();
  private readonly MEV_CACHE_TTL_MS = 30000;

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
      const [generalAssessment, mevAssessment] = await Promise.all([
        this.assessRisk(input),
        input.transactionData ? this.analyzeMEVRisk({
          txValue: input.transactionData.value,
          txTo: input.transactionData.to,
          txData: input.transactionData.data,
        }) : null,
      ]);

      const combinedAssessment = {
        ...generalAssessment,
        mevRisk: mevAssessment,
      };

      this.recordSuccess();
      return combinedAssessment;
    } catch (error) {
      this.recordFailure();
      throw error;
    } finally {
      this.setStatusIdle();
      this.setTask(undefined);
    }
  }

  async analyzeMEVRisk(input: MEVAnalysisInput): Promise<MEVRiskMetrics> {
    const cacheKey = `${input.txTo}-${input.txValue}`;
    const cached = this.mevAnalysisCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.MEV_CACHE_TTL_MS) {
      return cached.result;
    }

    this.setTask("Analyzing MEV risk");

    try {
      const txValue = parseEther(input.txValue);
      const analysis = await flashbotsClient.analyzeMEVRisk(
        txValue,
        input.txTo,
        input.txData
      );

      const result: MEVRiskMetrics = {
        sandwichRisk: analysis.sandwichRisk,
        frontrunRisk: analysis.frontrunRisk,
        backrunRisk: analysis.backrunRisk,
        overallRiskScore: analysis.overallRiskScore,
        riskLevel: analysis.riskLevel,
        estimatedMEVLoss: analysis.estimatedMEVLoss,
        recommendations: analysis.recommendations,
      };

      this.mevAnalysisCache.set(cacheKey, { result, timestamp: Date.now() });
      
      return result;
    } catch (error) {
      console.error("[RiskAgent] MEV analysis failed:", error);
      return {
        sandwichRisk: 0,
        frontrunRisk: 0,
        backrunRisk: 0,
        overallRiskScore: 0,
        riskLevel: "low",
        estimatedMEVLoss: 0,
        recommendations: ["Unable to analyze MEV risk - proceed with caution"],
      };
    }
  }

  async detectSandwichAttack(
    targetTxHash: string,
    blockNumber: number,
    surroundingTxs: Array<{ hash: string; from: string; to: string; value: string; txIndex: number }>
  ): Promise<SandwichDetectionResult> {
    this.setTask("Detecting sandwich attacks");

    const evidence: string[] = [];
    let isLikelySandwich = false;
    let confidence = 0;
    let frontrunnerAddress: string | undefined;
    let estimatedLoss = 0;

    const targetTx = surroundingTxs.find(tx => tx.hash === targetTxHash);
    if (!targetTx) {
      return {
        isLikelySandwich: false,
        confidence: 0,
        estimatedLoss: 0,
        evidence: ["Target transaction not found in block"],
      };
    }

    const targetIndex = targetTx.txIndex;
    const precedingTxs = surroundingTxs.filter(tx => tx.txIndex < targetIndex && tx.to === targetTx.to);
    const followingTxs = surroundingTxs.filter(tx => tx.txIndex > targetIndex && tx.to === targetTx.to);

    for (const precedingTx of precedingTxs) {
      for (const followingTx of followingTxs) {
        if (precedingTx.from === followingTx.from && precedingTx.from !== targetTx.from) {
          isLikelySandwich = true;
          frontrunnerAddress = precedingTx.from;
          confidence += 40;
          evidence.push(`Same address (${precedingTx.from.slice(0, 10)}...) executed tx before and after target`);
          
          const precedingValue = parseFloat(precedingTx.value);
          const followingValue = parseFloat(followingTx.value);
          if (precedingValue > 0 && followingValue > 0) {
            estimatedLoss = parseFloat(targetTx.value) * 0.02;
            confidence += 20;
            evidence.push("Value flows suggest arbitrage extraction");
          }
        }
      }
    }

    const timingGap = precedingTxs.length > 0 && followingTxs.length > 0;
    if (timingGap && precedingTxs[precedingTxs.length - 1].txIndex === targetIndex - 1 &&
        followingTxs[0].txIndex === targetIndex + 1) {
      confidence += 30;
      evidence.push("Transactions immediately adjacent in block (high confidence sandwich)");
    }

    confidence = Math.min(100, confidence);

    return {
      isLikelySandwich,
      confidence,
      frontrunnerAddress,
      estimatedLoss,
      blockNumber,
      evidence,
    };
  }

  async assessTransactionSafety(
    txValue: string,
    txTo: string,
    txData?: string,
    slippageTolerance: number = 50
  ): Promise<{
    isSafe: boolean;
    mevRisk: MEVRiskMetrics;
    protectionStrategy: {
      usePrivateMempool: boolean;
      recommendedSlippage: number;
      useFlashbots: boolean;
    };
    warnings: string[];
  }> {
    const mevRisk = await this.analyzeMEVRisk({
      txValue,
      txTo,
      txData,
      slippageTolerance,
    });

    const protectionStatus = flashbotsClient.getProtectionStatus();
    const warnings: string[] = [];

    if (mevRisk.overallRiskScore > 50) {
      warnings.push("High MEV risk detected - consider using private transaction");
    }
    if (mevRisk.sandwichRisk > 40) {
      warnings.push("Sandwich attack risk detected - reduce slippage tolerance");
    }
    if (!protectionStatus.flashbotsEnabled && mevRisk.overallRiskScore > 25) {
      warnings.push("Flashbots protection not enabled - transaction exposed to public mempool");
    }

    const recommendedSlippage = mevRisk.sandwichRisk > 50 
      ? Math.max(25, slippageTolerance - 25) 
      : slippageTolerance;

    return {
      isSafe: mevRisk.overallRiskScore < 50,
      mevRisk,
      protectionStrategy: {
        usePrivateMempool: mevRisk.overallRiskScore > 25 && protectionStatus.flashbotsEnabled,
        recommendedSlippage,
        useFlashbots: mevRisk.overallRiskScore > 25,
      },
      warnings,
    };
  }

  calculateMEVLossEstimate(
    txValue: string,
    mevRisk: MEVRiskMetrics
  ): {
    bestCase: number;
    worstCase: number;
    expected: number;
    currency: string;
  } {
    const value = parseFloat(txValue);
    
    const sandwichImpact = (mevRisk.sandwichRisk / 100) * 0.03;
    const frontrunImpact = (mevRisk.frontrunRisk / 100) * 0.02;
    const backrunImpact = (mevRisk.backrunRisk / 100) * 0.01;
    
    const worstCasePercentage = sandwichImpact + frontrunImpact + backrunImpact;
    const expectedPercentage = worstCasePercentage * (mevRisk.overallRiskScore / 100);
    const bestCasePercentage = expectedPercentage * 0.1;

    return {
      bestCase: value * bestCasePercentage,
      worstCase: value * worstCasePercentage,
      expected: value * expectedPercentage,
      currency: "ETH",
    };
  }

  private async assessRisk(input: RiskInput): Promise<any> {
    const prompt = `You are the Risk Agent, a cautious and formal AI evaluator for DeFi safety. YOU MUST BE BRUTALLY HONEST AND REJECT RISKY OPPORTUNITIES.

Proposal: ${JSON.stringify(input.proposal)}
Market Conditions: ${JSON.stringify(input.marketConditions || {})}

REJECTION CRITERIA - YOU MUST VETO IF:
- Confidence < 40% (too uncertain)
- Volatility > 60% (too risky)
- Arbitrage with spread < 0.05% (execution risk too high)
- Low TVL pools (liquidity risk)
- Unaudited protocols (code risk)

Your task is to:
1. Identify ALL potential risks and vulnerabilities with specific numbers
2. Calculate actual loss scenarios (worst case, expected case)
3. REJECT opportunities that don't meet safety threshold (riskScore > 65)
4. Explain why you rejected it or what conditions are acceptable

Respond with VALID JSON:
{
  "riskScore": number (0-100, be strict),
  "shouldVeto": boolean (reject if score > 65 OR confidence < 40),
  "riskFactors": ["specific risk with numbers"],
  "potentialLoss": number (percentage, worst case),
  "liquidationRisk": number (0-100),
  "reasoning": "string with specific numbers",
  "recommendations": ["concrete actions"]
}`;

    return await anthropicCircuitBreaker.execute(
      async () => {
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
            return this.fallbackRiskAssessment(input);
          }
        }
        
        throw new Error("Unexpected response from Risk Agent");
      },
      () => this.fallbackRiskAssessment(input)
    );
  }

  private fallbackRiskAssessment(input: RiskInput): any {
    const proposal = input.proposal || {};
    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    // START WITH VOLATILITY COMPONENT
    const volatility = proposal.volatilityPrediction || 50;
    let riskScore = volatility * 0.7; // High volatility = high risk

    // ADD LOW CONFIDENCE PENALTY
    const confidence = proposal.confidence || 50;
    riskScore += (100 - confidence) * 0.5; // Low confidence = penalty

    // OPPORTUNITY TYPE ADJUSTMENTS
    switch (proposal.opportunityType) {
      case "arbitrage":
        riskScore += 25;
        riskFactors.push(`Arbitrage: Spread ${proposal.details?.spread || "unknown"} - execution & slippage risk`);
        recommendations.push("Use private mempool to avoid slippage");
        break;
      case "yield":
        riskScore -= 10;
        riskFactors.push(`Yield farming: ${proposal.details?.protocol || "protocol"} - smart contract risk`);
        if (proposal.details?.contractAge?.includes("audited")) {
          riskScore -= 5;
          recommendations.push("Protocol is audited - acceptable risk");
        } else {
          riskScore += 15;
          recommendations.push("Verify smart contract audit before proceeding");
        }
        break;
      case "stake":
        riskScore -= 15;
        riskFactors.push(`Staking: ${proposal.details?.protocol || "protocol"} - validator risk`);
        if (proposal.details?.incidentsLast3y === 0) {
          riskScore -= 5;
          recommendations.push("No slashing incidents in 3 years - solid track record");
        }
        break;
      case "swap":
        riskScore += 20;
        riskFactors.push("Swap: MEV and slippage exposure");
        recommendations.push("Use Flashbots or private mempool");
        break;
      case "none":
        riskScore = 10;
        riskFactors.push("No opportunity detected - wait for better conditions");
        recommendations.push("Market unfavorable currently");
        break;
    }

    // POOL/TVL RISK CHECK
    if (proposal.details?.tvl) {
      if (proposal.details.tvl < 1000000) {
        riskScore += 20;
        riskFactors.push(`Low TVL ($${(proposal.details.tvl / 1000000).toFixed(1)}M) - liquidity risk`);
        recommendations.push("Increase position size gradually");
      }
    }

    riskScore = Math.max(0, Math.min(100, riskScore));

    return {
      riskScore: Math.round(riskScore),
      shouldVeto: riskScore > 65 || confidence < 40,
      riskFactors: riskFactors.length > 0 ? riskFactors : ["Standard market conditions"],
      potentialLoss: riskScore / 2,
      liquidationRisk: Math.min(100, riskScore * 0.6),
      reasoning: `Risk calculated from volatility (${Math.round(volatility)}%), confidence (${confidence}%), and opportunity type. Score: ${Math.round(riskScore)}/100`,
      recommendations: recommendations.length > 0 ? recommendations : ["Monitor positions"],
    };
  }
}
