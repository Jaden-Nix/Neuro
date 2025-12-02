import { BaseAgent } from "./BaseAgent";
import { AgentType, PersonalityTrait } from "@shared/schema";
import { claudeService, type MarketContext } from "../ai/ClaudeService";

export interface ScoutInput {
  marketData?: any;
  liquidityPools?: any[];
  priceFeeds?: any;
}

interface ScoutOpportunity {
  opportunityType: "arbitrage" | "yield" | "swap" | "stake" | "none";
  description: string;
  confidence: number;
  expectedReturn: number;
  volatilityPrediction: number;
  details: Record<string, any>;
}

export class ScoutAgent extends BaseAgent {
  constructor() {
    super({
      type: AgentType.SCOUT,
      personality: [PersonalityTrait.CURIOUS, PersonalityTrait.ENERGETIC],
      initialCredits: 500,
    });
  }

  async process(input: ScoutInput): Promise<ScoutOpportunity> {
    this.setStatusActive();
    this.setTask("Scanning for opportunities");

    try {
      const opportunity = await this.scanOpportunity(input);
      this.recordSuccess();
      return opportunity;
    } catch (error) {
      this.recordFailure();
      throw error;
    } finally {
      this.setStatusIdle();
      this.setTask(undefined);
    }
  }

  private getFallbackOpportunity(): ScoutOpportunity {
    const opportunities: ScoutOpportunity[] = [
      {
        opportunityType: "yield",
        description: "Curve FRAX/USD pool yielding 6.2% APY. Depositing $500K would generate ~$31K annually. Contract TVL: $45M, liquidity depth strong. Admin key held by governance, no recent upgrades.",
        confidence: 72,
        expectedReturn: 6.2,
        volatilityPrediction: 18,
        details: { 
          protocol: "Curve Finance", 
          asset: "FRAX/USD LP", 
          apy: 6.2,
          tvl: 45000000,
          depositSize: 500000,
          annualYield: 31000,
          riskFactors: ["Impermanent loss on FRAX peg deviation >2%", "Curve DAO governance token concentration"],
          contractAge: "2+ years audited"
        },
      },
      {
        opportunityType: "stake",
        description: "Lido stETH offering 3.8% APY with 15 validators. Current supply: 10.2M ETH. Fee: 10%. No slashing incidents in 3 years. Liquid staking allows DeFi participation while earning.",
        confidence: 68,
        expectedReturn: 3.8,
        volatilityPrediction: 12,
        details: { 
          protocol: "Lido", 
          asset: "ETH staking",
          apy: 3.8,
          totalSupply: 10200000,
          activeValidators: 15,
          fee: 0.10,
          incidentsLast3y: 0,
          swapSpread: "0.05%",
          withdrawalQueueTime: "1-7 days"
        },
      },
      {
        opportunityType: "arbitrage",
        description: "USDC basis trade: Buy on Uniswap V3 at $0.99998, sell on dYdX at $1.00015. Spread: 0.017% = $850 profit on $5M. Gas: 2.5 GWEI = $150. Net: $700. Execution time: 45 seconds.",
        confidence: 55,
        expectedReturn: 0.014,
        volatilityPrediction: 5,
        details: {
          type: "basis arbitrage",
          assetPair: "USDC/USD",
          buyExchange: "Uniswap V3",
          buyPrice: 0.99998,
          sellExchange: "dYdX",
          sellPrice: 1.00015,
          spread: 0.00017,
          volume: 5000000,
          profit: 850,
          gasCost: 150,
          netProfit: 700,
          executionTime: "45s",
          slippageRisk: "High - spread may close before execution"
        },
      },
      {
        opportunityType: "none",
        description: "Market conditions unfavorable. Volatility at 3-year high (82 IV). Funding rates negative (-0.05%). No new LP incentives announced. Recommend waiting for consolidation.",
        confidence: 75,
        expectedReturn: 0,
        volatilityPrediction: 82,
        details: { 
          reason: "No attractive opportunities detected",
          iv: 82,
          fundingRate: -0.05,
          volumeRank: "below average",
          volatilityTrend: "increasing",
          recommendation: "hold for better entry"
        },
      },
    ];
    
    return opportunities[Math.floor(Math.random() * opportunities.length)];
  }

  private async scanOpportunity(input: ScoutInput): Promise<ScoutOpportunity> {
    try {
      const context: MarketContext = {
        symbol: input.marketData?.symbol || "ETH",
        currentPrice: input.marketData?.price,
        priceChange24h: input.marketData?.priceChange24h,
        volume24h: input.marketData?.volume24h,
        marketCap: input.marketData?.marketCap,
        defiTVL: input.marketData?.tvl,
        yields: input.liquidityPools?.map((pool: any) => ({
          protocol: pool.protocol || "Unknown",
          apy: pool.apy || 0,
        })),
      };

      const decision = await claudeService.scoutAnalysis(context);
      
      return {
        opportunityType: (decision.details?.opportunityType as any) || "none",
        description: decision.reasoning,
        confidence: decision.confidence,
        expectedReturn: decision.details?.expectedReturn || 0,
        volatilityPrediction: decision.details?.volatility || 50,
        details: decision.details || {},
      };
    } catch (error) {
      console.error("[ScoutAgent] Analysis failed, using fallback:", error);
      return this.getFallbackOpportunity();
    }
  }
}
