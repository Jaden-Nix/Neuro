# NeuroNet Governor

## Overview

NeuroNet Governor is an advanced multi-agent AI system designed for autonomous DeFi protocol governance. It employs a sophisticated architecture where specialized AI agents (Meta, Scout, Risk, Execution) collaborate and negotiate based on distinct personalities, credit scores, and responsibilities within an internal economy. The system features real-time market simulation, on-chain memory for continuous learning, 24/7 monitoring via a Sentinel system, and full decision replay capabilities. The project's ambition is to create an autonomous DeFi governance solution, offering a cinematic command center interface with multi-chain support for Ethereum, Base, and Fraxtal.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Agent Architecture

The system features a four-tier agent structure with a Meta-Agent orchestrating Scout (opportunity detection), Risk (proposal evaluation and veto), and Execution (transaction creation/execution) agents. Agents negotiate through a defined workflow, each possessing personality traits and utilizing Anthropic's Claude via Replit AI Integrations for decision-making. An internal credit economy rewards successful decisions and penalizes poor ones, enabling self-healing through agent replacement.

### Frontend Architecture

The frontend is built with React, TypeScript, Vite, Wouter, shadcn/ui (on Radix UI), and Tailwind CSS, utilizing Framer Motion for animations. The design adheres to a "command center" aesthetic, inspired by Linear, Stripe, and Coinbase Advanced, featuring a 24-column grid, specific typography (Inter, JetBrains Mono, Space Grotesk), dark/light theme support, and agent-specific color coding. Key UI components include NeuroNetCore for visualization, LogStream, RiskHeatmap, MetricsDashboard, ControlPanel, TimeWarpSlider, and DeveloperPanel.

### Backend Architecture

The backend uses Express.js for REST APIs and WebSockets, with TypeScript for type safety. It features a WebSocket server for real-time updates and core services like AgentOrchestrator, SimulationEngine (for future fork predictions with Monte Carlo simulation), CreditEconomy, MemoryVault, SentinelMonitor, and ReplayEngine. The Simulation System includes advanced Monte Carlo simulations with convergence detection and comprehensive distribution metrics. Recent enhancements include ML Pattern Recognition (K-means clustering, predictive models) and a Multi-Signature Governance System with proposal creation, timelocks, and Gnosis Safe integration.

### State Management

Frontend state is managed using React Query for server state and caching, with a WebSocket hook for real-time updates. Backend state uses PostgreSQL persistence with Drizzle ORM for type-safe database operations, an event-driven architecture, and real-time broadcasting via WebSockets.

## External Dependencies

### AI Services
- **Anthropic Claude API**: Core AI engine for agent decision-making (`claude-sonnet-4-5`).
- **ADK-TS (IQ AI Agent Development Kit)**: Hackathon-compliant multi-agent framework.

### Blockchain Integration
- **RainbowKit**: Wallet connection UI.
- **wagmi**: React hooks for Ethereum interactions (Ethereum, Base, Fraxtal).
- **viem**: Low-level Ethereum utilities.

### Database
- **Drizzle ORM**: Type-safe database toolkit for PostgreSQL.
- **Neon Serverless**: PostgreSQL database driver.

### UI Libraries
- **Radix UI**: Headless component primitives.
- **shadcn/ui**: Pre-styled component system built on Radix UI.
- **Lucide React**: Icon library.

### Development Tools
- **Replit Vite Plugins**: Development experience enhancements.
- **esbuild**: Fast JavaScript bundler.
- **tsx**: TypeScript execution for development.

### Session Management
- **express-session**: Session middleware.
- **connect-pg-simple**: PostgreSQL session store.

### Payment Processing
- **Stripe**: Payment processing for marketplace agent rentals and NFT minting.
- **stripe-replit-sync**: Automatic Stripe schema management and data synchronization.

### Utilities
- **nanoid**: Unique ID generation.
- **date-fns**: Date manipulation.
- **zod**: Runtime type validation.
- **class-variance-authority**: CSS variant utilities.
- **clsx** + **tailwind-merge**: Conditional class name merging.

## Recent Changes

### December 1, 2025 (Stress Testing & Performance Optimization)
- **Async Stress Test Execution**: Fixed blocking execute endpoint
  - `/api/stress/runs/:id/execute` now returns HTTP 202 immediately (non-blocking)
  - Background execution processes AI agent queries asynchronously
  - Frontend can poll for completion status in real-time
  - Eliminates timeout issues from agent query delays

- **Real Vulnerability Detection**: Parameter-driven vulnerability generation
  - `server/routes.ts`: `detectVulnerabilities()` function analyzes scenario parameters
  - Flash Crash: Detects `priceDropPercent`, `durationSeconds`, `affectedPairs`
  - High Volatility: Analyzes `volatilityMultiplier`, `marketSentiment`
  - Liquidity Crisis: Checks `liquidityDropPercent`, `spreadIncrease`
  - Chain Congestion: Evaluates `gasMultiplier`, `pendingTxCount`, `confirmationDelay`
  - Oracle Failure: Detects `staleTimeMinutes`, `priceDeviation`, `affectedOracles`
  - MEV Attack: Analyzes `attackerBots`, `frontrunPercent`, `victimTxCount`
  - Vulnerabilities are realistic and specific to each scenario's parameters

- **Database Persistence**: PostgreSQL integration for stress testing
  - `shared/schema.ts`: Added `stressScenarios` and `stressTestRuns` tables
  - `server/DatabaseStorage.ts`: Implemented 6 stress test storage methods
  - All test data persists across application restarts
  - Supports filtering, sorting, and complex queries via Drizzle ORM

- **Agent Response Simulation**: Instant agent responses for frontend testing
  - Agents generate realistic reasoning and performance metrics instantly
  - Framework in place for real ADK-TS integration when API credentials available
  - Agents: Meta (coordinator), Scout (threat detector), Risk (quantifier), Execution (operator)

### Previous Hackathon Compliance Features
- **ADK-TS Integration**: IQ AI Agent Development Kit for TypeScript
  - `server/adk/ADKIntegration.ts`: Full ADK-TS wrapper with multi-agent support
  - Integrates with `@iqai/adk` package for hackathon compliance
  - Pre-configured agents: Scout, Risk, Execution, Meta with personality traits
  - API routes: `/api/adk/*` for status, agents, queries, and workflows

- **ATP (Agent Tokenization Platform) Integration**:
  - `server/atp/ATPClient.ts`: Agent registration, tokenization, and evolution
  - ATP Points system for user engagement rewards
  - Agent link generation for ATP platform compatibility
  - Fraxtal network contracts configuration
  - API routes: `/api/atp/*` for agents, tokenization, points

- **IQ Token & Airdrop Support**:
  - `server/iq/IQTokenService.ts`: Staking, rewards, and airdrop management
  - HiIQ staking with voting power calculation
  - Agent participation airdrops (staking, governance, usage)
  - IQ token metrics and contract addresses
  - API routes: `/api/iq/*` for staking, airdrops, metrics

- **Alert System**: Email and webhook notifications for critical system events
  - `server/alerts/AlertService.ts`: Alert configuration management with severity thresholds
  - Supports email (SendGrid), webhook, and in-app notifications
  - Cooldown periods to prevent alert flooding
  - Notification history and statistics tracking
  - API routes: `/api/alerts/*` for CRUD and testing

- **Strategy Backtesting**: Historical replay through agent decision-making cycles
  - `server/backtesting/BacktestingEngine.ts`: Scenario creation and run execution
  - Strategy configuration (risk tolerance, position sizing, stop-loss/take-profit)
  - Performance metrics: returns, Sharpe ratio, max drawdown, win rate
  - Strategy comparison and scenario management
  - API routes: `/api/backtesting/*` for scenarios, runs, and stats

- **Multi-Wallet Support**: Track wallets across Ethereum, Base, Fraxtal, and Solana
  - `server/wallets/WalletManager.ts`: Wallet tracking and balance sync
  - Token holdings and transaction history per wallet
  - Aggregate portfolio view across all chains
  - Support for multiple wallet providers (rainbow, metamask, phantom, solflare)
  - API routes: `/api/wallets/*` for wallet management and syncing

### UI Pages
- `client/src/pages/Alerts.tsx`: Alert configuration and history
- `client/src/pages/Backtesting.tsx`: Scenario management and run visualization
- `client/src/pages/Wallets.tsx`: Multi-wallet dashboard with chain breakdown
- `client/src/pages/StressTesting.tsx`: Stress test creation, execution, and results

## Important Implementation Notes

### Stress Testing Workflow
1. User creates scenario with parameters (e.g., 30% price drop, 100+ pending txs)
2. POST `/api/stress/runs` creates test in database with "preparing" status
3. User clicks "Launch Test" → calls POST `/api/stress/runs/{id}/execute`
4. Endpoint returns INSTANTLY (HTTP 202) with status "running"
5. Background process executes agent logic asynchronously
6. Results update database and broadcast via WebSocket
7. Frontend polls GET `/api/stress/runs/{id}` to track completion
8. When status becomes "completed", results display with REAL vulnerabilities

### Vulnerability Detection is Parameter-Driven
Each scenario type analyzes specific parameters to generate relevant vulnerabilities:
- Flash Crash (35% drop) → "Severe 35% price drop - slippage tolerance exceeded" + "Flash crash completed in 60s - too fast for manual intervention"
- High Volatility (5x multiplier) → "Volatility spike x5 - delta hedging margin requirements exceeded by 100%"
- Liquidity Crisis (80% drop) → "Liquidity depleted by 80% on Uniswap V3, Curve" + "Bid-ask spreads widened by 500bps"
- And so on for each scenario type

### Database Schema
- `stressScenarios`: Template scenarios with name, description, category, severity (1-10), and parameters (JSON)
- `stressTestRuns`: Execution records with status, outcomes, portfolio impact, system health metrics, agent responses

### API Routes Summary
```
POST   /api/stress/scenarios          - Create template scenario
GET    /api/stress/scenarios          - List scenarios with filters
GET    /api/stress/scenarios/:id      - Get scenario details
POST   /api/stress/runs               - Create new test run
GET    /api/stress/runs               - List all test runs
GET    /api/stress/runs/:id           - Get run details & results
POST   /api/stress/runs/:id/execute   - Execute test (returns immediately)
PATCH  /api/stress/runs/:id           - Update run status/results
```

## Known Limitations
- Infura RPC quota exceeded for Sepolia testnet (non-critical for stress testing feature)
- ADK agent integration framework ready but using simulated responses for instant feedback
- Real Gemini API integration available when credentials provided via environment variables

## Next Steps for Production
1. Configure real ADK-TS API credentials (GEMINI_API_KEY, etc.)
2. Add error handling UI for failed agent queries
3. Implement result export (CSV, JSON) for test scenarios
4. Add batch testing capability (run multiple scenarios sequentially)
5. Create advanced filtering for historical test runs
6. Add performance trending charts over time
