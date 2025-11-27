import { Connection, PublicKey, LAMPORTS_PER_SOL, clusterApiUrl } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, AccountLayout } from "@solana/spl-token";

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateBackoffDelay(attempt: number, config: RetryConfig = DEFAULT_RETRY_CONFIG): number {
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  const jitter = exponentialDelay * 0.25 * Math.random();
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

async function withRetry<T>(
  fn: () => Promise<T>,
  operationName: string,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt === config.maxRetries) {
        console.error(`[Solana RPC] ${operationName} failed after ${attempt + 1} attempts:`, lastError.message);
        throw lastError;
      }
      
      const delay = calculateBackoffDelay(attempt, config);
      console.warn(`[Solana RPC] ${operationName} attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms`);
      await sleep(delay);
    }
  }
  
  throw lastError || new Error(`${operationName} failed with unknown error`);
}

export interface JupiterQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  routePlan: Array<{
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }>;
  slippageBps: number;
  otherAmountThreshold: string;
}

export interface MarinadeMetrics {
  totalStakedSol: number;
  msolPrice: number;
  apy: number;
  validatorCount: number;
  totalMsolSupply: number;
}

export interface OrcaPoolMetrics {
  poolAddress: string;
  tokenA: string;
  tokenB: string;
  tokenAAmount: number;
  tokenBAmount: number;
  tvlUsd: number;
  volumeUsd24h: number;
  feeApr: number;
  tickSpacing: number;
}

export interface SolanaTokenBalance {
  mint: string;
  symbol?: string;
  amount: number;
  decimals: number;
  usdValue?: number;
}

export interface SolanaOnChainMetrics {
  walletBalanceSol: number;
  tokenBalances: SolanaTokenBalance[];
  totalValueUsd: number;
  solPriceUsd: number;
  slot: number;
  timestamp: number;
}

export const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  "So11111111111111111111111111111111111111112": { symbol: "SOL", decimals: 9 },
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { symbol: "USDC", decimals: 6 },
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { symbol: "USDT", decimals: 6 },
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": { symbol: "mSOL", decimals: 9 },
  "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj": { symbol: "stSOL", decimals: 9 },
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": { symbol: "BONK", decimals: 5 },
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN": { symbol: "JUP", decimals: 6 },
  "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE": { symbol: "ORCA", decimals: 6 },
  "MNDEFzGvMt87ueuHvVU9VcTqsAP5b3fTGPsHuuPA5ey": { symbol: "MNDE", decimals: 9 },
};

export class SolanaRPCClient {
  private connection: Connection;
  private heliusApiKey: string | undefined;
  private jupiterApiUrl: string;
  private marinadeApiUrl: string;
  private cachedSolPrice: { price: number; timestamp: number } | null = null;
  private readonly PRICE_CACHE_TTL_MS = 60000;

  constructor() {
    this.heliusApiKey = process.env.HELIUS_API_KEY;
    
    const rpcUrl = this.heliusApiKey
      ? `https://mainnet.helius-rpc.com/?api-key=${this.heliusApiKey}`
      : process.env.SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");
    
    this.connection = new Connection(rpcUrl, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout: 60000,
    });
    
    this.jupiterApiUrl = "https://lite-api.jup.ag/swap/v1";
    this.marinadeApiUrl = "https://api.marinade.finance";
    
    console.log(`[Solana RPC] Initialized with ${this.heliusApiKey ? 'Helius' : 'public'} endpoint`);
  }

  async getWalletBalance(address: string): Promise<number> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await withRetry(
        () => this.connection.getBalance(publicKey),
        `getBalance(${address})`
      );
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      console.error(`[Solana RPC] Failed to get balance for ${address}:`, error);
      return 0;
    }
  }

  async getTokenBalances(address: string): Promise<SolanaTokenBalance[]> {
    try {
      const publicKey = new PublicKey(address);
      const tokenAccounts = await withRetry(
        () => this.connection.getTokenAccountsByOwner(publicKey, {
          programId: TOKEN_PROGRAM_ID,
        }),
        `getTokenAccounts(${address})`
      );

      const balances: SolanaTokenBalance[] = [];

      for (const { account } of tokenAccounts.value) {
        const data = AccountLayout.decode(account.data);
        const mint = new PublicKey(data.mint).toString();
        const amount = Number(data.amount);
        
        const tokenInfo = KNOWN_TOKENS[mint];
        const decimals = tokenInfo?.decimals || 9;
        const adjustedAmount = amount / Math.pow(10, decimals);

        if (adjustedAmount > 0) {
          balances.push({
            mint,
            symbol: tokenInfo?.symbol,
            amount: adjustedAmount,
            decimals,
          });
        }
      }

      return balances;
    } catch (error) {
      console.error(`[Solana RPC] Failed to get token balances for ${address}:`, error);
      return [];
    }
  }

  async getSOLUSDPrice(): Promise<number> {
    if (this.cachedSolPrice && (Date.now() - this.cachedSolPrice.timestamp) < this.PRICE_CACHE_TTL_MS) {
      return this.cachedSolPrice.price;
    }

    try {
      const quote = await this.getJupiterQuote(
        "So11111111111111111111111111111111111111112",
        "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
        1 * LAMPORTS_PER_SOL
      );

      if (quote) {
        const price = parseInt(quote.outAmount) / 1e6;
        this.cachedSolPrice = { price, timestamp: Date.now() };
        return price;
      }
    } catch (error) {
      console.error("[Solana RPC] Failed to get SOL price from Jupiter:", error);
    }

    return this.cachedSolPrice?.price || 100;
  }

  async getJupiterQuote(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<JupiterQuote | null> {
    try {
      const params = new URLSearchParams({
        inputMint,
        outputMint,
        amount: amount.toString(),
        slippageBps: slippageBps.toString(),
      });

      const response = await withRetry(
        () => fetch(`${this.jupiterApiUrl}/quote?${params}`),
        "getJupiterQuote"
      );

      if (!response.ok) {
        throw new Error(`Jupiter API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error("[Solana RPC] Failed to get Jupiter quote:", error);
      return null;
    }
  }

  async getJupiterSwapRoute(
    inputMint: string,
    outputMint: string,
    amount: number,
    slippageBps: number = 50
  ): Promise<{
    quote: JupiterQuote | null;
    priceImpact: number;
    routeDescription: string;
  }> {
    const quote = await this.getJupiterQuote(inputMint, outputMint, amount, slippageBps);
    
    if (!quote) {
      return { quote: null, priceImpact: 0, routeDescription: "No route found" };
    }

    const routeDescription = quote.routePlan
      .map((step) => `${step.swapInfo.label} (${step.percent}%)`)
      .join(" -> ");

    return {
      quote,
      priceImpact: quote.priceImpactPct,
      routeDescription,
    };
  }

  async getMarinadeMetrics(): Promise<MarinadeMetrics> {
    try {
      const response = await withRetry(
        () => fetch(`${this.marinadeApiUrl}/tlv`),
        "getMarinadeMetrics"
      );

      if (!response.ok) {
        throw new Error(`Marinade API error: ${response.status}`);
      }

      const data = await response.json();
      
      const validatorsResponse = await fetch("https://validators-api.marinade.finance/validators");
      const validatorsData = validatorsResponse.ok ? await validatorsResponse.json() : { validators: [] };

      return {
        totalStakedSol: data.total_staked_sol || 0,
        msolPrice: data.msol_price || 1.0,
        apy: data.apy || 7.0,
        validatorCount: validatorsData.validators?.length || 100,
        totalMsolSupply: data.msol_supply || 0,
      };
    } catch (error) {
      console.error("[Solana RPC] Failed to get Marinade metrics:", error);
      return {
        totalStakedSol: 0,
        msolPrice: 1.0,
        apy: 7.0,
        validatorCount: 100,
        totalMsolSupply: 0,
      };
    }
  }

  async getOrcaPoolMetrics(poolAddress: string): Promise<OrcaPoolMetrics | null> {
    try {
      const poolPubkey = new PublicKey(poolAddress);
      const accountInfo = await withRetry(
        () => this.connection.getAccountInfo(poolPubkey),
        `getOrcaPool(${poolAddress})`
      );

      if (!accountInfo) {
        return null;
      }

      return {
        poolAddress,
        tokenA: "SOL",
        tokenB: "USDC",
        tokenAAmount: 0,
        tokenBAmount: 0,
        tvlUsd: 0,
        volumeUsd24h: 0,
        feeApr: 0,
        tickSpacing: 64,
      };
    } catch (error) {
      console.error(`[Solana RPC] Failed to get Orca pool metrics for ${poolAddress}:`, error);
      return null;
    }
  }

  async getTopOrcaPools(): Promise<OrcaPoolMetrics[]> {
    const knownPools = [
      "HJPjoWUrhoZzkNfRpHuieeFk9WcZWjwy6PBjZ81ngndJ",
      "5P6n5omLbLbP4kaPGL8etqQAHEX3qXY8mNQvQ4vXJCJg",
      "7qbRF6YsyGuLUVs6Y1q64bdVrfe4ZcUUz1JRdoVNUJnm",
    ];

    const pools: OrcaPoolMetrics[] = [];
    
    for (const poolAddress of knownPools) {
      const metrics = await this.getOrcaPoolMetrics(poolAddress);
      if (metrics) {
        pools.push(metrics);
      }
    }

    return pools;
  }

  async getOnChainMetrics(walletAddress?: string): Promise<SolanaOnChainMetrics> {
    const [solPrice, slot] = await Promise.all([
      this.getSOLUSDPrice(),
      this.connection.getSlot(),
    ]);

    let walletBalanceSol = 0;
    let tokenBalances: SolanaTokenBalance[] = [];
    let totalValueUsd = 0;

    if (walletAddress) {
      [walletBalanceSol, tokenBalances] = await Promise.all([
        this.getWalletBalance(walletAddress),
        this.getTokenBalances(walletAddress),
      ]);

      totalValueUsd = walletBalanceSol * solPrice;
      
      for (const token of tokenBalances) {
        if (token.symbol === "USDC" || token.symbol === "USDT") {
          totalValueUsd += token.amount;
        } else if (token.symbol === "mSOL" || token.symbol === "stSOL") {
          totalValueUsd += token.amount * solPrice;
        }
      }
    }

    return {
      walletBalanceSol,
      tokenBalances,
      totalValueUsd,
      solPriceUsd: solPrice,
      slot,
      timestamp: Date.now(),
    };
  }

  async getSlot(): Promise<number> {
    return this.connection.getSlot();
  }

  async getRecentBlockhash(): Promise<string> {
    const { blockhash } = await this.connection.getLatestBlockhash();
    return blockhash;
  }

  async getTransactionHistory(
    address: string,
    limit: number = 10
  ): Promise<Array<{ signature: string; slot: number; err: any }>> {
    try {
      const publicKey = new PublicKey(address);
      const signatures = await withRetry(
        () => this.connection.getSignaturesForAddress(publicKey, { limit }),
        `getTransactionHistory(${address})`
      );

      return signatures.map((sig) => ({
        signature: sig.signature,
        slot: sig.slot,
        err: sig.err,
      }));
    } catch (error) {
      console.error(`[Solana RPC] Failed to get transaction history for ${address}:`, error);
      return [];
    }
  }

  async monitorWalletHealth(address: string): Promise<{
    isHealthy: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];

    try {
      const balance = await this.getWalletBalance(address);
      
      if (balance < 0.01) {
        issues.push("Low SOL balance - may not cover transaction fees");
      }

      if (balance < 0.001) {
        issues.push("Critical: Insufficient SOL for any transactions");
      }

      const recentTxs = await this.getTransactionHistory(address, 5);
      const failedTxs = recentTxs.filter((tx) => tx.err !== null);
      
      if (failedTxs.length > 2) {
        issues.push(`High transaction failure rate: ${failedTxs.length}/5 recent transactions failed`);
      }

    } catch (error) {
      issues.push(`Unable to assess wallet health: ${error}`);
    }

    return {
      isHealthy: issues.length === 0,
      issues,
    };
  }

  getConnection(): Connection {
    return this.connection;
  }
}

export const solanaRpcClient = new SolanaRPCClient();
