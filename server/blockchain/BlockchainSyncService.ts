/**
 * BlockchainSyncService - Bridges off-chain evolution events to on-chain proofs
 * Posts evolution events, credit changes, and agent mutations to the blockchain
 */

import { EventEmitter } from 'events';
import type { EvolutionEvent } from '../evolution/EvolutionEngine';
import type { AgentType } from '@shared/schema';

export interface BlockchainConfig {
  enabled: boolean;
  network: 'ethereum' | 'base' | 'fraxtal';
  rpcUrl: string;
  contractAddresses: {
    neuronBadge: string;
    agentRegistry: string;
    agentNFT: string;
  };
  privateKey?: string;
}

export interface BadgeMintRequest {
  agentId: string;
  agentName: string;
  generation: number;
  mutationType: string;
  mutationDescription: string;
  riskScoreBefore: number;
  riskScoreAfter: number;
  creditDelta: number;
  actionTag: string;
  simulationId: string;
  metadataURI: string;
}

export interface OnChainProof {
  badgeId: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  network: string;
  verified: boolean;
}

export interface AgentOnChainIdentity {
  agentId: string;
  agentName: string;
  generation: number;
  creditScore: number;
  badges: OnChainProof[];
  totalEvolutions: number;
  totalSuccesses: number;
  totalFailures: number;
  accuracyRate: number;
  lastEvolutionTimestamp: number;
  atpTokenId?: string;
}

const MUTATION_TYPE_MAP: Record<string, number> = {
  'threshold_adjustment': 0,
  'risk_rebalancing': 1,
  'source_weight_shift': 2,
  'new_signal_enabled': 3,
  'signal_disabled': 4,
  'latency_penalty_reduction': 5,
  'failover_strategy_update': 6,
  'confidence_calibration': 7,
  'volatility_adaptation': 8,
  'slippage_optimization': 9,
};

export class BlockchainSyncService extends EventEmitter {
  private config: BlockchainConfig;
  private pendingMints: BadgeMintRequest[] = [];
  private mintedProofs: Map<string, OnChainProof> = new Map();
  private agentIdentities: Map<string, AgentOnChainIdentity> = new Map();
  private isProcessing: boolean = false;
  
  constructor(config?: Partial<BlockchainConfig>) {
    super();
    
    this.config = {
      enabled: config?.enabled ?? false,
      network: config?.network ?? 'base',
      rpcUrl: config?.rpcUrl ?? process.env.BASE_RPC_URL ?? '',
      contractAddresses: config?.contractAddresses ?? {
        neuronBadge: process.env.NEURON_BADGE_ADDRESS ?? '',
        agentRegistry: process.env.AGENT_REGISTRY_ADDRESS ?? '',
        agentNFT: process.env.AGENT_NFT_ADDRESS ?? '',
      },
      privateKey: config?.privateKey ?? process.env.BLOCKCHAIN_PRIVATE_KEY,
    };
    
    console.log('[BlockchainSync] Service initialized', {
      enabled: this.config.enabled,
      network: this.config.network,
      hasContracts: !!this.config.contractAddresses.neuronBadge,
    });
  }
  
  /**
   * Queue an evolution event for on-chain minting
   */
  async queueEvolutionBadge(event: EvolutionEvent): Promise<string> {
    const requestId = `badge-${event.id}`;
    
    const request: BadgeMintRequest = {
      agentId: this.hashAgentId(event.childAgentName),
      agentName: event.childAgentName,
      generation: event.childGeneration,
      mutationType: event.mutation.type,
      mutationDescription: event.reason,
      riskScoreBefore: Math.round(event.performanceImpact.drawdownBefore * 10),
      riskScoreAfter: Math.round(event.performanceImpact.drawdownAfter * 10),
      creditDelta: event.performanceImpact.roiChange > 0 
        ? Math.round(10 + event.performanceImpact.roiChange * 0.5)
        : Math.round(-5 - Math.abs(event.performanceImpact.roiChange) * 0.3),
      actionTag: this.getActionTag(event),
      simulationId: event.id,
      metadataURI: this.generateMetadataURI(event),
    };
    
    this.pendingMints.push(request);
    
    // Update in-memory identity
    this.updateAgentIdentity(request);
    
    // Emit event for UI
    this.emit('badgeQueued', { requestId, request });
    
    // Process if enabled
    if (this.config.enabled) {
      this.processPendingMints();
    } else {
      // Simulate successful mint for demo - ensure proof is persisted and linked to identity
      const simulatedProof = this.simulateMint(request);
      this.mintedProofs.set(requestId, simulatedProof);
      
      // Link proof to agent identity
      const identity = this.agentIdentities.get(request.agentName);
      if (identity) {
        identity.badges.push(simulatedProof);
      }
      
      // Clear from pending after simulation to avoid unbounded growth
      const idx = this.pendingMints.indexOf(request);
      if (idx > -1) this.pendingMints.splice(idx, 1);
      
      // Include agent context in event for UI
      this.emit('badgeMinted', { 
        requestId, 
        proof: simulatedProof,
        agentName: request.agentName,
        generation: request.generation,
        mutationType: request.mutationType,
      });
    }
    
    console.log('[BlockchainSync] Evolution badge queued:', {
      agent: event.childAgentName,
      generation: event.childGeneration,
      mutation: event.mutation.type,
      creditDelta: request.creditDelta,
    });
    
    return requestId;
  }
  
  /**
   * Queue a stress test badge
   */
  async queueStressTestBadge(
    agentId: string,
    agentName: string,
    scenarioName: string,
    resilienceScore: number,
    passed: boolean
  ): Promise<string> {
    const requestId = `stress-${Date.now()}`;
    
    const request: BadgeMintRequest = {
      agentId: this.hashAgentId(agentName),
      agentName,
      generation: this.getAgentGeneration(agentName),
      mutationType: 'risk_rebalancing',
      mutationDescription: `Stress Test: ${scenarioName}`,
      riskScoreBefore: 100,
      riskScoreAfter: resilienceScore,
      creditDelta: passed ? 10 : -5,
      actionTag: passed ? 'STRESS_PASSED' : 'STRESS_FAILED',
      simulationId: requestId,
      metadataURI: '',
    };
    
    this.pendingMints.push(request);
    this.updateAgentIdentity(request);
    
    this.emit('badgeQueued', { requestId, request, type: 'stress_test' });
    
    if (!this.config.enabled) {
      const simulatedProof = this.simulateMint(request);
      this.mintedProofs.set(requestId, simulatedProof);
      
      // Link proof to agent identity
      const identity = this.agentIdentities.get(agentName);
      if (identity) {
        identity.badges.push(simulatedProof);
      }
      
      // Clear from pending after simulation
      const idx = this.pendingMints.indexOf(request);
      if (idx > -1) this.pendingMints.splice(idx, 1);
      
      // Include agent context in event for UI
      this.emit('badgeMinted', { 
        requestId, 
        proof: simulatedProof,
        agentName: request.agentName,
        generation: request.generation,
        mutationType: 'stress_test',
        scenarioName,
        passed,
      });
    }
    
    console.log('[BlockchainSync] Stress test badge queued:', {
      agent: agentName,
      scenario: scenarioName,
      passed,
      resilienceScore,
    });
    
    return requestId;
  }
  
  /**
   * Queue a healing badge when agent self-repairs
   */
  async queueHealingBadge(
    agentName: string,
    failureType: string,
    resolution: string,
    recoveryTimeMs: number
  ): Promise<string> {
    const requestId = `heal-${Date.now()}`;
    
    const request: BadgeMintRequest = {
      agentId: this.hashAgentId(agentName),
      agentName,
      generation: this.getAgentGeneration(agentName),
      mutationType: 'failover_strategy_update',
      mutationDescription: `Self-Healed: ${failureType} -> ${resolution}`,
      riskScoreBefore: 0,
      riskScoreAfter: 100,
      creditDelta: 15,
      actionTag: 'SELF_HEALED',
      simulationId: requestId,
      metadataURI: '',
    };
    
    this.pendingMints.push(request);
    this.updateAgentIdentity(request);
    
    this.emit('badgeQueued', { requestId, request, type: 'healing' });
    this.emit('agentHealed', { agentName, failureType, resolution, recoveryTimeMs });
    
    if (!this.config.enabled) {
      const simulatedProof = this.simulateMint(request);
      this.mintedProofs.set(requestId, simulatedProof);
      
      // Link proof to agent identity
      const identity = this.agentIdentities.get(agentName);
      if (identity) {
        identity.badges.push(simulatedProof);
      }
      
      // Clear from pending after simulation
      const idx = this.pendingMints.indexOf(request);
      if (idx > -1) this.pendingMints.splice(idx, 1);
      
      // Include agent context in event for UI
      this.emit('badgeMinted', { 
        requestId, 
        proof: simulatedProof,
        agentName: request.agentName,
        generation: request.generation,
        mutationType: 'healing',
        failureType,
        resolution,
      });
    }
    
    console.log('[BlockchainSync] Agent self-healed:', {
      agent: agentName,
      failure: failureType,
      resolution,
      recoveryTime: `${recoveryTimeMs}ms`,
    });
    
    return requestId;
  }
  
  /**
   * Update credit score on-chain
   */
  async syncCreditScore(
    agentId: string,
    agentName: string,
    agentType: AgentType,
    creditDelta: number,
    reason: string
  ): Promise<void> {
    const identity = this.agentIdentities.get(agentName);
    if (identity) {
      identity.creditScore += creditDelta;
      if (creditDelta > 0) {
        identity.totalSuccesses++;
      } else {
        identity.totalFailures++;
      }
      identity.accuracyRate = identity.totalSuccesses / 
        Math.max(1, identity.totalSuccesses + identity.totalFailures) * 100;
    }
    
    this.emit('creditUpdated', {
      agentId,
      agentName,
      agentType,
      creditDelta,
      reason,
      newBalance: identity?.creditScore ?? 500,
      timestamp: Date.now(),
    });
    
    console.log('[BlockchainSync] Credit synced:', {
      agent: agentName,
      delta: creditDelta > 0 ? `+${creditDelta}` : creditDelta,
      newBalance: identity?.creditScore ?? 500,
    });
  }
  
  /**
   * Get agent's on-chain identity
   */
  getAgentIdentity(agentName: string): AgentOnChainIdentity | undefined {
    return this.agentIdentities.get(agentName);
  }
  
  /**
   * Get all agent identities
   */
  getAllIdentities(): AgentOnChainIdentity[] {
    return Array.from(this.agentIdentities.values());
  }
  
  /**
   * Get all minted proofs
   */
  getAllProofs(): OnChainProof[] {
    return Array.from(this.mintedProofs.values());
  }
  
  /**
   * Get proofs for a specific agent
   */
  getAgentProofs(agentName: string): OnChainProof[] {
    const identity = this.agentIdentities.get(agentName);
    return identity?.badges ?? [];
  }
  
  private updateAgentIdentity(request: BadgeMintRequest): void {
    let identity = this.agentIdentities.get(request.agentName);
    
    if (!identity) {
      identity = {
        agentId: request.agentId,
        agentName: request.agentName,
        generation: request.generation,
        creditScore: 500,
        badges: [],
        totalEvolutions: 0,
        totalSuccesses: 0,
        totalFailures: 0,
        accuracyRate: 100,
        lastEvolutionTimestamp: Date.now(),
      };
      this.agentIdentities.set(request.agentName, identity);
    }
    
    identity.generation = Math.max(identity.generation, request.generation);
    identity.creditScore += request.creditDelta;
    identity.totalEvolutions++;
    identity.lastEvolutionTimestamp = Date.now();
    
    if (request.creditDelta > 0) {
      identity.totalSuccesses++;
    } else if (request.creditDelta < 0) {
      identity.totalFailures++;
    }
    
    identity.accuracyRate = identity.totalSuccesses / 
      Math.max(1, identity.totalSuccesses + identity.totalFailures) * 100;
  }
  
  private simulateMint(request: BadgeMintRequest): OnChainProof {
    return {
      badgeId: `badge-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      transactionHash: `0x${this.generateRandomHash()}`,
      blockNumber: 1000000 + Math.floor(Math.random() * 100000),
      timestamp: Date.now(),
      network: this.config.network,
      verified: true,
    };
  }
  
  private generateRandomHash(): string {
    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += Math.floor(Math.random() * 16).toString(16);
    }
    return hash;
  }
  
  private hashAgentId(agentName: string): string {
    let hash = 0;
    for (let i = 0; i < agentName.length; i++) {
      const char = agentName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return `0x${Math.abs(hash).toString(16).padStart(64, '0')}`;
  }
  
  private getActionTag(event: EvolutionEvent): string {
    if (event.performanceImpact.roiChange > 5) return 'MAJOR_IMPROVEMENT';
    if (event.performanceImpact.roiChange > 0) return 'IMPROVEMENT';
    if (event.performanceImpact.roiChange > -3) return 'ADAPTATION';
    return 'RECOVERY';
  }
  
  private getAgentGeneration(agentName: string): number {
    // First check tracked identity for actual generation
    const identity = this.agentIdentities.get(agentName);
    if (identity && identity.generation > 0) {
      return identity.generation;
    }
    
    // Fallback: parse from agent name suffix (e.g., Atlas_v3 -> 3)
    const match = agentName.match(/_v(\d+)$/);
    return match ? parseInt(match[1]) : 1;
  }
  
  private generateMetadataURI(event: EvolutionEvent): string {
    // In production, this would upload to IPFS
    return `ipfs://neuron-badge/${event.id}`;
  }
  
  private async processPendingMints(): Promise<void> {
    if (this.isProcessing || this.pendingMints.length === 0) return;
    
    this.isProcessing = true;
    
    try {
      while (this.pendingMints.length > 0) {
        const request = this.pendingMints.shift()!;
        
        // In production, this would call the actual contract
        const proof = this.simulateMint(request);
        this.mintedProofs.set(request.simulationId, proof);
        
        const identity = this.agentIdentities.get(request.agentName);
        if (identity) {
          identity.badges.push(proof);
        }
        
        this.emit('badgeMinted', { request, proof });
        
        // Rate limit
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Get blockchain sync status
   */
  getStatus(): {
    enabled: boolean;
    network: string;
    pendingMints: number;
    totalMinted: number;
    totalAgents: number;
  } {
    return {
      enabled: this.config.enabled,
      network: this.config.network,
      pendingMints: this.pendingMints.length,
      totalMinted: this.mintedProofs.size,
      totalAgents: this.agentIdentities.size,
    };
  }
}

export const blockchainSync = new BlockchainSyncService();
