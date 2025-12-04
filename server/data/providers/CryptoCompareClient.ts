import type { LivePrice } from '@shared/schema';

interface CryptoCompareRawData {
  TYPE: string;
  MARKET: string;
  FROMSYMBOL: string;
  TOSYMBOL: string;
  PRICE: number;
  LASTUPDATE: number;
  OPEN24HOUR: number;
  HIGH24HOUR: number;
  LOW24HOUR: number;
  CHANGE24HOUR: number;
  CHANGEPCT24HOUR: number;
  VOLUME24HOUR: number;
  VOLUME24HOURTO: number;
}

interface CryptoCompareResponse {
  RAW?: Record<string, { USD?: CryptoCompareRawData }>;
  DISPLAY?: Record<string, any>;
  Response?: string;
  Message?: string;
}

class CryptoCompareClient {
  private baseUrl = 'https://min-api.cryptocompare.com/data';
  private cache: Map<string, { data: LivePrice; timestamp: number }> = new Map();
  private cacheTimeout = 30000;
  private lastFetchTime = 0;
  private rateLimitDelay = 500;

  async fetchPrices(symbols: string[]): Promise<Map<string, LivePrice>> {
    const results = new Map<string, LivePrice>();
    
    console.log(`[CryptoCompare] Fetching prices for ${symbols.length} symbols: ${symbols.slice(0, 10).join(', ')}${symbols.length > 10 ? '...' : ''}`);
    
    const now = Date.now();
    const cachedResults: string[] = [];
    const symbolsToFetch: string[] = [];
    
    for (const symbol of symbols) {
      const cached = this.cache.get(symbol.toUpperCase());
      if (cached && now - cached.timestamp < this.cacheTimeout) {
        results.set(symbol.toUpperCase(), cached.data);
        cachedResults.push(symbol);
      } else {
        symbolsToFetch.push(symbol);
      }
    }
    
    if (symbolsToFetch.length === 0) {
      return results;
    }

    const timeSinceLastFetch = now - this.lastFetchTime;
    if (timeSinceLastFetch < this.rateLimitDelay) {
      await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay - timeSinceLastFetch));
    }

    const batchSize = 30;
    for (let i = 0; i < symbolsToFetch.length; i += batchSize) {
      const batch = symbolsToFetch.slice(i, i + batchSize);
      
      try {
        const symbolList = batch.join(',');
        const response = await fetch(
          `${this.baseUrl}/pricemultifull?fsyms=${symbolList}&tsyms=USD`,
          {
            headers: {
              'Accept': 'application/json',
            },
          }
        );

        if (!response.ok) {
          console.warn(`[CryptoCompare] API returned ${response.status}`);
          continue;
        }

        const data: CryptoCompareResponse = await response.json();
        this.lastFetchTime = Date.now();
        
        if (data.Response === 'Error') {
          console.warn(`[CryptoCompare] API error: ${data.Message}`);
          continue;
        }
        
        if (!data.RAW) {
          continue;
        }

        for (const [symbol, currencyData] of Object.entries(data.RAW)) {
          const usdData = currencyData.USD;
          if (!usdData) continue;

          const livePrice: LivePrice = {
            symbol: symbol.toUpperCase(),
            price: usdData.PRICE,
            change24h: usdData.CHANGE24HOUR || 0,
            changePercent24h: usdData.CHANGEPCT24HOUR || 0,
            high24h: usdData.HIGH24HOUR || usdData.PRICE,
            low24h: usdData.LOW24HOUR || usdData.PRICE,
            volume24h: usdData.VOLUME24HOUR || 0,
            volumeUsd24h: usdData.VOLUME24HOURTO || 0,
            exchange: 'kucoin',
            timestamp: Date.now(),
          };

          results.set(symbol.toUpperCase(), livePrice);
          this.cache.set(symbol.toUpperCase(), { data: livePrice, timestamp: Date.now() });
        }
        
        if (i + batchSize < symbolsToFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      } catch (error) {
        console.warn('[CryptoCompare] Failed to fetch batch:', error);
      }
    }
    
    const liveCount = Array.from(results.values()).filter(p => p.changePercent24h !== 0).length;
    console.log(`[CryptoCompare] Got prices for ${results.size}/${symbols.length} tokens (${liveCount} with 24h data)`);
    
    return results;
  }

  async getPrice(symbol: string): Promise<LivePrice | null> {
    const results = await this.fetchPrices([symbol]);
    return results.get(symbol.toUpperCase()) || null;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/price?fsym=BTC&tsyms=USD`, {
        headers: { 'Accept': 'application/json' },
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const cryptoCompareClient = new CryptoCompareClient();
