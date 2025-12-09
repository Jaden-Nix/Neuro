import { EventEmitter } from "events";
import { MemoryVault } from "../memory/MemoryVault";
import { selfHealingEngine, type EvolutionStrategy, type DecisionRecord } from "../selfhealing/SelfHealingEngine";
import { evolutionEngine } from "../evolution/EvolutionEngine";
import type { MemoryEntry, Agent } from "@shared/schema";

export interface LearnedWisdom {
  successPatterns: string[];
  avoidancePatterns: string[];
  confidenceModifier: number;
  riskAdjustment: number;
  contextualInsights: string[];
  recentPerformance: {
    winRate: number;
    avgConfidence: number;
    strongestSignals: string[];
  };
}

export interface LearningContext {
  symbol?: string;
  marketCondition?: "bullish" | "bearish" | "sideways" | "volatile";
  timeframe?: string;
  priceLevel?: number;
  volatility?: number;
}

export interface DecisionOutcome {
  agentId: string;
  decision: string;
  context: LearningContext;
  confidence: number;
  outcome: "success" | "failure";
  pnlPercent?: number;
  timestamp: number;
  reasoning?: string;
}

interface LearningMetrics {
  totalLearnings: number;
  successfulPatterns: number;
  avoidedMistakes: number;
  wisdomInjections: number;
  avgConfidenceBoost: number;
}

export class AgentLearningSystem extends EventEmitter {
  private memoryVault: MemoryVault;
  private learningHistory: Map<string, DecisionOutcome[]> = new Map();
  private agentWisdom: Map<string, LearnedWisdom> = new Map();
  private patternSuccessRates: Map<string, { successes: number; total: number }> = new Map();
  private metrics: LearningMetrics = {
    totalLearnings: 0,
    successfulPatterns: 0,
    avoidedMistakes: 0,
    wisdomInjections: 0,
    avgConfidenceBoost: 0,
  };

  constructor(memoryVault: MemoryVault) {
    super();
    this.memoryVault = memoryVault;
    this.initializeFromMemory();
  }

  private initializeFromMemory(): void {
    const successfulStrategies = this.memoryVault.getSuccessfulStrategies(50);
    const blockedStrategies = this.memoryVault.getBlockedStrategies(50);

    successfulStrategies.forEach(entry => {
      this.updatePatternSuccess(entry.riskPattern, true);
      entry.tags.forEach(tag => this.updatePatternSuccess(tag, true));
    });

    blockedStrategies.forEach(entry => {
      this.updatePatternSuccess(entry.riskPattern, false);
      entry.tags.forEach(tag => this.updatePatternSuccess(tag, false));
    });

    console.log(`[Learning] Initialized with ${successfulStrategies.length} successful and ${blockedStrategies.length} blocked patterns`);
  }

  private updatePatternSuccess(pattern: string, success: boolean): void {
    const stats = this.patternSuccessRates.get(pattern) || { successes: 0, total: 0 };
    stats.total++;
    if (success) stats.successes++;
    this.patternSuccessRates.set(pattern, stats);
  }

  public recordDecisionOutcome(outcome: DecisionOutcome): void {
    const history = this.learningHistory.get(outcome.agentId) || [];
    history.push(outcome);
    
    if (history.length > 500) {
      history.shift();
    }
    
    this.learningHistory.set(outcome.agentId, history);

    selfHealingEngine.recordDecision({
      agentId: outcome.agentId,
      decision: outcome.decision,
      outcome: outcome.outcome,
      timestamp: outcome.timestamp,
      context: {
        ...outcome.context,
        confidence: outcome.confidence,
        pnlPercent: outcome.pnlPercent,
      },
    });

    this.updateAgentWisdom(outcome.agentId);
    this.metrics.totalLearnings++;

    if (outcome.outcome === "success") {
      this.metrics.successfulPatterns++;
      this.storeSuccessPattern(outcome);
    } else {
      this.storeFailurePattern(outcome);
    }

    this.emit("learningRecorded", outcome);
  }

  private storeSuccessPattern(outcome: DecisionOutcome): void {
    const tags = this.extractPatternTags(outcome);
    
    this.memoryVault.store({
      strategyType: "successful",
      description: `[${outcome.agentId}] ${outcome.decision}`,
      agentScores: { [outcome.agentId]: outcome.confidence },
      riskPattern: outcome.context.marketCondition || "unknown",
      priceAnomaly: outcome.context.symbol ? `${outcome.context.symbol} @ ${outcome.context.priceLevel || 'N/A'}` : undefined,
      simulationSummary: outcome.reasoning || `Success with ${outcome.pnlPercent?.toFixed(2) || 0}% gain`,
      tags,
      timestamp: outcome.timestamp,
    });

    tags.forEach(tag => this.updatePatternSuccess(tag, true));
  }

  private storeFailurePattern(outcome: DecisionOutcome): void {
    const tags = this.extractPatternTags(outcome);
    
    this.memoryVault.store({
      strategyType: "blocked",
      description: `[${outcome.agentId}] AVOID: ${outcome.decision}`,
      agentScores: { [outcome.agentId]: -outcome.confidence },
      riskPattern: outcome.context.marketCondition || "unknown",
      priceAnomaly: outcome.context.symbol ? `${outcome.context.symbol} @ ${outcome.context.priceLevel || 'N/A'}` : undefined,
      simulationSummary: outcome.reasoning || `Failure with ${outcome.pnlPercent?.toFixed(2) || 0}% loss`,
      tags,
      timestamp: outcome.timestamp,
    });

    tags.forEach(tag => this.updatePatternSuccess(tag, false));
    this.metrics.avoidedMistakes++;
  }

  private extractPatternTags(outcome: DecisionOutcome): string[] {
    const tags: string[] = [];
    
    if (outcome.context.symbol) tags.push(`symbol:${outcome.context.symbol}`);
    if (outcome.context.marketCondition) tags.push(`market:${outcome.context.marketCondition}`);
    if (outcome.context.timeframe) tags.push(`tf:${outcome.context.timeframe}`);
    if (outcome.confidence > 80) tags.push("high_confidence");
    if (outcome.confidence < 50) tags.push("low_confidence");
    if (outcome.pnlPercent && outcome.pnlPercent > 5) tags.push("big_win");
    if (outcome.pnlPercent && outcome.pnlPercent < -5) tags.push("big_loss");
    
    return tags;
  }

  private updateAgentWisdom(agentId: string): void {
    const history = this.learningHistory.get(agentId) || [];
    if (history.length < 2) return;

    const recentHistory = history.slice(-50);
    const successes = recentHistory.filter(h => h.outcome === "success");
    const failures = recentHistory.filter(h => h.outcome === "failure");

    const winRate = recentHistory.length > 0 ? successes.length / recentHistory.length : 0.5;
    const avgConfidence = recentHistory.reduce((sum, h) => sum + h.confidence, 0) / recentHistory.length;

    const successPatterns: string[] = [];
    const avoidancePatterns: string[] = [];
    const signalCounts: Map<string, number> = new Map();

    successes.forEach(s => {
      const tags = this.extractPatternTags(s);
      tags.forEach(tag => {
        const count = signalCounts.get(tag) || 0;
        signalCounts.set(tag, count + 1);
      });
      if (s.context.marketCondition) {
        successPatterns.push(`${s.context.marketCondition} market conditions tend to work well`);
      }
    });

    failures.forEach(f => {
      if (f.context.marketCondition) {
        avoidancePatterns.push(`Be cautious in ${f.context.marketCondition} conditions - past losses`);
      }
      if (f.confidence > 80) {
        avoidancePatterns.push("High confidence decisions have sometimes failed - verify signals");
      }
    });

    const strongestSignals = Array.from(signalCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([signal]) => signal);

    const confidenceModifier = winRate > 0.6 ? 0.1 : winRate < 0.4 ? -0.15 : 0;
    const riskAdjustment = failures.length > successes.length ? -0.1 : 0.05;

    const contextualInsights: string[] = [];
    if (winRate > 0.7) {
      contextualInsights.push("Strong recent performance - maintain strategy");
    } else if (winRate < 0.4) {
      contextualInsights.push("Recent struggles - consider more conservative approach");
    }

    const wisdom: LearnedWisdom = {
      successPatterns: [...new Set(successPatterns)].slice(0, 5),
      avoidancePatterns: [...new Set(avoidancePatterns)].slice(0, 5),
      confidenceModifier,
      riskAdjustment,
      contextualInsights,
      recentPerformance: {
        winRate,
        avgConfidence,
        strongestSignals,
      },
    };

    this.agentWisdom.set(agentId, wisdom);
    this.emit("wisdomUpdated", { agentId, wisdom });
  }

  public getLearnedWisdom(agentId: string, context?: LearningContext): LearnedWisdom {
    const baseWisdom = this.agentWisdom.get(agentId) || this.getDefaultWisdom();
    
    if (!context) return baseWisdom;

    const contextualWisdom = { ...baseWisdom };

    if (context.symbol) {
      const symbolPatterns = this.getPatternsByTag(`symbol:${context.symbol}`);
      contextualWisdom.contextualInsights.push(...symbolPatterns.slice(0, 3));
    }

    if (context.marketCondition) {
      const marketPatterns = this.getPatternsByTag(`market:${context.marketCondition}`);
      contextualWisdom.contextualInsights.push(...marketPatterns.slice(0, 3));
    }

    return contextualWisdom;
  }

  private getPatternsByTag(tag: string): string[] {
    const insights: string[] = [];
    const stats = this.patternSuccessRates.get(tag);
    
    if (stats && stats.total >= 3) {
      const successRate = stats.successes / stats.total;
      if (successRate > 0.7) {
        insights.push(`${tag} has ${Math.round(successRate * 100)}% success rate - favorable`);
      } else if (successRate < 0.4) {
        insights.push(`${tag} has only ${Math.round(successRate * 100)}% success - be cautious`);
      }
    }
    
    return insights;
  }

  private getDefaultWisdom(): LearnedWisdom {
    return {
      successPatterns: [],
      avoidancePatterns: [],
      confidenceModifier: 0,
      riskAdjustment: 0,
      contextualInsights: [],
      recentPerformance: {
        winRate: 0.5,
        avgConfidence: 50,
        strongestSignals: [],
      },
    };
  }

  public generateWisdomPromptInjection(agentId: string, context?: LearningContext): string {
    const wisdom = this.getLearnedWisdom(agentId, context);
    this.metrics.wisdomInjections++;

    const lines: string[] = [];
    lines.push("\n[LEARNED INTELLIGENCE FROM PAST DECISIONS]");

    if (wisdom.recentPerformance.winRate !== 0.5) {
      lines.push(`Recent Win Rate: ${Math.round(wisdom.recentPerformance.winRate * 100)}%`);
    }

    if (wisdom.successPatterns.length > 0) {
      lines.push("\nSuccess Patterns (what has worked):");
      wisdom.successPatterns.forEach(p => lines.push(`  - ${p}`));
    }

    if (wisdom.avoidancePatterns.length > 0) {
      lines.push("\nCaution Patterns (what to avoid):");
      wisdom.avoidancePatterns.forEach(p => lines.push(`  - ${p}`));
    }

    if (wisdom.contextualInsights.length > 0) {
      lines.push("\nContextual Insights:");
      wisdom.contextualInsights.forEach(i => lines.push(`  - ${i}`));
    }

    if (wisdom.recentPerformance.strongestSignals.length > 0) {
      lines.push(`\nStrongest Signals: ${wisdom.recentPerformance.strongestSignals.join(", ")}`);
    }

    if (wisdom.confidenceModifier !== 0) {
      const direction = wisdom.confidenceModifier > 0 ? "boost" : "reduce";
      lines.push(`\nBased on performance, ${direction} confidence by ${Math.abs(wisdom.confidenceModifier * 100).toFixed(0)}%`);
    }

    if (wisdom.riskAdjustment !== 0) {
      const direction = wisdom.riskAdjustment > 0 ? "slightly increase" : "reduce";
      lines.push(`Risk tolerance suggestion: ${direction}`);
    }

    lines.push("[END LEARNED INTELLIGENCE]\n");

    return lines.join("\n");
  }

  public applyEvolutionToAgent(agent: Agent): {
    adjustedConfidenceThreshold: number;
    adjustedRiskTolerance: number;
    suggestedPersonality: string[];
  } {
    const failurePatterns = selfHealingEngine.analyzeFailurePatterns(agent.id);
    const evolutionStrategy = selfHealingEngine.generateEvolutionStrategy(agent, failurePatterns);

    const baseConfidence = 0.7;
    const baseRisk = 0.5;

    return {
      adjustedConfidenceThreshold: Math.max(0.5, Math.min(0.95, baseConfidence + evolutionStrategy.confidenceThresholdChange)),
      adjustedRiskTolerance: Math.max(0.2, Math.min(0.8, baseRisk + evolutionStrategy.riskToleranceChange)),
      suggestedPersonality: selfHealingEngine.suggestNewPersonality(
        agent.type,
        agent.personality,
        failurePatterns
      ),
    };
  }

  public shouldAgentBeMoreConservative(agentId: string): boolean {
    const wisdom = this.agentWisdom.get(agentId);
    if (!wisdom) return false;
    
    return wisdom.recentPerformance.winRate < 0.4 || wisdom.riskAdjustment < -0.05;
  }

  public shouldAgentBeMoreAggressive(agentId: string): boolean {
    const wisdom = this.agentWisdom.get(agentId);
    if (!wisdom) return false;
    
    return wisdom.recentPerformance.winRate > 0.7 && wisdom.confidenceModifier > 0.05;
  }

  public getMetrics(): LearningMetrics {
    return { ...this.metrics };
  }

  public getAgentPerformanceSummary(agentId: string): {
    totalDecisions: number;
    winRate: number;
    avgConfidence: number;
    learningActive: boolean;
    evolutionSuggestions: string[];
  } {
    const history = this.learningHistory.get(agentId) || [];
    const wisdom = this.agentWisdom.get(agentId);
    
    const successes = history.filter(h => h.outcome === "success").length;
    const winRate = history.length > 0 ? successes / history.length : 0;
    const avgConfidence = history.length > 0 
      ? history.reduce((sum, h) => sum + h.confidence, 0) / history.length 
      : 50;

    const evolutionSuggestions: string[] = [];
    if (winRate < 0.4 && history.length > 10) {
      evolutionSuggestions.push("Consider parameter adjustments - win rate below 40%");
    }
    if (wisdom?.avoidancePatterns.length && wisdom.avoidancePatterns.length > 3) {
      evolutionSuggestions.push("Multiple failure patterns identified - agent learning from mistakes");
    }

    return {
      totalDecisions: history.length,
      winRate,
      avgConfidence,
      learningActive: history.length > 5,
      evolutionSuggestions,
    };
  }
}

let learningSystemInstance: AgentLearningSystem | null = null;

export function initializeLearningSystem(memoryVault: MemoryVault): AgentLearningSystem {
  if (!learningSystemInstance) {
    learningSystemInstance = new AgentLearningSystem(memoryVault);
    console.log("[Learning] Agent Learning System initialized - agents will now get smarter over time");
  }
  return learningSystemInstance;
}

export function getLearningSystem(): AgentLearningSystem | null {
  return learningSystemInstance;
}
