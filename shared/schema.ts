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
  chainId: number;
  chain: "ethereum" | "base" | "fraxtal" | "solana";
  type: "swap" | "rebalance" | "loan" | "stake" | "unstake" | "deposit" | "withdraw" | "transfer";
  status: "pending" | "confirmed" | "failed";
  fromAddress?: string;
  toAddress?: string;
  gasUsed?: string;
  value: string;
  blockNumber?: number;
  agentId?: string;
  timestamp: number;
}

// MEV Protection Types
export interface MEVRiskMetrics {
  sandwichRisk: number;
  frontrunRisk: number;
  backrunRisk: number;
  overallRiskScore: number;
  riskLevel: "low" | "medium" | "high" | "critical";
  estimatedMEVLoss: number;
  recommendations: string[];
}

export interface MEVProtectionStatus {
  flashbotsEnabled: boolean;
  privateMempoolEnabled: boolean;
  defaultSlippage: number;
  protectedTransactions: number;
  mevSaved: number;
}

// Solana Types
export interface SolanaMetrics {
  walletBalanceSol: number;
  solPriceUsd: number;
  totalValueUsd: number;
  slot: number;
  tokenBalances: Array<{
    mint: string;
    symbol?: string;
    amount: number;
    decimals: number;
  }>;
}

export interface JupiterSwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  routeDescription: string;
}

export interface MarinadeStakingMetrics {
  totalStakedSol: number;
  msolPrice: number;
  apy: number;
  validatorCount: number;
}

export interface OrcaPoolInfo {
  poolAddress: string;
  tokenA: string;
  tokenB: string;
  tvlUsd: number;
  feeApr: number;
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

// Live Metrics (aligned with OnChainMetrics from RPCClient)
export interface LiveMetrics {
  walletBalanceEth: number;
  tvlUsd: number;
  currentAPY: number;
  riskLevel: number;
  activeOpportunities: number;
  pendingTransactions: number;
  gasPriceGwei: number;
  ethPriceUsd: number;
  timestamp: number;
}

// WebSocket Message Types
export interface WSMessage {
  type: "log" | "metrics" | "alert" | "simulation" | "agent_update" | "transaction" | "credits" | "autonomousCycle" | "transactionMonitor" | "selfHealing";
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
  chainId: integer("chain_id").notNull().default(1),
  chain: varchar("chain").$type<"ethereum" | "base" | "fraxtal" | "solana">().notNull(),
  type: varchar("type").$type<"swap" | "rebalance" | "loan" | "stake" | "unstake" | "deposit" | "withdraw" | "transfer">().notNull(),
  status: varchar("status").$type<"pending" | "confirmed" | "failed">().notNull(),
  fromAddress: varchar("from_address"),
  toAddress: varchar("to_address"),
  gasUsed: varchar("gas_used"),
  value: varchar("value").notNull(),
  blockNumber: integer("block_number"),
  agentId: varchar("agent_id"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Solana Wallet Tracking
export interface SolanaWallet {
  id: string;
  address: string;
  provider: "phantom" | "solflare" | "other";
  connected: boolean;
  balanceSol: number;
  totalValueUsd: number;
  connectedAt: number;
  lastUpdated: number;
}

export const solanaWallets = pgTable("solana_wallets", {
  id: varchar("id").primaryKey(),
  address: varchar("address").notNull().unique(),
  provider: varchar("provider").$type<"phantom" | "solflare" | "other">().notNull(),
  connected: boolean("connected").notNull().default(true),
  balanceSol: integer("balance_sol").notNull().default(0),
  totalValueUsd: integer("total_value_usd").notNull().default(0),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

// ==========================================
// Task 9: ML Pattern Recognition Types
// ==========================================

export interface MLFeatureVector {
  priceVolatility: number;
  tvlChange: number;
  gasPrice: number;
  agentPerformance: number;
  marketSentiment: number;
  liquidityDepth: number;
  volumeChange: number;
  timestamp: number;
}

export interface MarketCluster {
  id: string;
  centroid: MLFeatureVector;
  members: string[];
  label: "bullish" | "bearish" | "sideways" | "volatile" | "stable";
  confidence: number;
  timestamp: number;
}

export interface MLPrediction {
  id: string;
  opportunityId: string;
  successProbability: number;
  expectedReturn: number;
  riskAdjustedScore: number;
  features: MLFeatureVector;
  clusterLabel: MarketCluster["label"];
  modelVersion: string;
  timestamp: number;
}

export interface MLModelMetrics {
  modelId: string;
  version: string;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  totalPredictions: number;
  correctPredictions: number;
  lastTrainedAt: number;
  trainingDataPoints: number;
}

export interface TrainingDataPoint {
  id: string;
  features: MLFeatureVector;
  outcome: "success" | "failure";
  actualReturn: number;
  opportunityType: string;
  timestamp: number;
}

export const mlPredictions = pgTable("ml_predictions", {
  id: varchar("id").primaryKey(),
  opportunityId: varchar("opportunity_id").notNull(),
  successProbability: integer("success_probability").notNull(),
  expectedReturn: integer("expected_return").notNull(),
  riskAdjustedScore: integer("risk_adjusted_score").notNull(),
  features: jsonb("features").$type<MLFeatureVector>().notNull(),
  clusterLabel: varchar("cluster_label").$type<MarketCluster["label"]>().notNull(),
  modelVersion: varchar("model_version").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const marketClusters = pgTable("market_clusters", {
  id: varchar("id").primaryKey(),
  centroid: jsonb("centroid").$type<MLFeatureVector>().notNull(),
  members: jsonb("members").$type<string[]>().notNull(),
  label: varchar("label").$type<MarketCluster["label"]>().notNull(),
  confidence: integer("confidence").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const trainingData = pgTable("training_data", {
  id: varchar("id").primaryKey(),
  features: jsonb("features").$type<MLFeatureVector>().notNull(),
  outcome: varchar("outcome").$type<"success" | "failure">().notNull(),
  actualReturn: integer("actual_return").notNull(),
  opportunityType: varchar("opportunity_type").notNull(),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const mlModels = pgTable("ml_models", {
  id: varchar("id").primaryKey(),
  version: varchar("version").notNull(),
  accuracy: integer("accuracy").notNull().default(0),
  precision: integer("precision").notNull().default(0),
  recall: integer("recall").notNull().default(0),
  f1Score: integer("f1_score").notNull().default(0),
  totalPredictions: integer("total_predictions").notNull().default(0),
  correctPredictions: integer("correct_predictions").notNull().default(0),
  lastTrainedAt: timestamp("last_trained_at").notNull().defaultNow(),
  trainingDataPoints: integer("training_data_points").notNull().default(0),
});

// ==========================================
// Task 10: Multi-Signature Governance Types
// ==========================================

export type MultiSigThreshold = "2-of-3" | "3-of-5" | "4-of-7";

export interface GovernanceProposal {
  id: string;
  title: string;
  description: string;
  proposer: string;
  transactionValue: number;
  transactionTo: string;
  transactionData: string;
  chain: "ethereum" | "base" | "fraxtal" | "solana";
  threshold: MultiSigThreshold;
  requiredSignatures: number;
  currentSignatures: number;
  signers: GovernanceSigner[];
  status: "pending" | "approved" | "rejected" | "executed" | "expired";
  timelockEnd: number;
  createdAt: number;
  updatedAt: number;
  executedAt?: number;
  safeAddress?: string;
  safeTxHash?: string;
}

export interface GovernanceSigner {
  address: string;
  name?: string;
  signedAt?: number;
  signature?: string;
  approved: boolean;
}

export interface GovernanceVote {
  id: string;
  proposalId: string;
  voter: string;
  vote: "approve" | "reject" | "abstain";
  reason?: string;
  timestamp: number;
}

export interface SafeConfig {
  safeAddress: string;
  chain: "ethereum" | "base" | "fraxtal";
  owners: string[];
  threshold: number;
  nonce: number;
  createdAt: number;
}

export interface TimelockConfig {
  minimumDelayHours: number;
  maximumDelayHours: number;
  highValueThreshold: number;
}

export const governanceProposals = pgTable("governance_proposals", {
  id: varchar("id").primaryKey(),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  proposer: varchar("proposer").notNull(),
  transactionValue: integer("transaction_value").notNull(),
  transactionTo: varchar("transaction_to").notNull(),
  transactionData: text("transaction_data").notNull(),
  chain: varchar("chain").$type<"ethereum" | "base" | "fraxtal" | "solana">().notNull(),
  threshold: varchar("threshold").$type<MultiSigThreshold>().notNull(),
  requiredSignatures: integer("required_signatures").notNull(),
  currentSignatures: integer("current_signatures").notNull().default(0),
  signers: jsonb("signers").$type<GovernanceSigner[]>().notNull(),
  status: varchar("status").$type<"pending" | "approved" | "rejected" | "executed" | "expired">().notNull().default("pending"),
  timelockEnd: timestamp("timelock_end").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  executedAt: timestamp("executed_at"),
  safeAddress: varchar("safe_address"),
  safeTxHash: varchar("safe_tx_hash"),
});

export const governanceVotes = pgTable("governance_votes", {
  id: varchar("id").primaryKey(),
  proposalId: varchar("proposal_id").notNull(),
  voter: varchar("voter").notNull(),
  vote: varchar("vote").$type<"approve" | "reject" | "abstain">().notNull(),
  reason: text("reason"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const safeConfigs = pgTable("safe_configs", {
  id: varchar("id").primaryKey(),
  safeAddress: varchar("safe_address").notNull().unique(),
  chain: varchar("chain").$type<"ethereum" | "base" | "fraxtal">().notNull(),
  owners: jsonb("owners").$type<string[]>().notNull(),
  threshold: integer("threshold").notNull(),
  nonce: integer("nonce").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ==========================================
// Task 11: Agent Marketplace Types
// ==========================================

export enum RiskTolerance {
  CONSERVATIVE = "conservative",
  MODERATE = "moderate",
  AGGRESSIVE = "aggressive"
}

export enum StrategyType {
  ARBITRAGE = "arbitrage",
  YIELD_FARMING = "yield_farming",
  LIQUIDITY_PROVISION = "liquidity_provision",
  MARKET_MAKING = "market_making",
  TREND_FOLLOWING = "trend_following"
}

export enum ListingStatus {
  ACTIVE = "active",
  SOLD = "sold",
  RENTED = "rented",
  DELISTED = "delisted"
}

export interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  agentType: AgentType;
  personality: PersonalityTrait[];
  riskTolerance: RiskTolerance;
  strategyType: StrategyType;
  basePrice: number;
  rentalPricePerDay: number;
  yieldSharePercent: number;
  performanceScore: number;
  totalDeployments: number;
  successRate: number;
  avgReturn: number;
  imageUrl?: string;
  createdBy: string;
  createdAt: number;
  featured: boolean;
}

export interface MarketplaceListing {
  id: string;
  templateId: string;
  sellerId: string;
  nftTokenId?: string;
  nftContractAddress?: string;
  price: number;
  rentalPricePerDay: number;
  yieldSharePercent: number;
  status: ListingStatus;
  buyerId?: string;
  chain: "ethereum" | "base" | "fraxtal" | "solana";
  createdAt: number;
  updatedAt: number;
  soldAt?: number;
}

export interface AgentRental {
  id: string;
  listingId: string;
  templateId: string;
  renterId: string;
  ownerId: string;
  startDate: number;
  endDate: number;
  dailyRate: number;
  yieldSharePercent: number;
  totalPaid: number;
  yieldEarned: number;
  status: "active" | "completed" | "cancelled";
  createdAt: number;
  stripePaymentIntentId?: string;
}

export interface AgentNFT {
  id: string;
  templateId: string;
  tokenId: string;
  contractAddress: string;
  chain: "ethereum" | "base" | "fraxtal" | "solana";
  ownerAddress: string;
  mintedAt: number;
  metadata: {
    name: string;
    description: string;
    image: string;
    attributes: Array<{ trait_type: string; value: string | number }>;
  };
  stripePaymentIntentId?: string;
  mintFee?: number;
}

export interface LeaderboardEntry {
  agentId: string;
  templateId: string;
  rank: number;
  performanceScore: number;
  totalReturn: number;
  successRate: number;
  totalTrades: number;
  avgTradeSize: number;
  riskAdjustedReturn: number;
  period: "daily" | "weekly" | "monthly" | "all_time";
}

export interface SellerProfile {
  id: string;
  walletAddress: string;
  email?: string;
  stripeAccountId?: string;
  stripeOnboardingComplete: boolean;
  totalEarnings: number;
  totalSales: number;
  createdAt: number;
  updatedAt: number;
}

// Agent Templates Table
export const agentTemplates = pgTable("agent_templates", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description").notNull(),
  agentType: varchar("agent_type").$type<AgentType>().notNull(),
  personality: jsonb("personality").$type<PersonalityTrait[]>().notNull(),
  riskTolerance: varchar("risk_tolerance").$type<RiskTolerance>().notNull(),
  strategyType: varchar("strategy_type").$type<StrategyType>().notNull(),
  basePrice: integer("base_price").notNull().default(0),
  rentalPricePerDay: integer("rental_price_per_day").notNull().default(0),
  yieldSharePercent: integer("yield_share_percent").notNull().default(10),
  performanceScore: integer("performance_score").notNull().default(0),
  totalDeployments: integer("total_deployments").notNull().default(0),
  successRate: integer("success_rate").notNull().default(0),
  avgReturn: integer("avg_return").notNull().default(0),
  imageUrl: varchar("image_url"),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  featured: boolean("featured").notNull().default(false),
});

// Marketplace Listings Table
export const marketplaceListings = pgTable("marketplace_listings", {
  id: varchar("id").primaryKey(),
  templateId: varchar("template_id").notNull(),
  sellerId: varchar("seller_id").notNull(),
  nftTokenId: varchar("nft_token_id"),
  nftContractAddress: varchar("nft_contract_address"),
  price: integer("price").notNull(),
  rentalPricePerDay: integer("rental_price_per_day").notNull(),
  yieldSharePercent: integer("yield_share_percent").notNull().default(10),
  status: varchar("status").$type<ListingStatus>().notNull(),
  buyerId: varchar("buyer_id"),
  chain: varchar("chain").$type<"ethereum" | "base" | "fraxtal" | "solana">().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  soldAt: timestamp("sold_at"),
});

// Agent Rentals Table
export const agentRentals = pgTable("agent_rentals", {
  id: varchar("id").primaryKey(),
  listingId: varchar("listing_id").notNull(),
  templateId: varchar("template_id").notNull(),
  renterId: varchar("renter_id").notNull(),
  ownerId: varchar("owner_id").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  dailyRate: integer("daily_rate").notNull(),
  yieldSharePercent: integer("yield_share_percent").notNull(),
  totalPaid: integer("total_paid").notNull().default(0),
  yieldEarned: integer("yield_earned").notNull().default(0),
  status: varchar("status").$type<"active" | "completed" | "cancelled">().notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
});

// Agent NFTs Table
export const agentNFTs = pgTable("agent_nfts", {
  id: varchar("id").primaryKey(),
  templateId: varchar("template_id").notNull(),
  tokenId: varchar("token_id").notNull(),
  contractAddress: varchar("contract_address").notNull(),
  chain: varchar("chain").$type<"ethereum" | "base" | "fraxtal" | "solana">().notNull(),
  ownerAddress: varchar("owner_address").notNull(),
  mintedAt: timestamp("minted_at").notNull().defaultNow(),
  metadata: jsonb("metadata").$type<{
    name: string;
    description: string;
    image: string;
    attributes: Array<{ trait_type: string; value: string | number }>;
  }>().notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  mintFee: integer("mint_fee"),
});

// Leaderboard Table
export const leaderboard = pgTable("leaderboard", {
  id: varchar("id").primaryKey(),
  agentId: varchar("agent_id").notNull(),
  templateId: varchar("template_id").notNull(),
  rank: integer("rank").notNull(),
  performanceScore: integer("performance_score").notNull(),
  totalReturn: integer("total_return").notNull(),
  successRate: integer("success_rate").notNull(),
  totalTrades: integer("total_trades").notNull(),
  avgTradeSize: integer("avg_trade_size").notNull(),
  riskAdjustedReturn: integer("risk_adjusted_return").notNull(),
  period: varchar("period").$type<"daily" | "weekly" | "monthly" | "all_time">().notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Seller Profiles Table (for Stripe Connect)
export const sellerProfiles = pgTable("seller_profiles", {
  id: varchar("id").primaryKey(),
  walletAddress: varchar("wallet_address").notNull().unique(),
  email: varchar("email"),
  stripeAccountId: varchar("stripe_account_id"),
  stripeOnboardingComplete: boolean("stripe_onboarding_complete").notNull().default(false),
  totalEarnings: integer("total_earnings").notNull().default(0),
  totalSales: integer("total_sales").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Insert schemas for marketplace
export const insertAgentTemplateSchema = createInsertSchema(agentTemplates).omit({ 
  createdAt: true, 
  totalDeployments: true,
  performanceScore: true 
});
export const insertMarketplaceListingSchema = createInsertSchema(marketplaceListings).omit({ 
  createdAt: true, 
  updatedAt: true,
  soldAt: true,
  status: true 
});
export const insertAgentRentalSchema = createInsertSchema(agentRentals).omit({ 
  createdAt: true,
  totalPaid: true,
  yieldEarned: true,
  status: true 
});
export const insertAgentNFTSchema = createInsertSchema(agentNFTs).omit({ mintedAt: true });
export const insertLeaderboardSchema = createInsertSchema(leaderboard).omit({ updatedAt: true });
export const insertSellerProfileSchema = createInsertSchema(sellerProfiles).omit({ 
  createdAt: true, 
  updatedAt: true,
  totalEarnings: true,
  totalSales: true,
  stripeOnboardingComplete: true,
});

// Marketplace Types for inserts
export type InsertAgentTemplate = z.infer<typeof insertAgentTemplateSchema>;
export type InsertMarketplaceListing = z.infer<typeof insertMarketplaceListingSchema>;
export type InsertAgentRental = z.infer<typeof insertAgentRentalSchema>;
export type InsertAgentNFT = z.infer<typeof insertAgentNFTSchema>;
export type InsertLeaderboard = z.infer<typeof insertLeaderboardSchema>;
export type InsertSellerProfile = z.infer<typeof insertSellerProfileSchema>;

// Marketplace Select types
export type SelectAgentTemplate = typeof agentTemplates.$inferSelect;
export type SelectMarketplaceListing = typeof marketplaceListings.$inferSelect;
export type SelectAgentRental = typeof agentRentals.$inferSelect;
export type SelectAgentNFT = typeof agentNFTs.$inferSelect;
export type SelectLeaderboard = typeof leaderboard.$inferSelect;
export type SelectSellerProfile = typeof sellerProfiles.$inferSelect;

// Insert schemas for new tables
export const insertMLPredictionSchema = createInsertSchema(mlPredictions).omit({ timestamp: true });
export const insertMarketClusterSchema = createInsertSchema(marketClusters).omit({ timestamp: true });
export const insertTrainingDataSchema = createInsertSchema(trainingData).omit({ timestamp: true });
export const insertMLModelSchema = createInsertSchema(mlModels).omit({ lastTrainedAt: true });
export const insertGovernanceProposalSchema = createInsertSchema(governanceProposals).omit({ 
  createdAt: true, 
  updatedAt: true,
  currentSignatures: true,
  status: true 
});
export const insertGovernanceVoteSchema = createInsertSchema(governanceVotes).omit({ timestamp: true });
export const insertSafeConfigSchema = createInsertSchema(safeConfigs).omit({ createdAt: true, nonce: true });

// Types for inserts
export type InsertMLPrediction = z.infer<typeof insertMLPredictionSchema>;
export type InsertMarketCluster = z.infer<typeof insertMarketClusterSchema>;
export type InsertTrainingData = z.infer<typeof insertTrainingDataSchema>;
export type InsertMLModel = z.infer<typeof insertMLModelSchema>;
export type InsertGovernanceProposal = z.infer<typeof insertGovernanceProposalSchema>;
export type InsertGovernanceVote = z.infer<typeof insertGovernanceVoteSchema>;
export type InsertSafeConfig = z.infer<typeof insertSafeConfigSchema>;

// Select types
export type SelectMLPrediction = typeof mlPredictions.$inferSelect;
export type SelectMarketCluster = typeof marketClusters.$inferSelect;
export type SelectTrainingData = typeof trainingData.$inferSelect;
export type SelectMLModel = typeof mlModels.$inferSelect;
export type SelectGovernanceProposal = typeof governanceProposals.$inferSelect;
export type SelectGovernanceVote = typeof governanceVotes.$inferSelect;
export type SelectSafeConfig = typeof safeConfigs.$inferSelect;

