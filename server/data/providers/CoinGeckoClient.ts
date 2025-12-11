import { createLimit, retry } from "../../utils/async-utils";

export interface OHLCCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface MarketData {
  id: string;
  symbol: string;
  name: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d: number;
  price_change_percentage_30d: number;
  ath: number;
  ath_change_percentage: number;
  atl: number;
  sparkline_in_7d?: { price: number[] };
}

export interface CoinInfo {
  id: string;
  symbol: string;
  name: string;
  market_data?: {
    current_price: { usd: number };
    market_cap: { usd: number };
    total_volume: { usd: number };
    price_change_percentage_24h: number;
  };
}

const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";
const CACHE_TTL = 120000; // 2 minutes cache
const OHLC_CACHE_TTL = 600000; // 10 minutes for OHLC data

// CoinGecko free tier: ~10-30 requests/minute - be conservative
const rateLimiter = createLimit(2);

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
          headers: {
            'Accept': 'application/json',
          },
        });

        if (response.status === 429) {
          throw new Error('Rate limit exceeded');
        }

        if (!response.ok) {
          throw new Error(`CoinGecko API error: ${response.status}`);
        }

        const data = await response.json();
        setCache(cacheKey, data);
        return data as T;
      },
      {
        retries: 3,
        minTimeout: 1000,
        maxTimeout: 10000,
        factor: 2,
      }
    )
  );
}

export class CoinGeckoClient {
  private coinIdMap: Map<string, string> = new Map([
    ['ETH', 'ethereum'],
    ['BTC', 'bitcoin'],
    ['USDT', 'tether'],
    ['USDC', 'usd-coin'],
    ['DAI', 'dai'],
    ['WETH', 'weth'],
    ['WBTC', 'wrapped-bitcoin'],
    ['LINK', 'chainlink'],
    ['UNI', 'uniswap'],
    ['AAVE', 'aave'],
    ['CRV', 'curve-dao-token'],
    ['LDO', 'lido-dao'],
    ['MKR', 'maker'],
    ['SNX', 'synthetix-network-token'],
    ['COMP', 'compound-governance-token'],
    ['FXS', 'frax-share'],
    ['FRAX', 'frax'],
    ['SOL', 'solana'],
    ['MATIC', 'matic-network'],
    ['ARB', 'arbitrum'],
    ['OP', 'optimism'],
    ['BASE', 'base'],
  ]);

  private resolveCoinId(symbol: string): string {
    const upperSymbol = symbol.toUpperCase().replace('-USD', '').replace('/USD', '');
    return this.coinIdMap.get(upperSymbol) || upperSymbol.toLowerCase();
  }

  async getOHLC(symbol: string, days: number = 30): Promise<OHLCCandle[]> {
    const coinId = this.resolveCoinId(symbol);
    const cacheKey = `ohlc:${coinId}:${days}`;
    
    const url = `${COINGECKO_BASE_URL}/coins/${coinId}/ohlc?vs_currency=usd&days=${days}`;
    
    try {
      const data = await fetchWithRetry<number[][]>(url, cacheKey, OHLC_CACHE_TTL);
      
      return data.map(([timestamp, open, high, low, close]) => ({
        timestamp,
        open,
        high,
        low,
        close,
      }));
    } catch (error) {
      console.error(`[CoinGecko] Failed to fetch OHLC for ${symbol}:`, error);
      throw error;
    }
  }

  async getMarketChart(symbol: string, days: number = 30): Promise<{
    prices: [number, number][];
    market_caps: [number, number][];
    total_volumes: [number, number][];
  }> {
    const coinId = this.resolveCoinId(symbol);
    const cacheKey = `chart:${coinId}:${days}`;
    
    const url = `${COINGECKO_BASE_URL}/coins/${coinId}/market_chart?vs_currency=usd&days=${days}`;
    
    return fetchWithRetry(url, cacheKey, OHLC_CACHE_TTL);
  }

  async getCurrentPrice(symbols: string[]): Promise<Record<string, number>> {
    const coinIds = symbols.map(s => this.resolveCoinId(s));
    const cacheKey = `prices:${coinIds.join(',')}`;
    
    const url = `${COINGECKO_BASE_URL}/simple/price?ids=${coinIds.join(',')}&vs_currencies=usd`;
    
    try {
      const data = await fetchWithRetry<Record<string, { usd: number }>>(url, cacheKey);
      
      const result: Record<string, number> = {};
      symbols.forEach((symbol, i) => {
        const coinId = coinIds[i];
        result[symbol] = data[coinId]?.usd || 0;
      });
      
      return result;
    } catch (error) {
      console.error(`[CoinGecko] Failed to fetch prices:`, error);
      throw error;
    }
  }

  async getMarketData(limit: number = 100): Promise<MarketData[]> {
    const cacheKey = `markets:${limit}`;
    
    const url = `${COINGECKO_BASE_URL}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${limit}&page=1&sparkline=true&price_change_percentage=24h,7d,30d`;
    
    return fetchWithRetry<MarketData[]>(url, cacheKey);
  }

  async getCoinInfo(symbol: string): Promise<CoinInfo> {
    const coinId = this.resolveCoinId(symbol);
    const cacheKey = `coin:${coinId}`;
    
    const url = `${COINGECKO_BASE_URL}/coins/${coinId}?localization=false&tickers=false&community_data=false&developer_data=false`;
    
    return fetchWithRetry<CoinInfo>(url, cacheKey);
  }

  async getTrendingCoins(): Promise<{ coins: { item: { id: string; name: string; symbol: string; market_cap_rank: number } }[] }> {
    const cacheKey = 'trending';
    const url = `${COINGECKO_BASE_URL}/search/trending`;
    
    return fetchWithRetry(url, cacheKey);
  }

  async getGlobalData(): Promise<{
    data: {
      total_market_cap: Record<string, number>;
      total_volume: Record<string, number>;
      market_cap_percentage: Record<string, number>;
      market_cap_change_percentage_24h_usd: number;
    };
  }> {
    const cacheKey = 'global';
    const url = `${COINGECKO_BASE_URL}/global`;
    
    return fetchWithRetry(url, cacheKey);
  }

  convertToBacktestCandles(ohlcData: OHLCCandle[], startDate: Date, endDate: Date): OHLCCandle[] {
    const startTs = startDate.getTime();
    const endTs = endDate.getTime();
    
    return ohlcData.filter(candle => 
      candle.timestamp >= startTs && candle.timestamp <= endTs
    );
  }
}

export const coinGeckoClient = new CoinGeckoClient();
