import { EventEmitter } from 'events';
import { ccxtAdapter } from './providers/CCXTAdapter';
import type { LivePrice, AlphaSignal, SupportedExchange, OHLCVBar } from '@shared/schema';

interface PriceStreamConfig {
  updateIntervalMs: number;
  priorityTokens: string[];
  maxPriorityUpdateIntervalMs: number;
}

export interface TechnicalIndicators {
  rsi: number;
  rsiSignal: 'oversold' | 'overbought' | 'neutral';
  macd: { line: number; signal: number; histogram: number; trend: 'bullish' | 'bearish' | 'neutral' };
  ema20: number;
  ema50: number;
  ema200: number;
  bollingerBands: { upper: number; middle: number; lower: number; percentB: number };
  atr: number;
  atrPercent: number;
  volume24h: number;
  volumeChange: number;
  obv: number;
  adx?: number;
  stochRsi?: number;
}

export interface TokenAnalysis {
  symbol: string;
  price: LivePrice;
  indicators: TechnicalIndicators;
  patterns: string[];
  confluenceScore: number;
  signalStrength: 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell';
  recommendation: string;
  timestamp: number;
}

export class LivePriceService extends EventEmitter {
  private config: PriceStreamConfig = {
    updateIntervalMs: 3000,
    priorityTokens: ['BTC', 'ETH', 'SOL', 'XRP', 'BNB', 'DOGE', 'ADA', 'AVAX'],
    maxPriorityUpdateIntervalMs: 1000,
  };
  
  private isRunning: boolean = false;
  private ohlcvCache: Map<string, { data: OHLCVBar[]; timestamp: number }> = new Map();
  private analysisCache: Map<string, { analysis: TokenAnalysis; timestamp: number }> = new Map();
  
  private readonly OHLCV_CACHE_TTL = 60000;
  private readonly ANALYSIS_CACHE_TTL = 30000;

  constructor() {
    super();
    this.setupListeners();
  }

  private setupListeners(): void {
    ccxtAdapter.on('prices', (prices: LivePrice[]) => {
      this.emit('priceUpdate', prices);
    });
  }

  async start(): Promise<void> {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('[LivePriceService] Starting price streaming service');
    
    await ccxtAdapter.startPriceStreaming();
  }

  stop(): void {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    ccxtAdapter.stopPriceStreaming();
    console.log('[LivePriceService] Stopped price streaming service');
  }

  getAllPrices(): LivePrice[] {
    return ccxtAdapter.getAllCachedPrices();
  }

  getPrice(symbol: string): LivePrice | null {
    return ccxtAdapter.getCachedPrice(symbol);
  }

  async getTokenAnalysis(symbol: string): Promise<TokenAnalysis | null> {
    const cached = this.analysisCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.ANALYSIS_CACHE_TTL) {
      return cached.analysis;
    }

    const price = ccxtAdapter.getCachedPrice(symbol);
    if (!price) {
      return null;
    }

    const ohlcv = await this.getOHLCV(symbol);
    if (ohlcv.length < 50) {
      return null;
    }

    const indicators = this.calculateIndicators(ohlcv);
    const patterns = this.detectPatterns(ohlcv, indicators);
    const confluenceScore = this.calculateConfluenceScore(indicators, patterns);
    const signalStrength = this.determineSignalStrength(confluenceScore, indicators);
    const recommendation = this.generateRecommendation(signalStrength, indicators, patterns);

    const analysis: TokenAnalysis = {
      symbol,
      price,
      indicators,
      patterns,
      confluenceScore,
      signalStrength,
      recommendation,
      timestamp: Date.now(),
    };

    this.analysisCache.set(symbol, { analysis, timestamp: Date.now() });
    return analysis;
  }

  private async getOHLCV(symbol: string): Promise<OHLCVBar[]> {
    const cached = this.ohlcvCache.get(symbol);
    if (cached && Date.now() - cached.timestamp < this.OHLCV_CACHE_TTL) {
      return cached.data;
    }

    const data = await ccxtAdapter.fetchOHLCV(symbol, '1h', 200);
    if (data.length > 0) {
      this.ohlcvCache.set(symbol, { data, timestamp: Date.now() });
    }
    return data;
  }

  private calculateIndicators(ohlcv: OHLCVBar[]): TechnicalIndicators {
    const closes = ohlcv.map(bar => bar.close);
    const highs = ohlcv.map(bar => bar.high);
    const lows = ohlcv.map(bar => bar.low);
    const volumes = ohlcv.map(bar => bar.volume);
    const currentPrice = closes[closes.length - 1];

    const rsi = this.calculateRSI(closes, 14);
    const macd = this.calculateMACD(closes);
    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const ema200 = this.calculateEMA(closes, 200);
    const bollingerBands = this.calculateBollingerBands(closes, 20, 2);
    const atr = this.calculateATR(highs, lows, closes, 14);
    const obv = this.calculateOBV(closes, volumes);

    const volume24h = volumes.slice(-24).reduce((a, b) => a + b, 0);
    const volumePrev24h = volumes.slice(-48, -24).reduce((a, b) => a + b, 0);
    const volumeChange = volumePrev24h ? ((volume24h - volumePrev24h) / volumePrev24h) * 100 : 0;

    const atrPercent = (atr / currentPrice) * 100;
    const percentB = bollingerBands.upper !== bollingerBands.lower
      ? (currentPrice - bollingerBands.lower) / (bollingerBands.upper - bollingerBands.lower)
      : 0.5;

    let rsiSignal: 'oversold' | 'overbought' | 'neutral' = 'neutral';
    if (rsi < 30) rsiSignal = 'oversold';
    else if (rsi > 70) rsiSignal = 'overbought';

    let macdTrend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    if (macd.histogram > 0 && macd.line > macd.signal) macdTrend = 'bullish';
    else if (macd.histogram < 0 && macd.line < macd.signal) macdTrend = 'bearish';

    return {
      rsi,
      rsiSignal,
      macd: { ...macd, trend: macdTrend },
      ema20,
      ema50,
      ema200,
      bollingerBands: { ...bollingerBands, percentB },
      atr,
      atrPercent,
      volume24h,
      volumeChange,
      obv,
    };
  }

  private calculateRSI(closes: number[], period: number): number {
    if (closes.length < period + 1) return 50;
    
    let gains = 0;
    let losses = 0;
    
    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    
    const avgGain = gains / period;
    const avgLoss = losses / period;
    
    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  }

  private calculateMACD(closes: number[]): { line: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const line = ema12 - ema26;
    
    const macdValues: number[] = [];
    for (let i = 26; i < closes.length; i++) {
      const shortEma = this.calculateEMAAtIndex(closes, 12, i);
      const longEma = this.calculateEMAAtIndex(closes, 26, i);
      macdValues.push(shortEma - longEma);
    }
    
    const signal = macdValues.length >= 9 ? this.calculateEMA(macdValues, 9) : line;
    const histogram = line - signal;
    
    return { line, signal, histogram };
  }

  private calculateEMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    return this.calculateEMAAtIndex(data, period, data.length - 1);
  }

  private calculateEMAAtIndex(data: number[], period: number, endIndex: number): number {
    const k = 2 / (period + 1);
    let ema = data[Math.max(0, endIndex - period)];
    
    for (let i = Math.max(1, endIndex - period + 1); i <= endIndex; i++) {
      ema = data[i] * k + ema * (1 - k);
    }
    
    return ema;
  }

  private calculateBollingerBands(closes: number[], period: number, stdDevMultiplier: number): { upper: number; middle: number; lower: number } {
    const slice = closes.slice(-period);
    const sma = slice.reduce((a, b) => a + b, 0) / slice.length;
    
    const squaredDiffs = slice.map(val => Math.pow(val - sma, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / slice.length;
    const stdDev = Math.sqrt(variance);
    
    return {
      upper: sma + (stdDev * stdDevMultiplier),
      middle: sma,
      lower: sma - (stdDev * stdDevMultiplier),
    };
  }

  private calculateATR(highs: number[], lows: number[], closes: number[], period: number): number {
    if (highs.length < period + 1) return 0;
    
    const trueRanges: number[] = [];
    for (let i = 1; i < highs.length; i++) {
      const tr = Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      );
      trueRanges.push(tr);
    }
    
    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((a, b) => a + b, 0) / recentTRs.length;
  }

  private calculateOBV(closes: number[], volumes: number[]): number {
    let obv = 0;
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        obv += volumes[i];
      } else if (closes[i] < closes[i - 1]) {
        obv -= volumes[i];
      }
    }
    return obv;
  }

  private detectPatterns(ohlcv: OHLCVBar[], indicators: TechnicalIndicators): string[] {
    const patterns: string[] = [];
    const closes = ohlcv.map(bar => bar.close);
    const currentPrice = closes[closes.length - 1];

    if (indicators.rsiSignal === 'oversold' && indicators.macd.histogram > 0) {
      patterns.push('Bullish RSI Divergence');
    }
    if (indicators.rsiSignal === 'overbought' && indicators.macd.histogram < 0) {
      patterns.push('Bearish RSI Divergence');
    }

    if (currentPrice > indicators.ema20 && indicators.ema20 > indicators.ema50 && indicators.ema50 > indicators.ema200) {
      patterns.push('Golden Cross Formation');
    }
    if (currentPrice < indicators.ema20 && indicators.ema20 < indicators.ema50 && indicators.ema50 < indicators.ema200) {
      patterns.push('Death Cross Formation');
    }

    if (indicators.bollingerBands.percentB < 0.05) {
      patterns.push('Bollinger Band Squeeze (Lower)');
    }
    if (indicators.bollingerBands.percentB > 0.95) {
      patterns.push('Bollinger Band Squeeze (Upper)');
    }

    if (indicators.volumeChange > 100) {
      patterns.push('Volume Spike (>100%)');
    }
    if (indicators.volumeChange > 50 && indicators.macd.trend === 'bullish') {
      patterns.push('Volume Confirmation (Bullish)');
    }

    if (indicators.macd.histogram > 0 && this.previousHistogramNegative(ohlcv)) {
      patterns.push('MACD Crossover (Bullish)');
    }
    if (indicators.macd.histogram < 0 && this.previousHistogramPositive(ohlcv)) {
      patterns.push('MACD Crossover (Bearish)');
    }

    return patterns;
  }

  private previousHistogramNegative(ohlcv: OHLCVBar[]): boolean {
    return true;
  }

  private previousHistogramPositive(ohlcv: OHLCVBar[]): boolean {
    return true;
  }

  private calculateConfluenceScore(indicators: TechnicalIndicators, patterns: string[]): number {
    let score = 50;

    if (indicators.rsiSignal === 'oversold') score += 10;
    else if (indicators.rsiSignal === 'overbought') score -= 10;

    if (indicators.macd.trend === 'bullish') score += 15;
    else if (indicators.macd.trend === 'bearish') score -= 15;

    const currentPrice = indicators.ema20;
    if (currentPrice > indicators.ema200) score += 10;
    else score -= 10;

    if (patterns.some(p => p.includes('Bullish'))) score += 5 * patterns.filter(p => p.includes('Bullish')).length;
    if (patterns.some(p => p.includes('Bearish'))) score -= 5 * patterns.filter(p => p.includes('Bearish')).length;
    if (patterns.some(p => p.includes('Golden'))) score += 15;
    if (patterns.some(p => p.includes('Death'))) score -= 15;

    return Math.max(0, Math.min(100, score));
  }

  private determineSignalStrength(confluenceScore: number, indicators: TechnicalIndicators): 'strong_buy' | 'buy' | 'neutral' | 'sell' | 'strong_sell' {
    if (confluenceScore >= 80) return 'strong_buy';
    if (confluenceScore >= 65) return 'buy';
    if (confluenceScore <= 20) return 'strong_sell';
    if (confluenceScore <= 35) return 'sell';
    return 'neutral';
  }

  private generateRecommendation(
    signalStrength: string, 
    indicators: TechnicalIndicators, 
    patterns: string[]
  ): string {
    const patternStr = patterns.length > 0 ? patterns.join(', ') : 'No significant patterns';
    
    switch (signalStrength) {
      case 'strong_buy':
        return `Strong bullish confluence detected. RSI: ${indicators.rsi.toFixed(1)}, MACD: ${indicators.macd.trend}. Patterns: ${patternStr}. Consider scaling into position.`;
      case 'buy':
        return `Moderate bullish signals. RSI: ${indicators.rsi.toFixed(1)}. Wait for pullback to EMA20 (${indicators.ema20.toFixed(2)}) for better entry.`;
      case 'strong_sell':
        return `Strong bearish confluence detected. RSI: ${indicators.rsi.toFixed(1)}, MACD: ${indicators.macd.trend}. Patterns: ${patternStr}. Consider reducing exposure.`;
      case 'sell':
        return `Moderate bearish signals. RSI: ${indicators.rsi.toFixed(1)}. Consider taking profits or setting tighter stops.`;
      default:
        return `Market is ranging. Wait for clearer directional signals. Key levels: EMA20=${indicators.ema20.toFixed(2)}, EMA50=${indicators.ema50.toFixed(2)}.`;
    }
  }

  getTokenRegistry() {
    return ccxtAdapter.getTokenRegistry();
  }

  async getExchangeHealth(): Promise<Record<SupportedExchange, { healthy: boolean; latencyMs: number }>> {
    const health: Record<string, { healthy: boolean; latencyMs: number }> = {};
    const exchanges: SupportedExchange[] = ['binance', 'bybit', 'okx', 'coinbase', 'kraken'];
    
    await Promise.all(
      exchanges.map(async (exchange) => {
        health[exchange] = await ccxtAdapter.checkExchangeHealth(exchange);
      })
    );
    
    return health as Record<SupportedExchange, { healthy: boolean; latencyMs: number }>;
  }
}

export const livePriceService = new LivePriceService();
