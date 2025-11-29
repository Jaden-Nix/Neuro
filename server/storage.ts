import type {
  Agent,
  LogEntry,
  LiveMetrics,
  AgentCreditScore,
  CreditTransaction,
  MemoryEntry,
  SimulationBranch,
  ReplayEvent,
  SentinelAlert,
  SystemState,
  ChainTransaction,
  SolanaWallet,
  AgentTemplate,
  MarketplaceListing,
  AgentRental,
  AgentNFT,
  LeaderboardEntry,
  SellerProfile,
  InsertAgentTemplate,
  InsertMarketplaceListing,
  InsertAgentRental,
  InsertAgentNFT,
  InsertSellerProfile,
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // System State
  getSystemState(): Promise<SystemState>;
  updateSystemState(state: Partial<SystemState>): Promise<SystemState>;

  // Agents
  getAgents(): Promise<Agent[]>;
  getAgent(id: string): Promise<Agent | undefined>;
  upsertAgent(agent: Agent): Promise<Agent>;
  clearAgents(): Promise<void>;

  // Logs
  getLogs(limit?: number): Promise<LogEntry[]>;
  addLog(log: Omit<LogEntry, "id">): Promise<LogEntry>;

  // Metrics
  getMetrics(): Promise<LiveMetrics>;
  updateMetrics(metrics: Partial<LiveMetrics>): Promise<LiveMetrics>;

  // Credits
  getCreditScores(): Promise<AgentCreditScore[]>;
  getCreditTransactions(agentId?: string, limit?: number): Promise<CreditTransaction[]>;
  addCreditTransaction(transaction: CreditTransaction): Promise<void>;

  // Memory
  getMemoryEntries(filters?: any): Promise<MemoryEntry[]>;
  addMemoryEntry(entry: MemoryEntry): Promise<MemoryEntry>;

  // Simulations
  getSimulations(): Promise<SimulationBranch[]>;
  addSimulation(simulation: SimulationBranch): Promise<SimulationBranch>;
  getCurrentOpportunity(): Promise<any | null>;
  setCurrentOpportunity(opportunity: any): Promise<void>;

  // Replay
  getReplayEvents(filters?: any): Promise<ReplayEvent[]>;
  addReplayEvent(event: ReplayEvent): Promise<ReplayEvent>;

  // Alerts
  getAlerts(filters?: any): Promise<SentinelAlert[]>;
  addAlert(alert: SentinelAlert): Promise<SentinelAlert>;

  // Chain Transactions
  getChainTransactions(filters?: any): Promise<ChainTransaction[]>;
  addChainTransaction(tx: ChainTransaction): Promise<ChainTransaction>;
  updateChainTransaction(id: string, updates: Partial<ChainTransaction>): Promise<ChainTransaction | undefined>;

  // Solana Wallets
  getSolanaWallets(): Promise<SolanaWallet[]>;
  getSolanaWallet(address: string): Promise<SolanaWallet | undefined>;
  addSolanaWallet(wallet: SolanaWallet): Promise<SolanaWallet>;
  updateSolanaWallet(address: string, updates: Partial<SolanaWallet>): Promise<SolanaWallet | undefined>;
  removeSolanaWallet(address: string): Promise<boolean>;

  // Marketplace - Agent Templates
  getAgentTemplates(filters?: { strategyType?: string; riskTolerance?: string; featured?: boolean }): Promise<AgentTemplate[]>;
  getAgentTemplate(id: string): Promise<AgentTemplate | undefined>;
  createAgentTemplate(template: InsertAgentTemplate): Promise<AgentTemplate>;
  updateAgentTemplate(id: string, updates: Partial<AgentTemplate>): Promise<AgentTemplate | undefined>;

  // Marketplace - Listings
  getMarketplaceListings(filters?: { status?: string; chain?: string; sellerId?: string }): Promise<MarketplaceListing[]>;
  getMarketplaceListing(id: string): Promise<MarketplaceListing | undefined>;
  createMarketplaceListing(listing: InsertMarketplaceListing): Promise<MarketplaceListing>;
  updateMarketplaceListing(id: string, updates: Partial<MarketplaceListing>): Promise<MarketplaceListing | undefined>;

  // Marketplace - Rentals
  getAgentRentals(filters?: { renterId?: string; ownerId?: string; status?: string }): Promise<AgentRental[]>;
  getAgentRental(id: string): Promise<AgentRental | undefined>;
  createAgentRental(rental: InsertAgentRental): Promise<AgentRental>;
  updateAgentRental(id: string, updates: Partial<AgentRental>): Promise<AgentRental | undefined>;

  // Marketplace - NFTs
  getAgentNFTs(filters?: { ownerAddress?: string; chain?: string }): Promise<AgentNFT[]>;
  getAgentNFT(id: string): Promise<AgentNFT | undefined>;
  createAgentNFT(nft: InsertAgentNFT): Promise<AgentNFT>;

  // Leaderboard
  getLeaderboard(period?: "daily" | "weekly" | "monthly" | "all_time"): Promise<LeaderboardEntry[]>;
  updateLeaderboard(entries: LeaderboardEntry[]): Promise<void>;

  // Seller Profiles (Stripe Connect)
  getSellerProfile(walletAddress: string): Promise<SellerProfile | undefined>;
  getSellerProfileById(id: string): Promise<SellerProfile | undefined>;
  createSellerProfile(profile: InsertSellerProfile): Promise<SellerProfile>;
  updateSellerProfile(id: string, updates: Partial<SellerProfile>): Promise<SellerProfile | undefined>;
}

export class MemStorage implements IStorage {
  private systemState: SystemState;
  private agents: Map<string, Agent>;
  private logs: LogEntry[];
  private metrics: LiveMetrics;
  private creditScores: Map<string, AgentCreditScore>;
  private creditTransactions: CreditTransaction[];
  private memoryEntries: MemoryEntry[];
  private simulations: SimulationBranch[];
  private replayEvents: ReplayEvent[];
  private alerts: SentinelAlert[];
  private chainTransactions: Map<string, ChainTransaction>;
  private solanaWallets: Map<string, SolanaWallet>;
  private currentOpportunity: any | null;

  constructor() {
    this.systemState = {
      autonomousMode: false,
      activeAgents: [],
      totalSimulationsRun: 0,
      totalTransactionsExecuted: 0,
      systemHealth: 85,
      lastUpdated: Date.now(),
    };

    this.agents = new Map();
    this.logs = [];
    this.creditScores = new Map();
    this.creditTransactions = [];
    this.memoryEntries = [];
    this.simulations = [];
    this.replayEvents = [];
    this.alerts = [];
    this.chainTransactions = new Map();
    this.solanaWallets = new Map();
    this.currentOpportunity = null;

    this.metrics = {
      walletBalance: "1250000",
      totalTVL: "8500000",
      currentAPY: 12.5,
      riskLevel: 35,
      activeOpportunities: 7,
      pendingTransactions: 2,
      timestamp: Date.now(),
    };
  }

  async getSystemState(): Promise<SystemState> {
    return this.systemState;
  }

  async updateSystemState(state: Partial<SystemState>): Promise<SystemState> {
    this.systemState = { ...this.systemState, ...state, lastUpdated: Date.now() };
    return this.systemState;
  }

  async getAgents(): Promise<Agent[]> {
    return Array.from(this.agents.values());
  }

  async getAgent(id: string): Promise<Agent | undefined> {
    return this.agents.get(id);
  }

  async upsertAgent(agent: Agent): Promise<Agent> {
    this.agents.set(agent.id, agent);
    return agent;
  }

  async clearAgents(): Promise<void> {
    this.agents.clear();
  }

  async getLogs(limit: number = 250): Promise<LogEntry[]> {
    return this.logs.slice(-limit);
  }

  async addLog(log: Omit<LogEntry, "id">): Promise<LogEntry> {
    const fullLog: LogEntry = {
      ...log,
      id: randomUUID(),
    };
    this.logs.push(fullLog);
    
    // Keep only last 500 logs
    if (this.logs.length > 500) {
      this.logs = this.logs.slice(-500);
    }
    
    return fullLog;
  }

  async getMetrics(): Promise<LiveMetrics> {
    return { ...this.metrics, timestamp: Date.now() };
  }

  async updateMetrics(metrics: Partial<LiveMetrics>): Promise<LiveMetrics> {
    this.metrics = { ...this.metrics, ...metrics, timestamp: Date.now() };
    return this.metrics;
  }

  async getCreditScores(): Promise<AgentCreditScore[]> {
    return Array.from(this.creditScores.values());
  }

  async getCreditTransactions(agentId?: string, limit: number = 100): Promise<CreditTransaction[]> {
    let filtered = this.creditTransactions;
    if (agentId) {
      filtered = filtered.filter((t) => t.agentId === agentId);
    }
    return filtered.slice(-limit);
  }

  async addCreditTransaction(transaction: CreditTransaction): Promise<void> {
    this.creditTransactions.push(transaction);
    
    // Update credit score
    const existing = this.creditScores.get(transaction.agentId);
    if (existing) {
      existing.totalCredits += transaction.amount;
      if (transaction.amount > 0) {
        existing.successfulActions++;
      } else {
        existing.failedActions++;
      }
      existing.accuracyRate =
        existing.successfulActions / (existing.successfulActions + existing.failedActions);
    } else {
      this.creditScores.set(transaction.agentId, {
        agentId: transaction.agentId,
        agentType: transaction.agentType,
        totalCredits: transaction.amount,
        accuracyRate: transaction.amount > 0 ? 1 : 0,
        successfulActions: transaction.amount > 0 ? 1 : 0,
        failedActions: transaction.amount <= 0 ? 1 : 0,
      });
    }
  }

  async getMemoryEntries(filters?: any): Promise<MemoryEntry[]> {
    let results = [...this.memoryEntries];
    
    if (filters?.strategyType) {
      results = results.filter((e) => e.strategyType === filters.strategyType);
    }
    
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  async addMemoryEntry(entry: MemoryEntry): Promise<MemoryEntry> {
    this.memoryEntries.push(entry);
    return entry;
  }

  async getSimulations(): Promise<SimulationBranch[]> {
    return [...this.simulations].sort((a, b) => b.evScore - a.evScore);
  }

  async addSimulation(simulation: SimulationBranch): Promise<SimulationBranch> {
    this.simulations.push(simulation);
    return simulation;
  }

  async getCurrentOpportunity(): Promise<any | null> {
    return this.currentOpportunity;
  }

  async setCurrentOpportunity(opportunity: any): Promise<void> {
    this.currentOpportunity = opportunity;
  }

  async getReplayEvents(filters?: any): Promise<ReplayEvent[]> {
    let results = [...this.replayEvents];
    
    if (filters?.startTime) {
      results = results.filter((e) => e.timestamp >= filters.startTime);
    }
    
    if (filters?.endTime) {
      results = results.filter((e) => e.timestamp <= filters.endTime);
    }
    
    if (filters?.eventType) {
      results = results.filter((e) => e.eventType === filters.eventType);
    }
    
    return results.sort((a, b) => a.timestamp - b.timestamp);
  }

  async addReplayEvent(event: ReplayEvent): Promise<ReplayEvent> {
    this.replayEvents.push(event);
    
    // Keep only last 1000 events
    if (this.replayEvents.length > 1000) {
      this.replayEvents = this.replayEvents.slice(-1000);
    }
    
    return event;
  }

  async getAlerts(filters?: any): Promise<SentinelAlert[]> {
    let results = [...this.alerts];
    
    if (filters?.severity) {
      results = results.filter((a) => a.severity === filters.severity);
    }
    
    if (filters?.alertType) {
      results = results.filter((a) => a.alertType === filters.alertType);
    }
    
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  async addAlert(alert: SentinelAlert): Promise<SentinelAlert> {
    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
    
    return alert;
  }

  async getChainTransactions(filters?: any): Promise<ChainTransaction[]> {
    let results = Array.from(this.chainTransactions.values());
    
    if (filters?.chainId) {
      results = results.filter((tx) => tx.chainId === filters.chainId);
    }
    
    if (filters?.status) {
      results = results.filter((tx) => tx.status === filters.status);
    }
    
    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  async addChainTransaction(tx: ChainTransaction): Promise<ChainTransaction> {
    this.chainTransactions.set(tx.id, tx);
    return tx;
  }

  async updateChainTransaction(id: string, updates: Partial<ChainTransaction>): Promise<ChainTransaction | undefined> {
    const existing = this.chainTransactions.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates };
    this.chainTransactions.set(id, updated);
    return updated;
  }

  async getSolanaWallets(): Promise<SolanaWallet[]> {
    return Array.from(this.solanaWallets.values());
  }

  async getSolanaWallet(address: string): Promise<SolanaWallet | undefined> {
    return this.solanaWallets.get(address);
  }

  async addSolanaWallet(wallet: SolanaWallet): Promise<SolanaWallet> {
    this.solanaWallets.set(wallet.address, wallet);
    return wallet;
  }

  async updateSolanaWallet(address: string, updates: Partial<SolanaWallet>): Promise<SolanaWallet | undefined> {
    const existing = this.solanaWallets.get(address);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...updates, lastUpdated: Date.now() };
    this.solanaWallets.set(address, updated);
    return updated;
  }

  async removeSolanaWallet(address: string): Promise<boolean> {
    return this.solanaWallets.delete(address);
  }

  // Marketplace - Agent Templates (stub implementations for MemStorage)
  private agentTemplates: Map<string, AgentTemplate> = new Map();
  private marketplaceListings: Map<string, MarketplaceListing> = new Map();
  private agentRentals: Map<string, AgentRental> = new Map();
  private agentNFTs: Map<string, AgentNFT> = new Map();
  private leaderboardEntries: LeaderboardEntry[] = [];

  async getAgentTemplates(filters?: { strategyType?: string; riskTolerance?: string; featured?: boolean }): Promise<AgentTemplate[]> {
    let results = Array.from(this.agentTemplates.values());
    if (filters?.strategyType) results = results.filter(t => t.strategyType === filters.strategyType);
    if (filters?.riskTolerance) results = results.filter(t => t.riskTolerance === filters.riskTolerance);
    if (filters?.featured !== undefined) results = results.filter(t => t.featured === filters.featured);
    return results;
  }

  async getAgentTemplate(id: string): Promise<AgentTemplate | undefined> {
    return this.agentTemplates.get(id);
  }

  async createAgentTemplate(template: InsertAgentTemplate): Promise<AgentTemplate> {
    const fullTemplate: AgentTemplate = {
      ...template,
      id: template.id || randomUUID(),
      performanceScore: 0,
      totalDeployments: 0,
      createdAt: Date.now(),
    };
    this.agentTemplates.set(fullTemplate.id, fullTemplate);
    return fullTemplate;
  }

  async updateAgentTemplate(id: string, updates: Partial<AgentTemplate>): Promise<AgentTemplate | undefined> {
    const existing = this.agentTemplates.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.agentTemplates.set(id, updated);
    return updated;
  }

  async getMarketplaceListings(filters?: { status?: string; chain?: string; sellerId?: string }): Promise<MarketplaceListing[]> {
    let results = Array.from(this.marketplaceListings.values());
    if (filters?.status) results = results.filter(l => l.status === filters.status);
    if (filters?.chain) results = results.filter(l => l.chain === filters.chain);
    if (filters?.sellerId) results = results.filter(l => l.sellerId === filters.sellerId);
    return results;
  }

  async getMarketplaceListing(id: string): Promise<MarketplaceListing | undefined> {
    return this.marketplaceListings.get(id);
  }

  async createMarketplaceListing(listing: InsertMarketplaceListing): Promise<MarketplaceListing> {
    const fullListing: MarketplaceListing = {
      ...listing,
      id: listing.id || randomUUID(),
      status: "active" as any,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.marketplaceListings.set(fullListing.id, fullListing);
    return fullListing;
  }

  async updateMarketplaceListing(id: string, updates: Partial<MarketplaceListing>): Promise<MarketplaceListing | undefined> {
    const existing = this.marketplaceListings.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    this.marketplaceListings.set(id, updated);
    return updated;
  }

  async getAgentRentals(filters?: { renterId?: string; ownerId?: string; status?: string }): Promise<AgentRental[]> {
    let results = Array.from(this.agentRentals.values());
    if (filters?.renterId) results = results.filter(r => r.renterId === filters.renterId);
    if (filters?.ownerId) results = results.filter(r => r.ownerId === filters.ownerId);
    if (filters?.status) results = results.filter(r => r.status === filters.status);
    return results;
  }

  async getAgentRental(id: string): Promise<AgentRental | undefined> {
    return this.agentRentals.get(id);
  }

  async createAgentRental(rental: InsertAgentRental): Promise<AgentRental> {
    const fullRental: AgentRental = {
      ...rental,
      id: rental.id || randomUUID(),
      status: "active",
      totalPaid: 0,
      yieldEarned: 0,
      createdAt: Date.now(),
    };
    this.agentRentals.set(fullRental.id, fullRental);
    return fullRental;
  }

  async updateAgentRental(id: string, updates: Partial<AgentRental>): Promise<AgentRental | undefined> {
    const existing = this.agentRentals.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.agentRentals.set(id, updated);
    return updated;
  }

  async getAgentNFTs(filters?: { ownerAddress?: string; chain?: string }): Promise<AgentNFT[]> {
    let results = Array.from(this.agentNFTs.values());
    if (filters?.ownerAddress) results = results.filter(n => n.ownerAddress === filters.ownerAddress);
    if (filters?.chain) results = results.filter(n => n.chain === filters.chain);
    return results;
  }

  async getAgentNFT(id: string): Promise<AgentNFT | undefined> {
    return this.agentNFTs.get(id);
  }

  async createAgentNFT(nft: InsertAgentNFT): Promise<AgentNFT> {
    const fullNFT: AgentNFT = {
      ...nft,
      id: nft.id || randomUUID(),
      mintedAt: Date.now(),
    };
    this.agentNFTs.set(fullNFT.id, fullNFT);
    return fullNFT;
  }

  async getLeaderboard(period?: "daily" | "weekly" | "monthly" | "all_time"): Promise<LeaderboardEntry[]> {
    if (period) {
      return this.leaderboardEntries.filter(e => e.period === period).sort((a, b) => a.rank - b.rank);
    }
    return this.leaderboardEntries.sort((a, b) => a.rank - b.rank);
  }

  async updateLeaderboard(entries: LeaderboardEntry[]): Promise<void> {
    this.leaderboardEntries = entries;
  }

  // Seller Profiles (Stripe Connect) - MemStorage stubs
  private sellerProfiles: Map<string, SellerProfile> = new Map();

  async getSellerProfile(walletAddress: string): Promise<SellerProfile | undefined> {
    return Array.from(this.sellerProfiles.values()).find(p => p.walletAddress === walletAddress);
  }

  async getSellerProfileById(id: string): Promise<SellerProfile | undefined> {
    return this.sellerProfiles.get(id);
  }

  async createSellerProfile(profile: InsertSellerProfile): Promise<SellerProfile> {
    const fullProfile: SellerProfile = {
      ...profile,
      id: profile.id || randomUUID(),
      stripeOnboardingComplete: false,
      totalEarnings: 0,
      totalSales: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    this.sellerProfiles.set(fullProfile.id, fullProfile);
    return fullProfile;
  }

  async updateSellerProfile(id: string, updates: Partial<SellerProfile>): Promise<SellerProfile | undefined> {
    const existing = this.sellerProfiles.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: Date.now() };
    this.sellerProfiles.set(id, updated);
    return updated;
  }
}

// Use DatabaseStorage for persistent PostgreSQL storage with real blockchain data
import { DatabaseStorage } from "./DatabaseStorage";
export const storage = new DatabaseStorage();

// Keep MemStorage for fallback/testing if needed
// export const storage = new MemStorage();
