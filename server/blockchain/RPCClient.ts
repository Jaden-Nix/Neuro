import { createPublicClient, http, formatEther, parseAbi } from "viem";
import { mainnet, base, fraxtal } from "viem/chains";

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
   * Fetch wallet balance across all chains
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
        const balance = await client.getBalance({ address });
        totalBalance += balance;
      } catch (error) {
        console.error(`Failed to fetch balance on chain ${chainId}:`, error);
      }
    }

    return totalBalance;
  }

  /**
   * Get TVL from major liquidity pools (Uniswap V3 ETH/USDC example)
   */
  async getTotalValueLocked(): Promise<bigint> {
    const client = this.clients.get(mainnet.id);
    if (!client) return BigInt(0);

    // Uniswap V3 ETH/USDC 0.05% pool on Ethereum
    const POOL_ADDRESS = "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";

    try {
      const liquidity = await client.readContract({
        address: POOL_ADDRESS,
        abi: UNISWAP_V3_POOL_ABI,
        functionName: "liquidity",
      });

      const slot0 = await client.readContract({
        address: POOL_ADDRESS,
        abi: UNISWAP_V3_POOL_ABI,
        functionName: "slot0",
      });

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
   * Get current gas prices across chains
   */
  async getGasPrices(): Promise<Map<number, bigint>> {
    const gasPrices = new Map<number, bigint>();

    const clientEntries = Array.from(this.clients.entries());
    for (const [chainId, client] of clientEntries) {
      try {
        const gasPrice = await client.getGasPrice();
        gasPrices.set(chainId, gasPrice);
      } catch (error) {
        console.error(`Failed to fetch gas price on chain ${chainId}:`, error);
      }
    }

    return gasPrices;
  }

  /**
   * Fetch real APY from Aave V3 protocol
   */
  async getAaveV3APY(): Promise<number> {
    const client = this.clients.get(mainnet.id);
    if (!client) return 0;

    // Aave V3 Pool address on Ethereum mainnet
    const AAVE_V3_POOL = "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2";
    // USDC address on Ethereum
    const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";

    try {
      const reserveData = await client.readContract({
        address: AAVE_V3_POOL,
        abi: AAVE_V3_POOL_ABI,
        functionName: "getReserveData",
        args: [USDC_ADDRESS],
      });

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
   * Fetch ETH/USD price from Chainlink Price Feed
   */
  async getETHUSDPrice(): Promise<number> {
    const client = this.clients.get(mainnet.id);
    if (!client) return 0;

    // Chainlink ETH/USD Price Feed on Ethereum mainnet
    const ETH_USD_FEED = "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419";

    try {
      const [, answer, , ,] = await client.readContract({
        address: ETH_USD_FEED,
        abi: CHAINLINK_AGGREGATOR_V3_ABI,
        functionName: "latestRoundData",
      });

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
   * Get gas price in Gwei (proper units for simulation)
   */
  async getGasPriceGwei(chainId: number = mainnet.id): Promise<number> {
    const client = this.clients.get(chainId);
    if (!client) return 20;

    try {
      const gasPrice = await client.getGasPrice();
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
