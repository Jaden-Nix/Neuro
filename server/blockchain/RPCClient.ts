import { createPublicClient, http, formatEther, parseAbi } from "viem";
import { mainnet, base, fraxtal } from "viem/chains";

/**
 * Retry configuration for RPC calls
 */
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

/**
 * Sleep utility for delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay with exponential backoff and jitter
 */
function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
  // Exponential backoff: baseDelay * (multiplier ^ attempt)
  const exponentialDelay = config.baseDelayMs * Math.pow(config.backoffMultiplier, attempt);
  
  // Add jitter (0-25% random variation) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * Math.random();
  
  // Clamp to max delay
  return Math.min(exponentialDelay + jitter, config.maxDelayMs);
}

/**
 * Execute a function with exponential backoff retry
 */
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
      
      // Check if error is retryable
      const isRetryable = isRetryableError(lastError);
      
      if (!isRetryable || attempt === config.maxRetries) {
        console.error(
          `[RPC] ${operationName} failed after ${attempt + 1} attempts:`,
          lastError.message
        );
        throw lastError;
      }
      
      const delay = calculateBackoffDelay(attempt, config);
      console.warn(
        `[RPC] ${operationName} attempt ${attempt + 1} failed, retrying in ${Math.round(delay)}ms:`,
        lastError.message
      );
      
      await sleep(delay);
    }
  }
  
  // This should never be reached, but TypeScript needs it
  throw lastError || new Error(`${operationName} failed with unknown error`);
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Network-related errors (retryable)
  const retryablePatterns = [
    "timeout",
    "econnreset",
    "econnrefused",
    "socket hang up",
    "network",
    "rate limit",
    "429",
    "503",
    "502",
    "504",
    "too many requests",
    "temporarily unavailable",
    "service unavailable",
  ];
  
  // Non-retryable errors
  const nonRetryablePatterns = [
    "invalid",
    "not found",
    "revert",
    "execution reverted",
    "insufficient",
    "nonce",
    "already known",
  ];
  
  // Check if it's explicitly non-retryable
  if (nonRetryablePatterns.some((pattern) => message.includes(pattern))) {
    return false;
  }
  
  // Check if it's explicitly retryable
  if (retryablePatterns.some((pattern) => message.includes(pattern))) {
    return true;
  }
  
  // Default: retry unknown errors (they might be transient)
  return true;
}

// Uniswap V3 Pool ABI (minimal for slot0 and liquidity)
const UNISWAP_V3_POOL_ABI = parseAbi([
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() external view returns (uint128)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
]);

// ERC20 ABI for token decimals and symbols
const ERC20_ABI = parseAbi([
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function balanceOf(address) external view returns (uint256)",
]);

// Aave V3 Pool ABI for reserve data
const AAVE_V3_POOL_ABI = parseAbi([
  "function getReserveData(address asset) external view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)",
]);

// Chainlink Price Feed ABI
const CHAINLINK_AGGREGATOR_V3_ABI = parseAbi([
  "function latestRoundData() external view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() external view returns (uint8)",
]);

export interface ChainConfig {
  chainId: number;
  name: string;
  rpcUrl: string;
  nativeSymbol: string;
}

export interface OnChainMetrics {
  walletBalance: string;
  totalTVL: string;
  currentAPY: number;
  riskLevel: number;
  activeOpportunities: number;
  pendingTransactions: number;
  gasPrice: string;
  timestamp: number;
}

export class BlockchainRPCClient {
  private clients: Map<number, ReturnType<typeof createPublicClient>>;
  private chainConfigs: ChainConfig[];

  constructor() {
    // Initialize chain configurations
    this.chainConfigs = [
      {
        chainId: mainnet.id,
        name: "Ethereum",
        rpcUrl: process.env.ETHEREUM_RPC_URL || "https://eth.llamarpc.com",
        nativeSymbol: "ETH",
      },
      {
        chainId: base.id,
        name: "Base",
        rpcUrl: process.env.BASE_RPC_URL || "https://mainnet.base.org",
        nativeSymbol: "ETH",
      },
      {
        chainId: fraxtal.id,
        name: "Fraxtal",
        rpcUrl: process.env.FRAXTAL_RPC_URL || "https://rpc.frax.com",
        nativeSymbol: "frxETH",
      },
    ];

    // Create public clients for each chain
    this.clients = new Map();
    
    this.clients.set(
      mainnet.id,
      createPublicClient({
        chain: mainnet,
        transport: http(this.chainConfigs[0].rpcUrl),
      })
    );

    this.clients.set(
      base.id,
      createPublicClient({
        chain: base,
        transport: http(this.chainConfigs[1].rpcUrl),
      })
    );

    this.clients.set(
      fraxtal.id,
      createPublicClient({
        chain: fraxtal,
        transport: http(this.chainConfigs[2].rpcUrl),
      })
    );
  }

  /**
   * Fetch wallet balance across all chains with retry logic
   */
  async getWalletBalance(address?: `0x${string}`): Promise<bigint> {
    if (!address) {
      // Return 0 if no wallet connected
      return BigInt(0);
    }

    let totalBalance = BigInt(0);

    const clientEntries = Array.from(this.clients.entries());
    for (const [chainId, client] of clientEntries) {
      try {
        const balance = await withRetry(
          () => client.getBalance({ address }),
          `getBalance(chain=${chainId})`
        );
        totalBalance += balance;
      } catch (error) {
        console.error(`Failed to fetch balance on chain ${chainId}:`, error);
        // Continue with other chains even if one fails
      }
    }

    return totalBalance;
  }

  /**
   * Get TVL from major liquidity pools (Uniswap V3 ETH/USDC example) with retry logic
   */
  async getTotalValueLocked(): Promise<bigint> {
    const client = this.clients.get(mainnet.id);
    if (!client) return BigInt(0);

    // Uniswap V3 ETH/USDC 0.05% pool on Ethereum
    const POOL_ADDRESS = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";

    try {
      const liquidity = await withRetry(
        () => client.readContract({
          address: POOL_ADDRESS,
          abi: UNISWAP_V3_POOL_ABI,
          functionName: "liquidity",
        }),
        "getTVL.liquidity"
      );

      const slot0 = await withRetry(
        () => client.readContract({
          address: POOL_ADDRESS,
          abi: UNISWAP_V3_POOL_ABI,
          functionName: "slot0",
        }),
        "getTVL.slot0"
      );

      // Simplified TVL calculation (liquidity * sqrt price)
      // In production, this would need proper math for accurate TVL
      const sqrtPriceX96 = slot0[0];
      // Use bit shifting instead of exponentiation: 2^96 = 1 << 96
      const divisor = BigInt(1) << BigInt(96);
      const tvlEstimate = (liquidity * sqrtPriceX96) / divisor;

      return tvlEstimate;
    } catch (error) {
      console.error("Failed to fetch TVL:", error);
      return BigInt(0);
    }
  }

  /**
   * Get current gas prices across chains with retry logic
   */
  async getGasPrices(): Promise<Map<number, bigint>> {
    const gasPrices = new Map<number, bigint>();

    const clientEntries = Array.from(this.clients.entries());
    for (const [chainId, client] of clientEntries) {
      try {
        const gasPrice = await withRetry(
          () => client.getGasPrice(),
          `getGasPrice(chain=${chainId})`
        );
        gasPrices.set(chainId, gasPrice);
      } catch (error) {
        console.error(`Failed to fetch gas price on chain ${chainId}:`, error);
        // Continue with other chains even if one fails
      }
    }

    return gasPrices;
  }

  /**
   * Fetch real APY from Aave V3 protocol with retry logic
   */
  async getAaveV3APY(): Promise<number> {
    const client = this.clients.get(mainnet.id);
    if (!client) return 0;

    // Aave V3 Pool address on Ethereum mainnet
    const AAVE_V3_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
    // USDC address on Ethereum
    const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

    try {
      const reserveData = await withRetry(
        () => client.readContract({
          address: AAVE_V3_POOL,
          abi: AAVE_V3_POOL_ABI,
          functionName: "getReserveData",
          args: [USDC_ADDRESS],
        }),
        "getAaveV3APY.getReserveData"
      );

      // currentLiquidityRate is at index 2 (uint128)
      const liquidityRate = reserveData[2];
      
      // Aave rates are in Ray units (1e27)
      // Convert to APY: (rate / 1e27) * 100
      const RAY = BigInt(10) ** BigInt(27);
      const apyDecimal = Number(liquidityRate) / Number(RAY);
      const apy = apyDecimal * 100;

      return apy;
    } catch (error) {
      console.error("Failed to fetch Aave V3 APY:", error);
      // Fallback to 0 if fetch fails
      return 0;
    }
  }

  /**
   * Calculate aggregate APY from multiple yield sources
   */
  async calculateAPY(): Promise<number> {
    try {
      // Fetch real APY from Aave V3
      const aaveAPY = await this.getAaveV3APY();
      
      // In production, would aggregate from multiple protocols (Compound, Yearn, etc.)
      // For now, return Aave APY as primary source
      return aaveAPY;
    } catch (error) {
      console.error("Failed to calculate APY:", error);
      return 0;
    }
  }

  /**
   * Fetch ETH/USD price from Chainlink Price Feed with retry logic
   */
  async getETHUSDPrice(): Promise<number> {
    const client = this.clients.get(mainnet.id);
    if (!client) return 0;

    // Chainlink ETH/USD Price Feed on Ethereum mainnet
    const ETH_USD_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";

    try {
      const result = await withRetry(
        () => client.readContract({
          address: ETH_USD_FEED,
          abi: CHAINLINK_AGGREGATOR_V3_ABI,
          functionName: "latestRoundData",
        }),
        "getETHUSDPrice.latestRoundData"
      );

      // Extract answer (second element)
      const answer = result[1];
      
      // Chainlink ETH/USD has 8 decimals
      const price = Number(answer) / 1e8;
      return price;
    } catch (error) {
      console.error("Failed to fetch Chainlink ETH/USD price:", error);
      // Fallback price - would use a secondary oracle in production
      return 2000;
    }
  }

  /**
   * Get gas price in Gwei (proper units for simulation) with retry logic
   */
  async getGasPriceGwei(chainId: number = mainnet.id): Promise<number> {
    const client = this.clients.get(chainId);
    if (!client) return 20;

    try {
      const gasPrice = await withRetry(
        () => client.getGasPrice(),
        `getGasPriceGwei(chain=${chainId})`
      );
      // Convert wei to gwei (1 gwei = 1e9 wei)
      return Number(gasPrice) / 1e9;
    } catch (error) {
      console.error(`Failed to fetch gas price in gwei on chain ${chainId}:`, error);
      return 20; // Fallback to typical mainnet gas
    }
  }

  /**
   * Get comprehensive on-chain metrics
   */
  async getOnChainMetrics(walletAddress?: `0x${string}`): Promise<OnChainMetrics> {
    const [walletBalance, tvl, apy, gasPrices] = await Promise.all([
      this.getWalletBalance(walletAddress),
      this.getTotalValueLocked(),
      this.calculateAPY(),
      this.getGasPrices(),
    ]);

    // Calculate average gas price across chains
    const gasPriceValues = Array.from(gasPrices.values());
    const totalGasPrice = gasPriceValues.reduce(
      (sum, price) => sum + price,
      BigInt(0)
    );
    const avgGasPrice = gasPriceValues.length > 0 
      ? totalGasPrice / BigInt(gasPriceValues.length)
      : BigInt(0);

    // Estimate risk level based on gas prices and volatility
    const gasRisk = Number(avgGasPrice) / 1e9 > 50 ? 20 : 10; // High gas = higher risk
    const baseRisk = 25;
    const riskLevel = Math.min(100, gasRisk + baseRisk);

    return {
      walletBalance: formatEther(walletBalance),
      totalTVL: formatEther(tvl),
      currentAPY: apy,
      riskLevel,
      activeOpportunities: Math.floor(Math.random() * 5) + 3, // Mock for now
      pendingTransactions: 0,
      gasPrice: formatEther(avgGasPrice),
      timestamp: Date.now(),
    };
  }

  /**
   * Monitor wallet health for Sentinel system
   */
  async monitorWalletHealth(address?: `0x${string}`): Promise<{
    isHealthy: boolean;
    issues: string[];
  }> {
    if (!address) {
      return {
        isHealthy: true,
        issues: ["No wallet connected"],
      };
    }

    const issues: string[] = [];
    const balance = await this.getWalletBalance(address);
    const gasPrices = await this.getGasPrices();

    // Check if balance is too low
    const minBalance = BigInt(100000000000000000); // 0.1 ETH
    if (balance < minBalance) {
      issues.push("Low wallet balance - may not cover gas fees");
    }

    // Check for extremely high gas prices
    const gasPriceArray = Array.from(gasPrices.entries());
    const highGasThreshold = BigInt(100000000000); // 100 gwei
    for (const [chainId, gasPrice] of gasPriceArray) {
      if (gasPrice > highGasThreshold) {
        const chainName = this.chainConfigs.find((c) => c.chainId === chainId)?.name;
        issues.push(`High gas prices on ${chainName}: ${formatEther(gasPrice)} ETH`);
      }
    }

    return {
      isHealthy: issues.length === 0,
      issues,
    };
  }

  /**
   * Get block number for a specific chain
   */
  async getBlockNumber(chainId: number): Promise<bigint> {
    const client = this.clients.get(chainId);
    if (!client) {
      throw new Error(`No client found for chain ${chainId}`);
    }

    return await client.getBlockNumber();
  }
}

export const rpcClient = new BlockchainRPCClient();
