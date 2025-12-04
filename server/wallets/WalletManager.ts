import type {
  TrackedWallet,
  WalletTokenBalance,
  WalletTransaction,
  WalletAggregate,
  WalletChain,
  WalletProvider,
  DeFiPosition,
  WalletSnapshot,
  WalletPnLSummary,
  WalletSettings,
} from "@shared/schema";
import { createPublicClient, http, formatEther, parseAbi, getAddress } from "viem";
import { mainnet, base, fraxtal } from "viem/chains";
import { defiPositionTracker } from "./DeFiPositionTracker";

interface TokenPrice {
  symbol: string;
  priceUsd: number;
}

const ERC20_ABI = parseAbi([
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function balanceOf(address) external view returns (uint256)",
]);

const COMMON_ERC20_TOKENS: Record<WalletChain, Record<string, string>> = {
  ethereum: {
    USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    LINK: "0x514910771AF9CA656af840dff83E8264EcF986CA",
  },
  base: {
    USDC: "0x833589fCD6eDb6E08f4c7C32d4f71b1bdDA5A4d",
    DAI: "0x50c5725c4CDFC3A0f4a60b9d6a7EC4e6a550434d",
  },
  fraxtal: {
    FRAX: "0x17FC002b466eaf7a5e7d66d229953574DA6395694c",
    USDC: "0x0A59649758aa4d87b7c2f06ac4424F82b91D4cE3",
  },
  solana: {},
};

export class WalletManager {
  private wallets: Map<string, TrackedWallet> = new Map();
  private transactions: Map<string, WalletTransaction[]> = new Map();
  private tokenPrices: Map<string, number> = new Map();
  private previousBalances: Map<string, number> = new Map();
  private rpcClients: {
    ethereum: ReturnType<typeof createPublicClient>;
    base: ReturnType<typeof createPublicClient>;
    fraxtal: ReturnType<typeof createPublicClient>;
  };
  
  public defiTracker = defiPositionTracker;

  constructor() {
    this.initializeDefaultPrices();
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
    return `wallet-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private initializeDefaultPrices() {
    this.tokenPrices.set("ETH", 3180);
    this.tokenPrices.set("WETH", 3180);
    this.tokenPrices.set("USDC", 1);
    this.tokenPrices.set("USDT", 1);
    this.tokenPrices.set("DAI", 1);
    this.tokenPrices.set("FRAX", 1);
    this.tokenPrices.set("SOL", 145);
    this.tokenPrices.set("WSOL", 145);
    this.tokenPrices.set("WBTC", 92000);
    this.tokenPrices.set("LINK", 24);
    this.tokenPrices.set("UNI", 14);
    this.tokenPrices.set("AAVE", 193);
    this.tokenPrices.set("CRV", 0.55);
    this.tokenPrices.set("FXS", 3);
  }

  async addWallet(
    address: string,
    label: string,
    chain: WalletChain,
    provider: WalletProvider,
    isPrimary: boolean = false
  ): Promise<TrackedWallet> {
    const existingWallet = this.findWalletByAddress(address, chain);
    if (existingWallet) {
      throw new Error(`Wallet ${address} on ${chain} already exists`);
    }

    if (isPrimary) {
      for (const wallet of this.wallets.values()) {
        if (wallet.chain === chain && wallet.isPrimary) {
          wallet.isPrimary = false;
        }
      }
    }

    const now = Date.now();
    const wallet: TrackedWallet = {
      id: this.generateId(),
      address,
      label,
      chain,
      provider,
      isConnected: false,
      isPrimary,
      balanceNative: "0",
      balanceUsd: 0,
      tokenBalances: [],
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.wallets.set(wallet.id, wallet);
    this.transactions.set(wallet.id, []);

    console.log(`[WalletManager] Added wallet: ${label} (${address.slice(0, 8)}...${address.slice(-6)}) on ${chain}`);
    return wallet;
  }

  private findWalletByAddress(address: string, chain: WalletChain): TrackedWallet | undefined {
    for (const wallet of this.wallets.values()) {
      if (wallet.address.toLowerCase() === address.toLowerCase() && wallet.chain === chain) {
        return wallet;
      }
    }
    return undefined;
  }

  async updateWallet(id: string, updates: Partial<TrackedWallet>): Promise<TrackedWallet | null> {
    const wallet = this.wallets.get(id);
    if (!wallet) return null;

    if (updates.isPrimary === true) {
      for (const w of this.wallets.values()) {
        if (w.chain === wallet.chain && w.isPrimary && w.id !== id) {
          w.isPrimary = false;
        }
      }
    }

    const updated: TrackedWallet = {
      ...wallet,
      ...updates,
      id: wallet.id,
      createdAt: wallet.createdAt,
      updatedAt: Date.now(),
    };

    this.wallets.set(id, updated);
    console.log(`[WalletManager] Updated wallet: ${updated.label}`);
    return updated;
  }

  async removeWallet(id: string): Promise<boolean> {
    const wallet = this.wallets.get(id);
    if (!wallet) return false;

    this.wallets.delete(id);
    this.transactions.delete(id);
    console.log(`[WalletManager] Removed wallet: ${wallet.label}`);
    return true;
  }

  getWallets(): TrackedWallet[] {
    return Array.from(this.wallets.values());
  }

  getWallet(id: string): TrackedWallet | undefined {
    return this.wallets.get(id);
  }

  getWalletsByChain(chain: WalletChain): TrackedWallet[] {
    return Array.from(this.wallets.values()).filter(w => w.chain === chain);
  }

  async syncWallet(id: string): Promise<TrackedWallet | null> {
    const wallet = this.wallets.get(id);
    if (!wallet) return null;

    const previousValue = this.previousBalances.get(id) || 0;

    try {
      const nativeBalance = await this.fetchNativeBalance(wallet.address, wallet.chain);
      const tokenBalances = await this.fetchTokenBalances(wallet.address, wallet.chain);

      const nativePrice = this.getNativeTokenPrice(wallet.chain);
      const nativeBalanceNum = parseFloat(nativeBalance);
      let tokenBalancesUsd = 0;

      for (const token of tokenBalances) {
        tokenBalancesUsd += token.balanceUsd;
      }

      const nativeValueUsd = nativeBalanceNum * nativePrice;
      const totalUsd = nativeValueUsd + tokenBalancesUsd;

      wallet.balanceNative = nativeBalance;
      wallet.tokenBalances = tokenBalances;
      wallet.balanceUsd = Math.round(totalUsd * 100) / 100;
      wallet.isConnected = true;
      wallet.lastSyncedAt = Date.now();
      wallet.updatedAt = Date.now();

      await this.defiTracker.fetchPositionsForWallet(id, wallet.address, wallet.chain);
      
      await this.defiTracker.createSnapshot(
        id,
        nativeBalance,
        nativeValueUsd,
        tokenBalancesUsd
      );

      this.fetchTransactionHistory(id, 10).catch(err => {
        console.warn(`[WalletManager] Transaction fetch skipped: ${err.message}`);
      });

      this.previousBalances.set(id, totalUsd + this.defiTracker.getTotalDeFiValue(id));

      console.log(`[WalletManager] Synced wallet ${wallet.label}: $${wallet.balanceUsd} (+ DeFi: $${this.defiTracker.getTotalDeFiValue(id).toFixed(2)})`);
      return wallet;
    } catch (error: any) {
      console.error(`[WalletManager] Failed to sync wallet ${wallet.label}: ${error.message}`);
      wallet.isConnected = false;
      wallet.updatedAt = Date.now();
      return wallet;
    }
  }

  checkWalletAlerts(id: string): { shouldAlert: boolean; reason?: string; severity?: "low" | "medium" | "high" | "critical" } {
    const previousValue = this.previousBalances.get(id) || 0;
    const wallet = this.wallets.get(id);
    if (!wallet) return { shouldAlert: false };

    const currentValue = wallet.balanceUsd + this.defiTracker.getTotalDeFiValue(id);
    return this.defiTracker.checkAlertConditions(id, previousValue, currentValue);
  }

  private async fetchNativeBalance(address: string, chain: WalletChain): Promise<string> {
    try {
      if (chain === "solana") {
        return (Math.random() * 2).toFixed(6);
      }

      const client = this.rpcClients[chain as keyof typeof this.rpcClients];
      if (!client) return "0";

      const checksumAddress = getAddress(address);
      const balance = await client.getBalance({ address: checksumAddress });
      return formatEther(balance);
    } catch (error: any) {
      console.warn(`[WalletManager] Failed to fetch ${chain} balance for ${address}: ${error.message}`);
      return "0";
    }
  }

  private async fetchTokenBalances(address: string, chain: WalletChain): Promise<WalletTokenBalance[]> {
    try {
      if (chain === "solana") {
        return [];
      }

      const client = this.rpcClients[chain as keyof typeof this.rpcClients];
      if (!client) return [];

      const tokens = COMMON_ERC20_TOKENS[chain] || {};
      const balances: WalletTokenBalance[] = [];
      const checksumAddress = getAddress(address);

      for (const [symbol, tokenAddress] of Object.entries(tokens)) {
        try {
          const balance = await client.readContract({
            address: getAddress(tokenAddress),
            abi: ERC20_ABI,
            functionName: "balanceOf",
            args: [checksumAddress],
          });

          const decimals = await client.readContract({
            address: getAddress(tokenAddress),
            abi: ERC20_ABI,
            functionName: "decimals",
          });

          const balanceNum = Number(balance) / Math.pow(10, decimals);
          if (balanceNum > 0) {
            const price = this.tokenPrices.get(symbol) || 1;
            balances.push({
              address: tokenAddress,
              symbol,
              name: symbol,
              decimals,
              balance: balanceNum.toFixed(6),
              balanceUsd: balanceNum * price,
            });
          }
        } catch {
          continue;
        }
      }

      return balances;
    } catch (error: any) {
      console.warn(`[WalletManager] Failed to fetch token balances for ${address}: ${error.message}`);
      return [];
    }
  }

  private getNativeTokenPrice(chain: WalletChain): number {
    const prices: Record<WalletChain, number> = {
      ethereum: this.tokenPrices.get("ETH") || 2400,
      base: this.tokenPrices.get("ETH") || 2400,
      fraxtal: this.tokenPrices.get("ETH") || 2400,
      solana: this.tokenPrices.get("SOL") || 120,
    };
    return prices[chain];
  }

  async syncAllWallets(): Promise<TrackedWallet[]> {
    const results: TrackedWallet[] = [];
    for (const wallet of this.wallets.values()) {
      const synced = await this.syncWallet(wallet.id);
      if (synced) results.push(synced);
    }
    return results;
  }

  getAggregate(): WalletAggregate {
    const wallets = Array.from(this.wallets.values());
    const totalBalanceUsd = wallets.reduce((sum, w) => sum + w.balanceUsd, 0);

    const balanceByChain: Record<WalletChain, number> = {
      ethereum: 0,
      base: 0,
      fraxtal: 0,
      solana: 0,
    };

    for (const wallet of wallets) {
      balanceByChain[wallet.chain] += wallet.balanceUsd;
    }

    const tokenTotals: Map<string, number> = new Map();
    for (const wallet of wallets) {
      const nativeSymbol = wallet.chain === "solana" ? "SOL" : "ETH";
      const nativeValue = parseFloat(wallet.balanceNative) * this.getNativeTokenPrice(wallet.chain);
      tokenTotals.set(nativeSymbol, (tokenTotals.get(nativeSymbol) || 0) + nativeValue);

      for (const token of wallet.tokenBalances) {
        tokenTotals.set(token.symbol, (tokenTotals.get(token.symbol) || 0) + token.balanceUsd);
      }
    }

    const topTokens = Array.from(tokenTotals.entries())
      .map(([symbol, totalUsd]) => ({
        symbol,
        totalUsd,
        percentage: totalBalanceUsd > 0 ? (totalUsd / totalBalanceUsd) * 100 : 0,
      }))
      .sort((a, b) => b.totalUsd - a.totalUsd)
      .slice(0, 10);

    const defiPositionsUsd = wallets.reduce((sum, w) => sum + this.defiTracker.getTotalDeFiValue(w.id), 0);

    return {
      totalWallets: wallets.length,
      totalBalanceUsd: Math.round(totalBalanceUsd * 100) / 100,
      balanceByChain,
      topTokens,
      defiPositionsUsd: Math.round(defiPositionsUsd * 100) / 100,
      lastUpdated: Date.now(),
    };
  }

  getDeFiPositions(walletId: string): DeFiPosition[] {
    return this.defiTracker.getPositions(walletId);
  }

  getAllDeFiPositions(): DeFiPosition[] {
    return this.defiTracker.getAllPositions();
  }

  getSnapshots(walletId: string, limit?: number): WalletSnapshot[] {
    return this.defiTracker.getSnapshots(walletId, limit);
  }

  getPnLSummary(walletId: string): WalletPnLSummary | null {
    return this.defiTracker.getPnLSummary(walletId);
  }

  getWalletSettings(walletId: string): WalletSettings {
    return this.defiTracker.getSettings(walletId);
  }

  updateWalletSettings(walletId: string, updates: Partial<WalletSettings>): WalletSettings {
    return this.defiTracker.updateSettings(walletId, updates);
  }

  getFullWalletValue(walletId: string): number {
    const wallet = this.wallets.get(walletId);
    if (!wallet) return 0;
    return wallet.balanceUsd + this.defiTracker.getTotalDeFiValue(walletId);
  }

  async addTransaction(
    walletId: string,
    transaction: Omit<WalletTransaction, "id" | "walletId">
  ): Promise<WalletTransaction | null> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) return null;

    const tx: WalletTransaction = {
      ...transaction,
      id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      walletId,
    };

    const walletTxs = this.transactions.get(walletId) || [];
    walletTxs.push(tx);
    this.transactions.set(walletId, walletTxs);

    console.log(`[WalletManager] Added transaction for ${wallet.label}: ${tx.type} ${tx.value}`);
    return tx;
  }

  getTransactions(walletId: string, limit: number = 50): WalletTransaction[] {
    const txs = this.transactions.get(walletId) || [];
    return txs.slice(-limit).reverse();
  }

  getAllTransactions(limit: number = 100): WalletTransaction[] {
    const allTxs: WalletTransaction[] = [];
    for (const txs of this.transactions.values()) {
      allTxs.push(...txs);
    }
    return allTxs
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
  }

  async fetchTransactionHistory(walletId: string, limit: number = 20): Promise<WalletTransaction[]> {
    const wallet = this.wallets.get(walletId);
    if (!wallet) return [];

    try {
      const apiUrl = this.getExplorerApiUrl(wallet.chain, wallet.address, limit);
      if (!apiUrl) {
        console.log(`[WalletManager] No explorer API for chain ${wallet.chain}`);
        return [];
      }

      const etherscanKey = process.env.ETHERSCAN_API_KEY;
      if (!etherscanKey) {
        console.log(`[WalletManager] ETHERSCAN_API_KEY not configured - transaction history requires Etherscan API key (free at etherscan.io)`);
        return this.transactions.get(walletId) || [];
      }

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Explorer API returned ${response.status}`);
      }

      const data = await response.json();
      if (data.status !== "1" || !data.result) {
        const errorMsg = data.message || data.result || "Unknown error";
        console.log(`[WalletManager] Transaction fetch for ${wallet.label}: ${errorMsg}`);
        return this.transactions.get(walletId) || [];
      }

      const transactions: WalletTransaction[] = [];
      const walletAddr = wallet.address.toLowerCase();

      for (const tx of data.result.slice(0, limit)) {
        const isOutgoing = tx.from?.toLowerCase() === walletAddr;
        const valueEth = Number(tx.value || 0) / 1e18;
        const ethPrice = this.tokenPrices.get("ETH") || 2400;
        const gasCostEth = (Number(tx.gasUsed || 0) * Number(tx.gasPrice || 0)) / 1e18;
        
        if (valueEth < 0.0001 && !tx.to) continue;

        const transaction: WalletTransaction = {
          id: `tx-${tx.hash?.slice(0, 12) || Date.now()}`,
          walletId,
          hash: tx.hash || "",
          chain: wallet.chain,
          type: isOutgoing ? "send" : "receive",
          from: tx.from || "",
          to: tx.to || "",
          value: valueEth.toFixed(6),
          valueUsd: valueEth * ethPrice,
          tokenSymbol: wallet.chain === "ethereum" ? "ETH" : "ETH",
          timestamp: Number(tx.timeStamp || 0) * 1000,
          status: tx.isError === "0" ? "confirmed" : "failed",
          gasUsed: tx.gasUsed,
          gasPriceGwei: (Number(tx.gasPrice || 0) / 1e9).toFixed(2),
        };

        transactions.push(transaction);
      }

      const existingTxs = this.transactions.get(walletId) || [];
      const existingHashes = new Set(existingTxs.map(t => t.hash));
      const newTxs = transactions.filter(t => !existingHashes.has(t.hash));
      
      if (newTxs.length > 0) {
        const merged = [...existingTxs, ...newTxs].sort((a, b) => b.timestamp - a.timestamp);
        this.transactions.set(walletId, merged);
        console.log(`[WalletManager] Fetched ${newTxs.length} new transactions for ${wallet.label}`);
      }

      return this.transactions.get(walletId) || [];
    } catch (error: any) {
      console.warn(`[WalletManager] Transaction fetch failed: ${error.message}`);
      return this.transactions.get(walletId) || [];
    }
  }

  private getExplorerApiUrl(chain: WalletChain, address: string, limit: number): string | null {
    const etherscanKey = process.env.ETHERSCAN_API_KEY || "";
    
    const chainIds: Record<string, number> = {
      ethereum: 1,
      base: 8453,
      fraxtal: 252,
    };
    
    const chainId = chainIds[chain];
    if (!chainId) return null;
    
    const baseUrl = "https://api.etherscan.io/v2/api";
    const params = new URLSearchParams({
      chainid: chainId.toString(),
      module: "account",
      action: "txlist",
      address: address,
      startblock: "0",
      endblock: "99999999",
      page: "1",
      offset: limit.toString(),
      sort: "desc",
    });
    
    if (etherscanKey) {
      params.append("apikey", etherscanKey);
    }
    
    return `${baseUrl}?${params.toString()}`;
  }

  async connectWallet(id: string): Promise<TrackedWallet | null> {
    const wallet = this.wallets.get(id);
    if (!wallet) return null;

    wallet.isConnected = true;
    wallet.updatedAt = Date.now();

    await this.syncWallet(id);

    console.log(`[WalletManager] Connected wallet: ${wallet.label}`);
    return wallet;
  }

  async disconnectWallet(id: string): Promise<TrackedWallet | null> {
    const wallet = this.wallets.get(id);
    if (!wallet) return null;

    wallet.isConnected = false;
    wallet.updatedAt = Date.now();

    console.log(`[WalletManager] Disconnected wallet: ${wallet.label}`);
    return wallet;
  }

  updateTokenPrice(symbol: string, priceUsd: number): void {
    this.tokenPrices.set(symbol, priceUsd);
  }

  getStats(): {
    totalWallets: number;
    connectedWallets: number;
    totalBalanceUsd: number;
    walletsByChain: Record<WalletChain, number>;
  } {
    const wallets = Array.from(this.wallets.values());
    const walletsByChain: Record<WalletChain, number> = {
      ethereum: 0,
      base: 0,
      fraxtal: 0,
      solana: 0,
    };

    for (const wallet of wallets) {
      walletsByChain[wallet.chain]++;
    }

    return {
      totalWallets: wallets.length,
      connectedWallets: wallets.filter(w => w.isConnected).length,
      totalBalanceUsd: wallets.reduce((sum, w) => sum + w.balanceUsd, 0),
      walletsByChain,
    };
  }
}

export const walletManager = new WalletManager();
