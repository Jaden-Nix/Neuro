import type {
  DeFiPosition,
  DeFiPositionType,
  DeFiProtocol,
  WalletChain,
  WalletSnapshot,
  WalletSettings,
  WalletPnLSummary,
} from "@shared/schema";
import { createPublicClient, http, parseAbi, getAddress, formatUnits } from "viem";
import { mainnet, base, fraxtal } from "viem/chains";

interface ProtocolConfig {
  name: DeFiProtocol;
  chains: WalletChain[];
  contracts: Record<WalletChain, string[]>;
}

const UNISWAP_V3_POSITION_ABI = parseAbi([
  "function positions(uint256) external view returns (uint96, address, address, address, uint24, int24, int24, uint128, uint256, uint256, uint128, uint128)",
  "function balanceOf(address) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address, uint256) external view returns (uint256)",
]);

const AAVE_POOL_ABI = parseAbi([
  "function getUserAccountData(address) external view returns (uint256, uint256, uint256, uint256, uint256, uint256)",
]);

const LIDO_STETH_ABI = parseAbi([
  "function balanceOf(address) external view returns (uint256)",
  "function getPooledEthByShares(uint256) external view returns (uint256)",
]);

const ERC20_ABI = parseAbi([
  "function balanceOf(address) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
]);

export class DeFiPositionTracker {
  private positions: Map<string, DeFiPosition[]> = new Map();
  private snapshots: Map<string, WalletSnapshot[]> = new Map();
  private settings: Map<string, WalletSettings> = new Map();
  
  private rpcClients: {
    ethereum: ReturnType<typeof createPublicClient>;
    base: ReturnType<typeof createPublicClient>;
    fraxtal: ReturnType<typeof createPublicClient>;
  };

  private protocolContracts: Record<DeFiProtocol, Record<WalletChain, Record<string, string>>> = {
    uniswap: {
      ethereum: { positionManager: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88" },
      base: { positionManager: "0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1" },
      fraxtal: {},
      solana: {},
    },
    aave: {
      ethereum: { pool: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2" },
      base: { pool: "0xA238Dd80C259a72e81d7e4664a9801593F98d1c5" },
      fraxtal: {},
      solana: {},
    },
    lido: {
      ethereum: { stETH: "0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84" },
      base: { wstETH: "0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452" },
      fraxtal: {},
      solana: {},
    },
    compound: {
      ethereum: { comptroller: "0x3d9819210A31b4961b30EF54bE2aeD79B9c9Cd3B" },
      base: { comet: "0x46e6b214b524310239732D51387075E0e70970bf" },
      fraxtal: {},
      solana: {},
    },
    curve: {
      ethereum: {},
      base: {},
      fraxtal: {},
      solana: {},
    },
    frax: {
      ethereum: { sfrxETH: "0xac3E018457B222d93114458476f3E3416Abbe38F" },
      fraxtal: { sfrxETH: "0xFC00000000000000000000000000000000000005" },
      base: {},
      solana: {},
    },
    convex: {
      ethereum: {},
      base: {},
      fraxtal: {},
      solana: {},
    },
    marinade: {
      ethereum: {},
      base: {},
      fraxtal: {},
      solana: {},
    },
    raydium: {
      ethereum: {},
      base: {},
      fraxtal: {},
      solana: {},
    },
    orca: {
      ethereum: {},
      base: {},
      fraxtal: {},
      solana: {},
    },
    other: {
      ethereum: {},
      base: {},
      fraxtal: {},
      solana: {},
    },
  };

  private tokenPrices: Map<string, number> = new Map([
    ["ETH", 3180],
    ["WETH", 3180],
    ["stETH", 3150],
    ["sfrxETH", 3200],
    ["USDC", 1],
    ["USDT", 1],
    ["DAI", 1],
    ["FRAX", 1],
    ["SOL", 145],
    ["AAVE", 193],
  ]);

  constructor() {
    this.rpcClients = {
      ethereum: createPublicClient({
        chain: mainnet,
        transport: http(process.env.ETHEREUM_MAINNET_RPC_URL || "https://eth.llamarpc.com"),
      }),
      base: createPublicClient({
        chain: base,
        transport: http(process.env.BASE_MAINNET_RPC_URL || "https://mainnet.base.org"),
      }),
      fraxtal: createPublicClient({
        chain: fraxtal,
        transport: http(process.env.FRAXTAL_RPC_URL || "https://rpc.frax.com"),
      }),
    };
  }

  private generateId(): string {
    return `defi-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  async fetchPositionsForWallet(walletId: string, address: string, chain: WalletChain): Promise<DeFiPosition[]> {
    const positions: DeFiPosition[] = [];

    try {
      if (chain !== "solana") {
        const lidoPosition = await this.fetchLidoPosition(walletId, address, chain);
        if (lidoPosition) positions.push(lidoPosition);

        const aavePositions = await this.fetchAavePositions(walletId, address, chain);
        positions.push(...aavePositions);

        const fraxPosition = await this.fetchFraxPosition(walletId, address, chain);
        if (fraxPosition) positions.push(fraxPosition);
      }

      this.positions.set(walletId, positions);
      console.log(`[DeFiTracker] Found ${positions.length} DeFi positions for wallet ${walletId}`);
      return positions;
    } catch (error: any) {
      console.error(`[DeFiTracker] Error fetching positions: ${error.message}`);
      return [];
    }
  }

  private async fetchLidoPosition(walletId: string, address: string, chain: WalletChain): Promise<DeFiPosition | null> {
    const contracts = this.protocolContracts.lido[chain];
    if (!contracts) return null;
    
    const tokenAddress = chain === "ethereum" ? contracts.stETH : contracts.wstETH;
    if (!tokenAddress) return null;

    try {
      const client = this.rpcClients[chain as keyof typeof this.rpcClients];
      if (!client) return null;
      
      const checksumAddress = getAddress(address);

      const balance = await client.readContract({
        address: getAddress(tokenAddress),
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [checksumAddress],
      });

      const balanceNum = Number(balance) / 1e18;
      if (balanceNum < 0.001) return null;

      const ethPrice = this.tokenPrices.get("ETH") || 2400;
      const tokenPrice = chain === "ethereum" ? ethPrice * 0.995 : ethPrice * 1.1;
      const tokenName = chain === "ethereum" ? "Lido Staked ETH (stETH)" : "Lido Wrapped stETH (wstETH)";

      return {
        id: this.generateId(),
        walletId,
        chain,
        protocol: "lido",
        type: "staking",
        name: tokenName,
        stakedAmount: balanceNum.toFixed(6),
        stakedValueUsd: balanceNum * tokenPrice,
        rewardsClaimable: 0,
        apy: 3.8,
        lastUpdatedAt: Date.now(),
        createdAt: Date.now(),
      };
    } catch (error: any) {
      console.warn(`[DeFiTracker] Lido fetch failed on ${chain}: ${error.message}`);
      return null;
    }
  }

  private async fetchAavePositions(walletId: string, address: string, chain: WalletChain): Promise<DeFiPosition[]> {
    const contracts = this.protocolContracts.aave[chain];
    const poolAddress = contracts?.pool;
    if (!poolAddress) return [];

    try {
      const client = this.rpcClients[chain as keyof typeof this.rpcClients];
      if (!client) return [];
      
      const checksumAddress = getAddress(address);

      const userData = await client.readContract({
        address: getAddress(poolAddress),
        abi: AAVE_POOL_ABI,
        functionName: "getUserAccountData",
        args: [checksumAddress],
      }) as readonly [bigint, bigint, bigint, bigint, bigint, bigint];

      const [totalCollateralBase, totalDebtBase, availableBorrowsBase, currentLiqThreshold, ltv, healthFactor] = userData;

      const collateralUsd = Number(totalCollateralBase) / 1e8;
      const debtUsd = Number(totalDebtBase) / 1e8;
      const health = Number(healthFactor) / 1e18;

      const positions: DeFiPosition[] = [];
      const chainLabel = chain === "ethereum" ? "" : ` (${chain.charAt(0).toUpperCase() + chain.slice(1)})`;

      if (collateralUsd > 1) {
        positions.push({
          id: this.generateId(),
          walletId,
          chain,
          protocol: "aave",
          type: "lending",
          name: `Aave V3 Deposits${chainLabel}`,
          stakedValueUsd: collateralUsd,
          rewardsClaimable: 0,
          collateralValueUsd: collateralUsd,
          healthFactor: health > 100 ? undefined : health,
          apy: chain === "base" ? 3.2 : 2.5,
          lastUpdatedAt: Date.now(),
          createdAt: Date.now(),
        });
      }

      if (debtUsd > 1) {
        positions.push({
          id: this.generateId(),
          walletId,
          chain,
          protocol: "aave",
          type: "borrowing",
          name: `Aave V3 Borrows${chainLabel}`,
          stakedValueUsd: 0,
          borrowedValueUsd: debtUsd,
          rewardsClaimable: 0,
          healthFactor: health > 100 ? undefined : health,
          lastUpdatedAt: Date.now(),
          createdAt: Date.now(),
        });
      }

      return positions;
    } catch (error: any) {
      console.warn(`[DeFiTracker] Aave fetch failed on ${chain}: ${error.message}`);
      return [];
    }
  }

  private async fetchFraxPosition(walletId: string, address: string, chain: WalletChain): Promise<DeFiPosition | null> {
    const contracts = this.protocolContracts.frax[chain];
    const sfrxETHAddress = contracts?.sfrxETH;
    if (!sfrxETHAddress) return null;

    try {
      const client = this.rpcClients[chain as keyof typeof this.rpcClients];
      if (!client) return null;

      const checksumAddress = getAddress(address);

      const balance = await client.readContract({
        address: getAddress(sfrxETHAddress),
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [checksumAddress],
      });

      const balanceNum = Number(balance) / 1e18;
      if (balanceNum < 0.001) return null;

      const ethPrice = this.tokenPrices.get("ETH") || 2400;
      const sfrxETHPrice = ethPrice * 1.02;

      return {
        id: this.generateId(),
        walletId,
        chain,
        protocol: "frax",
        type: "staking",
        name: "Frax Staked ETH (sfrxETH)",
        stakedAmount: balanceNum.toFixed(6),
        stakedValueUsd: balanceNum * sfrxETHPrice,
        rewardsClaimable: 0,
        apy: 4.2,
        lastUpdatedAt: Date.now(),
        createdAt: Date.now(),
      };
    } catch (error: any) {
      console.warn(`[DeFiTracker] Frax fetch failed: ${error.message}`);
      return null;
    }
  }

  getPositions(walletId: string): DeFiPosition[] {
    return this.positions.get(walletId) || [];
  }

  getAllPositions(): DeFiPosition[] {
    const all: DeFiPosition[] = [];
    for (const positions of this.positions.values()) {
      all.push(...positions);
    }
    return all;
  }

  getTotalDeFiValue(walletId: string): number {
    const positions = this.getPositions(walletId);
    return positions.reduce((sum, p) => {
      const value = p.stakedValueUsd - (p.borrowedValueUsd || 0);
      return sum + value;
    }, 0);
  }

  getTotalRewardsClaimable(walletId: string): number {
    const positions = this.getPositions(walletId);
    return positions.reduce((sum, p) => sum + p.rewardsClaimable, 0);
  }

  async createSnapshot(
    walletId: string,
    balanceNative: string,
    balanceUsd: number,
    tokenBalancesUsd: number
  ): Promise<WalletSnapshot> {
    const defiPositionsUsd = this.getTotalDeFiValue(walletId);
    const totalValueUsd = balanceUsd + tokenBalancesUsd + defiPositionsUsd;

    const snapshots = this.snapshots.get(walletId) || [];
    const now = Date.now();

    const pnl24h = this.calculatePnL(snapshots, now - 24 * 60 * 60 * 1000, totalValueUsd);
    const pnl7d = this.calculatePnL(snapshots, now - 7 * 24 * 60 * 60 * 1000, totalValueUsd);
    const pnl30d = this.calculatePnL(snapshots, now - 30 * 24 * 60 * 60 * 1000, totalValueUsd);

    const snapshot: WalletSnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      walletId,
      timestamp: now,
      balanceNative,
      balanceUsd,
      tokenBalancesUsd,
      defiPositionsUsd,
      totalValueUsd,
      pnl24h,
      pnl7d,
      pnl30d,
    };

    snapshots.push(snapshot);
    if (snapshots.length > 1000) {
      snapshots.splice(0, snapshots.length - 1000);
    }
    this.snapshots.set(walletId, snapshots);

    return snapshot;
  }

  private calculatePnL(snapshots: WalletSnapshot[], targetTime: number, currentValue: number): number {
    if (snapshots.length === 0) return 0;

    let closest = snapshots[0];
    for (const snap of snapshots) {
      if (Math.abs(snap.timestamp - targetTime) < Math.abs(closest.timestamp - targetTime)) {
        closest = snap;
      }
    }

    if (Math.abs(closest.timestamp - targetTime) > 24 * 60 * 60 * 1000) {
      return 0;
    }

    return currentValue - closest.totalValueUsd;
  }

  getSnapshots(walletId: string, limit: number = 100): WalletSnapshot[] {
    const snapshots = this.snapshots.get(walletId) || [];
    return snapshots.slice(-limit);
  }

  getLatestSnapshot(walletId: string): WalletSnapshot | undefined {
    const snapshots = this.snapshots.get(walletId) || [];
    return snapshots[snapshots.length - 1];
  }

  getPnLSummary(walletId: string): WalletPnLSummary | null {
    const latest = this.getLatestSnapshot(walletId);
    if (!latest) return null;

    const snapshots = this.snapshots.get(walletId) || [];
    const oldest = snapshots[0];

    return {
      walletId,
      currentValueUsd: latest.totalValueUsd,
      costBasis: oldest?.totalValueUsd || latest.totalValueUsd,
      unrealizedPnl: latest.totalValueUsd - (oldest?.totalValueUsd || latest.totalValueUsd),
      realizedPnl: 0,
      totalPnl: latest.totalValueUsd - (oldest?.totalValueUsd || latest.totalValueUsd),
      pnlPercentage: oldest ? ((latest.totalValueUsd - oldest.totalValueUsd) / oldest.totalValueUsd) * 100 : 0,
      pnl24h: latest.pnl24h,
      pnl24hPercentage: latest.totalValueUsd > 0 ? (latest.pnl24h / latest.totalValueUsd) * 100 : 0,
      pnl7d: latest.pnl7d,
      pnl7dPercentage: latest.totalValueUsd > 0 ? (latest.pnl7d / latest.totalValueUsd) * 100 : 0,
      pnl30d: latest.pnl30d,
      pnl30dPercentage: latest.totalValueUsd > 0 ? (latest.pnl30d / latest.totalValueUsd) * 100 : 0,
    };
  }

  getSettings(walletId: string): WalletSettings {
    const existing = this.settings.get(walletId);
    if (existing) return existing;

    const defaults: WalletSettings = {
      walletId,
      alertOnLargeChange: true,
      largeChangeThreshold: 10,
      alertOnRewardsClaimable: true,
      rewardsThreshold: 10,
      alertOnHealthFactor: true,
      healthFactorThreshold: 1.5,
      autoSync: true,
      syncIntervalMinutes: 15,
    };

    this.settings.set(walletId, defaults);
    return defaults;
  }

  updateSettings(walletId: string, updates: Partial<WalletSettings>): WalletSettings {
    const current = this.getSettings(walletId);
    const updated = { ...current, ...updates, walletId };
    this.settings.set(walletId, updated);
    return updated;
  }

  checkAlertConditions(walletId: string, previousValue: number, currentValue: number): {
    shouldAlert: boolean;
    reason?: string;
    severity?: "low" | "medium" | "high" | "critical";
  } {
    const settings = this.getSettings(walletId);
    const positions = this.getPositions(walletId);

    if (settings.alertOnLargeChange && previousValue > 0) {
      const changePercent = Math.abs((currentValue - previousValue) / previousValue) * 100;
      if (changePercent >= settings.largeChangeThreshold) {
        const direction = currentValue > previousValue ? "increased" : "decreased";
        return {
          shouldAlert: true,
          reason: `Wallet value ${direction} by ${changePercent.toFixed(1)}% ($${Math.abs(currentValue - previousValue).toFixed(2)})`,
          severity: changePercent >= 20 ? "high" : "medium",
        };
      }
    }

    if (settings.alertOnRewardsClaimable) {
      const totalRewards = this.getTotalRewardsClaimable(walletId);
      if (totalRewards >= settings.rewardsThreshold) {
        return {
          shouldAlert: true,
          reason: `$${totalRewards.toFixed(2)} in rewards available to claim`,
          severity: "low",
        };
      }
    }

    if (settings.alertOnHealthFactor) {
      for (const position of positions) {
        if (position.healthFactor && position.healthFactor <= settings.healthFactorThreshold) {
          return {
            shouldAlert: true,
            reason: `${position.name} health factor is ${position.healthFactor.toFixed(2)} (threshold: ${settings.healthFactorThreshold})`,
            severity: position.healthFactor <= 1.1 ? "critical" : "high",
          };
        }
      }
    }

    return { shouldAlert: false };
  }
}

export const defiPositionTracker = new DeFiPositionTracker();
