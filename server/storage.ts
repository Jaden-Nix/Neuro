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

  // Replay
  getReplayEvents(filters?: any): Promise<ReplayEvent[]>;
  addReplayEvent(event: ReplayEvent): Promise<ReplayEvent>;

  // Alerts
  getAlerts(filters?: any): Promise<SentinelAlert[]>;
  addAlert(alert: SentinelAlert): Promise<SentinelAlert>;
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
}

// Use DatabaseStorage for persistent PostgreSQL storage with real blockchain data
import { DatabaseStorage } from "./DatabaseStorage";
export const storage = new DatabaseStorage();

// Keep MemStorage for fallback/testing if needed
// export const storage = new MemStorage();
