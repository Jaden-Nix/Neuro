import { coinGeckoClient, type OHLCCandle } from './providers/CoinGeckoClient';
import { binanceClient, type Kline } from './providers/BinanceClient';
import { defiLlamaClient, type YieldPool, type Protocol } from './providers/DefiLlamaClient';
import { ccxtAdapter } from './providers/CCXTAdapter';

export interface BacktestCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface MarketSnapshot {
  symbol: string;
  price: number;
  change24h: number;
  volume24h: number;
  volatility: number;
  timestamp: number;
}

export interface DeFiSnapshot {
  totalTVL: number;
  topYields: YieldPool[];
  topProtocols: Protocol[];
  timestamp: number;
}

export type DataSource = 'binance' | 'coingecko' | 'auto';

export class MarketDataService {
  private preferredSource: DataSource = 'auto';

  setPreferredSource(source: DataSource): void {
    this.preferredSource = source;
    console.log(`[MarketData] Preferred source set to: ${source}`);
  }

  async getHistoricalCandles(
    symbol: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    startDate: Date,
    endDate: Date,
    source?: DataSource
  ): Promise<BacktestCandle[]> {
    const useSource = source || this.preferredSource;
    
    console.log(`[MarketData] Fetching ${symbol} candles from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    if (useSource === 'binance' || useSource === 'auto') {
      try {
        const klines = await binanceClient.getHistoricalKlines(
          symbol,
          interval,
          startDate.getTime(),
          endDate.getTime()
        );
        
        console.log(`[MarketData] Got ${klines.length} candles from Binance`);
        return binanceClient.convertToBacktestCandles(klines);
      } catch (error) {
        console.warn(`[MarketData] Binance failed, trying CoinGecko:`, error);
        
        if (useSource === 'binance') {
          throw error;
        }
      }
    }

    const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    const ohlcData = await coinGeckoClient.getOHLC(symbol, Math.min(days, 90));
    
    console.log(`[MarketData] Got ${ohlcData.length} candles from CoinGecko`);
    
    return coinGeckoClient.convertToBacktestCandles(ohlcData, startDate, endDate).map(c => ({
      ...c,
      volume: 100000,
    }));
  }

  async getRecentCandles(
    symbol: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
    limit: number = 100
  ): Promise<BacktestCandle[]> {
    try {
      const days = interval === '1d' ? limit : Math.ceil(limit / 24);
      const ohlcData = await coinGeckoClient.getOHLC(symbol, Math.min(days, 30));
      
      return ohlcData.map(c => ({
        ...c,
        volume: 100000,
      }));
    } catch (error) {
      console.warn(`[MarketData] CoinGecko failed for recent candles, using fallback`);
      return [];
    }
  }

  private fallbackPrices: Record<string, number> = {
    'BTC': 92000,
    'BTC-USD': 92000,
    'BTCUSDT': 92000,
    'ETH': 3180,
    'ETH-USD': 3180,
    'ETHUSDT': 3180,
    'SOL': 145,
    'SOL-USD': 145,
    'SOLUSDT': 145,
    'LINK': 24,
    'LINK-USD': 24,
    'LINKUSDT': 24,
    'UNI': 14,
    'UNI-USD': 14,
    'UNIUSDT': 14,
    'AAVE': 193,
    'AAVE-USD': 193,
    'AAVEUSDT': 193,
  };

  async getCurrentPrice(symbol: string): Promise<number> {
    const upperSymbol = symbol.toUpperCase();
    const cleanSymbol = upperSymbol.replace('-USD', '').replace('/USD', '').replace('USDT', '');
    
    // Try CCXT bulk fetch (more reliable than single fetch)
    try {
      const ccxtPrice = await ccxtAdapter.fetchPrice(cleanSymbol);
      if (ccxtPrice && ccxtPrice.price > 0) {
        this.fallbackPrices[cleanSymbol] = ccxtPrice.price;
        return ccxtPrice.price;
      }
    } catch (ccxtError) {
      // CCXT failed, try CoinGecko
    }
    
    // Try CoinGecko as fallback
    try {
      const prices = await coinGeckoClient.getCurrentPrice([cleanSymbol]);
      const price = prices[cleanSymbol];
      if (price && price > 0) {
        this.fallbackPrices[cleanSymbol] = price;
        return price;
      }
    } catch (geckoError) {
      // CoinGecko also failed
    }
    
    // Use static fallback - try multiple key variations
    const fallback = this.fallbackPrices[cleanSymbol] 
      || this.fallbackPrices[upperSymbol]
      || this.fallbackPrices[`${cleanSymbol}-USD`]
      || this.fallbackPrices[`${cleanSymbol}USDT`];
    
    if (fallback && fallback > 0) {
      console.log(`[MarketData] Using fallback price for ${cleanSymbol}: $${fallback}`);
      return fallback;
    }
    
    // Ultimate fallback for major tokens - never return 0 for these
    const ultimateFallbacks: Record<string, number> = {
      'BTC': 95000, 'ETH': 3500, 'SOL': 180, 'XRP': 2.2, 'BNB': 680,
      'LINK': 25, 'UNI': 15, 'AAVE': 200, 'AVAX': 40, 'DOGE': 0.35
    };
    
    if (ultimateFallbacks[cleanSymbol]) {
      console.log(`[MarketData] Using ultimate fallback for ${cleanSymbol}: $${ultimateFallbacks[cleanSymbol]}`);
      return ultimateFallbacks[cleanSymbol];
    }
    
    return 0;
  }

  async getMultiplePrices(symbols: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    
    try {
      const geckoPrices = await coinGeckoClient.getCurrentPrice(symbols);
      Object.entries(geckoPrices).forEach(([symbol, price]) => {
        if (price > 0) {
          result[symbol] = price;
          this.fallbackPrices[symbol.toUpperCase()] = price;
        }
      });
    } catch {
    }
    
    symbols.forEach(symbol => {
      if (!result[symbol] || result[symbol] === 0) {
        const upper = symbol.toUpperCase();
        const fallback = this.fallbackPrices[upper] || this.fallbackPrices[upper.replace('-USD', '')];
        if (fallback) {
          result[symbol] = fallback;
        }
      }
    });
    
    return result;
  }

  async getMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
    const cleanSymbol = symbol.replace('USDT', '').replace('-USD', '').replace('/USDT', '').toUpperCase();
    
    // Try CCXT first - this is the most reliable with 9 exchanges
    try {
      const ccxtPrice = await ccxtAdapter.fetchPrice(cleanSymbol);
      if (ccxtPrice && ccxtPrice.price > 0) {
        this.fallbackPrices[cleanSymbol] = ccxtPrice.price;
        return {
          symbol: cleanSymbol,
          price: ccxtPrice.price,
          change24h: ccxtPrice.change24h || 0,
          volume24h: ccxtPrice.volume24h || 0,
          volatility: ccxtPrice.changePercent24h ? Math.abs(ccxtPrice.changePercent24h) : 0,
          timestamp: Date.now(),
        };
      }
    } catch (ccxtError) {
      // CCXT failed, try CoinGecko
    }
    
    // Try CoinGecko as backup
    try {
      const prices = await coinGeckoClient.getCurrentPrice([cleanSymbol]);
      const price = prices[cleanSymbol] || 0;
      if (price > 0) {
        this.fallbackPrices[cleanSymbol] = price;
        return {
          symbol: cleanSymbol,
          price,
          change24h: 0,
          volume24h: 0,
          volatility: 0,
          timestamp: Date.now(),
        };
      }
    } catch (geckoError) {
      // CoinGecko also failed
    }
    
    // Use fallback
    const fallbackPrice = this.fallbackPrices[cleanSymbol] || 0;
    return {
      symbol: cleanSymbol,
      price: fallbackPrice,
      change24h: 0,
      volume24h: 0,
      volatility: 0,
      timestamp: Date.now(),
    };
  }

  async getDeFiSnapshot(): Promise<DeFiSnapshot> {
    const metrics = await defiLlamaClient.getDeFiMetrics();
    
    return {
      totalTVL: metrics.totalTVL,
      topYields: metrics.topYields,
      topProtocols: metrics.topProtocols,
      timestamp: Date.now(),
    };
  }

  async getYieldOpportunities(chain?: string, limit: number = 10): Promise<YieldPool[]> {
    if (chain) {
      return defiLlamaClient.getChainYields(chain, limit);
    }
    return defiLlamaClient.getTopYields(limit);
  }

  async getStablecoinYields(limit: number = 10): Promise<YieldPool[]> {
    return defiLlamaClient.getStablecoinYields(limit);
  }

  async getProtocolTVL(protocol: string): Promise<number> {
    try {
      const data = await defiLlamaClient.getProtocol(protocol);
      return data.tvl || 0;
    } catch {
      return 0;
    }
  }

  calculateIndicators(candles: BacktestCandle[]): {
    sma20: number;
    sma50: number;
    rsi: number;
    volatility: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  } {
    if (candles.length < 50) {
      return { sma20: 0, sma50: 0, rsi: 50, volatility: 0, trend: 'neutral' };
    }

    const closes = candles.map(c => c.close);
    const last20 = closes.slice(-20);
    const last50 = closes.slice(-50);
    
    const sma20 = last20.reduce((a, b) => a + b, 0) / 20;
    const sma50 = last50.reduce((a, b) => a + b, 0) / 50;

    const gains: number[] = [];
    const losses: number[] = [];
    for (let i = 1; i < Math.min(15, closes.length); i++) {
      const change = closes[closes.length - i] - closes[closes.length - i - 1];
      if (change > 0) {
        gains.push(change);
        losses.push(0);
      } else {
        gains.push(0);
        losses.push(Math.abs(change));
      }
    }
    
    const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
    const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    const rsi = 100 - (100 / (1 + rs));

    const returns = [];
    for (let i = 1; i < last20.length; i++) {
      returns.push((last20[i] - last20[i - 1]) / last20[i - 1]);
    }
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    const volatility = Math.sqrt(variance) * Math.sqrt(365) * 100;

    let trend: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    const currentPrice = closes[closes.length - 1];
    if (currentPrice > sma20 && sma20 > sma50) {
      trend = 'bullish';
    } else if (currentPrice < sma20 && sma20 < sma50) {
      trend = 'bearish';
    }

    return { sma20, sma50, rsi, volatility, trend };
  }

  async getMarketContext(symbol: string): Promise<{
    snapshot: MarketSnapshot;
    indicators: { sma20: number; sma50: number; rsi: number; volatility: number; trend: 'bullish' | 'bearish' | 'neutral' };
    defi: DeFiSnapshot;
  }> {
    const [candles, snapshot, defi] = await Promise.all([
      this.getRecentCandles(symbol, '1h', 100),
      this.getMarketSnapshot(symbol),
      this.getDeFiSnapshot(),
    ]);

    const indicators = this.calculateIndicators(candles);

    return { snapshot, indicators, defi };
  }
}

export const marketDataService = new MarketDataService();
