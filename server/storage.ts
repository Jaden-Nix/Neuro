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
  ReasoningChain,
  ParliamentSession,
  ParliamentDebateEntry,
  ParliamentVote,
  AgentEvolution,
  DreamSession,
  DreamDiscovery,
  StressScenario,
  StressTestRun,
  AgentStressResponse,
  InsertReasoningChain,
  InsertParliamentSession,
  InsertAgentEvolution,
  InsertDreamSession,
  InsertStressScenario,
  InsertStressTestRun,
  AlertPreference,
  AlertEvent,
  InsertAlertPreference,
  InsertAlertEvent,
  AlertTriggerType,
} from "@shared/schema";
import { randomUUID } from "crypto";
import { DatabaseStorage } from "./DatabaseStorage";

const dbStorage = new DatabaseStorage();

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
  clearLogs(): Promise<{ archivedCount: number }>;
  getArchivedLogs(limit?: number): Promise<LogEntry[]>;

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

  // Reasoning Chains (Claude transparency)
  getReasoningChains(filters?: { agentId?: string; topic?: string; limit?: number }): Promise<ReasoningChain[]>;
  getReasoningChain(id: string): Promise<ReasoningChain | undefined>;
  createReasoningChain(chain: InsertReasoningChain): Promise<ReasoningChain>;

  // Parliament Sessions
  getParliamentSessions(filters?: { status?: string; limit?: number }): Promise<ParliamentSession[]>;
  getParliamentSession(id: string): Promise<ParliamentSession | undefined>;
  createParliamentSession(session: InsertParliamentSession): Promise<ParliamentSession>;
  updateParliamentSession(id: string, updates: Partial<ParliamentSession>): Promise<ParliamentSession | undefined>;
  addDebateEntry(sessionId: string, entry: ParliamentDebateEntry): Promise<ParliamentSession | undefined>;
  addVote(sessionId: string, vote: ParliamentVote): Promise<ParliamentSession | undefined>;

  // Agent Evolutions
  getAgentEvolutions(filters?: { agentId?: string; generation?: number; parentAgentId?: string }): Promise<AgentEvolution[]>;
  getAgentEvolution(id: string): Promise<AgentEvolution | undefined>;
  createAgentEvolution(evolution: InsertAgentEvolution): Promise<AgentEvolution>;
  updateAgentEvolution(id: string, updates: Partial<AgentEvolution>): Promise<AgentEvolution | undefined>;

  // Dream Sessions
  getDreamSessions(filters?: { status?: string; limit?: number }): Promise<DreamSession[]>;
  getDreamSession(id: string): Promise<DreamSession | undefined>;
  createDreamSession(session: InsertDreamSession): Promise<DreamSession>;
  updateDreamSession(id: string, updates: Partial<DreamSession>): Promise<DreamSession | undefined>;
  addDreamDiscovery(sessionId: string, discovery: DreamDiscovery): Promise<DreamSession | undefined>;

  // Stress Scenarios
  getStressScenarios(filters?: { category?: string; isTemplate?: boolean }): Promise<StressScenario[]>;
  getStressScenario(id: string): Promise<StressScenario | undefined>;
  createStressScenario(scenario: InsertStressScenario): Promise<StressScenario>;

  // Stress Test Runs
  getStressTestRuns(filters?: { scenarioId?: string; status?: string }): Promise<StressTestRun[]>;
  getStressTestRun(id: string): Promise<StressTestRun | undefined>;
  createStressTestRun(run: InsertStressTestRun): Promise<StressTestRun>;
  updateStressTestRun(id: string, updates: Partial<StressTestRun>): Promise<StressTestRun | undefined>;
  addAgentStressResponse(runId: string, response: AgentStressResponse): Promise<StressTestRun | undefined>;
}

export class MemStorage implements IStorage {
  private systemState: SystemState;
  private agents: Map<string, Agent>;
  private logs: LogEntry[];
  private archivedLogs: LogEntry[];
  private metrics: LiveMetrics;
  private previousMetrics: LiveMetrics | null;
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
    this.archivedLogs = [];
    this.creditScores = new Map();
    this.creditTransactions = [];
    this.memoryEntries = [];
    this.simulations = [];
    this.replayEvents = [];
    this.alerts = [];
    this.chainTransactions = new Map();
    this.solanaWallets = new Map();
    this.currentOpportunity = null;
    this.previousMetrics = null;

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

  async getLogs(limit: number = 100): Promise<LogEntry[]> {
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

  async clearLogs(): Promise<{ archivedCount: number }> {
    const count = this.logs.length;
    // Archive logs before clearing
    this.archivedLogs.push(...this.logs);
    // Keep archive to last 1000 entries
    if (this.archivedLogs.length > 1000) {
      this.archivedLogs = this.archivedLogs.slice(-1000);
    }
    this.logs = [];
    return { archivedCount: count };
  }

  async getArchivedLogs(limit: number = 100): Promise<LogEntry[]> {
    return this.archivedLogs.slice(-limit);
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

  // Reasoning Chains
  private reasoningChains: Map<string, ReasoningChain> = new Map();

  async getReasoningChains(filters?: { agentId?: string; topic?: string; limit?: number }): Promise<ReasoningChain[]> {
    let results = Array.from(this.reasoningChains.values());
    if (filters?.agentId) results = results.filter(r => r.agentId === filters.agentId);
    if (filters?.topic) results = results.filter(r => r.topic === filters.topic);
    results.sort((a, b) => b.timestamp - a.timestamp);
    if (filters?.limit) results = results.slice(0, filters.limit);
    return results;
  }

  async getReasoningChain(id: string): Promise<ReasoningChain | undefined> {
    return this.reasoningChains.get(id);
  }

  async createReasoningChain(chain: InsertReasoningChain): Promise<ReasoningChain> {
    const fullChain: ReasoningChain = {
      ...chain,
      id: chain.id || randomUUID(),
      timestamp: Date.now(),
    };
    this.reasoningChains.set(fullChain.id, fullChain);
    return fullChain;
  }

  // Parliament Sessions - Delegated to DatabaseStorage for persistence
  async getParliamentSessions(filters?: { status?: string; limit?: number }): Promise<ParliamentSession[]> {
    return dbStorage.getParliamentSessions(filters);
  }

  async getParliamentSession(id: string): Promise<ParliamentSession | undefined> {
    return dbStorage.getParliamentSession(id);
  }

  async createParliamentSession(session: InsertParliamentSession): Promise<ParliamentSession> {
    return dbStorage.createParliamentSession(session);
  }

  async updateParliamentSession(id: string, updates: Partial<ParliamentSession>): Promise<ParliamentSession | undefined> {
    return dbStorage.updateParliamentSession(id, updates);
  }

  async addDebateEntry(sessionId: string, entry: ParliamentDebateEntry): Promise<ParliamentSession | undefined> {
    return dbStorage.addDebateEntry(sessionId, entry);
  }

  async addVote(sessionId: string, vote: ParliamentVote): Promise<ParliamentSession | undefined> {
    return dbStorage.addVote(sessionId, vote);
  }

  // Agent Evolutions
  private agentEvolutions: Map<string, AgentEvolution> = new Map();

  async getAgentEvolutions(filters?: { agentId?: string; generation?: number; parentAgentId?: string }): Promise<AgentEvolution[]> {
    let results = Array.from(this.agentEvolutions.values());
    if (filters?.agentId) results = results.filter(e => e.agentId === filters.agentId);
    if (filters?.generation !== undefined) results = results.filter(e => e.generation === filters.generation);
    if (filters?.parentAgentId) results = results.filter(e => e.parentAgentId === filters.parentAgentId);
    results.sort((a, b) => b.spawnedAt - a.spawnedAt);
    return results;
  }

  async getAgentEvolution(id: string): Promise<AgentEvolution | undefined> {
    return this.agentEvolutions.get(id);
  }

  async createAgentEvolution(evolution: InsertAgentEvolution): Promise<AgentEvolution> {
    const fullEvolution: AgentEvolution = {
      ...evolution,
      id: evolution.id || randomUUID(),
      mutations: evolution.mutations || [],
      inheritedTraits: evolution.inheritedTraits || [],
      spawnedAt: Date.now(),
    };
    this.agentEvolutions.set(fullEvolution.id, fullEvolution);
    return fullEvolution;
  }

  async updateAgentEvolution(id: string, updates: Partial<AgentEvolution>): Promise<AgentEvolution | undefined> {
    const existing = this.agentEvolutions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.agentEvolutions.set(id, updated);
    return updated;
  }

  // Dream Sessions
  private dreamSessions: Map<string, DreamSession> = new Map();

  async getDreamSessions(filters?: { status?: string; limit?: number }): Promise<DreamSession[]> {
    let results = Array.from(this.dreamSessions.values());
    if (filters?.status) results = results.filter(s => s.status === filters.status);
    results.sort((a, b) => b.startedAt - a.startedAt);
    if (filters?.limit) results = results.slice(0, filters.limit);
    return results;
  }

  async getDreamSession(id: string): Promise<DreamSession | undefined> {
    return this.dreamSessions.get(id);
  }

  async createDreamSession(session: InsertDreamSession): Promise<DreamSession> {
    const fullSession: DreamSession = {
      ...session,
      id: session.id || randomUUID(),
      discoveries: [],
      startedAt: Date.now(),
    };
    this.dreamSessions.set(fullSession.id, fullSession);
    return fullSession;
  }

  async updateDreamSession(id: string, updates: Partial<DreamSession>): Promise<DreamSession | undefined> {
    const existing = this.dreamSessions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.dreamSessions.set(id, updated);
    return updated;
  }

  async addDreamDiscovery(sessionId: string, discovery: DreamDiscovery): Promise<DreamSession | undefined> {
    const session = this.dreamSessions.get(sessionId);
    if (!session) return undefined;
    session.discoveries.push(discovery);
    return session;
  }

  // Stress Scenarios
  private stressScenarios: Map<string, StressScenario> = new Map();

  async getStressScenarios(filters?: { category?: string; isTemplate?: boolean }): Promise<StressScenario[]> {
    let results = Array.from(this.stressScenarios.values());
    if (filters?.category) results = results.filter(s => s.category === filters.category);
    if (filters?.isTemplate !== undefined) results = results.filter(s => s.isTemplate === filters.isTemplate);
    results.sort((a, b) => b.createdAt - a.createdAt);
    return results;
  }

  async getStressScenario(id: string): Promise<StressScenario | undefined> {
    return this.stressScenarios.get(id);
  }

  async createStressScenario(scenario: InsertStressScenario): Promise<StressScenario> {
    const fullScenario: StressScenario = {
      ...scenario,
      id: scenario.id || randomUUID(),
      createdAt: Date.now(),
    };
    this.stressScenarios.set(fullScenario.id, fullScenario);
    return fullScenario;
  }

  // Stress Test Runs
  private stressTestRuns: Map<string, StressTestRun> = new Map();

  async getStressTestRuns(filters?: { scenarioId?: string; status?: string }): Promise<StressTestRun[]> {
    let results = Array.from(this.stressTestRuns.values());
    if (filters?.scenarioId) results = results.filter(r => r.scenarioId === filters.scenarioId);
    if (filters?.status) results = results.filter(r => r.status === filters.status);
    results.sort((a, b) => b.startedAt - a.startedAt);
    return results;
  }

  async getStressTestRun(id: string): Promise<StressTestRun | undefined> {
    return this.stressTestRuns.get(id);
  }

  async createStressTestRun(run: InsertStressTestRun): Promise<StressTestRun> {
    const fullRun: StressTestRun = {
      ...run,
      id: run.id || randomUUID(),
      agentResponses: [],
      lessonsLearned: [],
      startedAt: Date.now(),
    };
    this.stressTestRuns.set(fullRun.id, fullRun);
    return fullRun;
  }

  async updateStressTestRun(id: string, updates: Partial<StressTestRun>): Promise<StressTestRun | undefined> {
    const existing = this.stressTestRuns.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates };
    this.stressTestRuns.set(id, updated);
    return updated;
  }

  async addAgentStressResponse(runId: string, response: AgentStressResponse): Promise<StressTestRun | undefined> {
    const run = this.stressTestRuns.get(runId);
    if (!run) return undefined;
    run.agentResponses.push(response);
    return run;
  }

  // Alert Preferences
  private alertPreferences: Map<string, AlertPreference> = new Map();

  async getAlertPreference(userId: string): Promise<AlertPreference | undefined> {
    return this.alertPreferences.get(userId);
  }

  async upsertAlertPreference(preference: InsertAlertPreference): Promise<AlertPreference> {
    const existing = this.alertPreferences.get(preference.userId);
    const now = Date.now();
    
    const fullPreference: AlertPreference = {
      id: existing?.id || randomUUID(),
      ...preference,
      rateLimitPerMinute: preference.rateLimitPerMinute || 3,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    
    this.alertPreferences.set(preference.userId, fullPreference);
    return fullPreference;
  }

  // Alert Events
  private alertEvents: Map<string, AlertEvent[]> = new Map();

  async getAlertEvents(userId: string, limit: number = 50): Promise<AlertEvent[]> {
    const events = this.alertEvents.get(userId) || [];
    return events.slice(-limit);
  }

  async createAlertEvent(alert: InsertAlertEvent): Promise<AlertEvent> {
    const fullEvent: AlertEvent = {
      id: randomUUID(),
      ...alert,
      sentViaEmail: false,
      sentViaWebhook: false,
      read: false,
      createdAt: Date.now(),
    };

    if (!this.alertEvents.has(alert.userId)) {
      this.alertEvents.set(alert.userId, []);
    }
    this.alertEvents.get(alert.userId)!.push(fullEvent);
    
    return fullEvent;
  }

  async markAlertAsRead(userId: string, alertId: string): Promise<AlertEvent | undefined> {
    const events = this.alertEvents.get(userId) || [];
    const event = events.find(e => e.id === alertId);
    if (event) {
      event.read = true;
    }
    return event;
  }

  async updateAlertDeliveryStatus(userId: string, alertId: string, email: boolean, webhook: boolean): Promise<AlertEvent | undefined> {
    const events = this.alertEvents.get(userId) || [];
    const event = events.find(e => e.id === alertId);
    if (event) {
      event.sentViaEmail = event.sentViaEmail || email;
      event.sentViaWebhook = event.sentViaWebhook || webhook;
    }
    return event;
  }

  async getRecentAlerts(userId: string, minutesBack: number = 1): Promise<AlertEvent[]> {
    const events = this.alertEvents.get(userId) || [];
    const since = Date.now() - minutesBack * 60 * 1000;
    return events.filter(e => e.createdAt >= since);
  }
}

// Use MemStorage with all implementations
export const storage = new MemStorage();
