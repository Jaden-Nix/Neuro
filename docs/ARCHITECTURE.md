# NeuroNet Governor - Architecture Documentation

## System Overview

NeuroNet Governor is a multi-agent autonomous system designed for DeFi protocol governance with on-chain execution capabilities.

## Core Components

### 1. Multi-Agent System

#### Meta-Agent (The Brain)
- **Role**: Central orchestrator and decision-maker
- **Responsibilities**:
  - Spawns and manages sub-agents
  - Negotiates between agents
  - Runs final simulations
  - Executes on-chain actions
  - Maintains credit economy
  - Handles self-healing logic
  - Writes to Memory Vault

#### Scout Agent
- **Role**: Market intelligence and opportunity detection
- **Responsibilities**:
  - Scans liquidity across DEXs
  - Fetches real-time price data
  - Detects arbitrage opportunities
  - Predicts volatility patterns
  - Suggests profitable actions
- **Personality**: Curious, energetic
- **Performance Metrics**: Prediction accuracy, opportunity value

#### Risk Agent
- **Role**: Safety and risk management
- **Responsibilities**:
  - Evaluates Scout proposals
  - Blocks high-risk decisions
  - Simulates loss scenarios
  - Predicts liquidation risks
  - Performs safety vetoes
- **Personality**: Cautious, formal
- **Performance Metrics**: False positive rate, prevented losses

#### Execution Agent
- **Role**: Transaction creation and execution
- **Responsibilities**:
  - Creates safe on-chain transactions
  - Calculates optimal gas costs
  - Executes swaps, rebalances, loans
  - Publishes execution logs
  - Emits data for memory storage
- **Personality**: Cold, precise
- **Performance Metrics**: Success rate, gas efficiency

### 2. Negotiation Protocol

**Flow**: Scout → Risk → Execution → Meta-Agent

1. **Proposal Phase**: Scout identifies opportunity and creates proposal
2. **Risk Assessment**: Risk agent evaluates and scores proposal
3. **Execution Planning**: Execution agent plans transaction details
4. **Meta Decision**: Meta-agent weighs all inputs and decides

**Scoring System**:
```typescript
finalScore = (
  scoutConfidence * 0.3 +
  (100 - riskScore) * 0.4 +
  executionFeasibility * 0.2 +
  expectedReturn * 0.1
)
```

### 3. Simulation Engine

#### Future Fork Prediction
- Propagates multiple possible future states
- Predicts:
  - Price movements
  - Volatility levels
  - TVL changes
  - Yield fluctuations
  - Peg deviations (FRAX, KRWQ)

#### EV Calculation
```typescript
EV = Σ(probability_i * outcome_i) - risk_penalty
```

### 4. Credit Economy

#### Credit Allocation
- Scout: Earns on accurate predictions
- Risk: Earns on good vetoes, loses on false positives
- Execution: Earns on successful txs, loses on failures
- Meta-Agent: Redistributes based on system performance

#### Ledger Structure
```json
{
  "transactions": [
    {
      "agentId": "scout-001",
      "agentType": "scout",
      "amount": 50,
      "reason": "Accurate price prediction",
      "timestamp": 1234567890
    }
  ]
}
```

### 5. Memory Vault

#### Storage Categories
- **Successful Strategies**: Profitable actions to repeat
- **Blocked Strategies**: High-risk actions to avoid
- **Risk Patterns**: Identified danger signals
- **Price Anomalies**: Market inefficiencies
- **Learning Milestones**: System improvements

#### Smart Contract Schema
```solidity
struct MemoryEntry {
  bytes32 id;
  uint8 strategyType; // 0: successful, 1: blocked, 2: high-risk, 3: learned
  string description;
  uint256 timestamp;
  mapping(address => uint256) agentScores;
}
```

### 6. Self-Healing Engine

#### Deprecation Criteria
- Credit score below threshold (< 100)
- Accuracy rate < 60%
- Failed actions > 50% of total
- No improvement over 30 days

#### Evolution Process
1. Detect underperforming agent
2. Log deprecation reason
3. Spawn new version with adjusted parameters
4. Migrate memory and context
5. Update ATP metadata
6. Archive old version

### 7. ATP Integration

#### Agent Metadata
```typescript
interface ATPMetadata {
  agentId: string;
  version: number;
  capabilities: string[];
  performance: {
    totalActions: number;
    successRate: number;
    avgResponseTime: number;
  };
  evolution: {
    spawnedFrom: string | null;
    deprecationReason: string | null;
    improvements: string[];
  };
}
```

### 8. Sentinel Mode

#### Monitoring Targets
- **Wallet Health**: Balance thresholds, diversification
- **Liquidity Changes**: Pool depth, slippage risk
- **Peg Deviations**: FRAX, KRWQ stability
- **Volatility Spikes**: Sudden price movements
- **Oracle Anomalies**: Price feed discrepancies
- **Pool Drains**: Rapid liquidity exits
- **Liquidation Risks**: Collateral ratios

#### Alert Levels
- **Low**: Informational, no action
- **Medium**: Warning, increase monitoring
- **High**: Requires attention, pause risky operations
- **Critical**: Immediate action, potential auto-execution

### 9. Replay Engine

#### Event Capture
All decisions, simulations, and executions are logged with:
- Event ID
- Type (decision, simulation, negotiation, execution, alert)
- Agent type
- Full data payload
- Timestamp

#### Timeline Visualization
- Sequential event list
- Branch points for simulations
- Outcome indicators
- Filter by agent type, event type, or time range

## Data Flow

```
User Input
    ↓
Meta-Agent (spawns agents)
    ↓
Scout Agent (detects opportunity)
    ↓
Risk Agent (evaluates risk)
    ↓
Execution Agent (plans transaction)
    ↓
Meta-Agent (makes final decision)
    ↓
Simulation Engine (runs predictions)
    ↓
Memory Vault (stores outcome)
    ↓
Replay Engine (logs timeline)
    ↓
On-Chain Execution
```

## Technology Stack

### Frontend
- React 18 + TypeScript
- Tailwind CSS
- Framer Motion
- Wagmi + Viem (Web3)
- RainbowKit (wallet)
- TanStack Query

### Backend
- Express.js
- WebSocket
- Anthropic AI (via Replit AI Integrations)
- Viem (on-chain client)
- Hardhat (smart contracts)

### Storage
- In-memory (development)
- PostgreSQL (production option)
- On-chain (Memory Vault)

## Security Considerations

1. **Agent Isolation**: Each agent runs in isolated context
2. **Permission System**: Agents have limited capabilities
3. **Rate Limiting**: Prevent excessive on-chain calls
4. **Signature Verification**: All transactions require approval
5. **Fallback Mechanisms**: Automatic shutdown on critical errors
6. **Audit Logging**: Complete action history

## Performance Optimization

1. **Parallel Execution**: Agents run concurrently
2. **Caching**: Recent data cached for quick access
3. **WebSocket**: Real-time updates without polling
4. **Lazy Loading**: Components load on-demand
5. **Memo-ization**: Expensive calculations cached

## Deployment Architecture

```
User Browser
    ↓
Load Balancer
    ↓
Web Server (Vite + Express)
    ↓
Agent Orchestrator
    ↓
[Meta-Agent | Scout | Risk | Execution]
    ↓
Blockchain Nodes (ETH, Base, Fraxtal)
```

## Future Enhancements

1. **Machine Learning Layer**: Pattern recognition in historical data
2. **Multi-Signature Governance**: Require multiple approvals
3. **Agent Marketplace**: Deploy custom strategies
4. **Cross-Chain Bridges**: Automated asset movement
5. **MEV Protection**: Flashbot integration
6. **Solana Support**: Multi-chain expansion
