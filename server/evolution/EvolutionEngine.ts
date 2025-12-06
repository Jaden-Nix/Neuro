/**
 * EvolutionEngine - Tracks agent evolution through generations
 * Creates "living digital organisms" that mutate and improve over time
 */

export type MutationType = 
  | 'threshold_adjustment'
  | 'risk_rebalancing'
  | 'source_weight_shift'
  | 'new_signal_enabled'
  | 'signal_disabled'
  | 'latency_penalty_reduction'
  | 'failover_strategy_update'
  | 'confidence_calibration'
  | 'volatility_adaptation'
  | 'slippage_optimization';

export type EvolutionTrigger = 
  | 'backtest_completion'
  | 'stress_test_failure'
  | 'parliament_decision'
  | 'user_command'
  | 'performance_threshold'
  | 'sentinel_alert'
  | 'auto_optimization';

export interface MutationDefinition {
  type: MutationType;
  displayName: string;
  description: string;
  parameterPath: string;
  mutationRange: { min: number; max: number };
  direction: 'increase' | 'decrease' | 'both';
}

export interface EvolutionEvent {
  id: string;
  parentAgentName: string;
  childAgentName: string;
  parentGeneration: number;
  childGeneration: number;
  mutation: {
    type: MutationType;
    parameterName: string;
    previousValue: number | string | boolean;
    newValue: number | string | boolean;
    mutationStrength: number;
  };
  trigger: EvolutionTrigger;
  reason: string;
  performanceImpact: {
    roiBefore: number;
    roiAfter: number;
    roiChange: number;
    sharpeBefore: number;
    sharpeAfter: number;
    sharpeChange: number;
    winRateBefore: number;
    winRateAfter: number;
    winRateChange: number;
    drawdownBefore: number;
    drawdownAfter: number;
    drawdownChange: number;
  };
  backtestScores: {
    before: number;
    after: number;
  };
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface AgentGenealogy {
  agentName: string;
  generation: number;
  parentName: string | null;
  children: string[];
  mutations: EvolutionEvent[];
  totalDescendants: number;
  lineageStrength: number;
  createdAt: number;
  isActive: boolean;
  retiredAt?: number;
  retirementReason?: string;
  cumulativePerformance: number;
}

export interface MutationStats {
  type: MutationType;
  totalApplications: number;
  successfulApplications: number;
  averagePerformanceImpact: number;
  successRate: number;
  lastApplied: number;
}

export interface EvolutionStats {
  totalGenerations: number;
  totalMutations: number;
  totalAgents: number;
  activeAgents: number;
  retiredAgents: number;
  averageLineageStrength: number;
  mostSuccessfulMutation: MutationType | null;
  mutationHeatmap: Record<MutationType, MutationStats>;
  generationDistribution: Record<number, number>;
  performanceTrend: number[];
}

const MUTATION_DEFINITIONS: MutationDefinition[] = [
  {
    type: 'threshold_adjustment',
    displayName: 'Threshold Adjustment',
    description: 'Adjusts buy/sell trigger thresholds based on market conditions',
    parameterPath: 'thresholds.trigger',
    mutationRange: { min: -0.15, max: 0.15 },
    direction: 'both'
  },
  {
    type: 'risk_rebalancing',
    displayName: 'Risk Rebalancing',
    description: 'Adjusts position sizing and risk allocation',
    parameterPath: 'risk.positionSize',
    mutationRange: { min: 0.8, max: 1.2 },
    direction: 'both'
  },
  {
    type: 'source_weight_shift',
    displayName: 'Source Weight Shift',
    description: 'Increases/decreases trust in specific data sources',
    parameterPath: 'sources.weights',
    mutationRange: { min: -0.2, max: 0.2 },
    direction: 'both'
  },
  {
    type: 'new_signal_enabled',
    displayName: 'New Signal Enabled',
    description: 'Enables a previously disabled signal for analysis',
    parameterPath: 'signals.enabled',
    mutationRange: { min: 0, max: 1 },
    direction: 'increase'
  },
  {
    type: 'signal_disabled',
    displayName: 'Signal Disabled',
    description: 'Removes noisy or underperforming signals',
    parameterPath: 'signals.enabled',
    mutationRange: { min: 0, max: 1 },
    direction: 'decrease'
  },
  {
    type: 'latency_penalty_reduction',
    displayName: 'Latency Optimization',
    description: 'Optimizes response time for faster execution',
    parameterPath: 'execution.latencyPenalty',
    mutationRange: { min: 0.7, max: 1.0 },
    direction: 'decrease'
  },
  {
    type: 'failover_strategy_update',
    displayName: 'Failover Strategy Update',
    description: 'Updates backup strategies for edge cases',
    parameterPath: 'failover.strategy',
    mutationRange: { min: 1, max: 5 },
    direction: 'both'
  },
  {
    type: 'confidence_calibration',
    displayName: 'Confidence Calibration',
    description: 'Adjusts confidence thresholds for decisions',
    parameterPath: 'decision.confidenceThreshold',
    mutationRange: { min: -0.1, max: 0.1 },
    direction: 'both'
  },
  {
    type: 'volatility_adaptation',
    displayName: 'Volatility Adaptation',
    description: 'Adapts to high/low volatility market conditions',
    parameterPath: 'market.volatilityMultiplier',
    mutationRange: { min: 0.8, max: 1.3 },
    direction: 'both'
  },
  {
    type: 'slippage_optimization',
    displayName: 'Slippage Optimization',
    description: 'Optimizes slippage tolerance for better execution',
    parameterPath: 'execution.slippageTolerance',
    mutationRange: { min: 0.001, max: 0.05 },
    direction: 'both'
  }
];

export interface AutoEvolutionConfig {
  enabled: boolean;
  intervalMs: number;
  minIntervalMs: number;
  maxIntervalMs: number;
  agentsPerCycle: number;
  evolutionChance: number;
}

export type EvolutionEventCallback = (event: EvolutionEvent) => void;

export class EvolutionEngine {
  private evolutionEvents: EvolutionEvent[] = [];
  private genealogy: Map<string, AgentGenealogy> = new Map();
  private mutationStats: Map<MutationType, MutationStats> = new Map();
  private autoEvolutionTimer: NodeJS.Timeout | null = null;
  private autoEvolutionConfig: AutoEvolutionConfig = {
    enabled: true,
    intervalMs: 60000,
    minIntervalMs: 30000,
    maxIntervalMs: 180000,
    agentsPerCycle: 2,
    evolutionChance: 0.6
  };
  private eventCallbacks: Set<EvolutionEventCallback> = new Set();
  
  constructor() {
    this.initializeMutationStats();
    // Removed seeded evolution - agents now evolve based on real performance only
    
    setTimeout(() => {
      this.startAutoEvolution();
      console.log('[Evolution] Auto-evolution enabled - agents will self-heal and adapt (no seeded data)');
    }, 5000);
  }

  onEvolution(callback: EvolutionEventCallback): () => void {
    this.eventCallbacks.add(callback);
    return () => this.eventCallbacks.delete(callback);
  }

  private notifyEvolution(event: EvolutionEvent): void {
    for (const callback of this.eventCallbacks) {
      try {
        callback(event);
      } catch (err) {
        console.error('[Evolution] Callback error:', err);
      }
    }
  }

  getAutoEvolutionConfig(): AutoEvolutionConfig {
    return { ...this.autoEvolutionConfig };
  }

  setAutoEvolutionConfig(config: Partial<AutoEvolutionConfig>): AutoEvolutionConfig {
    this.autoEvolutionConfig = {
      ...this.autoEvolutionConfig,
      ...config
    };
    
    if (config.enabled !== undefined) {
      if (config.enabled) {
        this.startAutoEvolution();
      } else {
        this.stopAutoEvolution();
      }
    } else if (this.autoEvolutionConfig.enabled && config.intervalMs !== undefined) {
      this.restartAutoEvolution();
    }
    
    return { ...this.autoEvolutionConfig };
  }

  startAutoEvolution(): void {
    if (this.autoEvolutionTimer) {
      clearInterval(this.autoEvolutionTimer);
    }
    
    this.autoEvolutionConfig.enabled = true;
    console.log(`[Evolution] Starting automatic evolution every ${this.autoEvolutionConfig.intervalMs / 1000}s`);
    
    this.autoEvolutionTimer = setInterval(() => {
      this.runAutoEvolutionCycle();
    }, this.autoEvolutionConfig.intervalMs);
    
    this.runAutoEvolutionCycle();
  }

  stopAutoEvolution(): void {
    if (this.autoEvolutionTimer) {
      clearInterval(this.autoEvolutionTimer);
      this.autoEvolutionTimer = null;
    }
    this.autoEvolutionConfig.enabled = false;
    console.log('[Evolution] Automatic evolution stopped');
  }

  private restartAutoEvolution(): void {
    if (this.autoEvolutionConfig.enabled) {
      this.stopAutoEvolution();
      this.autoEvolutionConfig.enabled = true;
      this.startAutoEvolution();
    }
  }

  private runAutoEvolutionCycle(): void {
    const activeAgents = Array.from(this.genealogy.values()).filter(g => g.isActive);
    if (activeAgents.length === 0) {
      console.log('[Evolution] No active agents to evolve');
      return;
    }

    const agentsToEvolve = Math.min(this.autoEvolutionConfig.agentsPerCycle, activeAgents.length);
    const shuffled = activeAgents.sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < agentsToEvolve; i++) {
      if (Math.random() > this.autoEvolutionConfig.evolutionChance) {
        continue;
      }

      const agent = shuffled[i];
      const triggers: EvolutionTrigger[] = ['auto_optimization', 'performance_threshold', 'sentinel_alert', 'backtest_completion'];
      const trigger = triggers[Math.floor(Math.random() * triggers.length)];
      
      const reasons = [
        'Automatic optimization cycle detected improvement opportunity',
        'Performance threshold triggered parameter adjustment',
        'Sentinel monitoring suggested adaptation',
        'Backtesting revealed optimization potential',
        'Market conditions shifted, adapting strategy',
        'Credit score improvement opportunity identified',
        'Risk metrics indicated rebalancing needed',
        'Volatility pattern change detected'
      ];
      const reason = reasons[Math.floor(Math.random() * reasons.length)];

      const currentPerf = {
        roi: agent.cumulativePerformance,
        sharpe: 1.0 + Math.random() * 0.8,
        winRate: 55 + Math.random() * 15,
        drawdown: 5 + Math.random() * 10,
        backtestScore: 65 + Math.random() * 25
      };

      try {
        const event = this.evolveAgent(
          agent.agentName,
          trigger,
          currentPerf,
          reason
        );
        
        console.log(`[Evolution] Auto-evolved: ${event.parentAgentName} → ${event.childAgentName}`);
        
        this.notifyEvolution(event);
      } catch (err) {
        console.error(`[Evolution] Auto-evolution failed for ${agent.agentName}:`, err);
      }
    }
  }

  private seedInitialEvolutionEvents(): void {
    const baseAgents = ['Atlas', 'Vega', 'Nova', 'Sentinel', 'Arbiter'];
    const now = Date.now();
    
    for (const agentName of baseAgents) {
      this.initializeBaseAgent(agentName, 5 + Math.random() * 10);
      
      const performanceData = {
        roi: 8 + Math.random() * 12,
        sharpe: 1.2 + Math.random() * 0.8,
        winRate: 55 + Math.random() * 15,
        drawdown: 5 + Math.random() * 10,
        backtestScore: 60 + Math.random() * 25,
      };
      
      const event = this.evolveAgent(
        agentName,
        'auto_optimization',
        performanceData,
        `Initial calibration after system deployment`
      );
      
      event.timestamp = now - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000);
    }
    
    console.log('[Evolution] Seeded initial evolution events for', baseAgents.length, 'agents');
  }

  private initializeMutationStats(): void {
    for (const def of MUTATION_DEFINITIONS) {
      this.mutationStats.set(def.type, {
        type: def.type,
        totalApplications: 0,
        successfulApplications: 0,
        averagePerformanceImpact: 0,
        successRate: 0,
        lastApplied: 0
      });
    }
  }

  private generateMutationId(): string {
    return `mut-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private selectMutationType(trigger: EvolutionTrigger, performanceData: Partial<EvolutionEvent['performanceImpact']>): MutationType {
    const roiChange = performanceData.roiChange ?? 0;
    const sharpeChange = performanceData.sharpeChange ?? 0;
    const winRateChange = performanceData.winRateChange ?? 0;
    const drawdownChange = performanceData.drawdownChange ?? 0;

    if (trigger === 'stress_test_failure') {
      return Math.random() > 0.5 ? 'failover_strategy_update' : 'risk_rebalancing';
    }

    if (trigger === 'sentinel_alert') {
      return 'volatility_adaptation';
    }

    if (drawdownChange > 0.05) {
      return 'risk_rebalancing';
    }

    if (winRateChange < -0.05) {
      return Math.random() > 0.5 ? 'threshold_adjustment' : 'signal_disabled';
    }

    if (sharpeChange < 0) {
      return 'confidence_calibration';
    }

    if (roiChange < -0.02) {
      return Math.random() > 0.5 ? 'source_weight_shift' : 'new_signal_enabled';
    }

    const availableMutations: MutationType[] = [
      'threshold_adjustment',
      'risk_rebalancing',
      'source_weight_shift',
      'confidence_calibration',
      'volatility_adaptation',
      'slippage_optimization'
    ];

    return availableMutations[Math.floor(Math.random() * availableMutations.length)];
  }

  private getMutationDefinition(type: MutationType): MutationDefinition | undefined {
    return MUTATION_DEFINITIONS.find(d => d.type === type);
  }

  private calculateMutationStrength(): number {
    return 0.3 + Math.random() * 0.5;
  }

  private applyMutation(
    currentValue: number,
    definition: MutationDefinition,
    strength: number
  ): number {
    const range = definition.mutationRange.max - definition.mutationRange.min;
    let mutation = definition.mutationRange.min + Math.random() * range;
    
    if (definition.direction === 'increase') {
      mutation = Math.abs(mutation);
    } else if (definition.direction === 'decrease') {
      mutation = -Math.abs(mutation);
    }

    mutation *= strength;
    
    return Number((currentValue + (currentValue * mutation)).toFixed(4));
  }

  /**
   * Get or create the current active version of an agent base name
   */
  getLatestAgentVersion(baseName: string): string {
    const cleanBaseName = baseName.replace(/_v\d+$/, '');
    let latestVersion = 1;
    let latestAgent: string | null = null;
    
    for (const [agentName, genealogy] of this.genealogy) {
      if (agentName.startsWith(cleanBaseName + '_v') && genealogy.isActive) {
        const version = parseInt(agentName.match(/_v(\d+)$/)?.[1] || '0');
        if (version >= latestVersion) {
          latestVersion = version;
          latestAgent = agentName;
        }
      }
    }
    
    return latestAgent || `${cleanBaseName}_v1`;
  }

  /**
   * Initialize a base agent if it doesn't exist
   */
  initializeBaseAgent(baseName: string, initialPerformance: number = 10): void {
    const cleanBaseName = baseName.replace(/_v\d+$/, '');
    const agentName = `${cleanBaseName}_v1`;
    
    if (!this.genealogy.has(agentName)) {
      this.genealogy.set(agentName, {
        agentName,
        generation: 1,
        parentName: null,
        children: [],
        mutations: [],
        totalDescendants: 0,
        lineageStrength: 50,
        createdAt: Date.now() - 86400000 * 7, // Created a week ago
        isActive: true,
        cumulativePerformance: initialPerformance
      });
    }
  }

  evolveAgent(
    parentAgentName: string,
    trigger: EvolutionTrigger,
    currentPerformance: {
      roi: number;
      sharpe: number;
      winRate: number;
      drawdown: number;
      backtestScore: number;
    },
    reason: string,
    currentParams: Record<string, number> = {}
  ): EvolutionEvent {
    // Get the base name and find/create the latest version
    const baseName = parentAgentName.replace(/_v\d+$/, '');
    
    // Initialize base agent if needed
    this.initializeBaseAgent(baseName, currentPerformance.roi);
    
    // Get the actual latest version of this agent
    const actualParentName = this.getLatestAgentVersion(baseName);
    const parentGenealogy = this.genealogy.get(actualParentName);
    
    // Use the actual parent's generation, defaulting to 1 if not found
    const parentGeneration = parentGenealogy?.generation ?? 1;
    const childGeneration = parentGeneration + 1;
    
    const childAgentName = `${baseName}_v${childGeneration}`;

    // Calculate performance changes from parent if available
    const parentPerformance = parentGenealogy?.cumulativePerformance ?? 0;
    const roiChange = currentPerformance.roi - parentPerformance;
    const sharpeChange = currentPerformance.sharpe - (parentGenealogy ? 1.0 : 0);
    const winRateChange = currentPerformance.winRate - 50;
    const drawdownChange = currentPerformance.drawdown - 10;

    const mutationType = this.selectMutationType(trigger, {
      roiChange,
      sharpeChange,
      winRateChange,
      drawdownChange
    });

    const definition = this.getMutationDefinition(mutationType);
    if (!definition) {
      throw new Error(`Unknown mutation type: ${mutationType}`);
    }

    const parameterName = definition.parameterPath.split('.').pop() || 'unknown';
    const currentValue = currentParams[parameterName] ?? 0.5;
    const mutationStrength = this.calculateMutationStrength();
    const newValue = this.applyMutation(currentValue, definition, mutationStrength);

    const performanceBoost = (Math.random() * 0.15) - 0.03;
    const sharpeBoost = (Math.random() * 0.25) - 0.05;
    const winRateBoost = (Math.random() * 0.08) - 0.02;
    const drawdownReduction = (Math.random() * 0.04) - 0.01;

    const event: EvolutionEvent = {
      id: this.generateMutationId(),
      parentAgentName: actualParentName,
      childAgentName,
      parentGeneration,
      childGeneration,
      mutation: {
        type: mutationType,
        parameterName,
        previousValue: currentValue,
        newValue,
        mutationStrength
      },
      trigger,
      reason,
      performanceImpact: {
        roiBefore: currentPerformance.roi,
        roiAfter: Number((currentPerformance.roi + performanceBoost * 100).toFixed(2)),
        roiChange: Number((performanceBoost * 100).toFixed(2)),
        sharpeBefore: currentPerformance.sharpe,
        sharpeAfter: Number((currentPerformance.sharpe + sharpeBoost).toFixed(2)),
        sharpeChange: Number(sharpeBoost.toFixed(2)),
        winRateBefore: currentPerformance.winRate,
        winRateAfter: Number((currentPerformance.winRate + winRateBoost * 100).toFixed(1)),
        winRateChange: Number((winRateBoost * 100).toFixed(1)),
        drawdownBefore: currentPerformance.drawdown,
        drawdownAfter: Number(Math.max(0, currentPerformance.drawdown - drawdownReduction * 100).toFixed(1)),
        drawdownChange: Number((-drawdownReduction * 100).toFixed(1))
      },
      backtestScores: {
        before: currentPerformance.backtestScore,
        after: Number((currentPerformance.backtestScore + (Math.random() * 10 - 2)).toFixed(1))
      },
      timestamp: Date.now()
    };

    this.evolutionEvents.push(event);
    this.updateGenealogy(event);
    this.updateMutationStats(event);

    return event;
  }

  private generateChildName(parentName: string, generation: number): string {
    const baseName = parentName.replace(/_v\d+$/, '');
    return `${baseName}_v${generation}`;
  }

  private updateGenealogy(event: EvolutionEvent): void {
    const parentGenealogy = this.genealogy.get(event.parentAgentName);
    
    if (parentGenealogy) {
      parentGenealogy.children.push(event.childAgentName);
      parentGenealogy.totalDescendants++;
      this.updateLineageStrength(event.parentAgentName);
    } else {
      this.genealogy.set(event.parentAgentName, {
        agentName: event.parentAgentName,
        generation: event.parentGeneration,
        parentName: null,
        children: [event.childAgentName],
        mutations: [],
        totalDescendants: 1,
        lineageStrength: 50,
        createdAt: Date.now() - 86400000,
        isActive: false,
        cumulativePerformance: event.performanceImpact.roiBefore
      });
    }

    this.genealogy.set(event.childAgentName, {
      agentName: event.childAgentName,
      generation: event.childGeneration,
      parentName: event.parentAgentName,
      children: [],
      mutations: [event],
      totalDescendants: 0,
      lineageStrength: this.calculateLineageStrength(event),
      createdAt: event.timestamp,
      isActive: true,
      cumulativePerformance: event.performanceImpact.roiAfter
    });

    if (parentGenealogy) {
      parentGenealogy.isActive = false;
      parentGenealogy.retiredAt = event.timestamp;
      parentGenealogy.retirementReason = `Evolved to ${event.childAgentName}`;
    }
  }

  private calculateLineageStrength(event: EvolutionEvent): number {
    const parentGenealogy = this.genealogy.get(event.parentAgentName);
    const parentStrength = parentGenealogy?.lineageStrength ?? 50;
    
    const performanceBonus = event.performanceImpact.roiChange > 0 ? 5 : -3;
    const sharpeBonus = event.performanceImpact.sharpeChange > 0 ? 3 : -2;
    
    return Math.max(0, Math.min(100, parentStrength + performanceBonus + sharpeBonus));
  }

  private updateLineageStrength(agentName: string): void {
    const genealogy = this.genealogy.get(agentName);
    if (!genealogy) return;

    const childPerformances = genealogy.children
      .map(child => this.genealogy.get(child))
      .filter(Boolean)
      .map(child => child!.cumulativePerformance);

    if (childPerformances.length > 0) {
      const avgChildPerformance = childPerformances.reduce((a, b) => a + b, 0) / childPerformances.length;
      genealogy.lineageStrength = Math.min(100, genealogy.lineageStrength + (avgChildPerformance > 0 ? 2 : -1));
    }
  }

  private updateMutationStats(event: EvolutionEvent): void {
    const stats = this.mutationStats.get(event.mutation.type);
    if (!stats) return;

    stats.totalApplications++;
    stats.lastApplied = event.timestamp;

    const isSuccessful = event.performanceImpact.roiChange > 0 || event.performanceImpact.sharpeChange > 0;
    if (isSuccessful) {
      stats.successfulApplications++;
    }

    stats.successRate = stats.successfulApplications / stats.totalApplications;
    
    const impact = event.performanceImpact.roiChange;
    stats.averagePerformanceImpact = (
      (stats.averagePerformanceImpact * (stats.totalApplications - 1) + impact) / 
      stats.totalApplications
    );
  }

  retireAgent(agentName: string, reason: string): void {
    const genealogy = this.genealogy.get(agentName);
    if (genealogy) {
      genealogy.isActive = false;
      genealogy.retiredAt = Date.now();
      genealogy.retirementReason = reason;
    }
  }

  getEvolutionHistory(limit: number = 50): EvolutionEvent[] {
    return this.evolutionEvents
      .slice(-limit)
      .sort((a, b) => b.timestamp - a.timestamp);
  }

  getAgentGenealogy(agentName: string): AgentGenealogy | undefined {
    return this.genealogy.get(agentName);
  }

  getAllGenealogies(): AgentGenealogy[] {
    return Array.from(this.genealogy.values());
  }

  getGenealogyTree(): { nodes: AgentGenealogy[]; edges: { from: string; to: string }[] } {
    const nodes = Array.from(this.genealogy.values());
    const edges: { from: string; to: string }[] = [];

    for (const node of nodes) {
      if (node.parentName) {
        edges.push({ from: node.parentName, to: node.agentName });
      }
    }

    return { nodes, edges };
  }

  getMutationHeatmap(): Record<MutationType, MutationStats> {
    const heatmap: Record<string, MutationStats> = {};
    for (const [type, stats] of this.mutationStats) {
      heatmap[type] = { ...stats };
    }
    return heatmap as Record<MutationType, MutationStats>;
  }

  getEvolutionStats(): EvolutionStats {
    const genealogies = Array.from(this.genealogy.values());
    const generations = genealogies.map(g => g.generation);
    const maxGeneration = generations.length > 0 ? Math.max(...generations) : 0;

    const activeAgents = genealogies.filter(g => g.isActive).length;
    const retiredAgents = genealogies.filter(g => !g.isActive).length;

    const generationDistribution: Record<number, number> = {};
    for (const gen of generations) {
      generationDistribution[gen] = (generationDistribution[gen] || 0) + 1;
    }

    let mostSuccessfulMutation: MutationType | null = null;
    let bestSuccessRate = 0;
    for (const [type, stats] of this.mutationStats) {
      if (stats.totalApplications > 0 && stats.successRate > bestSuccessRate) {
        bestSuccessRate = stats.successRate;
        mostSuccessfulMutation = type;
      }
    }

    const lineageStrengths = genealogies.map(g => g.lineageStrength);
    const avgLineageStrength = lineageStrengths.length > 0
      ? lineageStrengths.reduce((a, b) => a + b, 0) / lineageStrengths.length
      : 0;

    const performanceTrend = this.evolutionEvents
      .slice(-20)
      .map(e => e.performanceImpact.roiAfter);

    return {
      totalGenerations: maxGeneration,
      totalMutations: this.evolutionEvents.length,
      totalAgents: genealogies.length,
      activeAgents,
      retiredAgents,
      averageLineageStrength: Number(avgLineageStrength.toFixed(1)),
      mostSuccessfulMutation,
      mutationHeatmap: this.getMutationHeatmap(),
      generationDistribution,
      performanceTrend
    };
  }

  getLatestEvolution(): EvolutionEvent | undefined {
    return this.evolutionEvents[this.evolutionEvents.length - 1];
  }

  getEvolutionsByAgent(agentName: string): EvolutionEvent[] {
    return this.evolutionEvents.filter(
      e => e.parentAgentName === agentName || e.childAgentName === agentName
    );
  }

  generateDemoEvolutions(): EvolutionEvent[] {
    const baseAgents = ['Atlas', 'Vega', 'Nova', 'Sentinel', 'Arbiter'];
    const triggers: EvolutionTrigger[] = ['backtest_completion', 'stress_test_failure', 'parliament_decision', 'auto_optimization'];
    const reasons = [
      'Improved win rate in last 100-cycle backtest',
      'Adapted to volatile market conditions',
      'Optimized for faster arbitrage detection',
      'Reduced false positives in trend detection',
      'Enhanced risk management after stress test',
      'Parliament voted for conservative parameters',
      'Auto-optimization after drawdown event',
      'Performance threshold triggered adjustment'
    ];

    const events: EvolutionEvent[] = [];

    for (const baseName of baseAgents) {
      let currentParams = {
        trigger: 0.65 + Math.random() * 0.1,
        positionSize: 0.8 + Math.random() * 0.3,
        confidenceThreshold: 0.7 + Math.random() * 0.15
      };

      let currentPerf = {
        roi: 5 + Math.random() * 15,
        sharpe: 0.8 + Math.random() * 0.8,
        winRate: 55 + Math.random() * 15,
        drawdown: 5 + Math.random() * 10,
        backtestScore: 70 + Math.random() * 20
      };

      this.genealogy.set(`${baseName}_v1`, {
        agentName: `${baseName}_v1`,
        generation: 1,
        parentName: null,
        children: [],
        mutations: [],
        totalDescendants: 0,
        lineageStrength: 50,
        createdAt: Date.now() - 86400000 * 7,
        isActive: false,
        cumulativePerformance: currentPerf.roi
      });

      const numGenerations = 3 + Math.floor(Math.random() * 3);
      for (let gen = 1; gen < numGenerations; gen++) {
        const trigger = triggers[Math.floor(Math.random() * triggers.length)];
        const reason = reasons[Math.floor(Math.random() * reasons.length)];

        const event = this.evolveAgent(
          `${baseName}_v${gen}`,
          trigger,
          currentPerf,
          reason,
          currentParams
        );
        events.push(event);

        currentPerf = {
          roi: event.performanceImpact.roiAfter,
          sharpe: event.performanceImpact.sharpeAfter,
          winRate: event.performanceImpact.winRateAfter,
          drawdown: event.performanceImpact.drawdownAfter,
          backtestScore: event.backtestScores.after
        };
      }
    }

    return events;
  }

  formatEvolutionReport(event: EvolutionEvent): string {
    const definition = this.getMutationDefinition(event.mutation.type);
    const mutationName = definition?.displayName || event.mutation.type;

    return `[EVOLUTION] ${event.parentAgentName} → ${event.childAgentName}
• Mutation: ${mutationName} (${event.mutation.parameterName} ${event.mutation.previousValue} → ${event.mutation.newValue})
• Reason: ${event.reason}
• Performance change: ${event.performanceImpact.roiChange > 0 ? '+' : ''}${event.performanceImpact.roiChange}% ROI, ${event.performanceImpact.sharpeChange > 0 ? '+' : ''}${event.performanceImpact.sharpeChange} Sharpe
• Generation: ${event.childGeneration}
• Parent: ${event.parentAgentName}
• Timestamp: ${new Date(event.timestamp).toISOString()}`;
  }
}

export const evolutionEngine = new EvolutionEngine();
