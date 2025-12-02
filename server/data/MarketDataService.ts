import { coinGeckoClient, type OHLCCandle } from './providers/CoinGeckoClient';
import { binanceClient, type Kline } from './providers/BinanceClient';
import { defiLlamaClient, type YieldPool, type Protocol } from './providers/DefiLlamaClient';

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
      const klines = await binanceClient.getKlines(symbol, interval, limit);
      return binanceClient.convertToBacktestCandles(klines);
    } catch (error) {
      console.warn(`[MarketData] Binance failed for recent candles, using CoinGecko`);
      
      const days = interval === '1d' ? limit : Math.ceil(limit / 24);
      const ohlcData = await coinGeckoClient.getOHLC(symbol, Math.min(days, 30));
      
      return ohlcData.map(c => ({
        ...c,
        volume: 100000,
      }));
    }
  }

  private fallbackPrices: Record<string, number> = {
    'BTC': 96000,
    'BTC-USD': 96000,
    'BTCUSDT': 96000,
    'ETH': 3600,
    'ETH-USD': 3600,
    'ETHUSDT': 3600,
    'SOL': 230,
    'SOL-USD': 230,
    'SOLUSDT': 230,
    'LINK': 25,
    'LINK-USD': 25,
    'LINKUSDT': 25,
    'UNI': 15,
    'UNI-USD': 15,
    'UNIUSDT': 15,
    'AAVE': 350,
    'AAVE-USD': 350,
    'AAVEUSDT': 350,
  };

  async getCurrentPrice(symbol: string): Promise<number> {
    const upperSymbol = symbol.toUpperCase();
    
    try {
      const price = await binanceClient.getCurrentPrice(symbol);
      if (price > 0) {
        this.fallbackPrices[upperSymbol] = price;
        return price;
      }
    } catch (binanceError) {
      console.warn(`[MarketData] Binance price fetch failed for ${symbol}`);
    }
    
    try {
      const prices = await coinGeckoClient.getCurrentPrice([symbol]);
      const price = prices[symbol];
      if (price && price > 0) {
        this.fallbackPrices[upperSymbol] = price;
        return price;
      }
    } catch (geckoError) {
      console.warn(`[MarketData] CoinGecko price fetch failed for ${symbol}`);
    }
    
    const fallback = this.fallbackPrices[upperSymbol] || this.fallbackPrices[upperSymbol.replace('-USD', '')];
    if (fallback) {
      console.log(`[MarketData] Using fallback price for ${symbol}: $${fallback}`);
      return fallback;
    }
    
    console.error(`[MarketData] No price available for ${symbol}`);
    return 0;
  }

  async getMultiplePrices(symbols: string[]): Promise<Record<string, number>> {
    const result: Record<string, number> = {};
    
    try {
      const binancePrices = await binanceClient.getMultiplePrices(symbols);
      Object.entries(binancePrices).forEach(([symbol, price]) => {
        if (price > 0) {
          result[symbol] = price;
          this.fallbackPrices[symbol.toUpperCase()] = price;
        }
      });
      if (Object.keys(result).length === symbols.length) {
        return result;
      }
    } catch {
      console.warn(`[MarketData] Binance multiple prices fetch failed`);
    }
    
    const missingSymbols = symbols.filter(s => !result[s]);
    if (missingSymbols.length > 0) {
      try {
        const geckoPrices = await coinGeckoClient.getCurrentPrice(missingSymbols);
        Object.entries(geckoPrices).forEach(([symbol, price]) => {
          if (price > 0) {
            result[symbol] = price;
            this.fallbackPrices[symbol.toUpperCase()] = price;
          }
        });
      } catch {
        console.warn(`[MarketData] CoinGecko multiple prices fetch failed`);
      }
    }
    
    symbols.forEach(symbol => {
      if (!result[symbol] || result[symbol] === 0) {
        const upper = symbol.toUpperCase();
        const fallback = this.fallbackPrices[upper] || this.fallbackPrices[upper.replace('-USD', '')];
        if (fallback) {
          result[symbol] = fallback;
          console.log(`[MarketData] Using fallback price for ${symbol}: $${fallback}`);
        }
      }
    });
    
    return result;
  }

  async getMarketSnapshot(symbol: string): Promise<MarketSnapshot> {
    try {
      const [ticker, volatility] = await Promise.all([
        binanceClient.getTicker24h(symbol),
        binanceClient.getVolatility(symbol, 20),
      ]);

      return {
        symbol,
        price: ticker.lastPrice,
        change24h: ticker.priceChangePercent,
        volume24h: ticker.quoteVolume,
        volatility,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.warn(`[MarketData] Failed to get snapshot for ${symbol}:`, error);
      
      const prices = await coinGeckoClient.getCurrentPrice([symbol]);
      return {
        symbol,
        price: prices[symbol] || 0,
        change24h: 0,
        volume24h: 0,
        volatility: 0,
        timestamp: Date.now(),
      };
    }
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
