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
    return 0.85;
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

    return strategy;
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

  public getAgentLineage(agentId: string): AgentLineage[] {
    return this.agentLineages.get(agentId) || [];
  }

  public getAllLineages(): Map<string, AgentLineage[]> {
    return new Map(this.agentLineages);
  }

  public getHealthHistory(agentId: string): HealthCheckResult[] {
    return this.healthHistory.get(agentId) || [];
  }

  public getSystemHealthSummary(): {
    totalAgents: number;
    healthyAgents: number;
    unhealthyAgents: number;
    deprecatedAgents: number;
    avgCreditScore: number;
    avgAccuracyRate: number;
  } {
    let totalAgents = 0;
    let healthyAgents = 0;
    let unhealthyAgents = 0;
    let deprecatedAgents = 0;
    let totalCreditScore = 0;
    let totalAccuracyRate = 0;

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
    });

    return {
      totalAgents,
      healthyAgents,
      unhealthyAgents,
      deprecatedAgents,
      avgCreditScore: totalAgents > 0 ? totalCreditScore / totalAgents : 0,
      avgAccuracyRate: totalAgents > 0 ? totalAccuracyRate / totalAgents : 0,
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

    return newPersonality.slice(0, 3);
  }
}

export const selfHealingEngine = new SelfHealingEngine();
