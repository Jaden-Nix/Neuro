import { EventEmitter } from "events";

export type PatternType =
  | "momentum_shift"
  | "whale_accumulation"
  | "volatility_cluster"
  | "trend_reversal"
  | "liquidity_squeeze"
  | "correlated_movement"
  | "breakout_signal"
  | "support_resistance"
  | "divergence";

export type ImpactLevel = "Critical" | "High" | "Medium" | "Low";

export type SuggestedAction =
  | "Increase position"
  | "Reduce risk"
  | "Hold"
  | "Exit position"
  | "Scale in"
  | "Scale out"
  | "Hedge"
  | "Wait for confirmation"
  | "Monitor closely";

export interface AIInsight {
  id: string;
  pattern: PatternType;
  confidence: number;
  reason: string;
  impact: ImpactLevel;
  suggestedAction: SuggestedAction;
  symbol: string;
  timestamp: number;
  metadata: {
    priceChange?: number;
    volumeChange?: number;
    volatility?: number;
    correlatedAssets?: string[];
    timeframe?: string;
    supportLevel?: number;
    resistanceLevel?: number;
  };
}

export interface MarketDataPoint {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface OrderFlowData {
  buyVolume: number;
  sellVolume: number;
  largeOrders: number;
  timestamp: number;
}

interface PatternDetectorConfig {
  lookbackPeriod: number;
  sensitivityThreshold: number;
}

class PatternDetector {
  protected config: PatternDetectorConfig;

  constructor(config: Partial<PatternDetectorConfig> = {}) {
    this.config = {
      lookbackPeriod: config.lookbackPeriod || 20,
      sensitivityThreshold: config.sensitivityThreshold || 0.7,
    };
  }

  protected calculateSMA(data: number[], period: number): number {
    if (data.length < period) return data[data.length - 1] || 0;
    const slice = data.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  protected calculateEMA(data: number[], period: number): number {
    if (data.length === 0) return 0;
    const multiplier = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
      ema = (data[i] - ema) * multiplier + ema;
    }
    return ema;
  }

  protected calculateStdDev(data: number[]): number {
    if (data.length === 0) return 0;
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const squaredDiffs = data.map((x) => Math.pow(x - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / data.length);
  }

  protected calculateRSI(closes: number[], period: number = 14): number {
    if (closes.length < period + 1) return 50;

    let gains = 0;
    let losses = 0;

    for (let i = closes.length - period; i < closes.length; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses += Math.abs(change);
    }

    const avgGain = gains / period;
    const avgLoss = losses / period;

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - 100 / (1 + rs);
  }

  protected calculateMACD(
    closes: number[]
  ): { macd: number; signal: number; histogram: number } {
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macd = ema12 - ema26;

    const macdLine = closes.map((_, i) => {
      const slice = closes.slice(0, i + 1);
      return this.calculateEMA(slice, 12) - this.calculateEMA(slice, 26);
    });
    const signal = this.calculateEMA(macdLine.slice(-9), 9);

    return {
      macd,
      signal,
      histogram: macd - signal,
    };
  }

  protected calculateBollingerBands(
    closes: number[],
    period: number = 20
  ): { upper: number; middle: number; lower: number; width: number } {
    const sma = this.calculateSMA(closes, period);
    const stdDev = this.calculateStdDev(closes.slice(-period));

    return {
      upper: sma + 2 * stdDev,
      middle: sma,
      lower: sma - 2 * stdDev,
      width: (4 * stdDev) / sma,
    };
  }
}

class MomentumDetector extends PatternDetector {
  detect(data: MarketDataPoint[]): AIInsight | null {
    if (data.length < 20) return null;

    const closes = data.map((d) => d.close);
    const volumes = data.map((d) => d.volume);

    const recentCloses = closes.slice(-10);
    const previousCloses = closes.slice(-20, -10);

    const recentMomentum =
      (recentCloses[recentCloses.length - 1] - recentCloses[0]) /
      recentCloses[0];
    const previousMomentum =
      (previousCloses[previousCloses.length - 1] - previousCloses[0]) /
      previousCloses[0];

    const rsi = this.calculateRSI(closes);
    const macd = this.calculateMACD(closes);

    const recentVolume = this.calculateSMA(volumes.slice(-5), 5);
    const avgVolume = this.calculateSMA(volumes.slice(-20), 20);
    const volumeRatio = recentVolume / avgVolume;

    const momentumShift = Math.abs(recentMomentum - previousMomentum);
    const directionChange =
      Math.sign(recentMomentum) !== Math.sign(previousMomentum);

    if (momentumShift > 0.02 && volumeRatio > 1.2) {
      const bullish = recentMomentum > 0;
      const confidence = Math.min(
        0.95,
        0.5 + momentumShift * 5 + (volumeRatio - 1) * 0.2
      );

      let impact: ImpactLevel = "Medium";
      if (momentumShift > 0.05) impact = "High";
      if (momentumShift > 0.08 && volumeRatio > 1.5) impact = "Critical";

      return {
        id: `mom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pattern: "momentum_shift",
        confidence: Math.round(confidence * 100) / 100,
        reason: `${bullish ? "Bullish" : "Bearish"} momentum shift detected: ${(momentumShift * 100).toFixed(1)}% change with ${(volumeRatio * 100 - 100).toFixed(0)}% volume surge. RSI at ${rsi.toFixed(0)}, MACD histogram ${macd.histogram > 0 ? "positive" : "negative"}`,
        impact,
        suggestedAction: bullish ? "Increase position" : "Reduce risk",
        symbol: "",
        timestamp: Date.now(),
        metadata: {
          priceChange: recentMomentum * 100,
          volumeChange: (volumeRatio - 1) * 100,
          timeframe: "10 candles",
        },
      };
    }

    return null;
  }
}

class WhaleDetector extends PatternDetector {
  detect(data: MarketDataPoint[], orderFlow?: OrderFlowData[]): AIInsight | null {
    if (data.length < 10) return null;

    const volumes = data.map((d) => d.volume);
    const closes = data.map((d) => d.close);

    const avgVolume = this.calculateSMA(volumes.slice(-20), 20);
    const recentVolume = volumes.slice(-3);

    const volumeSpikes = recentVolume.filter((v) => v > avgVolume * 2.5);
    const hasVolumeSpike = volumeSpikes.length > 0;

    const priceChange =
      (closes[closes.length - 1] - closes[closes.length - 4]) /
      closes[closes.length - 4];
    const lowVolatility =
      this.calculateStdDev(closes.slice(-10)) / closes[closes.length - 1] <
      0.02;

    const accumulation =
      hasVolumeSpike && Math.abs(priceChange) < 0.03 && lowVolatility;

    if (accumulation || (hasVolumeSpike && recentVolume.some((v) => v > avgVolume * 3))) {
      const maxSpike = Math.max(...volumeSpikes) / avgVolume;
      const bullish = priceChange >= 0;
      const confidence = Math.min(0.92, 0.6 + (maxSpike - 2) * 0.1);

      return {
        id: `whale-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pattern: "whale_accumulation",
        confidence: Math.round(confidence * 100) / 100,
        reason: `Large volume spike detected: ${maxSpike.toFixed(1)}x average with ${accumulation ? "price absorption" : "directional pressure"}. ${bullish ? "Buying" : "Selling"} pressure indicated`,
        impact: maxSpike > 4 ? "Critical" : maxSpike > 3 ? "High" : "Medium",
        suggestedAction: bullish ? "Scale in" : "Monitor closely",
        symbol: "",
        timestamp: Date.now(),
        metadata: {
          volumeChange: (maxSpike - 1) * 100,
          priceChange: priceChange * 100,
        },
      };
    }

    return null;
  }
}

class VolatilityDetector extends PatternDetector {
  detect(data: MarketDataPoint[]): AIInsight | null {
    if (data.length < 20) return null;

    const closes = data.map((d) => d.close);
    const ranges = data.map((d) => (d.high - d.low) / d.open);

    const recentVolatility = this.calculateStdDev(closes.slice(-5));
    const historicalVolatility = this.calculateStdDev(closes.slice(-20));

    const volatilityRatio = recentVolatility / historicalVolatility;

    const recentRanges = ranges.slice(-5);
    const avgRange = this.calculateSMA(ranges, 20);
    const rangeExpansion = this.calculateSMA(recentRanges, 5) / avgRange;

    const bb = this.calculateBollingerBands(closes);
    const currentPrice = closes[closes.length - 1];
    const bbPosition =
      (currentPrice - bb.lower) / (bb.upper - bb.lower);

    if (volatilityRatio > 1.5 || rangeExpansion > 1.8) {
      const confidence = Math.min(
        0.9,
        0.55 + (volatilityRatio - 1) * 0.15 + (rangeExpansion - 1) * 0.1
      );

      let impact: ImpactLevel = "Medium";
      if (volatilityRatio > 2.5 || rangeExpansion > 2.5) impact = "Critical";
      else if (volatilityRatio > 2 || rangeExpansion > 2) impact = "High";

      return {
        id: `vol-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pattern: "volatility_cluster",
        confidence: Math.round(confidence * 100) / 100,
        reason: `Sudden increase in candle variance: ${volatilityRatio.toFixed(1)}x normal volatility + ${(rangeExpansion * 100 - 100).toFixed(0)}% range expansion. Bollinger Band width: ${(bb.width * 100).toFixed(1)}%`,
        impact,
        suggestedAction: "Reduce risk",
        symbol: "",
        timestamp: Date.now(),
        metadata: {
          volatility: volatilityRatio,
          priceChange: ((currentPrice - closes[0]) / closes[0]) * 100,
        },
      };
    }

    return null;
  }
}

class TrendReversalDetector extends PatternDetector {
  detect(data: MarketDataPoint[]): AIInsight | null {
    if (data.length < 30) return null;

    const closes = data.map((d) => d.close);
    const highs = data.map((d) => d.high);
    const lows = data.map((d) => d.low);

    const sma5 = this.calculateSMA(closes, 5);
    const sma20 = this.calculateSMA(closes, 20);
    const prevSma5 = this.calculateSMA(closes.slice(0, -1), 5);
    const prevSma20 = this.calculateSMA(closes.slice(0, -1), 20);

    const currentCross = sma5 > sma20;
    const previousCross = prevSma5 > prevSma20;
    const crossover = currentCross !== previousCross;

    const rsi = this.calculateRSI(closes);
    const overbought = rsi > 70;
    const oversold = rsi < 30;

    const macd = this.calculateMACD(closes);
    const macdCrossover =
      Math.sign(macd.histogram) !==
      Math.sign(
        this.calculateMACD(closes.slice(0, -1)).histogram
      );

    const recentHigh = Math.max(...highs.slice(-10));
    const recentLow = Math.min(...lows.slice(-10));
    const currentPrice = closes[closes.length - 1];

    const atResistance = (recentHigh - currentPrice) / currentPrice < 0.01;
    const atSupport = (currentPrice - recentLow) / currentPrice < 0.01;

    if (crossover || (macdCrossover && (overbought || oversold))) {
      const bullish = currentCross || (oversold && macd.histogram > 0);
      const confidence = Math.min(
        0.88,
        0.5 +
          (crossover ? 0.2 : 0) +
          (macdCrossover ? 0.15 : 0) +
          (overbought || oversold ? 0.1 : 0)
      );

      return {
        id: `rev-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pattern: "trend_reversal",
        confidence: Math.round(confidence * 100) / 100,
        reason: `${bullish ? "Bullish" : "Bearish"} reversal signals: ${crossover ? "MA crossover" : ""} ${macdCrossover ? "+ MACD cross" : ""} ${overbought ? "+ overbought RSI" : ""} ${oversold ? "+ oversold RSI" : ""}`.trim(),
        impact: crossover && macdCrossover ? "High" : "Medium",
        suggestedAction: bullish ? "Scale in" : "Exit position",
        symbol: "",
        timestamp: Date.now(),
        metadata: {
          priceChange: ((currentPrice - closes[0]) / closes[0]) * 100,
          supportLevel: recentLow,
          resistanceLevel: recentHigh,
        },
      };
    }

    return null;
  }
}

class LiquidityDetector extends PatternDetector {
  detect(data: MarketDataPoint[]): AIInsight | null {
    if (data.length < 15) return null;

    const volumes = data.map((d) => d.volume);
    const closes = data.map((d) => d.close);
    const ranges = data.map((d) => d.high - d.low);

    const avgVolume = this.calculateSMA(volumes, 20);
    const recentVolume = this.calculateSMA(volumes.slice(-3), 3);
    const volumeDrop = 1 - recentVolume / avgVolume;

    const avgRange = this.calculateSMA(ranges, 20);
    const recentRange = this.calculateSMA(ranges.slice(-3), 3);
    const rangeContraction = 1 - recentRange / avgRange;

    const spreadEstimate =
      ((data[data.length - 1].high - data[data.length - 1].low) /
        data[data.length - 1].close) *
      100;

    if (volumeDrop > 0.4 && rangeContraction > 0.3) {
      const confidence = Math.min(0.85, 0.5 + volumeDrop * 0.3 + rangeContraction * 0.2);

      return {
        id: `liq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pattern: "liquidity_squeeze",
        confidence: Math.round(confidence * 100) / 100,
        reason: `Liquidity thinning: ${(volumeDrop * 100).toFixed(0)}% volume drop + ${(rangeContraction * 100).toFixed(0)}% range contraction. Spread estimate: ${spreadEstimate.toFixed(2)}%`,
        impact: volumeDrop > 0.6 ? "High" : "Medium",
        suggestedAction: "Wait for confirmation",
        symbol: "",
        timestamp: Date.now(),
        metadata: {
          volumeChange: -volumeDrop * 100,
          volatility: spreadEstimate,
        },
      };
    }

    return null;
  }
}

class CorrelationDetector extends PatternDetector {
  private correlationCache: Map<string, { correlation: number; timestamp: number }> = new Map();

  calculateCorrelation(dataA: number[], dataB: number[]): number {
    const n = Math.min(dataA.length, dataB.length);
    if (n < 5) return 0;

    const a = dataA.slice(-n);
    const b = dataB.slice(-n);

    const meanA = a.reduce((x, y) => x + y, 0) / n;
    const meanB = b.reduce((x, y) => x + y, 0) / n;

    let numerator = 0;
    let denomA = 0;
    let denomB = 0;

    for (let i = 0; i < n; i++) {
      const diffA = a[i] - meanA;
      const diffB = b[i] - meanB;
      numerator += diffA * diffB;
      denomA += diffA * diffA;
      denomB += diffB * diffB;
    }

    const denominator = Math.sqrt(denomA * denomB);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  detect(
    primaryData: MarketDataPoint[],
    correlatedData: Map<string, MarketDataPoint[]>
  ): AIInsight | null {
    if (primaryData.length < 20) return null;

    const primaryReturns = primaryData.slice(-20).map((d, i, arr) => {
      if (i === 0) return 0;
      return (d.close - arr[i - 1].close) / arr[i - 1].close;
    });

    const correlations: { symbol: string; correlation: number }[] = [];

    for (const [symbol, data] of correlatedData) {
      if (data.length < 20) continue;

      const returns = data.slice(-20).map((d, i, arr) => {
        if (i === 0) return 0;
        return (d.close - arr[i - 1].close) / arr[i - 1].close;
      });

      const correlation = this.calculateCorrelation(primaryReturns, returns);
      correlations.push({ symbol, correlation });
    }

    const strongCorrelations = correlations.filter(
      (c) => Math.abs(c.correlation) > 0.7
    );

    if (strongCorrelations.length > 0) {
      const strongest = strongCorrelations.sort(
        (a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)
      )[0];

      const primaryMove =
        (primaryData[primaryData.length - 1].close -
          primaryData[primaryData.length - 5].close) /
        primaryData[primaryData.length - 5].close;

      return {
        id: `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pattern: "correlated_movement",
        confidence: Math.round(Math.abs(strongest.correlation) * 100) / 100,
        reason: `Strong ${strongest.correlation > 0 ? "positive" : "negative"} correlation (${(strongest.correlation * 100).toFixed(0)}%) detected with ${strongest.symbol}. Primary asset moved ${(primaryMove * 100).toFixed(1)}%`,
        impact: strongCorrelations.length > 2 ? "High" : "Medium",
        suggestedAction: "Monitor closely",
        symbol: "",
        timestamp: Date.now(),
        metadata: {
          correlatedAssets: strongCorrelations.map((c) => c.symbol),
          priceChange: primaryMove * 100,
        },
      };
    }

    return null;
  }
}

class BreakoutDetector extends PatternDetector {
  detect(data: MarketDataPoint[]): AIInsight | null {
    if (data.length < 30) return null;

    const closes = data.map((d) => d.close);
    const highs = data.map((d) => d.high);
    const lows = data.map((d) => d.low);
    const volumes = data.map((d) => d.volume);

    const consolidationPeriod = 20;
    const consolidationHighs = highs.slice(-consolidationPeriod - 5, -5);
    const consolidationLows = lows.slice(-consolidationPeriod - 5, -5);

    const resistanceLevel = Math.max(...consolidationHighs);
    const supportLevel = Math.min(...consolidationLows);
    const range = resistanceLevel - supportLevel;

    const currentPrice = closes[closes.length - 1];
    const avgVolume = this.calculateSMA(volumes.slice(-20), 20);
    const recentVolume = this.calculateSMA(volumes.slice(-3), 3);
    const volumeConfirmation = recentVolume > avgVolume * 1.5;

    const breakoutUp = currentPrice > resistanceLevel && volumeConfirmation;
    const breakoutDown = currentPrice < supportLevel && volumeConfirmation;

    if (breakoutUp || breakoutDown) {
      const breakoutStrength = breakoutUp
        ? (currentPrice - resistanceLevel) / range
        : (supportLevel - currentPrice) / range;

      const confidence = Math.min(
        0.9,
        0.55 + breakoutStrength * 0.2 + (recentVolume / avgVolume - 1) * 0.1
      );

      return {
        id: `brk-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pattern: "breakout_signal",
        confidence: Math.round(confidence * 100) / 100,
        reason: `${breakoutUp ? "Bullish" : "Bearish"} breakout: Price ${breakoutUp ? "above" : "below"} ${breakoutUp ? "resistance" : "support"} at $${(breakoutUp ? resistanceLevel : supportLevel).toFixed(2)} with ${((recentVolume / avgVolume) * 100).toFixed(0)}% volume confirmation`,
        impact: volumeConfirmation && breakoutStrength > 0.5 ? "High" : "Medium",
        suggestedAction: breakoutUp ? "Increase position" : "Exit position",
        symbol: "",
        timestamp: Date.now(),
        metadata: {
          supportLevel,
          resistanceLevel,
          priceChange: breakoutUp
            ? ((currentPrice - resistanceLevel) / resistanceLevel) * 100
            : ((supportLevel - currentPrice) / supportLevel) * 100,
          volumeChange: (recentVolume / avgVolume - 1) * 100,
        },
      };
    }

    return null;
  }
}

class DivergenceDetector extends PatternDetector {
  detect(data: MarketDataPoint[]): AIInsight | null {
    if (data.length < 30) return null;

    const closes = data.map((d) => d.close);

    const rsiValues: number[] = [];
    for (let i = 14; i < closes.length; i++) {
      rsiValues.push(this.calculateRSI(closes.slice(0, i + 1)));
    }

    const recentPrices = closes.slice(-10);
    const recentRSI = rsiValues.slice(-10);

    const priceHigherHighs =
      recentPrices[recentPrices.length - 1] >
      Math.max(...recentPrices.slice(0, -3));
    const priceLowerLows =
      recentPrices[recentPrices.length - 1] <
      Math.min(...recentPrices.slice(0, -3));

    const rsiHigherHighs =
      recentRSI[recentRSI.length - 1] > Math.max(...recentRSI.slice(0, -3));
    const rsiLowerLows =
      recentRSI[recentRSI.length - 1] < Math.min(...recentRSI.slice(0, -3));

    const bearishDivergence = priceHigherHighs && !rsiHigherHighs;
    const bullishDivergence = priceLowerLows && !rsiLowerLows;

    if (bearishDivergence || bullishDivergence) {
      const currentRSI = rsiValues[rsiValues.length - 1];
      const confidence = bullishDivergence
        ? Math.min(0.85, 0.5 + (50 - currentRSI) / 100)
        : Math.min(0.85, 0.5 + (currentRSI - 50) / 100);

      return {
        id: `div-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        pattern: "divergence",
        confidence: Math.round(confidence * 100) / 100,
        reason: `${bullishDivergence ? "Bullish" : "Bearish"} RSI divergence: Price making ${bullishDivergence ? "lower lows" : "higher highs"} while RSI ${bullishDivergence ? "shows strength" : "shows weakness"}. Current RSI: ${currentRSI.toFixed(0)}`,
        impact: "Medium",
        suggestedAction: bullishDivergence
          ? "Scale in"
          : "Reduce risk",
        symbol: "",
        timestamp: Date.now(),
        metadata: {
          priceChange:
            ((closes[closes.length - 1] - closes[closes.length - 10]) /
              closes[closes.length - 10]) *
            100,
        },
      };
    }

    return null;
  }
}

export class AIInsightsEngine extends EventEmitter {
  private momentumDetector: MomentumDetector;
  private whaleDetector: WhaleDetector;
  private volatilityDetector: VolatilityDetector;
  private trendReversalDetector: TrendReversalDetector;
  private liquidityDetector: LiquidityDetector;
  private correlationDetector: CorrelationDetector;
  private breakoutDetector: BreakoutDetector;
  private divergenceDetector: DivergenceDetector;

  private insights: Map<string, AIInsight> = new Map();
  private marketDataCache: Map<string, MarketDataPoint[]> = new Map();
  private analysisInterval: NodeJS.Timer | null = null;

  constructor() {
    super();
    this.momentumDetector = new MomentumDetector();
    this.whaleDetector = new WhaleDetector();
    this.volatilityDetector = new VolatilityDetector();
    this.trendReversalDetector = new TrendReversalDetector();
    this.liquidityDetector = new LiquidityDetector();
    this.correlationDetector = new CorrelationDetector();
    this.breakoutDetector = new BreakoutDetector();
    this.divergenceDetector = new DivergenceDetector();

    this.initializeDemoData();
  }

  private initializeDemoData(): void {
    const symbols = ["ETH-USD", "BTC-USD", "LINK-USD", "UNI-USD", "AAVE-USD"];
    const basePrice: Record<string, number> = {
      "ETH-USD": 2400,
      "BTC-USD": 42000,
      "LINK-USD": 15,
      "UNI-USD": 7,
      "AAVE-USD": 95,
    };

    for (const symbol of symbols) {
      const data: MarketDataPoint[] = [];
      let price = basePrice[symbol];

      for (let i = 0; i < 100; i++) {
        const volatility = 0.02;
        const change = (Math.random() - 0.48) * volatility;
        price = price * (1 + change);

        const range = price * (0.005 + Math.random() * 0.015);
        const open = price - range / 2 + Math.random() * range;
        const close = price;
        const high = Math.max(open, close) + Math.random() * range * 0.5;
        const low = Math.min(open, close) - Math.random() * range * 0.5;

        data.push({
          timestamp: Date.now() - (100 - i) * 3600000,
          open,
          high,
          low,
          close,
          volume: 1000000 + Math.random() * 5000000,
        });
      }

      this.marketDataCache.set(symbol, data);
    }
  }

  public analyzeSymbol(symbol: string): AIInsight[] {
    const data = this.marketDataCache.get(symbol);
    if (!data || data.length < 30) return [];

    const detectedInsights: AIInsight[] = [];

    const momentum = this.momentumDetector.detect(data);
    if (momentum) {
      momentum.symbol = symbol;
      detectedInsights.push(momentum);
    }

    const whale = this.whaleDetector.detect(data);
    if (whale) {
      whale.symbol = symbol;
      detectedInsights.push(whale);
    }

    const volatility = this.volatilityDetector.detect(data);
    if (volatility) {
      volatility.symbol = symbol;
      detectedInsights.push(volatility);
    }

    const reversal = this.trendReversalDetector.detect(data);
    if (reversal) {
      reversal.symbol = symbol;
      detectedInsights.push(reversal);
    }

    const liquidity = this.liquidityDetector.detect(data);
    if (liquidity) {
      liquidity.symbol = symbol;
      detectedInsights.push(liquidity);
    }

    const breakout = this.breakoutDetector.detect(data);
    if (breakout) {
      breakout.symbol = symbol;
      detectedInsights.push(breakout);
    }

    const divergence = this.divergenceDetector.detect(data);
    if (divergence) {
      divergence.symbol = symbol;
      detectedInsights.push(divergence);
    }

    for (const insight of detectedInsights) {
      this.insights.set(insight.id, insight);
      this.emit("insight", insight);
    }

    return detectedInsights;
  }

  public analyzeAllSymbols(): AIInsight[] {
    const allInsights: AIInsight[] = [];

    for (const symbol of this.marketDataCache.keys()) {
      const insights = this.analyzeSymbol(symbol);
      allInsights.push(...insights);
    }

    const correlatedData = new Map<string, MarketDataPoint[]>();
    for (const [symbol, data] of this.marketDataCache) {
      if (symbol !== "ETH-USD") {
        correlatedData.set(symbol, data);
      }
    }

    const ethData = this.marketDataCache.get("ETH-USD");
    if (ethData) {
      const correlation = this.correlationDetector.detect(ethData, correlatedData);
      if (correlation) {
        correlation.symbol = "ETH-USD";
        this.insights.set(correlation.id, correlation);
        allInsights.push(correlation);
        this.emit("insight", correlation);
      }
    }

    return allInsights;
  }

  public updateMarketData(symbol: string, dataPoint: MarketDataPoint): void {
    let data = this.marketDataCache.get(symbol);
    if (!data) {
      data = [];
      this.marketDataCache.set(symbol, data);
    }

    data.push(dataPoint);

    if (data.length > 200) {
      data.shift();
    }
  }

  public getInsights(options?: {
    symbol?: string;
    pattern?: PatternType;
    minConfidence?: number;
    limit?: number;
  }): AIInsight[] {
    let insights = Array.from(this.insights.values());

    if (options?.symbol) {
      insights = insights.filter((i) => i.symbol === options.symbol);
    }

    if (options?.pattern) {
      insights = insights.filter((i) => i.pattern === options.pattern);
    }

    if (options?.minConfidence) {
      insights = insights.filter((i) => i.confidence >= options.minConfidence);
    }

    insights.sort((a, b) => b.timestamp - a.timestamp);

    if (options?.limit) {
      insights = insights.slice(0, options.limit);
    }

    return insights;
  }

  public getInsight(id: string): AIInsight | undefined {
    return this.insights.get(id);
  }

  public clearInsights(): void {
    this.insights.clear();
  }

  public getStats(): {
    totalInsights: number;
    byPattern: Record<PatternType, number>;
    byImpact: Record<ImpactLevel, number>;
    avgConfidence: number;
  } {
    const insights = Array.from(this.insights.values());

    const byPattern: Record<string, number> = {};
    const byImpact: Record<string, number> = {};
    let totalConfidence = 0;

    for (const insight of insights) {
      byPattern[insight.pattern] = (byPattern[insight.pattern] || 0) + 1;
      byImpact[insight.impact] = (byImpact[insight.impact] || 0) + 1;
      totalConfidence += insight.confidence;
    }

    return {
      totalInsights: insights.length,
      byPattern: byPattern as Record<PatternType, number>,
      byImpact: byImpact as Record<ImpactLevel, number>,
      avgConfidence:
        insights.length > 0 ? totalConfidence / insights.length : 0,
    };
  }

  public generateDemoInsights(): AIInsight[] {
    this.initializeDemoData();

    for (const symbol of this.marketDataCache.keys()) {
      const data = this.marketDataCache.get(symbol)!;
      const lastPoints = data.slice(-10);

      for (let i = 0; i < 3; i++) {
        const volatility = 0.03 + Math.random() * 0.02;
        const lastPrice = lastPoints[lastPoints.length - 1].close;
        const change = (Math.random() - 0.45) * volatility;
        const newPrice = lastPrice * (1 + change);

        const range = newPrice * (0.01 + Math.random() * 0.02);
        const open = newPrice - range / 2 + Math.random() * range;
        const volumeMultiplier = 1 + Math.random() * 2;

        this.updateMarketData(symbol, {
          timestamp: Date.now() + i * 3600000,
          open,
          high: Math.max(open, newPrice) + Math.random() * range,
          low: Math.min(open, newPrice) - Math.random() * range,
          close: newPrice,
          volume: (1000000 + Math.random() * 5000000) * volumeMultiplier,
        });
      }
    }

    return this.analyzeAllSymbols();
  }

  public getAvailableSymbols(): string[] {
    return Array.from(this.marketDataCache.keys());
  }
}

export const aiInsightsEngine = new AIInsightsEngine();
