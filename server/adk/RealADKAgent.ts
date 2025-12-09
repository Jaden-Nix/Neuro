import { AgentBuilder } from '@iqai/adk';

const geminiApiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const openaiApiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const anthropicApiKey = process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY;

export interface ADKTradingSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  symbol: string;
  direction: 'long' | 'short';
  confidence: number;
  entryPrice: number;
  stopLoss: number;
  takeProfit1: number;
  takeProfit2: number;
  reasoning: string;
  riskScore: number;
}

function getPreferredModel(): string {
  if (geminiApiKey) return 'gemini-2.5-flash';
  if (openaiApiKey) return 'gpt-4o';
  if (anthropicApiKey) return 'claude-sonnet-4-5';
  return 'gemini-2.5-flash';
}

export class RealADKAgent {
  private model: string;
  private isInitialized: boolean = false;

  constructor() {
    this.model = getPreferredModel();
    this.isInitialized = !!(geminiApiKey || openaiApiKey || anthropicApiKey);
    console.log(`[ADK-TS] Real ADK Agent initialized with model: ${this.model}`);
  }

  async scoutAnalysis(marketData: {
    symbol: string;
    currentPrice: number;
    priceChange24h: number;
    volume24h?: number;
    trend?: string;
  }): Promise<ADKTradingSignal> {
    if (!this.isInitialized) {
      return this.fallbackSignal(marketData);
    }

    try {
      const response = await AgentBuilder
        .withModel(this.model)
        .withInstruction(`You are SCOUT, an elite DeFi opportunity scanner.
Analyze market data and identify trading opportunities.
ALWAYS respond with valid JSON containing:
{
  "action": "BUY" or "SELL" or "HOLD",
  "symbol": "${marketData.symbol}",
  "direction": "long" or "short",
  "confidence": 0-100,
  "entryPrice": number,
  "stopLoss": number,
  "takeProfit1": number,
  "takeProfit2": number,
  "reasoning": "detailed analysis",
  "riskScore": 0-100
}`)
        .ask(`Analyze this market data for ${marketData.symbol}:
- Current Price: $${marketData.currentPrice}
- 24h Change: ${marketData.priceChange24h}%
- Volume: ${marketData.volume24h || 'unknown'}
- Trend: ${marketData.trend || 'unknown'}

Provide a trading signal with specific entry, stop-loss, and take-profit levels.`);

      return this.parseSignal(response, marketData);
    } catch (error) {
      console.error('[ADK-TS] Scout analysis failed:', error);
      return this.fallbackSignal(marketData);
    }
  }

  async riskAssessment(signal: ADKTradingSignal): Promise<{
    approved: boolean;
    adjustedRiskScore: number;
    maxPositionSize: string;
    warnings: string[];
    reasoning: string;
  }> {
    if (!this.isInitialized) {
      return {
        approved: signal.confidence > 60,
        adjustedRiskScore: signal.riskScore,
        maxPositionSize: '3%',
        warnings: ['AI not configured - using default risk parameters'],
        reasoning: 'Fallback risk assessment'
      };
    }

    try {
      const response = await AgentBuilder
        .withModel(this.model)
        .withInstruction(`You are RISK, a cautious DeFi risk evaluator.
Assess trading signals and provide risk analysis.
ALWAYS respond with valid JSON:
{
  "approved": boolean,
  "adjustedRiskScore": 0-100,
  "maxPositionSize": "percentage",
  "warnings": ["list of warnings"],
  "reasoning": "risk analysis"
}`)
        .ask(`Assess this trading signal:
Symbol: ${signal.symbol}
Action: ${signal.action} ${signal.direction}
Entry: $${signal.entryPrice}
Stop Loss: $${signal.stopLoss}
Take Profit: $${signal.takeProfit1}
Confidence: ${signal.confidence}%
Risk Score: ${signal.riskScore}

Should this trade be approved? What's the safe position size?`);

      return this.parseRiskAssessment(response, signal);
    } catch (error) {
      console.error('[ADK-TS] Risk assessment failed:', error);
      return {
        approved: signal.confidence > 65 && signal.riskScore < 50,
        adjustedRiskScore: signal.riskScore,
        maxPositionSize: '2%',
        warnings: ['Risk assessment fallback active'],
        reasoning: 'Using conservative defaults due to AI error'
      };
    }
  }

  async metaOrchestration(
    scoutSignal: ADKTradingSignal,
    riskResult: { approved: boolean; adjustedRiskScore: number; maxPositionSize: string; reasoning: string }
  ): Promise<{
    finalDecision: 'EXECUTE' | 'HOLD' | 'ABORT';
    confidence: number;
    tradingCall: ADKTradingSignal | null;
    reasoning: string;
  }> {
    if (!this.isInitialized) {
      return {
        finalDecision: riskResult.approved ? 'EXECUTE' : 'HOLD',
        confidence: scoutSignal.confidence,
        tradingCall: riskResult.approved ? scoutSignal : null,
        reasoning: 'Meta decision using fallback logic'
      };
    }

    try {
      const response = await AgentBuilder
        .withModel(this.model)
        .withInstruction(`You are META, the sovereign AI orchestrator.
Make final trading decisions based on scout and risk inputs.
ALWAYS respond with valid JSON:
{
  "finalDecision": "EXECUTE" or "HOLD" or "ABORT",
  "confidence": 0-100,
  "reasoning": "strategic reasoning",
  "approved": boolean
}`)
        .ask(`Make final decision:

Scout Signal:
- ${scoutSignal.action} ${scoutSignal.symbol} (${scoutSignal.direction})
- Entry: $${scoutSignal.entryPrice}, SL: $${scoutSignal.stopLoss}, TP: $${scoutSignal.takeProfit1}
- Confidence: ${scoutSignal.confidence}%

Risk Assessment:
- Approved: ${riskResult.approved}
- Risk Score: ${riskResult.adjustedRiskScore}
- Max Position: ${riskResult.maxPositionSize}
- Analysis: ${riskResult.reasoning}

Should we execute this trade?`);

      return this.parseMetaDecision(response, scoutSignal, riskResult);
    } catch (error) {
      console.error('[ADK-TS] Meta orchestration failed:', error);
      return {
        finalDecision: riskResult.approved && scoutSignal.confidence > 70 ? 'EXECUTE' : 'HOLD',
        confidence: scoutSignal.confidence,
        tradingCall: riskResult.approved ? scoutSignal : null,
        reasoning: 'Meta decision using fallback logic'
      };
    }
  }

  async runFullWorkflow(marketData: {
    symbol: string;
    currentPrice: number;
    priceChange24h: number;
    volume24h?: number;
    trend?: string;
  }): Promise<{
    signal: ADKTradingSignal;
    riskAssessment: { approved: boolean; adjustedRiskScore: number; maxPositionSize: string; warnings: string[]; reasoning: string };
    finalDecision: { finalDecision: 'EXECUTE' | 'HOLD' | 'ABORT'; confidence: number; tradingCall: ADKTradingSignal | null; reasoning: string };
    provider: string;
  }> {
    console.log(`[ADK-TS] Running full workflow for ${marketData.symbol}...`);

    const signal = await this.scoutAnalysis(marketData);
    console.log(`[ADK-TS] Scout: ${signal.action} ${signal.symbol} @ ${signal.confidence}% confidence`);

    const riskResult = await this.riskAssessment(signal);
    console.log(`[ADK-TS] Risk: ${riskResult.approved ? 'APPROVED' : 'REJECTED'} (${riskResult.adjustedRiskScore} risk)`);

    const finalDecision = await this.metaOrchestration(signal, riskResult);
    console.log(`[ADK-TS] Meta: ${finalDecision.finalDecision} @ ${finalDecision.confidence}% confidence`);

    return {
      signal,
      riskAssessment: riskResult,
      finalDecision,
      provider: this.model
    };
  }

  private parseSignal(response: string, marketData: { symbol: string; currentPrice: number; priceChange24h: number }): ADKTradingSignal {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          action: parsed.action || 'HOLD',
          symbol: parsed.symbol || marketData.symbol,
          direction: parsed.direction || 'long',
          confidence: parsed.confidence || 50,
          entryPrice: parsed.entryPrice || marketData.currentPrice,
          stopLoss: parsed.stopLoss || marketData.currentPrice * 0.97,
          takeProfit1: parsed.takeProfit1 || marketData.currentPrice * 1.03,
          takeProfit2: parsed.takeProfit2 || marketData.currentPrice * 1.06,
          reasoning: parsed.reasoning || response,
          riskScore: parsed.riskScore || 50
        };
      }
    } catch (e) {
      console.error('[ADK-TS] Failed to parse signal:', e);
    }
    return this.fallbackSignal(marketData);
  }

  private parseRiskAssessment(response: string, signal: ADKTradingSignal): {
    approved: boolean;
    adjustedRiskScore: number;
    maxPositionSize: string;
    warnings: string[];
    reasoning: string;
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          approved: parsed.approved ?? signal.confidence > 60,
          adjustedRiskScore: parsed.adjustedRiskScore || signal.riskScore,
          maxPositionSize: parsed.maxPositionSize || '3%',
          warnings: parsed.warnings || [],
          reasoning: parsed.reasoning || response
        };
      }
    } catch (e) {
      console.error('[ADK-TS] Failed to parse risk assessment:', e);
    }
    return {
      approved: signal.confidence > 60,
      adjustedRiskScore: signal.riskScore,
      maxPositionSize: '3%',
      warnings: ['Parsing failed - using defaults'],
      reasoning: 'Fallback assessment'
    };
  }

  private parseMetaDecision(
    response: string,
    signal: ADKTradingSignal,
    riskResult: { approved: boolean; adjustedRiskScore: number; maxPositionSize: string; reasoning: string }
  ): {
    finalDecision: 'EXECUTE' | 'HOLD' | 'ABORT';
    confidence: number;
    tradingCall: ADKTradingSignal | null;
    reasoning: string;
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        const decision = (parsed.finalDecision || 'HOLD').toUpperCase();
        return {
          finalDecision: ['EXECUTE', 'HOLD', 'ABORT'].includes(decision) ? decision as 'EXECUTE' | 'HOLD' | 'ABORT' : 'HOLD',
          confidence: parsed.confidence || signal.confidence,
          tradingCall: parsed.approved ? signal : null,
          reasoning: parsed.reasoning || response
        };
      }
    } catch (e) {
      console.error('[ADK-TS] Failed to parse meta decision:', e);
    }
    return {
      finalDecision: riskResult.approved ? 'EXECUTE' : 'HOLD',
      confidence: signal.confidence,
      tradingCall: riskResult.approved ? signal : null,
      reasoning: 'Using fallback decision logic'
    };
  }

  private fallbackSignal(marketData: { symbol: string; currentPrice: number; priceChange24h: number }): ADKTradingSignal {
    const isBullish = marketData.priceChange24h > 0;
    return {
      action: isBullish ? 'BUY' : 'HOLD',
      symbol: marketData.symbol,
      direction: isBullish ? 'long' : 'short',
      confidence: 55,
      entryPrice: marketData.currentPrice,
      stopLoss: marketData.currentPrice * (isBullish ? 0.97 : 1.03),
      takeProfit1: marketData.currentPrice * (isBullish ? 1.03 : 0.97),
      takeProfit2: marketData.currentPrice * (isBullish ? 1.06 : 0.94),
      reasoning: `Fallback signal based on 24h ${isBullish ? 'bullish' : 'bearish'} momentum`,
      riskScore: 50
    };
  }

  getStatus(): { initialized: boolean; model: string; hasGemini: boolean; hasOpenAI: boolean; hasAnthropic: boolean } {
    return {
      initialized: this.isInitialized,
      model: this.model,
      hasGemini: !!geminiApiKey,
      hasOpenAI: !!openaiApiKey,
      hasAnthropic: !!anthropicApiKey
    };
  }
}

export const realADKAgent = new RealADKAgent();
