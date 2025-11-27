import { EventEmitter } from 'events';

export interface IQStakingPosition {
  walletAddress: string;
  stakedAmount: string;
  lockEndTime: number;
  votingPower: string;
  pendingRewards: string;
  lastClaimTime: number;
}

export interface IQAirdropClaim {
  id: string;
  walletAddress: string;
  amount: string;
  reason: string;
  status: 'pending' | 'claimed' | 'expired';
  expiresAt: number;
  claimedAt?: number;
  txHash?: string;
}

export interface IQTokenMetrics {
  totalSupply: string;
  circulatingSupply: string;
  totalStaked: string;
  stakersCount: number;
  dailyEmission: string;
  burnedToday: string;
  price: number;
  marketCap: number;
}

const IQ_TOKEN_ADDRESS = '0x579cea1889991f68acc35ff5c3dd0621ff29b0c9';
const HIIQ_STAKING_ADDRESS = '0x1bf5457ecaa14ff63cc89efd560e251e814e16ba';

export class IQTokenService extends EventEmitter {
  private stakingPositions: Map<string, IQStakingPosition> = new Map();
  private airdropClaims: Map<string, IQAirdropClaim[]> = new Map();
  private metrics: IQTokenMetrics;

  constructor() {
    super();
    
    this.metrics = {
      totalSupply: '21000000000',
      circulatingSupply: '10500000000',
      totalStaked: '2100000000',
      stakersCount: 15000,
      dailyEmission: '3000000',
      burnedToday: '500000',
      price: 0.0045,
      marketCap: 47250000,
    };

    console.log('[IQ] Token service initialized');
  }

  public async getStakingPosition(walletAddress: string): Promise<IQStakingPosition | null> {
    return this.stakingPositions.get(walletAddress) || null;
  }

  public async createStakingPosition(
    walletAddress: string,
    amount: string,
    lockDays: number
  ): Promise<IQStakingPosition> {
    const lockEndTime = Date.now() + (lockDays * 24 * 60 * 60 * 1000);
    
    const votingPower = this.calculateVotingPower(amount, lockDays);

    const position: IQStakingPosition = {
      walletAddress,
      stakedAmount: amount,
      lockEndTime,
      votingPower,
      pendingRewards: '0',
      lastClaimTime: Date.now(),
    };

    this.stakingPositions.set(walletAddress, position);
    this.emit('staked', position);
    console.log(`[IQ] Staking position created for ${walletAddress}: ${amount} IQ`);

    return position;
  }

  public async unstake(walletAddress: string): Promise<{ amount: string; rewards: string }> {
    const position = this.stakingPositions.get(walletAddress);
    if (!position) {
      throw new Error('No staking position found');
    }

    if (Date.now() < position.lockEndTime) {
      throw new Error('Lock period not ended');
    }

    const rewards = position.pendingRewards;
    const amount = position.stakedAmount;

    this.stakingPositions.delete(walletAddress);
    this.emit('unstaked', { walletAddress, amount, rewards });

    return { amount, rewards };
  }

  public async claimRewards(walletAddress: string): Promise<string> {
    const position = this.stakingPositions.get(walletAddress);
    if (!position) {
      throw new Error('No staking position found');
    }

    const rewards = this.calculatePendingRewards(position);
    position.pendingRewards = '0';
    position.lastClaimTime = Date.now();
    this.stakingPositions.set(walletAddress, position);

    this.emit('rewardsClaimed', { walletAddress, rewards });
    return rewards;
  }

  public async createAirdrop(
    walletAddress: string,
    amount: string,
    reason: string,
    expiresInDays: number = 30
  ): Promise<IQAirdropClaim> {
    const claim: IQAirdropClaim = {
      id: `airdrop-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      walletAddress,
      amount,
      reason,
      status: 'pending',
      expiresAt: Date.now() + (expiresInDays * 24 * 60 * 60 * 1000),
    };

    const claims = this.airdropClaims.get(walletAddress) || [];
    claims.push(claim);
    this.airdropClaims.set(walletAddress, claims);

    this.emit('airdropCreated', claim);
    console.log(`[IQ] Airdrop created for ${walletAddress}: ${amount} IQ`);

    return claim;
  }

  public async claimAirdrop(walletAddress: string, claimId: string): Promise<IQAirdropClaim> {
    const claims = this.airdropClaims.get(walletAddress);
    if (!claims) {
      throw new Error('No airdrops found for wallet');
    }

    const claim = claims.find(c => c.id === claimId);
    if (!claim) {
      throw new Error('Airdrop claim not found');
    }

    if (claim.status !== 'pending') {
      throw new Error(`Airdrop already ${claim.status}`);
    }

    if (Date.now() > claim.expiresAt) {
      claim.status = 'expired';
      throw new Error('Airdrop expired');
    }

    claim.status = 'claimed';
    claim.claimedAt = Date.now();
    claim.txHash = `0x${Math.random().toString(16).substring(2, 66)}`;

    this.emit('airdropClaimed', claim);
    return claim;
  }

  public async getAirdrops(walletAddress: string): Promise<IQAirdropClaim[]> {
    return this.airdropClaims.get(walletAddress) || [];
  }

  public async getPendingAirdrops(walletAddress: string): Promise<IQAirdropClaim[]> {
    const claims = this.airdropClaims.get(walletAddress) || [];
    return claims.filter(c => c.status === 'pending' && Date.now() < c.expiresAt);
  }

  public async createAgentParticipationAirdrop(
    walletAddress: string,
    agentId: string,
    participationType: 'staking' | 'governance' | 'usage'
  ): Promise<IQAirdropClaim> {
    const amounts: Record<string, string> = {
      staking: '1000',
      governance: '500',
      usage: '100',
    };

    const reasons: Record<string, string> = {
      staking: `Staking participation bonus for agent ${agentId}`,
      governance: `Governance voting reward for agent ${agentId}`,
      usage: `Agent usage reward for ${agentId}`,
    };

    return this.createAirdrop(
      walletAddress,
      amounts[participationType],
      reasons[participationType]
    );
  }

  public getMetrics(): IQTokenMetrics {
    return { ...this.metrics };
  }

  public getContracts(): { iqToken: string; hiiqStaking: string } {
    return {
      iqToken: IQ_TOKEN_ADDRESS,
      hiiqStaking: HIIQ_STAKING_ADDRESS,
    };
  }

  private calculateVotingPower(amount: string, lockDays: number): string {
    const amountNum = parseFloat(amount);
    const maxMultiplier = 4;
    const maxLockDays = 365 * 4;
    
    const multiplier = 1 + (maxMultiplier - 1) * (lockDays / maxLockDays);
    const votingPower = amountNum * multiplier;
    
    return votingPower.toFixed(2);
  }

  private calculatePendingRewards(position: IQStakingPosition): string {
    const daysSinceLastClaim = (Date.now() - position.lastClaimTime) / (24 * 60 * 60 * 1000);
    const dailyRewardRate = 0.001;
    const stakedAmount = parseFloat(position.stakedAmount);
    
    const rewards = stakedAmount * dailyRewardRate * daysSinceLastClaim;
    return rewards.toFixed(2);
  }

  public getStatus(): {
    totalStakers: number;
    totalAirdrops: number;
    pendingAirdrops: number;
  } {
    let pendingAirdrops = 0;
    let totalAirdrops = 0;

    this.airdropClaims.forEach(claims => {
      totalAirdrops += claims.length;
      pendingAirdrops += claims.filter(c => c.status === 'pending').length;
    });

    return {
      totalStakers: this.stakingPositions.size,
      totalAirdrops,
      pendingAirdrops,
    };
  }
}

export const iqTokenService = new IQTokenService();
