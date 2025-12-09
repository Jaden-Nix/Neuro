# NeuroNet Governor

## What is NeuroNet Governor?

NeuroNet Governor is an **autonomous multi-agent AI system** designed for DeFi protocol governance and execution. Unlike traditional trading bots that follow rigid rules, NeuroNet uses a team of specialized AI agents that communicate, debate, and make collective decisions about market opportunities - just like a team of expert traders working together.

The system operates 24/7, scanning cryptocurrency markets, evaluating risks, and executing on-chain transactions without human intervention. It learns from its successes and failures, evolving its strategies over time through a built-in self-improvement mechanism.

---

## ADK-TS Integration (IQ.ai Agent Development Kit)

### How We Used ADK-TS for This Hackathon

NeuroNet Governor is built on top of **@iqai/adk (ADK-TS)** - the Agent Development Kit from IQ.ai. This TypeScript SDK provides the foundation for our multi-agent system, enabling sophisticated AI agent orchestration and inter-agent communication.

### ADK-TS Implementation Details

We implemented ADK-TS across three core integration layers:

#### 1. RealADKAgent (`server/adk/RealADKAgent.ts`)

The primary ADK-TS integration using the `AgentBuilder` pattern from @iqai/adk:

```typescript
import { AgentBuilder } from '@iqai/adk';

// Scout Agent using ADK-TS AgentBuilder
const response = await AgentBuilder
  .withModel('gemini-2.5-flash')  // or 'gpt-4o', 'claude-sonnet-4-5'
  .withInstruction(`You are SCOUT, an elite DeFi opportunity scanner.
    Analyze market data and identify trading opportunities.
    ALWAYS respond with valid JSON containing:
    {
      "action": "BUY" or "SELL" or "HOLD",
      "symbol": "BTC/USD",
      "direction": "long" or "short",
      "confidence": 0-100,
      "entryPrice": number,
      "stopLoss": number,
      "takeProfit1": number,
      "takeProfit2": number,
      "reasoning": "detailed analysis",
      "riskScore": 0-100
    }`)
  .ask(`Analyze this market data for ${symbol}:
    - Current Price: $${currentPrice}
    - 24h Change: ${priceChange24h}%`);
```

**Key Features Used:**
- `AgentBuilder.withModel()` - Dynamic model selection (Gemini, GPT, Claude)
- `AgentBuilder.withInstruction()` - Custom agent personality and behavior
- `AgentBuilder.ask()` - Natural language queries with structured JSON responses
- Multi-provider support with automatic fallback

#### 2. ADKIntegration (`server/adk/ADKIntegration.ts`)

Extended ADK pattern for multi-agent workflows with event-driven architecture:

```typescript
export class ADKIntegration extends EventEmitter {
  // Pre-configured agents with distinct personalities
  private agents: Map<string, ADKAgentConfig> = new Map([
    ['neuronet_scout', { 
      type: AgentType.SCOUT, 
      model: 'gemini-2.5-flash',
      personality: ['curious', 'energetic', 'analytical']
    }],
    ['neuronet_risk', { 
      type: AgentType.RISK, 
      model: 'claude-sonnet-4-5',
      personality: ['cautious', 'formal', 'thorough']
    }],
    ['neuronet_execution', { 
      type: AgentType.EXECUTION, 
      model: 'gemini-2.5-flash',
      personality: ['precise', 'cold', 'efficient']
    }],
    ['neuronet_meta', { 
      type: AgentType.META, 
      model: 'claude-sonnet-4-5',
      personality: ['sovereign', 'calm', 'strategic']
    }]
  ]);

  // Multi-agent workflow execution
  async runMultiAgentWorkflow(input: Record<string, unknown>): Promise<ADKDecision[]> {
    // Scout -> Risk -> Execution -> Meta pipeline
    const scoutDecision = await this.queryAgent('neuronet_scout', 'Analyze market...', input);
    const riskDecision = await this.queryAgent('neuronet_risk', 'Evaluate risk...', { ...input, scoutAnalysis: scoutDecision.data });
    const executionDecision = await this.queryAgent('neuronet_execution', 'Plan execution...', { ...input, riskAssessment: riskDecision.data });
    const metaDecision = await this.queryAgent('neuronet_meta', 'Final decision...', { ...input, allAgentData });
    
    this.emit('workflowCompleted', { decisions: [scoutDecision, riskDecision, executionDecision, metaDecision] });
    return decisions;
  }
}
```

**ADK Patterns Implemented:**
- Event-driven agent communication (`emit('decisionMade', decision)`)
- Agent registry with typed configurations
- Workflow orchestration with data passing between agents
- Confidence scoring and structured decision objects

#### 3. Full ADK Workflow (`runFullWorkflow`)

Complete trading signal generation using ADK-TS:

```typescript
async runFullWorkflow(marketData: MarketData): Promise<WorkflowResult> {
  console.log(`[ADK-TS] Running full workflow for ${marketData.symbol}...`);

  // Step 1: Scout analysis using ADK AgentBuilder
  const signal = await this.scoutAnalysis(marketData);
  console.log(`[ADK-TS] Scout: ${signal.action} ${signal.symbol} @ ${signal.confidence}% confidence`);

  // Step 2: Risk assessment using ADK AgentBuilder
  const riskResult = await this.riskAssessment(signal);
  console.log(`[ADK-TS] Risk: ${riskResult.approved ? 'APPROVED' : 'REJECTED'}`);

  // Step 3: Meta orchestration using ADK AgentBuilder
  const finalDecision = await this.metaOrchestration(signal, riskResult);
  console.log(`[ADK-TS] Meta: ${finalDecision.finalDecision}`);

  return { signal, riskAssessment: riskResult, finalDecision, provider: this.model };
}
```

### Why We Chose ADK-TS

1. **Multi-Model Support**: ADK-TS allows seamless switching between AI providers (Gemini, OpenAI, Claude) with a unified API
2. **AgentBuilder Pattern**: Clean, fluent API for defining agent behavior and instructions
3. **TypeScript Native**: Full type safety for agent configurations and responses
4. **Structured Outputs**: Built-in support for JSON-formatted agent responses
5. **Production Ready**: Reliable error handling and fallback mechanisms

### ADK-TS Agent Configurations

Each of our four agents uses ADK-TS with specific model assignments optimized for their roles:

| Agent | ADK Model | Purpose |
|-------|-----------|---------|
| Scout | `gemini-2.5-flash` | Fast market scanning (speed-optimized) |
| Risk | `claude-sonnet-4-5` | Deep risk analysis (reasoning-optimized) |
| Execution | `gemini-2.5-flash` | Quick transaction planning (speed-optimized) |
| Meta | `claude-sonnet-4-5` | Strategic decisions (reasoning-optimized) |

### ADK-TS Workflow Output

Example output from the ADK-TS multi-agent workflow:

```json
{
  "signal": {
    "action": "BUY",
    "symbol": "ETH/USD",
    "direction": "long",
    "confidence": 78,
    "entryPrice": 3450.00,
    "stopLoss": 3346.50,
    "takeProfit1": 3553.50,
    "takeProfit2": 3657.00,
    "reasoning": "RSI oversold recovery with increasing volume"
  },
  "riskAssessment": {
    "approved": true,
    "adjustedRiskScore": 35,
    "maxPositionSize": "5%",
    "warnings": []
  },
  "finalDecision": {
    "finalDecision": "EXECUTE",
    "confidence": 82,
    "tradingCall": { ... },
    "reasoning": "All agent consensus positive. Risk-adjusted return favorable."
  },
  "provider": "gemini-2.5-flash"
}
```

### Key Innovation: Hybrid ADK Architecture

We extended ADK-TS beyond standard usage by implementing:

1. **Provider Fallback Chain**: If primary AI fails, automatically falls to next provider
2. **Agent-Specific Model Routing**: Different agents use different AI models based on their needs
3. **Intelligent Fallback Decisions**: When AI is unavailable, system generates reasonable defaults based on market data
4. **Event-Driven Communication**: Agents emit events that other system components can subscribe to
5. **Credit-Based Agent Economy**: Agent performance tracked and used for future decision weighting

---

## The Problem We're Solving

### Current DeFi Challenges

1. **Speed Gap**: DeFi markets move at machine speed, but human traders can't monitor opportunities 24/7
2. **Information Overload**: Hundreds of protocols, thousands of pools, and millions of data points make it impossible for individuals to track everything
3. **Risk Blindness**: Most trading systems lack proper risk assessment, leading to devastating losses
4. **Single Point of Failure**: Traditional bots rely on single algorithms that can fail catastrophically
5. **No Learning**: Static systems don't improve from past mistakes

### Our Solution

NeuroNet Governor addresses these challenges through:

- **Multi-Agent Collaboration**: Multiple AI specialists work together, reducing single-point-of-failure risk
- **Continuous Market Scanning**: 24/7 monitoring across multiple exchanges and chains
- **Built-in Risk Management**: Dedicated Risk Agent evaluates every opportunity before execution
- **Self-Evolution**: The system learns from outcomes and improves autonomously
- **On-Chain Transparency**: All decisions and strategies are stored on-chain for full auditability

---

## Core Architecture

### Multi-Agent System

NeuroNet operates through four specialized AI agents, each with distinct personalities and responsibilities:

#### Meta-Agent (The Brain)
The central orchestrator and final decision-maker.

**Responsibilities:**
- Spawns and manages sub-agents
- Negotiates between agents during debates
- Runs final simulations before execution
- Executes on-chain actions
- Maintains the internal credit economy
- Handles self-healing logic when agents underperform
- Writes learned strategies to the Memory Vault

**Personality:** Strategic, balanced, authoritative

#### Scout Agent (The Hunter)
Market intelligence and opportunity detection specialist.

**Responsibilities:**
- Scans liquidity across decentralized exchanges
- Fetches real-time price data from multiple sources
- Detects arbitrage and trading opportunities
- Predicts volatility patterns
- Suggests profitable actions to the team

**Personality:** Curious, energetic, optimistic

**Performance Metrics:**
- Prediction accuracy
- Opportunity value generated
- Signal quality score

#### Risk Agent (The Guardian)
Safety and risk management specialist.

**Responsibilities:**
- Evaluates every Scout proposal for hidden risks
- Blocks high-risk decisions before execution
- Simulates potential loss scenarios
- Predicts liquidation risks for leveraged positions
- Performs safety vetoes when needed
- Assesses MEV (Maximal Extractable Value) exposure

**Personality:** Cautious, formal, protective

**Performance Metrics:**
- False positive rate
- Losses prevented
- Risk assessment accuracy

#### Execution Agent (The Executor)
Transaction creation and on-chain execution specialist.

**Responsibilities:**
- Creates safe, optimized on-chain transactions
- Calculates optimal gas costs
- Executes swaps, rebalances, and loans
- Publishes detailed execution logs
- Emits data for memory storage

**Personality:** Cold, precise, efficient

**Performance Metrics:**
- Transaction success rate
- Gas efficiency
- Execution speed

---

## Decision-Making Flow

### Negotiation Protocol

All decisions follow a structured workflow: **Scout -> Risk -> Execution -> Meta-Agent**

```
1. PROPOSAL PHASE
   Scout identifies opportunity and creates proposal
   Example: "ETH appears undervalued by 3% on Uniswap vs Binance"

2. RISK ASSESSMENT  
   Risk Agent evaluates and scores the proposal
   Checks: Slippage, liquidity depth, MEV risk, market conditions

3. EXECUTION PLANNING
   Execution Agent plans transaction details
   Calculates: Gas costs, optimal route, timing

4. META DECISION
   Meta-Agent weighs all inputs and makes final decision
   Runs simulation, checks historical patterns, decides go/no-go
```

### Scoring System

Final decision score is calculated using weighted inputs:

```
Final Score = (Scout Confidence x 0.3) + 
              (Risk Safety Score x 0.4) + 
              (Execution Feasibility x 0.2) + 
              (Expected Return x 0.1)
```

Risk carries the highest weight (40%) to prioritize capital preservation.

---

## Key Features

### 1. Internal Credit Economy

Agents operate within an internal economy where performance affects their influence:

- **Scout**: Earns credits on accurate predictions, loses on bad calls
- **Risk**: Earns on correct vetoes, loses on false positives that block profitable trades
- **Execution**: Earns on successful transactions, loses on failed executions
- **Meta-Agent**: Redistributes credits based on overall system performance

High-performing agents gain more decision weight. Underperforming agents are eventually deprecated and replaced.

### 2. Future Fork Simulation

Before any action, the system simulates multiple future scenarios:

- **Price Movements**: Where might the price go?
- **Volatility Levels**: How turbulent will markets be?
- **TVL Changes**: Will liquidity shift?
- **Yield Fluctuations**: How will APY change?
- **Peg Deviations**: Will stablecoins hold their peg?

Expected Value (EV) is calculated across all scenarios:
```
EV = Sum(probability_i x outcome_i) - risk_penalty
```

### 3. Self-Healing Engine

The system automatically identifies and replaces underperforming agents.

**Deprecation Triggers:**
- Credit score falls below threshold (< 100 credits)
- Accuracy rate drops below 60%
- Failed actions exceed 50% of total
- No improvement over 30-day period

**Evolution Process:**
1. Detect underperforming agent
2. Log deprecation reason
3. Spawn new version with adjusted parameters
4. Migrate memory and context to new agent
5. Update on-chain metadata (ATP)
6. Archive old version for analysis

### 4. On-Chain Memory Vault

All learned strategies and patterns are stored permanently on-chain through smart contracts:

**Storage Categories:**
- **Successful Strategies**: Profitable patterns to repeat
- **Blocked Strategies**: High-risk actions to avoid
- **Risk Patterns**: Identified danger signals
- **Price Anomalies**: Market inefficiencies discovered
- **Learning Milestones**: System improvement markers

This creates an immutable audit trail and allows the system to "remember" across restarts.

### 5. Sentinel Mode (24/7 Monitoring)

Continuous monitoring for on-chain anomalies:

| Target | What We Watch |
|--------|---------------|
| Wallet Health | Balance thresholds, diversification |
| Liquidity Changes | Pool depth, slippage risk |
| Peg Deviations | Stablecoin stability (USDC, USDT, etc.) |
| Volatility Spikes | Sudden price movements |
| Oracle Anomalies | Price feed discrepancies |
| Pool Drains | Rapid liquidity exits (potential rug pulls) |
| Liquidation Risks | Collateral ratios approaching danger |

**Alert Levels:**
- **Low**: Informational, logged only
- **Medium**: Warning, increase monitoring frequency
- **High**: Requires attention, pause risky operations
- **Critical**: Immediate action, potential auto-execution of safety measures

### 6. Replay Engine

Complete decision history with timeline visualization for full transparency:

- Every decision, simulation, and execution is logged
- Event type classification (decision, simulation, negotiation, execution, alert)
- Agent attribution for accountability
- Full data payload for debugging
- Filter by agent, event type, or time range

### 7. Price Validation (Double Verification)

To prevent "hallucinated" prices from AI models:

- 5% tolerance threshold on all prices
- Re-fetches live price from multiple sources before saving signals
- Cross-validates against CCXT exchange data
- Rejects signals with price discrepancies

---

## Smart Contracts

NeuroNet Governor includes seven Solidity smart contracts deployed on Ethereum testnets:

### Deployed Contracts

**Sepolia Testnet (Chain ID: 11155111):**
| Contract | Address | Purpose |
|----------|---------|---------|
| NeuroNetRegistry | `0xc4f97d52334f0de35fec958f24fc5af9c450f8dc` | Agent registration & tracking |
| NeuroNetStorage | `0x7c2e91efeec7bf481a61a654f36fe6452ca16a07` | Persistent data storage |
| NeuroNetHeartbeat | `0x7ab69aa7543e9ae43b5d01c5622868392252eaad` | System liveness proofs |

**Base Sepolia Testnet (Chain ID: 84532):**
| Contract | Address | Purpose |
|----------|---------|---------|
| MemoryVault | `0x12b67629cd47f3703dca82b3bec7e576b3a0fb8f` | Strategy & pattern storage |
| NeuronBadge | `0xb3d0b4aba1d5a482df702edf87dea8b146321d3b` | Evolution proof NFTs (soulbound) |

### Contract Descriptions

1. **AgentNFT**: Mintable and rentable agent tokens - each agent can be represented as an NFT for marketplace trading
2. **AgentRegistry**: On-chain agent registration with credit score tracking
3. **MemoryVault**: Persistent strategy storage with versioning and access control
4. **NeuronBadge**: Soulbound NFTs that prove agent evolution milestones
5. **NeuroNetHeartbeat**: System liveness checkpoints proving the network is active

All contracts use OpenZeppelin base contracts (ERC721, Ownable, ReentrancyGuard) for security.

---

## Technology Stack

### Frontend
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with custom optimizations
- **UI Components**: shadcn/ui (Radix primitives) with Tailwind CSS
- **State Management**: TanStack React Query for server state
- **Web3 Integration**: RainbowKit + wagmi + viem
- **Routing**: wouter (lightweight router)
- **Animations**: Framer Motion for cinematic UI effects

### Backend
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: REST endpoints + WebSocket for real-time updates
- **Build**: esbuild for production bundling

### AI Integration
**Hybrid AI Approach** with automatic fallback:
- **Anthropic Claude (claude-sonnet-4-5)**: Complex reasoning and strategic decisions
- **Google Gemini (gemini-2.5-flash)**: Fast market analysis and opportunity scanning
- **OpenAI GPT**: Additional reasoning layer

**Built-in Protections:**
- Rate limiting per provider
- Circuit breakers to prevent API overload
- Provider-specific routing (different agents can use different AI providers)
- Cost mode optimization (BALANCED mode: ~$4-5/day)

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Provider**: Neon Serverless PostgreSQL
- **Schema**: Agents, logs, credit scores, simulations, alerts, marketplace listings

### Blockchain
- **Networks**: Ethereum Sepolia, Base Sepolia (testnets), with mainnet ready
- **Client**: viem for type-safe blockchain interactions
- **Wallet**: RainbowKit for user connections
- **Contracts**: OpenZeppelin base contracts for security

### Market Data
- **CCXT**: Cryptocurrency exchange integration for real-time price feeds
- **Custom Providers**: CoinGecko, CryptoCompare, DefiLlama fallbacks
- **Live Price Service**: Multi-source price validation

---

## AI Cycle Frequencies

The system runs continuous autonomous cycles optimized for cost and performance:

| Cycle | Interval | Purpose |
|-------|----------|---------|
| Hunting | 10 min | Find new trading opportunities |
| Debates | 20 min | Agent validation of signals |
| Market Insights | 20 min | Analyze market conditions |
| Knowledge Sharing | 40 min | Cross-agent learning |
| Evolution | 60 min | Strategy improvements |
| Birth Checks | 120 min | New agent spawning evaluation |

---

## Security Architecture

1. **Agent Isolation**: Each agent runs in isolated context with limited capabilities
2. **Permission System**: Agents have role-based access to actions
3. **Rate Limiting**: Prevents excessive on-chain calls and API abuse
4. **Signature Verification**: All transactions require wallet approval
5. **Fallback Mechanisms**: Automatic shutdown on critical errors
6. **Audit Logging**: Complete action history stored on-chain
7. **Circuit Breakers**: Automatic halt when anomalies detected

---

## Data Flow Diagram

```
User Input / Market Data
         |
         v
    Meta-Agent 
    (spawns agents)
         |
         v
    Scout Agent 
    (detects opportunity)
         |
         v
    Risk Agent 
    (evaluates risk)
         |
         v
    Execution Agent 
    (plans transaction)
         |
         v
    Meta-Agent 
    (makes final decision)
         |
         v
    Simulation Engine 
    (runs predictions)
         |
         v
    Memory Vault 
    (stores outcome on-chain)
         |
         v
    Replay Engine 
    (logs timeline)
         |
         v
    On-Chain Execution
```

---

## Marketplace Features

### Agent Marketplace

NeuroNet includes a built-in marketplace for agent trading:

- **Agent Rentals**: Rent high-performing agents for a period
- **Strategy Sharing**: Share and monetize successful strategies
- **Performance Metrics**: Transparent agent statistics
- **Stripe Integration**: Secure payment processing

### Payments
- **Stripe Connect**: Multi-party payments for agent rentals
- **Automated Payouts**: Sellers receive earnings automatically
- **Subscription Support**: Recurring rental options

---

## Roadmap & Future Plans

### Phase 1: Foundation (Completed)
- Multi-agent architecture implementation
- Smart contract deployment on testnets
- Real-time market data integration
- Basic trading signal generation
- On-chain memory vault

### Phase 2: Intelligence (Current)
- Machine learning pattern recognition
- Enhanced simulation engine
- Cross-agent knowledge sharing
- Improved risk assessment models
- Signal conflict prevention

### Phase 3: Expansion (Q1 2026)
- **Multi-Chain Support**: Expand beyond Ethereum to Solana, Arbitrum, Optimism
- **Cross-Chain Bridges**: Automated asset movement between chains
- **MEV Protection**: Flashbots integration for transaction privacy
- **Advanced ML Models**: Deep learning for pattern recognition

### Phase 4: Governance (Q2 2026)
- **Multi-Signature Governance**: Require multiple approvals for large trades
- **DAO Integration**: Community governance of system parameters
- **Token Launch**: Governance token for platform decisions
- **Staking Mechanisms**: Stake tokens for agent access

### Phase 5: Scale (Q3-Q4 2026)
- **Agent Marketplace V2**: Full decentralized agent trading
- **Custom Strategy Builder**: No-code strategy creation
- **Institutional Features**: Enterprise-grade compliance and reporting
- **Mobile Application**: iOS and Android native apps
- **API Access**: Third-party integration capabilities

---

## Why NeuroNet Governor?

### For Traders
- **24/7 Operation**: Never miss an opportunity while sleeping
- **Risk Management**: Built-in protection against catastrophic losses
- **No Coding Required**: Use the system without technical knowledge
- **Transparent**: Every decision is logged and auditable

### For DeFi Protocols
- **Governance Automation**: Automated proposal evaluation
- **Liquidity Management**: Intelligent pool rebalancing
- **Risk Monitoring**: Early warning for protocol risks

### For Developers
- **Open Architecture**: Extensible agent system
- **API Access**: Integrate with existing systems
- **Smart Contracts**: Build on our on-chain infrastructure

---

## Team & Development

NeuroNet Governor is built with:

- **Production-Ready Code**: TypeScript throughout for type safety
- **Modern Infrastructure**: Serverless database, edge-ready deployment
- **Security First**: OpenZeppelin contracts, comprehensive audit logging
- **Cost Optimized**: Balanced AI usage to minimize operating costs

---

## Try It Now

NeuroNet Governor is live and running on testnet. Connect your wallet to explore the system, watch agents debate opportunities in real-time, and see autonomous DeFi governance in action.

**Supported Wallets:**
- MetaMask
- WalletConnect
- Coinbase Wallet
- Rainbow
- And more...

**Testnet Networks:**
- Ethereum Sepolia
- Base Sepolia

---

## Links & Resources

- **Live Demo**: [Deployed on Replit]
- **GitHub**: Available upon request
- **Documentation**: Full technical docs included
- **Smart Contracts**: Verified on Sepolia and Base Sepolia explorers

---

## Summary

NeuroNet Governor represents the next evolution in DeFi automation - moving from simple trading bots to intelligent, self-improving agent networks that can adapt to changing market conditions, learn from their mistakes, and operate transparently on-chain.

By combining cutting-edge AI with blockchain transparency, we're building the foundation for truly autonomous financial systems that serve users 24/7 while maintaining full accountability through on-chain audit trails.

**Key Innovations:**
1. Multi-agent collaboration for better decisions
2. Self-evolution through performance-based agent replacement
3. On-chain memory for transparent strategy storage
4. Hybrid AI with automatic fallback for reliability
5. Internal credit economy for aligned incentives

**The future of DeFi is autonomous. NeuroNet Governor is leading the way.**
