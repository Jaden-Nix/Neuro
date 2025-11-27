import { EventEmitter } from "events";
import type {
  GovernanceProposal,
  GovernanceSigner,
  GovernanceVote,
  SafeConfig,
  TimelockConfig,
  MultiSigThreshold,
} from "@shared/schema";

interface ProposalCreationParams {
  title: string;
  description: string;
  proposer: string;
  transactionValue: number;
  transactionTo: string;
  transactionData: string;
  chain: GovernanceProposal["chain"];
  threshold: MultiSigThreshold;
  signers: string[];
  safeAddress?: string;
}

export class GovernanceSystem extends EventEmitter {
  private proposals: Map<string, GovernanceProposal> = new Map();
  private votes: Map<string, GovernanceVote[]> = new Map();
  private safeConfigs: Map<string, SafeConfig> = new Map();
  
  private readonly timelockConfig: TimelockConfig = {
    minimumDelayHours: 24,
    maximumDelayHours: 168,
    highValueThreshold: 50000,
  };

  private readonly thresholdMap: Record<MultiSigThreshold, { required: number; total: number }> = {
    "2-of-3": { required: 2, total: 3 },
    "3-of-5": { required: 3, total: 5 },
    "4-of-7": { required: 4, total: 7 },
  };

  constructor() {
    super();
    this.startExpirationChecker();
  }

  public createProposal(params: ProposalCreationParams): GovernanceProposal {
    const { required, total } = this.thresholdMap[params.threshold];
    
    if (params.signers.length !== total) {
      throw new Error(`Threshold ${params.threshold} requires exactly ${total} signers`);
    }

    const timelockHours = this.calculateTimelockDuration(params.transactionValue);
    const timelockEnd = Date.now() + (timelockHours * 60 * 60 * 1000);

    const signers: GovernanceSigner[] = params.signers.map(address => ({
      address,
      approved: false,
    }));

    const proposal: GovernanceProposal = {
      id: `prop-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      title: params.title,
      description: params.description,
      proposer: params.proposer,
      transactionValue: params.transactionValue,
      transactionTo: params.transactionTo,
      transactionData: params.transactionData,
      chain: params.chain,
      threshold: params.threshold,
      requiredSignatures: required,
      currentSignatures: 0,
      signers,
      status: "pending",
      timelockEnd,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      safeAddress: params.safeAddress,
    };

    this.proposals.set(proposal.id, proposal);
    this.votes.set(proposal.id, []);

    this.emit("proposalCreated", proposal);
    return proposal;
  }

  private calculateTimelockDuration(transactionValue: number): number {
    if (transactionValue >= this.timelockConfig.highValueThreshold) {
      return Math.min(
        this.timelockConfig.maximumDelayHours,
        this.timelockConfig.minimumDelayHours * Math.ceil(transactionValue / this.timelockConfig.highValueThreshold)
      );
    }
    return this.timelockConfig.minimumDelayHours;
  }

  public signProposal(
    proposalId: string,
    signerAddress: string,
    signature: string
  ): GovernanceProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error("Proposal not found");
    }

    if (proposal.status !== "pending") {
      throw new Error(`Cannot sign proposal with status: ${proposal.status}`);
    }

    const signerIndex = proposal.signers.findIndex(
      s => s.address.toLowerCase() === signerAddress.toLowerCase()
    );

    if (signerIndex === -1) {
      throw new Error("Signer not authorized for this proposal");
    }

    if (proposal.signers[signerIndex].approved) {
      throw new Error("Signer has already signed this proposal");
    }

    proposal.signers[signerIndex] = {
      ...proposal.signers[signerIndex],
      approved: true,
      signedAt: Date.now(),
      signature,
    };

    proposal.currentSignatures++;
    proposal.updatedAt = Date.now();

    if (proposal.currentSignatures >= proposal.requiredSignatures) {
      proposal.status = "approved";
      this.emit("proposalApproved", proposal);
    }

    this.proposals.set(proposalId, proposal);
    this.emit("proposalSigned", { proposalId, signerAddress, proposal });

    return proposal;
  }

  public castVote(
    proposalId: string,
    voter: string,
    vote: GovernanceVote["vote"],
    reason?: string
  ): GovernanceVote {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error("Proposal not found");
    }

    if (proposal.status !== "pending") {
      throw new Error(`Cannot vote on proposal with status: ${proposal.status}`);
    }

    const existingVotes = this.votes.get(proposalId) || [];
    const hasVoted = existingVotes.some(
      v => v.voter.toLowerCase() === voter.toLowerCase()
    );

    if (hasVoted) {
      throw new Error("Voter has already voted on this proposal");
    }

    const voteRecord: GovernanceVote = {
      id: `vote-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      proposalId,
      voter,
      vote,
      reason,
      timestamp: Date.now(),
    };

    existingVotes.push(voteRecord);
    this.votes.set(proposalId, existingVotes);

    this.emit("voteCast", voteRecord);
    return voteRecord;
  }

  public executeProposal(proposalId: string): GovernanceProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error("Proposal not found");
    }

    if (proposal.status !== "approved") {
      throw new Error("Proposal must be approved before execution");
    }

    if (Date.now() < proposal.timelockEnd) {
      const remainingHours = Math.ceil((proposal.timelockEnd - Date.now()) / (60 * 60 * 1000));
      throw new Error(`Timelock not expired. ${remainingHours} hours remaining`);
    }

    proposal.status = "executed";
    proposal.executedAt = Date.now();
    proposal.updatedAt = Date.now();

    this.proposals.set(proposalId, proposal);
    this.emit("proposalExecuted", proposal);

    return proposal;
  }

  public rejectProposal(proposalId: string, reason?: string): GovernanceProposal {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) {
      throw new Error("Proposal not found");
    }

    if (proposal.status !== "pending") {
      throw new Error(`Cannot reject proposal with status: ${proposal.status}`);
    }

    proposal.status = "rejected";
    proposal.updatedAt = Date.now();

    this.proposals.set(proposalId, proposal);
    this.emit("proposalRejected", { proposal, reason });

    return proposal;
  }

  public registerSafeConfig(config: Omit<SafeConfig, "nonce" | "createdAt">): SafeConfig {
    const fullConfig: SafeConfig = {
      ...config,
      nonce: 0,
      createdAt: Date.now(),
    };

    this.safeConfigs.set(config.safeAddress, fullConfig);
    this.emit("safeConfigRegistered", fullConfig);

    return fullConfig;
  }

  public getSafeConfig(safeAddress: string): SafeConfig | undefined {
    return this.safeConfigs.get(safeAddress);
  }

  public getAllSafeConfigs(): SafeConfig[] {
    return Array.from(this.safeConfigs.values());
  }

  public incrementSafeNonce(safeAddress: string): number {
    const config = this.safeConfigs.get(safeAddress);
    if (!config) {
      throw new Error("Safe configuration not found");
    }

    config.nonce++;
    this.safeConfigs.set(safeAddress, config);
    return config.nonce;
  }

  public getProposal(proposalId: string): GovernanceProposal | undefined {
    return this.proposals.get(proposalId);
  }

  public getAllProposals(): GovernanceProposal[] {
    return Array.from(this.proposals.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  public getPendingProposals(): GovernanceProposal[] {
    return this.getAllProposals().filter(p => p.status === "pending");
  }

  public getApprovedProposals(): GovernanceProposal[] {
    return this.getAllProposals().filter(p => p.status === "approved");
  }

  public getExecutableProposals(): GovernanceProposal[] {
    const now = Date.now();
    return this.getAllProposals().filter(
      p => p.status === "approved" && p.timelockEnd <= now
    );
  }

  public getProposalVotes(proposalId: string): GovernanceVote[] {
    return this.votes.get(proposalId) || [];
  }

  public getVoteSummary(proposalId: string): {
    approve: number;
    reject: number;
    abstain: number;
    total: number;
  } {
    const votes = this.getProposalVotes(proposalId);
    return {
      approve: votes.filter(v => v.vote === "approve").length,
      reject: votes.filter(v => v.vote === "reject").length,
      abstain: votes.filter(v => v.vote === "abstain").length,
      total: votes.length,
    };
  }

  public getTimelockConfig(): TimelockConfig {
    return { ...this.timelockConfig };
  }

  public updateTimelockConfig(config: Partial<TimelockConfig>): TimelockConfig {
    Object.assign(this.timelockConfig, config);
    this.emit("timelockConfigUpdated", this.timelockConfig);
    return this.timelockConfig;
  }

  public getProposalsByProposer(proposer: string): GovernanceProposal[] {
    return this.getAllProposals().filter(
      p => p.proposer.toLowerCase() === proposer.toLowerCase()
    );
  }

  public getProposalsBySigner(signerAddress: string): GovernanceProposal[] {
    return this.getAllProposals().filter(p =>
      p.signers.some(s => s.address.toLowerCase() === signerAddress.toLowerCase())
    );
  }

  public getSignerPendingProposals(signerAddress: string): GovernanceProposal[] {
    return this.getPendingProposals().filter(p => {
      const signer = p.signers.find(
        s => s.address.toLowerCase() === signerAddress.toLowerCase()
      );
      return signer && !signer.approved;
    });
  }

  public getProposalStats(): {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    executed: number;
    expired: number;
    totalValuePending: number;
    totalValueExecuted: number;
  } {
    const proposals = this.getAllProposals();
    return {
      total: proposals.length,
      pending: proposals.filter(p => p.status === "pending").length,
      approved: proposals.filter(p => p.status === "approved").length,
      rejected: proposals.filter(p => p.status === "rejected").length,
      executed: proposals.filter(p => p.status === "executed").length,
      expired: proposals.filter(p => p.status === "expired").length,
      totalValuePending: proposals
        .filter(p => p.status === "pending")
        .reduce((sum, p) => sum + p.transactionValue, 0),
      totalValueExecuted: proposals
        .filter(p => p.status === "executed")
        .reduce((sum, p) => sum + p.transactionValue, 0),
    };
  }

  private startExpirationChecker(): void {
    setInterval(() => {
      const now = Date.now();
      const expirationThreshold = 7 * 24 * 60 * 60 * 1000;

      for (const proposal of this.proposals.values()) {
        if (
          proposal.status === "pending" &&
          now - proposal.createdAt > expirationThreshold
        ) {
          proposal.status = "expired";
          proposal.updatedAt = now;
          this.proposals.set(proposal.id, proposal);
          this.emit("proposalExpired", proposal);
        }
      }
    }, 60 * 60 * 1000);
  }

  public buildSafeTransaction(
    proposal: GovernanceProposal
  ): {
    to: string;
    value: string;
    data: string;
    operation: number;
    safeTxGas: string;
    baseGas: string;
    gasPrice: string;
    gasToken: string;
    refundReceiver: string;
    nonce: number;
  } {
    const safeConfig = proposal.safeAddress
      ? this.safeConfigs.get(proposal.safeAddress)
      : undefined;

    return {
      to: proposal.transactionTo,
      value: proposal.transactionValue.toString(),
      data: proposal.transactionData || "0x",
      operation: 0,
      safeTxGas: "0",
      baseGas: "0",
      gasPrice: "0",
      gasToken: "0x0000000000000000000000000000000000000000",
      refundReceiver: "0x0000000000000000000000000000000000000000",
      nonce: safeConfig?.nonce || 0,
    };
  }

  public validateSignature(
    proposalId: string,
    signerAddress: string,
    signature: string
  ): boolean {
    const proposal = this.proposals.get(proposalId);
    if (!proposal) return false;

    const signer = proposal.signers.find(
      s => s.address.toLowerCase() === signerAddress.toLowerCase()
    );

    if (!signer) return false;

    if (signature.length !== 132) return false;
    if (!signature.startsWith("0x")) return false;

    return true;
  }

  public saveToJSON(): string {
    return JSON.stringify({
      proposals: Array.from(this.proposals.entries()),
      votes: Array.from(this.votes.entries()),
      safeConfigs: Array.from(this.safeConfigs.entries()),
      timelockConfig: this.timelockConfig,
    });
  }

  public loadFromJSON(json: string): void {
    const data = JSON.parse(json);
    this.proposals = new Map(data.proposals || []);
    this.votes = new Map(data.votes || []);
    this.safeConfigs = new Map(data.safeConfigs || []);
    if (data.timelockConfig) {
      Object.assign(this.timelockConfig, data.timelockConfig);
    }
  }
}

export const governanceSystem = new GovernanceSystem();
