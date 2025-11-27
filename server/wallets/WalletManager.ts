import type {
  TrackedWallet,
  WalletTokenBalance,
  WalletTransaction,
  WalletAggregate,
  WalletChain,
  WalletProvider,
} from "@shared/schema";

interface TokenPrice {
  symbol: string;
  priceUsd: number;
}

export class WalletManager {
  private wallets: Map<string, TrackedWallet> = new Map();
  private transactions: Map<string, WalletTransaction[]> = new Map();
  private tokenPrices: Map<string, number> = new Map();

  constructor() {
    this.initializeDefaultPrices();
  }

  private generateId(): string {
    return `wallet-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  private initializeDefaultPrices() {
    this.tokenPrices.set("ETH", 2400);
    this.tokenPrices.set("WETH", 2400);
    this.tokenPrices.set("USDC", 1);
    this.tokenPrices.set("USDT", 1);
    this.tokenPrices.set("DAI", 1);
    this.tokenPrices.set("FRAX", 1);
    this.tokenPrices.set("SOL", 120);
    this.tokenPrices.set("WSOL", 120);
    this.tokenPrices.set("WBTC", 95000);
    this.tokenPrices.set("LINK", 15);
    this.tokenPrices.set("UNI", 8);
    this.tokenPrices.set("AAVE", 180);
    this.tokenPrices.set("CRV", 0.5);
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

    try {
      const nativeBalance = await this.fetchNativeBalance(wallet.address, wallet.chain);
      const tokenBalances = await this.fetchTokenBalances(wallet.address, wallet.chain);

      const nativePrice = this.getNativeTokenPrice(wallet.chain);
      const nativeBalanceNum = parseFloat(nativeBalance);
      let totalUsd = nativeBalanceNum * nativePrice;

      for (const token of tokenBalances) {
        totalUsd += token.balanceUsd;
      }

      wallet.balanceNative = nativeBalance;
      wallet.tokenBalances = tokenBalances;
      wallet.balanceUsd = Math.round(totalUsd * 100) / 100;
      wallet.isConnected = true;
      wallet.lastSyncedAt = Date.now();
      wallet.updatedAt = Date.now();

      console.log(`[WalletManager] Synced wallet ${wallet.label}: $${wallet.balanceUsd}`);
      return wallet;
    } catch (error: any) {
      console.error(`[WalletManager] Failed to sync wallet ${wallet.label}: ${error.message}`);
      wallet.isConnected = false;
      wallet.updatedAt = Date.now();
      return wallet;
    }
  }

  private async fetchNativeBalance(address: string, chain: WalletChain): Promise<string> {
    const mockBalance = (Math.random() * 10 + 0.5).toFixed(6);
    return mockBalance;
  }

  private async fetchTokenBalances(address: string, chain: WalletChain): Promise<WalletTokenBalance[]> {
    const chainTokens: Record<WalletChain, string[]> = {
      ethereum: ["USDC", "USDT", "DAI", "WETH", "LINK", "UNI", "AAVE"],
      base: ["USDC", "DAI", "WETH", "AERO"],
      fraxtal: ["FRAX", "FXS", "sFRAX", "USDC"],
      solana: ["USDC", "USDT", "RAY", "BONK", "JUP"],
    };

    const tokens = chainTokens[chain] || [];
    const balances: WalletTokenBalance[] = [];

    for (const symbol of tokens) {
      if (Math.random() > 0.5) {
        const balance = (Math.random() * 10000).toFixed(6);
        const price = this.tokenPrices.get(symbol) || 1;
        balances.push({
          address: `0x${Math.random().toString(16).slice(2, 42)}`,
          symbol,
          name: symbol,
          decimals: 18,
          balance,
          balanceUsd: parseFloat(balance) * price,
        });
      }
    }

    return balances;
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

    return {
      totalWallets: wallets.length,
      totalBalanceUsd: Math.round(totalBalanceUsd * 100) / 100,
      balanceByChain,
      topTokens,
      lastUpdated: Date.now(),
    };
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
