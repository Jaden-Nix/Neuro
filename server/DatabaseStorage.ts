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
  AgentType,
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
        walletBalance: "0",
        totalTVL: "0",
        currentAPY: 0,
        riskLevel: 50,
        activeOpportunities: 0,
        pendingTransactions: 0,
        gasPrice: "0",
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
      .returning();

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
}
