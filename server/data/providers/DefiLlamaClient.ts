import pLimit from "p-limit";
import pRetry from "p-retry";

export interface Protocol {
  id: string;
  name: string;
  symbol: string;
  chain: string;
  tvl: number;
  change_1d: number;
  change_7d: number;
  category: string;
  url?: string;
}

export interface YieldPool {
  pool: string;
  chain: string;
  project: string;
  symbol: string;
  tvlUsd: number;
  apy: number;
  apyBase: number;
  apyReward: number;
  rewardTokens: string[];
  stablecoin: boolean;
  ilRisk: string;
  exposure: string;
}

export interface ChainTVL {
  name: string;
  tvl: number;
  tokenSymbol: string;
  chainId: number;
}

export interface HistoricalTVL {
  date: number;
  tvl: number;
}

const DEFILLAMA_BASE_URL = "https://api.llama.fi";
const YIELDS_BASE_URL = "https://yields.llama.fi";
const CACHE_TTL = 300000;

const rateLimiter = pLimit(3);
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
    pRetry(
      async () => {
        const response = await fetch(url, {
          headers: { 'Accept': 'application/json' },
        });

        if (!response.ok) {
          throw new Error(`DefiLlama API error: ${response.status}`);
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

export class DefiLlamaClient {
  async getProtocols(): Promise<Protocol[]> {
    const url = `${DEFILLAMA_BASE_URL}/protocols`;
    return fetchWithRetry<Protocol[]>(url, 'protocols');
  }

  async getProtocol(slug: string): Promise<any> {
    const url = `${DEFILLAMA_BASE_URL}/protocol/${slug}`;
    return fetchWithRetry(url, `protocol:${slug}`);
  }

  async getTVL(): Promise<number> {
    const url = `${DEFILLAMA_BASE_URL}/tvl`;
    const data = await fetchWithRetry<{ tvl: number }>(url, 'total-tvl');
    return data.tvl || 0;
  }

  async getChains(): Promise<ChainTVL[]> {
    const url = `${DEFILLAMA_BASE_URL}/chains`;
    return fetchWithRetry<ChainTVL[]>(url, 'chains');
  }

  async getHistoricalTVL(protocol: string): Promise<HistoricalTVL[]> {
    const url = `${DEFILLAMA_BASE_URL}/protocol/${protocol}`;
    const data = await fetchWithRetry<{ tvl: HistoricalTVL[] }>(url, `historical:${protocol}`);
    return data.tvl || [];
  }

  async getYieldPools(chain?: string): Promise<YieldPool[]> {
    const url = `${YIELDS_BASE_URL}/pools`;
    const data = await fetchWithRetry<{ data: YieldPool[] }>(url, `yields:${chain || 'all'}`);
    
    let pools = data.data || [];
    
    if (chain) {
      pools = pools.filter(p => p.chain.toLowerCase() === chain.toLowerCase());
    }
    
    return pools.sort((a, b) => b.apy - a.apy);
  }

  async getTopYields(limit: number = 20, minTVL: number = 1000000): Promise<YieldPool[]> {
    const pools = await this.getYieldPools();
    return pools
      .filter(p => p.tvlUsd >= minTVL && p.apy > 0 && p.apy < 1000)
      .slice(0, limit);
  }

  async getStablecoinYields(limit: number = 10): Promise<YieldPool[]> {
    const pools = await this.getYieldPools();
    return pools
      .filter(p => p.stablecoin && p.apy > 0 && p.apy < 100 && p.tvlUsd >= 1000000)
      .sort((a, b) => b.apy - a.apy)
      .slice(0, limit);
  }

  async getChainYields(chain: string, limit: number = 10): Promise<YieldPool[]> {
    const pools = await this.getYieldPools(chain);
    return pools
      .filter(p => p.apy > 0 && p.apy < 500)
      .slice(0, limit);
  }

  async getProtocolsByChain(chain: string): Promise<Protocol[]> {
    const protocols = await this.getProtocols();
    return protocols
      .filter(p => p.chain?.toLowerCase() === chain.toLowerCase() || 
                   (Array.isArray(p.chain) && p.chain.some((c: string) => c.toLowerCase() === chain.toLowerCase())))
      .sort((a, b) => b.tvl - a.tvl);
  }

  async getTopProtocols(limit: number = 50): Promise<Protocol[]> {
    const protocols = await this.getProtocols();
    return protocols
      .sort((a, b) => b.tvl - a.tvl)
      .slice(0, limit);
  }

  async getDeFiMetrics(): Promise<{
    totalTVL: number;
    topProtocols: Protocol[];
    topYields: YieldPool[];
    chainBreakdown: ChainTVL[];
  }> {
    const [protocols, yields, chains] = await Promise.all([
      this.getTopProtocols(10),
      this.getTopYields(10),
      this.getChains(),
    ]);

    const totalTVL = chains.reduce((sum, c) => sum + c.tvl, 0);

    return {
      totalTVL,
      topProtocols: protocols,
      topYields: yields,
      chainBreakdown: chains.sort((a, b) => b.tvl - a.tvl).slice(0, 10),
    };
  }

  async getStakingInfo(protocol: string): Promise<any> {
    const url = `${DEFILLAMA_BASE_URL}/protocol/${protocol}`;
    return fetchWithRetry(url, `staking:${protocol}`);
  }

  formatTVL(tvl: number): string {
    if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(2)}B`;
    if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(2)}M`;
    if (tvl >= 1e3) return `$${(tvl / 1e3).toFixed(2)}K`;
    return `$${tvl.toFixed(2)}`;
  }
}

export const defiLlamaClient = new DefiLlamaClient();
