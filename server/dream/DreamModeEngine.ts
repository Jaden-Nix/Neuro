import { EventEmitter } from "events";
import {
  DreamSession,
  DreamDiscovery,
  DreamOpportunity,
  DreamInsight,
  AgentDreamLog,
  MorningReport,
  AgentType,
} from "@shared/schema";

interface DreamCycleResult {
  opportunities: DreamOpportunity[];
  insights: DreamInsight[];
  agentLogs: AgentDreamLog[];
}

const PROTOCOLS = [
  { name: "Curve", chain: "Ethereum", baseYield: 4.5 },
  { name: "Frax", chain: "Fraxtal", baseYield: 6.2 },
  { name: "Aave", chain: "Base", baseYield: 3.8 },
  { name: "Compound", chain: "Ethereum", baseYield: 2.9 },
  { name: "Lido", chain: "Ethereum", baseYield: 3.2 },
  { name: "Uniswap", chain: "Base", baseYield: 5.1 },
  { name: "Convex", chain: "Ethereum", baseYield: 7.4 },
  { name: "Yearn", chain: "Ethereum", baseYield: 4.8 },
  { name: "GMX", chain: "Arbitrum", baseYield: 8.2 },
  { name: "Raydium", chain: "Solana", baseYield: 9.5 },
];

const POOLS = [
  "USDC-USDT", "FRAX-DAI", "ETH-USDC", "wstETH-ETH", "sfrxETH-FRAX",
  "WBTC-ETH", "DAI-USDC", "stETH-ETH", "rETH-ETH", "cbETH-ETH"
];

const DATA_SOURCES = [
  "DefiLlama", "Dune Analytics", "The Graph", "Chainlink Oracles",
  "Coingecko", "Token Terminal", "L2Beat", "Nansen"
];

class DreamModeEngine extends EventEmitter {
  private currentSession: DreamSession | null = null;
  private dreamInterval: NodeJS.Timeout | null = null;
  private cycleCount = 0;
  private allOpportunities: DreamOpportunity[] = [];
  private allInsights: DreamInsight[] = [];
  private allAgentLogs: AgentDreamLog[] = [];
  private isRunning = false;

  constructor() {
    super();
  }

  getStatus(): {
    isActive: boolean;
    session: DreamSession | null;
    cycleCount: number;
    insightsCount: number;
    opportunitiesCount: number;
  } {
    return {
      isActive: this.isRunning,
      session: this.currentSession,
      cycleCount: this.cycleCount,
      insightsCount: this.allInsights.length,
      opportunitiesCount: this.allOpportunities.length,
    };
  }

  async startDreaming(depth: number = 5): Promise<DreamSession> {
    if (this.isRunning) {
      throw new Error("Dream mode is already active");
    }

    this.isRunning = true;
    this.cycleCount = 0;
    this.allOpportunities = [];
    this.allInsights = [];
    this.allAgentLogs = [];

    this.currentSession = {
      id: `dream-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      status: "dreaming",
      startedAt: Date.now(),
      simulationsRun: 0,
      branchesExplored: 0,
      discoveries: [],
      metabolicRate: 10,
      dreamDepth: depth,
      realTimeMultiplier: 10,
    };

    this.addAgentLog(AgentType.META, "Entering dream state. Initiating overnight scans.");

    this.dreamInterval = setInterval(() => {
      this.runDreamCycle();
    }, 10000);

    await this.runDreamCycle();

    this.emit("dream_started", this.currentSession);
    return this.currentSession;
  }

  async stopDreaming(): Promise<MorningReport> {
    if (!this.isRunning || !this.currentSession) {
      throw new Error("Dream mode is not active");
    }

    if (this.dreamInterval) {
      clearInterval(this.dreamInterval);
      this.dreamInterval = null;
    }

    this.currentSession.status = "waking";
    this.addAgentLog(AgentType.META, "Waking up. Compiling morning report...");

    const report = this.generateMorningReport();

    this.currentSession.status = "awake";
    this.currentSession.endedAt = Date.now();
    this.isRunning = false;

    this.emit("dream_ended", { session: this.currentSession, report });
    return report;
  }

  private async runDreamCycle(): Promise<void> {
    if (!this.currentSession) return;

    this.cycleCount++;
    const cycleTime = new Date().toLocaleTimeString();
    
    this.addAgentLog(AgentType.SCOUT, `Scanning ${PROTOCOLS.length} protocols across ${new Set(PROTOCOLS.map(p => p.chain)).size} chains...`);

    const opportunities = this.scanForOpportunities();
    this.allOpportunities.push(...opportunities);

    if (opportunities.length > 0) {
      this.addAgentLog(AgentType.SCOUT, `Detected ${opportunities.length} yield opportunities. Best: ${opportunities[0].yield.toFixed(2)}% on ${opportunities[0].protocol}`);
    }

    this.addAgentLog(AgentType.RISK, `Evaluating ${opportunities.length} opportunities against risk parameters...`);
    const filtered = opportunities.filter(o => o.riskScore < 50);
    if (filtered.length < opportunities.length) {
      this.addAgentLog(AgentType.RISK, `Flagged ${opportunities.length - filtered.length} pools for elevated risk levels`);
    }

    const insights = this.detectInsights();
    this.allInsights.push(...insights);

    for (const insight of insights) {
      if (insight.severity === "critical" || insight.severity === "warning") {
        this.addAgentLog(AgentType.RISK, `Alert: ${insight.summary}`);
      }
    }

    this.currentSession.simulationsRun += Math.floor(Math.random() * 5) + 3;
    this.currentSession.branchesExplored += Math.floor(Math.random() * 10) + 5;

    const discoveries: DreamDiscovery[] = opportunities.slice(0, 2).map(opp => ({
      type: "opportunity" as const,
      title: `${opp.yield.toFixed(1)}% yield on ${opp.protocol} ${opp.pool}`,
      description: opp.reasoning,
      confidence: opp.confidence,
      potentialValue: opp.yield * opp.tvl / 100,
      relatedMarkets: [opp.chain, opp.protocol],
      actionable: opp.riskScore < 40,
      timestamp: Date.now(),
      source: DATA_SOURCES[Math.floor(Math.random() * DATA_SOURCES.length)],
    }));

    this.currentSession.discoveries.push(...discoveries);

    if (this.cycleCount % 3 === 0) {
      this.addAgentLog(AgentType.META, `Dream cycle ${this.cycleCount} complete. ${this.allOpportunities.length} total opportunities tracked.`);
    }

    this.emit("dream_cycle", {
      cycle: this.cycleCount,
      opportunities: opportunities.length,
      insights: insights.length,
    });
  }

  private scanForOpportunities(): DreamOpportunity[] {
    const opportunities: DreamOpportunity[] = [];
    const numOpps = Math.floor(Math.random() * 4) + 1;

    for (let i = 0; i < numOpps; i++) {
      const protocol = PROTOCOLS[Math.floor(Math.random() * PROTOCOLS.length)];
      const pool = POOLS[Math.floor(Math.random() * POOLS.length)];
      
      const yieldVariance = (Math.random() - 0.3) * 4;
      const yieldValue = Math.max(0.5, protocol.baseYield + yieldVariance);
      
      const riskScore = Math.floor(Math.random() * 60) + 10;
      const confidence = Math.random() * 0.4 + 0.55;
      const tvl = Math.floor(Math.random() * 50000000) + 1000000;
      const volume = Math.floor(tvl * (Math.random() * 0.3 + 0.05));

      const reasonings = [
        `Low volatility with stable TVL over past 24h. Strong liquidity depth.`,
        `Consistent yield with minimal impermanent loss risk. Historical stability above 95%.`,
        `High volume-to-TVL ratio suggests active market. Good exit liquidity.`,
        `Protocol has strong audit history and battle-tested contracts.`,
        `Favorable risk-reward ratio with manageable drawdown potential.`,
        `Market conditions suggest stable yields for next 48h window.`,
      ];

      opportunities.push({
        id: `opp-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        protocol: protocol.name,
        pool,
        chain: protocol.chain,
        yield: Number(yieldValue.toFixed(2)),
        riskScore,
        confidence: Number(confidence.toFixed(2)),
        reasoning: reasonings[Math.floor(Math.random() * reasonings.length)],
        tvl,
        volume24h: volume,
        timestamp: Date.now(),
      });
    }

    return opportunities.sort((a, b) => 
      (b.yield / (b.riskScore + 1)) - (a.yield / (a.riskScore + 1))
    );
  }

  private detectInsights(): DreamInsight[] {
    const insights: DreamInsight[] = [];
    const rand = Math.random();

    if (rand < 0.3) {
      const chain = ["Ethereum", "Base", "Solana", "Arbitrum"][Math.floor(Math.random() * 4)];
      const change = (Math.random() * 40 + 10).toFixed(0);
      insights.push({
        id: `ins-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        type: "volatility",
        summary: `Volatility on ${chain} increased ${change}%`,
        details: `Market data shows significant volatility increase across ${chain} DeFi protocols. Consider adjusting risk parameters.`,
        severity: Number(change) > 30 ? "warning" : "info",
        confidence: Math.random() * 0.3 + 0.65,
        timestamp: Date.now(),
        source: DATA_SOURCES[Math.floor(Math.random() * DATA_SOURCES.length)],
        data: { chain, volatilityChange: Number(change) },
      });
    }

    if (rand < 0.25) {
      const pool = POOLS[Math.floor(Math.random() * POOLS.length)];
      const spike = (Math.random() * 50 + 20).toFixed(0);
      insights.push({
        id: `ins-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        type: "tvl_change",
        summary: `TVL spike +${spike}% on ${pool} pool`,
        details: `Unusual TVL increase detected in ${pool}. This could indicate whale accumulation or protocol incentive changes.`,
        severity: "info",
        confidence: Math.random() * 0.2 + 0.7,
        timestamp: Date.now(),
        source: "DefiLlama",
        data: { pool, tvlChange: Number(spike) },
      });
    }

    if (rand < 0.2) {
      const asset1 = ["ETH", "SOL", "AVAX"][Math.floor(Math.random() * 3)];
      const asset2 = ["stablecoins", "LST pairs", "L2 tokens"][Math.floor(Math.random() * 3)];
      insights.push({
        id: `ins-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        type: "correlation",
        summary: `${asset1} and ${asset2} show inverse correlation`,
        details: `Cross-chain analysis reveals inverse price movement between ${asset1} and ${asset2}. Potential dual-rotation strategy opportunity.`,
        severity: "opportunity",
        confidence: Math.random() * 0.25 + 0.6,
        timestamp: Date.now(),
        source: "Dune Analytics",
        data: { asset1, asset2, correlationCoef: -(Math.random() * 0.4 + 0.5).toFixed(2) },
      });
    }

    if (rand < 0.15) {
      const protocol = PROTOCOLS[Math.floor(Math.random() * PROTOCOLS.length)].name;
      insights.push({
        id: `ins-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        type: "risk_warning",
        summary: `Shallow liquidity detected in ${protocol} pools`,
        details: `Recent liquidity withdrawal has reduced depth in several ${protocol} pools. Higher slippage risk for large positions.`,
        severity: "warning",
        confidence: Math.random() * 0.2 + 0.7,
        timestamp: Date.now(),
        source: "The Graph",
        data: { protocol, liquidityDrop: (Math.random() * 30 + 15).toFixed(0) + "%" },
      });
    }

    if (rand < 0.35) {
      const protocol = PROTOCOLS[Math.floor(Math.random() * PROTOCOLS.length)];
      const yieldIncrease = (Math.random() * 3 + 1).toFixed(1);
      insights.push({
        id: `ins-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        type: "yield_opportunity",
        summary: `${protocol.name} yields up ${yieldIncrease}% vs weekly average`,
        details: `${protocol.name} on ${protocol.chain} is currently offering above-average yields. Window may close in 12-24h.`,
        severity: "opportunity",
        confidence: Math.random() * 0.25 + 0.65,
        timestamp: Date.now(),
        source: "Token Terminal",
        data: { protocol: protocol.name, chain: protocol.chain, yieldDelta: Number(yieldIncrease) },
      });
    }

    return insights;
  }

  private addAgentLog(agentType: AgentType, message: string, action?: string): void {
    this.allAgentLogs.push({
      agentType,
      message,
      action,
      timestamp: Date.now(),
    });
  }

  private generateMorningReport(): MorningReport {
    if (!this.currentSession) {
      throw new Error("No active dream session");
    }

    const topOpportunities = this.allOpportunities
      .sort((a, b) => (b.yield / (b.riskScore + 1)) - (a.yield / (a.riskScore + 1)))
      .slice(0, 5);

    const recentInsights = this.allInsights
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 8);

    const passedRisk = this.allOpportunities.filter(o => o.riskScore < 40).length;
    const highConfidence = this.allOpportunities.filter(o => o.confidence > 0.75).length;

    const bestOpp = topOpportunities[0];
    let recommendedAction = "No significant opportunities found during overnight scans.";
    if (bestOpp) {
      recommendedAction = `Best risk-adjusted opportunity: Stake in ${bestOpp.protocol} ${bestOpp.pool} pool on ${bestOpp.chain} for ${bestOpp.yield.toFixed(1)}% APY.`;
    }

    const volatilityInsights = this.allInsights.filter(i => i.type === "volatility" || i.severity === "warning");
    let marketCondition: "bullish" | "bearish" | "sideways" | "volatile" = "sideways";
    if (volatilityInsights.length > 2) {
      marketCondition = "volatile";
    } else if (this.allOpportunities.filter(o => o.yield > 7).length > 3) {
      marketCondition = "bullish";
    }

    const sleepDuration = Math.floor((Date.now() - this.currentSession.startedAt) / 60000);

    this.addAgentLog(AgentType.META, `Morning report compiled. Scanned ${this.allOpportunities.length} opportunities across ${this.cycleCount} dream cycles.`);

    return {
      id: `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sessionId: this.currentSession.id,
      generatedAt: Date.now(),
      sleepDuration,
      summary: {
        totalScans: this.cycleCount * PROTOCOLS.length,
        opportunitiesFound: this.allOpportunities.length,
        passedRiskFilter: passedRisk,
        highConfidence,
      },
      topOpportunities,
      insights: recentInsights,
      agentLogs: this.allAgentLogs.slice(-20),
      recommendedAction,
      marketCondition,
    };
  }

  async generateDemoReport(): Promise<MorningReport> {
    for (let i = 0; i < 8; i++) {
      const opportunities = this.scanForOpportunities();
      this.allOpportunities.push(...opportunities);
      
      const insights = this.detectInsights();
      this.allInsights.push(...insights);
      
      this.cycleCount++;
    }

    this.addAgentLog(AgentType.SCOUT, "Completed overnight scan of 10 protocols across 5 chains");
    this.addAgentLog(AgentType.SCOUT, `Detected ${this.allOpportunities.length} yield opportunities. Best: ${this.allOpportunities[0]?.yield.toFixed(2) || 0}% on ${this.allOpportunities[0]?.protocol || 'N/A'}`);
    this.addAgentLog(AgentType.RISK, `Evaluated all opportunities against risk parameters. Flagged ${this.allOpportunities.filter(o => o.riskScore > 50).length} for elevated risk.`);
    this.addAgentLog(AgentType.META, "Adjusted strategy preference toward stable yields based on overnight analysis.");
    this.addAgentLog(AgentType.EXECUTION, "Pre-computed optimal entry points for top 3 opportunities");

    this.currentSession = {
      id: `dream-demo-${Date.now()}`,
      status: "awake",
      startedAt: Date.now() - 8 * 3600 * 1000,
      endedAt: Date.now(),
      simulationsRun: 47,
      branchesExplored: 156,
      discoveries: [],
      metabolicRate: 10,
      dreamDepth: 5,
      realTimeMultiplier: 10,
    };

    return this.generateMorningReport();
  }

  clearData(): void {
    this.allOpportunities = [];
    this.allInsights = [];
    this.allAgentLogs = [];
    this.cycleCount = 0;
  }
}

export const dreamModeEngine = new DreamModeEngine();
export { DreamModeEngine };
