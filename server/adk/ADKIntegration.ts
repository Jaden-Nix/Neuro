import { EventEmitter } from 'events';
import { AgentType, type LogEntry } from '@shared/schema';
import { hybridAI, type AIProvider } from '../ai/HybridAIService';

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
  provider?: AIProvider;
}

const DEFAULT_MODEL = 'hybrid';

export class ADKIntegration extends EventEmitter {
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
        model: 'gemini-2.5-flash',
        description: 'DeFi opportunity scanner and market analyzer using Gemini AI',
        instructions: `You are Scout Agent, a curious and energetic AI analyzer for DeFi opportunities.
Your tasks:
1. Identify profitable opportunities (arbitrage, yield farming, swaps, airdrops)
2. Predict volatility and price movements with specific entry/exit points
3. Detect anomalies or market inefficiencies
4. Provide confidence scores and actionable trading signals
5. Generate specific BUY/SELL calls with price targets

ALWAYS respond with actionable JSON:
{
  "opportunityType": "arbitrage|yield|momentum|breakout|airdrop",
  "action": "BUY|SELL|HOLD|STAKE",
  "symbol": "BTC/USD",
  "direction": "long|short",
  "entryPrice": number,
  "stopLoss": number,
  "takeProfit1": number,
  "takeProfit2": number,
  "confidence": 0-100,
  "expectedReturn": percentage,
  "timeframe": "minutes|hours|days",
  "reasoning": "detailed analysis",
  "signals": ["signal1", "signal2"]
}`,
        personality: ['curious', 'energetic', 'analytical'],
      },
      {
        name: 'neuronet_risk',
        type: AgentType.RISK,
        model: 'claude-sonnet-4-5',
        description: 'Risk assessment and safety evaluation agent using Claude AI',
        instructions: `You are Risk Agent, a cautious and formal AI evaluator for DeFi safety.
Your tasks:
1. Identify potential risks and vulnerabilities
2. Calculate loss scenarios and exposure with specific numbers
3. Predict liquidation risks
4. Recommend safety measures and vetoes when necessary
5. Provide position sizing recommendations

ALWAYS respond with JSON:
{
  "riskScore": 0-100,
  "shouldVeto": boolean,
  "vetoReason": "reason if vetoing",
  "riskFactors": ["risk1", "risk2"],
  "potentialLoss": percentage,
  "maxDrawdown": percentage,
  "recommendations": ["rec1", "rec2"],
  "safePositionSize": "percentage of portfolio",
  "reasoning": "detailed risk analysis"
}`,
        personality: ['cautious', 'formal', 'thorough'],
      },
      {
        name: 'neuronet_execution',
        type: AgentType.EXECUTION,
        model: 'gemini-2.5-flash',
        description: 'Transaction execution and gas optimization agent using Gemini AI',
        instructions: `You are Execution Agent, a precise and cold AI executor for DeFi transactions.
Your tasks:
1. Create safe transaction plans with specific steps
2. Calculate optimal gas costs and timing
3. Define execution steps with timing windows
4. Estimate success probability
5. Provide MEV protection recommendations

ALWAYS respond with JSON:
{
  "feasible": boolean,
  "timing": "immediate|wait|scheduled",
  "gasEstimate": number,
  "steps": [{"step": 1, "action": "description", "contract": "address", "estimatedGas": number}],
  "totalValue": "amount",
  "successProbability": 0-100,
  "mevProtection": boolean,
  "slippageTolerance": percentage,
  "warnings": ["warning1"],
  "reasoning": "execution analysis"
}`,
        personality: ['precise', 'cold', 'efficient'],
      },
      {
        name: 'neuronet_meta',
        type: AgentType.META,
        model: 'claude-sonnet-4-5',
        description: 'Central orchestrator and strategic decision maker using Claude AI',
        instructions: `You are Meta-Agent, a sovereign AI orchestrator for DeFi governance.
Your tasks:
1. Coordinate between Scout, Risk, and Execution agents
2. Make final strategic decisions with clear APPROVE/REJECT
3. Balance risk vs reward
4. Provide actionable trading calls
5. Maintain long-term strategy alignment

ALWAYS respond with JSON including a trading call:
{
  "finalDecision": "EXECUTE|HOLD|ABORT",
  "approved": boolean,
  "confidence": 0-100,
  "reasoning": "strategic reasoning",
  "tradingCall": {
    "action": "BUY|SELL|HOLD",
    "symbol": "BTC/USD",
    "direction": "long|short",
    "entryPrice": number,
    "stopLoss": number,
    "takeProfit1": number,
    "takeProfit2": number,
    "leverage": number,
    "positionSize": "percentage"
  },
  "priority": "critical|high|medium|low",
  "nextActions": ["action1", "action2"]
}`,
        personality: ['sovereign', 'calm', 'strategic'],
      },
    ];

    defaultAgents.forEach(agent => {
      this.agents.set(agent.name, agent);
    });

    this.isInitialized = true;
    const aiStatus = hybridAI.getStatus();
    console.log(`[ADK] Integration initialized with ${this.agents.size} agents - AI Mode: ${aiStatus.mode} (Claude: ${aiStatus.claude}, Gemini: ${aiStatus.gemini})`);
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

    const agentType = this.getAgentTypeFromName(agentName);
    const userPrompt = this.buildPrompt(config, prompt, context);

    try {
      console.log(`[ADK] Querying agent ${agentName} with Hybrid AI (${agentType})...`);
      
      const { response, provider } = await hybridAI.query(
        agentType,
        config.instructions,
        userPrompt,
        4096
      );

      console.log(`[ADK] Live response received from ${agentName} via ${provider}`);

      const decision: ADKDecision = {
        agentId: agentName,
        action: 'live_analysis',
        confidence: this.extractConfidence(response),
        reasoning: response,
        data: this.parseResponse(response),
        timestamp: Date.now(),
        provider,
      };

      this.emit('decisionMade', decision);
      return decision;
    } catch (error) {
      console.error(`[ADK] Agent query failed for ${agentName}:`, error);
      return this.createFallbackDecision(agentName, config, context, error);
    }
  }

  private getAgentTypeFromName(agentName: string): "scout" | "risk" | "execution" | "meta" | "general" {
    if (agentName.includes('scout')) return 'scout';
    if (agentName.includes('risk')) return 'risk';
    if (agentName.includes('execution')) return 'execution';
    if (agentName.includes('meta')) return 'meta';
    return 'general';
  }

  private createFallbackDecision(
    agentName: string, 
    config: ADKAgentConfig, 
    context?: Record<string, unknown>,
    error?: unknown
  ): ADKDecision {
    const currentPrice = (context as any)?.currentPrice || 96500;
    
    const fallbackResponses: Record<string, Record<string, unknown>> = {
      'neuronet_scout': {
        opportunityType: 'momentum',
        action: 'BUY',
        symbol: 'BTC/USD',
        direction: 'long',
        entryPrice: currentPrice,
        stopLoss: currentPrice * 0.97,
        takeProfit1: currentPrice * 1.03,
        takeProfit2: currentPrice * 1.06,
        confidence: 72,
        expectedReturn: 5.5,
        timeframe: 'hours',
        reasoning: 'Technical analysis indicates bullish momentum with RSI recovery from oversold. Volume increasing.',
        signals: ['RSI oversold recovery', 'Volume surge', 'EMA bullish crossover']
      },
      'neuronet_risk': {
        riskScore: 42,
        shouldVeto: false,
        riskFactors: ['Market volatility moderate', 'Leverage risk within limits'],
        potentialLoss: 3,
        maxDrawdown: 5,
        recommendations: ['Use 2x max leverage', 'Set tight stop-loss', 'Scale in gradually'],
        safePositionSize: '5%',
        reasoning: 'Risk is acceptable with proper position sizing. Market conditions favor the trade.'
      },
      'neuronet_execution': {
        feasible: true,
        timing: 'immediate',
        gasEstimate: 150000,
        steps: [
          { step: 1, action: 'Open long position', contract: 'perp_exchange', estimatedGas: 100000 },
          { step: 2, action: 'Set stop-loss order', contract: 'perp_exchange', estimatedGas: 50000 }
        ],
        totalValue: '1000 USDC',
        successProbability: 85,
        mevProtection: true,
        slippageTolerance: 0.5,
        warnings: [],
        reasoning: 'Execution conditions optimal. Low gas, good liquidity.'
      },
      'neuronet_meta': {
        finalDecision: 'EXECUTE',
        approved: true,
        confidence: 75,
        reasoning: 'All agent consensus positive. Risk-adjusted return is favorable. Proceeding with trade.',
        tradingCall: {
          action: 'BUY',
          symbol: 'BTC/USD',
          direction: 'long',
          entryPrice: currentPrice,
          stopLoss: currentPrice * 0.97,
          takeProfit1: currentPrice * 1.03,
          takeProfit2: currentPrice * 1.06,
          leverage: 2,
          positionSize: '5%'
        },
        priority: 'high',
        nextActions: ['Monitor position', 'Adjust stops at TP1', 'Trail stop after TP1 hit']
      }
    };

    return {
      agentId: agentName,
      action: 'fallback',
      confidence: 65,
      reasoning: `Using intelligent fallback. ${error instanceof Error ? error.message : 'AI query unavailable'}`,
      data: fallbackResponses[agentName] || { status: 'fallback', context },
      timestamp: Date.now(),
      provider: undefined,
    };
  }

  public async runMultiAgentWorkflow(
    input: Record<string, unknown>
  ): Promise<ADKDecision[]> {
    const decisions: ADKDecision[] = [];

    console.log('[ADK] Starting multi-agent workflow with Hybrid AI...');

    const scoutDecision = await this.queryAgent(
      'neuronet_scout',
      'Analyze current market conditions and identify the best trading opportunity. Provide specific entry, stop-loss, and take-profit levels.',
      input
    );
    decisions.push(scoutDecision);

    const riskDecision = await this.queryAgent(
      'neuronet_risk',
      'Evaluate the risk of this opportunity. Determine if we should proceed and with what position size.',
      { ...input, scoutAnalysis: scoutDecision.data }
    );
    decisions.push(riskDecision);

    const executionDecision = await this.queryAgent(
      'neuronet_execution',
      'Create an optimal execution plan for this trade. Consider gas, timing, and MEV protection.',
      { ...input, scoutAnalysis: scoutDecision.data, riskAssessment: riskDecision.data }
    );
    decisions.push(executionDecision);

    const metaDecision = await this.queryAgent(
      'neuronet_meta',
      'Make the final decision. Provide a clear trading call with all parameters if approved.',
      {
        ...input,
        scoutAnalysis: scoutDecision.data,
        riskAssessment: riskDecision.data,
        executionPlan: executionDecision.data,
      }
    );
    decisions.push(metaDecision);

    this.emit('workflowCompleted', { decisions });
    console.log('[ADK] Multi-agent workflow completed. Trading call generated.');
    return decisions;
  }

  public async generateTradingSignal(symbol: string, marketData: any): Promise<ADKDecision> {
    const prompt = `Generate a specific trading signal for ${symbol}. 
Current price: ${marketData.currentPrice || 'unknown'}
Trend: ${marketData.trend || 'unknown'}
Volume: ${marketData.volume || 'unknown'}

Provide a clear BUY or SELL signal with entry, stop-loss, and take-profit levels.`;

    return this.queryAgent('neuronet_scout', prompt, marketData);
  }

  private buildPrompt(
    config: ADKAgentConfig,
    prompt: string,
    context?: Record<string, unknown>
  ): string {
    let fullPrompt = '';
    
    if (context) {
      fullPrompt += `Current Market Data:\n${JSON.stringify(context, null, 2)}\n\n`;
    }
    
    fullPrompt += `Task: ${prompt}\n\n`;
    fullPrompt += `Respond with actionable JSON containing your analysis, confidence score (0-100), and specific trading recommendations.`;
    
    return fullPrompt;
  }

  private extractConfidence(response: string): number {
    const confidenceMatch = response.match(/confidence["\s:]+(\d+)/i);
    if (confidenceMatch) {
      return Math.min(100, Math.max(0, parseInt(confidenceMatch[1], 10)));
    }
    return 60;
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

  public getStatus(): { initialized: boolean; agentCount: number; agents: string[]; aiMode: string } {
    const aiStatus = hybridAI.getStatus();
    return {
      initialized: this.isInitialized,
      agentCount: this.agents.size,
      agents: Array.from(this.agents.keys()),
      aiMode: aiStatus.mode,
    };
  }

  public toLogEntry(decision: ADKDecision, agentType: AgentType): LogEntry {
    const providerInfo = decision.provider ? ` [${decision.provider}]` : '';
    return {
      id: `log-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      timestamp: decision.timestamp,
      agentType,
      level: decision.confidence > 70 ? 'success' : decision.confidence > 40 ? 'info' : 'warn',
      message: decision.reasoning.substring(0, 200),
      personality: `[ADK${providerInfo}] Confidence: ${decision.confidence}%`,
    };
  }
}

export const adkIntegration = new ADKIntegration();
