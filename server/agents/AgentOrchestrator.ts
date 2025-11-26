import { EventEmitter } from "events";
import { MetaAgent } from "./MetaAgent";
import { ScoutAgent } from "./ScoutAgent";
import { RiskAgent } from "./RiskAgent";
import { ExecutionAgent } from "./ExecutionAgent";
import { BaseAgent } from "./BaseAgent";
import type { Agent, NegotiationProposal, NegotiationResult } from "@shared/schema";

export class AgentOrchestrator extends EventEmitter {
  private metaAgent: MetaAgent;
  private scoutAgent: ScoutAgent;
  private riskAgent: RiskAgent;
  private executionAgent: ExecutionAgent;
  private agents: Map<string, BaseAgent>;

  constructor() {
    super();
    this.metaAgent = new MetaAgent();
    this.scoutAgent = new ScoutAgent();
    this.riskAgent = new RiskAgent();
    this.executionAgent = new ExecutionAgent();

    this.agents = new Map();
    this.agents.set(this.metaAgent.id, this.metaAgent);
    this.agents.set(this.scoutAgent.id, this.scoutAgent);
    this.agents.set(this.riskAgent.id, this.riskAgent);
    this.agents.set(this.executionAgent.id, this.executionAgent);

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    [this.metaAgent, this.scoutAgent, this.riskAgent, this.executionAgent].forEach((agent) => {
      agent.on("statusChange", (data) => this.emit("agentStatusChange", data));
      agent.on("taskChange", (data) => this.emit("agentTaskChange", data));
      agent.on("creditChange", (data) => this.emit("creditChange", data));
      agent.on("deprecated", (data) => this.emit("agentDeprecated", data));
    });
  }

  public getAllAgents(): Agent[] {
    return Array.from(this.agents.values()).map((agent) => agent.toJSON());
  }

  public getAgent(id: string): Agent | undefined {
    return this.agents.get(id)?.toJSON();
  }

  public async runNegotiationCycle(marketData?: any): Promise<NegotiationResult> {
    this.emit("negotiationStarted");

    try {
      // Step 1: Scout identifies opportunity
      const scoutProposal = await this.scoutAgent.process({ marketData });
      this.emit("log", {
        agentType: "scout",
        level: "info",
        message: `Scout identified: ${scoutProposal.description}`,
        personality: "Energetically scanning markets...",
      });

      // Step 2: Risk evaluates
      const riskAssessment = await this.riskAgent.process({
        proposal: scoutProposal,
        marketConditions: marketData,
      });
      this.emit("log", {
        agentType: "risk",
        level: riskAssessment.shouldVeto ? "warn" : "info",
        message: `Risk score: ${riskAssessment.riskScore}${riskAssessment.shouldVeto ? " - VETO" : ""}`,
        personality: "Formally assessing risks...",
      });

      if (riskAssessment.shouldVeto) {
        return {
          proposalId: `prop-${Date.now()}`,
          approved: false,
          finalScore: 0,
          vetoes: [this.riskAgent.type],
          approvals: [],
          metaAgentDecision: "Vetoed due to high risk",
        };
      }

      // Step 3: Execution plans
      const executionPlan = await this.executionAgent.process({
        proposal: scoutProposal,
        riskAssessment,
      });
      this.emit("log", {
        agentType: "execution",
        level: executionPlan.feasible ? "success" : "warn",
        message: `Execution ${executionPlan.feasible ? "feasible" : "not feasible"}, success probability: ${executionPlan.successProbability}%`,
        personality: "Precisely calculating execution...",
      });

      if (!executionPlan.feasible) {
        return {
          proposalId: `prop-${Date.now()}`,
          approved: false,
          finalScore: 0,
          vetoes: [this.executionAgent.type],
          approvals: [this.scoutAgent.type],
          metaAgentDecision: "Execution not feasible",
        };
      }

      // Step 4: Meta-Agent decides
      const metaDecision = await this.metaAgent.process({
        scoutProposal,
        riskAssessment,
        executionPlan,
      });
      this.emit("log", {
        agentType: "meta",
        level: metaDecision.approved ? "success" : "info",
        message: `Meta decision: ${metaDecision.approved ? "APPROVED" : "REJECTED"} - ${metaDecision.reasoning}`,
        personality: "Sovereignly deciding...",
      });

      return {
        proposalId: `prop-${Date.now()}`,
        approved: metaDecision.approved,
        finalScore: metaDecision.confidence,
        vetoes: metaDecision.approved ? [] : [this.metaAgent.type],
        approvals: metaDecision.approved ? 
          [this.scoutAgent.type, this.riskAgent.type, this.executionAgent.type, this.metaAgent.type] : 
          [this.scoutAgent.type],
        metaAgentDecision: metaDecision.reasoning,
      };
    } catch (error) {
      this.emit("log", {
        agentType: "meta",
        level: "error",
        message: `Negotiation cycle failed: ${error}`,
      });
      throw error;
    } finally {
      this.emit("negotiationCompleted");
    }
  }

  public checkForDeprecation(): void {
    this.agents.forEach((agent) => {
      if (agent.shouldDeprecate() && !agent.deprecatedAt) {
        agent.deprecate("Performance below threshold");
        this.spawnReplacementAgent(agent);
      }
    });
  }

  private spawnReplacementAgent(oldAgent: BaseAgent): void {
    // Create new agent with incremented version
    let newAgent: BaseAgent;
    
    if (oldAgent instanceof ScoutAgent) {
      newAgent = new ScoutAgent();
    } else if (oldAgent instanceof RiskAgent) {
      newAgent = new RiskAgent();
    } else if (oldAgent instanceof ExecutionAgent) {
      newAgent = new ExecutionAgent();
    } else if (oldAgent instanceof MetaAgent) {
      newAgent = new MetaAgent();
    } else {
      return;
    }

    newAgent.version = oldAgent.version + 1;
    newAgent.atpMetadata = {
      ...oldAgent.atpMetadata,
      spawnedFrom: oldAgent.id,
      deprecationReason: "Performance below threshold",
      improvements: ["Increased confidence threshold", "Enhanced pattern recognition"],
    };

    this.agents.set(newAgent.id, newAgent);
    this.agents.delete(oldAgent.id);

    this.emit("log", {
      agentType: oldAgent.type,
      level: "info",
      message: `Agent ${oldAgent.id} deprecated and replaced with v${newAgent.version}`,
    });
  }
}
