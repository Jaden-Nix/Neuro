import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { AgentOrchestrator } from "./agents/AgentOrchestrator";
import { SimulationEngine } from "./simulation/SimulationEngine";
import { CreditEconomy } from "./economy/CreditEconomy";
import { MemoryVault } from "./memory/MemoryVault";
import { SentinelMonitor } from "./monitoring/SentinelMonitor";
import { ReplayEngine } from "./replay/ReplayEngine";
import type { WSMessage, LogEntry } from "@shared/schema";

// Initialize all services
const orchestrator = new AgentOrchestrator();
const simulationEngine = new SimulationEngine();
const creditEconomy = new CreditEconomy();
const memoryVault = new MemoryVault();
const sentinelMonitor = new SentinelMonitor();
const replayEngine = new ReplayEngine();

// Start sentinel monitoring
sentinelMonitor.start();

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

  // System State
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

  app.post("/api/simulate", async (req, res) => {
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

  // Control Endpoints
  app.post("/api/autonomous/toggle", async (_req, res) => {
    try {
      const state = await storage.getSystemState();
      const newMode = !state.autonomousMode;
      
      await storage.updateSystemState({ autonomousMode: newMode });

      if (newMode) {
        // Start autonomous cycle
        setInterval(async () => {
          try {
            await orchestrator.runNegotiationCycle();
          } catch (error) {
            console.error("Autonomous cycle error:", error);
          }
        }, 30000); // Every 30 seconds
      }

      res.json({
        autonomousMode: newMode,
        message: newMode ? "Autonomous mode activated" : "Autonomous mode deactivated",
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to toggle autonomous mode" });
    }
  });

  app.post("/api/execute", async (req, res) => {
    try {
      // Manual execution would happen here
      res.json({
        transactionId: `tx-${Date.now()}`,
        status: "pending",
        hash: "0x" + Math.random().toString(16).substring(2),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to execute" });
    }
  });

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
