import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Agent Types
export enum AgentType {
  META = "meta",
  SCOUT = "scout",
  RISK = "risk",
  EXECUTION = "execution"
}

export enum AgentStatus {
  IDLE = "idle",
  ACTIVE = "active",
  NEGOTIATING = "negotiating",
  EXECUTING = "executing",
  DEPRECATED = "deprecated"
}

export enum PersonalityTrait {
  CURIOUS = "curious",
  ENERGETIC = "energetic",
  CAUTIOUS = "cautious",
  FORMAL = "formal",
  PRECISE = "precise",
  COLD = "cold",
  SOVEREIGN = "sovereign",
  CALM = "calm"
}

// Simulation Types
export interface FutureForkPrediction {
  timestamp: number;
  price: number;
  volatility: number;
  tvl: number;
  yield: number;
  pegDeviationFRAX: number;
  pegDeviationKRWQ: number;
  ev: number; // Expected Value
}

export interface SimulationBranch {
  id: string;
  parentId: string | null;
  predictions: FutureForkPrediction[];
  outcome: "success" | "failure" | "pending";
  evScore: number;
}

// Credit Economy
export interface CreditTransaction {
  agentId: string;
  agentType: AgentType;
  amount: number;
  reason: string;
  timestamp: number;
}

export interface AgentCreditScore {
  agentId: string;
  agentType: AgentType;
  totalCredits: number;
  accuracyRate: number;
  successfulActions: number;
  failedActions: number;
}

// Memory Vault
export interface MemoryEntry {
  id: string;
  strategyType: "successful" | "blocked" | "high-risk" | "learned";
  description: string;
  agentScores: Record<string, number>;
  riskPattern: string;
  priceAnomaly?: string;
  simulationSummary: string;
  timestamp: number;
  tags: string[];
}

// Negotiation Protocol
export interface NegotiationProposal {
  id: string;
  fromAgent: AgentType;
  toAgent: AgentType;
  action: string;
  confidence: number;
  riskScore: number;
  expectedReturn: number;
  timestamp: number;
}

export interface NegotiationResult {
  proposalId: string;
  approved: boolean;
  finalScore: number;
  vetoes: AgentType[];
  approvals: AgentType[];
  metaAgentDecision: string;
}

// Sentinel Monitoring
export interface SentinelAlert {
  id: string;
  alertType: "wallet_health" | "liquidity_change" | "peg_deviation" | "volatility_spike" | "oracle_anomaly" | "pool_drain" | "liquidation_risk";
  severity: "low" | "medium" | "high" | "critical";
  message: string;
  data: Record<string, any>;
  timestamp: number;
  autoExecuted: boolean;
}

// Replay Engine
export interface ReplayEvent {
  id: string;
  eventType: "decision" | "simulation" | "negotiation" | "execution" | "alert";
  agentType?: AgentType;
  data: Record<string, any>;
  timestamp: number;
}

// Blockchain Transaction
export interface ChainTransaction {
  id: string;
  hash: string;
  chain: "ethereum" | "base" | "fraxtal" | "solana";
  type: "swap" | "rebalance" | "loan" | "stake";
  status: "pending" | "confirmed" | "failed";
  gasUsed?: string;
  value: string;
  timestamp: number;
}

// Agent Schema
export interface Agent {
  id: string;
  type: AgentType;
  status: AgentStatus;
  personality: PersonalityTrait[];
  creditScore: number;
  version: number;
  spawnedAt: number;
  deprecatedAt?: number;
  currentTask?: string;
  atpMetadata?: Record<string, any>;
}

// System State
export interface SystemState {
  autonomousMode: boolean;
  activeAgents: string[];
  totalSimulationsRun: number;
  totalTransactionsExecuted: number;
  systemHealth: number;
  lastUpdated: number;
}

// Live Metrics
export interface LiveMetrics {
  walletBalance: string;
  totalTVL: string;
  currentAPY: number;
  riskLevel: number;
  activeOpportunities: number;
  pendingTransactions: number;
  timestamp: number;
}

// WebSocket Message Types
export interface WSMessage {
  type: "log" | "metrics" | "alert" | "simulation" | "agent_update" | "transaction" | "credits";
  data: any;
  timestamp: number;
}

// Log Entry
export interface LogEntry {
  id: string;
  timestamp: number;
  agentType: AgentType;
  level: "info" | "warn" | "error" | "success";
  message: string;
  personality?: string;
}

// Drizzle ORM Tables for Database Persistence
export const agents = pgTable("agents", {
  id: varchar("id").primaryKey(),
  type: varchar("type").$type<AgentType>().notNull(),
  status: varchar("status").$type<AgentStatus>().notNull(),
  personality: jsonb("personality").$type<PersonalityTrait[]>().notNull(),
  creditScore: integer("credit_score").notNull().default(500),
  version: integer("version").notNull().default(1),
  spawnedAt: timestamp("spawned_at").notNull().defaultNow(),
  deprecatedAt: timestamp("deprecated_at"),
  currentTask: text("current_task"),
  atpMetadata: jsonb("atp_metadata"),
});

export const logs = pgTable("logs", {
  id: varchar("id").primaryKey(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  agentType: varchar("agent_type").$type<AgentType>().notNull(),
  level: varchar("level").$type<"info" | "warn" | "error" | "success">().notNull(),
  message: text("message").notNull(),
  personality: varchar("personality"),
});

export const creditScores = pgTable("credit_scores", {
  agentId: varchar("agent_id").primaryKey(),
  agentType: varchar("agent_type").$type<AgentType>().notNull(),
  totalCredits: integer("total_credits").notNull().default(0),
  accuracyRate: integer("accuracy_rate").notNull().default(0),
  successfulActions: integer("successful_actions").notNull().default(0),
  failedActions: integer("failed_actions").notNull().default(0),
});

export const creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey(),
  agentId: varchar("agent_id").notNull(),
  agentType: varchar("agent_type").$type<AgentType>().notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const memoryEntries = pgTable("memory_entries", {
  id: varchar("id").primaryKey(),
  strategyType: varchar("strategy_type").$type<"successful" | "blocked" | "high-risk" | "learned">().notNull(),
  description: text("description").notNull(),
  agentScores: jsonb("agent_scores").$type<Record<string, number>>().notNull(),
  riskPattern: text("risk_pattern").notNull(),
  priceAnomaly: text("price_anomaly"),
  simulationSummary: text("simulation_summary").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  tags: jsonb("tags").$type<string[]>().notNull(),
});

export const simulations = pgTable("simulations", {
  id: varchar("id").primaryKey(),
  parentId: varchar("parent_id"),
  predictions: jsonb("predictions").$type<FutureForkPrediction[]>().notNull(),
  outcome: varchar("outcome").$type<"success" | "failure" | "pending">().notNull(),
  evScore: integer("ev_score").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const replayEvents = pgTable("replay_events", {
  id: varchar("id").primaryKey(),
  eventType: varchar("event_type").$type<"decision" | "simulation" | "negotiation" | "execution" | "alert">().notNull(),
  agentType: varchar("agent_type").$type<AgentType>(),
  data: jsonb("data").$type<Record<string, any>>().notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const alerts = pgTable("alerts", {
  id: varchar("id").primaryKey(),
  alertType: varchar("alert_type").$type<"wallet_health" | "liquidity_change" | "peg_deviation" | "volatility_spike" | "oracle_anomaly" | "pool_drain" | "liquidation_risk">().notNull(),
  severity: varchar("severity").$type<"low" | "medium" | "high" | "critical">().notNull(),
  message: text("message").notNull(),
  data: jsonb("data").$type<Record<string, any>>().notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
  autoExecuted: boolean("auto_executed").notNull().default(false),
});

export const systemState = pgTable("system_state", {
  id: varchar("id").primaryKey().default("singleton"),
  autonomousMode: boolean("autonomous_mode").notNull().default(false),
  activeAgents: jsonb("active_agents").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  totalSimulationsRun: integer("total_simulations_run").notNull().default(0),
  totalTransactionsExecuted: integer("total_transactions_executed").notNull().default(0),
  systemHealth: integer("system_health").notNull().default(85),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const chainTransactions = pgTable("chain_transactions", {
  id: varchar("id").primaryKey(),
  hash: varchar("hash").notNull(),
  chain: varchar("chain").$type<"ethereum" | "base" | "fraxtal" | "solana">().notNull(),
  type: varchar("type").$type<"swap" | "rebalance" | "loan" | "stake">().notNull(),
  status: varchar("status").$type<"pending" | "confirmed" | "failed">().notNull(),
  gasUsed: varchar("gas_used"),
  value: varchar("value").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Type exports for frontend use
export type {
  Agent,
  SystemState,
  LiveMetrics,
  SimulationBranch,
  CreditTransaction,
  AgentCreditScore,
  MemoryEntry,
  NegotiationProposal,
  NegotiationResult,
  SentinelAlert,
  ReplayEvent,
  ChainTransaction,
  LogEntry,
  WSMessage
};
