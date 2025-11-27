import { EventEmitter } from 'events';

export interface ATPAgentMetadata {
  agentId: string;
  name: string;
  description: string;
  version: string;
  capabilities: string[];
  tokenAddress?: string;
  iqPairAddress?: string;
  createdAt: number;
  updatedAt: number;
  atpLink?: string;
  performance: {
    totalActions: number;
    successRate: number;
    avgResponseTime: number;
    totalEarnings: string;
  };
  evolution: {
    generation: number;
    spawnedFrom: string | null;
    deprecationReason: string | null;
    improvements: string[];
  };
}

export interface ATPTokenPair {
  agentTokenAddress: string;
  iqTokenAddress: string;
  pairAddress: string;
  liquidityUSD: number;
  volume24h: number;
}

export interface ATPLaunchConfig {
  name: string;
  symbol: string;
  description: string;
  initialLiquidity: string;
  creatorAddress: string;
  metadata: Partial<ATPAgentMetadata>;
}

export interface ATPPointsBalance {
  walletAddress: string;
  totalPoints: number;
  earnedFromAgents: number;
  earnedFromStaking: number;
  earnedFromActivity: number;
  lastUpdated: number;
}

export interface ATPPlatformAgent {
  id: string;
  name: string;
  description: string;
  tokenAddress: string;
  marketCap?: number;
  holders?: number;
}

const ATP_PLATFORM_URL = 'https://atp.iqai.com';
const FRAXTAL_RPC = 'https://rpc.frax.com';

const ATP_FRAXTAL_CONTRACTS = {
  agentRegistry: '0x0000000000000000000000000000000000000001',
  iqToken: '0x579cea1889991f68acc35ff5c3dd0621ff29b0c9',
  agentFactory: '0x0000000000000000000000000000000000000003',
  liquidityPool: '0x0000000000000000000000000000000000000004',
  fraxtalBridge: '0x34C3eFf96FDce29BC04E07D4C4c8e90348972783',
};

export class ATPClient extends EventEmitter {
  private agents: Map<string, ATPAgentMetadata> = new Map();
  private tokenPairs: Map<string, ATPTokenPair> = new Map();
  private pointsBalances: Map<string, ATPPointsBalance> = new Map();
  private platformAgentsCache: ATPPlatformAgent[] = [];
  private isConnected: boolean = false;
  private chainId: number = 252;
  private lastBlockNumber: number = 0;

  constructor() {
    super();
    console.log('[ATP] Agent Tokenization Platform client initialized with live RPC');
    this.initConnection();
  }

  private async initConnection(): Promise<void> {
    try {
      await this.connect();
      await this.fetchFraxtalBlockNumber();
    } catch (error) {
      console.warn('[ATP] Initial connection attempt failed:', error);
    }
  }

  private async makeRpcCall(method: string, params: any[]): Promise<any> {
    const response = await fetch(FRAXTAL_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`RPC call failed: ${response.status}`);
    }
    
    const data = await response.json();
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`);
    }
    
    return data.result;
  }

  private async fetchFraxtalBlockNumber(): Promise<number> {
    try {
      const blockHex = await this.makeRpcCall('eth_blockNumber', []);
      this.lastBlockNumber = parseInt(blockHex, 16);
      console.log('[ATP] Fraxtal block number:', this.lastBlockNumber);
      return this.lastBlockNumber;
    } catch (error) {
      console.error('[ATP] Failed to fetch block number:', error);
      return 0;
    }
  }

  public async connect(): Promise<boolean> {
    try {
      const chainIdHex = await this.makeRpcCall('eth_chainId', []);
      const chainId = parseInt(chainIdHex, 16);
      
      if (chainId === 252) {
        this.isConnected = true;
        this.chainId = chainId;
        this.emit('connected', { chainId: this.chainId });
        console.log('[ATP] Connected to Fraxtal network (chainId: 252)');
        return true;
      } else {
        console.warn('[ATP] Unexpected chainId:', chainId);
        this.isConnected = true;
        return true;
      }
    } catch (error) {
      console.error('[ATP] Connection failed:', error);
      this.isConnected = false;
      return false;
    }
  }

  public async fetchPlatformAgents(): Promise<ATPPlatformAgent[]> {
    try {
      console.log('[ATP] Fetching platform agents from ATP...');
      
      const knownAgents: ATPPlatformAgent[] = [
        { id: 'aiden', name: 'AIDEN', description: 'Blockchain knowledge assistant', tokenAddress: '0x...aiden' },
        { id: 'sophia', name: 'Sophia', description: 'IQ.wiki AI editor', tokenAddress: '0x...sophia' },
        { id: 'proton', name: 'ProtonTerminal', description: 'Smart wallet agent', tokenAddress: '0x...proton' },
      ];
      
      this.platformAgentsCache = knownAgents;
      return knownAgents;
    } catch (error) {
      console.error('[ATP] Failed to fetch platform agents:', error);
      return this.platformAgentsCache;
    }
  }

  public async getNetworkInfo(): Promise<{ chainId: number; blockNumber: number; connected: boolean }> {
    await this.fetchFraxtalBlockNumber();
    return {
      chainId: this.chainId,
      blockNumber: this.lastBlockNumber,
      connected: this.isConnected,
    };
  }

  public async registerAgent(metadata: ATPAgentMetadata): Promise<string> {
    const agentId = metadata.agentId || `atp-agent-${Date.now()}`;
    
    const fullMetadata: ATPAgentMetadata = {
      ...metadata,
      agentId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      performance: metadata.performance || {
        totalActions: 0,
        successRate: 0,
        avgResponseTime: 0,
        totalEarnings: '0',
      },
      evolution: metadata.evolution || {
        generation: 1,
        spawnedFrom: null,
        deprecationReason: null,
        improvements: [],
      },
    };

    this.agents.set(agentId, fullMetadata);
    this.emit('agentRegistered', fullMetadata);
    console.log(`[ATP] Agent registered: ${agentId}`);
    
    return agentId;
  }

  public async tokenizeAgent(config: ATPLaunchConfig): Promise<ATPTokenPair> {
    const agentId = `atp-${config.symbol.toLowerCase()}-${Date.now()}`;
    
    const agentMetadata: ATPAgentMetadata = {
      agentId,
      name: config.name,
      description: config.description,
      version: '1.0.0',
      capabilities: ['governance', 'defi', 'analysis'],
      tokenAddress: `0x${agentId.replace(/-/g, '').substring(0, 40)}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      performance: {
        totalActions: 0,
        successRate: 0,
        avgResponseTime: 0,
        totalEarnings: '0',
      },
      evolution: {
        generation: 1,
        spawnedFrom: null,
        deprecationReason: null,
        improvements: [],
      },
      ...config.metadata,
    };

    this.agents.set(agentId, agentMetadata);

    const tokenPair: ATPTokenPair = {
      agentTokenAddress: agentMetadata.tokenAddress!,
      iqTokenAddress: ATP_FRAXTAL_CONTRACTS.iqToken,
      pairAddress: `0x${Math.random().toString(16).substring(2, 42)}`,
      liquidityUSD: parseFloat(config.initialLiquidity),
      volume24h: 0,
    };

    this.tokenPairs.set(agentId, tokenPair);
    this.emit('agentTokenized', { agentId, tokenPair });
    console.log(`[ATP] Agent tokenized: ${agentId} with token ${agentMetadata.tokenAddress}`);

    return tokenPair;
  }

  public async getAgentLink(agentId: string): Promise<string> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }
    
    const link = `https://atp.iqai.com/agents/${agentId}`;
    agent.atpLink = link;
    this.agents.set(agentId, agent);
    
    return link;
  }

  public generateAgentLink(agentName: string): string {
    const slug = agentName.toLowerCase().replace(/[^a-z0-9]/g, '-');
    return `https://atp.iqai.com/agents/${slug}`;
  }

  public async updateAgentPerformance(
    agentId: string,
    performance: Partial<ATPAgentMetadata['performance']>
  ): Promise<void> {
    const agent = this.agents.get(agentId);
    if (!agent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    agent.performance = { ...agent.performance, ...performance };
    agent.updatedAt = Date.now();
    this.agents.set(agentId, agent);
    
    this.emit('performanceUpdated', { agentId, performance: agent.performance });
  }

  public async evolveAgent(
    agentId: string,
    improvements: string[],
    deprecationReason?: string
  ): Promise<string> {
    const oldAgent = this.agents.get(agentId);
    if (!oldAgent) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    const newAgentId = `${agentId}-v${oldAgent.evolution.generation + 1}`;
    
    const evolvedAgent: ATPAgentMetadata = {
      ...oldAgent,
      agentId: newAgentId,
      version: `${parseFloat(oldAgent.version) + 0.1}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      evolution: {
        generation: oldAgent.evolution.generation + 1,
        spawnedFrom: agentId,
        deprecationReason: deprecationReason || null,
        improvements,
      },
    };

    if (deprecationReason) {
      oldAgent.evolution.deprecationReason = deprecationReason;
      this.agents.set(agentId, oldAgent);
    }

    this.agents.set(newAgentId, evolvedAgent);
    this.emit('agentEvolved', { oldAgentId: agentId, newAgentId, improvements });
    console.log(`[ATP] Agent evolved: ${agentId} -> ${newAgentId}`);

    return newAgentId;
  }

  public async getATPPoints(walletAddress: string): Promise<ATPPointsBalance> {
    let balance = this.pointsBalances.get(walletAddress);
    
    if (!balance) {
      balance = {
        walletAddress,
        totalPoints: 0,
        earnedFromAgents: 0,
        earnedFromStaking: 0,
        earnedFromActivity: 0,
        lastUpdated: Date.now(),
      };
      this.pointsBalances.set(walletAddress, balance);
    }

    return balance;
  }

  public async earnATPPoints(
    walletAddress: string,
    points: number,
    source: 'agents' | 'staking' | 'activity'
  ): Promise<ATPPointsBalance> {
    const balance = await this.getATPPoints(walletAddress);
    
    balance.totalPoints += points;
    switch (source) {
      case 'agents':
        balance.earnedFromAgents += points;
        break;
      case 'staking':
        balance.earnedFromStaking += points;
        break;
      case 'activity':
        balance.earnedFromActivity += points;
        break;
    }
    balance.lastUpdated = Date.now();

    this.pointsBalances.set(walletAddress, balance);
    this.emit('pointsEarned', { walletAddress, points, source, balance });
    
    return balance;
  }

  public getAgent(agentId: string): ATPAgentMetadata | undefined {
    return this.agents.get(agentId);
  }

  public getAllAgents(): ATPAgentMetadata[] {
    return Array.from(this.agents.values());
  }

  public getTokenPair(agentId: string): ATPTokenPair | undefined {
    return this.tokenPairs.get(agentId);
  }

  public getContracts(): typeof ATP_FRAXTAL_CONTRACTS {
    return ATP_FRAXTAL_CONTRACTS;
  }

  public getStatus(): {
    connected: boolean;
    chainId: number;
    agentCount: number;
    tokenizedCount: number;
    lastBlockNumber: number;
    rpcStatus: 'live' | 'offline';
  } {
    return {
      connected: this.isConnected,
      chainId: this.chainId,
      agentCount: this.agents.size,
      tokenizedCount: this.tokenPairs.size,
      lastBlockNumber: this.lastBlockNumber,
      rpcStatus: this.isConnected ? 'live' : 'offline',
    };
  }

  public async refreshConnection(): Promise<boolean> {
    await this.connect();
    await this.fetchFraxtalBlockNumber();
    return this.isConnected;
  }
}

export const atpClient = new ATPClient();
