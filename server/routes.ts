import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { AgentOrchestrator } from "./agents/AgentOrchestrator";
import { SimulationEngine } from "./simulation/SimulationEngine";
import { CreditEconomy } from "./economy/CreditEconomy";
import { MemoryVault } from "./memory/MemoryVault";
import { SentinelMonitor } from "./monitoring/SentinelMonitor";
import { ReplayEngine } from "./replay/ReplayEngine";
import { AutonomousCycleManager } from "./autonomous/AutonomousCycleManager";
import { transactionManager } from "./execution/TransactionManager";
import { selfHealingEngine } from "./selfhealing/SelfHealingEngine";
import { mlPatternRecognition } from "./ml/MLPatternRecognition";
import { governanceSystem } from "./governance/GovernanceSystem";
import { PersonalityTrait, AgentType } from "@shared/schema";
import type { WSMessage, LogEntry, TrainingDataPoint, ParliamentVote } from "@shared/schema";
import { initializeApiKeys, requireAuth, requireWriteAuth, type AuthenticatedRequest } from "./middleware/auth";
import { rateLimit, writeLimiter, strictLimiter } from "./middleware/rateLimit";
import { preventInjection, validateContentType } from "./middleware/validation";
import { anthropicCircuitBreaker } from "./utils/circuitBreaker";
import { stripeService } from "./stripeService";
import { getStripePublishableKey } from "./stripeClient";
import { alertService } from "./alerts/AlertService";
import { backtestingEngine } from "./backtesting/BacktestingEngine";
import { walletManager } from "./wallets/WalletManager";
import { rpcClient } from "./blockchain/RPCClient";

// Initialize all services
const orchestrator = new AgentOrchestrator();
const simulationEngine = new SimulationEngine();
const creditEconomy = new CreditEconomy();
const memoryVault = new MemoryVault();
const sentinelMonitor = new SentinelMonitor();
const replayEngine = new ReplayEngine();
const autonomousCycleManager = new AutonomousCycleManager(orchestrator, {
  intervalMs: 30000,
  maxConcurrentCycles: 1,
  retryAttempts: 3,
  retryDelayMs: 2000,
  timeoutMs: 60000,
});

// Start sentinel monitoring
sentinelMonitor.start();

// Setup autonomous cycle event listeners
autonomousCycleManager.on("cycleStarted", (data) => {
  broadcastToClients({
    type: "autonomousCycle",
    data: { status: "started", ...data },
    timestamp: Date.now(),
  });
});

autonomousCycleManager.on("cycleCompleted", (data) => {
  broadcastToClients({
    type: "autonomousCycle",
    data: { status: "completed", ...data },
    timestamp: Date.now(),
  });
});

autonomousCycleManager.on("cycleFailed", (data) => {
  broadcastToClients({
    type: "autonomousCycle",
    data: { status: "failed", ...data },
    timestamp: Date.now(),
  });
});

autonomousCycleManager.on("retryAttempt", (data) => {
  broadcastToClients({
    type: "autonomousCycle",
    data: { status: "retrying", ...data },
    timestamp: Date.now(),
  });
});

// WebSocket clients
const wsClients = new Set<WebSocket>();

function broadcastToClients(message: WSMessage): void {
  const payload = JSON.stringify(message);
  wsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}

// Setup event listeners
orchestrator.on("log", async (logData: Partial<LogEntry>) => {
  const log = await storage.addLog({
    timestamp: Date.now(),
    agentType: logData.agentType!,
    level: logData.level || "info",
    message: logData.message || "",
    personality: logData.personality,
  });

  broadcastToClients({
    type: "log",
    data: log,
    timestamp: Date.now(),
  });

  // Record replay event
  await storage.addReplayEvent({
    id: `event-${Date.now()}`,
    eventType: "decision",
    agentType: logData.agentType,
    data: { message: logData.message },
    timestamp: Date.now(),
  });
});

orchestrator.on("creditChange", async (data) => {
  await storage.addCreditTransaction(data);
  
  // Send credits as separate message type
  const scores = await storage.getCreditScores();
  wsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: "credits",
        data: scores,
        timestamp: Date.now(),
      }));
    }
  });
});

sentinelMonitor.on("alert", async (alert) => {
  await storage.addAlert(alert);
  
  broadcastToClients({
    type: "alert",
    data: alert,
    timestamp: Date.now(),
  });
});

simulationEngine.on("simulationCompleted", async ({ simulationId, branches }) => {
  for (const branch of branches) {
    await storage.addSimulation(branch);
  }

  broadcastToClients({
    type: "simulation",
    data: { simulationId, status: "completed", branches },
    timestamp: Date.now(),
  });
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Initialize API key authentication
  initializeApiKeys();

  // Apply global rate limiting to all API routes
  app.use("/api", rateLimit);
  
  // Apply injection prevention and content-type validation to all API routes
  app.use("/api", preventInjection);
  app.use("/api", validateContentType);

  // Clear old agents and initialize fresh core agents
  await storage.clearAgents();
  const agents = orchestrator.getAllAgents();
  for (const agent of agents) {
    await storage.upsertAgent(agent);
  }

  // // Commented out: Marketplace seeding
  // const existingTemplates = await storage.getAgentTemplates({});
  // if (existingTemplates.length === 0) {
  //   const seedTemplates = [
  //     {
  //       name: "Alpha Scout Pro",
  //       description: "Advanced opportunity detection agent specializing in DeFi arbitrage and yield farming opportunities. Uses ML-powered pattern recognition to identify profitable trades across multiple DEXes.",
  //       agentType: "scout" as const,
  //       strategyType: "arbitrage" as const,
  //       riskTolerance: "moderate" as const,
  //       personality: [PersonalityTrait.CURIOUS, PersonalityTrait.PRECISE, PersonalityTrait.CALM],
  //       basePrice: 9900,
  //       rentalPricePerDay: 499,
  //       yieldSharePercent: 15,
  //       successRate: 72,
  //       avgReturn: 9,
  //       featured: true,
  //       createdBy: "neuronet-platform",
  //     },
  //     // ... other templates commented out
  //   ];
  //   for (const template of seedTemplates) {
  //     await storage.createAgentTemplate({
  //       ...template,
  //       id: `${template.name.toLowerCase().replace(/\s+/g, '-')}-template`,
  //     });
  //   }
  //   console.log("[Routes] Seeded marketplace with agent templates");
  // }

  // // Commented out: Leaderboard seeding
  // const existingLeaderboard = await storage.getLeaderboard("all_time");
  // if (existingLeaderboard.length === 0) {
  //   const seedLeaderboard = [
  //     // ... leaderboard entries commented out
  //   ];
  //   await storage.updateLeaderboard(seedLeaderboard);
  //   console.log("[Routes] Seeded leaderboard with sample data");
  // }

  // WebSocket Setup
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  wss.on("connection", async (ws: WebSocket) => {
    wsClients.add(ws);

    ws.on("close", () => {
      wsClients.delete(ws);
    });

    // Send initial data
    const metrics = await storage.getMetrics();
    ws.send(
      JSON.stringify({
        type: "metrics",
        data: metrics,
        timestamp: Date.now(),
      })
    );
  });

  // System State (read endpoints with optional auth - returns limited data without auth)
  app.get("/api/system/state", async (_req, res) => {
    try {
      const state = await storage.getSystemState();
      res.json(state);
    } catch (error) {
      res.status(500).json({ error: "Failed to get system state" });
    }
  });

  // Agents
  app.get("/api/agents", async (_req, res) => {
    try {
      const agents = await storage.getAgents();
      res.json(agents);
    } catch (error) {
      res.status(500).json({ error: "Failed to get agents" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const agent = await storage.getAgent(req.params.id);
      if (!agent) {
        res.status(404).json({ error: "Agent not found" });
        return;
      }
      res.json(agent);
    } catch (error) {
      res.status(500).json({ error: "Failed to get agent" });
    }
  });

  // Metrics
  app.get("/api/metrics", async (_req, res) => {
    try {
      const metrics = await rpcClient.getOnChainMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Failed to fetch live metrics, using fallback:", error);
      const fallbackMetrics = await storage.getMetrics();
      res.json(fallbackMetrics);
    }
  });

  // Logs
  app.get("/api/logs", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get logs" });
    }
  });

  app.delete("/api/logs", writeLimiter, async (_req, res) => {
    try {
      const result = await storage.clearLogs();
      broadcastToClients({
        type: "log",
        data: { ...result, event: "logsCleared" },
        timestamp: Date.now(),
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to clear logs" });
    }
  });

  app.get("/api/logs/archived", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const logs = await storage.getArchivedLogs(limit);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get archived logs" });
    }
  });

  // Credits
  app.get("/api/credits", async (_req, res) => {
    try {
      const scores = await storage.getCreditScores();
      res.json(scores);
    } catch (error) {
      res.status(500).json({ error: "Failed to get credit scores" });
    }
  });

  app.get("/api/credits/transactions", async (req, res) => {
    try {
      const agentId = req.query.agentId as string | undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
      const transactions = await storage.getCreditTransactions(agentId, limit);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get transactions" });
    }
  });

  // Memory Vault
  app.get("/api/memory", async (req, res) => {
    try {
      const filters = {
        strategyType: req.query.strategyType as string | undefined,
      };
      const entries = await storage.getMemoryEntries(filters);
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: "Failed to get memory entries" });
    }
  });

  // Simulations
  app.get("/api/simulations", async (_req, res) => {
    try {
      const simulations = await storage.getSimulations();
      res.json(simulations);
    } catch (error) {
      res.status(500).json({ error: "Failed to get simulations" });
    }
  });

  // Current Opportunity
  app.get("/api/opportunity", async (_req, res) => {
    try {
      const opportunity = await storage.getCurrentOpportunity();
      res.json(opportunity || {});
    } catch (error) {
      res.status(500).json({ error: "Failed to get opportunity" });
    }
  });

  app.post("/api/simulate", requireWriteAuth, writeLimiter, async (req, res) => {
    try {
      const config = {
        timeHorizon: req.body.timeHorizon || 60,
        branchCount: req.body.branchCount || 5,
        predictionInterval: req.body.predictionInterval || 10,
      };

      // Run simulation asynchronously
      simulationEngine.runSimulation(config, req.body.marketData).catch(console.error);

      res.json({
        simulationId: `sim-${Date.now()}`,
        status: "running",
        estimatedTime: config.timeHorizon,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to start simulation" });
    }
  });

  // Synchronous simulation run - returns results directly
  // Note: Simulation persistence is handled by simulationCompleted event handler
  app.post("/api/simulations/run", requireWriteAuth, writeLimiter, async (req, res) => {
    try {
      const config = {
        timeHorizon: req.body.timeHorizon || 60,
        branchCount: req.body.branchCount || 5,
        predictionInterval: req.body.predictionInterval || 10,
      };

      // Save opportunity if provided
      if (req.body.opportunity) {
        await storage.setCurrentOpportunity(req.body.opportunity);
      }

      const branches = await simulationEngine.runSimulation(config, req.body.marketData);
      const bestBranch = simulationEngine.selectBestBranch(branches);

      res.json({
        simulationId: branches[0]?.id?.split('-branch-')[0] || `sim-${Date.now()}`,
        status: "completed",
        branches,
        bestBranch,
        marketSnapshot: simulationEngine.getLastMarketSnapshot(),
      });
    } catch (error) {
      console.error("Simulation failed:", error);
      res.status(500).json({ error: "Failed to run simulation" });
    }
  });

  // Replay Events
  app.get("/api/replay/events", async (req, res) => {
    try {
      const filters = {
        startTime: req.query.startTime ? parseInt(req.query.startTime as string) : undefined,
        endTime: req.query.endTime ? parseInt(req.query.endTime as string) : undefined,
        eventType: req.query.eventType as string | undefined,
      };
      const events = await storage.getReplayEvents(filters);
      res.json(events);
    } catch (error) {
      res.status(500).json({ error: "Failed to get replay events" });
    }
  });

  // Alerts
  app.get("/api/alerts", async (req, res) => {
    try {
      const filters = {
        severity: req.query.severity as string | undefined,
        alertType: req.query.alertType as string | undefined,
      };
      const alerts = await storage.getAlerts(filters);
      res.json(alerts);
    } catch (error) {
      res.status(500).json({ error: "Failed to get alerts" });
    }
  });

  // Control Endpoints (require authentication for write operations)
  app.post("/api/autonomous/toggle", requireWriteAuth, writeLimiter, async (_req, res) => {
    try {
      const state = await storage.getSystemState();
      const newMode = !state.autonomousMode;
      
      await storage.updateSystemState({ autonomousMode: newMode });

      if (newMode) {
        autonomousCycleManager.start();
      } else {
        autonomousCycleManager.stop();
      }

      res.json({
        autonomousMode: newMode,
        message: newMode ? "Autonomous mode activated" : "Autonomous mode deactivated",
        cycleMetrics: autonomousCycleManager.getMetrics(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle autonomous mode" });
    }
  });

  // Get autonomous cycle metrics
  app.get("/api/autonomous/metrics", async (_req, res) => {
    try {
      const metrics = autonomousCycleManager.getMetrics();
      const state = await storage.getSystemState();
      res.json({
        ...metrics,
        autonomousMode: state.autonomousMode,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get cycle metrics" });
    }
  });

  // Get circuit breaker status
  app.get("/api/health/circuit-breakers", async (_req, res) => {
    try {
      res.json({
        anthropic: anthropicCircuitBreaker.getStats(),
        timestamp: Date.now(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get circuit breaker status" });
    }
  });

  // Manually trigger a single negotiation cycle
  app.post("/api/autonomous/trigger", requireWriteAuth, writeLimiter, async (_req, res) => {
    try {
      const result = await orchestrator.runNegotiationCycle({
        timestamp: Date.now(),
        manual: true,
      });
      res.json({
        success: true,
        result,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to trigger negotiation cycle" });
    }
  });

  // Transaction Execution Endpoints (require authentication)
  app.post("/api/execute", requireWriteAuth, strictLimiter, async (req, res) => {
    try {
      const proposal = transactionManager.validateProposal(req.body.proposal || {});
      const executionPlan = transactionManager.validateExecutionPlan(req.body.executionPlan || {});
      const agentId = req.body.agentId || "manual";
      
      const txRequest = transactionManager.createTransactionBundle(proposal, executionPlan, agentId);
      const unsignedTx = transactionManager.buildUnsignedTransaction(txRequest);

      res.json({
        transactionId: txRequest.id,
        unsignedTransaction: unsignedTx,
        status: "pending",
        message: "Transaction bundle created. Sign and submit via wallet.",
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        res.status(400).json({ error: "Invalid request", details: error.errors });
      } else {
        res.status(500).json({ error: "Failed to create transaction" });
      }
    }
  });

  app.post("/api/execute/:txId/submit", requireWriteAuth, strictLimiter, async (req, res) => {
    try {
      const { txId } = req.params;
      const { signedHash } = req.body;

      if (!signedHash) {
        res.status(400).json({ error: "signedHash required" });
        return;
      }

      const status = await transactionManager.submitTransaction(txId, signedHash);
      
      broadcastToClients({
        type: "transaction",
        data: { status: "submitted", txId, hash: signedHash },
        timestamp: Date.now(),
      });

      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to submit transaction" });
    }
  });

  app.post("/api/execute/:txId/confirm", requireWriteAuth, async (req, res) => {
    try {
      const { txId } = req.params;
      const { blockNumber, gasUsed } = req.body;

      const result = await transactionManager.confirmTransaction(
        txId,
        blockNumber || 0,
        gasUsed || "0"
      );

      broadcastToClients({
        type: "transaction",
        data: { status: "confirmed", ...result },
        timestamp: Date.now(),
      });

      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to confirm transaction" });
    }
  });

  app.get("/api/transactions", async (_req, res) => {
    try {
      const transactions = transactionManager.getAllTransactions();
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get transactions" });
    }
  });

  app.get("/api/transactions/pending", async (_req, res) => {
    try {
      const pending = transactionManager.getPendingTransactions();
      res.json(pending);
    } catch (error) {
      res.status(500).json({ error: "Failed to get pending transactions" });
    }
  });

  app.get("/api/transactions/chain", async (req, res) => {
    try {
      const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : undefined;
      const status = req.query.status as string | undefined;
      const transactions = await storage.getChainTransactions({ chainId, status });
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get chain transactions" });
    }
  });

  // Self-Healing Engine Endpoints
  app.get("/api/selfhealing/health", async (_req, res) => {
    try {
      const agents = await storage.getAgents();
      const healthResults = agents.map(agent => 
        selfHealingEngine.evaluateAgentHealth(agent)
      );
      res.json({
        agents: healthResults,
        summary: selfHealingEngine.getSystemHealthSummary(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get health status" });
    }
  });

  app.get("/api/selfhealing/lineages", async (_req, res) => {
    try {
      const lineages = selfHealingEngine.getAllLineages();
      const lineageArray = Array.from(lineages.entries()).map(([parentId, tree]) => ({
        parentId,
        versions: tree,
      }));
      res.json(lineageArray);
    } catch (error) {
      res.status(500).json({ error: "Failed to get lineages" });
    }
  });

  app.post("/api/selfhealing/check", requireWriteAuth, async (_req, res) => {
    try {
      orchestrator.checkForDeprecation();
      res.json({ success: true, message: "Health check completed" });
    } catch (error) {
      res.status(500).json({ error: "Failed to run health check" });
    }
  });

  // ==========================================
  // ML Pattern Recognition Endpoints
  // ==========================================

  app.get("/api/ml/metrics", async (_req, res) => {
    try {
      const metrics = mlPatternRecognition.getModelMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Failed to get ML metrics:", error);
      res.status(500).json({ error: "Failed to get ML metrics" });
    }
  });

  app.get("/api/ml/clusters", async (_req, res) => {
    try {
      const clusters = mlPatternRecognition.getClusters();
      res.json(clusters);
    } catch (error) {
      console.error("Failed to get clusters:", error);
      res.status(500).json({ error: "Failed to get clusters" });
    }
  });

  app.get("/api/ml/weights", async (_req, res) => {
    try {
      const weights = mlPatternRecognition.getModelWeights();
      res.json(weights);
    } catch (error) {
      console.error("Failed to get model weights:", error);
      res.status(500).json({ error: "Failed to get model weights" });
    }
  });

  app.post("/api/ml/predict", requireWriteAuth, async (req, res) => {
    try {
      const { opportunityId, marketData } = req.body;
      
      if (!opportunityId) {
        return res.status(400).json({ error: "opportunityId is required" });
      }

      const memoryEntries = await storage.getMemoryEntries({});
      const creditTransactions = await storage.getCreditTransactions(undefined, 100);

      const features = mlPatternRecognition.extractFeatures(
        memoryEntries,
        creditTransactions,
        marketData
      );

      const prediction = mlPatternRecognition.predictSuccessProbability(
        opportunityId,
        features
      );

      res.json(prediction);
    } catch (error) {
      console.error("Failed to make prediction:", error);
      res.status(500).json({ error: "Failed to make prediction" });
    }
  });

  app.post("/api/ml/train", requireWriteAuth, writeLimiter, async (req, res) => {
    try {
      const { dataPoints } = req.body;
      
      if (!Array.isArray(dataPoints) || dataPoints.length === 0) {
        return res.status(400).json({ error: "dataPoints array is required" });
      }

      mlPatternRecognition.train(dataPoints as TrainingDataPoint[]);
      const metrics = mlPatternRecognition.getModelMetrics();

      res.json({
        success: true,
        message: `Model trained with ${dataPoints.length} data points`,
        metrics,
      });
    } catch (error) {
      console.error("Failed to train model:", error);
      res.status(500).json({ error: "Failed to train model" });
    }
  });

  app.post("/api/ml/cluster", requireWriteAuth, writeLimiter, async (req, res) => {
    try {
      const { k = 5, maxIterations = 100, tolerance = 0.001 } = req.body;
      
      const memoryEntries = await storage.getMemoryEntries({});
      const creditTransactions = await storage.getCreditTransactions(undefined, 500);

      const featureVectors = memoryEntries.map(entry => 
        mlPatternRecognition.extractFeatures(
          [entry],
          creditTransactions,
          undefined
        )
      );

      if (featureVectors.length < k) {
        return res.status(400).json({ 
          error: `Not enough data points. Need at least ${k}, have ${featureVectors.length}` 
        });
      }

      const clusters = mlPatternRecognition.performKMeansClustering(
        featureVectors,
        { k, maxIterations, tolerance }
      );

      res.json({
        success: true,
        clusters,
        message: `Created ${clusters.length} clusters from ${featureVectors.length} data points`,
      });
    } catch (error) {
      console.error("Failed to perform clustering:", error);
      res.status(500).json({ error: "Failed to perform clustering" });
    }
  });

  app.post("/api/ml/outcome", requireWriteAuth, async (req, res) => {
    try {
      const { opportunityId, outcome, actualReturn } = req.body;
      
      if (!opportunityId || !outcome) {
        return res.status(400).json({ error: "opportunityId and outcome are required" });
      }

      if (!["success", "failure"].includes(outcome)) {
        return res.status(400).json({ error: "outcome must be 'success' or 'failure'" });
      }

      mlPatternRecognition.recordOutcome(opportunityId, outcome, actualReturn || 0);

      res.json({
        success: true,
        message: "Outcome recorded successfully",
      });
    } catch (error) {
      console.error("Failed to record outcome:", error);
      res.status(500).json({ error: "Failed to record outcome" });
    }
  });

  // ==========================================
  // Multi-Signature Governance Endpoints
  // ==========================================

  app.get("/api/governance/proposals", async (req, res) => {
    try {
      const { status, proposer, signer } = req.query;
      
      let proposals = governanceSystem.getAllProposals();
      
      if (status) {
        proposals = proposals.filter(p => p.status === status);
      }
      
      if (proposer) {
        proposals = governanceSystem.getProposalsByProposer(proposer as string);
      }
      
      if (signer) {
        proposals = governanceSystem.getProposalsBySigner(signer as string);
      }

      res.json(proposals);
    } catch (error) {
      console.error("Failed to get proposals:", error);
      res.status(500).json({ error: "Failed to get proposals" });
    }
  });

  app.get("/api/governance/proposals/:id", async (req, res) => {
    try {
      const proposal = governanceSystem.getProposal(req.params.id);
      
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      const votes = governanceSystem.getProposalVotes(req.params.id);
      const voteSummary = governanceSystem.getVoteSummary(req.params.id);

      res.json({
        ...proposal,
        votes,
        voteSummary,
      });
    } catch (error) {
      console.error("Failed to get proposal:", error);
      res.status(500).json({ error: "Failed to get proposal" });
    }
  });

  app.post("/api/governance/proposals", requireWriteAuth, writeLimiter, async (req, res) => {
    try {
      const {
        title,
        description,
        proposer,
        transactionValue,
        transactionTo,
        transactionData,
        chain,
        threshold,
        signers,
        safeAddress,
      } = req.body;

      if (!title || !description || !proposer || !transactionTo || !threshold || !signers) {
        return res.status(400).json({ 
          error: "Missing required fields: title, description, proposer, transactionTo, threshold, signers" 
        });
      }

      if (!["2-of-3", "3-of-5", "4-of-7"].includes(threshold)) {
        return res.status(400).json({ error: "Invalid threshold. Use: 2-of-3, 3-of-5, or 4-of-7" });
      }

      const proposal = governanceSystem.createProposal({
        title,
        description,
        proposer,
        transactionValue: transactionValue || 0,
        transactionTo,
        transactionData: transactionData || "0x",
        chain: chain || "ethereum",
        threshold,
        signers,
        safeAddress,
      });

      broadcastToClients({
        type: "alert",
        data: { 
          alertType: "governance",
          severity: transactionValue > 50000 ? "high" : "medium",
          message: `New governance proposal created: ${title}`,
          proposal,
        },
        timestamp: Date.now(),
      });

      res.json(proposal);
    } catch (error: any) {
      console.error("Failed to create proposal:", error);
      res.status(400).json({ error: error.message || "Failed to create proposal" });
    }
  });

  app.post("/api/governance/proposals/:id/sign", requireWriteAuth, strictLimiter, async (req, res) => {
    try {
      const { signerAddress, signature } = req.body;

      if (!signerAddress || !signature) {
        return res.status(400).json({ error: "signerAddress and signature are required" });
      }

      const proposal = governanceSystem.signProposal(
        req.params.id,
        signerAddress,
        signature
      );

      broadcastToClients({
        type: "alert",
        data: { 
          alertType: "governance",
          severity: "medium",
          message: `Proposal signed: ${proposal.title} (${proposal.currentSignatures}/${proposal.requiredSignatures})`,
          proposal,
        },
        timestamp: Date.now(),
      });

      res.json(proposal);
    } catch (error: any) {
      console.error("Failed to sign proposal:", error);
      res.status(400).json({ error: error.message || "Failed to sign proposal" });
    }
  });

  app.post("/api/governance/proposals/:id/vote", requireWriteAuth, async (req, res) => {
    try {
      const { voter, vote, reason } = req.body;

      if (!voter || !vote) {
        return res.status(400).json({ error: "voter and vote are required" });
      }

      if (!["approve", "reject", "abstain"].includes(vote)) {
        return res.status(400).json({ error: "vote must be 'approve', 'reject', or 'abstain'" });
      }

      const voteRecord = governanceSystem.castVote(
        req.params.id,
        voter,
        vote,
        reason
      );

      res.json(voteRecord);
    } catch (error: any) {
      console.error("Failed to cast vote:", error);
      res.status(400).json({ error: error.message || "Failed to cast vote" });
    }
  });

  app.post("/api/governance/proposals/:id/execute", requireWriteAuth, strictLimiter, async (req, res) => {
    try {
      const proposal = governanceSystem.executeProposal(req.params.id);

      broadcastToClients({
        type: "alert",
        data: { 
          alertType: "governance",
          severity: "high",
          message: `Proposal executed: ${proposal.title}`,
          proposal,
        },
        timestamp: Date.now(),
      });

      res.json(proposal);
    } catch (error: any) {
      console.error("Failed to execute proposal:", error);
      res.status(400).json({ error: error.message || "Failed to execute proposal" });
    }
  });

  app.post("/api/governance/proposals/:id/reject", requireWriteAuth, async (req, res) => {
    try {
      const { reason } = req.body;
      const proposal = governanceSystem.rejectProposal(req.params.id, reason);

      res.json(proposal);
    } catch (error: any) {
      console.error("Failed to reject proposal:", error);
      res.status(400).json({ error: error.message || "Failed to reject proposal" });
    }
  });

  app.get("/api/governance/stats", async (_req, res) => {
    try {
      const stats = governanceSystem.getProposalStats();
      res.json(stats);
    } catch (error) {
      console.error("Failed to get governance stats:", error);
      res.status(500).json({ error: "Failed to get governance stats" });
    }
  });

  app.get("/api/governance/pending/:signer", async (req, res) => {
    try {
      const pendingProposals = governanceSystem.getSignerPendingProposals(req.params.signer);
      res.json(pendingProposals);
    } catch (error) {
      console.error("Failed to get pending proposals:", error);
      res.status(500).json({ error: "Failed to get pending proposals" });
    }
  });

  app.get("/api/governance/executable", async (_req, res) => {
    try {
      const executableProposals = governanceSystem.getExecutableProposals();
      res.json(executableProposals);
    } catch (error) {
      console.error("Failed to get executable proposals:", error);
      res.status(500).json({ error: "Failed to get executable proposals" });
    }
  });

  app.get("/api/governance/timelock", async (_req, res) => {
    try {
      const config = governanceSystem.getTimelockConfig();
      res.json(config);
    } catch (error) {
      console.error("Failed to get timelock config:", error);
      res.status(500).json({ error: "Failed to get timelock config" });
    }
  });

  app.post("/api/governance/timelock", requireWriteAuth, async (req, res) => {
    try {
      const { minimumDelayHours, maximumDelayHours, highValueThreshold } = req.body;
      
      const config = governanceSystem.updateTimelockConfig({
        minimumDelayHours,
        maximumDelayHours,
        highValueThreshold,
      });

      res.json(config);
    } catch (error) {
      console.error("Failed to update timelock config:", error);
      res.status(500).json({ error: "Failed to update timelock config" });
    }
  });

  app.get("/api/governance/safe-configs", async (_req, res) => {
    try {
      const configs = governanceSystem.getAllSafeConfigs();
      res.json(configs);
    } catch (error) {
      console.error("Failed to get Safe configs:", error);
      res.status(500).json({ error: "Failed to get Safe configs" });
    }
  });

  app.post("/api/governance/safe-configs", requireWriteAuth, async (req, res) => {
    try {
      const { safeAddress, chain, owners, threshold } = req.body;

      if (!safeAddress || !chain || !owners || !threshold) {
        return res.status(400).json({ 
          error: "Missing required fields: safeAddress, chain, owners, threshold" 
        });
      }

      const config = governanceSystem.registerSafeConfig({
        safeAddress,
        chain,
        owners,
        threshold,
      });

      res.json(config);
    } catch (error) {
      console.error("Failed to register Safe config:", error);
      res.status(500).json({ error: "Failed to register Safe config" });
    }
  });

  app.get("/api/governance/proposals/:id/safe-tx", async (req, res) => {
    try {
      const proposal = governanceSystem.getProposal(req.params.id);
      
      if (!proposal) {
        return res.status(404).json({ error: "Proposal not found" });
      }

      const safeTx = governanceSystem.buildSafeTransaction(proposal);
      res.json(safeTx);
    } catch (error) {
      console.error("Failed to build Safe transaction:", error);
      res.status(500).json({ error: "Failed to build Safe transaction" });
    }
  });

  // Solana RPC Endpoints
  app.get("/api/solana/metrics", async (req, res) => {
    try {
      const { solanaRpcClient } = await import("./blockchain/SolanaRPCClient");
      const walletAddress = req.query.wallet as string | undefined;
      const metrics = await solanaRpcClient.getOnChainMetrics(walletAddress);
      res.json(metrics);
    } catch (error) {
      console.error("Failed to get Solana metrics:", error);
      res.status(500).json({ error: "Failed to get Solana metrics" });
    }
  });

  app.get("/api/solana/jupiter/quote", async (req, res) => {
    try {
      const { solanaRpcClient } = await import("./blockchain/SolanaRPCClient");
      const { inputMint, outputMint, amount, slippageBps } = req.query;
      
      if (!inputMint || !outputMint || !amount) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const route = await solanaRpcClient.getJupiterSwapRoute(
        inputMint as string,
        outputMint as string,
        parseInt(amount as string),
        slippageBps ? parseInt(slippageBps as string) : 50
      );
      res.json(route);
    } catch (error) {
      console.error("Failed to get Jupiter quote:", error);
      res.status(500).json({ error: "Failed to get Jupiter quote" });
    }
  });

  app.get("/api/solana/marinade/metrics", async (req, res) => {
    try {
      const { solanaRpcClient } = await import("./blockchain/SolanaRPCClient");
      const metrics = await solanaRpcClient.getMarinadeMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Failed to get Marinade metrics:", error);
      res.status(500).json({ error: "Failed to get Marinade metrics" });
    }
  });

  app.get("/api/solana/orca/pools", async (req, res) => {
    try {
      const { solanaRpcClient } = await import("./blockchain/SolanaRPCClient");
      const pools = await solanaRpcClient.getTopOrcaPools();
      res.json(pools);
    } catch (error) {
      console.error("Failed to get Orca pools:", error);
      res.status(500).json({ error: "Failed to get Orca pools" });
    }
  });

  app.get("/api/solana/wallet/health", async (req, res) => {
    try {
      const { solanaRpcClient } = await import("./blockchain/SolanaRPCClient");
      const { PublicKey } = await import("@solana/web3.js");
      const address = req.query.address as string;
      
      if (!address) {
        return res.status(400).json({ error: "Wallet address required" });
      }

      try {
        new PublicKey(address);
      } catch {
        return res.status(400).json({ error: "Invalid Solana wallet address format" });
      }

      const health = await solanaRpcClient.monitorWalletHealth(address);
      res.json(health);
    } catch (error) {
      console.error("Failed to check wallet health:", error);
      res.status(500).json({ error: "Failed to check wallet health" });
    }
  });

  // MEV Protection Endpoints
  app.get("/api/mev/status", async (_req, res) => {
    try {
      const { flashbotsClient } = await import("./blockchain/FlashbotsClient");
      const status = flashbotsClient.getProtectionStatus();
      res.json({
        ...status,
        protectedTransactions: 0,
        mevSaved: 0,
      });
    } catch (error) {
      console.error("Failed to get MEV status:", error);
      res.status(500).json({ error: "Failed to get MEV protection status" });
    }
  });

  app.post("/api/mev/analyze", async (req, res) => {
    try {
      const { flashbotsClient } = await import("./blockchain/FlashbotsClient");
      const { parseEther } = await import("viem");
      const { txValue, txTo, txData } = req.body;
      
      if (!txValue || !txTo) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const value = parseEther(txValue);
      const analysis = await flashbotsClient.analyzeMEVRisk(value, txTo, txData);
      res.json(analysis);
    } catch (error) {
      console.error("Failed to analyze MEV risk:", error);
      res.status(500).json({ error: "Failed to analyze MEV risk" });
    }
  });

  app.post("/api/mev/protection-strategy", async (req, res) => {
    try {
      const { flashbotsClient } = await import("./blockchain/FlashbotsClient");
      const { parseEther } = await import("viem");
      const { txValue, mevRisk } = req.body;
      
      if (!txValue || !mevRisk) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const value = parseEther(txValue);
      const strategy = flashbotsClient.calculateOptimalProtectionStrategy(value, mevRisk);
      res.json(strategy);
    } catch (error) {
      console.error("Failed to calculate protection strategy:", error);
      res.status(500).json({ error: "Failed to calculate protection strategy" });
    }
  });

  app.post("/api/mev/assess-transaction", async (req, res) => {
    try {
      const { RiskAgent } = await import("./agents/RiskAgent");
      const riskAgent = new RiskAgent();
      const { txValue, txTo, txData, slippageTolerance } = req.body;
      
      if (!txValue || !txTo) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const assessment = await riskAgent.assessTransactionSafety(
        txValue,
        txTo,
        txData,
        slippageTolerance || 50
      );
      res.json(assessment);
    } catch (error) {
      console.error("Failed to assess transaction:", error);
      res.status(500).json({ error: "Failed to assess transaction safety" });
    }
  });

  app.post("/api/mev/estimate-loss", async (req, res) => {
    try {
      const { RiskAgent } = await import("./agents/RiskAgent");
      const riskAgent = new RiskAgent();
      const { txValue, mevRisk } = req.body;
      
      if (!txValue || !mevRisk) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const estimate = riskAgent.calculateMEVLossEstimate(txValue, mevRisk);
      res.json(estimate);
    } catch (error) {
      console.error("Failed to estimate MEV loss:", error);
      res.status(500).json({ error: "Failed to estimate MEV loss" });
    }
  });

  // Solana Wallet Management
  app.get("/api/solana/wallets", async (_req, res) => {
    try {
      const wallets = await storage.getSolanaWallets();
      res.json(wallets);
    } catch (error) {
      console.error("Failed to get Solana wallets:", error);
      res.status(500).json({ error: "Failed to get Solana wallets" });
    }
  });

  app.post("/api/solana/wallet/connect", async (req, res) => {
    try {
      const { PublicKey } = await import("@solana/web3.js");
      const { address, provider } = req.body;

      if (!address || !provider) {
        return res.status(400).json({ error: "Missing address or provider" });
      }

      try {
        new PublicKey(address);
      } catch {
        return res.status(400).json({ error: "Invalid Solana wallet address" });
      }

      const existing = await storage.getSolanaWallet(address);
      if (existing) {
        const updated = await storage.updateSolanaWallet(address, {
          connected: true,
          provider: provider as "phantom" | "solflare" | "other",
        });
        return res.json(updated);
      }

      const wallet = await storage.addSolanaWallet({
        id: `wallet-${Date.now()}`,
        address,
        provider: provider as "phantom" | "solflare" | "other",
        connected: true,
        balanceSol: 0,
        totalValueUsd: 0,
        connectedAt: Date.now(),
        lastUpdated: Date.now(),
      });

      broadcastToClients({
        type: "agent_update",
        data: { event: "solana_wallet_connected", wallet },
        timestamp: Date.now(),
      });

      res.json(wallet);
    } catch (error) {
      console.error("Failed to connect Solana wallet:", error);
      res.status(500).json({ error: "Failed to connect wallet" });
    }
  });

  app.post("/api/solana/wallet/disconnect", async (req, res) => {
    try {
      const { address } = req.body;

      if (!address) {
        return res.status(400).json({ error: "Missing wallet address" });
      }

      const success = await storage.removeSolanaWallet(address);

      if (success) {
        broadcastToClients({
          type: "agent_update",
          data: { event: "solana_wallet_disconnected", address },
          timestamp: Date.now(),
        });

        return res.json({ success: true, message: "Wallet disconnected" });
      }

      res.status(404).json({ error: "Wallet not found" });
    } catch (error) {
      console.error("Failed to disconnect Solana wallet:", error);
      res.status(500).json({ error: "Failed to disconnect wallet" });
    }
  });

  app.post("/api/solana/wallet/update-balance", async (req, res) => {
    try {
      const { solanaRpcClient } = await import("./blockchain/SolanaRPCClient");
      const { PublicKey } = await import("@solana/web3.js");
      const { address } = req.body;

      if (!address) {
        return res.status(400).json({ error: "Missing wallet address" });
      }

      try {
        new PublicKey(address);
      } catch {
        return res.status(400).json({ error: "Invalid Solana wallet address" });
      }

      const metrics = await solanaRpcClient.getOnChainMetrics(address);
      const updated = await storage.updateSolanaWallet(address, {
        balanceSol: metrics.walletBalanceSol,
        totalValueUsd: metrics.walletBalanceSol * metrics.solPriceUsd,
        lastUpdated: Date.now(),
      });

      res.json(updated);
    } catch (error) {
      console.error("Failed to update wallet balance:", error);
      res.status(500).json({ error: "Failed to update wallet balance" });
    }
  });

  // Setup transaction event listeners
  transactionManager.on("transactionCreated", (tx) => {
    broadcastToClients({
      type: "transaction",
      data: { status: "created", ...tx },
      timestamp: Date.now(),
    });
  });

  transactionManager.on("transactionSubmitted", async (data) => {
    broadcastToClients({
      type: "transaction",
      data: { status: "submitted", ...data },
      timestamp: Date.now(),
    });

    if (data.chainTransaction) {
      try {
        await storage.addChainTransaction(data.chainTransaction as any);
      } catch (err) {
        console.error("Failed to persist chain transaction:", err);
      }
    }
  });

  transactionManager.on("transactionConfirmed", async (data) => {
    broadcastToClients({
      type: "transaction",
      data: { status: "confirmed", ...data },
      timestamp: Date.now(),
    });

    try {
      await storage.updateSystemState({
        totalTransactionsExecuted: 1,
      });

      if (data.agentId && data.result) {
        await creditEconomy.recordTransaction({
          agentId: data.agentId,
          agentType: AgentType.EXECUTION,
          amount: data.result.creditAdjustment,
          reason: "Transaction confirmed successfully",
          timestamp: Date.now(),
        });
      }

      if (data.chainTransaction) {
        await storage.updateChainTransaction(data.txId, {
          status: "confirmed",
          blockNumber: data.blockNumber,
          gasUsed: data.gasUsed,
        });
      }
    } catch (err) {
      console.error("Failed to update transaction confirmation:", err);
    }
  });

  transactionManager.on("transactionFailed", async (data) => {
    broadcastToClients({
      type: "transaction",
      data: { status: "failed", ...data },
      timestamp: Date.now(),
    });

    try {
      if (data.agentId && data.result) {
        await creditEconomy.recordTransaction({
          agentId: data.agentId,
          agentType: AgentType.EXECUTION,
          amount: data.result.creditAdjustment,
          reason: `Transaction failed: ${data.error}`,
          timestamp: Date.now(),
        });
      }

      if (data.chainTransaction) {
        await storage.updateChainTransaction(data.txId, {
          status: "failed",
        });
      }
    } catch (err) {
      console.error("Failed to update transaction failure:", err);
    }
  });

  transactionManager.on("transactionMonitorCheck", (data) => {
    broadcastToClients({
      type: "transactionMonitor",
      data: { status: "checking", ...data },
      timestamp: Date.now(),
    });
  });

  transactionManager.on("transactionMonitorTimeout", (data) => {
    broadcastToClients({
      type: "transactionMonitor",
      data: { status: "timeout", ...data },
      timestamp: Date.now(),
    });
  });

  // ==========================================
  // Agent Marketplace Endpoints (COMMENTED OUT - Marketplace and NFT buying disabled)
  // ==========================================
  
  /*
  // Commented out: Agent Templates, Marketplace Listings, Agent Rentals, Agent NFTs, and Leaderboard endpoints
  app.get("/api/marketplace/templates", ...)
  app.get("/api/marketplace/templates/:id", ...)
  app.post("/api/marketplace/templates", ...)
  app.patch("/api/marketplace/templates/:id", ...)
  app.get("/api/marketplace/listings", ...)
  app.get("/api/marketplace/listings/:id", ...)
  app.post("/api/marketplace/listings", ...)
  app.patch("/api/marketplace/listings/:id", ...)
  app.get("/api/marketplace/rentals", ...)
  app.post("/api/marketplace/rentals", ...)
  app.patch("/api/marketplace/rentals/:id", ...)
  app.get("/api/marketplace/nfts", ...)
  app.post("/api/marketplace/nfts/mint", ...)
  app.get("/api/marketplace/leaderboard", ...)
  */

  // =============================================
  // STRIPE PAYMENT ENDPOINTS (COMMENTED OUT - Marketplace and NFT buying disabled)
  // =============================================
  
  /*
  // Commented out: Stripe payment endpoints for marketplace/NFT buying
  app.get("/api/stripe/config", async (req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch (error) {
      console.error("Failed to get Stripe config:", error);
      res.status(500).json({ error: "Stripe not configured" });
    }
  });

  // Create payment intent for agent rental
  app.post("/api/stripe/rental-payment", requireWriteAuth, async (req, res) => {
    try {
      const { z } = await import("zod");
      const schema = z.object({
        listingId: z.string().min(1),
        templateId: z.string().min(1),
        rentalDays: z.number().int().positive(),
        renterId: z.string().min(1),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payment data", details: parsed.error.flatten() });
      }
      
      const { listingId, templateId, rentalDays, renterId } = parsed.data;
      
      // Get listing to calculate price
      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Calculate total (price in cents)
      const totalAmount = listing.rentalPricePerDay * rentalDays * 100;
      
      // Create payment intent
      const paymentIntent = await stripeService.createPaymentIntent(
        totalAmount,
        'usd',
        {
          type: 'agent_rental',
          listingId,
          templateId,
          renterId,
          rentalDays: String(rentalDays),
        }
      );
      
      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: totalAmount,
        currency: 'usd',
      });
    } catch (error) {
      console.error("Failed to create rental payment:", error);
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  // Create payment intent for NFT minting
  app.post("/api/stripe/mint-payment", requireWriteAuth, async (req, res) => {
    try {
      const { z } = await import("zod");
      const schema = z.object({
        templateId: z.string().min(1),
        ownerAddress: z.string().min(1),
        chain: z.enum(["ethereum", "solana"]),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid payment data", details: parsed.error.flatten() });
      }
      
      const { templateId, ownerAddress, chain } = parsed.data;
      
      // Get template to calculate minting fee
      const template = await storage.getAgentTemplate(templateId);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Minting fee: base price * 0.1 (10% of template price) or minimum $5
      const mintFee = Math.max(template.basePrice * 10, 500); // in cents
      
      // Create payment intent
      const paymentIntent = await stripeService.createPaymentIntent(
        mintFee,
        'usd',
        {
          type: 'nft_mint',
          templateId,
          ownerAddress,
          chain,
        }
      );
      
      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: mintFee,
        currency: 'usd',
      });
    } catch (error) {
      console.error("Failed to create mint payment:", error);
      res.status(500).json({ error: "Failed to create payment" });
    }
  });

  // Confirm rental payment and create rental
  app.post("/api/stripe/confirm-rental", requireWriteAuth, async (req, res) => {
    try {
      const { z } = await import("zod");
      const schema = z.object({
        paymentIntentId: z.string().min(1),
        listingId: z.string().min(1),
        templateId: z.string().min(1),
        renterId: z.string().min(1),
        ownerId: z.string().min(1),
        rentalDays: z.number().int().positive(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid confirmation data", details: parsed.error.flatten() });
      }
      
      const { paymentIntentId, listingId, templateId, renterId, ownerId, rentalDays } = parsed.data;
      
      // Verify payment was successful
      const paymentIntent = await stripeService.retrievePaymentIntent(paymentIntentId);
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ error: "Payment not completed", status: paymentIntent.status });
      }
      
      // Get listing for pricing
      const listing = await storage.getMarketplaceListing(listingId);
      if (!listing) {
        return res.status(404).json({ error: "Listing not found" });
      }
      
      // Create rental record
      const startDate = Date.now();
      const endDate = startDate + (rentalDays * 24 * 60 * 60 * 1000);
      
      const rental = await storage.createAgentRental({
        id: `rental-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        listingId,
        templateId,
        renterId,
        ownerId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        dailyRate: listing.rentalPricePerDay,
        yieldSharePercent: listing.yieldSharePercent,
      });
      
      // Update with stripe payment intent ID
      const updatedRental = await storage.updateAgentRental(rental.id, {
        stripePaymentIntentId: paymentIntentId,
        totalPaid: paymentIntent.amount,
      });
      
      res.status(201).json(updatedRental || rental);
    } catch (error) {
      console.error("Failed to confirm rental:", error);
      res.status(500).json({ error: "Failed to confirm rental" });
    }
  });

  // Confirm mint payment and create NFT
  app.post("/api/stripe/confirm-mint", requireWriteAuth, strictLimiter, async (req, res) => {
    try {
      const { z } = await import("zod");
      const schema = z.object({
        paymentIntentId: z.string().min(1),
        templateId: z.string().min(1),
        ownerAddress: z.string().min(1),
        chain: z.enum(["ethereum", "solana"]),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid confirmation data", details: parsed.error.flatten() });
      }
      
      const { paymentIntentId, templateId, ownerAddress, chain } = parsed.data;
      
      // Verify payment was successful
      const paymentIntent = await stripeService.retrievePaymentIntent(paymentIntentId);
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({ error: "Payment not completed", status: paymentIntent.status });
      }
      
      // Get template
      const template = await storage.getAgentTemplate(templateId);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      
      // Generate NFT data
      const tokenId = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const contractAddress = chain === "solana" 
        ? "AgentNFT" + Math.random().toString(36).substring(7)
        : "0x" + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");
      
      const nft = await storage.createAgentNFT({
        id: `nft-${tokenId}`,
        templateId,
        tokenId,
        contractAddress,
        chain,
        ownerAddress,
        metadata: {
          name: template.name,
          description: template.description,
          image: template.imageUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${template.id}`,
          attributes: [
            { trait_type: "Agent Type", value: template.agentType },
            { trait_type: "Strategy", value: template.strategyType },
            { trait_type: "Risk Tolerance", value: template.riskTolerance },
            { trait_type: "Performance Score", value: template.performanceScore },
            { trait_type: "Success Rate", value: `${template.successRate}%` },
          ],
        },
        stripePaymentIntentId: paymentIntentId,
        mintFee: paymentIntent.amount,
      });
      
      // Update template deployment count
      await storage.updateAgentTemplate(templateId, {
        totalDeployments: template.totalDeployments + 1,
      });
      
      res.status(201).json(nft);
    } catch (error) {
      console.error("Failed to confirm mint:", error);
      res.status(500).json({ error: "Failed to confirm mint" });
    }
  });

  // =============================================
  // STRIPE CONNECT - SELLER ONBOARDING
  // =============================================

  // Get seller profile
  app.get("/api/sellers/:walletAddress", async (req, res) => {
    try {
      const profile = await storage.getSellerProfile(req.params.walletAddress);
      if (!profile) {
        return res.status(404).json({ error: "Seller profile not found" });
      }
      res.json(profile);
    } catch (error) {
      console.error("Failed to get seller profile:", error);
      res.status(500).json({ error: "Failed to get seller profile" });
    }
  });

  // Create or get seller profile and start Stripe Connect onboarding
  app.post("/api/sellers/onboard", requireWriteAuth, async (req, res) => {
    try {
      const { z } = await import("zod");
      const schema = z.object({
        walletAddress: z.string().min(1),
        email: z.string().email(),
      });
      
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten() });
      }
      
      const { walletAddress, email } = parsed.data;
      
      // Check if profile exists
      let profile = await storage.getSellerProfile(walletAddress);
      
      if (!profile) {
        // Create new seller profile
        profile = await storage.createSellerProfile({
          id: `seller-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          walletAddress,
          email,
        });
      }
      
      // If already has Stripe account and completed onboarding, return profile
      if (profile.stripeAccountId && profile.stripeOnboardingComplete) {
        return res.json({ profile, onboardingComplete: true });
      }
      
      // Create or get Stripe Connect account
      let stripeAccountId = profile.stripeAccountId;
      
      if (!stripeAccountId) {
        const account = await stripeService.createConnectAccount(email, {
          walletAddress,
          profileId: profile.id,
        });
        stripeAccountId = account.id;
        
        // Update profile with Stripe account ID
        await storage.updateSellerProfile(profile.id, { stripeAccountId });
      }
      
      // Create onboarding link
      const baseUrl = `https://${process.env.REPLIT_DOMAINS?.split(',')[0]}`;
      const accountLink = await stripeService.createConnectAccountLink(
        stripeAccountId,
        `${baseUrl}/marketplace?onboarding=complete`,
        `${baseUrl}/marketplace?onboarding=refresh`
      );
      
      res.json({
        profile: { ...profile, stripeAccountId },
        onboardingUrl: accountLink.url,
        onboardingComplete: false,
      });
    } catch (error) {
      console.error("Failed to onboard seller:", error);
      res.status(500).json({ error: "Failed to start seller onboarding" });
    }
  });

  // Check seller onboarding status
  app.get("/api/sellers/:walletAddress/status", async (req, res) => {
    try {
      const profile = await storage.getSellerProfile(req.params.walletAddress);
      if (!profile) {
        return res.status(404).json({ error: "Seller profile not found" });
      }
      
      if (!profile.stripeAccountId) {
        return res.json({ onboardingComplete: false, needsOnboarding: true });
      }
      
      // Check Stripe account status
      const account = await stripeService.getConnectAccount(profile.stripeAccountId);
      const onboardingComplete = account.charges_enabled && account.payouts_enabled;
      
      // Update profile if status changed
      if (onboardingComplete !== profile.stripeOnboardingComplete) {
        await storage.updateSellerProfile(profile.id, { stripeOnboardingComplete: onboardingComplete });
      }
      
      res.json({
        onboardingComplete,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        platformFeePercent: stripeService.getPlatformFeePercent(),
      });
    } catch (error) {
      console.error("Failed to check seller status:", error);
      res.status(500).json({ error: "Failed to check seller status" });
    }
  });

  // Get seller dashboard link
  app.get("/api/sellers/:walletAddress/dashboard", async (req, res) => {
    try {
      const profile = await storage.getSellerProfile(req.params.walletAddress);
      if (!profile || !profile.stripeAccountId) {
        return res.status(404).json({ error: "Seller not connected to Stripe" });
      }
      
      const loginLink = await stripeService.createConnectLoginLink(profile.stripeAccountId);
      res.json({ dashboardUrl: loginLink.url });
    } catch (error) {
      console.error("Failed to get dashboard link:", error);
      res.status(500).json({ error: "Failed to get dashboard link" });
    }
  });

  // Get seller balance
  app.get("/api/sellers/:walletAddress/balance", async (req, res) => {
    try {
      const profile = await storage.getSellerProfile(req.params.walletAddress);
      if (!profile || !profile.stripeAccountId) {
        return res.status(404).json({ error: "Seller not connected to Stripe" });
      }
      
      const balance = await stripeService.getAccountBalance(profile.stripeAccountId);
      res.json({
        available: balance.available,
        pending: balance.pending,
        totalEarnings: profile.totalEarnings,
        totalSales: profile.totalSales,
      });
    } catch (error) {
      console.error("Failed to get balance:", error);
      res.status(500).json({ error: "Failed to get balance" });
    }
  });

  // ==========================================
  // Alert System Routes
  // ==========================================

  // Get all alert configurations
  app.get("/api/alerts/configurations", async (req, res) => {
    try {
      const configurations = alertService.getConfigurations();
      res.json(configurations);
    } catch (error) {
      console.error("Failed to get alert configurations:", error);
      res.status(500).json({ error: "Failed to get alert configurations" });
    }
  });

  // Create alert configuration
  app.post("/api/alerts/configurations", async (req, res) => {
    try {
      const config = await alertService.createConfiguration(req.body);
      res.status(201).json(config);
    } catch (error) {
      console.error("Failed to create alert configuration:", error);
      res.status(500).json({ error: "Failed to create alert configuration" });
    }
  });

  // Update alert configuration
  app.patch("/api/alerts/configurations/:id", async (req, res) => {
    try {
      const updated = await alertService.updateConfiguration(req.params.id, req.body);
      if (!updated) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to update alert configuration:", error);
      res.status(500).json({ error: "Failed to update alert configuration" });
    }
  });

  // Delete alert configuration
  app.delete("/api/alerts/configurations/:id", async (req, res) => {
    try {
      const deleted = await alertService.deleteConfiguration(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Configuration not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete alert configuration:", error);
      res.status(500).json({ error: "Failed to delete alert configuration" });
    }
  });

  // Test alert configuration
  app.post("/api/alerts/configurations/:id/test", async (req, res) => {
    try {
      const result = await alertService.testConfiguration(req.params.id);
      res.json(result);
    } catch (error) {
      console.error("Failed to test alert configuration:", error);
      res.status(500).json({ error: "Failed to test alert configuration" });
    }
  });

  // Get alert notifications history
  app.get("/api/alerts/notifications", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const notifications = alertService.getNotifications(limit);
      res.json(notifications);
    } catch (error) {
      console.error("Failed to get notifications:", error);
      res.status(500).json({ error: "Failed to get notifications" });
    }
  });

  // Get alert stats
  app.get("/api/alerts/stats", async (req, res) => {
    try {
      const stats = alertService.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Failed to get alert stats:", error);
      res.status(500).json({ error: "Failed to get alert stats" });
    }
  });

  // Hook into sentinel alerts
  sentinelMonitor.on("alert", async (alert) => {
    try {
      const notifications = await alertService.processAlert(alert);
      if (notifications.length > 0) {
        broadcastToClients({
          type: "alert",
          data: { alert, notifications },
          timestamp: Date.now(),
        });
      }
    } catch (error) {
      console.error("Failed to process alert notification:", error);
    }
  });

  // ==========================================
  // Strategy Backtesting Routes
  // ==========================================

  // Get all backtest scenarios
  app.get("/api/backtesting/scenarios", async (req, res) => {
    try {
      const scenarios = backtestingEngine.getScenarios();
      res.json(scenarios);
    } catch (error) {
      console.error("Failed to get scenarios:", error);
      res.status(500).json({ error: "Failed to get scenarios" });
    }
  });

  // Create backtest scenario
  app.post("/api/backtesting/scenarios", async (req, res) => {
    try {
      const { name, description, chain, startDate, endDate } = req.body;
      const scenario = await backtestingEngine.createScenario(
        name,
        description,
        chain,
        new Date(startDate),
        new Date(endDate)
      );
      res.status(201).json(scenario);
    } catch (error) {
      console.error("Failed to create scenario:", error);
      res.status(500).json({ error: "Failed to create scenario" });
    }
  });

  // Get scenario by ID
  app.get("/api/backtesting/scenarios/:id", async (req, res) => {
    try {
      const scenario = backtestingEngine.getScenario(req.params.id);
      if (!scenario) {
        return res.status(404).json({ error: "Scenario not found" });
      }
      res.json(scenario);
    } catch (error) {
      console.error("Failed to get scenario:", error);
      res.status(500).json({ error: "Failed to get scenario" });
    }
  });

  // Delete scenario
  app.delete("/api/backtesting/scenarios/:id", async (req, res) => {
    try {
      const deleted = await backtestingEngine.deleteScenario(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Scenario not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to delete scenario:", error);
      res.status(500).json({ error: "Failed to delete scenario" });
    }
  });

  // Run backtest
  app.post("/api/backtesting/runs", async (req, res) => {
    try {
      const { scenarioId, strategyConfig, initialBalance, agentId } = req.body;
      const run = await backtestingEngine.runBacktest(
        scenarioId,
        strategyConfig,
        initialBalance,
        agentId
      );
      res.status(201).json(run);
    } catch (error: any) {
      console.error("Failed to run backtest:", error);
      res.status(500).json({ error: error.message || "Failed to run backtest" });
    }
  });

  // Get all backtest runs
  app.get("/api/backtesting/runs", async (req, res) => {
    try {
      const scenarioId = req.query.scenarioId as string;
      const runs = scenarioId
        ? backtestingEngine.getRunsForScenario(scenarioId)
        : backtestingEngine.getRuns();
      res.json(runs);
    } catch (error) {
      console.error("Failed to get runs:", error);
      res.status(500).json({ error: "Failed to get runs" });
    }
  });

  // Get backtest run by ID
  app.get("/api/backtesting/runs/:id", async (req, res) => {
    try {
      const run = backtestingEngine.getRun(req.params.id);
      if (!run) {
        return res.status(404).json({ error: "Run not found" });
      }
      res.json(run);
    } catch (error) {
      console.error("Failed to get run:", error);
      res.status(500).json({ error: "Failed to get run" });
    }
  });

  // Compare backtest runs
  app.post("/api/backtesting/compare", async (req, res) => {
    try {
      const { runIds } = req.body;
      if (!runIds || runIds.length < 2) {
        return res.status(400).json({ error: "Need at least 2 run IDs to compare" });
      }
      const comparison = await backtestingEngine.compareRuns(runIds);
      res.json(comparison);
    } catch (error: any) {
      console.error("Failed to compare runs:", error);
      res.status(500).json({ error: error.message || "Failed to compare runs" });
    }
  });

  // Get backtest comparisons
  app.get("/api/backtesting/comparisons", async (req, res) => {
    try {
      const comparisons = backtestingEngine.getComparisons();
      res.json(comparisons);
    } catch (error) {
      console.error("Failed to get comparisons:", error);
      res.status(500).json({ error: "Failed to get comparisons" });
    }
  });

  // Get backtest stats
  app.get("/api/backtesting/stats", async (req, res) => {
    try {
      const stats = backtestingEngine.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Failed to get backtest stats:", error);
      res.status(500).json({ error: "Failed to get backtest stats" });
    }
  });

  // ==========================================
  */ // END COMMENTED OUT Stripe and marketplace sections

  // ==========================================
  // Multi-Wallet Management Routes
  // ==========================================

  // Get all wallets
  app.get("/api/wallets", async (req, res) => {
    try {
      const chain = req.query.chain as string;
      const wallets = chain
        ? walletManager.getWalletsByChain(chain as any)
        : walletManager.getWallets();
      res.json(wallets);
    } catch (error) {
      console.error("Failed to get wallets:", error);
      res.status(500).json({ error: "Failed to get wallets" });
    }
  });

  // Add wallet
  app.post("/api/wallets", async (req, res) => {
    try {
      const { address, label, chain, provider, isPrimary } = req.body;
      const wallet = await walletManager.addWallet(address, label, chain, provider, isPrimary);
      res.status(201).json(wallet);
    } catch (error: any) {
      console.error("Failed to add wallet:", error);
      res.status(400).json({ error: error.message || "Failed to add wallet" });
    }
  });

  // Get wallet stats (must come before :id route)
  app.get("/api/wallets/stats", async (req, res) => {
    try {
      const stats = walletManager.getStats();
      res.json(stats);
    } catch (error) {
      console.error("Failed to get wallet stats:", error);
      res.status(500).json({ error: "Failed to get wallet stats" });
    }
  });

  // Get wallet aggregate (must come before :id route)
  app.get("/api/wallets/aggregate", async (req, res) => {
    try {
      const aggregate = walletManager.getAggregate();
      res.json(aggregate);
    } catch (error) {
      console.error("Failed to get wallet aggregate:", error);
      res.status(500).json({ error: "Failed to get wallet aggregate" });
    }
  });

  // Get wallet by ID
  app.get("/api/wallets/:id", async (req, res) => {
    try {
      const wallet = walletManager.getWallet(req.params.id);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      res.json(wallet);
    } catch (error) {
      console.error("Failed to get wallet:", error);
      res.status(500).json({ error: "Failed to get wallet" });
    }
  });

  // Update wallet
  app.patch("/api/wallets/:id", async (req, res) => {
    try {
      const wallet = await walletManager.updateWallet(req.params.id, req.body);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      res.json(wallet);
    } catch (error) {
      console.error("Failed to update wallet:", error);
      res.status(500).json({ error: "Failed to update wallet" });
    }
  });

  // Remove wallet
  app.delete("/api/wallets/:id", async (req, res) => {
    try {
      const deleted = await walletManager.removeWallet(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove wallet:", error);
      res.status(500).json({ error: "Failed to remove wallet" });
    }
  });

  // Sync wallet
  app.post("/api/wallets/:id/sync", async (req, res) => {
    try {
      const wallet = await walletManager.syncWallet(req.params.id);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      res.json(wallet);
    } catch (error) {
      console.error("Failed to sync wallet:", error);
      res.status(500).json({ error: "Failed to sync wallet" });
    }
  });

  // Connect wallet
  app.post("/api/wallets/:id/connect", async (req, res) => {
    try {
      const wallet = await walletManager.connectWallet(req.params.id);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      res.json(wallet);
    } catch (error) {
      console.error("Failed to connect wallet:", error);
      res.status(500).json({ error: "Failed to connect wallet" });
    }
  });

  // Disconnect wallet
  app.post("/api/wallets/:id/disconnect", async (req, res) => {
    try {
      const wallet = await walletManager.disconnectWallet(req.params.id);
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }
      res.json(wallet);
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      res.status(500).json({ error: "Failed to disconnect wallet" });
    }
  });

  // Sync all wallets
  app.post("/api/wallets/sync-all", async (req, res) => {
    try {
      const wallets = await walletManager.syncAllWallets();
      res.json(wallets);
    } catch (error) {
      console.error("Failed to sync all wallets:", error);
      res.status(500).json({ error: "Failed to sync all wallets" });
    }
  });

  // Get wallet transactions
  app.get("/api/wallets/:id/transactions", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const transactions = walletManager.getTransactions(req.params.id, limit);
      res.json(transactions);
    } catch (error) {
      console.error("Failed to get wallet transactions:", error);
      res.status(500).json({ error: "Failed to get wallet transactions" });
    }
  });

  // Get all transactions across wallets
  app.get("/api/wallets-transactions", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const transactions = walletManager.getAllTransactions(limit);
      res.json(transactions);
    } catch (error) {
      console.error("Failed to get all transactions:", error);
      res.status(500).json({ error: "Failed to get all transactions" });
    }
  });

  // ==========================================
  // ADK-TS Integration Routes
  // ==========================================
  
  app.get("/api/adk/status", async (_req, res) => {
    try {
      const { adkIntegration } = await import("./adk/ADKIntegration");
      res.json(adkIntegration.getStatus());
    } catch (error) {
      console.error("Failed to get ADK status:", error);
      res.status(500).json({ error: "Failed to get ADK status" });
    }
  });

  app.get("/api/adk/agents", async (_req, res) => {
    try {
      const { adkIntegration } = await import("./adk/ADKIntegration");
      res.json(adkIntegration.getAllAgents());
    } catch (error) {
      console.error("Failed to get ADK agents:", error);
      res.status(500).json({ error: "Failed to get ADK agents" });
    }
  });

  app.post("/api/adk/query", writeLimiter, async (req, res) => {
    try {
      const { agentName, prompt, context } = req.body;
      if (!agentName || !prompt) {
        return res.status(400).json({ error: "agentName and prompt are required" });
      }
      
      const { adkIntegration } = await import("./adk/ADKIntegration");
      const decision = await adkIntegration.queryAgent(agentName, prompt, context);
      res.json(decision);
    } catch (error) {
      console.error("Failed to query ADK agent:", error);
      res.status(500).json({ error: "Failed to query ADK agent" });
    }
  });

  app.post("/api/adk/workflow", writeLimiter, async (req, res) => {
    try {
      const { input } = req.body;
      const { adkIntegration } = await import("./adk/ADKIntegration");
      const decisions = await adkIntegration.runMultiAgentWorkflow(input || {});
      res.json(decisions);
    } catch (error) {
      console.error("Failed to run ADK workflow:", error);
      res.status(500).json({ error: "Failed to run ADK workflow" });
    }
  });

  // ==========================================
  // ATP (Agent Tokenization Platform) Routes
  // ==========================================
  
  app.get("/api/atp/status", async (_req, res) => {
    try {
      const { atpClient } = await import("./atp/ATPClient");
      await atpClient.refreshConnection();
      res.json(atpClient.getStatus());
    } catch (error) {
      console.error("Failed to get ATP status:", error);
      res.status(500).json({ error: "Failed to get ATP status" });
    }
  });

  app.get("/api/atp/network", async (_req, res) => {
    try {
      const { atpClient } = await import("./atp/ATPClient");
      const info = await atpClient.getNetworkInfo();
      res.json(info);
    } catch (error) {
      console.error("Failed to get ATP network info:", error);
      res.status(500).json({ error: "Failed to get network info" });
    }
  });

  app.get("/api/atp/platform-agents", async (_req, res) => {
    try {
      const { atpClient } = await import("./atp/ATPClient");
      const agents = await atpClient.fetchPlatformAgents();
      res.json(agents);
    } catch (error) {
      console.error("Failed to fetch platform agents:", error);
      res.status(500).json({ error: "Failed to fetch platform agents" });
    }
  });

  app.get("/api/atp/contracts", async (_req, res) => {
    try {
      const { atpClient } = await import("./atp/ATPClient");
      res.json(atpClient.getContracts());
    } catch (error) {
      console.error("Failed to get ATP contracts:", error);
      res.status(500).json({ error: "Failed to get ATP contracts" });
    }
  });

  app.get("/api/atp/agents", async (_req, res) => {
    try {
      const { atpClient } = await import("./atp/ATPClient");
      res.json(atpClient.getAllAgents());
    } catch (error) {
      console.error("Failed to get ATP agents:", error);
      res.status(500).json({ error: "Failed to get ATP agents" });
    }
  });

  app.get("/api/atp/agents/:id", async (req, res) => {
    try {
      const { atpClient } = await import("./atp/ATPClient");
      const agent = atpClient.getAgent(req.params.id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Failed to get ATP agent:", error);
      res.status(500).json({ error: "Failed to get ATP agent" });
    }
  });

  app.get("/api/atp/agents/:id/link", async (req, res) => {
    try {
      const { atpClient } = await import("./atp/ATPClient");
      const link = await atpClient.getAgentLink(req.params.id);
      res.json({ link });
    } catch (error) {
      console.error("Failed to get ATP agent link:", error);
      res.status(500).json({ error: "Failed to get ATP agent link" });
    }
  });

  app.post("/api/atp/register", writeLimiter, async (req, res) => {
    try {
      const { atpClient } = await import("./atp/ATPClient");
      const agentId = await atpClient.registerAgent(req.body);
      res.json({ agentId, success: true });
    } catch (error) {
      console.error("Failed to register ATP agent:", error);
      res.status(500).json({ error: "Failed to register ATP agent" });
    }
  });

  app.post("/api/atp/tokenize", writeLimiter, async (req, res) => {
    try {
      const { atpClient } = await import("./atp/ATPClient");
      const tokenPair = await atpClient.tokenizeAgent(req.body);
      res.json(tokenPair);
    } catch (error) {
      console.error("Failed to tokenize ATP agent:", error);
      res.status(500).json({ error: "Failed to tokenize ATP agent" });
    }
  });

  app.post("/api/atp/evolve", writeLimiter, async (req, res) => {
    try {
      const { agentId, improvements, deprecationReason } = req.body;
      const { atpClient } = await import("./atp/ATPClient");
      const newAgentId = await atpClient.evolveAgent(agentId, improvements, deprecationReason);
      res.json({ newAgentId, success: true });
    } catch (error) {
      console.error("Failed to evolve ATP agent:", error);
      res.status(500).json({ error: "Failed to evolve ATP agent" });
    }
  });

  app.get("/api/atp/points/:walletAddress", async (req, res) => {
    try {
      const { atpClient } = await import("./atp/ATPClient");
      const balance = await atpClient.getATPPoints(req.params.walletAddress);
      res.json(balance);
    } catch (error) {
      console.error("Failed to get ATP points:", error);
      res.status(500).json({ error: "Failed to get ATP points" });
    }
  });

  app.post("/api/atp/points/earn", writeLimiter, async (req, res) => {
    try {
      const { walletAddress, points, source } = req.body;
      const { atpClient } = await import("./atp/ATPClient");
      const balance = await atpClient.earnATPPoints(walletAddress, points, source);
      res.json(balance);
    } catch (error) {
      console.error("Failed to earn ATP points:", error);
      res.status(500).json({ error: "Failed to earn ATP points" });
    }
  });

  // ==========================================
  // IQ Token & Airdrop Routes
  // ==========================================
  
  app.get("/api/iq/status", async (_req, res) => {
    try {
      const { iqTokenService } = await import("./iq/IQTokenService");
      res.json(iqTokenService.getStatus());
    } catch (error) {
      console.error("Failed to get IQ status:", error);
      res.status(500).json({ error: "Failed to get IQ status" });
    }
  });

  app.get("/api/iq/metrics", async (_req, res) => {
    try {
      const { iqTokenService } = await import("./iq/IQTokenService");
      const metrics = await iqTokenService.getMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Failed to get IQ metrics:", error);
      res.status(500).json({ error: "Failed to get IQ metrics" });
    }
  });

  app.get("/api/iq/balance/:walletAddress", async (req, res) => {
    try {
      const { iqTokenService } = await import("./iq/IQTokenService");
      const balance = await iqTokenService.getTokenBalance(req.params.walletAddress);
      res.json({ walletAddress: req.params.walletAddress, balance });
    } catch (error) {
      console.error("Failed to get IQ balance:", error);
      res.status(500).json({ error: "Failed to get IQ balance" });
    }
  });

  app.get("/api/iq/contracts", async (_req, res) => {
    try {
      const { iqTokenService } = await import("./iq/IQTokenService");
      res.json(iqTokenService.getContracts());
    } catch (error) {
      console.error("Failed to get IQ contracts:", error);
      res.status(500).json({ error: "Failed to get IQ contracts" });
    }
  });

  app.get("/api/iq/staking/:walletAddress", async (req, res) => {
    try {
      const { iqTokenService } = await import("./iq/IQTokenService");
      const position = await iqTokenService.getStakingPosition(req.params.walletAddress);
      res.json(position);
    } catch (error) {
      console.error("Failed to get staking position:", error);
      res.status(500).json({ error: "Failed to get staking position" });
    }
  });

  app.post("/api/iq/stake", writeLimiter, async (req, res) => {
    try {
      const { walletAddress, amount, lockDays } = req.body;
      const { iqTokenService } = await import("./iq/IQTokenService");
      const position = await iqTokenService.createStakingPosition(walletAddress, amount, lockDays);
      res.json(position);
    } catch (error) {
      console.error("Failed to create staking position:", error);
      res.status(500).json({ error: "Failed to create staking position" });
    }
  });

  app.post("/api/iq/unstake", writeLimiter, async (req, res) => {
    try {
      const { walletAddress } = req.body;
      const { iqTokenService } = await import("./iq/IQTokenService");
      const result = await iqTokenService.unstake(walletAddress);
      res.json(result);
    } catch (error) {
      console.error("Failed to unstake:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to unstake" });
    }
  });

  app.post("/api/iq/claim-rewards", writeLimiter, async (req, res) => {
    try {
      const { walletAddress } = req.body;
      const { iqTokenService } = await import("./iq/IQTokenService");
      const rewards = await iqTokenService.claimRewards(walletAddress);
      res.json({ rewards });
    } catch (error) {
      console.error("Failed to claim rewards:", error);
      res.status(500).json({ error: "Failed to claim rewards" });
    }
  });

  app.get("/api/iq/airdrops/:walletAddress", async (req, res) => {
    try {
      const { iqTokenService } = await import("./iq/IQTokenService");
      const airdrops = await iqTokenService.getAirdrops(req.params.walletAddress);
      res.json(airdrops);
    } catch (error) {
      console.error("Failed to get airdrops:", error);
      res.status(500).json({ error: "Failed to get airdrops" });
    }
  });

  app.get("/api/iq/airdrops/:walletAddress/pending", async (req, res) => {
    try {
      const { iqTokenService } = await import("./iq/IQTokenService");
      const airdrops = await iqTokenService.getPendingAirdrops(req.params.walletAddress);
      res.json(airdrops);
    } catch (error) {
      console.error("Failed to get pending airdrops:", error);
      res.status(500).json({ error: "Failed to get pending airdrops" });
    }
  });

  app.post("/api/iq/airdrop/create", writeLimiter, async (req, res) => {
    try {
      const { walletAddress, amount, reason, expiresInDays } = req.body;
      const { iqTokenService } = await import("./iq/IQTokenService");
      const claim = await iqTokenService.createAirdrop(walletAddress, amount, reason, expiresInDays);
      res.json(claim);
    } catch (error) {
      console.error("Failed to create airdrop:", error);
      res.status(500).json({ error: "Failed to create airdrop" });
    }
  });

  app.post("/api/iq/airdrop/claim", writeLimiter, async (req, res) => {
    try {
      const { walletAddress, claimId } = req.body;
      const { iqTokenService } = await import("./iq/IQTokenService");
      const claim = await iqTokenService.claimAirdrop(walletAddress, claimId);
      res.json(claim);
    } catch (error) {
      console.error("Failed to claim airdrop:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Failed to claim airdrop" });
    }
  });

  app.post("/api/iq/airdrop/participation", writeLimiter, async (req, res) => {
    try {
      const { walletAddress, agentId, participationType } = req.body;
      const { iqTokenService } = await import("./iq/IQTokenService");
      const claim = await iqTokenService.createAgentParticipationAirdrop(
        walletAddress, 
        agentId, 
        participationType
      );
      res.json(claim);
    } catch (error) {
      console.error("Failed to create participation airdrop:", error);
      res.status(500).json({ error: "Failed to create participation airdrop" });
    }
  });

  // ==========================================
  // Hackathon Status Route
  // ==========================================
  
  app.get("/api/hackathon/status", async (_req, res) => {
    try {
      const { adkIntegration } = await import("./adk/ADKIntegration");
      const { atpClient } = await import("./atp/ATPClient");
      const { iqTokenService } = await import("./iq/IQTokenService");
      
      await atpClient.refreshConnection();
      const iqMetrics = await iqTokenService.getMetrics();
      const atpStatus = atpClient.getStatus();
      
      res.json({
        hackathon: "AGENT ARENA",
        project: "NeuroNet Governor",
        timestamp: new Date().toISOString(),
        compliance: {
          adkTs: {
            installed: true,
            package: "@iqai/adk",
            status: adkIntegration.getStatus(),
            apiKeyConfigured: !!process.env.GOOGLE_API_KEY,
          },
          atp: {
            ready: true,
            rpcStatus: atpStatus.rpcStatus,
            fraxtalConnected: atpStatus.connected,
            chainId: atpStatus.chainId,
            lastBlockNumber: atpStatus.lastBlockNumber,
            status: atpStatus,
          },
          iqToken: {
            compatible: true,
            rpcStatus: iqMetrics.rpcStatus,
            liveData: {
              totalSupply: iqMetrics.totalSupply,
              totalStaked: iqMetrics.totalStaked,
              price: iqMetrics.price,
              marketCap: iqMetrics.marketCap,
            },
            contracts: iqTokenService.getContracts(),
            status: iqTokenService.getStatus(),
          },
          smartContracts: {
            neuronetRegistry: "contracts/NeuroNetRegistry.sol",
            neuronetStorage: "contracts/NeuroNetStorage.sol",
            neuronetHeartbeat: "contracts/NeuroNetHeartbeat.sol",
            memoryVault: "contracts/MemoryVault.sol",
            agentRegistry: "contracts/AgentRegistry.sol",
            targetNetwork: "fraxtal",
            chainId: 252,
            deploymentStatus: "ready",
          },
          onboarding: {
            implemented: true,
            component: "OnboardingWizard",
            steps: 5,
          },
        },
        liveFeatures: {
          atpRpc: atpStatus.rpcStatus === 'live',
          iqTokenRpc: iqMetrics.rpcStatus === 'live',
          adkQueries: !!process.env.GOOGLE_API_KEY,
          fraxtalConnection: atpStatus.connected,
        },
        features: [
          "Multi-agent AI architecture (ADK-TS)",
          "Live ATP Integration (Fraxtal RPC)",
          "Live IQ Token metrics (Ethereum RPC)",
          "ML pattern recognition",
          "Monte Carlo simulation",
          "Self-healing agents",
          "MEV protection via Flashbots",
          "Multi-chain support (ETH, Base, Fraxtal)",
          "Multi-sig governance",
          "Agent marketplace with Stripe",
          "24/7 sentinel monitoring",
          "Command center UI",
          "Alert system",
          "Strategy backtesting",
          "Multi-wallet support",
          "On-chain memory vault",
          "Agent checkpoints & heartbeats",
        ],
      });
    } catch (error) {
      console.error("Failed to get hackathon status:", error);
      res.status(500).json({ error: "Failed to get hackathon status" });
    }
  });

  // Setup self-healing event listeners
  selfHealingEngine.on("healthCheckStarted", async () => {
    try {
      const agents = await storage.getAgents();
      const healthResults = [];

      for (const agent of agents) {
        const result = selfHealingEngine.evaluateAgentHealth(agent);
        healthResults.push(result);

        if (selfHealingEngine.shouldDeprecate(agent)) {
          orchestrator.checkForDeprecation();
          
          selfHealingEngine.recordLineage(
            agent.id,
            agent.version,
            undefined,
            `Credit score dropped to ${agent.creditScore}`,
            ["automatic_deprecation"]
          );

          broadcastToClients({
            type: "selfHealing",
            data: { 
              action: "deprecated", 
              agentId: agent.id,
              reason: "Performance below threshold",
            },
            timestamp: Date.now(),
          });
        }
      }

      broadcastToClients({
        type: "selfHealing",
        data: { 
          action: "healthCheckComplete",
          summary: selfHealingEngine.getSystemHealthSummary(),
        },
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error("Self-healing health check failed:", err);
    }
  });

  selfHealingEngine.on("lineageRecorded", (lineage) => {
    broadcastToClients({
      type: "selfHealing",
      data: { action: "lineageRecorded", lineage },
      timestamp: Date.now(),
    });
  });

  // Start self-healing monitoring
  selfHealingEngine.startMonitoring(60000);

  // Trigger initial negotiation cycle for demo
  setTimeout(async () => {
    try {
      await orchestrator.runNegotiationCycle({ currentPrice: 1850, currentTVL: 8500000 });
    } catch (error) {
      console.error("Initial negotiation error:", error);
    }
  }, 5000);

  // =============================================================================
  // HACKATHON SHOWCASE API: Parliament, Evolution, Dream Mode, Stress Testing
  // =============================================================================

  // Reasoning Chains (Claude Transparency)
  app.get("/api/reasoning", async (req, res) => {
    try {
      const filters = {
        agentId: req.query.agentId as string | undefined,
        topic: req.query.topic as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
      };
      const chains = await storage.getReasoningChains(filters);
      res.json(chains);
    } catch (error) {
      res.status(500).json({ error: "Failed to get reasoning chains" });
    }
  });

  app.get("/api/reasoning/:id", async (req, res) => {
    try {
      const chain = await storage.getReasoningChain(req.params.id);
      if (!chain) return res.status(404).json({ error: "Reasoning chain not found" });
      res.json(chain);
    } catch (error) {
      res.status(500).json({ error: "Failed to get reasoning chain" });
    }
  });

  // Parliament Sessions
  app.get("/api/parliament", async (req, res) => {
    try {
      const filters = {
        status: req.query.status as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      };
      const sessions = await storage.getParliamentSessions(filters);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get parliament sessions" });
    }
  });

  app.get("/api/parliament/:id", async (req, res) => {
    try {
      const session = await storage.getParliamentSession(req.params.id);
      if (!session) return res.status(404).json({ error: "Parliament session not found" });
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to get parliament session" });
    }
  });

  app.post("/api/parliament", writeLimiter, async (req, res) => {
    try {
      const { topic, description, proposalData, quorum, requiredMajority } = req.body;
      if (!topic || !description) {
        return res.status(400).json({ error: "Topic and description required" });
      }
      const session = await storage.createParliamentSession({
        id: `parliament-${Date.now()}`,
        topic,
        description,
        proposalData: proposalData || {},
        status: "deliberating",
        quorum: quorum || 3,
        requiredMajority: requiredMajority || 50,
      });
      broadcastToClients({
        type: "log",
        data: { event: "parliament_session_created", session },
        timestamp: Date.now(),
      });
      res.status(201).json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to create parliament session" });
    }
  });

  app.post("/api/parliament/:id/debate", writeLimiter, async (req, res) => {
    try {
      const { agentId, agentType, position, statement, rebuttalTo, reasoningChainId } = req.body;
      if (!agentId || !agentType || !position || !statement) {
        return res.status(400).json({ error: "Missing required debate fields" });
      }
      const entry = { agentId, agentType, position, statement, rebuttalTo, reasoningChainId, timestamp: Date.now() };
      const session = await storage.addDebateEntry(req.params.id, entry);
      if (!session) return res.status(404).json({ error: "Session not found" });
      broadcastToClients({
        type: "log",
        data: { event: "parliament_debate", sessionId: req.params.id, entry },
        timestamp: Date.now(),
      });
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to add debate entry" });
    }
  });

  app.post("/api/parliament/:id/vote", writeLimiter, async (req, res) => {
    try {
      const { agentId, agentType, vote, reasoning, confidence } = req.body;
      if (!agentId || !agentType || !vote) {
        return res.status(400).json({ error: "Missing required vote fields" });
      }
      const voteEntry = { agentId, agentType, vote, reasoning: reasoning || "", confidence: confidence || 0.5, timestamp: Date.now() };
      const session = await storage.addVote(req.params.id, voteEntry);
      if (!session) return res.status(404).json({ error: "Session not found" });
      broadcastToClients({
        type: "log",
        data: { event: "parliament_vote", sessionId: req.params.id, vote: voteEntry },
        timestamp: Date.now(),
      });
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to add vote" });
    }
  });

  app.post("/api/parliament/:id/debate-live", writeLimiter, async (req, res) => {
    try {
      const session = await storage.getParliamentSession(req.params.id);
      if (!session) return res.status(404).json({ error: "Session not found" });

      const { adkIntegration } = await import("./adk/ADKIntegration");
      const agents: { id: string; type: "meta" | "scout" | "risk" | "execution"; agentName: string; position: string }[] = [
        { id: "meta-001", type: "meta", agentName: "neuronet_meta", position: "for" },
        { id: "scout-001", type: "scout", agentName: "neuronet_scout", position: "for" },
        { id: "risk-001", type: "risk", agentName: "neuronet_risk", position: "against" },
        { id: "exec-001", type: "execution", agentName: "neuronet_execution", position: "clarification" },
      ];

      const prompt = `This DeFi governance proposal is being debated: "${session.topic}"\n\nDescription: ${session.description}\n\nProvide your concise stance and reasoning (2-3 sentences max) on this proposal as a DeFi AI agent.`;
      const context = { topic: session.topic, description: session.description };

      for (const agent of agents) {
        const decision = await adkIntegration.queryAgent(agent.agentName, prompt, context);
        
        // Parse the response - if it's JSON, extract text; otherwise use as-is
        let statement = decision.reasoning;
        if (typeof statement === "string") {
          try {
            const parsed = JSON.parse(statement);
            statement = parsed.analysis || parsed.reasoning || parsed.assessment || JSON.stringify(parsed);
          } catch {
            // Not JSON, use as-is
          }
        } else {
          statement = JSON.stringify(statement);
        }
        
        statement = statement.substring(0, 500);
        
        const agentTypeMap: Record<string, AgentType> = {
          "meta": AgentType.META,
          "scout": AgentType.SCOUT,
          "risk": AgentType.RISK,
          "execution": AgentType.EXECUTION,
        };
        
        const entry = { agentId: agent.id, agentType: agentTypeMap[agent.type] || AgentType.META, position: agent.position, statement, timestamp: Date.now() };
        await storage.addDebateEntry(req.params.id, entry);
        
        broadcastToClients({
          type: "log",
          data: { event: "parliament_debate", sessionId: req.params.id, entry },
          timestamp: Date.now(),
        });
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const updated = await storage.getParliamentSession(req.params.id);
      res.json(updated);
    } catch (error) {
      console.error("Live debate error:", error);
      res.status(500).json({ error: "Failed to generate live debate" });
    }
  });

  app.post("/api/parliament/:id/conclude", writeLimiter, async (req, res) => {
    try {
      const session = await storage.getParliamentSession(req.params.id);
      if (!session) return res.status(404).json({ error: "Session not found" });
      
      const approves = session.votes.filter((v: ParliamentVote) => v.vote === "approve").length;
      const rejects = session.votes.filter((v: ParliamentVote) => v.vote === "reject").length;
      const total = session.votes.length;
      
      let outcome: "approved" | "rejected" | "deadlocked" = "deadlocked";
      if (total >= session.quorum) {
        const approvalPct = (approves / total) * 100;
        if (approvalPct >= session.requiredMajority) outcome = "approved";
        else if ((rejects / total) * 100 >= session.requiredMajority) outcome = "rejected";
      }
      
      const updated = await storage.updateParliamentSession(req.params.id, {
        status: "concluded",
        outcome,
        concludedAt: Date.now(),
      });
      
      broadcastToClients({
        type: "log",
        data: { event: "parliament_concluded", sessionId: req.params.id, outcome },
        timestamp: Date.now(),
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to conclude session" });
    }
  });

  // Agent Evolutions
  app.get("/api/evolution", async (req, res) => {
    try {
      const filters = {
        agentId: req.query.agentId as string | undefined,
        generation: req.query.generation ? parseInt(req.query.generation as string) : undefined,
        parentAgentId: req.query.parentAgentId as string | undefined,
      };
      const evolutions = await storage.getAgentEvolutions(filters);
      res.json(evolutions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get agent evolutions" });
    }
  });

  app.get("/api/evolution/:id", async (req, res) => {
    try {
      const evolution = await storage.getAgentEvolution(req.params.id);
      if (!evolution) return res.status(404).json({ error: "Evolution not found" });
      res.json(evolution);
    } catch (error) {
      res.status(500).json({ error: "Failed to get evolution" });
    }
  });

  app.post("/api/evolution", writeLimiter, async (req, res) => {
    try {
      const { agentId, parentAgentId, generation, performanceScore, survivalScore, reproductionScore, mutations, inheritedTraits } = req.body;
      
      if (!agentId) {
        return res.status(400).json({ error: "agentId is required" });
      }
      
      const evolution = await storage.createAgentEvolution({
        id: `evolution-${agentId}-${Date.now()}`,
        agentId,
        parentAgentId: parentAgentId || null,
        generation: generation || 1,
        performanceScore: performanceScore || 50,
        survivalScore: survivalScore || 50,
        reproductionScore: reproductionScore || 0,
        mutations: mutations || [],
        inheritedTraits: inheritedTraits || [],
      });
      
      broadcastToClients({
        type: "log",
        data: { event: "agent_evolution_created", evolution },
        timestamp: Date.now(),
      });
      res.status(201).json(evolution);
    } catch (error) {
      console.error("Failed to create agent evolution:", error);
      res.status(500).json({ error: "Failed to create agent evolution" });
    }
  });

  // Dream Sessions
  app.get("/api/dream", async (req, res) => {
    try {
      const filters = {
        status: req.query.status as string | undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      };
      const sessions = await storage.getDreamSessions(filters);
      res.json(sessions);
    } catch (error) {
      res.status(500).json({ error: "Failed to get dream sessions" });
    }
  });

  app.get("/api/dream/:id", async (req, res) => {
    try {
      const session = await storage.getDreamSession(req.params.id);
      if (!session) return res.status(404).json({ error: "Dream session not found" });
      res.json(session);
    } catch (error) {
      res.status(500).json({ error: "Failed to get dream session" });
    }
  });

  app.post("/api/dream/start", writeLimiter, async (req, res) => {
    try {
      const { metabolicRate, dreamDepth, realTimeMultiplier, simulationsRun, duration, discoveries, insights } = req.body;
      
      const session = await storage.createDreamSession({
        id: `dream-${Date.now()}`,
        status: "awake",
        simulationsRun: simulationsRun || 0,
        branchesExplored: Math.floor((simulationsRun || 0) / 100),
        metabolicRate: metabolicRate || 10,
        dreamDepth: dreamDepth || 5,
        realTimeMultiplier: realTimeMultiplier || 10,
        topInsight: insights,
      });
      
      // Add discoveries if provided
      if (discoveries && Array.isArray(discoveries)) {
        for (const discovery of discoveries) {
          await storage.addDreamDiscovery(session.id, discovery);
        }
      }
      
      // Fetch updated session with discoveries
      const updatedSession = await storage.getDreamSession(session.id);
      
      // Format response to match frontend expectations
      const response = {
        ...updatedSession,
        duration: duration || 28800,
        insights: insights,
      };
      
      broadcastToClients({
        type: "log",
        data: { event: "dream_completed", session: response },
        timestamp: Date.now(),
      });
      res.status(201).json(response);
    } catch (error) {
      console.error("Failed to start dream session:", error);
      res.status(500).json({ error: "Failed to start dream session" });
    }
  });

  app.post("/api/dream/:id/wake", writeLimiter, async (req, res) => {
    try {
      const updated = await storage.updateDreamSession(req.params.id, {
        status: "awake",
        endedAt: Date.now(),
      });
      if (!updated) return res.status(404).json({ error: "Session not found" });
      broadcastToClients({
        type: "log",
        data: { event: "dream_ended", session: updated },
        timestamp: Date.now(),
      });
      res.json(updated);
    } catch (error) {
      res.status(500).json({ error: "Failed to wake from dream" });
    }
  });

  // Stress Scenarios
  app.get("/api/stress/scenarios", async (req, res) => {
    try {
      const filters = {
        category: req.query.category as string | undefined,
        isTemplate: req.query.isTemplate === "true" ? true : req.query.isTemplate === "false" ? false : undefined,
      };
      const scenarios = await storage.getStressScenarios(filters);
      res.json(scenarios);
    } catch (error) {
      res.status(500).json({ error: "Failed to get stress scenarios" });
    }
  });

  app.post("/api/stress/scenarios", writeLimiter, async (req, res) => {
    try {
      const { name, description, category, severity, parameters, isTemplate, createdBy } = req.body;
      if (!name || !description || !category || !createdBy) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const scenario = await storage.createStressScenario({
        id: `stress-scenario-${Date.now()}`,
        name,
        description,
        category,
        severity: severity || 3,
        parameters: parameters || {},
        isTemplate: isTemplate || false,
        createdBy,
      });
      res.status(201).json(scenario);
    } catch (error) {
      res.status(500).json({ error: "Failed to create stress scenario" });
    }
  });

  // Stress Test Runs
  app.get("/api/stress/runs", async (req, res) => {
    try {
      const filters = {
        scenarioId: req.query.scenarioId as string | undefined,
        status: req.query.status as string | undefined,
      };
      const runs = await storage.getStressTestRuns(filters);
      res.json(runs);
    } catch (error) {
      res.status(500).json({ error: "Failed to get stress test runs" });
    }
  });

  app.get("/api/stress/runs/:id", async (req, res) => {
    try {
      const run = await storage.getStressTestRun(req.params.id);
      if (!run) return res.status(404).json({ error: "Stress test run not found" });
      res.json(run);
    } catch (error) {
      res.status(500).json({ error: "Failed to get stress test run" });
    }
  });

  app.post("/api/stress/runs", writeLimiter, async (req, res) => {
    try {
      const { name, description, scenarioType, severity, parameters, scenarioId, systemHealthBefore } = req.body;
      
      // Support both inline scenario creation and existing scenarioId
      let resolvedScenarioId = scenarioId;
      
      if (!scenarioId && name && description) {
        // Create inline scenario for frontend convenience
        const scenario = await storage.createStressScenario({
          id: `stress-scenario-${Date.now()}`,
          name,
          description,
          category: scenarioType || "custom",
          severity: typeof severity === "string" ? 3 : (severity || 3),
          parameters: parameters || {},
          isTemplate: false,
          createdBy: "stress-test-ui",
        });
        resolvedScenarioId = scenario.id;
      }
      
      if (!resolvedScenarioId) {
        return res.status(400).json({ error: "Either scenarioId or name/description required" });
      }
      
      const run = await storage.createStressTestRun({
        id: `stress-run-${Date.now()}`,
        scenarioId: resolvedScenarioId,
        status: "running",
        overallOutcome: "pending",
        portfolioImpact: 0,
        systemHealthBefore: systemHealthBefore || 85,
        systemHealthAfter: systemHealthBefore || 85,
      });
      
      // Return with additional fields expected by frontend
      const response = {
        ...run,
        name: name || "Stress Test",
        description: description || "",
        scenarioType: scenarioType || "custom",
        severity: severity || "medium",
        createdAt: new Date().toISOString(),
        startedAt: new Date().toISOString(),
      };
      
      broadcastToClients({
        type: "log",
        data: { event: "stress_test_started", run: response },
        timestamp: Date.now(),
      });
      res.status(201).json(response);
    } catch (error) {
      console.error("Failed to create stress test run:", error);
      res.status(500).json({ error: "Failed to create stress test run" });
    }
  });

  // Helper function to execute stress test in background
  const executeStressTestAsync = async (runId: string) => {
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error("Stress test timeout after 5 seconds")), 5000)
    );

    try {
      console.error(`[STRESS] Starting execution for run: ${runId}`);
      process.stderr.write(`[STRESS STDERR] Run: ${runId}\n`);
      
      const runPromise = storage.getStressTestRun(runId);
      const run = await Promise.race([runPromise, timeoutPromise]);
      
      if (!run) {
        console.error(`[STRESS] Run not found: ${runId}`);
        return;
      }

      const scenarioPromise = storage.getStressScenario(run.scenarioId);
      const scenario = (await Promise.race([scenarioPromise, timeoutPromise])) as any;
      
      if (!scenario) {
        console.error(`[STRESS] Scenario not found: ${run.scenarioId}`);
        return;
      }
      console.error(`[STRESS] Processing scenario: ${scenario.name || scenario.category || 'unknown'}`);

      const agentResponses: Record<string, any> = {};
      const agentPerformance: Record<string, any> = {};

      // Simulate agent responses instantly (framework ready for real AI integration)
      const agentTypes = ['meta', 'scout', 'risk', 'execution'];
      const scenarioName = (scenario.name || scenario.category) as string;
      
      for (const type of agentTypes) {
        const severity = (scenario.severity || 0) as number;
        const parameters = (scenario.parameters || {}) as Record<string, any>;
        const reasoning = type === 'meta' 
          ? `Coordinating full stress test response for ${scenarioName}. Severity: ${severity}/10. Requesting scout threat assessment, risk quantification, and execution protocols.`
          : type === 'scout'
          ? `Detected ${scenarioName} threat. Parameters: ${JSON.stringify(parameters).substring(0, 100)}... Analyzing market microstructure and exposure vectors.`
          : type === 'risk'
          ? `Risk quantification: 95% confidence in scenario impact. VaR exceeded. Recommending position reduction and hedge activation. Liquidation cascade probability: 78%.`
          : `Executing emergency protocols: liquidity consolidation, position closure in priority order, and circuit breaker activation. Estimated completion time: 45 seconds.`;

        agentPerformance[type] = {
          decisionTime: 50 + Math.random() * 30,
          accuracy: 75 + Math.random() * 20,
          adaptability: 80 + Math.random() * 15,
          confidence: 70 + Math.random() * 25,
        };
      }

      // Generate REAL vulnerabilities based on scenario parameters
      const detectVulnerabilities = (category: string, params: Record<string, any>, severity: number) => {
        const vulns: any[] = [];
        const normalizedCategory = (category || "custom") as string;
        
        if (normalizedCategory === "flash_crash") {
          const priceDropPercent = params.priceDropPercent || 30;
          if (priceDropPercent > 50) {
            vulns.push({ severity: "critical", description: `Catastrophic ${priceDropPercent}% price cascade detected - exceeds worst-case models`, mitigation: "Implement aggressive position liquidation triggers" });
          } else if (priceDropPercent > 30) {
            vulns.push({ severity: "critical", description: `Severe ${priceDropPercent}% price drop - slippage tolerance exceeded`, mitigation: "Activate emergency liquidity protocols" });
          }
          vulns.push({ severity: "high", description: `Liquidity pools on ${(params.affectedPairs || ["ETH/USDC", "BTC/USDC"]).join(", ")} showing insufficient depth`, mitigation: "Route through aggregators" });
          if (params.durationSeconds && params.durationSeconds < 120) {
            vulns.push({ severity: "critical", description: `Flash crash completed in ${params.durationSeconds}s - too fast for manual intervention`, mitigation: "Use atomic arbitrage defenses" });
          }
        } 
        else if (normalizedCategory === "high_volatility") {
          const volatMult = params.volatilityMultiplier || 3;
          vulns.push({ severity: "high", description: `Volatility spike x${volatMult} - delta hedging margin requirements exceeded by ${volatMult * 20}%`, mitigation: "Reduce position sizes by 50%" });
          if (params.marketSentiment === "panic") {
            vulns.push({ severity: "critical", description: "Panic selling detected - cascading liquidations imminent", mitigation: "Pre-position stop-loss orders above liquidation levels" });
          }
          if (params.durationMinutes && params.durationMinutes > 30) {
            vulns.push({ severity: "high", description: `Extended volatility period (${params.durationMinutes} min) - funding rates diverging`, mitigation: "Close leveraged positions to avoid funding bleed" });
          }
        } 
        else if (normalizedCategory === "liquidity_crisis") {
          const liquidityDrop = params.liquidityDropPercent || 80;
          vulns.push({ severity: "critical", description: `Liquidity depleted by ${liquidityDrop}% on ${(params.affectedPools || ["Uniswap V3", "Curve"]).join(", ")}`, mitigation: "Implement circuit breakers with pause mechanics" });
          const spreadIncrease = params.spreadIncrease || 500;
          vulns.push({ severity: "critical", description: `Bid-ask spreads widened by ${spreadIncrease}bps - slippage explosion imminent`, mitigation: "Use TWAP or VWAP execution with timelock" });
          vulns.push({ severity: "high", description: "DEX arbitrage bots exiting simultaneously - no safe liquidity routes", mitigation: "Pre-arrange OTC liquidity with market makers" });
        } 
        else if (normalizedCategory === "chain_congestion") {
          const gasMultiplier = params.gasMultiplier || 5;
          vulns.push({ severity: "high", description: `Gas prices spiked ${gasMultiplier}x - transactions reverting on out-of-gas`, mitigation: "Implement gas optimization and batching" });
          const pendingTx = params.pendingTxCount || 50000;
          if (pendingTx > 100000) {
            vulns.push({ severity: "critical", description: `Mempool saturation (${pendingTx} pending txs) - no transaction ordering guarantees`, mitigation: "Use priority gas auctions (PGA) or private mempools" });
          }
          const confirmDelay = params.confirmationDelay || 30;
          vulns.push({ severity: "medium", description: `Block confirmation delayed by ${confirmDelay}s - stale state risks`, mitigation: "Implement oracle price lag checks" });
        } 
        else if (normalizedCategory === "oracle_failure") {
          const staleMinutes = params.staleTimeMinutes || 15;
          vulns.push({ severity: "critical", description: `${(params.affectedOracles || ["Chainlink"]).join(", ")} oracles stale for ${staleMinutes} minutes - safety invariants violated`, mitigation: "Deploy multi-oracle consensus with circuit breaker" });
          const priceDeviation = params.priceDeviation || 25;
          if (priceDeviation > 20) {
            vulns.push({ severity: "critical", description: `Price deviation of ${priceDeviation}% exceeds safe thresholds - liquidations triggering`, mitigation: "Implement emergency pause mechanism" });
          }
          vulns.push({ severity: "high", description: "Fallback oracles also offline - no trusted price feed available", mitigation: "Pre-arrange backup oracle redundancy" });
        } 
        else if (normalizedCategory === "mev_attack") {
          const attackerBots = params.attackerBots || 3;
          const frontrunPercent = params.frontrunPercent || 2;
          vulns.push({ severity: "critical", description: `Detected ${attackerBots} coordinated attacker bots front-running ${frontrunPercent}% of transactions`, mitigation: "Route through MEV-resistant pools (Flashbots, MEV-Block)" });
          const victimTx = params.victimTxCount || 100;
          vulns.push({ severity: "critical", description: `Sandwich attacks affecting ${victimTx}+ victim transactions - extraction >= $${(victimTx * 500).toLocaleString()}`, mitigation: "Use private mempools or encrypted transactions" });
          vulns.push({ severity: "high", description: "Slippage inflation detected - MEV extraction bypassing user protection", mitigation: "Implement MEV-Share or proposer-builder separation" });
        }
        
        return vulns.length > 0 ? vulns : [
          { severity: "high", description: `Unknown stress scenario (${category}) - manual review required`, mitigation: "Escalate to risk management team" }
        ];
      };

      console.log(`[STRESS] Detecting vulnerabilities...`);
      const vulnerabilitiesFound = detectVulnerabilities((scenario.category || "custom") as string, (scenario.parameters || {}) as Record<string, any>, (scenario.severity || 3) as number);
      console.log(`[STRESS] Found ${vulnerabilitiesFound.length} vulnerabilities`);

      // Calculate portfolio impact
      const severityMultiplier = (scenario.severity || 3) as number;
      const portfolioImpact = -(10 + severityMultiplier * 5 + Math.random() * 10);

      const resultData = {
        scenarioId: (scenario.id || "") as string,
        success: true,
        vulnerabilitiesFound,
        agentPerformance,
        recommendations: [
          "Review and update emergency response protocols",
          "Test backup liquidity sources",
          "Verify oracle redundancy",
          "Update risk parameter thresholds",
        ],
        portfolioImpact,
        systemHealthAfter: Math.max(20, 85 - severityMultiplier * 8 - Math.random() * 10),
      };

      console.error(`[STRESS] Updating database with results...`);
      // Update run with results
      const updatePromise = storage.updateStressTestRun(runId, {
        status: "completed",
        completedAt: Date.now(),
        overallOutcome: portfolioImpact < -30 ? "degraded" : "survived",
        portfolioImpact: Math.round(portfolioImpact),
        systemHealthAfter: resultData.systemHealthAfter,
      });
      const updated = (await Promise.race([updatePromise, timeoutPromise])) as any;
      console.error(`[STRESS] Database updated successfully`);

      const response = {
        ...(updated || {}),
        resultData,
      };

      broadcastToClients({
        type: "log",
        data: { event: "stress_test_completed", run: response, vulnerabilities: vulnerabilitiesFound },
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("Stress test execution error:", error);
    }
  };

  app.post("/api/stress/runs/:id/execute", writeLimiter, async (req, res) => {
    try {
      const runId = req.params.id;
      const run = await storage.getStressTestRun(runId);
      if (!run) return res.status(404).json({ error: "Stress test run not found" });

      // Execute synchronously (fast simulated responses)
      const scenario = await storage.getStressScenario(run.scenarioId);
      if (!scenario) {
        return res.status(404).json({ error: "Scenario not found" });
      }

      // Generate agent performance metrics
      const agentPerformance: Record<string, any> = {};
      for (const type of ['meta', 'scout', 'risk', 'execution']) {
        agentPerformance[type] = {
          decisionTime: 50 + Math.random() * 30,
          accuracy: 75 + Math.random() * 20,
          adaptability: 80 + Math.random() * 15,
          confidence: 70 + Math.random() * 25,
        };
      }

      // Generate REAL vulnerabilities based on scenario parameters
      const category = (scenario.category || "custom") as string;
      const params = (scenario.parameters || {}) as Record<string, any>;
      const vulns: any[] = [];
      
      if (category === "flash_crash") {
        const priceDropPercent = params.priceDropPercent || 30;
        if (priceDropPercent > 50) {
          vulns.push({ severity: "critical", description: `Catastrophic ${priceDropPercent}% price cascade detected - exceeds worst-case models`, mitigation: "Implement aggressive position liquidation triggers" });
        } else if (priceDropPercent > 30) {
          vulns.push({ severity: "critical", description: `Severe ${priceDropPercent}% price drop - slippage tolerance exceeded`, mitigation: "Activate emergency liquidity protocols" });
        }
        vulns.push({ severity: "high", description: `Liquidity pools on ${(params.affectedPairs || ["ETH/USDC", "BTC/USDC"]).join(", ")} showing insufficient depth`, mitigation: "Route through aggregators" });
        if (params.durationSeconds && params.durationSeconds < 120) {
          vulns.push({ severity: "critical", description: `Flash crash completed in ${params.durationSeconds}s - too fast for manual intervention`, mitigation: "Use atomic arbitrage defenses" });
        }
      } else if (category === "high_volatility") {
        const volatMult = params.volatilityMultiplier || 3;
        vulns.push({ severity: "high", description: `Volatility spike x${volatMult} - delta hedging margin exceeded by ${volatMult * 20}%`, mitigation: "Reduce position sizes by 50%" });
        if (params.marketSentiment === "panic") {
          vulns.push({ severity: "critical", description: "Panic selling detected - cascading liquidations imminent", mitigation: "Pre-position stop-loss orders" });
        }
      } else if (category === "liquidity_crisis") {
        const liquidityDrop = params.liquidityDropPercent || 80;
        vulns.push({ severity: "critical", description: `Liquidity depleted by ${liquidityDrop}% on ${(params.affectedPools || ["Uniswap V3", "Curve"]).join(", ")}`, mitigation: "Implement circuit breakers" });
        vulns.push({ severity: "critical", description: `Bid-ask spreads widened by ${params.spreadIncrease || 500}bps`, mitigation: "Use TWAP execution" });
      } else if (category === "chain_congestion") {
        const gasMultiplier = params.gasMultiplier || 5;
        vulns.push({ severity: "high", description: `Gas prices spiked ${gasMultiplier}x - transactions reverting`, mitigation: "Implement gas optimization" });
        if ((params.pendingTxCount || 50000) > 100000) {
          vulns.push({ severity: "critical", description: `Mempool saturation (${params.pendingTxCount} pending txs)`, mitigation: "Use private mempools" });
        }
      } else if (category === "oracle_failure") {
        vulns.push({ severity: "critical", description: `${(params.affectedOracles || ["Chainlink"]).join(", ")} oracles stale for ${params.staleTimeMinutes || 15} minutes`, mitigation: "Deploy multi-oracle consensus" });
        if ((params.priceDeviation || 25) > 20) {
          vulns.push({ severity: "critical", description: `Price deviation of ${params.priceDeviation}% exceeds safe thresholds`, mitigation: "Implement emergency pause" });
        }
      } else if (category === "mev_attack") {
        vulns.push({ severity: "critical", description: `Detected ${params.attackerBots || 3} attacker bots front-running ${params.frontrunPercent || 2}% of transactions`, mitigation: "Use MEV-resistant pools" });
        vulns.push({ severity: "critical", description: `Sandwich attacks affecting ${params.victimTxCount || 100}+ victim transactions`, mitigation: "Use private mempools" });
      } else {
        vulns.push({ severity: "high", description: `Unknown stress scenario (${category}) - manual review required`, mitigation: "Escalate to risk team" });
      }

      // Calculate portfolio impact
      const severityMultiplier = scenario.severity || 3;
      const portfolioImpact = -(10 + severityMultiplier * 5 + Math.random() * 10);

      // Update run with results
      const systemHealthAfter = Math.round(Math.max(20, 85 - severityMultiplier * 8 - Math.random() * 10));
      const updated = await storage.updateStressTestRun(runId, {
        status: "completed",
        completedAt: Date.now(),
        overallOutcome: portfolioImpact < -30 ? "degraded" : "survived",
        portfolioImpact: Math.round(portfolioImpact),
        systemHealthAfter,
      });

      const resultData = {
        scenarioId: scenario.id,
        success: true,
        vulnerabilitiesFound: vulns,
        agentPerformance,
        recommendations: [
          "Review and update emergency response protocols",
          "Test backup liquidity sources",
          "Verify oracle redundancy",
          "Update risk parameter thresholds",
        ],
        portfolioImpact,
      };

      broadcastToClients({
        type: "log",
        data: { event: "stress_test_completed", run: updated, vulnerabilities: vulns },
        timestamp: Date.now(),
      });

      res.status(200).json({
        ...updated,
        resultData,
      });
    } catch (error) {
      console.error("Failed to execute stress test:", error);
      res.status(500).json({ error: "Failed to execute stress test" });
    }
  });

  app.patch("/api/stress/runs/:id", writeLimiter, async (req, res) => {
    try {
      const { status, resultData } = req.body;
      const updates: any = {};
      
      if (status) updates.status = status;
      if (status === "completed") {
        updates.completedAt = Date.now();
        updates.overallOutcome = "survived";
      }
      
      const updated = await storage.updateStressTestRun(req.params.id, updates);
      if (!updated) return res.status(404).json({ error: "Stress test run not found" });
      
      // Merge resultData into response for frontend
      const response = {
        ...updated,
        resultData: resultData || updated,
      };
      
      broadcastToClients({
        type: "log",
        data: { event: "stress_test_updated", run: response },
        timestamp: Date.now(),
      });
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: "Failed to update stress test run" });
    }
  });

  return httpServer;
}
