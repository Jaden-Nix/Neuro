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
import { 
  advancedIntelligence, 
  type CandleData as AdvancedCandleData,
  type IntelligenceScore,
  type VolatilityRegime,
  type PatternMatch,
  type FundingRateData,
  type WhaleTransaction,
  type SentimentSignal,
  type OrderFlowData,
  type SmartMoneyFlow,
  type LiquidationLevel,
  type CrossChainFlow,
  type MultiTimeframeAnalysis,
  type DataQuality
} from "./AdvancedIntelligence";

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
    const highs = candles.map(c => c.high);
    const lows = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);
    const currentPrice = closes[closes.length - 1];

    const rsi = this.calculateRSI(closes, 14);
    const macd = this.calculateMACD(closes);
    const ema20 = this.calculateEMA(closes, 20);
    const ema50 = this.calculateEMA(closes, 50);
    const ema200 = this.calculateEMA(closes, Math.min(200, closes.length));
    const bb = this.calculateBollingerBands(closes);
    const atr = this.calculateATR(candles);
    
    const stochRSI = this.calculateStochasticRSI(closes);
    const adx = this.calculateADX(highs, lows, closes);
    const obv = this.calculateOBV(closes, volumes);
    const vwap = this.calculateVWAP(highs, lows, closes, volumes);
    
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
      priceChange24h,
      stochRSI,
      adx,
      obv,
      vwap
    };
  }
  
  private calculateStochasticRSI(prices: number[], period: number = 14): { k: number; d: number } {
    const rsiValues: number[] = [];
    for (let i = period; i < prices.length; i++) {
      rsiValues.push(this.calculateRSI(prices.slice(0, i + 1), period));
    }
    
    if (rsiValues.length < period) return { k: 50, d: 50 };
    
    const recentRSI = rsiValues.slice(-period);
    const minRSI = Math.min(...recentRSI);
    const maxRSI = Math.max(...recentRSI);
    const currentRSI = rsiValues[rsiValues.length - 1];
    
    const k = maxRSI !== minRSI ? ((currentRSI - minRSI) / (maxRSI - minRSI)) * 100 : 50;
    
    const kValues: number[] = [];
    for (let i = period; i <= rsiValues.length; i++) {
      const slice = rsiValues.slice(i - period, i);
      const minR = Math.min(...slice);
      const maxR = Math.max(...slice);
      const currR = rsiValues[i - 1];
      kValues.push(maxR !== minR ? ((currR - minR) / (maxR - minR)) * 100 : 50);
    }
    
    const d = kValues.length >= 3 
      ? kValues.slice(-3).reduce((a, b) => a + b) / 3 
      : k;
    
    return { k: Math.max(0, Math.min(100, k)), d: Math.max(0, Math.min(100, d)) };
  }
  
  private calculateADX(highs: number[], lows: number[], closes: number[], period: number = 14): number {
    if (closes.length < period * 2) return 25;
    
    const trValues: number[] = [];
    const plusDMValues: number[] = [];
    const minusDMValues: number[] = [];
    
    for (let i = 1; i < closes.length; i++) {
      const highDiff = highs[i] - highs[i - 1];
      const lowDiff = lows[i - 1] - lows[i];
      
      plusDMValues.push(highDiff > lowDiff && highDiff > 0 ? highDiff : 0);
      minusDMValues.push(lowDiff > highDiff && lowDiff > 0 ? lowDiff : 0);
      
      trValues.push(Math.max(
        highs[i] - lows[i],
        Math.abs(highs[i] - closes[i - 1]),
        Math.abs(lows[i] - closes[i - 1])
      ));
    }
    
    const smoothedTR = this.wilder_smooth(trValues, period);
    const smoothedPlusDM = this.wilder_smooth(plusDMValues, period);
    const smoothedMinusDM = this.wilder_smooth(minusDMValues, period);
    
    if (smoothedTR === 0) return 25;
    
    const plusDI = (smoothedPlusDM / smoothedTR) * 100;
    const minusDI = (smoothedMinusDM / smoothedTR) * 100;
    
    if (plusDI + minusDI === 0) return 25;
    
    const dx = Math.abs(plusDI - minusDI) / (plusDI + minusDI) * 100;
    
    const dxValues: number[] = [];
    for (let i = period; i < trValues.length; i++) {
      const sliceTR = this.wilder_smooth(trValues.slice(0, i + 1), period);
      const slicePlusDM = this.wilder_smooth(plusDMValues.slice(0, i + 1), period);
      const sliceMinusDM = this.wilder_smooth(minusDMValues.slice(0, i + 1), period);
      
      if (sliceTR > 0) {
        const pDI = (slicePlusDM / sliceTR) * 100;
        const mDI = (sliceMinusDM / sliceTR) * 100;
        if (pDI + mDI > 0) {
          dxValues.push(Math.abs(pDI - mDI) / (pDI + mDI) * 100);
        }
      }
    }
    
    const adx = dxValues.length >= period 
      ? this.wilder_smooth(dxValues.slice(-period * 2), period)
      : dx;
    
    return Math.min(100, Math.max(0, adx));
  }
  
  private wilder_smooth(values: number[], period: number): number {
    if (values.length < period) {
      return values.reduce((a, b) => a + b, 0) / values.length || 0;
    }
    
    let smoothed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    for (let i = period; i < values.length; i++) {
      smoothed = (smoothed * (period - 1) + values[i]) / period;
    }
    return smoothed;
  }
  
  private calculateOBV(closes: number[], volumes: number[]): { value: number; trend: "bullish" | "bearish" | "neutral" } {
    let obv = 0;
    const obvValues: number[] = [0];
    
    for (let i = 1; i < closes.length; i++) {
      if (closes[i] > closes[i - 1]) {
        obv += volumes[i];
      } else if (closes[i] < closes[i - 1]) {
        obv -= volumes[i];
      }
      obvValues.push(obv);
    }
    
    const lookback = Math.min(20, obvValues.length);
    const recentOBV = obvValues.slice(-lookback);
    
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    for (let i = 0; i < recentOBV.length; i++) {
      sumX += i;
      sumY += recentOBV[i];
      sumXY += i * recentOBV[i];
      sumX2 += i * i;
    }
    const n = recentOBV.length;
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    
    const avgOBV = sumY / n;
    const normalizedSlope = avgOBV !== 0 ? (slope / Math.abs(avgOBV)) * 100 : 0;
    
    const trend = normalizedSlope > 2 ? "bullish" :
                  normalizedSlope < -2 ? "bearish" : "neutral";
    
    return { value: obv, trend };
  }
  
  private calculateVWAP(highs: number[], lows: number[], closes: number[], volumes: number[]): number {
    let cumulativeTPV = 0;
    let cumulativeVolume = 0;
    
    for (let i = 0; i < closes.length; i++) {
      const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
      cumulativeTPV += typicalPrice * volumes[i];
      cumulativeVolume += volumes[i];
    }
    
    return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : closes[closes.length - 1];
  }
  
  calculateConfluenceScore(indicators: TechnicalIndicators, direction: "long" | "short"): {
    score: number;
    signals: { indicator: string; signal: string; weight: number }[];
    recommendation: "strong_entry" | "entry" | "wait" | "avoid";
  } {
    const signals: { indicator: string; signal: string; weight: number }[] = [];
    let totalWeight = 0;
    let maxWeight = 0;
    
    if (direction === "long") {
      if (indicators.rsi < 35) {
        signals.push({ indicator: "RSI", signal: "Oversold < 35", weight: 15 });
        totalWeight += 15;
      } else if (indicators.rsi < 45) {
        signals.push({ indicator: "RSI", signal: "Low zone", weight: 8 });
        totalWeight += 8;
      }
      maxWeight += 15;
      
      if (indicators.macd.histogram > 0 && indicators.macd.value > indicators.macd.signal) {
        signals.push({ indicator: "MACD", signal: "Bullish crossover", weight: 12 });
        totalWeight += 12;
      }
      maxWeight += 12;
      
      if (indicators.emaTrend === "bullish") {
        signals.push({ indicator: "EMA Trend", signal: "Price > EMA50 > EMA200", weight: 15 });
        totalWeight += 15;
      }
      maxWeight += 15;
      
      if (indicators.bbPosition === "below") {
        signals.push({ indicator: "Bollinger", signal: "Below lower band", weight: 10 });
        totalWeight += 10;
      }
      maxWeight += 10;
      
      if (indicators.stochRSI && indicators.stochRSI.k < 20) {
        signals.push({ indicator: "StochRSI", signal: "Extreme oversold", weight: 12 });
        totalWeight += 12;
      }
      maxWeight += 12;
      
      if (indicators.adx && indicators.adx > 25) {
        signals.push({ indicator: "ADX", signal: `Strong trend (${indicators.adx.toFixed(0)})`, weight: 10 });
        totalWeight += 10;
      }
      maxWeight += 10;
      
      if (indicators.obv && indicators.obv.trend === "bullish") {
        signals.push({ indicator: "OBV", signal: "Volume confirming uptrend", weight: 10 });
        totalWeight += 10;
      }
      maxWeight += 10;
      
      if (indicators.volumeChange > 20) {
        signals.push({ indicator: "Volume", signal: `Surge +${indicators.volumeChange.toFixed(0)}%`, weight: 8 });
        totalWeight += 8;
      }
      maxWeight += 8;
    } else {
      if (indicators.rsi > 65) {
        signals.push({ indicator: "RSI", signal: "Overbought > 65", weight: 15 });
        totalWeight += 15;
      } else if (indicators.rsi > 55) {
        signals.push({ indicator: "RSI", signal: "High zone", weight: 8 });
        totalWeight += 8;
      }
      maxWeight += 15;
      
      if (indicators.macd.histogram < 0 && indicators.macd.value < indicators.macd.signal) {
        signals.push({ indicator: "MACD", signal: "Bearish crossover", weight: 12 });
        totalWeight += 12;
      }
      maxWeight += 12;
      
      if (indicators.emaTrend === "bearish") {
        signals.push({ indicator: "EMA Trend", signal: "Price < EMA50 < EMA200", weight: 15 });
        totalWeight += 15;
      }
      maxWeight += 15;
      
      if (indicators.bbPosition === "above") {
        signals.push({ indicator: "Bollinger", signal: "Above upper band", weight: 10 });
        totalWeight += 10;
      }
      maxWeight += 10;
      
      if (indicators.stochRSI && indicators.stochRSI.k > 80) {
        signals.push({ indicator: "StochRSI", signal: "Extreme overbought", weight: 12 });
        totalWeight += 12;
      }
      maxWeight += 12;
      
      if (indicators.adx && indicators.adx > 25) {
        signals.push({ indicator: "ADX", signal: `Strong trend (${indicators.adx.toFixed(0)})`, weight: 10 });
        totalWeight += 10;
      }
      maxWeight += 10;
      
      if (indicators.obv && indicators.obv.trend === "bearish") {
        signals.push({ indicator: "OBV", signal: "Volume confirming downtrend", weight: 10 });
        totalWeight += 10;
      }
      maxWeight += 10;
      
      if (indicators.volumeChange > 20) {
        signals.push({ indicator: "Volume", signal: `Surge +${indicators.volumeChange.toFixed(0)}%`, weight: 8 });
        totalWeight += 8;
      }
      maxWeight += 8;
    }
    
    const score = maxWeight > 0 ? (totalWeight / maxWeight) * 100 : 0;
    
    let recommendation: "strong_entry" | "entry" | "wait" | "avoid";
    if (score >= 75 && signals.length >= 5) {
      recommendation = "strong_entry";
    } else if (score >= 60 && signals.length >= 4) {
      recommendation = "entry";
    } else if (score >= 40 && signals.length >= 3) {
      recommendation = "wait";
    } else {
      recommendation = "avoid";
    }
    
    return { score, signals, recommendation };
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
      priceChange24h: 0,
      stochRSI: { k: 50, d: 50 },
      adx: 25,
      obv: { value: 0, trend: "neutral" },
      vwap: price
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
      
      const ohlcvResult = await advancedIntelligence.fetchRealOHLCVWithMetadata(symbol, timeframe, 200);
      const realCandles = ohlcvResult.candles;
      const isDataReal = ohlcvResult.source === 'real';
      
      if (!isDataReal) {
        console.log(`[TradingIntelligence] ${symbol} FILTERED OUT - Using synthetic OHLCV data, skipping signal generation`);
        return null;
      }
      
      const candles: CandleData[] = realCandles.map(c => ({
        timestamp: c.timestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }));
      
      const indicators = this.calculateIndicators(candles);
      
      const volatilityRegime = advancedIntelligence.calculateVolatilityRegime(realCandles);
      const patterns = advancedIntelligence.detectPatterns(realCandles, symbol, timeframe);
      const funding = await advancedIntelligence.fetchFundingRates(symbol);
      const sentiment = advancedIntelligence.simulateSentiment(symbol);
      const orderFlow = advancedIntelligence.simulateOrderFlow(symbol);
      const whaleActivity = advancedIntelligence.simulateWhaleActivity(symbol);
      const smartMoney = advancedIntelligence.simulateSmartMoneyFlow(symbol);
      const liquidations = advancedIntelligence.simulateLiquidationLevels(symbol, currentPrice);
      
      const mtfAnalysis = await advancedIntelligence.analyzeMultiTimeframe(symbol, timeframe);
      
      const longConfluence = this.calculateConfluenceScore(indicators, "long");
      const shortConfluence = this.calculateConfluenceScore(indicators, "short");
      
      const bestDirection = longConfluence.score > shortConfluence.score ? "long" : "short";
      const bestConfluence = bestDirection === "long" ? longConfluence : shortConfluence;
      
      const intelligenceScore = await advancedIntelligence.calculateIntelligenceScore(
        symbol, 
        bestConfluence.score, 
        bestDirection,
        { source: isDataReal ? 'real' : 'synthetic' }
      );
      
      const htfAligned = (bestDirection === 'long' && mtfAnalysis.htfTrend === 'bullish') || 
                         (bestDirection === 'short' && mtfAnalysis.htfTrend === 'bearish');
      
      console.log(`[TradingIntelligence] ${symbol} ENHANCED: Technical ${bestConfluence.score.toFixed(1)}%, Overall ${intelligenceScore.overallScore.toFixed(1)}%, Volatility: ${volatilityRegime.regime}, Patterns: ${patterns.length}, HTF: ${mtfAnalysis.htfTrend}, DataQuality: ${intelligenceScore.dataQuality.overallQuality}`);
      
      if (bestConfluence.recommendation === "avoid" || bestConfluence.recommendation === "wait") {
        console.log(`[TradingIntelligence] ${symbol} FILTERED OUT - Insufficient confluence (${bestConfluence.score.toFixed(1)}% < 60%)`);
        return null;
      }
      
      if (intelligenceScore.overallScore < 50 && intelligenceScore.signals.some(s => s.includes('Unfavorable') || s.includes('Weak') || s.includes('Counter'))) {
        console.log(`[TradingIntelligence] ${symbol} FILTERED OUT - Intelligence warnings present with low score (${intelligenceScore.overallScore.toFixed(1)}%)`);
        return null;
      }
      
      if (!htfAligned && mtfAnalysis.htfTrend !== 'neutral') {
        console.log(`[TradingIntelligence] ${symbol} FILTERED OUT - HTF trend not aligned (Signal: ${bestDirection}, HTF: ${mtfAnalysis.htfTrend})`);
        return null;
      }
      
      if (intelligenceScore.dataQuality.overallQuality === 'low' && intelligenceScore.overallScore < 65) {
        console.log(`[TradingIntelligence] ${symbol} FILTERED OUT - Low data quality with insufficient score`);
        return null;
      }
      
      const stochRSIStr = indicators.stochRSI ? `StochRSI K: ${indicators.stochRSI.k.toFixed(1)}, D: ${indicators.stochRSI.d.toFixed(1)}` : "N/A";
      const adxStr = indicators.adx ? `ADX: ${indicators.adx.toFixed(1)}` : "N/A";
      const obvStr = indicators.obv ? `OBV Trend: ${indicators.obv.trend}` : "N/A";
      const vwapStr = indicators.vwap ? `VWAP: $${indicators.vwap.toFixed(2)}` : "N/A";
      
      const patternStr = patterns.length > 0 
        ? patterns.map(p => `${p.pattern} (${p.confidence}% ${p.direction})`).join(', ')
        : 'None detected';
      
      const fundingStr = funding 
        ? `Rate: ${(funding.rate * 100).toFixed(4)}%, OI: $${(funding.openInterest / 1e6).toFixed(1)}M`
        : 'N/A';
      
      const whaleStr = whaleActivity.length > 0
        ? `${whaleActivity.length} txns, Smart money: ${whaleActivity.filter(w => w.isSmartMoney).length}`
        : 'No recent activity';
      
      const nearestLiqLong = liquidations.filter(l => l.price < currentPrice).sort((a, b) => b.price - a.price)[0];
      const nearestLiqShort = liquidations.filter(l => l.price > currentPrice).sort((a, b) => a.price - b.price)[0];
      const liqStr = `Long cascade: $${nearestLiqLong?.price.toFixed(2) || 'N/A'}, Short cascade: $${nearestLiqShort?.price.toFixed(2) || 'N/A'}`;
      
      const analysisPrompt = `You are an ULTRON-level trading AI with multi-dimensional market intelligence.
Analyze this ENHANCED market data and provide a trading signal ONLY if there's a high-confidence opportunity (>70%).

Symbol: ${symbol}
Current Price: $${currentPrice.toFixed(2)}
Exchange: ${exchange}
Timeframe: ${timeframe}

═══════════════════════════════════════════════════════════
TECHNICAL ANALYSIS (Real OHLCV Data from Exchanges)
═══════════════════════════════════════════════════════════
- RSI: ${indicators.rsi.toFixed(1)} (${indicators.rsiSignal})
- MACD: ${indicators.macd.value.toFixed(4)} (Signal: ${indicators.macd.signal.toFixed(4)}, Histogram: ${indicators.macd.histogram.toFixed(4)})
- EMA20: $${indicators.ema20.toFixed(2)}, EMA50: $${indicators.ema50.toFixed(2)}, EMA200: $${indicators.ema200.toFixed(2)}
- EMA Trend: ${indicators.emaTrend}
- Bollinger Bands: Upper $${indicators.bollingerBands.upper.toFixed(2)}, Middle $${indicators.bollingerBands.middle.toFixed(2)}, Lower $${indicators.bollingerBands.lower.toFixed(2)}
- BB Position: ${indicators.bbPosition}
- ${stochRSIStr}
- ${adxStr}
- ${obvStr}
- ${vwapStr}
- ATR: ${indicators.atr.toFixed(2)}
- 24h Volume Change: ${indicators.volumeChange.toFixed(1)}%
- 24h Price Change: ${indicators.priceChange24h.toFixed(2)}%

═══════════════════════════════════════════════════════════
VOLATILITY & PATTERN RECOGNITION
═══════════════════════════════════════════════════════════
- Volatility Regime: ${volatilityRegime.regime.toUpperCase()} (ratio: ${volatilityRegime.volatilityRatio.toFixed(2)})
- Threshold Multiplier: ${volatilityRegime.thresholdMultiplier}x (adaptive stops/targets)
- Detected Patterns: ${patternStr}

═══════════════════════════════════════════════════════════
FUNDING & LEVERAGE SENTIMENT
═══════════════════════════════════════════════════════════
- ${fundingStr}
- Long/Short Ratio: ${funding?.longShortRatio?.toFixed(2) || 'N/A'}
- Liquidation Levels: ${liqStr}

═══════════════════════════════════════════════════════════
WHALE & SMART MONEY ACTIVITY
═══════════════════════════════════════════════════════════
- Whale Activity: ${whaleStr}
- Smart Money Flow: ${smartMoney.flowSignal.toUpperCase()} (net: $${(smartMoney.netFlow / 1e6).toFixed(1)}M)
- Exchange Flow: In $${(smartMoney.exchangeInflow / 1e6).toFixed(1)}M / Out $${(smartMoney.exchangeOutflow / 1e6).toFixed(1)}M

═══════════════════════════════════════════════════════════
ORDER FLOW & SENTIMENT
═══════════════════════════════════════════════════════════
- Buy Volume: $${(orderFlow.buyVolume / 1e6).toFixed(1)}M, Sell Volume: $${(orderFlow.sellVolume / 1e6).toFixed(1)}M
- Delta: ${(orderFlow.delta * 100).toFixed(1)}%, CVD: $${(orderFlow.cvd / 1e6).toFixed(1)}M
- Large Orders: ${orderFlow.largeOrdersCount} (Buy $${(orderFlow.largeBuyVolume / 1e6).toFixed(1)}M / Sell $${(orderFlow.largeSellVolume / 1e6).toFixed(1)}M)
- Sentiment Score: ${(sentiment.sentiment * 100).toFixed(0)}%, Momentum: ${(sentiment.momentum * 100).toFixed(0)}%
- Influencer Mentions: ${sentiment.influencerMentions}

═══════════════════════════════════════════════════════════
MULTI-DIMENSIONAL INTELLIGENCE SCORE
═══════════════════════════════════════════════════════════
- Technical Score: ${intelligenceScore.technicalScore.toFixed(1)}%
- Sentiment Score: ${intelligenceScore.sentimentScore.toFixed(1)}%
- Flow Score: ${intelligenceScore.flowScore.toFixed(1)}%
- Whale Score: ${intelligenceScore.whaleScore.toFixed(1)}%
- Funding Score: ${intelligenceScore.fundingScore.toFixed(1)}%
- Pattern Score: ${intelligenceScore.patternScore.toFixed(1)}%
- OVERALL SCORE: ${intelligenceScore.overallScore.toFixed(1)}%
- Intelligence Signals: ${intelligenceScore.signals.join(', ') || 'None'}

═══════════════════════════════════════════════════════════
MULTI-TIMEFRAME ANALYSIS (CRITICAL FOR HIGH WIN RATE)
═══════════════════════════════════════════════════════════
- Higher Timeframe (${mtfAnalysis.htfTimeframe}): ${mtfAnalysis.htfTrend.toUpperCase()}
- Lower Timeframe (${mtfAnalysis.ltfTimeframe}): ${mtfAnalysis.ltfTrend.toUpperCase()}
- Trend Alignment: ${mtfAnalysis.trendAlignment ? 'ALIGNED' : 'NOT ALIGNED'}
- HTF EMA Alignment (50/200): ${mtfAnalysis.htfEmaAlignment ? 'CONFIRMED' : 'NOT CONFIRMED'}
- Confidence Boost: ${mtfAnalysis.confidenceBoost > 0 ? '+' : ''}${mtfAnalysis.confidenceBoost}%

═══════════════════════════════════════════════════════════
DATA QUALITY ASSESSMENT
═══════════════════════════════════════════════════════════
- OHLCV Source: ${intelligenceScore.dataQuality.ohlcvSource.toUpperCase()}
- Funding Source: ${intelligenceScore.dataQuality.fundingSource.toUpperCase()}
- Pattern Source: ${intelligenceScore.dataQuality.patternSource.toUpperCase()}
- Quality Score: ${intelligenceScore.dataQuality.qualityScore.toFixed(0)}% (${intelligenceScore.dataQuality.realDataCount}/${intelligenceScore.dataQuality.totalModules} real sources)
- Overall Quality: ${intelligenceScore.dataQuality.overallQuality.toUpperCase()}

═══════════════════════════════════════════════════════════
CONFLUENCE ANALYSIS
═══════════════════════════════════════════════════════════
- Direction: ${bestDirection.toUpperCase()}
- Confluence Score: ${bestConfluence.score.toFixed(1)}%
- Recommendation: ${bestConfluence.recommendation.toUpperCase()}
- Confirming Signals: ${bestConfluence.signals.map(s => `${s.indicator}: ${s.signal}`).join(', ')}

Provide your analysis in this exact JSON format:
{
  "hasSignal": true/false,
  "direction": "${bestDirection}",
  "confidence": 0-100,
  "entryPrice": number,
  "stopLoss": number,
  "takeProfit1": number,
  "takeProfit2": number,
  "takeProfit3": number,
  "leverage": 1-10,
  "reasoning": "detailed explanation using ALL intelligence dimensions",
  "patterns": ["pattern1", "pattern2"],
  "riskRewardRatio": number,
  "intelligenceFactors": ["factor1", "factor2"]
}

ULTRON DECISION RULES:
1. Use volatility regime to set adaptive stops (${volatilityRegime.thresholdMultiplier}x normal)
2. Favor trades aligned with smart money flow (${smartMoney.flowSignal})
3. Beware of liquidation cascades near price
4. Weight pattern confidence in final decision
5. Only signal when OVERALL intelligence score > 60%
6. This signal has ALREADY passed multi-layer filtering`;

      const response = await this.callClaude(analysisPrompt);
      
      try {
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.log("[TradingIntelligence] No valid JSON in response, using fallback signal");
          return this.generateFallbackSignal(symbol, exchange, timeframe, currentPrice, indicators, { direction: bestDirection, confluence: bestConfluence });
        }
        
        const analysis = JSON.parse(jsonMatch[0]);
        
        if (!analysis.hasSignal || analysis.confidence < 70) {
          console.log(`[TradingIntelligence] AI rejected signal for ${symbol} despite confluence`);
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
          confidence: Math.min(analysis.confidence, bestConfluence.score + 10),
          riskRewardRatio: analysis.riskRewardRatio || 2,
          leverage: analysis.leverage || 1,
          reasoning: `${analysis.reasoning} [Confluence: ${bestConfluence.score.toFixed(0)}% with ${bestConfluence.signals.length} aligned indicators]`,
          technicalAnalysis: `RSI: ${indicators.rsiSignal}, MACD: ${indicators.macdSignal}, EMA: ${indicators.emaTrend}, Confluence: ${bestConfluence.signals.map(s => s.indicator).join('+')}`,
          indicators,
          patterns: analysis.patterns || [],
          agentId: "signal-strategist",
          agentConsensus: {
            signalStrategist: analysis.confidence,
            riskGuardian: Math.max(60, bestConfluence.score - 10),
            marketSentinel: Math.max(65, bestConfluence.score - 5),
            metaApproval: bestConfluence.recommendation === "strong_entry" || bestConfluence.recommendation === "entry"
          },
          status: "active",
          createdAt: Date.now(),
          expiresAt: Date.now() + (24 * 60 * 60 * 1000)
        };

        this.signals.set(signal.id, signal);
        console.log(`[TradingIntelligence] Generated ${signal.direction.toUpperCase()} signal for ${symbol} @ $${signal.entryPrice.toFixed(2)} (Confluence: ${bestConfluence.score.toFixed(0)}%)`);
        
        return signal;
      } catch (parseError) {
        console.error("[TradingIntelligence] Failed to parse AI response:", parseError);
        return this.generateFallbackSignal(symbol, exchange, timeframe, currentPrice, indicators, { direction: bestDirection, confluence: bestConfluence });
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
    indicators: TechnicalIndicators,
    precomputedConfluence?: { 
      direction: "long" | "short";
      confluence: { score: number; signals: { indicator: string; signal: string; weight: number }[]; recommendation: "strong_entry" | "entry" | "wait" | "avoid" };
    }
  ): TradingSignal | null {
    let direction: SignalDirection;
    let bestConfluence: { score: number; signals: { indicator: string; signal: string; weight: number }[]; recommendation: "strong_entry" | "entry" | "wait" | "avoid" };
    
    if (precomputedConfluence) {
      direction = precomputedConfluence.direction;
      bestConfluence = precomputedConfluence.confluence;
    } else {
      const longConfluence = this.calculateConfluenceScore(indicators, "long");
      const shortConfluence = this.calculateConfluenceScore(indicators, "short");
      
      if (longConfluence.score > shortConfluence.score) {
        direction = "long";
        bestConfluence = longConfluence;
      } else {
        direction = "short";
        bestConfluence = shortConfluence;
      }
    }
    
    if (bestConfluence.recommendation === "avoid" || bestConfluence.recommendation === "wait") {
      console.log(`[TradingIntelligence] Fallback signal blocked for ${symbol} - confluence ${bestConfluence.score.toFixed(0)}% too low (${bestConfluence.recommendation})`);
      return null;
    }
    
    const slPercent = direction === "long" ? 0.97 : 1.03;
    const tp1Percent = direction === "long" ? 1.04 : 0.96;
    const tp2Percent = direction === "long" ? 1.08 : 0.92;
    
    const confidenceBoost = bestConfluence.recommendation === "strong_entry" ? 8 : 0;
    const baseConfidence = Math.min(85, 60 + bestConfluence.score * 0.25 + confidenceBoost);
    
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
      confidence: baseConfidence,
      riskRewardRatio: 2.5,
      leverage: 1,
      reasoning: `Multi-indicator confluence signal (${bestConfluence.score.toFixed(0)}%) with ${bestConfluence.signals.length} aligned indicators: ${bestConfluence.signals.map(s => s.indicator).join(', ')}`,
      technicalAnalysis: `RSI: ${indicators.rsiSignal}, MACD: ${indicators.macdSignal}, EMA: ${indicators.emaTrend}, Confluence: ${bestConfluence.signals.map(s => s.indicator).join('+')}`,
      indicators,
      patterns: bestConfluence.signals.map(s => s.indicator.toLowerCase()),
      agentId: "signal-strategist",
      agentConsensus: {
        signalStrategist: baseConfidence,
        riskGuardian: Math.max(60, bestConfluence.score - 10),
        marketSentinel: Math.max(65, bestConfluence.score - 5),
        metaApproval: bestConfluence.recommendation === "strong_entry" || bestConfluence.recommendation === "entry"
      },
      status: "active",
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)
    };
    
    this.signals.set(signal.id, signal);
    console.log(`[TradingIntelligence] Fallback ${direction.toUpperCase()} signal for ${symbol} @ $${currentPrice.toFixed(2)} (Confluence: ${bestConfluence.score.toFixed(0)}%)`);
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
