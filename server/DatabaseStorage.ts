import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";
import {
  agents,
  logs,
  creditScores,
  creditTransactions,
  memoryEntries,
  simulations,
  replayEvents,
  alerts,
  systemState,
  chainTransactions,
  agentTemplates,
  marketplaceListings,
  agentRentals,
  agentNFTs,
  leaderboard,
  solanaWallets,
  sellerProfiles,
  type Agent,
  type LogEntry,
  type LiveMetrics,
  type AgentCreditScore,
  type CreditTransaction,
  type MemoryEntry,
  type SimulationBranch,
  type ReplayEvent,
  type SentinelAlert,
  type SystemState,
  type ChainTransaction,
  type AgentTemplate,
  type MarketplaceListing,
  type AgentRental,
  type AgentNFT,
  type LeaderboardEntry,
  type SolanaWallet,
  type SellerProfile,
  type InsertAgentTemplate,
  type InsertMarketplaceListing,
  type InsertAgentRental,
  type InsertAgentNFT,
  type InsertSellerProfile,
  AgentType,
  ListingStatus,
} from "@shared/schema";
import { randomUUID } from "crypto";
import type { IStorage } from "./storage";
import { rpcClient } from "./blockchain/RPCClient";

/**
 * DatabaseStorage - PostgreSQL-backed storage using Drizzle ORM
 * Replaces in-memory MemStorage with persistent database storage
 */
export class DatabaseStorage implements IStorage {
  private metricsCache: LiveMetrics | null = null;
  private metricsCacheExpiry: number = 0;
  private readonly METRICS_CACHE_TTL = 10000; // 10 seconds

  // System State
  async getSystemState(): Promise<SystemState> {
    // Use singleton pattern - always id = 'singleton'
    const [state] = await db
      .select()
      .from(systemState)
      .where(eq(systemState.id, "singleton"));

    if (!state) {
      // Initialize default state if not exists
      const [newState] = await db
        .insert(systemState)
        .values({
          id: "singleton",
          autonomousMode: false,
          activeAgents: [],
          totalSimulationsRun: 0,
          totalTransactionsExecuted: 0,
          systemHealth: 85,
        })
        .returning();
      return {
        ...newState,
        lastUpdated: newState.lastUpdated.getTime(),
      };
    }

    return {
      ...state,
      lastUpdated: state.lastUpdated.getTime(),
    };
  }

  async updateSystemState(updates: Partial<SystemState>): Promise<SystemState> {
    const [updated] = await db
      .update(systemState)
      .set({
        ...updates,
        lastUpdated: new Date(),
      })
      .where(eq(systemState.id, "singleton"))
      .returning();

    return {
      ...updated,
      lastUpdated: updated.lastUpdated.getTime(),
    };
  }

  // Agents
  async getAgents(): Promise<Agent[]> {
    const results = await db.select().from(agents).orderBy(desc(agents.spawnedAt));
    return results.map((agent) => ({
      ...agent,
      currentTask: agent.currentTask || undefined,
      atpMetadata: agent.atpMetadata as Record<string, any> | undefined,
      spawnedAt: agent.spawnedAt.getTime(),
      deprecatedAt: agent.deprecatedAt?.getTime(),
    }));
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    if (!agent) return undefined;

    return {
      ...agent,
      currentTask: agent.currentTask || undefined,
      atpMetadata: agent.atpMetadata as Record<string, any> | undefined,
      spawnedAt: agent.spawnedAt.getTime(),
      deprecatedAt: agent.deprecatedAt?.getTime(),
    };
  }

  async upsertAgent(agent: Agent): Promise<Agent> {
    // Convert timestamps properly - they come in as milliseconds (numbers)
    const spawnedDate = typeof agent.spawnedAt === 'number' 
      ? new Date(agent.spawnedAt)
      : agent.spawnedAt;
    
    const deprecatedDate = agent.deprecatedAt 
      ? (typeof agent.deprecatedAt === 'number' ? new Date(agent.deprecatedAt) : agent.deprecatedAt)
      : null;

    const [result] = await db
      .insert(agents)
      .values({
        ...agent,
        spawnedAt: spawnedDate,
        deprecatedAt: deprecatedDate,
      })
      .onConflictDoUpdate({
        target: agents.id,
        set: {
          status: agent.status,
          creditScore: agent.creditScore,
          currentTask: agent.currentTask || null,
          atpMetadata: agent.atpMetadata || null,
          deprecatedAt: deprecatedDate,
        },
      })
      .returning();

    return {
      ...result,
      currentTask: result.currentTask || undefined,
      atpMetadata: result.atpMetadata as Record<string, any> | undefined,
      spawnedAt: result.spawnedAt.getTime(),
      deprecatedAt: result.deprecatedAt?.getTime(),
    };
  }

  async clearAgents(): Promise<void> {
    await db.delete(agents);
  }

  // Logs
  async getLogs(limit: number = 100): Promise<LogEntry[]> {
    const results = await db
      .select()
      .from(logs)
      .orderBy(desc(logs.timestamp))
      .limit(limit);

    return results
      .map((log) => ({
        ...log,
        personality: log.personality || undefined,
        timestamp: log.timestamp.getTime(),
      }))
      .reverse(); // Return in chronological order
  }

  async addLog(log: Omit<LogEntry, "id">): Promise<LogEntry> {
    const logDate = typeof log.timestamp === 'number' 
      ? new Date(log.timestamp)
      : log.timestamp;

    const [result] = await db
      .insert(logs)
      .values({
        id: randomUUID(),
        ...log,
        timestamp: logDate,
      })
      .returning();

    return {
      ...result,
      personality: result.personality || undefined,
      timestamp: result.timestamp.getTime(),
    };
  }

  // Metrics - with blockchain RPC integration
  async getMetrics(): Promise<LiveMetrics> {
    // Check cache first
    const now = Date.now();
    if (this.metricsCache && now < this.metricsCacheExpiry) {
      return {
        ...this.metricsCache,
        timestamp: now,
      };
    }

    try {
      // Fetch real blockchain metrics
      const onChainMetrics = await rpcClient.getOnChainMetrics();
      
      this.metricsCache = onChainMetrics;
      this.metricsCacheExpiry = now + this.METRICS_CACHE_TTL;
      
      return onChainMetrics;
    } catch (error) {
      console.error("Failed to fetch on-chain metrics:", error);
      
      // Fallback to safe defaults if RPC fails
      return {
        walletBalanceEth: 0,
        tvlUsd: 0,
        currentAPY: 0,
        riskLevel: 50,
        activeOpportunities: 0,
        pendingTransactions: 0,
        gasPriceGwei: 20,
        ethPriceUsd: 2000,
        timestamp: now,
      };
    }
  }

  async updateMetrics(updates: Partial<LiveMetrics>): Promise<LiveMetrics> {
    // Invalidate cache
    this.metricsCache = null;
    this.metricsCacheExpiry = 0;
    
    return this.getMetrics();
  }

  // Credits
  async getCreditScores(): Promise<AgentCreditScore[]> {
    return await db.select().from(creditScores);
  }

  async getCreditTransactions(
    agentId?: string,
    limit: number = 100
  ): Promise<CreditTransaction[]> {
    const results = agentId
      ? await db
          .select()
          .from(creditTransactions)
          .where(eq(creditTransactions.agentId, agentId))
          .orderBy(desc(creditTransactions.timestamp))
          .limit(limit)
      : await db
          .select()
          .from(creditTransactions)
          .orderBy(desc(creditTransactions.timestamp))
          .limit(limit);

    return results.map((tx) => ({
      ...tx,
      timestamp: tx.timestamp.getTime(),
    }));
  }

  async addCreditTransaction(transaction: CreditTransaction): Promise<void> {
    // Add transaction - convert timestamp to Date if it's a number
    const txDate = typeof transaction.timestamp === 'number'
      ? new Date(transaction.timestamp)
      : transaction.timestamp;

    await db.insert(creditTransactions).values({
      id: randomUUID(),
      ...transaction,
      timestamp: txDate,
    });

    // Update or create credit score
    const [existing] = await db
      .select()
      .from(creditScores)
      .where(eq(creditScores.agentId, transaction.agentId));

    if (existing) {
      const newTotal = existing.totalCredits + transaction.amount;
      const newSuccessful = transaction.amount > 0 ? existing.successfulActions + 1 : existing.successfulActions;
      const newFailed = transaction.amount < 0 ? existing.failedActions + 1 : existing.failedActions;
      const totalActions = newSuccessful + newFailed;
      const newAccuracy = totalActions > 0 ? Math.round((newSuccessful / totalActions) * 100) : 0;

      await db
        .update(creditScores)
        .set({
          totalCredits: newTotal,
          accuracyRate: newAccuracy,
          successfulActions: newSuccessful,
          failedActions: newFailed,
        })
        .where(eq(creditScores.agentId, transaction.agentId));
    } else {
      await db.insert(creditScores).values({
        agentId: transaction.agentId,
        agentType: transaction.agentType,
        totalCredits: transaction.amount,
        accuracyRate: transaction.amount > 0 ? 100 : 0,
        successfulActions: transaction.amount > 0 ? 1 : 0,
        failedActions: transaction.amount < 0 ? 1 : 0,
      });
    }
  }

  // Memory
  async getMemoryEntries(filters?: any): Promise<MemoryEntry[]> {
    const results = filters?.strategyType
      ? await db
          .select()
          .from(memoryEntries)
          .where(eq(memoryEntries.strategyType, filters.strategyType))
          .orderBy(desc(memoryEntries.timestamp))
          .limit(100)
      : await db
          .select()
          .from(memoryEntries)
          .orderBy(desc(memoryEntries.timestamp))
          .limit(100);

    return results.map((entry) => ({
      ...entry,
      priceAnomaly: entry.priceAnomaly || undefined,
      timestamp: entry.timestamp.getTime(),
    }));
  }

  async addMemoryEntry(entry: MemoryEntry): Promise<MemoryEntry> {
    const entryDate = typeof entry.timestamp === 'number'
      ? new Date(entry.timestamp)
      : entry.timestamp;

    const [result] = await db
      .insert(memoryEntries)
      .values({
        ...entry,
        timestamp: entryDate,
      })
      .returning();

    return {
      ...result,
      priceAnomaly: result.priceAnomaly || undefined,
      timestamp: result.timestamp.getTime(),
    };
  }

  // Simulations
  async getSimulations(): Promise<SimulationBranch[]> {
    const results = await db
      .select()
      .from(simulations)
      .orderBy(desc(simulations.timestamp))
      .limit(50);

    return results.map((sim) => ({
      ...sim,
      parentId: sim.parentId || null,
    }));
  }

  async addSimulation(simulation: SimulationBranch): Promise<SimulationBranch> {
    const [result] = await db
      .insert(simulations)
      .values({
        ...simulation,
        evScore: Math.round(simulation.evScore), // Round to integer for DB
        timestamp: new Date(),
      })
      .returning();

    return {
      ...result,
      parentId: result.parentId || null,
    };
  }

  // Replay
  async getReplayEvents(filters?: any): Promise<ReplayEvent[]> {
    const conditions = [];
    if (filters?.startTime) {
      conditions.push(sql`${replayEvents.timestamp} >= ${new Date(filters.startTime)}`);
    }
    if (filters?.endTime) {
      conditions.push(sql`${replayEvents.timestamp} <= ${new Date(filters.endTime)}`);
    }
    if (filters?.eventType) {
      conditions.push(eq(replayEvents.eventType, filters.eventType));
    }

    const results =
      conditions.length > 0
        ? await db
            .select()
            .from(replayEvents)
            .where(and(...conditions))
            .orderBy(desc(replayEvents.timestamp))
            .limit(500)
        : await db
            .select()
            .from(replayEvents)
            .orderBy(desc(replayEvents.timestamp))
            .limit(500);

    return results.map((event) => ({
      ...event,
      agentType: event.agentType || undefined,
      timestamp: event.timestamp.getTime(),
    }));
  }

  async addReplayEvent(event: ReplayEvent): Promise<ReplayEvent> {
    const eventDate = typeof event.timestamp === 'number'
      ? new Date(event.timestamp)
      : event.timestamp;

    const [result] = await db
      .insert(replayEvents)
      .values({
        ...event,
        timestamp: eventDate,
      })
      .onConflictDoNothing()
      .returning();

    if (!result) {
      return event;
    }

    return {
      ...result,
      agentType: result.agentType || undefined,
      timestamp: result.timestamp.getTime(),
    };
  }

  // Alerts
  async getAlerts(filters?: any): Promise<SentinelAlert[]> {
    const conditions = [];
    if (filters?.severity) {
      conditions.push(eq(alerts.severity, filters.severity));
    }
    if (filters?.alertType) {
      conditions.push(eq(alerts.alertType, filters.alertType));
    }

    const results =
      conditions.length > 0
        ? await db
            .select()
            .from(alerts)
            .where(and(...conditions))
            .orderBy(desc(alerts.timestamp))
            .limit(100)
        : await db
            .select()
            .from(alerts)
            .orderBy(desc(alerts.timestamp))
            .limit(100);

    return results.map((alert) => ({
      ...alert,
      timestamp: alert.timestamp.getTime(),
    }));
  }

  async addAlert(alert: SentinelAlert): Promise<SentinelAlert> {
    const alertDate = typeof alert.timestamp === 'number'
      ? new Date(alert.timestamp)
      : alert.timestamp;

    const [result] = await db
      .insert(alerts)
      .values({
        ...alert,
        timestamp: alertDate,
      })
      .returning();

    return {
      ...result,
      timestamp: result.timestamp.getTime(),
    };
  }

  // Chain Transactions
  async getChainTransactions(filters?: any): Promise<ChainTransaction[]> {
    const conditions = [];
    if (filters?.chainId) {
      conditions.push(eq(chainTransactions.chainId, filters.chainId));
    }
    if (filters?.status) {
      conditions.push(eq(chainTransactions.status, filters.status));
    }

    const results =
      conditions.length > 0
        ? await db
            .select()
            .from(chainTransactions)
            .where(and(...conditions))
            .orderBy(desc(chainTransactions.timestamp))
            .limit(100)
        : await db
            .select()
            .from(chainTransactions)
            .orderBy(desc(chainTransactions.timestamp))
            .limit(100);

    return results.map((tx) => ({
      ...tx,
      timestamp: tx.timestamp.getTime(),
      blockNumber: tx.blockNumber || undefined,
    }));
  }

  async addChainTransaction(tx: ChainTransaction): Promise<ChainTransaction> {
    const txDate = typeof tx.timestamp === 'number'
      ? new Date(tx.timestamp)
      : tx.timestamp;

    const [result] = await db
      .insert(chainTransactions)
      .values({
        ...tx,
        timestamp: txDate,
      })
      .returning();

    return {
      ...result,
      timestamp: result.timestamp.getTime(),
      blockNumber: result.blockNumber || undefined,
    };
  }

  async updateChainTransaction(id: string, updates: Partial<ChainTransaction>): Promise<ChainTransaction | undefined> {
    // Normalize timestamp to Date if provided as number
    const normalizedUpdates = { ...updates };
    if (typeof normalizedUpdates.timestamp === 'number') {
      (normalizedUpdates as any).timestamp = new Date(normalizedUpdates.timestamp);
    }
    
    const [result] = await db
      .update(chainTransactions)
      .set(normalizedUpdates)
      .where(eq(chainTransactions.id, id))
      .returning();

    if (!result) return undefined;

    return {
      ...result,
      timestamp: result.timestamp.getTime(),
      blockNumber: result.blockNumber || undefined,
    };
  }

  // Solana Wallets
  async getSolanaWallets(): Promise<SolanaWallet[]> {
    const results = await db.select().from(solanaWallets).where(eq(solanaWallets.connected, true));
    return results.map((w) => ({
      ...w,
      connectedAt: w.connectedAt.getTime(),
      lastUpdated: w.lastUpdated.getTime(),
    }));
  }

  async getSolanaWallet(address: string): Promise<SolanaWallet | undefined> {
    const [wallet] = await db.select().from(solanaWallets).where(eq(solanaWallets.address, address));
    if (!wallet) return undefined;
    return {
      ...wallet,
      connectedAt: wallet.connectedAt.getTime(),
      lastUpdated: wallet.lastUpdated.getTime(),
    };
  }

  async addSolanaWallet(wallet: SolanaWallet): Promise<SolanaWallet> {
    const [result] = await db
      .insert(solanaWallets)
      .values({
        ...wallet,
        connectedAt: new Date(wallet.connectedAt),
        lastUpdated: new Date(wallet.lastUpdated),
      })
      .onConflictDoUpdate({
        target: solanaWallets.address,
        set: { connected: true, lastUpdated: new Date() },
      })
      .returning();
    return {
      ...result,
      connectedAt: result.connectedAt.getTime(),
      lastUpdated: result.lastUpdated.getTime(),
    };
  }

  async updateSolanaWallet(address: string, updates: Partial<SolanaWallet>): Promise<SolanaWallet | undefined> {
    const [result] = await db
      .update(solanaWallets)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(solanaWallets.address, address))
      .returning();
    if (!result) return undefined;
    return {
      ...result,
      connectedAt: result.connectedAt.getTime(),
      lastUpdated: result.lastUpdated.getTime(),
    };
  }

  async removeSolanaWallet(address: string): Promise<boolean> {
    const result = await db.update(solanaWallets).set({ connected: false }).where(eq(solanaWallets.address, address));
    return true;
  }

  // ==========================================
  // Marketplace - Agent Templates
  // ==========================================

  async getAgentTemplates(filters?: { strategyType?: string; riskTolerance?: string; featured?: boolean }): Promise<AgentTemplate[]> {
    const conditions = [];
    if (filters?.strategyType) conditions.push(eq(agentTemplates.strategyType, filters.strategyType as any));
    if (filters?.riskTolerance) conditions.push(eq(agentTemplates.riskTolerance, filters.riskTolerance as any));
    if (filters?.featured !== undefined) conditions.push(eq(agentTemplates.featured, filters.featured));

    const results = conditions.length > 0
      ? await db.select().from(agentTemplates).where(and(...conditions)).orderBy(desc(agentTemplates.performanceScore))
      : await db.select().from(agentTemplates).orderBy(desc(agentTemplates.performanceScore));

    return results.map((t) => ({
      ...t,
      imageUrl: t.imageUrl || undefined,
      createdAt: t.createdAt.getTime(),
    }));
  }

  async getAgentTemplate(id: string): Promise<AgentTemplate | undefined> {
    const [template] = await db.select().from(agentTemplates).where(eq(agentTemplates.id, id));
    if (!template) return undefined;
    return {
      ...template,
      imageUrl: template.imageUrl || undefined,
      createdAt: template.createdAt.getTime(),
    };
  }

  async createAgentTemplate(template: InsertAgentTemplate): Promise<AgentTemplate> {
    const [result] = await db
      .insert(agentTemplates)
      .values({
        ...template,
        id: template.id || randomUUID(),
      })
      .returning();
    return {
      ...result,
      imageUrl: result.imageUrl || undefined,
      createdAt: result.createdAt.getTime(),
    };
  }

  async updateAgentTemplate(id: string, updates: Partial<AgentTemplate>): Promise<AgentTemplate | undefined> {
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    if (Object.keys(cleanedUpdates).length === 0) {
      return this.getAgentTemplate(id);
    }
    const [result] = await db.update(agentTemplates).set(cleanedUpdates).where(eq(agentTemplates.id, id)).returning();
    if (!result) return undefined;
    return {
      ...result,
      imageUrl: result.imageUrl || undefined,
      createdAt: result.createdAt.getTime(),
    };
  }

  // ==========================================
  // Marketplace - Listings
  // ==========================================

  async getMarketplaceListings(filters?: { status?: string; chain?: string; sellerId?: string }): Promise<MarketplaceListing[]> {
    const conditions = [];
    if (filters?.status) conditions.push(eq(marketplaceListings.status, filters.status as ListingStatus));
    if (filters?.chain) conditions.push(eq(marketplaceListings.chain, filters.chain as any));
    if (filters?.sellerId) conditions.push(eq(marketplaceListings.sellerId, filters.sellerId));

    const results = conditions.length > 0
      ? await db.select().from(marketplaceListings).where(and(...conditions)).orderBy(desc(marketplaceListings.createdAt))
      : await db.select().from(marketplaceListings).orderBy(desc(marketplaceListings.createdAt));

    return results.map((l) => ({
      ...l,
      nftTokenId: l.nftTokenId || undefined,
      nftContractAddress: l.nftContractAddress || undefined,
      buyerId: l.buyerId || undefined,
      createdAt: l.createdAt.getTime(),
      updatedAt: l.updatedAt.getTime(),
      soldAt: l.soldAt?.getTime(),
    }));
  }

  async getMarketplaceListing(id: string): Promise<MarketplaceListing | undefined> {
    const [listing] = await db.select().from(marketplaceListings).where(eq(marketplaceListings.id, id));
    if (!listing) return undefined;
    return {
      ...listing,
      nftTokenId: listing.nftTokenId || undefined,
      nftContractAddress: listing.nftContractAddress || undefined,
      buyerId: listing.buyerId || undefined,
      createdAt: listing.createdAt.getTime(),
      updatedAt: listing.updatedAt.getTime(),
      soldAt: listing.soldAt?.getTime(),
    };
  }

  async createMarketplaceListing(listing: InsertMarketplaceListing): Promise<MarketplaceListing> {
    const [result] = await db
      .insert(marketplaceListings)
      .values({
        ...listing,
        id: listing.id || randomUUID(),
        status: ListingStatus.ACTIVE,
      })
      .returning();
    return {
      ...result,
      nftTokenId: result.nftTokenId || undefined,
      nftContractAddress: result.nftContractAddress || undefined,
      buyerId: result.buyerId || undefined,
      createdAt: result.createdAt.getTime(),
      updatedAt: result.updatedAt.getTime(),
      soldAt: result.soldAt?.getTime(),
    };
  }

  async updateMarketplaceListing(id: string, updates: Partial<MarketplaceListing>): Promise<MarketplaceListing | undefined> {
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    if (Object.keys(cleanedUpdates).length === 0) {
      return this.getMarketplaceListing(id);
    }
    const [result] = await db
      .update(marketplaceListings)
      .set({ ...cleanedUpdates, updatedAt: new Date() })
      .where(eq(marketplaceListings.id, id))
      .returning();
    if (!result) return undefined;
    return {
      ...result,
      nftTokenId: result.nftTokenId || undefined,
      nftContractAddress: result.nftContractAddress || undefined,
      buyerId: result.buyerId || undefined,
      createdAt: result.createdAt.getTime(),
      updatedAt: result.updatedAt.getTime(),
      soldAt: result.soldAt?.getTime(),
    };
  }

  // ==========================================
  // Marketplace - Rentals
  // ==========================================

  async getAgentRentals(filters?: { renterId?: string; ownerId?: string; status?: string }): Promise<AgentRental[]> {
    const conditions = [];
    if (filters?.renterId) conditions.push(eq(agentRentals.renterId, filters.renterId));
    if (filters?.ownerId) conditions.push(eq(agentRentals.ownerId, filters.ownerId));
    if (filters?.status) conditions.push(eq(agentRentals.status, filters.status as any));

    const results = conditions.length > 0
      ? await db.select().from(agentRentals).where(and(...conditions)).orderBy(desc(agentRentals.createdAt))
      : await db.select().from(agentRentals).orderBy(desc(agentRentals.createdAt));

    return results.map((r) => ({
      ...r,
      startDate: r.startDate.getTime(),
      endDate: r.endDate.getTime(),
      createdAt: r.createdAt.getTime(),
    }));
  }

  async getAgentRental(id: string): Promise<AgentRental | undefined> {
    const [rental] = await db.select().from(agentRentals).where(eq(agentRentals.id, id));
    if (!rental) return undefined;
    return {
      ...rental,
      startDate: rental.startDate.getTime(),
      endDate: rental.endDate.getTime(),
      createdAt: rental.createdAt.getTime(),
    };
  }

  async createAgentRental(rental: InsertAgentRental): Promise<AgentRental> {
    const [result] = await db
      .insert(agentRentals)
      .values({
        ...rental,
        id: rental.id || randomUUID(),
        startDate: new Date(rental.startDate),
        endDate: new Date(rental.endDate),
      })
      .returning();
    return {
      ...result,
      startDate: result.startDate.getTime(),
      endDate: result.endDate.getTime(),
      createdAt: result.createdAt.getTime(),
    };
  }

  async updateAgentRental(id: string, updates: Partial<AgentRental>): Promise<AgentRental | undefined> {
    const cleanedUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );
    if (Object.keys(cleanedUpdates).length === 0) {
      return this.getAgentRental(id);
    }
    const [result] = await db.update(agentRentals).set(cleanedUpdates).where(eq(agentRentals.id, id)).returning();
    if (!result) return undefined;
    return {
      ...result,
      startDate: result.startDate.getTime(),
      endDate: result.endDate.getTime(),
      createdAt: result.createdAt.getTime(),
    };
  }

  // ==========================================
  // Marketplace - NFTs
  // ==========================================

  async getAgentNFTs(filters?: { ownerAddress?: string; chain?: string }): Promise<AgentNFT[]> {
    const conditions = [];
    if (filters?.ownerAddress) conditions.push(eq(agentNFTs.ownerAddress, filters.ownerAddress));
    if (filters?.chain) conditions.push(eq(agentNFTs.chain, filters.chain as any));

    const results = conditions.length > 0
      ? await db.select().from(agentNFTs).where(and(...conditions)).orderBy(desc(agentNFTs.mintedAt))
      : await db.select().from(agentNFTs).orderBy(desc(agentNFTs.mintedAt));

    return results.map((n) => ({
      ...n,
      mintedAt: n.mintedAt.getTime(),
    }));
  }

  async getAgentNFT(id: string): Promise<AgentNFT | undefined> {
    const [nft] = await db.select().from(agentNFTs).where(eq(agentNFTs.id, id));
    if (!nft) return undefined;
    return {
      ...nft,
      mintedAt: nft.mintedAt.getTime(),
    };
  }

  async createAgentNFT(nft: InsertAgentNFT): Promise<AgentNFT> {
    const [result] = await db
      .insert(agentNFTs)
      .values({
        ...nft,
        id: nft.id || randomUUID(),
      })
      .returning();
    return {
      ...result,
      mintedAt: result.mintedAt.getTime(),
    };
  }

  // ==========================================
  // Leaderboard
  // ==========================================

  async getLeaderboard(period?: "daily" | "weekly" | "monthly" | "all_time"): Promise<LeaderboardEntry[]> {
    const results = period
      ? await db.select().from(leaderboard).where(eq(leaderboard.period, period)).orderBy(leaderboard.rank)
      : await db.select().from(leaderboard).orderBy(leaderboard.rank);

    return results.map((e) => ({
      agentId: e.agentId,
      templateId: e.templateId,
      rank: e.rank,
      performanceScore: e.performanceScore,
      totalReturn: e.totalReturn,
      successRate: e.successRate,
      totalTrades: e.totalTrades,
      avgTradeSize: e.avgTradeSize,
      riskAdjustedReturn: e.riskAdjustedReturn,
      period: e.period,
    }));
  }

  async updateLeaderboard(entries: LeaderboardEntry[]): Promise<void> {
    for (const entry of entries) {
      await db
        .insert(leaderboard)
        .values({
          id: `${entry.agentId}-${entry.period}`,
          ...entry,
        })
        .onConflictDoUpdate({
          target: leaderboard.id,
          set: entry,
        });
    }
  }

  // ==========================================
  // Seller Profiles (Stripe Connect)
  // ==========================================

  async getSellerProfile(walletAddress: string): Promise<SellerProfile | undefined> {
    const [result] = await db
      .select()
      .from(sellerProfiles)
      .where(eq(sellerProfiles.walletAddress, walletAddress));
    
    if (!result) return undefined;
    
    return {
      id: result.id,
      walletAddress: result.walletAddress,
      email: result.email ?? undefined,
      stripeAccountId: result.stripeAccountId ?? undefined,
      stripeOnboardingComplete: result.stripeOnboardingComplete,
      totalEarnings: result.totalEarnings,
      totalSales: result.totalSales,
      createdAt: result.createdAt.getTime(),
      updatedAt: result.updatedAt.getTime(),
    };
  }

  async getSellerProfileById(id: string): Promise<SellerProfile | undefined> {
    const [result] = await db
      .select()
      .from(sellerProfiles)
      .where(eq(sellerProfiles.id, id));
    
    if (!result) return undefined;
    
    return {
      id: result.id,
      walletAddress: result.walletAddress,
      email: result.email ?? undefined,
      stripeAccountId: result.stripeAccountId ?? undefined,
      stripeOnboardingComplete: result.stripeOnboardingComplete,
      totalEarnings: result.totalEarnings,
      totalSales: result.totalSales,
      createdAt: result.createdAt.getTime(),
      updatedAt: result.updatedAt.getTime(),
    };
  }

  async createSellerProfile(profile: InsertSellerProfile): Promise<SellerProfile> {
    const [result] = await db
      .insert(sellerProfiles)
      .values({
        id: profile.id || randomUUID(),
        walletAddress: profile.walletAddress,
        email: profile.email,
        stripeAccountId: profile.stripeAccountId,
      })
      .returning();
    
    return {
      id: result.id,
      walletAddress: result.walletAddress,
      email: result.email ?? undefined,
      stripeAccountId: result.stripeAccountId ?? undefined,
      stripeOnboardingComplete: result.stripeOnboardingComplete,
      totalEarnings: result.totalEarnings,
      totalSales: result.totalSales,
      createdAt: result.createdAt.getTime(),
      updatedAt: result.updatedAt.getTime(),
    };
  }

  async updateSellerProfile(id: string, updates: Partial<SellerProfile>): Promise<SellerProfile | undefined> {
    const updateData: any = {};
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.stripeAccountId !== undefined) updateData.stripeAccountId = updates.stripeAccountId;
    if (updates.stripeOnboardingComplete !== undefined) updateData.stripeOnboardingComplete = updates.stripeOnboardingComplete;
    if (updates.totalEarnings !== undefined) updateData.totalEarnings = updates.totalEarnings;
    if (updates.totalSales !== undefined) updateData.totalSales = updates.totalSales;
    updateData.updatedAt = new Date();

    const [result] = await db
      .update(sellerProfiles)
      .set(updateData)
      .where(eq(sellerProfiles.id, id))
      .returning();
    
    if (!result) return undefined;
    
    return {
      id: result.id,
      walletAddress: result.walletAddress,
      email: result.email ?? undefined,
      stripeAccountId: result.stripeAccountId ?? undefined,
      stripeOnboardingComplete: result.stripeOnboardingComplete,
      totalEarnings: result.totalEarnings,
      totalSales: result.totalSales,
      createdAt: result.createdAt.getTime(),
      updatedAt: result.updatedAt.getTime(),
    };
  }
}
