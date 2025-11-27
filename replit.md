# NeuroNet Governor

## Overview

NeuroNet Governor is an advanced multi-agent AI system for autonomous DeFi protocol governance. The system uses a sophisticated agent architecture where specialized AI agents (Meta, Scout, Risk, and Execution) negotiate and collaborate to make governance decisions. Each agent has distinct personalities, credit scores, and responsibilities within an internal economy that rewards successful decisions and penalizes poor ones.

The system features real-time simulation capabilities for predicting future market states, on-chain memory storage for learning from past decisions, continuous monitoring through a Sentinel system, and complete decision replay functionality. The frontend provides a cinematic command center interface for overseeing autonomous operations with multi-chain support for Ethereum, Base, and Fraxtal networks.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Agent Architecture

**Agent Hierarchy and Negotiation Protocol**
- The system implements a four-tier agent structure with a Meta-Agent as the central orchestrator
- Scout Agent detects opportunities (arbitrage, yield farming, liquidity analysis)
- Risk Agent evaluates proposals and blocks high-risk decisions through safety vetoes
- Execution Agent creates and executes blockchain transactions
- Agents negotiate in a structured workflow: Scout → Risk → Execution → Meta
- Each agent maintains personality traits that influence decision-making style (curious, cautious, precise, sovereign)
- All agents use Anthropic's Claude via Replit AI Integrations for decision-making

**Credit Economy System**
- Internal credit scoring system where agents earn/lose credits based on performance
- Credit transactions track successful vs failed actions
- Accuracy rates calculated from historical performance
- Low-performing agents can be deprecated and replaced (self-healing capability)

### Frontend Architecture

**UI Framework and Design System**
- React with TypeScript for type-safe component development
- Vite for fast development and optimized production builds
- Wouter for lightweight client-side routing
- shadcn/ui component library built on Radix UI primitives
- Tailwind CSS with custom design tokens for consistent spacing and theming
- Framer Motion for cinematic animations and transitions

**Design Philosophy**
- Command center aesthetic with cinematic motion design
- Inspired by Linear (clean interface), Stripe (data clarity), and Coinbase Advanced (technical precision)
- 24-column grid system for precise control panel layouts
- Typography: Inter (UI), JetBrains Mono (code/data), Space Grotesk (headers)
- Dark/light theme support with HSL-based color system
- Agent-specific color coding (Meta: purple, Scout: green, Risk: orange, Execution: violet)

**Core UI Components**
- NeuroNetCore: Central animated visualization with orbiting sub-agents
- LogStream: Real-time agent activity with personality-based styling
- RiskHeatmap: Visual grid representation of risk levels across scenarios
- MetricsDashboard: Live financial metrics (wallet balance, TVL, APY)
- ControlPanel: Simulation controls and autonomous mode toggle
- TimeWarpSlider: Navigate through decision history timeline
- DeveloperPanel: Advanced debugging with logs, simulations, credits, memory vault

### Backend Architecture

**Server Framework**
- Express.js for REST API and WebSocket server
- HTTP server created with Node's native `createServer` for WebSocket upgrade support
- In-memory storage system (can be replaced with PostgreSQL via Drizzle ORM)
- TypeScript for type safety across server components

**Real-Time Communication**
- WebSocket server for bi-directional real-time updates
- Broadcasts log entries, metrics updates, sentinel alerts, simulation results
- Heartbeat mechanism with 30-second ping intervals
- Automatic reconnection logic with exponential backoff

**Core Services**
- AgentOrchestrator: Manages agent lifecycle and negotiation cycles
- SimulationEngine: Runs future fork predictions with multiple scenario branches
- CreditEconomy: Tracks agent performance and credit transactions
- MemoryVault: Stores successful/failed strategies and learning milestones
- SentinelMonitor: 24/7 monitoring of wallet health, liquidity, volatility, peg deviations
- ReplayEngine: Records and retrieves complete decision timeline

**Simulation System**
- Future fork prediction with configurable time horizons and branch counts
- Predicts: price, volatility, TVL, yield, peg deviations (FRAX + KRWQ)
- Expected Value (EV) scoring for scenario ranking
- Supports parallel scenario exploration

### State Management

**Frontend State**
- React Query (TanStack Query) for server state management and caching
- WebSocket hook (`useWebSocket`) for real-time state updates
- Theme context for dark/light mode persistence
- Local component state for UI interactions

**Backend State**
- In-memory storage with typed interfaces for all data models
- Event-driven architecture using Node EventEmitter
- Real-time broadcasting through WebSocket for state synchronization
- Database migration support via Drizzle Kit (prepared for PostgreSQL)

## Recent Changes & Fixes (November 26, 2025)

### SimulationEngine Enhancements
- **Box-Muller Transform Fix**: Added guard against edge case where NaN/Infinity could be generated in random number generation
- **EV Score Persistence**: All EV scores now rounded to integers with `Math.round()` before database insertion for proper compatibility with integer column type
- **Prediction Value Validation**: EV values bounded to [-1000, 1000] range with validation for NaN/Infinity cases
- **Advanced Monte Carlo Simulation**: Completely rewrote with Welford's online algorithm for numerically stable mean/variance calculation
  - Convergence detection based on standard error of mean and mean stabilization
  - Comprehensive distribution metrics: percentiles (p5-p95), Value at Risk (VaR), Conditional VaR (CVaR)
  - Higher moment calculations: skewness and excess kurtosis
  - Support for 95% and 99% confidence intervals
  - Event emissions for progress tracking and completion
  - Batch Monte Carlo simulation support for scenario comparison

### RPC Reliability Improvements
- **Exponential Backoff with Jitter**: All RPC calls now use configurable retry logic (3 retries, 1-10s delays)
- **Smart Error Classification**: Distinguishes between retryable (network, rate limit) and non-retryable errors (contract revert)
- **Methods Enhanced**:
  - `getWalletBalance()` - Multi-chain balance fetching with per-chain retry
  - `getTotalValueLocked()` - Uniswap V3 pool queries with independent retries
  - `getGasPrices()` - Cross-chain gas price fetching with fallback
  - `getAaveV3APY()` - Real yield source with retry on transient failures
  - `getETHUSDPrice()` - Chainlink oracle access with retry
  - `getGasPriceGwei()` - Per-chain gas conversion with retry logic

## External Dependencies

### AI Services
- **Anthropic Claude API**: Primary AI engine for all agent decision-making
  - Accessed via `ANTHROPIC_API_KEY` environment variable
  - Used by Meta, Scout, Risk, and Execution agents for natural language reasoning
  - Model: claude-sonnet-4-5 for optimal performance

### Blockchain Integration
- **RainbowKit**: Wallet connection UI and management
  - Supports multiple wallet providers
  - WalletConnect integration via project ID
- **wagmi**: React hooks for Ethereum interactions
  - Chain configuration for Ethereum mainnet, Base, Fraxtal
  - Type-safe contract interactions
- **viem**: Low-level Ethereum utilities (included via wagmi)

### Database
- **Drizzle ORM**: Type-safe database toolkit
  - Configured for PostgreSQL dialect
  - Schema definitions in `shared/schema.ts`
  - Migration support via `drizzle-kit`
- **Neon Serverless**: PostgreSQL database driver
  - Optimized for serverless/edge environments
  - Connection via `DATABASE_URL` environment variable

### UI Libraries
- **Radix UI**: Headless component primitives
  - Accordion, Dialog, Dropdown, Tooltip, Tabs, etc.
  - Accessibility-compliant components
- **shadcn/ui**: Pre-styled component system
  - Built on Radix UI with Tailwind styling
  - Custom theme configuration in `components.json`
- **Lucide React**: Icon library for consistent iconography

### Development Tools
- **Replit Vite Plugins**: Development experience enhancements
  - Runtime error modal overlay
  - Cartographer (component visualization)
  - Dev banner
- **esbuild**: Fast JavaScript bundler for production builds
- **tsx**: TypeScript execution for development server

### Session Management
- **express-session**: Session middleware
- **connect-pg-simple**: PostgreSQL session store
- **memorystore**: In-memory session store (fallback)

### Utilities
- **nanoid**: Unique ID generation
- **date-fns**: Date manipulation and formatting
- **zod**: Runtime type validation and schema definition
- **class-variance-authority**: CSS variant utilities
- **clsx** + **tailwind-merge**: Conditional class name merging

## Current Project Status

### Completed Tasks
1. ✅ PostgreSQL database provisioned with schema deployed
2. ✅ Anthropic API integration fixed (using direct API key)
3. ✅ All four agents operational and autonomous mode functional
4. ✅ Box-Muller transform edge case fixed
5. ✅ EV score persistence bug fixed (integer rounding)
6. ✅ Monte Carlo simulation completely rewritten with advanced statistics
7. ✅ RPC retry logic with exponential backoff implemented

### Known Issues
- **RPCClient.ts** has 3 pre-existing TypeScript type errors related to viem's bigint exponentiation syntax (lines 88-91, 96-99, 208) - these don't block functionality as they relate to type checking only, not runtime behavior

### Recently Completed (November 27, 2025)
1. ✅ Solana RPC integration with Helius endpoints
2. ✅ Jupiter swap quote functionality
3. ✅ Marinade staking metrics integration
4. ✅ Orca liquidity pool analysis
5. ✅ Flashbots MEV protection client
6. ✅ Private transaction relay for sandwich attack protection
7. ✅ MEV risk scoring and detection in RiskAgent
8. ✅ API routes for Solana metrics (/api/solana/*)
9. ✅ API routes for MEV protection (/api/mev/*)
10. ✅ MEV Protection Dashboard with real-time visualization
11. ✅ Solana Metrics Dashboard

### Completed (November 27, 2025 - Latest)
1. **ML Pattern Recognition Service** (`server/ml/MLPatternRecognition.ts`)
   - K-means clustering algorithm for market pattern detection (bullish, bearish, volatile, stable, sideways)
   - Predictive model for opportunity success probability (0-100%)
   - Feature extraction from memory entries, credit transactions, and market data
   - Model training, metrics tracking, and outcome recording for feedback loop

2. **Multi-Signature Governance System** (`server/governance/GovernanceSystem.ts`)
   - Proposal creation with 2-of-3, 3-of-5, and 4-of-7 approval thresholds
   - 24-hour minimum timelock with value-based scaling (higher value = longer delay)
   - Signature collection, validation, and duplicate prevention
   - Vote tracking (approve/reject/abstain) with execution flow
   - Gnosis Safe transaction building for multi-sig execution

3. **MetaAgent ML Integration**
   - ML predictions integrated into makeDecision method
   - negotiateWithAgents enhanced with ML scoring (25% weight)
   - Cluster-based risk adjustment and expected return calculations

4. **New API Endpoints**
   - ML: `/api/ml/metrics`, `/api/ml/predict`, `/api/ml/train`, `/api/ml/cluster`, `/api/ml/outcome`, `/api/ml/weights`
   - Governance: `/api/governance/proposals`, `/api/governance/proposals/:id/sign`, `/api/governance/proposals/:id/vote`, `/api/governance/proposals/:id/execute`, `/api/governance/stats`, `/api/governance/timelock`

5. **New UI Components**
   - `GovernanceDashboard.tsx`: Proposal creation, signing, voting, and execution interface
   - `MLInsightsDashboard.tsx`: Prediction interface, cluster visualization, and model weights display

### Remaining Work
1. Phantom/Solflare wallet integration for Solana
2. Database migrations for new schema types
3. Advanced simulation parameter tuning
4. Performance optimization for large-scale Monte Carlo runs
5. Extended testing suite for agent negotiation edge cases
6. Frontend dashboard enhancements for Monte Carlo result visualization

### Development Notes
- **API Key Configuration**: All agents use `ANTHROPIC_API_KEY` environment variable directly
- **Database**: Uses PostgreSQL via Neon with Drizzle ORM for type safety
- **Error Handling**: Network errors automatically retry with smart backoff; contract errors fail immediately
- **Simulation**: Monte Carlo now converges automatically based on statistical metrics rather than fixed iterations
- **Architecture**: Event-driven with WebSocket real-time updates for all state changes