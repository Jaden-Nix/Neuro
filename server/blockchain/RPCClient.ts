import { createPublicClient, http, formatEther, parseAbi } from "viem";
import { sepolia, baseSepolia, fraxtal, mainnet } from "viem/chains";
import { marketDataService } from "../data/MarketDataService";

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

function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): number {
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
  
  throw lastError || new Error(`${operationName} failed with unknown error`);
}

function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  const retryablePatterns = [
    "timeout", "econnreset", "econnrefused", "socket hang up",
    "network", "rate limit", "429", "503", "502", "504",
    "too many requests", "temporarily unavailable", "service unavailable",
  ];
  
  const nonRetryablePatterns = [
    "invalid", "not found", "revert", "execution reverted",
    "insufficient", "nonce", "already known",
  ];
  
  if (nonRetryablePatterns.some((pattern) => message.includes(pattern))) {
    return false;
  }
  
  if (retryablePatterns.some((pattern) => message.includes(pattern))) {
    return true;
  }
  
  return true;
}

const UNISWAP_V3_POOL_ABI = parseAbi([
  "function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)",
  "function liquidity() external view returns (uint128)",
  "function token0() external view returns (address)",
  "function token1() external view returns (address)",
]);

const ERC20_ABI = parseAbi([
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function balanceOf(address) external view returns (uint256)",
]);

const AAVE_V3_POOL_ABI = parseAbi([
  "function getReserveData(address asset) external view returns (uint256 configuration, uint128 liquidityIndex, uint128 currentLiquidityRate, uint128 variableBorrowIndex, uint128 currentVariableBorrowRate, uint128 currentStableBorrowRate, uint40 lastUpdateTimestamp, uint16 id, address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress, address interestRateStrategyAddress, uint128 accruedToTreasury, uint128 unbacked, uint128 isolationModeTotalDebt)",
]);

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
  walletBalanceEth: number;
  tvlUsd: number;
  currentAPY: number;
  riskLevel: number;
  activeOpportunities: number;
  pendingTransactions: number;
  gasPriceGwei: number;
  ethPriceUsd: number;
  timestamp: number;
}

interface ChainlinkRoundData {
  roundId: bigint;
  answer: bigint;
  startedAt: bigint;
  updatedAt: bigint;
  answeredInRound: bigint;
}

const CHAINLINK_MAX_STALENESS_SECONDS = 3600;

export class BlockchainRPCClient {
  private clients: Map<number, ReturnType<typeof createPublicClient>>;
  private chainConfigs: ChainConfig[];
  private cachedEthPrice: { price: number; timestamp: number } | null = null;
  private readonly PRICE_CACHE_TTL_MS = 60000;

  constructor() {
    this.chainConfigs = [
      {
        chainId: sepolia.id,
        name: "Ethereum Sepolia",
        rpcUrl: process.env.ETHEREUM_RPC_URL || "https://gateway.tenderly.co/public/sepolia",
        nativeSymbol: "ETH",
      },
      {
        chainId: baseSepolia.id,
        name: "Base Sepolia",
        rpcUrl: process.env.BASE_RPC_URL || "https://sepolia.base.org",
        nativeSymbol: "ETH",
      },
      {
        chainId: fraxtal.id,
        name: "Fraxtal",
        rpcUrl: process.env.FRAXTAL_RPC_URL || "https://rpc.frax.com",
        nativeSymbol: "frxETH",
      },
    ];

    this.clients = new Map();
    
    this.clients.set(
      sepolia.id,
      createPublicClient({
        chain: sepolia,
        transport: http(this.chainConfigs[0].rpcUrl),
      })
    );

    this.clients.set(
      baseSepolia.id,
      createPublicClient({
        chain: baseSepolia,
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

  async getWalletBalance(address?: `0x${string}`): Promise<bigint> {
    if (!address) {
      return BigInt(0);
    }

    let totalBalance = BigInt(0);

    const clientEntries = Array.from(this.clients.entries());
    for (const [chainId, client] of clientEntries) {
      try {
        const balance = await withRetry(
          () => client.getBalance({ address }),
          `getBalance(chain=${chainId})`
        ) as bigint;
        totalBalance += balance;
      } catch (error) {
        console.error(`Failed to fetch balance on chain ${chainId}:`, error);
      }
    }

    return totalBalance;
  }

  async getTVLInUSD(): Promise<number> {
    try {
      const defiSnapshot = await marketDataService.getDeFiSnapshot();
      if (defiSnapshot.totalTVL > 0) {
        return defiSnapshot.totalTVL;
      }
    } catch (error) {
      console.warn("[RPC] MarketDataService TVL fetch failed, trying blockchain fallback");
    }

    const client = this.clients.get(mainnet.id) || this.clients.get(sepolia.id);
    if (!client) return 0;

    const POOL_ADDRESS = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640" as `0x${string}`;
    const WETH_ADDRESS = "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" as `0x${string}`;
    const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as `0x${string}`;

    try {
      const [wethBalance, usdcBalance, ethPrice] = await Promise.all([
        withRetry(
          () => client.readContract({
            address: WETH_ADDRESS,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [POOL_ADDRESS],
          }),
          "getTVL.wethBalance"
        ) as Promise<bigint>,
        withRetry(
          () => client.readContract({
            address: USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [POOL_ADDRESS],
          }),
          "getTVL.usdcBalance"
        ) as Promise<bigint>,
        this.getETHUSDPrice(),
      ]);

      const wethEth = parseFloat(formatEther(wethBalance));
      const wethValueUsd = wethEth * ethPrice;
      const usdcValueUsd = Number(usdcBalance / BigInt(1e6)) + Number(usdcBalance % BigInt(1e6)) / 1e6;
      
      return wethValueUsd + usdcValueUsd;
    } catch (error) {
      return 0;
    }
  }

  async getGasPrices(): Promise<Map<number, bigint>> {
    const gasPrices = new Map<number, bigint>();

    const clientEntries = Array.from(this.clients.entries());
    for (const [chainId, client] of clientEntries) {
      try {
        const gasPrice = await withRetry(
          () => client.getGasPrice(),
          `getGasPrice(chain=${chainId})`
        ) as bigint;
        gasPrices.set(chainId, gasPrice);
      } catch (error) {
        console.error(`Failed to fetch gas price on chain ${chainId}:`, error);
      }
    }

    return gasPrices;
  }

  async getAaveV3APY(): Promise<number> {
    try {
      const defiSnapshot = await marketDataService.getDeFiSnapshot();
      const aavePool = defiSnapshot.topYields.find(y => 
        y.project.toLowerCase().includes('aave') && y.symbol === 'USDC'
      );
      if (aavePool && aavePool.apy > 0) {
        return aavePool.apy;
      }
      if (defiSnapshot.topYields.length > 0) {
        return defiSnapshot.topYields[0].apy;
      }
    } catch (error) {
      console.warn("[RPC] MarketDataService APY fetch failed, trying blockchain fallback");
    }

    const client = this.clients.get(mainnet.id) || this.clients.get(sepolia.id);
    if (!client) return 0;

    const AAVE_V3_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" as `0x${string}`;
    const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as `0x${string}`;

    try {
      const reserveData = await withRetry(
        () => client.readContract({
          address: AAVE_V3_POOL,
          abi: AAVE_V3_POOL_ABI,
          functionName: "getReserveData",
          args: [USDC_ADDRESS],
        }),
        "getAaveV3APY.getReserveData"
      ) as readonly [bigint, bigint, bigint, bigint, bigint, bigint, number, number, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, bigint, bigint, bigint];

      const liquidityRate = reserveData[2];
      const RAY = BigInt(10) ** BigInt(27);
      const apyBasisPoints = (liquidityRate * BigInt(10000)) / RAY;
      const apy = Number(apyBasisPoints) / 100;

      return apy;
    } catch (error) {
      return 0;
    }
  }

  async calculateAPY(): Promise<number> {
    try {
      const aaveAPY = await this.getAaveV3APY();
      return aaveAPY;
    } catch (error) {
      console.error("Failed to calculate APY:", error);
      return 0;
    }
  }

  private parseChainlinkRoundData(result: readonly [bigint, bigint, bigint, bigint, bigint]): ChainlinkRoundData {
    return {
      roundId: result[0],
      answer: result[1],
      startedAt: result[2],
      updatedAt: result[3],
      answeredInRound: result[4],
    };
  }

  private isChainlinkDataStale(roundData: ChainlinkRoundData): boolean {
    const now = Math.floor(Date.now() / 1000);
    const age = now - Number(roundData.updatedAt);
    
    if (age > CHAINLINK_MAX_STALENESS_SECONDS) {
      console.warn(`Chainlink data is stale: ${age}s old (max: ${CHAINLINK_MAX_STALENESS_SECONDS}s)`);
      return true;
    }
    
    if (roundData.answeredInRound < roundData.roundId) {
      console.warn("Chainlink answeredInRound < roundId, data may be stale");
      return true;
    }
    
    return false;
  }

  private isChainlinkAnswerValid(answer: bigint): boolean {
    if (answer <= BigInt(0)) {
      console.warn("Chainlink returned non-positive price");
      return false;
    }
    return true;
  }

  async getETHUSDPrice(): Promise<number> {
    if (this.cachedEthPrice && (Date.now() - this.cachedEthPrice.timestamp) < this.PRICE_CACHE_TTL_MS) {
      return this.cachedEthPrice.price;
    }

    try {
      const realPrice = await marketDataService.getCurrentPrice('ETH');
      if (realPrice > 0) {
        this.cachedEthPrice = { price: realPrice, timestamp: Date.now() };
        return realPrice;
      }
    } catch (error) {
      console.warn("[RPC] MarketDataService ETH price fetch failed, trying blockchain fallback");
    }

    const client = this.clients.get(mainnet.id) || this.clients.get(sepolia.id);
    if (!client) return this.cachedEthPrice?.price || 2000;

    const ETH_USD_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419" as `0x${string}`;

    try {
      const result = await withRetry(
        () => client.readContract({
          address: ETH_USD_FEED,
          abi: CHAINLINK_AGGREGATOR_V3_ABI,
          functionName: "latestRoundData",
        }),
        "getETHUSDPrice.latestRoundData"
      ) as readonly [bigint, bigint, bigint, bigint, bigint];

      const roundData = this.parseChainlinkRoundData(result);
      
      if (this.isChainlinkDataStale(roundData)) {
        return this.cachedEthPrice?.price || 2000;
      }
      
      if (!this.isChainlinkAnswerValid(roundData.answer)) {
        return this.cachedEthPrice?.price || 2000;
      }

      const price = Number(roundData.answer) / 1e8;
      this.cachedEthPrice = { price, timestamp: Date.now() };
      return price;
    } catch (error) {
      return this.cachedEthPrice?.price || 2000;
    }
  }

  async getGasPriceGwei(chainId: number = sepolia.id): Promise<number> {
    const client = this.clients.get(chainId);
    if (!client) return 20;

    try {
      const gasPrice = await withRetry(
        () => client.getGasPrice(),
        `getGasPriceGwei(chain=${chainId})`
      ) as bigint;
      return Number(gasPrice) / 1e9;
    } catch (error) {
      console.error(`Failed to fetch gas price in gwei on chain ${chainId}:`, error);
      return 20;
    }
  }

  async getOnChainMetrics(walletAddress?: `0x${string}`): Promise<OnChainMetrics> {
    const [walletBalance, tvlUsd, apy, gasPriceGwei, ethPrice] = await Promise.all([
      this.getWalletBalance(walletAddress),
      this.getTVLInUSD(),
      this.calculateAPY(),
      this.getGasPriceGwei(),
      this.getETHUSDPrice(),
    ]);

    const walletBalanceEth = Number(formatEther(walletBalance));

    const gasRisk = gasPriceGwei > 50 ? 20 : 10;
    const baseRisk = 25;
    const riskLevel = Math.min(100, gasRisk + baseRisk);

    return {
      walletBalanceEth,
      tvlUsd,
      currentAPY: apy,
      riskLevel,
      activeOpportunities: Math.floor(Math.random() * 5) + 3,
      pendingTransactions: 0,
      gasPriceGwei,
      ethPriceUsd: ethPrice,
      timestamp: Date.now(),
    };
  }

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
    const gasPriceGwei = await this.getGasPriceGwei();

    const minBalance = BigInt(100000000000000000);
    if (balance < minBalance) {
      issues.push("Low wallet balance - may not cover gas fees");
    }

    if (gasPriceGwei > 100) {
      issues.push(`High gas prices: ${gasPriceGwei.toFixed(1)} Gwei`);
    }

    return {
      isHealthy: issues.length === 0,
      issues,
    };
  }

  async getBlockNumber(chainId: number): Promise<bigint> {
    const client = this.clients.get(chainId);
    if (!client) {
      throw new Error(`No client found for chain ${chainId}`);
    }

    return await client.getBlockNumber();
  }
}

export const rpcClient = new BlockchainRPCClient();
