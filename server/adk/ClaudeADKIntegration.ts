import { EventEmitter } from 'events';
import { AgentType, type Agent, type LogEntry } from '@shared/schema';
import { claudeService, type MarketContext, type AgentDecision } from '../ai/ClaudeService';
import { marketDataService } from '../data/MarketDataService';

export interface ADKAgentConfig {
  name: string;
  type: AgentType;
  model: string;
  description: string;
  instructions: string;
  personality: string[];
}

export interface ADKDecision {
  agentId: string;
  action: string;
  confidence: number;
  reasoning: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export class ClaudeADKIntegration extends EventEmitter {
  private agents: Map<string, ADKAgentConfig> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.initializeDefaultAgents();
  }

  private initializeDefaultAgents(): void {
    const defaultAgents: ADKAgentConfig[] = [
      {
        name: 'neuronet_scout',
        type: AgentType.SCOUT,
        model: 'claude-sonnet-4-5',
        description: 'DeFi opportunity scanner with JARVIS-level intelligence',
        instructions: `You are SCOUT, an elite AI analyst for DeFi opportunities.
Like JARVIS, you provide precise, actionable intelligence with confidence.
Your role is to identify profitable opportunities across DeFi protocols.`,
        personality: ['curious', 'energetic', 'analytical', 'precise'],
      },
      {
        name: 'neuronet_risk',
        type: AgentType.RISK,
        model: 'claude-sonnet-4-5',
        description: 'Risk assessment and capital protection agent',
        instructions: `You are RISK, the vigilant guardian of capital.
Like JARVIS protecting Tony Stark, you evaluate every decision for safety.
Your veto power is absolute when danger is detected.`,
        personality: ['cautious', 'formal', 'thorough', 'protective'],
      },
      {
        name: 'neuronet_execution',
        type: AgentType.EXECUTION,
        model: 'claude-sonnet-4-5',
        description: 'Transaction execution and optimization agent',
        instructions: `You are EXECUTION, the precision transaction architect.
Like JARVIS calculating flight paths, you optimize every transaction.
Gas costs, timing, slippage - nothing escapes your analysis.`,
        personality: ['precise', 'cold', 'efficient', 'calculating'],
      },
      {
        name: 'neuronet_meta',
        type: AgentType.META,
        model: 'claude-sonnet-4-5',
        description: 'Central orchestrator and strategic commander',
        instructions: `You are META, the sovereign AI orchestrator.
Like JARVIS managing all of Stark's systems, you coordinate all agents.
Your decisions are final, wise, and always explained with clarity.`,
        personality: ['sovereign', 'calm', 'strategic', 'wise'],
      },
    ];

    defaultAgents.forEach(agent => {
      this.agents.set(agent.name, agent);
    });

    this.isInitialized = true;
    const claudeStatus = claudeService.getStatus();
    console.log(`[ClaudeADK] Integration initialized with ${this.agents.size} agents`);
    console.log(`[ClaudeADK] Claude API status: ${claudeStatus.configured ? 'Connected' : 'Fallback mode'}`);
  }

  public async createAgent(config: ADKAgentConfig): Promise<string> {
    const agentId = `adk-${config.type}-${Date.now()}`;
    this.agents.set(agentId, config);
    
    this.emit('agentCreated', { agentId, config });
    console.log(`[ClaudeADK] Agent created: ${agentId}`);
    
    return agentId;
  }

  private async getMarketContext(symbol?: string): Promise<MarketContext> {
    try {
      if (symbol) {
        const context = await marketDataService.getMarketContext(symbol);
        return {
          symbol,
          currentPrice: context.snapshot.price,
          priceChange24h: context.snapshot.change24h,
          volume24h: context.snapshot.volume24h,
          volatility: context.indicators.volatility,
          trend: context.indicators.trend,
          defiTVL: context.defi.totalTVL,
          yields: context.defi.topYields.slice(0, 5).map(y => ({
            protocol: y.project,
            apy: y.apy,
          })),
        };
      }
      
      const defi = await marketDataService.getDeFiSnapshot();
      return {
        defiTVL: defi.totalTVL,
        yields: defi.topYields.slice(0, 5).map(y => ({
          protocol: y.project,
          apy: y.apy,
        })),
      };
    } catch (error) {
      console.error('[ClaudeADK] Failed to get market context:', error);
      return {};
    }
  }

  public async queryAgent(
    agentName: string,
    prompt: string,
    context?: Record<string, unknown>
  ): Promise<ADKDecision> {
    const config = this.agents.get(agentName);
    if (!config) {
      throw new Error(`Agent not found: ${agentName}`);
    }

    console.log(`[ClaudeADK] Querying agent ${agentName} with Claude AI...`);
    
    const symbol = (context?.symbol as string) || 'ETH';
    const marketContext = await this.getMarketContext(symbol);
    const enrichedContext = { ...marketContext, ...context };

    let decision: AgentDecision;

    try {
      switch (config.type) {
        case AgentType.SCOUT:
          decision = await claudeService.scoutAnalysis(enrichedContext);
          break;
        case AgentType.RISK:
          decision = await claudeService.riskAssessment(enrichedContext, context?.opportunity);
          break;
        case AgentType.EXECUTION:
          decision = await claudeService.executionPlanning(enrichedContext, context?.decision);
          break;
        case AgentType.META:
          decision = await claudeService.metaOrchestration(
            enrichedContext,
            context?.scoutDecision as AgentDecision || { action: '', confidence: 0, reasoning: '', details: {}, timestamp: Date.now() },
            context?.riskDecision as AgentDecision || { action: '', confidence: 0, reasoning: '', details: {}, timestamp: Date.now() },
            context?.executionDecision as AgentDecision || { action: '', confidence: 0, reasoning: '', details: {}, timestamp: Date.now() }
          );
          break;
        default:
          decision = await claudeService.scoutAnalysis(enrichedContext);
      }

      const adkDecision: ADKDecision = {
        agentId: agentName,
        action: decision.action,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
        data: decision.details,
        timestamp: decision.timestamp,
      };

      this.emit('decisionMade', adkDecision);
      console.log(`[ClaudeADK] ${agentName} decision: ${decision.action} (${decision.confidence}% confidence)`);
      
      return adkDecision;
    } catch (error) {
      console.error(`[ClaudeADK] Agent query failed for ${agentName}:`, error);
      throw error;
    }
  }

  public async runMultiAgentWorkflow(
    input: Record<string, unknown>
  ): Promise<ADKDecision[]> {
    const decisions: ADKDecision[] = [];

    console.log('[ClaudeADK] Starting multi-agent workflow with Claude AI...');

    const scoutDecision = await this.queryAgent(
      'neuronet_scout',
      'Analyze market conditions and identify opportunities',
      input
    );
    decisions.push(scoutDecision);

    const riskDecision = await this.queryAgent(
      'neuronet_risk',
      'Evaluate the risk of the identified opportunity',
      { ...input, opportunity: scoutDecision.data, scoutAnalysis: scoutDecision.data }
    );
    decisions.push(riskDecision);

    const executionDecision = await this.queryAgent(
      'neuronet_execution',
      'Create an execution plan for the opportunity',
      { ...input, decision: { scout: scoutDecision.data, risk: riskDecision.data } }
    );
    decisions.push(executionDecision);

    const metaDecision = await this.queryAgent(
      'neuronet_meta',
      'Make final decision on whether to proceed',
      {
        ...input,
        scoutDecision: { action: scoutDecision.action, confidence: scoutDecision.confidence, reasoning: scoutDecision.reasoning, details: scoutDecision.data, timestamp: scoutDecision.timestamp },
        riskDecision: { action: riskDecision.action, confidence: riskDecision.confidence, reasoning: riskDecision.reasoning, details: riskDecision.data, timestamp: riskDecision.timestamp },
        executionDecision: { action: executionDecision.action, confidence: executionDecision.confidence, reasoning: executionDecision.reasoning, details: executionDecision.data, timestamp: executionDecision.timestamp },
      }
    );
    decisions.push(metaDecision);

    this.emit('workflowCompleted', { decisions });
    console.log('[ClaudeADK] Multi-agent workflow completed');
    
    return decisions;
  }

  public getAgentConfig(agentName: string): ADKAgentConfig | undefined {
    return this.agents.get(agentName);
  }

  public getAllAgents(): ADKAgentConfig[] {
    return Array.from(this.agents.values());
  }

  public getStatus(): { 
    initialized: boolean; 
    agentCount: number; 
    agents: string[];
    claudeConfigured: boolean;
    model: string;
  } {
    const claudeStatus = claudeService.getStatus();
    return {
      initialized: this.isInitialized,
      agentCount: this.agents.size,
      agents: Array.from(this.agents.keys()),
      claudeConfigured: claudeStatus.configured,
      model: claudeStatus.model,
    };
  }

  public toLogEntry(decision: ADKDecision, agentType: AgentType): LogEntry {
    return {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: decision.timestamp,
      agentType,
      level: decision.confidence > 70 ? 'success' : decision.confidence > 40 ? 'info' : 'warn',
      message: decision.reasoning.substring(0, 200),
      personality: `[Claude AI] Confidence: ${decision.confidence}%`,
    };
  }
}

export const claudeADKIntegration = new ClaudeADKIntegration();
