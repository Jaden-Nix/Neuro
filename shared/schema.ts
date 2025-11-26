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
