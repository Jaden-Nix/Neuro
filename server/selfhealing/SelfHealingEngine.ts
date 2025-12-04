import { EventEmitter } from "events";
import { PersonalityTrait, type Agent, type AgentType } from "@shared/schema";

export interface AgentLineage {
  agentId: string;
  version: number;
  parentId?: string;
  spawnedAt: number;
  deprecatedAt?: number;
  deprecationReason?: string;
  improvements: string[];
  performanceMetrics: {
    successRate: number;
    avgResponseTime: number;
    totalDecisions: number;
  };
}

export interface HealthCheckResult {
  agentId: string;
  healthy: boolean;
  issues: string[];
  recommendations: string[];
  creditScore: number;
  accuracyRate: number;
}

export interface EvolutionStrategy {
  personalityAdjustments: Partial<Record<PersonalityTrait, number>>;
  confidenceThresholdChange: number;
  riskToleranceChange: number;
  learningRateChange: number;
}

export interface DecisionRecord {
  agentId: string;
  decision: string;
  outcome: "success" | "failure" | "pending";
  timestamp: number;
  context?: Record<string, any>;
}

const DEPRECATION_THRESHOLDS = {
  minCreditScore: 100,
  minAccuracyRate: 0.6,
  maxFailureRate: 0.5,
  minDecisionsForEval: 10,
};

const PERSONALITY_EVOLUTION: Record<string, PersonalityTrait[]> = {
  scout: [PersonalityTrait.CURIOUS, PersonalityTrait.ENERGETIC],
  risk: [PersonalityTrait.CAUTIOUS, PersonalityTrait.FORMAL],
  execution: [PersonalityTrait.PRECISE, PersonalityTrait.COLD],
  meta: [PersonalityTrait.SOVEREIGN, PersonalityTrait.CALM],
};

export class SelfHealingEngine extends EventEmitter {
  private agentLineages: Map<string, AgentLineage[]> = new Map();
  private healthHistory: Map<string, HealthCheckResult[]> = new Map();
  private decisionRecords: Map<string, DecisionRecord[]> = new Map();
  private monitoringInterval?: NodeJS.Timeout;
  private isMonitoring: boolean = false;

  public startMonitoring(intervalMs: number = 60000): void {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    this.monitoringInterval = setInterval(() => {
      this.emit("healthCheckStarted");
    }, intervalMs);

    this.emit("monitoringStarted");
  }

  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    this.isMonitoring = false;
    this.emit("monitoringStopped");
  }

  public recordDecision(record: DecisionRecord): void {
    const agentRecords = this.decisionRecords.get(record.agentId) || [];
    agentRecords.push(record);
    
    if (agentRecords.length > 1000) {
      agentRecords.shift();
    }
    
    this.decisionRecords.set(record.agentId, agentRecords);
    this.emit("decisionRecorded", record);
  }

  public updateDecisionOutcome(
    agentId: string, 
    timestamp: number, 
    outcome: "success" | "failure"
  ): void {
    const records = this.decisionRecords.get(agentId) || [];
    const record = records.find(r => r.timestamp === timestamp);
    if (record) {
      record.outcome = outcome;
      this.emit("decisionOutcomeUpdated", { agentId, timestamp, outcome });
    }
  }

  public evaluateAgentHealth(agent: Agent): HealthCheckResult {
    const issues: string[] = [];
    const recommendations: string[] = [];

    const accuracyRate = this.calculateAccuracyRate(agent);

    if (agent.creditScore < DEPRECATION_THRESHOLDS.minCreditScore) {
      issues.push(`Credit score (${agent.creditScore}) below threshold (${DEPRECATION_THRESHOLDS.minCreditScore})`);
      recommendations.push("Consider spawning replacement agent with adjusted parameters");
    }

    if (accuracyRate < DEPRECATION_THRESHOLDS.minAccuracyRate) {
      issues.push(`Accuracy rate (${(accuracyRate * 100).toFixed(1)}%) below threshold (${DEPRECATION_THRESHOLDS.minAccuracyRate * 100}%)`);
      recommendations.push("Agent should learn from failed decisions in memory vault");
    }

    if (agent.status === "deprecated") {
      issues.push("Agent has been deprecated");
    }

    const recentHealth = this.getRecentHealthTrend(agent.id);
    if (recentHealth.declining) {
      issues.push("Health metrics showing declining trend");
      recommendations.push("Consider personality adjustments or parameter tuning");
    }

    const result: HealthCheckResult = {
      agentId: agent.id,
      healthy: issues.length === 0,
      issues,
      recommendations,
      creditScore: agent.creditScore,
      accuracyRate,
    };

    this.recordHealthCheck(agent.id, result);
    return result;
  }

  private calculateAccuracyRate(agent: Agent): number {
    const records = this.decisionRecords.get(agent.id) || [];
    
    if (records.length < DEPRECATION_THRESHOLDS.minDecisionsForEval) {
      const baseAccuracy = Math.min(1, agent.creditScore / 1000);
      return Math.max(0.5, Math.min(0.9, baseAccuracy + 0.4));
    }
    
    const resolvedDecisions = records.filter(r => r.outcome !== "pending");
    if (resolvedDecisions.length === 0) {
      return 0.75;
    }
    
    const successfulDecisions = resolvedDecisions.filter(r => r.outcome === "success");
    const rawAccuracy = successfulDecisions.length / resolvedDecisions.length;
    
    const recentDecisions = resolvedDecisions.slice(-50);
    const recentSuccesses = recentDecisions.filter(r => r.outcome === "success").length;
    const recentAccuracy = recentDecisions.length > 0 
      ? recentSuccesses / recentDecisions.length 
      : rawAccuracy;
    
    const weightedAccuracy = (rawAccuracy * 0.3) + (recentAccuracy * 0.7);
    
    return Math.round(weightedAccuracy * 100) / 100;
  }

  private getRecentHealthTrend(agentId: string): { declining: boolean; trend: number } {
    const history = this.healthHistory.get(agentId) || [];
    if (history.length < 5) {
      return { declining: false, trend: 0 };
    }

    const recent = history.slice(-5);
    let declineCount = 0;
    
    for (let i = 1; i < recent.length; i++) {
      if (recent[i].accuracyRate < recent[i - 1].accuracyRate) {
        declineCount++;
      }
    }

    const trend = (recent[recent.length - 1].accuracyRate - recent[0].accuracyRate) / recent[0].accuracyRate;
    
    return {
      declining: declineCount >= 3 || trend < -0.1,
      trend,
    };
  }

  private recordHealthCheck(agentId: string, result: HealthCheckResult): void {
    const history = this.healthHistory.get(agentId) || [];
    history.push(result);

    if (history.length > 100) {
      history.shift();
    }

    this.healthHistory.set(agentId, history);
  }

  public shouldDeprecate(agent: Agent): boolean {
    const healthCheck = this.evaluateAgentHealth(agent);
    
    return (
      agent.creditScore < DEPRECATION_THRESHOLDS.minCreditScore ||
      healthCheck.accuracyRate < DEPRECATION_THRESHOLDS.minAccuracyRate
    );
  }

  public generateEvolutionStrategy(
    deprecatedAgent: Agent,
    failurePatterns: string[]
  ): EvolutionStrategy {
    const strategy: EvolutionStrategy = {
      personalityAdjustments: {},
      confidenceThresholdChange: 0,
      riskToleranceChange: 0,
      learningRateChange: 0,
    };

    if (failurePatterns.includes("high_risk_decisions")) {
      strategy.riskToleranceChange = -0.1;
      strategy.confidenceThresholdChange = 0.05;
    }

    if (failurePatterns.includes("slow_response")) {
      strategy.learningRateChange = 0.1;
    }

    if (failurePatterns.includes("missed_opportunities")) {
      strategy.confidenceThresholdChange = -0.05;
    }

    if (failurePatterns.includes("overconfident")) {
      strategy.confidenceThresholdChange = 0.1;
      strategy.riskToleranceChange = -0.05;
    }

    if (failurePatterns.includes("too_conservative")) {
      strategy.riskToleranceChange = 0.08;
      strategy.confidenceThresholdChange = -0.03;
    }

    const records = this.decisionRecords.get(deprecatedAgent.id) || [];
    const recentFailures = records.slice(-20).filter(r => r.outcome === "failure");
    if (recentFailures.length > 10) {
      strategy.learningRateChange += 0.15;
    }

    return strategy;
  }

  public analyzeFailurePatterns(agentId: string): string[] {
    const patterns: string[] = [];
    const records = this.decisionRecords.get(agentId) || [];
    
    if (records.length < 10) return patterns;

    const failures = records.filter(r => r.outcome === "failure");
    const failureRate = failures.length / records.length;
    
    if (failureRate > 0.4) {
      patterns.push("high_failure_rate");
    }

    const recentRecords = records.slice(-10);
    const recentFailures = recentRecords.filter(r => r.outcome === "failure");
    if (recentFailures.length >= 7) {
      patterns.push("recent_failure_streak");
    }

    const highRiskFailures = failures.filter(
      r => r.context?.riskLevel && r.context.riskLevel > 0.7
    );
    if (highRiskFailures.length / failures.length > 0.5) {
      patterns.push("high_risk_decisions");
    }

    const missedOpportunities = records.filter(
      r => r.context?.wasOpportunity && r.outcome === "failure"
    );
    if (missedOpportunities.length > 5) {
      patterns.push("missed_opportunities");
    }

    const overconfidentFails = failures.filter(
      r => r.context?.confidence && r.context.confidence > 0.8
    );
    if (overconfidentFails.length / failures.length > 0.4) {
      patterns.push("overconfident");
    }

    const successfulRecords = records.filter(r => r.outcome === "success");
    const conservativeWins = successfulRecords.filter(
      r => r.context?.potentialGain && r.context.potentialGain < 0.02
    );
    if (conservativeWins.length / successfulRecords.length > 0.7) {
      patterns.push("too_conservative");
    }

    return patterns;
  }

  public recordLineage(
    newAgentId: string,
    version: number,
    parentId?: string,
    deprecationReason?: string,
    improvements: string[] = []
  ): void {
    const lineage: AgentLineage = {
      agentId: newAgentId,
      version,
      parentId,
      spawnedAt: Date.now(),
      deprecationReason,
      improvements,
      performanceMetrics: {
        successRate: 0,
        avgResponseTime: 0,
        totalDecisions: 0,
      },
    };

    const familyTree = this.agentLineages.get(parentId || newAgentId) || [];
    familyTree.push(lineage);
    this.agentLineages.set(parentId || newAgentId, familyTree);

    this.emit("lineageRecorded", lineage);
  }

  public updateLineageMetrics(
    agentId: string,
    metrics: Partial<AgentLineage["performanceMetrics"]>
  ): void {
    for (const [rootId, lineages] of this.agentLineages) {
      const lineage = lineages.find(l => l.agentId === agentId);
      if (lineage) {
        Object.assign(lineage.performanceMetrics, metrics);
        this.emit("lineageMetricsUpdated", { agentId, metrics });
        return;
      }
    }
  }

  public getAgentLineage(agentId: string): AgentLineage[] {
    return this.agentLineages.get(agentId) || [];
  }

  public getAllLineages(): Map<string, AgentLineage[]> {
    return new Map(this.agentLineages);
  }

  public getHealthHistory(agentId: string): HealthCheckResult[] {
    return this.healthHistory.get(agentId) || [];
  }

  public getDecisionRecords(agentId: string): DecisionRecord[] {
    return this.decisionRecords.get(agentId) || [];
  }

  public getSystemHealthSummary(): {
    totalAgents: number;
    healthyAgents: number;
    unhealthyAgents: number;
    deprecatedAgents: number;
    avgCreditScore: number;
    avgAccuracyRate: number;
    totalDecisions: number;
    overallSuccessRate: number;
  } {
    let totalAgents = 0;
    let healthyAgents = 0;
    let unhealthyAgents = 0;
    let deprecatedAgents = 0;
    let totalCreditScore = 0;
    let totalAccuracyRate = 0;
    let totalDecisions = 0;
    let totalSuccesses = 0;

    this.healthHistory.forEach((history, agentId) => {
      if (history.length > 0) {
        totalAgents++;
        const latest = history[history.length - 1];
        
        if (latest.healthy) {
          healthyAgents++;
        } else {
          unhealthyAgents++;
        }
        
        totalCreditScore += latest.creditScore;
        totalAccuracyRate += latest.accuracyRate;
      }

      const decisions = this.decisionRecords.get(agentId) || [];
      const resolved = decisions.filter(d => d.outcome !== "pending");
      totalDecisions += resolved.length;
      totalSuccesses += resolved.filter(d => d.outcome === "success").length;
    });

    return {
      totalAgents,
      healthyAgents,
      unhealthyAgents,
      deprecatedAgents,
      avgCreditScore: totalAgents > 0 ? totalCreditScore / totalAgents : 0,
      avgAccuracyRate: totalAgents > 0 ? totalAccuracyRate / totalAgents : 0,
      totalDecisions,
      overallSuccessRate: totalDecisions > 0 ? totalSuccesses / totalDecisions : 0,
    };
  }

  public suggestNewPersonality(
    agentType: AgentType,
    currentPersonality: PersonalityTrait[],
    failurePatterns: string[]
  ): PersonalityTrait[] {
    const availableTraits = PERSONALITY_EVOLUTION[agentType] || [];
    const newPersonality = [...currentPersonality];

    if (failurePatterns.includes("too_aggressive") && agentType === "risk") {
      const idx = newPersonality.indexOf(PersonalityTrait.FORMAL);
      if (idx === -1) newPersonality.push(PersonalityTrait.CAUTIOUS);
    }

    if (failurePatterns.includes("too_slow") && agentType === "scout") {
      const idx = newPersonality.indexOf(PersonalityTrait.CURIOUS);
      if (idx === -1) newPersonality.push(PersonalityTrait.ENERGETIC);
    }

    if (failurePatterns.includes("overconfident") && agentType === "execution") {
      if (!newPersonality.includes(PersonalityTrait.CAUTIOUS)) {
        newPersonality.push(PersonalityTrait.CAUTIOUS);
      }
    }

    if (failurePatterns.includes("too_conservative") && agentType === "scout") {
      if (!newPersonality.includes(PersonalityTrait.CURIOUS)) {
        newPersonality.push(PersonalityTrait.CURIOUS);
      }
    }

    return newPersonality.slice(0, 3);
  }
}

export const selfHealingEngine = new SelfHealingEngine();
