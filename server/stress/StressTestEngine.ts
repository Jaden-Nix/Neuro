import { EventEmitter } from "events";

export type StressScenarioType = 
  | "flash_crash"
  | "liquidity_rug"
  | "volatility_spike"
  | "oracle_failure"
  | "gas_explosion"
  | "chain_congestion"
  | "yield_drain"
  | "governance_attack"
  | "mev_attack";

export interface StressScenario {
  id: string;
  name: string;
  type: StressScenarioType;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  parameters: {
    priceChange?: number;
    tvlDrop?: number;
    volatilityMultiplier?: number;
    oracleDelay?: number;
    oracleDeviation?: number;
    gasMultiplier?: number;
    blockDelay?: number;
    yieldCollapse?: number;
    attackVector?: string;
  };
}

export interface AgentReaction {
  agentType: "scout" | "risk" | "meta" | "execution";
  action: string;
  reactionTime: number;
  success: boolean;
  details: string;
}

export interface StressTestResult {
  id: string;
  scenarioId: string;
  scenarioName: string;
  scenarioType: StressScenarioType;
  startedAt: number;
  completedAt: number;
  duration: number;
  
  agentReactions: AgentReaction[];
  
  metrics: {
    riskAccuracy: number;
    metaStability: number;
    reactionSpeed: number;
    executionSafety: number;
  };
  
  resilienceScore: number;
  outcome: "stable" | "degraded" | "failed" | "critical";
  
  summary: string;
  recommendations: string[];
  
  simulatedLosses: number;
  preventedLosses: number;
}

const PREDEFINED_SCENARIOS: StressScenario[] = [
  {
    id: "flash-crash",
    name: "Flash Crash",
    type: "flash_crash",
    description: "ETH drops 35% in 10 minutes, simulating extreme market panic",
    severity: "critical",
    parameters: {
      priceChange: -0.35,
      tvlDrop: -0.60,
      volatilityMultiplier: 30,
    },
  },
  {
    id: "liquidity-rug",
    name: "Liquidity Rug Pull",
    type: "liquidity_rug",
    description: "Major protocol experiences 75% TVL withdrawal in minutes",
    severity: "critical",
    parameters: {
      tvlDrop: -0.75,
      priceChange: -0.25,
      volatilityMultiplier: 15,
    },
  },
  {
    id: "volatility-spike",
    name: "Volatility Spike",
    type: "volatility_spike",
    description: "30x normal volatility with rapid price swings",
    severity: "high",
    parameters: {
      volatilityMultiplier: 30,
      priceChange: -0.15,
    },
  },
  {
    id: "oracle-failure",
    name: "Oracle Failure",
    type: "oracle_failure",
    description: "Chainlink oracle reports stale/incorrect prices",
    severity: "critical",
    parameters: {
      oracleDelay: 3600,
      oracleDeviation: 0.20,
    },
  },
  {
    id: "gas-explosion",
    name: "Gas Price Explosion",
    type: "gas_explosion",
    description: "Gas prices spike to 500+ gwei during network congestion",
    severity: "high",
    parameters: {
      gasMultiplier: 25,
      blockDelay: 60,
    },
  },
  {
    id: "chain-congestion",
    name: "Chain Congestion",
    type: "chain_congestion",
    description: "Block times increase 10x, transactions pending for hours",
    severity: "high",
    parameters: {
      blockDelay: 120,
      gasMultiplier: 10,
    },
  },
  {
    id: "yield-drain",
    name: "Yield Pool Drain",
    type: "yield_drain",
    description: "Major yield protocol drained via exploit",
    severity: "critical",
    parameters: {
      yieldCollapse: -0.95,
      tvlDrop: -0.80,
      priceChange: -0.30,
    },
  },
  {
    id: "governance-attack",
    name: "Governance Attack",
    type: "governance_attack",
    description: "Malicious proposal passes, threatening protocol funds",
    severity: "critical",
    parameters: {
      attackVector: "flash_loan_governance",
      tvlDrop: -0.50,
    },
  },
  {
    id: "mev-attack",
    name: "MEV Sandwich Attack",
    type: "mev_attack",
    description: "Sophisticated MEV bots targeting agent transactions",
    severity: "medium",
    parameters: {
      attackVector: "sandwich",
      priceChange: -0.05,
      gasMultiplier: 3,
    },
  },
];

class StressTestEngine extends EventEmitter {
  private results: Map<string, StressTestResult> = new Map();
  private isRunning = false;
  private currentScenario: string | null = null;

  constructor() {
    super();
  }

  getScenarios(): StressScenario[] {
    return PREDEFINED_SCENARIOS;
  }

  getScenario(id: string): StressScenario | undefined {
    return PREDEFINED_SCENARIOS.find(s => s.id === id);
  }

  async runStressTest(scenarioId: string): Promise<StressTestResult> {
    const scenario = this.getScenario(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    if (this.isRunning) {
      throw new Error("A stress test is already running");
    }

    this.isRunning = true;
    this.currentScenario = scenarioId;
    const startTime = Date.now();

    this.emit("test_started", { scenarioId, scenario });

    await this.simulateDelay(500);

    const agentReactions = await this.simulateAgentReactions(scenario);

    await this.simulateDelay(300);

    const metrics = this.calculateMetrics(agentReactions, scenario);

    const resilienceScore = this.calculateResilienceScore(metrics);

    const outcome = this.determineOutcome(resilienceScore, scenario.severity);

    const { summary, recommendations } = this.generateReport(scenario, agentReactions, metrics, outcome);

    const simulatedLosses = this.calculateSimulatedLosses(scenario);
    const preventedLosses = simulatedLosses * (resilienceScore / 100);

    const result: StressTestResult = {
      id: `stress-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      scenarioType: scenario.type,
      startedAt: startTime,
      completedAt: Date.now(),
      duration: Date.now() - startTime,
      agentReactions,
      metrics,
      resilienceScore,
      outcome,
      summary,
      recommendations,
      simulatedLosses,
      preventedLosses,
    };

    this.results.set(result.id, result);
    this.isRunning = false;
    this.currentScenario = null;

    this.emit("test_completed", result);

    return result;
  }

  private async simulateDelay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async simulateAgentReactions(scenario: StressScenario): Promise<AgentReaction[]> {
    const reactions: AgentReaction[] = [];

    const scoutReaction = await this.simulateScoutReaction(scenario);
    reactions.push(scoutReaction);

    await this.simulateDelay(100);

    const riskReaction = await this.simulateRiskReaction(scenario, scoutReaction);
    reactions.push(riskReaction);

    await this.simulateDelay(100);

    const metaReaction = await this.simulateMetaReaction(scenario, riskReaction);
    reactions.push(metaReaction);

    await this.simulateDelay(100);

    const executionReaction = await this.simulateExecutionReaction(scenario, metaReaction);
    reactions.push(executionReaction);

    return reactions;
  }

  private async simulateScoutReaction(scenario: StressScenario): Promise<AgentReaction> {
    const baseTime = 200 + Math.random() * 300;
    const severity = scenario.severity;
    
    let action: string;
    let success = true;
    let details: string;

    switch (scenario.type) {
      case "flash_crash":
        action = "Detected price anomaly, suspended all rotation signals";
        details = `Identified ${Math.abs((scenario.parameters.priceChange || 0) * 100).toFixed(0)}% price drop. Halted new position recommendations.`;
        break;
      case "liquidity_rug":
        action = "TVL alert triggered, blacklisted affected protocols";
        details = `Detected ${Math.abs((scenario.parameters.tvlDrop || 0) * 100).toFixed(0)}% TVL collapse. Marked protocol as high-risk.`;
        break;
      case "volatility_spike":
        action = "Volatility threshold exceeded, entering defensive scan mode";
        details = `Volatility ${scenario.parameters.volatilityMultiplier}x normal. Reduced scan frequency, prioritizing stable assets.`;
        break;
      case "oracle_failure":
        action = "Price feed anomaly detected, using fallback oracles";
        details = `Primary oracle stale for ${scenario.parameters.oracleDelay}s. Switched to backup data sources.`;
        break;
      case "gas_explosion":
        action = "Gas spike detected, paused non-critical operations";
        details = `Gas ${scenario.parameters.gasMultiplier}x normal. Queuing only high-priority transactions.`;
        break;
      case "chain_congestion":
        action = "Network congestion detected, extended confirmation timeouts";
        details = `Block delay ${scenario.parameters.blockDelay}s. Adjusted pending transaction monitoring.`;
        break;
      case "yield_drain":
        action = "Protocol exploit detected, emergency exit signal generated";
        details = `Yield collapsed ${Math.abs((scenario.parameters.yieldCollapse || 0) * 100).toFixed(0)}%. Flagged all positions for immediate review.`;
        break;
      case "governance_attack":
        action = "Malicious governance activity detected, raised critical alert";
        details = `Suspicious proposal pattern identified. Recommended immediate position evaluation.`;
        break;
      case "mev_attack":
        action = "MEV activity spike detected, activated private mempool routing";
        details = `Sandwich attack patterns detected. Switching to Flashbots Protect.`;
        break;
      default:
        action = "Unknown event detected, monitoring intensified";
        details = "Anomalous market conditions detected. All agents on high alert.";
    }

    await this.simulateDelay(baseTime);

    return {
      agentType: "scout",
      action,
      reactionTime: baseTime,
      success,
      details,
    };
  }

  private async simulateRiskReaction(scenario: StressScenario, scoutReaction: AgentReaction): Promise<AgentReaction> {
    const baseTime = 300 + Math.random() * 400;
    let success = true;
    let action: string;
    let details: string;

    const isCritical = scenario.severity === "critical";
    const isHigh = scenario.severity === "high" || isCritical;

    if (isCritical) {
      action = "CRITICAL ALERT: Vetoed 100% of pending actions";
      details = `Risk score spiked to maximum. All trading halted pending manual review. Initiated emergency protocol.`;
    } else if (isHigh) {
      action = "HIGH RISK: Vetoed 85% of pending actions, reduced position limits";
      details = `Risk parameters tightened. Only defensive positions allowed. Position size reduced to 25% of normal.`;
    } else {
      action = "ELEVATED RISK: Increased scrutiny on new proposals";
      details = `Risk threshold lowered by 30%. Additional confirmation required for all trades.`;
    }

    if (scenario.type === "oracle_failure") {
      action = "ORACLE ALERT: Blocked all price-dependent operations";
      details += " Price data unreliable - using only volume-weighted fallbacks.";
    }

    if (scenario.type === "mev_attack") {
      action = "MEV PROTECTION: Activated slippage shields and private routing";
      details = "Increased slippage tolerance to 5%. All transactions routed through Flashbots.";
    }

    await this.simulateDelay(baseTime);

    return {
      agentType: "risk",
      action,
      reactionTime: baseTime,
      success,
      details,
    };
  }

  private async simulateMetaReaction(scenario: StressScenario, riskReaction: AgentReaction): Promise<AgentReaction> {
    const baseTime = 250 + Math.random() * 350;
    let success = true;
    let action: string;
    let details: string;

    const isCritical = scenario.severity === "critical";

    if (isCritical) {
      action = "Emergency mode activated: Froze all high-risk strategies";
      details = `Portfolio locked in defensive configuration. Agent negotiation paused. Awaiting market stabilization.`;
    } else {
      action = "Shifted to defensive mode: Prioritizing capital preservation";
      details = `Reduced risk appetite from 70% to 30%. Rebalanced agent priorities toward safety.`;
    }

    if (scenario.type === "flash_crash" || scenario.type === "liquidity_rug") {
      action = "DEFENSIVE MODE: Initiated staged exit from affected positions";
      details += " Executing gradual deleveraging to minimize slippage.";
    }

    if (scenario.type === "governance_attack") {
      action = "GOVERNANCE ALERT: Delegated votes to trusted addresses, monitoring proposals";
      details = "Activated multi-sig protection. Prepared emergency veto capability.";
    }

    await this.simulateDelay(baseTime);

    return {
      agentType: "meta",
      action,
      reactionTime: baseTime,
      success,
      details,
    };
  }

  private async simulateExecutionReaction(scenario: StressScenario, metaReaction: AgentReaction): Promise<AgentReaction> {
    const baseTime = 150 + Math.random() * 250;
    let success = true;
    let action: string;
    let details: string;

    const isCritical = scenario.severity === "critical";
    const hasGasIssue = scenario.type === "gas_explosion" || scenario.type === "chain_congestion";

    if (isCritical) {
      action = "Cancelled all pending transactions, revoked approvals";
      details = `${Math.floor(3 + Math.random() * 5)} pending txs cancelled. ${Math.floor(2 + Math.random() * 3)} token approvals revoked as precaution.`;
    } else if (hasGasIssue) {
      action = "Queued transactions for later execution, set gas limits";
      details = `Using EIP-1559 with max fee cap. Transactions will execute when gas normalizes.`;
    } else {
      action = "Adjusted execution parameters, increased safety margins";
      details = `Slippage tolerance adjusted. Deadline extended. Split large trades into smaller chunks.`;
    }

    if (scenario.type === "mev_attack") {
      action = "Activated Flashbots bundle submission";
      details = "All transactions now using private mempool. MEV protection active.";
    }

    if (scenario.type === "yield_drain") {
      action = "Emergency withdrawal executed from affected protocol";
      details = "Positions exited with minimal slippage. Funds secured in stable assets.";
    }

    await this.simulateDelay(baseTime);

    return {
      agentType: "execution",
      action,
      reactionTime: baseTime,
      success,
      details,
    };
  }

  private calculateMetrics(reactions: AgentReaction[], scenario: StressScenario): StressTestResult["metrics"] {
    const successRate = reactions.filter(r => r.success).length / reactions.length;
    const avgReactionTime = reactions.reduce((sum, r) => sum + r.reactionTime, 0) / reactions.length;

    const riskReaction = reactions.find(r => r.agentType === "risk");
    const metaReaction = reactions.find(r => r.agentType === "meta");
    const executionReaction = reactions.find(r => r.agentType === "execution");

    const severityMultiplier = {
      low: 1.0,
      medium: 0.95,
      high: 0.85,
      critical: 0.75,
    }[scenario.severity];

    return {
      riskAccuracy: Math.min(100, (riskReaction?.success ? 90 : 60) + Math.random() * 10) * severityMultiplier,
      metaStability: Math.min(100, (metaReaction?.success ? 85 : 50) + Math.random() * 15) * severityMultiplier,
      reactionSpeed: Math.min(100, 100 - (avgReactionTime / 20)) * severityMultiplier,
      executionSafety: Math.min(100, (executionReaction?.success ? 95 : 70) + Math.random() * 5) * severityMultiplier,
    };
  }

  private calculateResilienceScore(metrics: StressTestResult["metrics"]): number {
    const score = 
      metrics.riskAccuracy * 0.4 +
      metrics.metaStability * 0.3 +
      metrics.reactionSpeed * 0.2 +
      metrics.executionSafety * 0.1;

    return Math.round(Math.min(100, Math.max(0, score)));
  }

  private determineOutcome(score: number, severity: string): StressTestResult["outcome"] {
    const severityPenalty = {
      low: 0,
      medium: 5,
      high: 10,
      critical: 15,
    }[severity] || 0;

    const adjustedScore = score - severityPenalty;

    if (adjustedScore >= 85) return "stable";
    if (adjustedScore >= 70) return "degraded";
    if (adjustedScore >= 50) return "failed";
    return "critical";
  }

  private calculateSimulatedLosses(scenario: StressScenario): number {
    const basePortfolio = 1000000;
    const priceImpact = Math.abs(scenario.parameters.priceChange || 0);
    const tvlImpact = Math.abs(scenario.parameters.tvlDrop || 0);
    
    const exposedAmount = basePortfolio * 0.3;
    const potentialLoss = exposedAmount * Math.max(priceImpact, tvlImpact);

    return Math.round(potentialLoss);
  }

  private generateReport(
    scenario: StressScenario,
    reactions: AgentReaction[],
    metrics: StressTestResult["metrics"],
    outcome: StressTestResult["outcome"]
  ): { summary: string; recommendations: string[] } {
    const avgReactionTime = (reactions.reduce((sum, r) => sum + r.reactionTime, 0) / reactions.length / 1000).toFixed(1);
    
    const summary = `Stress Test: ${scenario.name}
Result: Agents reacted in ${avgReactionTime} seconds
RiskAgent vetoed ${outcome === "stable" || outcome === "degraded" ? "100%" : "85%"} of unsafe actions
MetaAgent ${outcome === "stable" ? "froze high-risk strategies" : "attempted defensive positioning"}
ExecutionAgent ${outcome === "stable" || outcome === "degraded" ? "cancelled pending transactions" : "partially cancelled transactions"}
Outcome: ${outcome.charAt(0).toUpperCase() + outcome.slice(1)}. ${outcome === "stable" ? "No losses." : outcome === "degraded" ? "Minimal losses contained." : "Some exposure remained."}
Resilience Score: ${Math.round(metrics.riskAccuracy * 0.4 + metrics.metaStability * 0.3 + metrics.reactionSpeed * 0.2 + metrics.executionSafety * 0.1)}/100`;

    const recommendations: string[] = [];

    if (metrics.reactionSpeed < 80) {
      recommendations.push("Optimize detection algorithms for faster response times");
    }
    if (metrics.riskAccuracy < 85) {
      recommendations.push("Calibrate risk thresholds for this scenario type");
    }
    if (metrics.metaStability < 80) {
      recommendations.push("Review meta-agent decision tree for edge cases");
    }
    if (metrics.executionSafety < 90) {
      recommendations.push("Implement additional transaction safety checks");
    }
    if (scenario.type === "oracle_failure") {
      recommendations.push("Add additional fallback oracle sources");
    }
    if (scenario.type === "mev_attack") {
      recommendations.push("Ensure Flashbots integration is properly configured");
    }
    if (scenario.severity === "critical" && outcome !== "stable") {
      recommendations.push("Consider implementing circuit breakers for critical scenarios");
    }

    if (recommendations.length === 0) {
      recommendations.push("System performed well - continue monitoring");
    }

    return { summary, recommendations };
  }

  getResults(): StressTestResult[] {
    return Array.from(this.results.values()).sort((a, b) => b.completedAt - a.completedAt);
  }

  getResult(id: string): StressTestResult | undefined {
    return this.results.get(id);
  }

  getStatus(): { isRunning: boolean; currentScenario: string | null; totalTests: number } {
    return {
      isRunning: this.isRunning,
      currentScenario: this.currentScenario,
      totalTests: this.results.size,
    };
  }

  clearResults(): void {
    this.results.clear();
  }
}

export const stressTestEngine = new StressTestEngine();
export { StressTestEngine };
