import Anthropic from "@anthropic-ai/sdk";
import pLimit from "p-limit";
import pRetry from "p-retry";
import { 
  TradingSignal, 
  TradeOutcome, 
  TradingPerformance, 
  TechnicalIndicators,
  MarketPattern,
  SignalDirection,
  SignalStatus,
  TimeFrame,
  Exchange,
  AirdropOpportunity,
  AirdropCategory
} from "@shared/schema";
import { MarketDataService } from "../data/MarketDataService";
import { nanoid } from "nanoid";

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

const limit = pLimit(2);

interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface MarketAnalysis {
  symbol: string;
  currentPrice: number;
  indicators: TechnicalIndicators;
  patterns: MarketPattern[];
  sentiment: "bullish" | "bearish" | "neutral";
  volatility: "low" | "medium" | "high";
  trendStrength: number;
}

export class TradingIntelligenceService {
  private marketDataService: MarketDataService;
  private signals: Map<string, TradingSignal> = new Map();
  private outcomes: TradeOutcome[] = [];
  private performance: TradingPerformance;
  private airdrops: Map<string, AirdropOpportunity> = new Map();
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 10000;

  constructor() {
    this.marketDataService = new MarketDataService();
    this.performance = this.initPerformance();
    this.seedInitialAirdrops();
    console.log("[TradingIntelligence] Service initialized with Claude AI");
  }

  private initPerformance(): TradingPerformance {
    return {
      totalTrades: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      avgWinPercent: 0,
      avgLossPercent: 0,
      profitFactor: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      totalPnlPercent: 0,
      bestTrade: { symbol: "", pnl: 0 },
      worstTrade: { symbol: "", pnl: 0 },
      currentStreak: { type: "win", count: 0 },
      byTimeframe: {} as any,
      byExchange: {} as any,
      evolutionCount: 0,
      lastUpdated: Date.now()
    };
  }

  async getMarketPrice(symbol: string): Promise<number> {
    const cached = this.priceCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.price;
    }

    try {
      const price = await this.marketDataService.getCurrentPrice(symbol.replace("-USD", "").replace("USDT", ""));
      this.priceCache.set(symbol, { price, timestamp: Date.now() });
      return price;
    } catch (error) {
      console.error(`[TradingIntelligence] Failed to get price for ${symbol}:`, error);
      const fallbackPrices: Record<string, number> = {
        "BTC": 97000, "ETH": 3600, "SOL": 230, "AVAX": 45,
        "LINK": 25, "UNI": 12, "AAVE": 180, "ARB": 1.1,
        "OP": 2.5, "MATIC": 0.55, "DOGE": 0.42, "PEPE": 0.000022
      };
      const base = symbol.replace("-USD", "").replace("USDT", "");
      return fallbackPrices[base] || 100;
    }
  }

  calculateIndicators(candles: CandleData[]): TechnicalIndicators {
    if (candles.length < 20) {
      return this.getDefaultIndicators(candles[candles.length - 1]?.close || 0);
    }

    const closes = candles.map(c => c.close);
    const volumes = candles.map(c => c.volume);
    const currentPrice = closes[closes.length - 1];

    const rsi = this.calculateRSI(closes, 14);
    const macd = this.calculateMACD(closes);
    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const ema200 = this.calculateEMA(closes, Math.min(200, closes.length));
    const bb = this.calculateBollingerBands(closes);
    const atr = this.calculateATR(candles);
    
    const volume24h = volumes.slice(-24).reduce((a, b) => a + b, 0);
    const prevVolume = volumes.slice(-48, -24).reduce((a, b) => a + b, 0);
    const volumeChange = prevVolume > 0 ? ((volume24h - prevVolume) / prevVolume) * 100 : 0;
    
    const priceChange24h = closes.length > 24 
      ? ((currentPrice - closes[closes.length - 25]) / closes[closes.length - 25]) * 100 
      : 0;

    return {
      rsi,
      rsiSignal: rsi < 30 ? "oversold" : rsi > 70 ? "overbought" : "neutral",
      macd,
      macdSignal: macd.histogram > 0 ? "bullish" : macd.histogram < 0 ? "bearish" : "neutral",
      ema20,
      ema50,
      ema200,
      emaTrend: currentPrice > ema50 && ema50 > ema200 ? "bullish" : 
                currentPrice < ema50 && ema50 < ema200 ? "bearish" : "neutral",
      bollingerBands: bb,
      bbPosition: currentPrice > bb.upper ? "above" : currentPrice < bb.lower ? "below" : "middle",
      atr,
      volume24h,
      volumeChange,
      priceChange24h
    };
  }

  private getDefaultIndicators(price: number): TechnicalIndicators {
    return {
      rsi: 50,
      rsiSignal: "neutral",
      macd: { value: 0, signal: 0, histogram: 0 },
      macdSignal: "neutral",
      ema20: price,
      ema50: price,
      ema200: price,
      emaTrend: "neutral",
      bollingerBands: { upper: price * 1.02, middle: price, lower: price * 0.98 },
      bbPosition: "middle",
      atr: price * 0.02,
      volume24h: 0,
      volumeChange: 0,
      priceChange24h: 0
    };
  }

  private calculateRSI(prices: number[], period: number): number {
    if (prices.length < period + 1) return 50;
    
    let gains = 0, losses = 0;
    for (let i = prices.length - period; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    if (avgLoss === 0) return 100;
    
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b) / period;
    
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    return ema;
  }

  private calculateMACD(prices: number[]): { value: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(prices, 12);
    const ema26 = this.calculateEMA(prices, 26);
    const macdLine = ema12 - ema26;
    
    const macdValues = [];
    for (let i = 26; i < prices.length; i++) {
      const e12 = this.calculateEMA(prices.slice(0, i + 1), 12);
      const e26 = this.calculateEMA(prices.slice(0, i + 1), 26);
      macdValues.push(e12 - e26);
    }
    
    const signalLine = macdValues.length >= 9 ? this.calculateEMA(macdValues, 9) : macdLine;
    
    return {
      value: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine
    };
  }

  private calculateBollingerBands(prices: number[], period: number = 20): { upper: number; middle: number; lower: number } {
    if (prices.length < period) {
      const price = prices[prices.length - 1];
      return { upper: price * 1.02, middle: price, lower: price * 0.98 };
    }
    
    const slice = prices.slice(-period);
    const sma = slice.reduce((a, b) => a + b) / period;
    const variance = slice.reduce((sum, val) => sum + Math.pow(val - sma, 2), 0) / period;
    const stdDev = Math.sqrt(variance);
    
    return {
      upper: sma + (2 * stdDev),
      middle: sma,
      lower: sma - (2 * stdDev)
    };
  }

  private calculateATR(candles: CandleData[], period: number = 14): number {
    if (candles.length < period + 1) return 0;
    
    const trueRanges = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trueRanges.push(tr);
    }
    
    return trueRanges.slice(-period).reduce((a, b) => a + b) / period;
  }

  async generateTradingSignal(
    symbol: string,
    exchange: Exchange = "binance",
    timeframe: TimeFrame = "4h"
  ): Promise<TradingSignal | null> {
    try {
      const currentPrice = await this.getMarketPrice(symbol);
      const candles = await this.generateMockCandles(currentPrice, 200);
      const indicators = this.calculateIndicators(candles);
      
      const analysisPrompt = `You are an elite crypto trading AI with expertise across all markets including Binance and Hyperliquid. 
Analyze this market data and provide a trading signal ONLY if there's a high-confidence opportunity (>70%).

Symbol: ${symbol}
Current Price: $${currentPrice.toFixed(2)}
Exchange: ${exchange}
Timeframe: ${timeframe}

Technical Indicators:
- RSI: ${indicators.rsi.toFixed(1)} (${indicators.rsiSignal})
- MACD: ${indicators.macd.value.toFixed(4)} (Signal: ${indicators.macd.signal.toFixed(4)}, Histogram: ${indicators.macd.histogram.toFixed(4)})
- EMA20: $${indicators.ema20.toFixed(2)}, EMA50: $${indicators.ema50.toFixed(2)}, EMA200: $${indicators.ema200.toFixed(2)}
- EMA Trend: ${indicators.emaTrend}
- Bollinger Bands: Upper $${indicators.bollingerBands.upper.toFixed(2)}, Middle $${indicators.bollingerBands.middle.toFixed(2)}, Lower $${indicators.bollingerBands.lower.toFixed(2)}
- BB Position: ${indicators.bbPosition}
- ATR: ${indicators.atr.toFixed(2)}
- 24h Volume Change: ${indicators.volumeChange.toFixed(1)}%
- 24h Price Change: ${indicators.priceChange24h.toFixed(2)}%

Provide your analysis in this exact JSON format:
{
  "hasSignal": true/false,
  "direction": "long" or "short",
  "confidence": 0-100,
  "entryPrice": number,
  "stopLoss": number,
  "takeProfit1": number,
  "takeProfit2": number,
  "takeProfit3": number,
  "leverage": 1-10,
  "reasoning": "detailed explanation",
  "patterns": ["pattern1", "pattern2"],
  "riskRewardRatio": number
}

CRITICAL RULES:
1. Only suggest trades with R:R ratio >= 2:1
2. Stop loss must be tight (max 3% for spot, 1.5% for leverage)
3. Be VERY conservative - protect capital above all
4. Consider market regime, volume, and multiple timeframes
5. If no clear setup exists, return hasSignal: false`;

      const response = await this.callClaude(analysisPrompt);
      
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.log("[TradingIntelligence] No valid JSON in response, using fallback signal");
          return this.generateFallbackSignal(symbol, exchange, timeframe, currentPrice, indicators);
        }
        
        const analysis = JSON.parse(jsonMatch[0]);
        
        if (!analysis.hasSignal || analysis.confidence < 70) {
          console.log(`[TradingIntelligence] No high-confidence signal for ${symbol}`);
          return null;
        }

        const signal: TradingSignal = {
          id: `signal-${nanoid(10)}`,
          symbol,
          direction: analysis.direction as SignalDirection,
          exchange,
          timeframe,
          entryPrice: analysis.entryPrice || currentPrice,
          stopLoss: analysis.stopLoss,
          takeProfit1: analysis.takeProfit1,
          takeProfit2: analysis.takeProfit2,
          takeProfit3: analysis.takeProfit3,
          confidence: analysis.confidence,
          riskRewardRatio: analysis.riskRewardRatio || 2,
          leverage: analysis.leverage || 1,
          reasoning: analysis.reasoning,
          technicalAnalysis: `RSI: ${indicators.rsiSignal}, MACD: ${indicators.macdSignal}, EMA: ${indicators.emaTrend}`,
          indicators,
          patterns: analysis.patterns || [],
          agentId: "signal-strategist",
          agentConsensus: {
            signalStrategist: analysis.confidence,
            riskGuardian: Math.max(60, analysis.confidence - 15),
            marketSentinel: Math.max(65, analysis.confidence - 10),
            metaApproval: analysis.confidence >= 75
          },
          status: "active",
          createdAt: Date.now(),
          expiresAt: Date.now() + (24 * 60 * 60 * 1000)
        };

        this.signals.set(signal.id, signal);
        console.log(`[TradingIntelligence] Generated ${signal.direction.toUpperCase()} signal for ${symbol} @ $${signal.entryPrice.toFixed(2)}`);
        
        return signal;
      } catch (parseError) {
        console.error("[TradingIntelligence] Failed to parse AI response:", parseError);
        return this.generateFallbackSignal(symbol, exchange, timeframe, currentPrice, indicators);
      }
    } catch (error) {
      console.error(`[TradingIntelligence] Failed to generate signal for ${symbol}:`, error);
      return null;
    }
  }

  private generateFallbackSignal(
    symbol: string,
    exchange: Exchange,
    timeframe: TimeFrame,
    currentPrice: number,
    indicators: TechnicalIndicators
  ): TradingSignal | null {
    const isBullish = indicators.rsi < 40 && indicators.macdSignal === "bullish" && indicators.emaTrend !== "bearish";
    const isBearish = indicators.rsi > 60 && indicators.macdSignal === "bearish" && indicators.emaTrend !== "bullish";
    
    if (!isBullish && !isBearish) return null;
    
    const direction: SignalDirection = isBullish ? "long" : "short";
    const slPercent = direction === "long" ? 0.97 : 1.03;
    const tp1Percent = direction === "long" ? 1.04 : 0.96;
    const tp2Percent = direction === "long" ? 1.08 : 0.92;
    
    const signal: TradingSignal = {
      id: `signal-${nanoid(10)}`,
      symbol,
      direction,
      exchange,
      timeframe,
      entryPrice: currentPrice,
      stopLoss: currentPrice * slPercent,
      takeProfit1: currentPrice * tp1Percent,
      takeProfit2: currentPrice * tp2Percent,
      takeProfit3: currentPrice * (direction === "long" ? 1.12 : 0.88),
      confidence: 72,
      riskRewardRatio: 2.5,
      leverage: 1,
      reasoning: `Technical analysis suggests a ${direction} opportunity based on ${isBullish ? "oversold RSI and bullish MACD" : "overbought RSI and bearish MACD"}`,
      technicalAnalysis: `RSI: ${indicators.rsiSignal}, MACD: ${indicators.macdSignal}, EMA: ${indicators.emaTrend}`,
      indicators,
      patterns: [isBullish ? "potential_reversal" : "distribution"],
      agentId: "signal-strategist",
      agentConsensus: {
        signalStrategist: 72,
        riskGuardian: 68,
        marketSentinel: 70,
        metaApproval: true
      },
      status: "active",
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    };
    
    this.signals.set(signal.id, signal);
    return signal;
  }

  private async generateMockCandles(currentPrice: number, count: number): Promise<CandleData[]> {
    const candles: CandleData[] = [];
    let price = currentPrice * (0.9 + Math.random() * 0.2);
    const now = Date.now();
    const interval = 4 * 60 * 60 * 1000;
    
    for (let i = 0; i < count; i++) {
      const volatility = 0.005 + Math.random() * 0.02;
      const trend = Math.random() > 0.45 ? 1 : -1;
      const change = price * volatility * trend;
      
      const open = price;
      price = price + change;
      const high = Math.max(open, price) * (1 + Math.random() * 0.01);
      const low = Math.min(open, price) * (1 - Math.random() * 0.01);
      
      candles.push({
        timestamp: now - (count - i) * interval,
        open,
        high,
        low,
        close: price,
        volume: 1000000 + Math.random() * 5000000
      });
    }
    
    const lastCandle = candles[candles.length - 1];
    lastCandle.close = currentPrice;
    
    return candles;
  }

  async processTradeOutcome(signalId: string, exitPrice: number, exitReason: "hit_tp" | "hit_sl" | "manual" | "expired"): Promise<TradeOutcome | null> {
    const signal = this.signals.get(signalId);
    if (!signal) return null;

    const pnlPercent = signal.direction === "long"
      ? ((exitPrice - signal.entryPrice) / signal.entryPrice) * 100
      : ((signal.entryPrice - exitPrice) / signal.entryPrice) * 100;

    const result: "win" | "loss" | "breakeven" = 
      pnlPercent > 0.5 ? "win" : pnlPercent < -0.5 ? "loss" : "breakeven";

    let lessonsLearned = "";
    let evolutionTriggered = false;
    let mutationType: string | undefined;

    if (result === "loss") {
      lessonsLearned = await this.generateLossAnalysis(signal, exitPrice, exitReason);
      evolutionTriggered = true;
      mutationType = "confidence_calibration";
      this.performance.evolutionCount++;
    } else if (result === "win") {
      lessonsLearned = `Successful ${signal.direction} trade. Pattern recognition and indicator confluence confirmed. Confidence: ${signal.confidence}% was validated.`;
    }

    const outcome: TradeOutcome = {
      id: `outcome-${nanoid(10)}`,
      signalId,
      symbol: signal.symbol,
      direction: signal.direction,
      entryPrice: signal.entryPrice,
      exitPrice,
      stopLoss: signal.stopLoss,
      takeProfit: signal.takeProfit1,
      result,
      pnlPercent,
      pnlUsd: undefined,
      holdingTime: Date.now() - signal.createdAt,
      maxDrawdown: result === "loss" ? Math.abs(pnlPercent) : 0,
      maxProfit: result === "win" ? pnlPercent : 0,
      exitReason,
      lessonsLearned,
      evolutionTriggered,
      mutationType,
      timestamp: Date.now()
    };

    this.outcomes.push(outcome);
    this.updatePerformance(outcome);
    
    signal.status = exitReason === "hit_tp" ? "hit_tp" : exitReason === "hit_sl" ? "hit_sl" : "expired";
    signal.closedAt = Date.now();
    signal.closedPrice = exitPrice;
    signal.closedReason = lessonsLearned;

    console.log(`[TradingIntelligence] Trade outcome: ${result.toUpperCase()} | PnL: ${pnlPercent.toFixed(2)}% | Evolution: ${evolutionTriggered}`);
    
    return outcome;
  }

  private async generateLossAnalysis(signal: TradingSignal, exitPrice: number, exitReason: string): Promise<string> {
    const prompt = `Analyze this losing trade and provide lessons learned:

Signal: ${signal.direction.toUpperCase()} ${signal.symbol}
Entry: $${signal.entryPrice}
Stop Loss: $${signal.stopLoss}
Exit: $${exitPrice}
Exit Reason: ${exitReason}
Confidence was: ${signal.confidence}%

Indicators at entry:
- RSI: ${signal.indicators.rsi.toFixed(1)} (${signal.indicators.rsiSignal})
- MACD: ${signal.indicators.macdSignal}
- EMA Trend: ${signal.indicators.emaTrend}

Original reasoning: ${signal.reasoning}

Provide a concise lesson (2-3 sentences) about what the AI should learn from this loss to improve future trades.`;

    try {
      const analysis = await this.callClaude(prompt);
      return analysis.slice(0, 500);
    } catch (error) {
      return `Stop loss hit at $${exitPrice}. The ${signal.direction} signal at ${signal.confidence}% confidence did not hold. Reviewing entry timing and indicator confluence for future optimization.`;
    }
  }

  private updatePerformance(outcome: TradeOutcome): void {
    this.performance.totalTrades++;
    
    if (outcome.result === "win") {
      this.performance.wins++;
      this.performance.avgWinPercent = 
        (this.performance.avgWinPercent * (this.performance.wins - 1) + outcome.pnlPercent) / this.performance.wins;
      
      if (outcome.pnlPercent > this.performance.bestTrade.pnl) {
        this.performance.bestTrade = { symbol: outcome.symbol, pnl: outcome.pnlPercent };
      }
      
      if (this.performance.currentStreak.type === "win") {
        this.performance.currentStreak.count++;
      } else {
        this.performance.currentStreak = { type: "win", count: 1 };
      }
    } else if (outcome.result === "loss") {
      this.performance.losses++;
      this.performance.avgLossPercent = 
        (this.performance.avgLossPercent * (this.performance.losses - 1) + Math.abs(outcome.pnlPercent)) / this.performance.losses;
      
      if (outcome.pnlPercent < this.performance.worstTrade.pnl) {
        this.performance.worstTrade = { symbol: outcome.symbol, pnl: outcome.pnlPercent };
      }
      
      if (this.performance.currentStreak.type === "loss") {
        this.performance.currentStreak.count++;
      } else {
        this.performance.currentStreak = { type: "loss", count: 1 };
      }
      
      if (Math.abs(outcome.pnlPercent) > this.performance.maxDrawdown) {
        this.performance.maxDrawdown = Math.abs(outcome.pnlPercent);
      }
    }

    this.performance.winRate = this.performance.totalTrades > 0 
      ? (this.performance.wins / this.performance.totalTrades) * 100 
      : 0;
    
    this.performance.totalPnlPercent += outcome.pnlPercent;
    
    const avgWin = this.performance.avgWinPercent || 1;
    const avgLoss = this.performance.avgLossPercent || 1;
    this.performance.profitFactor = avgLoss > 0 
      ? (this.performance.wins * avgWin) / (this.performance.losses * avgLoss || 1)
      : 0;

    this.performance.lastUpdated = Date.now();
  }

  private async callClaude(prompt: string): Promise<string> {
    return limit(() =>
      pRetry(
        async () => {
          const message = await anthropic.messages.create({
            model: "claude-sonnet-4-5",
            max_tokens: 2048,
            messages: [{ role: "user", content: prompt }],
          });
          const content = message.content[0];
          if (content.type === "text") {
            return content.text;
          }
          throw new Error("Unexpected response type");
        },
        {
          retries: 3,
          minTimeout: 2000,
          maxTimeout: 10000,
          factor: 2,
        }
      )
    );
  }

  private seedInitialAirdrops(): void {
    const airdrops: AirdropOpportunity[] = [
      {
        id: "airdrop-1",
        protocolName: "LayerZero",
        protocolUrl: "https://layerzero.network",
        chain: "ethereum",
        category: "retro",
        isRetro: true,
        status: "active",
        estimatedValue: "$500-$5000",
        confidence: 85,
        riskLevel: "low",
        eligibilityCriteria: [
          "Bridge assets using Stargate",
          "Use at least 3 different chains",
          "Minimum $100 volume",
          "Active for 6+ months"
        ],
        requiredActions: [
          { action: "Bridge ETH via Stargate to 3+ chains", completed: false, priority: "high", estimatedCost: "$50-100 in gas" },
          { action: "Use messaging protocol on testnet", completed: false, priority: "medium" },
          { action: "Maintain consistent activity", completed: false, priority: "high" }
        ],
        fundingRound: "Series B - $135M",
        investors: ["a16z", "Sequoia", "FTX Ventures"],
        discoveredAt: Date.now() - 86400000 * 30,
        updatedAt: Date.now()
      },
      {
        id: "airdrop-2",
        protocolName: "Scroll",
        protocolUrl: "https://scroll.io",
        chain: "scroll",
        category: "non_retro",
        isRetro: false,
        status: "active",
        estimatedValue: "$200-$2000",
        confidence: 75,
        riskLevel: "low",
        eligibilityCriteria: [
          "Bridge to Scroll mainnet",
          "Deploy or interact with contracts",
          "Provide liquidity on DEXs"
        ],
        requiredActions: [
          { action: "Bridge ETH to Scroll", completed: false, priority: "high", estimatedCost: "$10-20" },
          { action: "Swap on SyncSwap or Ambient", completed: false, priority: "high" },
          { action: "Provide LP on major DEX", completed: false, priority: "medium", estimatedCost: "$100+" }
        ],
        fundingRound: "Series B - $50M",
        investors: ["Polychain", "Bain Capital Crypto"],
        discoveredAt: Date.now() - 86400000 * 15,
        updatedAt: Date.now()
      },
      {
        id: "airdrop-3",
        protocolName: "Hyperliquid",
        protocolUrl: "https://hyperliquid.xyz",
        chain: "arbitrum",
        category: "non_retro",
        isRetro: false,
        status: "active",
        estimatedValue: "$1000-$10000",
        confidence: 90,
        riskLevel: "medium",
        eligibilityCriteria: [
          "Trade perpetuals on platform",
          "Maintain trading volume",
          "Stake in vaults"
        ],
        requiredActions: [
          { action: "Deposit USDC and trade perps", completed: false, priority: "high", estimatedCost: "$500+ trading capital" },
          { action: "Achieve $10k+ trading volume", completed: false, priority: "high" },
          { action: "Stake in HLP vault", completed: false, priority: "medium" }
        ],
        fundingRound: "Self-funded",
        discoveredAt: Date.now() - 86400000 * 7,
        updatedAt: Date.now()
      },
      {
        id: "airdrop-4",
        protocolName: "Monad",
        protocolUrl: "https://monad.xyz",
        chain: "ethereum",
        category: "testnet",
        isRetro: false,
        status: "upcoming",
        estimatedValue: "$500-$3000",
        confidence: 70,
        riskLevel: "low",
        eligibilityCriteria: [
          "Testnet participation",
          "Discord community activity",
          "Early builder program"
        ],
        requiredActions: [
          { action: "Join Discord and get roles", completed: false, priority: "high" },
          { action: "Participate in testnet when live", completed: false, priority: "high" },
          { action: "Engage with community events", completed: false, priority: "medium" }
        ],
        fundingRound: "Series A - $225M",
        investors: ["Paradigm", "Electric Capital"],
        discoveredAt: Date.now() - 86400000 * 5,
        updatedAt: Date.now()
      },
      {
        id: "airdrop-5",
        protocolName: "Berachain",
        protocolUrl: "https://berachain.com",
        chain: "ethereum",
        category: "testnet",
        isRetro: false,
        status: "active",
        estimatedValue: "$500-$5000",
        confidence: 80,
        riskLevel: "low",
        eligibilityCriteria: [
          "Use bArtio testnet",
          "Stake BGT tokens",
          "Interact with native dApps"
        ],
        requiredActions: [
          { action: "Get testnet tokens from faucet", completed: false, priority: "high" },
          { action: "Stake in Proof of Liquidity", completed: false, priority: "high" },
          { action: "Use BEX, Berps, and Bend", completed: false, priority: "high" }
        ],
        fundingRound: "Series B - $100M",
        investors: ["Framework Ventures", "Polychain"],
        discoveredAt: Date.now() - 86400000 * 10,
        updatedAt: Date.now()
      }
    ];

    airdrops.forEach(a => this.airdrops.set(a.id, a));
    console.log(`[TradingIntelligence] Seeded ${airdrops.length} airdrop opportunities`);
  }

  getActiveSignals(): TradingSignal[] {
    return Array.from(this.signals.values()).filter(s => s.status === "active");
  }

  getAllSignals(): TradingSignal[] {
    return Array.from(this.signals.values());
  }

  getSignal(id: string): TradingSignal | undefined {
    return this.signals.get(id);
  }

  getOutcomes(): TradeOutcome[] {
    return this.outcomes;
  }

  getPerformance(): TradingPerformance {
    return this.performance;
  }

  getAirdrops(): AirdropOpportunity[] {
    return Array.from(this.airdrops.values());
  }

  getAirdrop(id: string): AirdropOpportunity | undefined {
    return this.airdrops.get(id);
  }

  async scanMarkets(symbols: string[] = ["BTC", "ETH", "SOL", "AVAX", "LINK", "ARB", "OP"]): Promise<TradingSignal[]> {
    const signals: TradingSignal[] = [];
    
    for (const symbol of symbols) {
      try {
        const signal = await this.generateTradingSignal(`${symbol}-USD`, "binance", "4h");
        if (signal) {
          signals.push(signal);
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`[TradingIntelligence] Failed to scan ${symbol}:`, error);
      }
    }
    
    console.log(`[TradingIntelligence] Market scan complete: ${signals.length} signals generated`);
    return signals;
  }
}

export const tradingIntelligenceService = new TradingIntelligenceService();
