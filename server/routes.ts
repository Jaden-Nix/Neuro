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
import type { WSMessage, LogEntry } from "@shared/schema";
import { initializeApiKeys, requireAuth, requireWriteAuth, type AuthenticatedRequest } from "./middleware/auth";
import { rateLimit, writeLimiter, strictLimiter } from "./middleware/rateLimit";
import { anthropicCircuitBreaker } from "./utils/circuitBreaker";

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

  // Initialize agents in storage
  const agents = orchestrator.getAllAgents();
  for (const agent of agents) {
    await storage.upsertAgent(agent);
  }

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
      const metrics = await storage.getMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to get metrics" });
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
          amount: data.result.creditAdjustment,
          reason: "Transaction confirmed successfully",
          success: true,
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
          amount: data.result.creditAdjustment,
          reason: `Transaction failed: ${data.error}`,
          success: false,
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

  return httpServer;
}
