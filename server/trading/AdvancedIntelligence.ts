import * as ccxt from 'ccxt';
import { EventEmitter } from 'events';
import type { SupportedExchange } from '@shared/schema';

export interface CandleData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OHLCVResult {
  candles: CandleData[];
  source: 'real' | 'synthetic';
  exchange: string;
  timestamp: number;
}

export interface WhaleTransaction {
  id: string;
  chain: string;
  fromAddress: string;
  toAddress: string;
  tokenSymbol: string;
  amount: number;
  amountUsd: number;
  txHash: string;
  timestamp: number;
  type: 'transfer' | 'exchange_deposit' | 'exchange_withdrawal' | 'dex_swap';
  isSmartMoney: boolean;
  label?: string;
}

export interface SentimentSignal {
  symbol: string;
  source: 'twitter' | 'discord' | 'telegram' | 'reddit' | 'news';
  sentiment: number;
  volume: number;
  momentum: number;
  influencerMentions: number;
  keywords: string[];
  timestamp: number;
}

export interface FundingRateData {
  symbol: string;
  exchange: string;
  rate: number;
  predictedRate: number;
  openInterest: number;
  openInterestChange24h: number;
  longShortRatio: number;
  timestamp: number;
}

export interface OrderFlowData {
  symbol: string;
  exchange: string;
  buyVolume: number;
  sellVolume: number;
  netFlow: number;
  largeOrdersCount: number;
  largeBuyVolume: number;
  largeSellVolume: number;
  cvd: number;
  delta: number;
  timestamp: number;
}

export interface LiquidationLevel {
  symbol: string;
  price: number;
  totalLiquidations: number;
  longLiquidations: number;
  shortLiquidations: number;
  leverage: number;
  timestamp: number;
}

export interface CrossChainFlow {
  fromChain: string;
  toChain: string;
  volume24h: number;
  netFlow: number;
  dominantToken: string;
  timestamp: number;
}

export interface PatternMatch {
  symbol: string;
  pattern: string;
  confidence: number;
  direction: 'bullish' | 'bearish' | 'neutral';
  expectedMove: number;
  timeframe: string;
  timestamp: number;
}

export interface VolatilityRegime {
  symbol: string;
  currentATR: number;
  avgATR20: number;
  volatilityRatio: number;
  regime: 'low' | 'normal' | 'high' | 'extreme';
  thresholdMultiplier: number;
  timestamp: number;
}

export interface SmartMoneyFlow {
  symbol: string;
  exchangeInflow: number;
  exchangeOutflow: number;
  netFlow: number;
  flowSignal: 'accumulation' | 'distribution' | 'neutral';
  whaleActivity: number;
  timestamp: number;
}

export interface IntelligenceScore {
  symbol: string;
  technicalScore: number;
  sentimentScore: number;
  flowScore: number;
  whaleScore: number;
  fundingScore: number;
  patternScore: number;
  overallScore: number;
  direction: 'long' | 'short' | 'neutral';
  confidence: number;
  signals: string[];
  timestamp: number;
  dataQuality: DataQuality;
}

export interface DataQuality {
  ohlcvSource: 'real' | 'synthetic';
  fundingSource: 'real' | 'synthetic';
  sentimentSource: 'real' | 'synthetic';
  flowSource: 'real' | 'synthetic';
  whaleSource: 'real' | 'synthetic';
  patternSource: 'real' | 'synthetic';
  overallQuality: 'high' | 'medium' | 'low';
  realDataCount: number;
  totalModules: number;
  qualityScore: number;
}

export interface MultiTimeframeAnalysis {
  symbol: string;
  htfTrend: 'bullish' | 'bearish' | 'neutral';
  htfTimeframe: string;
  ltfTrend: 'bullish' | 'bearish' | 'neutral';
  ltfTimeframe: string;
  trendAlignment: boolean;
  htfEmaAlignment: boolean;
  confidenceBoost: number;
}

const EXCHANGE_PRIORITY: SupportedExchange[] = ['binance', 'bybit', 'okx', 'kucoin', 'gate', 'mexc', 'bitget', 'kraken', 'coinbase', 'huobi'];

export class AdvancedIntelligenceService extends EventEmitter {
  private exchanges: Map<SupportedExchange, ccxt.Exchange> = new Map();
  private ohlcvCache: Map<string, OHLCVResult> = new Map();
  private fundingCache: Map<string, FundingRateData> = new Map();
  private whaleAlerts: WhaleTransaction[] = [];
  private sentimentData: Map<string, SentimentSignal[]> = new Map();
  private orderFlowData: Map<string, OrderFlowData> = new Map();
  private liquidationLevels: Map<string, LiquidationLevel[]> = new Map();
  private volatilityRegimes: Map<string, VolatilityRegime> = new Map();
  private patternCache: Map<string, PatternMatch[]> = new Map();
  
  private readonly OHLCV_CACHE_TTL = 60000; // 60s for real data
  private readonly SYNTHETIC_CACHE_TTL = 10000; // 10s for synthetic - retry sooner
  private readonly FUNDING_CACHE_TTL = 300000; // 5min for real funding data
  private readonly SYNTHETIC_FUNDING_TTL = 30000; // 30s for synthetic funding

  constructor() {
    super();
    this.initializeExchanges();
    console.log('[AdvancedIntelligence] Service initialized with enhanced AI capabilities');
  }

  private initializeExchanges(): void {
    const exchangeClasses: Record<string, any> = {
      binance: ccxt.binance,
      bybit: ccxt.bybit,
      okx: ccxt.okx,
      kucoin: ccxt.kucoin,
      gate: ccxt.gate,
      mexc: ccxt.mexc,
      bitget: ccxt.bitget,
      kraken: ccxt.kraken,
      coinbase: ccxt.coinbase,
      huobi: ccxt.huobi,
    };

    for (const name of EXCHANGE_PRIORITY) {
      try {
        const ExchangeClass = exchangeClasses[name];
        if (ExchangeClass) {
          const exchange = new ExchangeClass({
            enableRateLimit: true,
            timeout: 15000,
            options: { defaultType: 'spot' },
          });
          this.exchanges.set(name, exchange);
        }
      } catch (error) {
        console.warn(`[AdvancedIntelligence] Failed to initialize ${name}`);
      }
    }
  }

  async fetchRealOHLCV(
    symbol: string, 
    timeframe: string = '4h', 
    limit: number = 200,
    exchange?: SupportedExchange
  ): Promise<CandleData[]> {
    const result = await this.fetchRealOHLCVWithMetadata(symbol, timeframe, limit, exchange);
    return result.candles;
  }

  async fetchRealOHLCVWithMetadata(
    symbol: string, 
    timeframe: string = '4h', 
    limit: number = 200,
    exchange?: SupportedExchange
  ): Promise<OHLCVResult> {
    const cacheKey = `${symbol}:${timeframe}:${exchange || 'any'}`;
    const cached = this.ohlcvCache.get(cacheKey);
    
    if (cached) {
      const ttl = cached.source === 'synthetic' ? this.SYNTHETIC_CACHE_TTL : this.OHLCV_CACHE_TTL;
      if (Date.now() - cached.timestamp < ttl) {
        return cached;
      }
    }

    const exchanges = exchange ? [exchange] : EXCHANGE_PRIORITY;
    
    for (const ex of exchanges) {
      const client = this.exchanges.get(ex);
      if (!client) continue;

      try {
        await client.loadMarkets();
        const ccxtSymbol = `${symbol}/USDT`;
        
        if (!client.markets[ccxtSymbol]) continue;
        
        const ohlcv = await client.fetchOHLCV(ccxtSymbol, timeframe, undefined, limit);
        
        if (ohlcv && ohlcv.length > 0) {
          const candles: CandleData[] = ohlcv.map((candle) => ({
            timestamp: Number(candle[0]) || 0,
            open: Number(candle[1]) || 0,
            high: Number(candle[2]) || 0,
            low: Number(candle[3]) || 0,
            close: Number(candle[4]) || 0,
            volume: Number(candle[5]) || 0,
          }));
          
          const result: OHLCVResult = { 
            candles, 
            source: 'real', 
            exchange: ex, 
            timestamp: Date.now() 
          };
          this.ohlcvCache.set(cacheKey, result);
          console.log(`[AdvancedIntelligence] Fetched ${candles.length} real candles for ${symbol} from ${ex}`);
          return result;
        }
      } catch (error) {
        continue;
      }
    }

    console.warn(`[AdvancedIntelligence] Using synthetic OHLCV for ${symbol}`);
    const syntheticCandles = this.generateSyntheticOHLCV(symbol, limit);
    return { 
      candles: syntheticCandles, 
      source: 'synthetic', 
      exchange: 'synthetic', 
      timestamp: Date.now() 
    };
  }

  private generateSyntheticOHLCV(symbol: string, limit: number): CandleData[] {
    const basePrices: Record<string, number> = {
      'BTC': 92000, 'ETH': 3180, 'SOL': 145, 'AVAX': 38, 'LINK': 24,
      'UNI': 14, 'AAVE': 193, 'ARB': 0.75, 'OP': 1.80, 'DOGE': 0.32, 'SUI': 3.60, 'PEPE': 0.000018,
    };
    
    const basePrice = basePrices[symbol] || 100;
    const volatility = symbol === 'BTC' ? 0.02 : symbol === 'ETH' ? 0.025 : 0.04;
    const candles: CandleData[] = [];
    let price = basePrice * (0.95 + Math.random() * 0.1);
    
    for (let i = 0; i < limit; i++) {
      const change = (Math.random() - 0.48) * volatility;
      const open = price;
      const close = price * (1 + change);
      const high = Math.max(open, close) * (1 + Math.random() * volatility * 0.5);
      const low = Math.min(open, close) * (1 - Math.random() * volatility * 0.5);
      const volume = basePrice * 1000 * (0.5 + Math.random());
      
      candles.push({
        timestamp: Date.now() - (limit - i) * 4 * 60 * 60 * 1000,
        open,
        high,
        low,
        close,
        volume,
      });
      
      price = close;
    }
    
    return candles;
  }

  async fetchFundingRates(symbol: string): Promise<FundingRateData | null> {
    const cacheKey = symbol;
    const cached = this.fundingCache.get(cacheKey);
    
    if (cached) {
      const isSynthetic = cached.exchange === 'synthetic';
      const ttl = isSynthetic ? this.SYNTHETIC_FUNDING_TTL : this.FUNDING_CACHE_TTL;
      if (Date.now() - cached.timestamp < ttl) {
        return cached;
      }
    }

    const perpetualExchanges: SupportedExchange[] = ['binance', 'bybit', 'okx'];
    
    for (const ex of perpetualExchanges) {
      const client = this.exchanges.get(ex);
      if (!client) continue;

      try {
        const perpClient = new (ccxt as any)[ex]({
          enableRateLimit: true,
          options: { defaultType: 'swap' },
        });
        
        await perpClient.loadMarkets();
        const ccxtSymbol = `${symbol}/USDT:USDT`;
        
        if (!perpClient.markets[ccxtSymbol]) continue;
        
        const fundingRate = await perpClient.fetchFundingRate(ccxtSymbol);
        
        const data: FundingRateData = {
          symbol,
          exchange: ex,
          rate: fundingRate.fundingRate || 0,
          predictedRate: fundingRate.fundingRate || 0,
          openInterest: 0,
          openInterestChange24h: 0,
          longShortRatio: 1,
          timestamp: Date.now(),
        };

        try {
          const oi = await perpClient.fetchOpenInterest(ccxtSymbol);
          data.openInterest = oi.openInterestValue || 0;
        } catch {}

        this.fundingCache.set(cacheKey, data);
        return data;
      } catch (error) {
        continue;
      }
    }

    const syntheticRate = (Math.random() - 0.5) * 0.001;
    const syntheticData: FundingRateData = {
      symbol,
      exchange: 'synthetic',
      rate: syntheticRate,
      predictedRate: syntheticRate * (0.8 + Math.random() * 0.4),
      openInterest: Math.random() * 500000000,
      openInterestChange24h: (Math.random() - 0.5) * 20,
      longShortRatio: 0.8 + Math.random() * 0.4,
      timestamp: Date.now(),
    };
    
    this.fundingCache.set(cacheKey, syntheticData);
    return syntheticData;
  }

  calculateVolatilityRegime(candles: CandleData[]): VolatilityRegime {
    if (candles.length < 20) {
      return {
        symbol: 'unknown',
        currentATR: 0,
        avgATR20: 0,
        volatilityRatio: 1,
        regime: 'normal',
        thresholdMultiplier: 1,
        timestamp: Date.now(),
      };
    }

    const trueRanges: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      const high = candles[i].high;
      const low = candles[i].low;
      const prevClose = candles[i - 1].close;
      const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      trueRanges.push(tr);
    }

    const currentATR = trueRanges.slice(-14).reduce((a, b) => a + b, 0) / 14;
    const avgATR20 = trueRanges.slice(-20).reduce((a, b) => a + b, 0) / 20;
    const volatilityRatio = avgATR20 > 0 ? currentATR / avgATR20 : 1;

    let regime: 'low' | 'normal' | 'high' | 'extreme';
    let thresholdMultiplier: number;

    if (volatilityRatio < 0.7) {
      regime = 'low';
      thresholdMultiplier = 0.7;
    } else if (volatilityRatio < 1.2) {
      regime = 'normal';
      thresholdMultiplier = 1.0;
    } else if (volatilityRatio < 1.8) {
      regime = 'high';
      thresholdMultiplier = 1.5;
    } else {
      regime = 'extreme';
      thresholdMultiplier = 2.0;
    }

    return {
      symbol: 'computed',
      currentATR,
      avgATR20,
      volatilityRatio,
      regime,
      thresholdMultiplier,
      timestamp: Date.now(),
    };
  }

  detectPatterns(candles: CandleData[], symbol: string = 'unknown', timeframe: string = '4h'): PatternMatch[] {
    const patterns: PatternMatch[] = [];
    if (candles.length < 20) return patterns;

    const recent = candles.slice(-20);
    const closes = recent.map(c => c.close);
    const highs = recent.map(c => c.high);
    const lows = recent.map(c => c.low);
    
    const currentPrice = closes[closes.length - 1];
    const volatility = this.calculateVolatilityRegime(candles);
    const volatilityMultiplier = volatility.regime === 'high' || volatility.regime === 'extreme' ? 1.5 : 1.0;

    if (this.detectDoubleBottom(lows, closes)) {
      const movePercent = 5 * volatilityMultiplier;
      patterns.push({
        symbol,
        pattern: 'double_bottom',
        confidence: 75,
        direction: 'bullish',
        expectedMove: movePercent,
        timeframe,
        timestamp: Date.now(),
      });
    }

    if (this.detectDoubleTop(highs, closes)) {
      const movePercent = -5 * volatilityMultiplier;
      patterns.push({
        symbol,
        pattern: 'double_top',
        confidence: 75,
        direction: 'bearish',
        expectedMove: movePercent,
        timeframe,
        timestamp: Date.now(),
      });
    }

    if (this.detectBullishEngulfing(recent)) {
      const movePercent = 3 * volatilityMultiplier;
      patterns.push({
        symbol,
        pattern: 'bullish_engulfing',
        confidence: 70,
        direction: 'bullish',
        expectedMove: movePercent,
        timeframe,
        timestamp: Date.now(),
      });
    }

    if (this.detectBearishEngulfing(recent)) {
      const movePercent = -3 * volatilityMultiplier;
      patterns.push({
        symbol,
        pattern: 'bearish_engulfing',
        confidence: 70,
        direction: 'bearish',
        expectedMove: movePercent,
        timeframe,
        timestamp: Date.now(),
      });
    }

    if (this.detectMorningDoji(recent)) {
      const movePercent = 4 * volatilityMultiplier;
      patterns.push({
        symbol,
        pattern: 'morning_doji',
        confidence: 65,
        direction: 'bullish',
        expectedMove: movePercent,
        timeframe,
        timestamp: Date.now(),
      });
    }

    if (this.detectEveningDoji(recent)) {
      const movePercent = -4 * volatilityMultiplier;
      patterns.push({
        symbol,
        pattern: 'evening_doji',
        confidence: 65,
        direction: 'bearish',
        expectedMove: movePercent,
        timeframe,
        timestamp: Date.now(),
      });
    }

    if (this.detectHammer(recent[recent.length - 1])) {
      const movePercent = 2 * volatilityMultiplier;
      patterns.push({
        symbol,
        pattern: 'hammer',
        confidence: 60,
        direction: 'bullish',
        expectedMove: movePercent,
        timeframe,
        timestamp: Date.now(),
      });
    }

    if (this.detectShootingStar(recent[recent.length - 1])) {
      const movePercent = -2 * volatilityMultiplier;
      patterns.push({
        symbol,
        pattern: 'shooting_star',
        confidence: 60,
        direction: 'bearish',
        expectedMove: movePercent,
        timeframe,
        timestamp: Date.now(),
      });
    }

    if (this.detectThreeWhiteSoldiers(recent)) {
      const movePercent = 6 * volatilityMultiplier;
      patterns.push({
        symbol,
        pattern: 'three_white_soldiers',
        confidence: 80,
        direction: 'bullish',
        expectedMove: movePercent,
        timeframe,
        timestamp: Date.now(),
      });
    }

    if (this.detectThreeBlackCrows(recent)) {
      const movePercent = -6 * volatilityMultiplier;
      patterns.push({
        symbol,
        pattern: 'three_black_crows',
        confidence: 80,
        direction: 'bearish',
        expectedMove: movePercent,
        timeframe,
        timestamp: Date.now(),
      });
    }

    return patterns;
  }

  private detectDoubleBottom(lows: number[], closes: number[]): boolean {
    if (lows.length < 10) return false;
    const minLow = Math.min(...lows);
    const firstBottomIdx = lows.indexOf(minLow);
    const secondHalf = lows.slice(firstBottomIdx + 3);
    if (secondHalf.length < 3) return false;
    const secondLow = Math.min(...secondHalf);
    const tolerance = minLow * 0.02;
    return Math.abs(secondLow - minLow) < tolerance && closes[closes.length - 1] > closes[firstBottomIdx];
  }

  private detectDoubleTop(highs: number[], closes: number[]): boolean {
    if (highs.length < 10) return false;
    const maxHigh = Math.max(...highs);
    const firstTopIdx = highs.indexOf(maxHigh);
    const secondHalf = highs.slice(firstTopIdx + 3);
    if (secondHalf.length < 3) return false;
    const secondHigh = Math.max(...secondHalf);
    const tolerance = maxHigh * 0.02;
    return Math.abs(secondHigh - maxHigh) < tolerance && closes[closes.length - 1] < closes[firstTopIdx];
  }

  private detectBullishEngulfing(candles: CandleData[]): boolean {
    if (candles.length < 2) return false;
    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];
    return prev.close < prev.open && 
           curr.close > curr.open && 
           curr.open < prev.close && 
           curr.close > prev.open;
  }

  private detectBearishEngulfing(candles: CandleData[]): boolean {
    if (candles.length < 2) return false;
    const prev = candles[candles.length - 2];
    const curr = candles[candles.length - 1];
    return prev.close > prev.open && 
           curr.close < curr.open && 
           curr.open > prev.close && 
           curr.close < prev.open;
  }

  private detectMorningDoji(candles: CandleData[]): boolean {
    if (candles.length < 3) return false;
    const [first, doji, third] = candles.slice(-3);
    const dojiBody = Math.abs(doji.close - doji.open);
    const dojiRange = doji.high - doji.low;
    return first.close < first.open &&
           dojiBody < dojiRange * 0.1 &&
           third.close > third.open &&
           third.close > first.open * 0.5 + doji.close * 0.5;
  }

  private detectEveningDoji(candles: CandleData[]): boolean {
    if (candles.length < 3) return false;
    const [first, doji, third] = candles.slice(-3);
    const dojiBody = Math.abs(doji.close - doji.open);
    const dojiRange = doji.high - doji.low;
    return first.close > first.open &&
           dojiBody < dojiRange * 0.1 &&
           third.close < third.open &&
           third.close < first.open * 0.5 + doji.close * 0.5;
  }

  private detectHammer(candle: CandleData): boolean {
    const body = Math.abs(candle.close - candle.open);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    return lowerWick > body * 2 && upperWick < body * 0.5;
  }

  private detectShootingStar(candle: CandleData): boolean {
    const body = Math.abs(candle.close - candle.open);
    const upperWick = candle.high - Math.max(candle.open, candle.close);
    const lowerWick = Math.min(candle.open, candle.close) - candle.low;
    return upperWick > body * 2 && lowerWick < body * 0.5;
  }

  private detectThreeWhiteSoldiers(candles: CandleData[]): boolean {
    if (candles.length < 3) return false;
    const last3 = candles.slice(-3);
    return last3.every(c => c.close > c.open) &&
           last3[1].close > last3[0].close &&
           last3[2].close > last3[1].close &&
           last3[1].open > last3[0].open &&
           last3[2].open > last3[1].open;
  }

  private detectThreeBlackCrows(candles: CandleData[]): boolean {
    if (candles.length < 3) return false;
    const last3 = candles.slice(-3);
    return last3.every(c => c.close < c.open) &&
           last3[1].close < last3[0].close &&
           last3[2].close < last3[1].close &&
           last3[1].open < last3[0].open &&
           last3[2].open < last3[1].open;
  }

  simulateWhaleActivity(symbol: string): WhaleTransaction[] {
    const transactions: WhaleTransaction[] = [];
    const numTransactions = Math.floor(Math.random() * 5);
    
    for (let i = 0; i < numTransactions; i++) {
      const types: WhaleTransaction['type'][] = ['transfer', 'exchange_deposit', 'exchange_withdrawal', 'dex_swap'];
      const type = types[Math.floor(Math.random() * types.length)];
      const amount = 100000 + Math.random() * 10000000;
      
      transactions.push({
        id: `whale-${Date.now()}-${i}`,
        chain: ['ethereum', 'solana', 'arbitrum', 'base'][Math.floor(Math.random() * 4)],
        fromAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
        toAddress: `0x${Math.random().toString(16).slice(2, 42)}`,
        tokenSymbol: symbol,
        amount,
        amountUsd: amount,
        txHash: `0x${Math.random().toString(16).slice(2, 66)}`,
        timestamp: Date.now() - Math.random() * 3600000,
        type,
        isSmartMoney: Math.random() > 0.7,
        label: Math.random() > 0.5 ? ['Jump Trading', 'Alameda', 'Three Arrows', 'Wintermute'][Math.floor(Math.random() * 4)] : undefined,
      });
    }
    
    return transactions;
  }

  simulateSentiment(symbol: string): SentimentSignal {
    const sources: SentimentSignal['source'][] = ['twitter', 'discord', 'telegram', 'reddit', 'news'];
    
    return {
      symbol,
      source: sources[Math.floor(Math.random() * sources.length)],
      sentiment: (Math.random() - 0.5) * 2,
      volume: Math.floor(1000 + Math.random() * 50000),
      momentum: (Math.random() - 0.5) * 2,
      influencerMentions: Math.floor(Math.random() * 20),
      keywords: ['bullish', 'breakout', 'accumulation', 'dip'].slice(0, Math.floor(Math.random() * 4) + 1),
      timestamp: Date.now(),
    };
  }

  simulateOrderFlow(symbol: string): OrderFlowData {
    const buyVolume = Math.random() * 50000000;
    const sellVolume = Math.random() * 50000000;
    const largeBuyVolume = buyVolume * (0.2 + Math.random() * 0.3);
    const largeSellVolume = sellVolume * (0.2 + Math.random() * 0.3);
    
    return {
      symbol,
      exchange: 'aggregated',
      buyVolume,
      sellVolume,
      netFlow: buyVolume - sellVolume,
      largeOrdersCount: Math.floor(10 + Math.random() * 100),
      largeBuyVolume,
      largeSellVolume,
      cvd: (buyVolume - sellVolume) * (0.8 + Math.random() * 0.4),
      delta: (largeBuyVolume - largeSellVolume) / (largeBuyVolume + largeSellVolume),
      timestamp: Date.now(),
    };
  }

  simulateLiquidationLevels(symbol: string, currentPrice: number): LiquidationLevel[] {
    const levels: LiquidationLevel[] = [];
    const leverages = [5, 10, 20, 50, 100];
    
    for (const leverage of leverages) {
      const longLiqPrice = currentPrice * (1 - 1 / leverage);
      const shortLiqPrice = currentPrice * (1 + 1 / leverage);
      
      levels.push({
        symbol,
        price: longLiqPrice,
        totalLiquidations: Math.random() * 10000000,
        longLiquidations: Math.random() * 8000000,
        shortLiquidations: Math.random() * 2000000,
        leverage,
        timestamp: Date.now(),
      });
      
      levels.push({
        symbol,
        price: shortLiqPrice,
        totalLiquidations: Math.random() * 10000000,
        longLiquidations: Math.random() * 2000000,
        shortLiquidations: Math.random() * 8000000,
        leverage,
        timestamp: Date.now(),
      });
    }
    
    return levels.sort((a, b) => a.price - b.price);
  }

  simulateSmartMoneyFlow(symbol: string): SmartMoneyFlow {
    const inflow = Math.random() * 100000000;
    const outflow = Math.random() * 100000000;
    const netFlow = inflow - outflow;
    
    let flowSignal: 'accumulation' | 'distribution' | 'neutral';
    if (netFlow < -10000000) {
      flowSignal = 'distribution';
    } else if (netFlow > 10000000) {
      flowSignal = 'accumulation';
    } else {
      flowSignal = 'neutral';
    }
    
    return {
      symbol,
      exchangeInflow: inflow,
      exchangeOutflow: outflow,
      netFlow,
      flowSignal,
      whaleActivity: Math.random() * 100,
      timestamp: Date.now(),
    };
  }

  simulateCrossChainFlows(): CrossChainFlow[] {
    const chains = ['ethereum', 'solana', 'arbitrum', 'base', 'optimism', 'polygon', 'bsc', 'avalanche'];
    const flows: CrossChainFlow[] = [];
    
    for (let i = 0; i < 5; i++) {
      const fromChain = chains[Math.floor(Math.random() * chains.length)];
      let toChain = chains[Math.floor(Math.random() * chains.length)];
      while (toChain === fromChain) {
        toChain = chains[Math.floor(Math.random() * chains.length)];
      }
      
      flows.push({
        fromChain,
        toChain,
        volume24h: Math.random() * 500000000,
        netFlow: (Math.random() - 0.5) * 100000000,
        dominantToken: ['ETH', 'USDC', 'USDT', 'WBTC'][Math.floor(Math.random() * 4)],
        timestamp: Date.now(),
      });
    }
    
    return flows;
  }

  async calculateIntelligenceScore(
    symbol: string,
    technicalScore: number,
    direction: 'long' | 'short',
    ohlcvMetadata?: { source: 'real' | 'synthetic' }
  ): Promise<IntelligenceScore> {
    const isOHLCVRealFromCaller = ohlcvMetadata?.source === 'real';
    
    const funding = await this.fetchFundingRates(symbol);
    const sentiment = this.simulateSentiment(symbol);
    const orderFlow = this.simulateOrderFlow(symbol);
    const smartMoney = this.simulateSmartMoneyFlow(symbol);
    const whales = this.simulateWhaleActivity(symbol);

    let fundingBonus = 0;
    let fundingScore = 50;
    if (funding) {
      if (direction === 'long' && funding.rate < -0.0001) {
        fundingScore = 70 + Math.abs(funding.rate) * 10000;
        fundingBonus = 5;
      } else if (direction === 'short' && funding.rate > 0.0001) {
        fundingScore = 70 + funding.rate * 10000;
        fundingBonus = 5;
      } else if ((direction === 'long' && funding.rate > 0.0005) || 
                 (direction === 'short' && funding.rate < -0.0005)) {
        fundingScore = 30;
        fundingBonus = -5;
      }
    }

    let sentimentBonus = 0;
    let sentimentScore = 50;
    if (sentiment) {
      if (direction === 'long' && sentiment.sentiment > 0.3) {
        sentimentScore = 50 + sentiment.sentiment * 30;
        sentimentBonus = 3;
      } else if (direction === 'short' && sentiment.sentiment < -0.3) {
        sentimentScore = 50 + Math.abs(sentiment.sentiment) * 30;
        sentimentBonus = 3;
      } else if ((direction === 'long' && sentiment.sentiment < -0.3) ||
                 (direction === 'short' && sentiment.sentiment > 0.3)) {
        sentimentBonus = -2;
      }
      sentimentScore += Math.min(10, sentiment.influencerMentions);
    }

    let flowBonus = 0;
    let flowScore = 50;
    if (orderFlow) {
      const flowRatio = orderFlow.delta;
      if (direction === 'long' && flowRatio > 0.2) {
        flowScore = 50 + flowRatio * 40;
        flowBonus = 4;
      } else if (direction === 'short' && flowRatio < -0.2) {
        flowScore = 50 + Math.abs(flowRatio) * 40;
        flowBonus = 4;
      } else if ((direction === 'long' && flowRatio < -0.2) ||
                 (direction === 'short' && flowRatio > 0.2)) {
        flowBonus = -3;
      }
    }

    let whaleBonus = 0;
    let whaleScore = 50;
    const smartMoneyWhales = whales.filter(w => w.isSmartMoney);
    if (smartMoneyWhales.length > 0) {
      const deposits = smartMoneyWhales.filter(w => w.type === 'exchange_deposit').length;
      const withdrawals = smartMoneyWhales.filter(w => w.type === 'exchange_withdrawal').length;
      
      if (direction === 'long' && withdrawals > deposits) {
        whaleScore = 65 + (withdrawals - deposits) * 5;
        whaleBonus = 5;
      } else if (direction === 'short' && deposits > withdrawals) {
        whaleScore = 65 + (deposits - withdrawals) * 5;
        whaleBonus = 5;
      } else if ((direction === 'long' && deposits > withdrawals + 1) ||
                 (direction === 'short' && withdrawals > deposits + 1)) {
        whaleBonus = -3;
      }
    }

    let patternBonus = 0;
    let patternScore = 50;
    
    const isOHLCVReal = ohlcvMetadata ? ohlcvMetadata.source === 'real' : false;
    
    if (isOHLCVReal) {
      const ohlcvResult = await this.fetchRealOHLCVWithMetadata(symbol, '4h', 50);
      const candles = ohlcvResult.candles;
      const patterns = this.detectPatterns(candles);
      
      if (ohlcvResult.source === 'real') {
        for (const pattern of patterns) {
          if ((direction === 'long' && pattern.direction === 'bullish') ||
              (direction === 'short' && pattern.direction === 'bearish')) {
            patternScore = Math.max(patternScore, pattern.confidence);
            patternBonus = Math.max(patternBonus, Math.floor(pattern.confidence / 20));
          } else if ((direction === 'long' && pattern.direction === 'bearish') ||
                     (direction === 'short' && pattern.direction === 'bullish')) {
            patternBonus = Math.min(patternBonus, -2);
          }
        }
      }
    }

    const dataQuality: DataQuality = {
      ohlcvSource: isOHLCVReal ? 'real' : 'synthetic',
      fundingSource: funding && funding.exchange !== 'synthetic' ? 'real' : 'synthetic',
      sentimentSource: 'synthetic',
      flowSource: 'synthetic',
      whaleSource: 'synthetic',
      patternSource: isOHLCVReal ? 'real' : 'synthetic',
      overallQuality: 'medium',
      realDataCount: 0,
      totalModules: 6,
      qualityScore: 0,
    };

    dataQuality.realDataCount = [
      dataQuality.ohlcvSource === 'real',
      dataQuality.fundingSource === 'real',
      dataQuality.sentimentSource === 'real',
      dataQuality.flowSource === 'real',
      dataQuality.whaleSource === 'real',
      dataQuality.patternSource === 'real',
    ].filter(Boolean).length;
    
    dataQuality.qualityScore = (dataQuality.realDataCount / dataQuality.totalModules) * 100;
    dataQuality.overallQuality = dataQuality.qualityScore >= 66 ? 'high' : dataQuality.qualityScore >= 33 ? 'medium' : 'low';

    const syntheticPenalty = (6 - dataQuality.realDataCount) * 0.5;
    const reducedSentimentBonus = dataQuality.sentimentSource === 'synthetic' ? Math.floor(sentimentBonus * 0.3) : sentimentBonus;
    const reducedFlowBonus = dataQuality.flowSource === 'synthetic' ? Math.floor(flowBonus * 0.3) : flowBonus;
    const reducedWhaleBonus = dataQuality.whaleSource === 'synthetic' ? Math.floor(whaleBonus * 0.3) : whaleBonus;

    const totalBonus = fundingBonus + reducedSentimentBonus + reducedFlowBonus + reducedWhaleBonus + patternBonus;
    const clampedBonus = Math.max(-15, Math.min(20, totalBonus));
    
    const overallScore = technicalScore + clampedBonus - syntheticPenalty;

    const signals: string[] = [];
    if (fundingBonus > 0) signals.push(`Favorable funding (${funding?.rate?.toFixed(4) || 'N/A'})`);
    if (fundingBonus < 0) signals.push(`Unfavorable funding (${funding?.rate?.toFixed(4) || 'N/A'})`);
    if (sentimentBonus > 0) signals.push(`Positive sentiment (${sentiment.sentiment.toFixed(2)})${dataQuality.sentimentSource === 'synthetic' ? ' [synthetic]' : ''}`);
    if (sentimentBonus < 0) signals.push(`Negative sentiment (${sentiment.sentiment.toFixed(2)})${dataQuality.sentimentSource === 'synthetic' ? ' [synthetic]' : ''}`);
    if (flowBonus > 0) signals.push(`Strong order flow (delta: ${orderFlow.delta.toFixed(2)})${dataQuality.flowSource === 'synthetic' ? ' [synthetic]' : ''}`);
    if (flowBonus < 0) signals.push(`Weak order flow (delta: ${orderFlow.delta.toFixed(2)})${dataQuality.flowSource === 'synthetic' ? ' [synthetic]' : ''}`);
    if (whaleBonus > 0) signals.push(`Whale ${direction === 'long' ? 'accumulation' : 'distribution'}${dataQuality.whaleSource === 'synthetic' ? ' [synthetic]' : ''}`);
    if (whaleBonus < 0) signals.push(`Whale ${direction === 'long' ? 'distribution' : 'accumulation'} (bearish)${dataQuality.whaleSource === 'synthetic' ? ' [synthetic]' : ''}`);
    if (patternBonus > 0) signals.push(`Pattern: ${patterns.filter(p => (direction === 'long' && p.direction === 'bullish') || (direction === 'short' && p.direction === 'bearish')).map(p => p.pattern).join(', ')}`);
    if (patternBonus < 0) signals.push(`Counter-pattern detected`);
    if (smartMoney.flowSignal === (direction === 'long' ? 'accumulation' : 'distribution')) {
      signals.push(`Smart money ${smartMoney.flowSignal}${dataQuality.flowSource === 'synthetic' ? ' [synthetic]' : ''}`);
    }
    
    signals.push(`Data quality: ${dataQuality.overallQuality} (${dataQuality.realDataCount}/${dataQuality.totalModules} real sources)`);

    return {
      symbol,
      technicalScore,
      sentimentScore: Math.min(100, sentimentScore),
      flowScore: Math.min(100, flowScore),
      whaleScore: Math.min(100, whaleScore),
      fundingScore: Math.min(100, fundingScore),
      patternScore: Math.min(100, patternScore),
      overallScore: Math.min(100, Math.max(0, overallScore)),
      direction,
      confidence: Math.min(95, overallScore * 0.95),
      signals,
      timestamp: Date.now(),
      dataQuality,
    };
  }

  async analyzeMultiTimeframe(
    symbol: string,
    primaryTimeframe: string = '4h'
  ): Promise<MultiTimeframeAnalysis> {
    const htfTimeframe = primaryTimeframe === '1h' ? '4h' : primaryTimeframe === '4h' ? '1d' : '1w';
    const ltfTimeframe = primaryTimeframe;
    
    const [htfResult, ltfResult] = await Promise.all([
      this.fetchRealOHLCVWithMetadata(symbol, htfTimeframe, 50),
      this.fetchRealOHLCVWithMetadata(symbol, ltfTimeframe, 50),
    ]);
    
    const htfCandles = htfResult.candles;
    const ltfCandles = ltfResult.candles;
    
    const htfIsReal = htfResult.source === 'real';
    const ltfIsReal = ltfResult.source === 'real';
    
    const calculateEMATrend = (candles: CandleData[]): 'bullish' | 'bearish' | 'neutral' => {
      if (candles.length < 20) return 'neutral';
      const closes = candles.map(c => c.close);
      const ema20 = this.calculateSimpleEMA(closes, 20);
      const ema50 = this.calculateSimpleEMA(closes, Math.min(50, closes.length));
      const currentPrice = closes[closes.length - 1];
      
      if (currentPrice > ema20 && ema20 > ema50) return 'bullish';
      if (currentPrice < ema20 && ema20 < ema50) return 'bearish';
      return 'neutral';
    };
    
    const htfTrend = htfIsReal ? calculateEMATrend(htfCandles) : 'neutral';
    const ltfTrend = ltfIsReal ? calculateEMATrend(ltfCandles) : 'neutral';
    
    const trendAlignment = htfIsReal && ltfIsReal && (htfTrend === ltfTrend) && htfTrend !== 'neutral';
    
    const htfCloses = htfCandles.map(c => c.close);
    const htfEma50 = this.calculateSimpleEMA(htfCloses, Math.min(50, htfCloses.length));
    const htfEma200 = this.calculateSimpleEMA(htfCloses, Math.min(200, htfCloses.length));
    const htfEmaAlignment = htfIsReal && (htfTrend === 'bullish' ? htfEma50 > htfEma200 : htfTrend === 'bearish' ? htfEma50 < htfEma200 : false);
    
    let confidenceBoost = 0;
    
    if (!htfIsReal || !ltfIsReal) {
      confidenceBoost = -15;
      console.warn(`[MTF] Synthetic data detected for ${symbol} - HTF: ${htfResult.source}, LTF: ${ltfResult.source}`);
    } else {
      if (trendAlignment) confidenceBoost += 10;
      if (htfEmaAlignment) confidenceBoost += 5;
      if (htfTrend === 'neutral') confidenceBoost -= 5;
    }
    
    return {
      symbol,
      htfTrend,
      htfTimeframe,
      ltfTrend,
      ltfTimeframe,
      trendAlignment,
      htfEmaAlignment,
      confidenceBoost,
    };
  }

  private calculateSimpleEMA(prices: number[], period: number): number {
    if (prices.length < period) return prices[prices.length - 1];
    const multiplier = 2 / (period + 1);
    let ema = prices.slice(0, period).reduce((a, b) => a + b) / period;
    for (let i = period; i < prices.length; i++) {
      ema = (prices[i] - ema) * multiplier + ema;
    }
    return ema;
  }
}

export const advancedIntelligence = new AdvancedIntelligenceService();
