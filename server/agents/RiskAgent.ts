import { BaseAgent } from "./BaseAgent";
import { AgentType, PersonalityTrait, MEVRiskMetrics } from "@shared/schema";
import { flashbotsClient } from "../blockchain/FlashbotsClient";
import { parseEther } from "viem";
import Anthropic from "@anthropic-ai/sdk";

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
    if (!process.env.ANTHROPIC_API_KEY) {
      return this.fallbackRiskAssessment(input);
    }

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

    try {
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
    } catch (error) {
      console.error("[RiskAgent] AI assessment failed:", error);
      return this.fallbackRiskAssessment(input);
    }

    throw new Error("Unexpected response from Risk Agent");
  }

  private fallbackRiskAssessment(input: RiskInput): any {
    const proposal = input.proposal || {};
    let riskScore = 30;
    const riskFactors: string[] = [];
    const recommendations: string[] = [];

    if (proposal.value && parseFloat(proposal.value) > 10) {
      riskScore += 20;
      riskFactors.push("High transaction value");
      recommendations.push("Consider splitting into smaller transactions");
    }

    if (proposal.type === "swap") {
      riskScore += 15;
      riskFactors.push("Swap transaction type - MEV exposure");
      recommendations.push("Use private mempool or reduce slippage");
    }

    if (input.marketConditions?.volatility === "high") {
      riskScore += 25;
      riskFactors.push("High market volatility");
      recommendations.push("Wait for market stabilization");
    }

    return {
      riskScore: Math.min(100, riskScore),
      shouldVeto: riskScore > 70,
      riskFactors: riskFactors.length > 0 ? riskFactors : ["Standard transaction risk"],
      potentialLoss: riskScore / 2,
      liquidationRisk: Math.min(100, riskScore * 0.5),
      recommendations: recommendations.length > 0 ? recommendations : ["Proceed with standard caution"],
    };
  }
}
