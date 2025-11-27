import { AgentBuilder } from '@iqai/adk';
import { EventEmitter } from 'events';
import type { Agent, AgentType, LogEntry } from '@shared/schema';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

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

const DEFAULT_MODEL = 'gemini-2.5-flash';

export class ADKIntegration extends EventEmitter {
  private agents: Map<string, ADKAgentConfig> = new Map();
  private builtAgents: Map<string, any> = new Map();
  private isInitialized: boolean = false;

  constructor() {
    super();
    this.initializeDefaultAgents();
  }

  private initializeDefaultAgents(): void {
    const defaultAgents: ADKAgentConfig[] = [
      {
        name: 'neuronet_scout',
        type: 'scout',
        model: DEFAULT_MODEL,
        description: 'DeFi opportunity scanner and market analyzer',
        instructions: `You are Scout Agent, a curious and energetic AI analyzer for DeFi opportunities.
Your tasks:
1. Identify profitable opportunities (arbitrage, yield farming, swaps)
2. Predict volatility and price movements
3. Detect anomalies or market inefficiencies
4. Provide confidence scores for each opportunity
Respond with JSON containing: opportunityType, description, confidence (0-100), expectedReturn, details`,
        personality: ['curious', 'energetic', 'analytical'],
      },
      {
        name: 'neuronet_risk',
        type: 'risk',
        model: DEFAULT_MODEL,
        description: 'Risk assessment and safety evaluation agent',
        instructions: `You are Risk Agent, a cautious and formal AI evaluator for DeFi safety.
Your tasks:
1. Identify potential risks and vulnerabilities
2. Calculate loss scenarios and exposure
3. Predict liquidation risks
4. Recommend safety measures and vetoes when necessary
Respond with JSON containing: riskScore (0-100), shouldVeto, riskFactors, potentialLoss, recommendations`,
        personality: ['cautious', 'formal', 'thorough'],
      },
      {
        name: 'neuronet_execution',
        type: 'execution',
        model: DEFAULT_MODEL,
        description: 'Transaction execution and gas optimization agent',
        instructions: `You are Execution Agent, a precise and cold AI executor for DeFi transactions.
Your tasks:
1. Create safe transaction plans
2. Calculate optimal gas costs
3. Define execution steps with timing
4. Estimate success probability
Respond with JSON containing: feasible, gasEstimate, steps, totalValue, successProbability, warnings`,
        personality: ['precise', 'cold', 'efficient'],
      },
      {
        name: 'neuronet_meta',
        type: 'meta',
        model: DEFAULT_MODEL,
        description: 'Central orchestrator and strategic decision maker',
        instructions: `You are Meta-Agent, a sovereign AI orchestrator for DeFi governance.
Your tasks:
1. Coordinate between Scout, Risk, and Execution agents
2. Make final strategic decisions
3. Balance risk vs reward
4. Maintain long-term strategy alignment
Respond with JSON containing: approved, confidence (0-100), reasoning, modifications, priority`,
        personality: ['sovereign', 'calm', 'strategic'],
      },
    ];

    defaultAgents.forEach(agent => {
      this.agents.set(agent.name, agent);
    });

    this.isInitialized = true;
    console.log('[ADK] Integration initialized with', this.agents.size, 'agents');
  }

  public async createAgent(config: ADKAgentConfig): Promise<string> {
    const agentId = `adk-${config.type}-${Date.now()}`;
    this.agents.set(agentId, config);
    
    this.emit('agentCreated', { agentId, config });
    console.log(`[ADK] Agent created: ${agentId}`);
    
    return agentId;
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

    if (!GOOGLE_API_KEY) {
      console.warn(`[ADK] No GOOGLE_API_KEY - using fallback for ${agentName}`);
      return this.createFallbackDecision(agentName, config, context, new Error('No API key'));
    }

    try {
      const fullPrompt = this.buildPrompt(config, prompt, context);
      
      console.log(`[ADK] Querying agent ${agentName} with live Gemini API...`);
      
      const response = await AgentBuilder
        .withModel(config.model as any)
        .ask(fullPrompt);

      console.log(`[ADK] Live response received from ${agentName}`);

      const decision: ADKDecision = {
        agentId: agentName,
        action: 'live_analysis',
        confidence: this.extractConfidence(response),
        reasoning: response,
        data: this.parseResponse(response),
        timestamp: Date.now(),
      };

      this.emit('decisionMade', decision);
      return decision;
    } catch (error) {
      console.error(`[ADK] Agent query failed for ${agentName}:`, error);
      
      return this.createFallbackDecision(agentName, config, context, error);
    }
  }

  private createFallbackDecision(
    agentName: string, 
    config: ADKAgentConfig, 
    context?: Record<string, unknown>,
    error?: unknown
  ): ADKDecision {
    const fallbackResponses: Record<string, Record<string, unknown>> = {
      'neuronet_scout': {
        opportunityType: 'yield',
        description: 'Analyzing DeFi opportunities with simulated data',
        confidence: 65,
        expectedReturn: 8.5,
        details: { source: 'fallback', market: 'ethereum' }
      },
      'neuronet_risk': {
        riskScore: 45,
        shouldVeto: false,
        riskFactors: ['Market volatility', 'Smart contract risk'],
        potentialLoss: 5,
        recommendations: ['Monitor position', 'Set stop-loss']
      },
      'neuronet_execution': {
        feasible: true,
        gasEstimate: 150000,
        steps: [{ action: 'approve', contract: '0x...', estimatedGas: 50000 }],
        totalValue: '1000',
        successProbability: 85,
        warnings: []
      },
      'neuronet_meta': {
        approved: true,
        confidence: 70,
        reasoning: 'Risk-adjusted return is favorable',
        modifications: null,
        priority: 'medium'
      }
    };

    return {
      agentId: agentName,
      action: 'fallback',
      confidence: 50,
      reasoning: `Using fallback response. ${error instanceof Error ? error.message : 'ADK query unavailable'}`,
      data: fallbackResponses[agentName] || { status: 'fallback', context },
      timestamp: Date.now(),
    };
  }

  public async runMultiAgentWorkflow(
    input: Record<string, unknown>
  ): Promise<ADKDecision[]> {
    const decisions: ADKDecision[] = [];

    const scoutDecision = await this.queryAgent(
      'neuronet_scout',
      'Analyze market conditions and identify opportunities',
      input
    );
    decisions.push(scoutDecision);

    const riskDecision = await this.queryAgent(
      'neuronet_risk',
      'Evaluate the risk of the identified opportunity',
      { ...input, scoutAnalysis: scoutDecision.data }
    );
    decisions.push(riskDecision);

    const executionDecision = await this.queryAgent(
      'neuronet_execution',
      'Create an execution plan for the opportunity',
      { ...input, scoutAnalysis: scoutDecision.data, riskAssessment: riskDecision.data }
    );
    decisions.push(executionDecision);

    const metaDecision = await this.queryAgent(
      'neuronet_meta',
      'Make final decision on whether to proceed',
      {
        ...input,
        scoutAnalysis: scoutDecision.data,
        riskAssessment: riskDecision.data,
        executionPlan: executionDecision.data,
      }
    );
    decisions.push(metaDecision);

    this.emit('workflowCompleted', { decisions });
    return decisions;
  }

  private buildPrompt(
    config: ADKAgentConfig,
    prompt: string,
    context?: Record<string, unknown>
  ): string {
    let fullPrompt = `${config.instructions}\n\n`;
    
    if (context) {
      fullPrompt += `Context:\n${JSON.stringify(context, null, 2)}\n\n`;
    }
    
    fullPrompt += `Task: ${prompt}\n\n`;
    fullPrompt += `Respond with a JSON object containing your analysis, confidence score (0-100), and recommendations.`;
    
    return fullPrompt;
  }

  private extractConfidence(response: string): number {
    const confidenceMatch = response.match(/confidence["\s:]+(\d+)/i);
    if (confidenceMatch) {
      return Math.min(100, Math.max(0, parseInt(confidenceMatch[1], 10)));
    }
    return 50;
  }

  private parseResponse(response: string): Record<string, unknown> {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {
    }
    return { rawResponse: response };
  }

  public getAgentConfig(agentName: string): ADKAgentConfig | undefined {
    return this.agents.get(agentName);
  }

  public getAllAgents(): ADKAgentConfig[] {
    return Array.from(this.agents.values());
  }

  public getStatus(): { initialized: boolean; agentCount: number; agents: string[] } {
    return {
      initialized: this.isInitialized,
      agentCount: this.agents.size,
      agents: Array.from(this.agents.keys()),
    };
  }

  public toLogEntry(decision: ADKDecision, agentType: AgentType): LogEntry {
    return {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: decision.timestamp,
      agentType,
      level: decision.confidence > 70 ? 'success' : decision.confidence > 40 ? 'info' : 'warn',
      message: decision.reasoning.substring(0, 200),
      personality: `[ADK] Confidence: ${decision.confidence}%`,
    };
  }
}

export const adkIntegration = new ADKIntegration();
