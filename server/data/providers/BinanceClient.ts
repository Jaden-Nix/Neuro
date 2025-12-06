import { createLimit, retry } from "../../utils/async-utils";

export interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
}

export interface Ticker24h {
  symbol: string;
  priceChange: number;
  priceChangePercent: number;
  lastPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number;
}

export interface OrderBookDepth {
  lastUpdateId: number;
  bids: [string, string][];
  asks: [string, string][];
}

const BINANCE_BASE_URL = "https://api.binance.com/api/v3";
const CACHE_TTL = 30000;
const KLINE_CACHE_TTL = 60000;

const rateLimiter = createLimit(5);
const cache = new Map<string, { data: any; timestamp: number }>();

function getCached<T>(key: string, ttl: number): T | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data as T;
  }
  return null;
}

function setCache(key: string, data: any): void {
  cache.set(key, { data, timestamp: Date.now() });
}

async function fetchWithRetry<T>(url: string, cacheKey: string, ttl: number = CACHE_TTL): Promise<T> {
  const cached = getCached<T>(cacheKey, ttl);
  if (cached) {
    return cached;
  }

  return rateLimiter(() =>
    retry(
      async () => {
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
        });

        if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        }

        if (!response.ok) {
          throw new Error(`Binance API error: ${response.status}`);
        }

        const data = await response.json();
        setCache(cacheKey, data);
        return data as T;
      },
      {
        retries: 3,
        minTimeout: 500,
        maxTimeout: 5000,
        factor: 2,
      }
    )
  );
}

export class BinanceClient {
  private symbolMap: Map<string, string> = new Map([
    ['ETH', 'ETHUSDT'],
    ['ETH-USD', 'ETHUSDT'],
    ['BTC', 'BTCUSDT'],
    ['BTC-USD', 'BTCUSDT'],
    ['SOL', 'SOLUSDT'],
    ['SOL-USD', 'SOLUSDT'],
    ['LINK', 'LINKUSDT'],
    ['UNI', 'UNIUSDT'],
    ['AAVE', 'AAVEUSDT'],
    ['CRV', 'CRVUSDT'],
    ['LDO', 'LDOUSDT'],
    ['MKR', 'MKRUSDT'],
    ['MATIC', 'MATICUSDT'],
    ['ARB', 'ARBUSDT'],
    ['OP', 'OPUSDT'],
  ]);

  private resolveSymbol(symbol: string): string {
    const upperSymbol = symbol.toUpperCase().replace('-USD', '').replace('/USD', '');
    return this.symbolMap.get(upperSymbol) || this.symbolMap.get(symbol) || `${upperSymbol}USDT`;
  }

  async getKlines(
    symbol: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d' = '1h',
    limit: number = 500
  ): Promise<Kline[]> {
    const binanceSymbol = this.resolveSymbol(symbol);
    const url = `${BINANCE_BASE_URL}/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;
    const cacheKey = `klines:${binanceSymbol}:${interval}:${limit}`;

    try {
      const data = await fetchWithRetry<any[][]>(url, cacheKey, KLINE_CACHE_TTL);

      return data.map((k) => ({
        openTime: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        closeTime: k[6],
        quoteVolume: parseFloat(k[7]),
        trades: k[8],
      }));
    } catch (error) {
      console.error(`[Binance] Failed to fetch klines for ${symbol}:`, error);
      throw error;
    }
  }

  async getHistoricalKlines(
    symbol: string,
    interval: '1m' | '5m' | '15m' | '1h' | '4h' | '1d',
    startTime: number,
    endTime: number
  ): Promise<Kline[]> {
    const binanceSymbol = this.resolveSymbol(symbol);
    const url = `${BINANCE_BASE_URL}/klines?symbol=${binanceSymbol}&interval=${interval}&startTime=${startTime}&endTime=${endTime}&limit=1000`;
    const cacheKey = `hist-klines:${binanceSymbol}:${interval}:${startTime}:${endTime}`;

    try {
      const data = await fetchWithRetry<any[][]>(url, cacheKey, KLINE_CACHE_TTL * 5);

      return data.map((k) => ({
        openTime: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        closeTime: k[6],
        quoteVolume: parseFloat(k[7]),
        trades: k[8],
      }));
    } catch (error) {
      console.error(`[Binance] Failed to fetch historical klines for ${symbol}:`, error);
      throw error;
    }
  }

  async getTicker24h(symbol: string): Promise<Ticker24h> {
    const binanceSymbol = this.resolveSymbol(symbol);
    const url = `${BINANCE_BASE_URL}/ticker/24hr?symbol=${binanceSymbol}`;
    const cacheKey = `ticker:${binanceSymbol}`;

    try {
      const data = await fetchWithRetry<any>(url, cacheKey);

      return {
        symbol: data.symbol,
        priceChange: parseFloat(data.priceChange),
        priceChangePercent: parseFloat(data.priceChangePercent),
        lastPrice: parseFloat(data.lastPrice),
        highPrice: parseFloat(data.highPrice),
        lowPrice: parseFloat(data.lowPrice),
        volume: parseFloat(data.volume),
        quoteVolume: parseFloat(data.quoteVolume),
      };
    } catch (error) {
      console.error(`[Binance] Failed to fetch ticker for ${symbol}:`, error);
      throw error;
    }
  }

  async getCurrentPrice(symbol: string): Promise<number> {
    const binanceSymbol = this.resolveSymbol(symbol);
    const url = `${BINANCE_BASE_URL}/ticker/price?symbol=${binanceSymbol}`;
    const cacheKey = `price:${binanceSymbol}`;

    try {
      const data = await fetchWithRetry<{ price: string }>(url, cacheKey);
      return parseFloat(data.price);
    } catch (error) {
      console.error(`[Binance] Failed to fetch price for ${symbol}:`, error);
      throw error;
    }
  }

  async getMultiplePrices(symbols: string[]): Promise<Record<string, number>> {
    const url = `${BINANCE_BASE_URL}/ticker/price`;
    const cacheKey = 'all-prices';

    try {
      const data = await fetchWithRetry<{ symbol: string; price: string }[]>(url, cacheKey);
      const priceMap = new Map(data.map(d => [d.symbol, parseFloat(d.price)]));

      const result: Record<string, number> = {};
      for (const symbol of symbols) {
        const binanceSymbol = this.resolveSymbol(symbol);
        result[symbol] = priceMap.get(binanceSymbol) || 0;
      }

      return result;
    } catch (error) {
      console.error(`[Binance] Failed to fetch multiple prices:`, error);
      throw error;
    }
  }

  async getOrderBook(symbol: string, limit: number = 20): Promise<OrderBookDepth> {
    const binanceSymbol = this.resolveSymbol(symbol);
    const url = `${BINANCE_BASE_URL}/depth?symbol=${binanceSymbol}&limit=${limit}`;
    const cacheKey = `depth:${binanceSymbol}:${limit}`;

    return fetchWithRetry<OrderBookDepth>(url, cacheKey);
  }

  async getVolatility(symbol: string, periods: number = 20): Promise<number> {
    const klines = await this.getKlines(symbol, '1h', periods + 1);
    
    if (klines.length < 2) return 0;

    const returns = [];
    for (let i = 1; i < klines.length; i++) {
      const ret = (klines[i].close - klines[i - 1].close) / klines[i - 1].close;
      returns.push(ret);
    }

    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance) * Math.sqrt(24 * 365) * 100;
  }

  convertToBacktestCandles(klines: Kline[]): {
    timestamp: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[] {
    return klines.map(k => ({
      timestamp: k.openTime,
      open: k.open,
      high: k.high,
      low: k.low,
      close: k.close,
      volume: k.volume,
    }));
  }
}

export const binanceClient = new BinanceClient();
