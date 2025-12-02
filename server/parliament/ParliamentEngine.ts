import { 
  AgentType,
  type ParliamentSession, 
  type ParliamentVote, 
  type ParliamentDebateEntry, 
  type MetaSummary,
  type ExpectedOutcome,
  type ProposalActionType 
} from "@shared/schema";

interface AgentProfile {
  id: string;
  type: AgentType;
  name: string;
  creditScore: number;
  historicalAccuracy: number;
  specialization: string[];
  defaultPosition: "for" | "against" | "clarification";
}

interface DebateContext {
  topic: string;
  description: string;
  actionType: ProposalActionType;
  proposalData: Record<string, any>;
  previousDebates: ParliamentDebateEntry[];
  otherAgentVotes: ParliamentVote[];
}

const DATA_SOURCES: Record<AgentType, string[]> = {
  [AgentType.SCOUT]: ["DefiLlama", "Dune Analytics", "Token Terminal", "L2Beat", "Coingecko"],
  [AgentType.RISK]: ["Nansen", "Chainalysis", "Certik", "Immunefi", "DeFiSafety"],
  [AgentType.EXECUTION]: ["Etherscan", "Flashbots", "Blocknative", "MEV-Boost", "Gas Now"],
  [AgentType.META]: ["All Agent Inputs", "Historical Decisions", "Evolution Metrics", "Credit Scores"],
};

const AGENT_PROFILES: AgentProfile[] = [
  {
    id: "scout-001",
    type: AgentType.SCOUT,
    name: "Scout Agent",
    creditScore: 85,
    historicalAccuracy: 0.82,
    specialization: ["opportunity_detection", "yield_analysis", "market_trends"],
    defaultPosition: "for",
  },
  {
    id: "risk-001",
    type: AgentType.RISK,
    name: "Risk Agent",
    creditScore: 90,
    historicalAccuracy: 0.88,
    specialization: ["risk_assessment", "security_audit", "volatility_analysis"],
    defaultPosition: "against",
  },
  {
    id: "exec-001",
    type: AgentType.EXECUTION,
    name: "Execution Agent",
    creditScore: 88,
    historicalAccuracy: 0.85,
    specialization: ["transaction_execution", "gas_optimization", "mev_protection"],
    defaultPosition: "clarification",
  },
  {
    id: "meta-001",
    type: AgentType.META,
    name: "Meta Agent",
    creditScore: 92,
    historicalAccuracy: 0.90,
    specialization: ["orchestration", "conflict_resolution", "synthesis"],
    defaultPosition: "clarification",
  },
];

class ParliamentEngine {
  private adkIntegration: any = null;
  private evolutionEngine: any = null;

  async initialize() {
    try {
      const { adkIntegration } = await import("../adk/ADKIntegration");
      this.adkIntegration = adkIntegration;
    } catch (error) {
      console.log("ADK Integration not available, using simulated responses");
    }
    
    try {
      const { evolutionEngine } = await import("../evolution/EvolutionEngine");
      this.evolutionEngine = evolutionEngine;
    } catch (error) {
      console.log("Evolution Engine not available");
    }
  }

  getAgentProfiles(): AgentProfile[] {
    return AGENT_PROFILES;
  }

  getDataSources(agentType: AgentType): string[] {
    return DATA_SOURCES[agentType] || [];
  }

  async generateDebateEntry(
    agent: AgentProfile,
    context: DebateContext
  ): Promise<ParliamentDebateEntry> {
    const dataSources = this.getDataSources(agent.type);
    
    let statement = "";
    let position = agent.defaultPosition;
    let simulationResults: ParliamentDebateEntry["simulationResults"];
    
    if (this.adkIntegration) {
      const prompt = this.buildDebatePrompt(agent, context);
      const agentName = `neuronet_${agent.type}`;
      
      try {
        const decision = await this.adkIntegration.queryAgent(agentName, prompt, {
          topic: context.topic,
          actionType: context.actionType,
          previousDebates: context.previousDebates.slice(-3),
        });
        
        statement = this.parseResponse(decision.reasoning);
        position = this.inferPosition(statement, agent.type);
      } catch (error) {
        statement = this.generateSimulatedDebate(agent, context);
      }
    } else {
      statement = this.generateSimulatedDebate(agent, context);
    }
    
    if (agent.type === "risk") {
      simulationResults = this.runRiskSimulation(context);
    }
    
    return {
      agentId: agent.id,
      agentType: agent.type,
      position,
      statement,
      dataSources,
      simulationResults,
      timestamp: Date.now(),
    };
  }

  async generateVote(
    agent: AgentProfile,
    context: DebateContext
  ): Promise<ParliamentVote> {
    const dataSources = this.getDataSources(agent.type);
    
    let vote: "approve" | "reject" | "abstain" = "abstain";
    let confidence = 50;
    let reasoning = "";
    let pros: string[] = [];
    let cons: string[] = [];
    let expectedOutcome: ExpectedOutcome | undefined;
    let alternativeSuggestions: string[] = [];
    
    if (this.adkIntegration) {
      const prompt = this.buildVotePrompt(agent, context);
      const agentName = `neuronet_${agent.type}`;
      
      try {
        const decision = await this.adkIntegration.queryAgent(agentName, prompt, {
          topic: context.topic,
          actionType: context.actionType,
          debates: context.previousDebates,
        });
        
        const parsed = this.parseVoteResponse(decision);
        vote = parsed.vote;
        confidence = parsed.confidence;
        reasoning = parsed.reasoning;
        pros = parsed.pros;
        cons = parsed.cons;
      } catch (error) {
        const simulated = this.generateSimulatedVote(agent, context);
        vote = simulated.vote;
        confidence = simulated.confidence;
        reasoning = simulated.reasoning;
        pros = simulated.pros;
        cons = simulated.cons;
      }
    } else {
      const simulated = this.generateSimulatedVote(agent, context);
      vote = simulated.vote;
      confidence = simulated.confidence;
      reasoning = simulated.reasoning;
      pros = simulated.pros;
      cons = simulated.cons;
    }
    
    expectedOutcome = this.calculateExpectedOutcome(agent, context, vote);
    alternativeSuggestions = this.generateAlternatives(agent, context, vote);
    
    return {
      agentId: agent.id,
      agentType: agent.type,
      vote,
      reasoning,
      confidence,
      expectedOutcome,
      alternativeSuggestions,
      pros,
      cons,
      dataSourcesUsed: dataSources,
      creditScore: agent.creditScore,
      historicalAccuracy: agent.historicalAccuracy,
      timestamp: Date.now(),
    };
  }

  synthesizeMetaSummary(votes: ParliamentVote[], debates: ParliamentDebateEntry[]): MetaSummary {
    const approves = votes.filter(v => v.vote === "approve");
    const rejects = votes.filter(v => v.vote === "reject");
    const abstains = votes.filter(v => v.vote === "abstain");
    
    let totalWeight = 0;
    let weightedApprove = 0;
    let weightedReject = 0;
    
    for (const vote of votes) {
      const weight = this.calculateVoteWeight(vote);
      totalWeight += weight;
      
      if (vote.vote === "approve") {
        weightedApprove += weight * (vote.confidence / 100);
      } else if (vote.vote === "reject") {
        weightedReject += weight * (vote.confidence / 100);
      }
    }
    
    const normalizedApprove = totalWeight > 0 ? (weightedApprove / totalWeight) * 100 : 0;
    const normalizedReject = totalWeight > 0 ? (weightedReject / totalWeight) * 100 : 0;
    
    const weightedConfidence = Math.round(
      votes.reduce((sum, v) => sum + (v.confidence * this.calculateVoteWeight(v)), 0) / 
      Math.max(totalWeight, 1)
    );
    
    const conflictsDetected = this.detectConflicts(votes, debates);
    const suggestedAmendments = this.generateAmendments(votes, debates);
    const riskAssessment = this.assessOverallRisk(votes);
    
    let recommendation: MetaSummary["recommendation"] = "needs_review";
    if (conflictsDetected.length === 0) {
      if (normalizedApprove > 60) {
        recommendation = "approve";
      } else if (normalizedReject > 60) {
        recommendation = "reject";
      }
    }
    
    const synthesisStatement = this.generateSynthesis(votes, debates, recommendation);
    
    return {
      weightedConfidence,
      recommendation,
      conflictsDetected,
      suggestedAmendments,
      riskAssessment,
      synthesisStatement,
      timestamp: Date.now(),
    };
  }

  determineOutcome(
    votes: ParliamentVote[],
    quorum: number,
    requiredMajority: number,
    metaSummary?: MetaSummary
  ): "approved" | "rejected" | "deadlocked" {
    if (votes.length < quorum) {
      return "deadlocked";
    }
    
    let totalWeight = 0;
    let approveWeight = 0;
    let rejectWeight = 0;
    
    for (const vote of votes) {
      const weight = this.calculateVoteWeight(vote);
      totalWeight += weight;
      
      if (vote.vote === "approve") {
        approveWeight += weight;
      } else if (vote.vote === "reject") {
        rejectWeight += weight;
      }
    }
    
    const approvalPct = (approveWeight / totalWeight) * 100;
    const rejectPct = (rejectWeight / totalWeight) * 100;
    
    if (approvalPct >= requiredMajority) {
      return "approved";
    } else if (rejectPct >= requiredMajority) {
      return "rejected";
    }
    
    return "deadlocked";
  }

  private calculateVoteWeight(vote: ParliamentVote): number {
    const creditScore = vote.creditScore || 50;
    const historicalAccuracy = vote.historicalAccuracy || 0.5;
    const confidence = vote.confidence / 100;
    
    return (creditScore / 100) * historicalAccuracy * (0.5 + confidence * 0.5);
  }

  private detectConflicts(votes: ParliamentVote[], debates: ParliamentDebateEntry[]): string[] {
    const conflicts: string[] = [];
    
    const riskVote = votes.find(v => v.agentType === AgentType.RISK);
    const scoutVote = votes.find(v => v.agentType === AgentType.SCOUT);
    
    if (riskVote && scoutVote) {
      if (riskVote.vote === "reject" && scoutVote.vote === "approve") {
        if (riskVote.confidence > 70 && scoutVote.confidence > 70) {
          conflicts.push("Risk-Scout conflict: High confidence opposing views on opportunity vs safety");
        }
      }
    }
    
    const highRiskVotes = votes.filter(v => 
      v.expectedOutcome && v.expectedOutcome.riskScore > 70
    );
    if (highRiskVotes.length > 1) {
      conflicts.push("Multiple agents flagged high risk concerns");
    }
    
    const confidenceSpread = Math.max(...votes.map(v => v.confidence)) - 
                             Math.min(...votes.map(v => v.confidence));
    if (confidenceSpread > 40) {
      conflicts.push("High confidence divergence among agents");
    }
    
    return conflicts;
  }

  private generateAmendments(votes: ParliamentVote[], debates: ParliamentDebateEntry[]): string[] {
    const amendments: string[] = [];
    
    for (const vote of votes) {
      if (vote.alternativeSuggestions) {
        amendments.push(...vote.alternativeSuggestions);
      }
    }
    
    const uniqueAmendments = [...new Set(amendments)];
    return uniqueAmendments.slice(0, 5);
  }

  private assessOverallRisk(votes: ParliamentVote[]): MetaSummary["riskAssessment"] {
    const riskVote = votes.find(v => v.agentType === AgentType.RISK);
    const avgRiskScore = votes
      .filter(v => v.expectedOutcome)
      .reduce((sum, v) => sum + (v.expectedOutcome?.riskScore || 0), 0) / 
      Math.max(votes.filter(v => v.expectedOutcome).length, 1);
    
    const factors: string[] = [];
    let overallRisk: "low" | "medium" | "high" | "critical" = "low";
    
    if (avgRiskScore > 80) {
      overallRisk = "critical";
      factors.push("Extremely high aggregate risk score");
    } else if (avgRiskScore > 60) {
      overallRisk = "high";
      factors.push("Elevated risk indicators detected");
    } else if (avgRiskScore > 40) {
      overallRisk = "medium";
      factors.push("Moderate risk level within acceptable bounds");
    } else {
      factors.push("Risk metrics within safe parameters");
    }
    
    if (riskVote?.vote === "reject") {
      if (overallRisk === "low") overallRisk = "medium";
      else if (overallRisk === "medium") overallRisk = "high";
      factors.push("Risk Agent vetoed proposal");
    }
    
    if (riskVote?.cons && riskVote.cons.length > 3) {
      factors.push(`Risk Agent identified ${riskVote.cons.length} concerns`);
    }
    
    return { overallRisk, factors };
  }

  private generateSynthesis(
    votes: ParliamentVote[],
    debates: ParliamentDebateEntry[],
    recommendation: MetaSummary["recommendation"]
  ): string {
    const approves = votes.filter(v => v.vote === "approve").length;
    const rejects = votes.filter(v => v.vote === "reject").length;
    const avgConfidence = Math.round(
      votes.reduce((sum, v) => sum + v.confidence, 0) / votes.length
    );
    
    const riskVote = votes.find(v => v.agentType === AgentType.RISK);
    const scoutVote = votes.find(v => v.agentType === AgentType.SCOUT);
    
    let synthesis = `Synthesis: ${approves} approval(s), ${rejects} rejection(s) with ${avgConfidence}% average confidence. `;
    
    if (recommendation === "approve") {
      synthesis += "Consensus favors approval. ";
      if (scoutVote?.expectedOutcome) {
        synthesis += `Expected return: ${scoutVote.expectedOutcome.returnPercent}% with ${scoutVote.expectedOutcome.riskScore}% risk. `;
      }
    } else if (recommendation === "reject") {
      synthesis += "Majority recommends rejection. ";
      if (riskVote?.cons && riskVote.cons.length > 0) {
        synthesis += `Primary concerns: ${riskVote.cons[0]}. `;
      }
    } else {
      synthesis += "Inconclusive - manual review recommended. ";
      synthesis += "Consider suggested amendments before re-voting.";
    }
    
    return synthesis;
  }

  private buildDebatePrompt(agent: AgentProfile, context: DebateContext): string {
    return `You are the ${agent.name} in a DeFi governance parliament.

PROPOSAL: "${context.topic}"
DESCRIPTION: ${context.description}
ACTION TYPE: ${context.actionType}

Your specialization: ${agent.specialization.join(", ")}
Data sources available: ${this.getDataSources(agent.type).join(", ")}

Previous debate points:
${context.previousDebates.map(d => `- ${d.agentType}: ${d.statement}`).join("\n")}

Provide your analysis in 2-3 sentences. Consider:
1. Key opportunities or risks based on your specialization
2. Data-driven insights from your sources
3. Response to other agents' points if relevant`;
  }

  private buildVotePrompt(agent: AgentProfile, context: DebateContext): string {
    return `You are the ${agent.name} casting your vote on a DeFi governance proposal.

PROPOSAL: "${context.topic}"
DESCRIPTION: ${context.description}
ACTION TYPE: ${context.actionType}

Debate summary:
${context.previousDebates.map(d => `- ${d.agentType} (${d.position}): ${d.statement}`).join("\n")}

Cast your vote with:
1. Vote: approve/reject/abstain
2. Confidence: 0-100
3. Reasoning: Brief explanation
4. Pros: List of positive factors
5. Cons: List of concerns

Respond in a structured format.`;
  }

  private parseResponse(response: any): string {
    if (typeof response === "string") {
      try {
        const parsed = JSON.parse(response);
        return parsed.analysis || parsed.reasoning || parsed.statement || response;
      } catch {
        return response.substring(0, 500);
      }
    }
    return JSON.stringify(response).substring(0, 500);
  }

  private parseVoteResponse(decision: any): {
    vote: "approve" | "reject" | "abstain";
    confidence: number;
    reasoning: string;
    pros: string[];
    cons: string[];
  } {
    const reasoning = this.parseResponse(decision.reasoning);
    const lowerReasoning = reasoning.toLowerCase();
    
    let vote: "approve" | "reject" | "abstain" = "abstain";
    if (lowerReasoning.includes("approve") || lowerReasoning.includes("support")) {
      vote = "approve";
    } else if (lowerReasoning.includes("reject") || lowerReasoning.includes("oppose")) {
      vote = "reject";
    }
    
    return {
      vote,
      confidence: decision.confidence ? Math.round(decision.confidence * 100) : 70,
      reasoning,
      pros: [],
      cons: [],
    };
  }

  private inferPosition(statement: string, agentType: AgentType): "for" | "against" | "clarification" {
    const lower = statement.toLowerCase();
    
    if (agentType === AgentType.RISK) {
      if (lower.includes("concern") || lower.includes("risk") || lower.includes("caution")) {
        return "against";
      }
    }
    
    if (lower.includes("support") || lower.includes("approve") || lower.includes("opportunity")) {
      return "for";
    }
    if (lower.includes("reject") || lower.includes("oppose") || lower.includes("veto")) {
      return "against";
    }
    
    return "clarification";
  }

  private generateSimulatedDebate(agent: AgentProfile, context: DebateContext): string {
    const templates: Record<AgentType, string[]> = {
      [AgentType.SCOUT]: [
        `Opportunity analysis shows ${context.actionType === "yield_deployment" ? "promising yield potential" : "favorable market conditions"}. Current market data from ${DATA_SOURCES[AgentType.SCOUT][0]} indicates positive momentum.`,
        `Market scanning reveals ${Math.random() > 0.5 ? "strong" : "moderate"} opportunity signals. TVL trends and protocol metrics support this assessment.`,
      ],
      [AgentType.RISK]: [
        `Risk assessment identifies ${Math.random() > 0.6 ? "acceptable" : "elevated"} exposure levels. Smart contract security verified via ${DATA_SOURCES[AgentType.RISK][2]}. Recommend ${Math.random() > 0.5 ? "approval with monitoring" : "caution"}.`,
        `Security analysis complete. Protocol audit status: ${Math.random() > 0.5 ? "verified" : "pending review"}. Liquidity risk: ${Math.random() > 0.5 ? "low" : "moderate"}.`,
      ],
      [AgentType.EXECUTION]: [
        `Execution feasibility: ${Math.random() > 0.5 ? "high" : "moderate"}. Estimated gas: ${Math.floor(100 + Math.random() * 150)}K gwei. MEV protection strategies available via ${DATA_SOURCES[AgentType.EXECUTION][1]}.`,
        `Transaction analysis complete. Success probability: ${Math.floor(75 + Math.random() * 20)}%. Network conditions: ${Math.random() > 0.5 ? "optimal" : "acceptable"}.`,
      ],
      [AgentType.META]: [
        `Synthesizing agent inputs: Scout signals ${Math.random() > 0.5 ? "opportunity" : "caution"}, Risk flags ${Math.random() > 0.5 ? "acceptable" : "elevated"} exposure. Weighted confidence: ${Math.floor(65 + Math.random() * 25)}%.`,
        `Cross-agent analysis shows ${Math.random() > 0.5 ? "consensus" : "divergence"}. Historical decision accuracy for similar proposals: ${Math.floor(70 + Math.random() * 20)}%.`,
      ],
    };
    
    const agentTemplates = templates[agent.type];
    return agentTemplates[Math.floor(Math.random() * agentTemplates.length)];
  }

  private generateSimulatedVote(agent: AgentProfile, context: DebateContext): {
    vote: "approve" | "reject" | "abstain";
    confidence: number;
    reasoning: string;
    pros: string[];
    cons: string[];
  } {
    const weights: Record<AgentType, { approve: number; reject: number; abstain: number }> = {
      [AgentType.SCOUT]: { approve: 0.6, reject: 0.2, abstain: 0.2 },
      [AgentType.RISK]: { approve: 0.3, reject: 0.5, abstain: 0.2 },
      [AgentType.EXECUTION]: { approve: 0.5, reject: 0.3, abstain: 0.2 },
      [AgentType.META]: { approve: 0.4, reject: 0.3, abstain: 0.3 },
    };
    
    const w = weights[agent.type];
    const rand = Math.random();
    let vote: "approve" | "reject" | "abstain";
    
    if (rand < w.approve) vote = "approve";
    else if (rand < w.approve + w.reject) vote = "reject";
    else vote = "abstain";
    
    const prosOptions: Record<AgentType, string[]> = {
      [AgentType.SCOUT]: ["Strong yield opportunity", "Favorable market conditions", "Growing protocol TVL"],
      [AgentType.RISK]: ["Audited smart contracts", "Sufficient liquidity", "Historical stability"],
      [AgentType.EXECUTION]: ["Low gas environment", "MEV protection available", "High success probability"],
      [AgentType.META]: ["Agent consensus forming", "Aligns with strategy", "Acceptable risk/reward"],
    };
    
    const consOptions: Record<AgentType, string[]> = {
      [AgentType.SCOUT]: ["Market volatility", "Competition from alternatives", "Yield sustainability uncertain"],
      [AgentType.RISK]: ["Smart contract risk", "Liquidity concerns", "Counterparty exposure"],
      [AgentType.EXECUTION]: ["Network congestion possible", "Slippage risk", "Timing sensitivity"],
      [AgentType.META]: ["Agent disagreement", "Historical underperformance", "Strategy misalignment"],
    };
    
    const numPros = Math.floor(1 + Math.random() * 2);
    const numCons = Math.floor(1 + Math.random() * 2);
    
    const pros = prosOptions[agent.type].slice(0, numPros);
    const cons = consOptions[agent.type].slice(0, numCons);
    
    return {
      vote,
      confidence: Math.floor(60 + Math.random() * 35),
      reasoning: `Based on ${agent.specialization[0]} analysis using ${DATA_SOURCES[agent.type][0]}, I cast ${vote} with considerations for both opportunities and risks.`,
      pros,
      cons,
    };
  }

  private calculateExpectedOutcome(
    agent: AgentProfile,
    context: DebateContext,
    vote: "approve" | "reject" | "abstain"
  ): ExpectedOutcome {
    const baseReturn = context.actionType === "yield_deployment" ? 5 : 2;
    const baseRisk = agent.type === AgentType.RISK ? 35 : 25;
    
    return {
      returnPercent: Math.round((baseReturn + Math.random() * 8) * 10) / 10,
      riskScore: Math.round(baseRisk + Math.random() * 30),
      timeHorizon: context.actionType === "yield_deployment" ? "30 days" : "7 days",
      confidence: Math.round(60 + Math.random() * 30),
    };
  }

  private generateAlternatives(
    agent: AgentProfile,
    context: DebateContext,
    vote: "approve" | "reject" | "abstain"
  ): string[] {
    if (vote === "approve") return [];
    
    const alternatives: Record<AgentType, string[]> = {
      [AgentType.SCOUT]: ["Consider alternative yield sources", "Wait for better market entry"],
      [AgentType.RISK]: ["Reduce position size by 50%", "Add stop-loss mechanism", "Require additional audit"],
      [AgentType.EXECUTION]: ["Schedule during lower gas periods", "Split into smaller transactions"],
      [AgentType.META]: ["Request additional agent analysis", "Defer to human review"],
    };
    
    return alternatives[agent.type] || [];
  }

  private runRiskSimulation(context: DebateContext): ParliamentDebateEntry["simulationResults"] {
    const scenarios = ["Flash Crash", "Normal Volatility", "High Growth"];
    const scenario = scenarios[Math.floor(Math.random() * scenarios.length)];
    
    return {
      scenarioName: scenario,
      outcome: scenario === "Flash Crash" ? "Portfolio loss: -15%" : "Portfolio gain: +8%",
      confidence: Math.round(60 + Math.random() * 30),
    };
  }
}

export const parliamentEngine = new ParliamentEngine();
