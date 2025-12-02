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

// ==========================================
// Alert System Types
// ==========================================

export type AlertChannel = "email" | "webhook" | "both";
export type AlertSeverityThreshold = "low" | "medium" | "high" | "critical";

export interface AlertConfiguration {
  id: string;
  name: string;
  enabled: boolean;
  channel: AlertChannel;
  emailRecipients: string[];
  webhookUrl?: string;
  webhookSecret?: string;
  severityThreshold: AlertSeverityThreshold;
  alertTypes: SentinelAlert["alertType"][];
  cooldownMinutes: number;
  createdAt: number;
  updatedAt: number;
}

export interface AlertNotification {
  id: string;
  configurationId: string;
  alertId: string;
  channel: AlertChannel;
  recipient: string;
  subject: string;
  body: string;
  status: "pending" | "sent" | "failed";
  sentAt?: number;
  errorMessage?: string;
  createdAt: number;
}

export const alertConfigurations = pgTable("alert_configurations", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  enabled: boolean("enabled").notNull().default(true),
  channel: varchar("channel").$type<AlertChannel>().notNull(),
  emailRecipients: jsonb("email_recipients").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  webhookUrl: varchar("webhook_url"),
  webhookSecret: varchar("webhook_secret"),
  severityThreshold: varchar("severity_threshold").$type<AlertSeverityThreshold>().notNull().default("medium"),
  alertTypes: jsonb("alert_types").$type<SentinelAlert["alertType"][]>().notNull(),
  cooldownMinutes: integer("cooldown_minutes").notNull().default(15),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const alertNotifications = pgTable("alert_notifications", {
  id: varchar("id").primaryKey(),
  configurationId: varchar("configuration_id").notNull(),
  alertId: varchar("alert_id").notNull(),
  channel: varchar("channel").$type<AlertChannel>().notNull(),
  recipient: varchar("recipient").notNull(),
  subject: varchar("subject").notNull(),
  body: text("body").notNull(),
  status: varchar("status").$type<"pending" | "sent" | "failed">().notNull().default("pending"),
  sentAt: timestamp("sent_at"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ==========================================
// Strategy Backtesting Types
// ==========================================

export interface HistoricalDataPoint {
  timestamp: number;
  price: number;
  volume: number;
  tvl: number;
  gasPrice: number;
  volatility: number;
}

export interface BacktestScenario {
  id: string;
  name: string;
  description: string;
  startTimestamp: number;
  endTimestamp: number;
  dataPoints: HistoricalDataPoint[];
  chain: "ethereum" | "base" | "fraxtal" | "solana";
  createdAt: number;
}

export interface BacktestRun {
  id: string;
  scenarioId: string;
  agentId?: string;
  strategyConfig: Record<string, any>;
  status: "pending" | "running" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  initialBalance: number;
  finalBalance: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  maxDrawdown: number;
  sharpeRatio: number;
  profitFactor: number;
  decisions: BacktestDecision[];
  errorMessage?: string;
}

export interface BacktestDecision {
  timestamp: number;
  action: "buy" | "sell" | "hold" | "rebalance";
  amount: number;
  price: number;
  reason: string;
  agentType: AgentType;
  confidence: number;
  pnl: number;
}

export interface BacktestComparison {
  id: string;
  runIds: string[];
  bestPerformingRun: string;
  metrics: {
    runId: string;
    totalReturn: number;
    maxDrawdown: number;
    sharpeRatio: number;
    winRate: number;
  }[];
  createdAt: number;
}

// ==========================================
// Quick Backtest Types (Simplified Workflow)
// ==========================================

export type BacktestInterval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";

export const BACKTEST_AGENTS = ["Atlas", "Vega", "Nova", "Sentinel", "Arbiter"] as const;
export type BacktestAgentName = typeof BACKTEST_AGENTS[number];

export interface QuickBacktestRequest {
  symbol: string;
  interval: BacktestInterval;
  from: string;  // ISO date string
  to: string;    // ISO date string
  agents: BacktestAgentName[];
  initialBalance?: number;
}

export interface AgentTradeDecision {
  timestamp: string;
  agent: BacktestAgentName;
  action: "BUY" | "SELL" | "HOLD";
  price: number;
  reason: string;
  confidence: number;
}

export interface AgentPerformance {
  agent: BacktestAgentName;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  winRate: number;
  totalReturn: number;
  avgRoiPerTrade: number;
  maxDrawdown: number;
  sharpeRatio: number;
}

export interface QuickBacktestResult {
  id: string;
  symbol: string;
  interval: BacktestInterval;
  from: string;
  to: string;
  agents: BacktestAgentName[];
  status: "running" | "completed" | "failed";
  startedAt: number;
  completedAt?: number;
  durationMs?: number;
  
  // Overall metrics
  totalTrades: number;
  winRate: number;
  totalReturn: number;
  cumulativeReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  
  // Per-agent breakdown
  agentPerformance: AgentPerformance[];
  bestAgent: BacktestAgentName;
  worstAgent: BacktestAgentName;
  
  // Decision trace (for transparency)
  decisions: AgentTradeDecision[];
  
  // Insights
  insights: string[];
  
  errorMessage?: string;
}

export const backtestScenarios = pgTable("backtest_scenarios", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description").notNull(),
  startTimestamp: timestamp("start_timestamp").notNull(),
  endTimestamp: timestamp("end_timestamp").notNull(),
  dataPoints: jsonb("data_points").$type<HistoricalDataPoint[]>().notNull(),
  chain: varchar("chain").$type<"ethereum" | "base" | "fraxtal" | "solana">().notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const backtestRuns = pgTable("backtest_runs", {
  id: varchar("id").primaryKey(),
  scenarioId: varchar("scenario_id").notNull(),
  agentId: varchar("agent_id"),
  strategyConfig: jsonb("strategy_config").$type<Record<string, any>>().notNull(),
  status: varchar("status").$type<"pending" | "running" | "completed" | "failed">().notNull().default("pending"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
  initialBalance: integer("initial_balance").notNull(),
  finalBalance: integer("final_balance").notNull().default(0),
  totalTrades: integer("total_trades").notNull().default(0),
  winningTrades: integer("winning_trades").notNull().default(0),
  losingTrades: integer("losing_trades").notNull().default(0),
  maxDrawdown: integer("max_drawdown").notNull().default(0),
  sharpeRatio: integer("sharpe_ratio").notNull().default(0),
  profitFactor: integer("profit_factor").notNull().default(0),
  decisions: jsonb("decisions").$type<BacktestDecision[]>().notNull().default(sql`'[]'::jsonb`),
  errorMessage: text("error_message"),
});

// ==========================================
// Multi-Wallet Support Types
// ==========================================

export type WalletChain = "ethereum" | "base" | "fraxtal" | "solana";
export type WalletProvider = "metamask" | "walletconnect" | "coinbase" | "phantom" | "solflare" | "ledger" | "manual";

export interface TrackedWallet {
  id: string;
  address: string;
  label: string;
  chain: WalletChain;
  provider: WalletProvider;
  isConnected: boolean;
  isPrimary: boolean;
  balanceNative: string;
  balanceUsd: number;
  tokenBalances: WalletTokenBalance[];
  lastSyncedAt: number;
  createdAt: number;
  updatedAt: number;
}

export interface WalletTokenBalance {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  balance: string;
  balanceUsd: number;
  logoUrl?: string;
}

export interface WalletTransaction {
  id: string;
  walletId: string;
  hash: string;
  chain: WalletChain;
  type: "send" | "receive" | "swap" | "approve" | "stake" | "unstake" | "contract";
  from: string;
  to: string;
  value: string;
  valueUsd: number;
  tokenAddress?: string;
  tokenSymbol?: string;
  gasUsed?: string;
  gasPriceGwei?: string;
  status: "pending" | "confirmed" | "failed";
  blockNumber?: number;
  timestamp: number;
}

export interface WalletAggregate {
  totalWallets: number;
  totalBalanceUsd: number;
  balanceByChain: Record<WalletChain, number>;
  topTokens: { symbol: string; totalUsd: number; percentage: number }[];
  defiPositionsUsd: number;
  lastUpdated: number;
}

// ==========================================
// DeFi Position Tracking Types
// ==========================================

export type DeFiPositionType = "lp" | "staking" | "lending" | "borrowing" | "farming" | "vault" | "locked";
export type DeFiProtocol = "uniswap" | "aave" | "compound" | "curve" | "lido" | "frax" | "convex" | "marinade" | "raydium" | "orca" | "other";

export interface DeFiPosition {
  id: string;
  walletId: string;
  chain: WalletChain;
  protocol: DeFiProtocol;
  type: DeFiPositionType;
  name: string;
  poolAddress?: string;
  token0?: { symbol: string; amount: string; valueUsd: number };
  token1?: { symbol: string; amount: string; valueUsd: number };
  stakedAmount?: string;
  stakedValueUsd: number;
  rewardsClaimable: number;
  rewardTokens?: { symbol: string; amount: string; valueUsd: number }[];
  apy?: number;
  unlockDate?: number;
  healthFactor?: number;
  liquidationPrice?: number;
  borrowedAmount?: string;
  borrowedValueUsd?: number;
  collateralValueUsd?: number;
  lastUpdatedAt: number;
  createdAt: number;
}

export interface WalletSnapshot {
  id: string;
  walletId: string;
  timestamp: number;
  balanceNative: string;
  balanceUsd: number;
  tokenBalancesUsd: number;
  defiPositionsUsd: number;
  totalValueUsd: number;
  pnl24h: number;
  pnl7d: number;
  pnl30d: number;
}

export interface WalletSettings {
  walletId: string;
  alertOnLargeChange: boolean;
  largeChangeThreshold: number;
  alertOnRewardsClaimable: boolean;
  rewardsThreshold: number;
  alertOnHealthFactor: boolean;
  healthFactorThreshold: number;
  autoSync: boolean;
  syncIntervalMinutes: number;
}

export interface WalletPnLSummary {
  walletId: string;
  currentValueUsd: number;
  costBasis: number;
  unrealizedPnl: number;
  realizedPnl: number;
  totalPnl: number;
  pnlPercentage: number;
  pnl24h: number;
  pnl24hPercentage: number;
  pnl7d: number;
  pnl7dPercentage: number;
  pnl30d: number;
  pnl30dPercentage: number;
}

export const trackedWallets = pgTable("tracked_wallets", {
  id: varchar("id").primaryKey(),
  address: varchar("address").notNull(),
  label: varchar("label").notNull(),
  chain: varchar("chain").$type<WalletChain>().notNull(),
  provider: varchar("provider").$type<WalletProvider>().notNull(),
  isConnected: boolean("is_connected").notNull().default(false),
  isPrimary: boolean("is_primary").notNull().default(false),
  balanceNative: varchar("balance_native").notNull().default("0"),
  balanceUsd: integer("balance_usd").notNull().default(0),
  tokenBalances: jsonb("token_balances").$type<WalletTokenBalance[]>().notNull().default(sql`'[]'::jsonb`),
  lastSyncedAt: timestamp("last_synced_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const walletTransactions = pgTable("wallet_transactions", {
  id: varchar("id").primaryKey(),
  walletId: varchar("wallet_id").notNull(),
  hash: varchar("hash").notNull(),
  chain: varchar("chain").$type<WalletChain>().notNull(),
  type: varchar("type").$type<"send" | "receive" | "swap" | "approve" | "stake" | "unstake" | "contract">().notNull(),
  fromAddress: varchar("from_address").notNull(),
  toAddress: varchar("to_address").notNull(),
  value: varchar("value").notNull(),
  valueUsd: integer("value_usd").notNull().default(0),
  tokenAddress: varchar("token_address"),
  tokenSymbol: varchar("token_symbol"),
  gasUsed: varchar("gas_used"),
  gasPriceGwei: varchar("gas_price_gwei"),
  status: varchar("status").$type<"pending" | "confirmed" | "failed">().notNull(),
  blockNumber: integer("block_number"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Insert schemas for new features
export const insertAlertConfigurationSchema = createInsertSchema(alertConfigurations).omit({
  createdAt: true,
  updatedAt: true,
});

export const insertBacktestScenarioSchema = createInsertSchema(backtestScenarios).omit({
  createdAt: true,
});

export const insertBacktestRunSchema = createInsertSchema(backtestRuns).omit({
  startedAt: true,
  completedAt: true,
  finalBalance: true,
  totalTrades: true,
  winningTrades: true,
  losingTrades: true,
  maxDrawdown: true,
  sharpeRatio: true,
  profitFactor: true,
  decisions: true,
});

export const insertTrackedWalletSchema = createInsertSchema(trackedWallets).omit({
  createdAt: true,
  updatedAt: true,
  lastSyncedAt: true,
  tokenBalances: true,
});

// Type exports for new features
export type InsertAlertConfiguration = z.infer<typeof insertAlertConfigurationSchema>;
export type InsertBacktestScenario = z.infer<typeof insertBacktestScenarioSchema>;
export type InsertBacktestRun = z.infer<typeof insertBacktestRunSchema>;
export type InsertTrackedWallet = z.infer<typeof insertTrackedWalletSchema>;

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

// =============================================================================
// HACKATHON SHOWCASE FEATURES: Parliament, Evolution, Dream Mode, Stress Testing
// =============================================================================

// Reasoning Chain - Captures Claude's full reasoning process with transparency
export interface ReasoningStep {
  stepNumber: number;
  thought: string;
  confidence: number;
  evidence?: string[];
  alternatives?: string[];
  risks?: string[];
}

export interface ReasoningChain {
  id: string;
  agentId: string;
  agentType: AgentType;
  topic: string;
  question: string;
  steps: ReasoningStep[];
  conclusion: string;
  finalConfidence: number;
  processingTimeMs: number;
  modelUsed: string;
  timestamp: number;
}

export const reasoningChains = pgTable("reasoning_chains", {
  id: varchar("id").primaryKey(),
  agentId: varchar("agent_id").notNull(),
  agentType: varchar("agent_type").$type<AgentType>().notNull(),
  topic: varchar("topic").notNull(),
  question: text("question").notNull(),
  steps: jsonb("steps").$type<ReasoningStep[]>().notNull(),
  conclusion: text("conclusion").notNull(),
  finalConfidence: integer("final_confidence").notNull(),
  processingTimeMs: integer("processing_time_ms").notNull(),
  modelUsed: varchar("model_used").notNull().default("claude-sonnet-4-20250514"),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

// Parliament Session - Multi-agent debates with votes and reasoning
export interface ParliamentVote {
  agentId: string;
  agentType: AgentType;
  vote: "approve" | "reject" | "abstain";
  reasoning: string;
  confidence: number;
  timestamp: number;
}

export interface ParliamentDebateEntry {
  agentId: string;
  agentType: AgentType;
  position: "for" | "against" | "clarification";
  statement: string;
  rebuttalTo?: string;
  reasoningChainId?: string;
  timestamp: number;
}

export interface ParliamentSession {
  id: string;
  topic: string;
  description: string;
  proposalData: Record<string, any>;
  status: "deliberating" | "voting" | "concluded";
  debates: ParliamentDebateEntry[];
  votes: ParliamentVote[];
  outcome: "approved" | "rejected" | "deadlocked" | null;
  quorum: number;
  requiredMajority: number;
  startedAt: number;
  concludedAt?: number;
}

export const parliamentSessions = pgTable("parliament_sessions", {
  id: varchar("id").primaryKey(),
  topic: varchar("topic").notNull(),
  description: text("description").notNull(),
  proposalData: jsonb("proposal_data").$type<Record<string, any>>().notNull(),
  status: varchar("status").$type<"deliberating" | "voting" | "concluded">().notNull(),
  debates: jsonb("debates").$type<ParliamentDebateEntry[]>().notNull().default(sql`'[]'::jsonb`),
  votes: jsonb("votes").$type<ParliamentVote[]>().notNull().default(sql`'[]'::jsonb`),
  outcome: varchar("outcome").$type<"approved" | "rejected" | "deadlocked">(),
  quorum: integer("quorum").notNull().default(3),
  requiredMajority: integer("required_majority").notNull().default(50),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  concludedAt: timestamp("concluded_at"),
});

// Agent Evolution - Tracking agent mutations, genealogy, and performance inheritance
export interface AgentMutation {
  trait: string;
  previousValue: any;
  newValue: any;
  reason: string;
  performanceImpact?: number;
}

export interface AgentEvolution {
  id: string;
  agentId: string;
  parentAgentId: string | null;
  generation: number;
  mutations: AgentMutation[];
  inheritedTraits: string[];
  performanceScore: number;
  survivalScore: number;
  reproductionScore: number;
  spawnedAt: number;
  retiredAt?: number;
  retirementReason?: string;
}

export const agentEvolutions = pgTable("agent_evolutions", {
  id: varchar("id").primaryKey(),
  agentId: varchar("agent_id").notNull(),
  parentAgentId: varchar("parent_agent_id"),
  generation: integer("generation").notNull().default(1),
  mutations: jsonb("mutations").$type<AgentMutation[]>().notNull().default(sql`'[]'::jsonb`),
  inheritedTraits: jsonb("inherited_traits").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  performanceScore: integer("performance_score").notNull().default(50),
  survivalScore: integer("survival_score").notNull().default(50),
  reproductionScore: integer("reproduction_score").notNull().default(0),
  spawnedAt: timestamp("spawned_at").notNull().defaultNow(),
  retiredAt: timestamp("retired_at"),
  retirementReason: text("retirement_reason"),
});

// Dream Mode - Overnight background simulations and discoveries
export interface DreamDiscovery {
  type: "pattern" | "opportunity" | "risk" | "strategy" | "insight";
  title: string;
  description: string;
  confidence: number;
  potentialValue: number;
  relatedMarkets: string[];
  actionable: boolean;
}

export interface DreamSession {
  id: string;
  status: "sleeping" | "dreaming" | "waking" | "awake";
  startedAt: number;
  endedAt?: number;
  simulationsRun: number;
  branchesExplored: number;
  discoveries: DreamDiscovery[];
  topInsight?: string;
  metabolicRate: number; // Credits consumed per hour
  dreamDepth: number; // How speculative (1-10)
  realTimeMultiplier: number; // 10x means 1 hour explores 10 hours of scenarios
}

export const dreamSessions = pgTable("dream_sessions", {
  id: varchar("id").primaryKey(),
  status: varchar("status").$type<"sleeping" | "dreaming" | "waking" | "awake">().notNull(),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  endedAt: timestamp("ended_at"),
  simulationsRun: integer("simulations_run").notNull().default(0),
  branchesExplored: integer("branches_explored").notNull().default(0),
  discoveries: jsonb("discoveries").$type<DreamDiscovery[]>().notNull().default(sql`'[]'::jsonb`),
  topInsight: text("top_insight"),
  metabolicRate: integer("metabolic_rate").notNull().default(10),
  dreamDepth: integer("dream_depth").notNull().default(5),
  realTimeMultiplier: integer("real_time_multiplier").notNull().default(10),
});

// Stress Testing - Scenario builder and agent response tracking
export interface StressScenario {
  id: string;
  name: string;
  description: string;
  category: "market_crash" | "liquidity_crisis" | "oracle_failure" | "smart_contract_exploit" | "flash_loan_attack" | "custom";
  severity: 1 | 2 | 3 | 4 | 5;
  parameters: Record<string, any>;
  isTemplate: boolean;
  createdBy: string;
  createdAt: number;
}

export interface AgentStressResponse {
  agentId: string;
  agentType: AgentType;
  action: string;
  reasoning: string;
  reasoningChainId?: string;
  responseTimeMs: number;
  creditsUsed: number;
  success: boolean;
  timestamp: number;
}

export interface StressTestRun {
  id: string;
  scenarioId: string;
  status: "preparing" | "running" | "completed" | "failed";
  agentResponses: AgentStressResponse[];
  overallOutcome: "survived" | "degraded" | "failed" | "pending";
  portfolioImpact: number;
  systemHealthBefore: number;
  systemHealthAfter: number;
  lessonsLearned: string[];
  startedAt: number;
  completedAt?: number;
}

export const stressScenarios = pgTable("stress_scenarios", {
  id: varchar("id").primaryKey(),
  name: varchar("name").notNull(),
  description: text("description").notNull(),
  category: varchar("category").$type<"market_crash" | "liquidity_crisis" | "oracle_failure" | "smart_contract_exploit" | "flash_loan_attack" | "custom">().notNull(),
  severity: integer("severity").notNull().default(3),
  parameters: jsonb("parameters").$type<Record<string, any>>().notNull(),
  isTemplate: boolean("is_template").notNull().default(false),
  createdBy: varchar("created_by").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const stressTestRuns = pgTable("stress_test_runs", {
  id: varchar("id").primaryKey(),
  scenarioId: varchar("scenario_id").notNull(),
  status: varchar("status").$type<"preparing" | "running" | "completed" | "failed">().notNull(),
  agentResponses: jsonb("agent_responses").$type<AgentStressResponse[]>().notNull().default(sql`'[]'::jsonb`),
  overallOutcome: varchar("overall_outcome").$type<"survived" | "degraded" | "failed" | "pending">().notNull().default("pending"),
  portfolioImpact: integer("portfolio_impact").notNull().default(0),
  systemHealthBefore: integer("system_health_before").notNull().default(85),
  systemHealthAfter: integer("system_health_after").notNull().default(85),
  lessonsLearned: jsonb("lessons_learned").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  startedAt: timestamp("started_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

// Insert schemas for new showcase features
export const insertReasoningChainSchema = createInsertSchema(reasoningChains).omit({ timestamp: true });
export const insertParliamentSessionSchema = createInsertSchema(parliamentSessions).omit({ 
  startedAt: true, 
  concludedAt: true,
  debates: true,
  votes: true 
});
export const insertAgentEvolutionSchema = createInsertSchema(agentEvolutions).omit({ 
  spawnedAt: true, 
  retiredAt: true 
});
export const insertDreamSessionSchema = createInsertSchema(dreamSessions).omit({ 
  startedAt: true, 
  endedAt: true,
  discoveries: true 
});
export const insertStressScenarioSchema = createInsertSchema(stressScenarios).omit({ createdAt: true });
export const insertStressTestRunSchema = createInsertSchema(stressTestRuns).omit({ 
  startedAt: true, 
  completedAt: true,
  agentResponses: true,
  lessonsLearned: true 
});

// Types for inserts
export type InsertReasoningChain = z.infer<typeof insertReasoningChainSchema>;
export type InsertParliamentSession = z.infer<typeof insertParliamentSessionSchema>;
export type InsertAgentEvolution = z.infer<typeof insertAgentEvolutionSchema>;
export type InsertDreamSession = z.infer<typeof insertDreamSessionSchema>;
export type InsertStressScenario = z.infer<typeof insertStressScenarioSchema>;
export type InsertStressTestRun = z.infer<typeof insertStressTestRunSchema>;

// Select types
export type SelectReasoningChain = typeof reasoningChains.$inferSelect;
export type SelectParliamentSession = typeof parliamentSessions.$inferSelect;
export type SelectAgentEvolution = typeof agentEvolutions.$inferSelect;
export type SelectDreamSession = typeof dreamSessions.$inferSelect;
export type SelectStressScenario = typeof stressScenarios.$inferSelect;
export type SelectStressTestRun = typeof stressTestRuns.$inferSelect;

// ==========================================
// Alerts System
// ==========================================

export type AlertTriggerType = 
  | "transaction_failed"
  | "high_risk_strategy"
  | "agent_conflict"
  | "parliament_deadlock"
  | "opportunity_found"
  | "balance_drop"
  | "system_error"
  | "rpc_failure";

export interface AlertPreference {
  id: string;
  userId: string;
  email?: string;
  webhookUrl?: string;
  enabledTriggers: AlertTriggerType[];
  rateLimitPerMinute: number;
  createdAt: number;
  updatedAt: number;
}

export interface AlertEvent {
  id: string;
  userId: string;
  type: AlertTriggerType;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  data: Record<string, any>;
  sentViaEmail: boolean;
  sentViaWebhook: boolean;
  read: boolean;
  createdAt: number;
}

export interface InsertAlertPreference {
  userId: string;
  email?: string;
  webhookUrl?: string;
  enabledTriggers: AlertTriggerType[];
  rateLimitPerMinute?: number;
}

export interface InsertAlertEvent {
  userId: string;
  type: AlertTriggerType;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  message: string;
  data: Record<string, any>;
}

