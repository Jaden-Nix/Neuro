# NeuroNet Governor

## Overview

NeuroNet Governor is an advanced multi-agent AI system designed for autonomous DeFi protocol governance. It orchestrates specialized AI agents (Meta, Scout, Risk, Execution) through an internal economy based on distinct personalities, credit scores, and responsibilities. The system features real-time market simulation, on-chain memory for continuous learning, 24/7 monitoring via a Sentinel system, and full decision replay capabilities. The project aims to provide an autonomous DeFi governance solution with a cinematic command center interface, supporting multiple chains including Ethereum, Base, and Fraxtal.

## Recent Changes (December 2024)

- **AI Trading Village**: Competitive multi-agent ecosystem where 10 specialized AI trader agents (Atlas, Nova, Cipher, Vega, Orion, Nebula, Phoenix, Quantum, Echo, Apex) hunt for trading opportunities. Features include:
  - Agent roles: Hunter, Analyst, Strategist, Sentinel, Scout, Veteran
  - Personalities: Aggressive, Conservative, Balanced, Contrarian, Momentum, Experimental
  - Credit-based economy with rewards for wins and penalties for losses
  - Signal claiming system (first agent to claim wins)
  - Evolution triggered by win/loss streaks
  - Experiment system for testing new strategies
  - Real-time thought stream showing agent reasoning
  - Leaderboard with rankings by credit score
- **On-Chain Agent Identity System**: Implemented NeuronBadge.sol soulbound NFT contract and BlockchainSyncService for proving agent evolution on-chain. Agents earn badges for successful mutations, with complete identity tracking including credit scores, generation lineage, and performance metrics. The Evolution page now has an "On-Chain" tab showing proof cards, agent resumes, and blockchain sync status.
- **Real Data Integration**: All system components now use real market data sources (Binance, CoinGecko, DefiLlama) instead of simulated data
- **Backtesting Enhancement**: QuickBacktestEngine now fetches actual historical OHLCV data with deterministic seeded fallback
- **Claude AI Integration**: All agents now use Replit AI Integrations for Anthropic Claude access (AI_INTEGRATIONS_ANTHROPIC_API_KEY, AI_INTEGRATIONS_ANTHROPIC_BASE_URL)
- **RPC Client Improvements**: BlockchainRPCClient now uses MarketDataService for ETH prices, TVL, and APY data with blockchain fallbacks
- **ADK Integration**: ClaudeADKIntegration bridges ADK-TS framework with Claude AI for JARVIS-level agent intelligence

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Agent Architecture

The system employs a four-tier agent structure: a Meta-Agent orchestrates Scout (opportunity detection), Risk (proposal evaluation and veto), and Execution (transaction creation/execution) agents. Agents negotiate based on personality traits and utilize Anthropic's Claude via Replit AI Integrations for decision-making. An internal credit economy rewards successful decisions and penalizes poor ones, enabling self-healing through agent replacement.

### Frontend Architecture

The frontend is built with React, TypeScript, Vite, Wouter, shadcn/ui (on Radix UI), and Tailwind CSS, using Framer Motion for animations. It features a "command center" aesthetic with a 24-column grid, specific typography (Inter, JetBrains Mono, Space Grotesh), dark/light theme support, and agent-specific color coding. Key UI components include NeuroNetCore for visualization, LogStream, RiskHeatmap, MetricsDashboard, ControlPanel, TimeWarpSlider, and DeveloperPanel.

### Backend Architecture

The backend uses Express.js for REST APIs and WebSockets, with TypeScript. Core services include AgentOrchestrator, a SimulationEngine (for future fork predictions with Monte Carlo simulation), CreditEconomy, MemoryVault, SentinelMonitor, and ReplayEngine. The Simulation System incorporates ML Pattern Recognition (K-means clustering, predictive models) and a Multi-Signature Governance System with Gnosis Safe integration.

### State Management

Frontend state is managed using React Query for server state and caching, with a WebSocket hook for real-time updates. Backend state uses PostgreSQL with Drizzle ORM for type-safe operations, an event-driven architecture, and real-time broadcasting via WebSockets.

### Feature Specifications

- **AI Insights Engine**: Advanced ML pattern recognition system that detects 8 pattern types (momentum shifts, whale accumulation, volatility clusters, trend reversals, breakout signals, divergence detection, liquidity squeezes, correlation movements) using technical indicators (RSI, MACD, Bollinger Bands, volume analysis). Each insight includes confidence scores, impact levels, suggested actions, and source attribution (DefiLlama, Coinbase, Dune Analytics, The Graph, Nansen, Token Terminal, L2Beat, Coingecko). Features market regime detection (trending up/down, high/low volatility, sideways range/chop, accumulation/distribution) and agent performance insights connected to the Evolution system.
- **Evolution Tree System**: Tracks agent evolution through generations with 10 mutation types (threshold_adjustment, risk_rebalancing, source_weight_shift, new_signal_enabled, signal_disabled, latency_optimization, failover_strategy, confidence_calibration, volatility_adaptation, slippage_optimization). Features genealogy tree visualization, mutation heatmap showing success rates, performance inheritance tracking, and integration with backtesting/stress testing triggers.
- **Quick Backtest System**: Simulates historical data for various trading agents (Atlas, Vega, Nova, Sentinel, Arbiter) and tracks performance metrics like trades, win rate, return, Sharpe, and drawdown.
- **Enhanced Wallet Tracking**: Comprehensive multi-protocol DeFi monitoring for Lido stETH, Aave V3, Frax sfrxETH, Uniswap, Compound, Curve, and Convex, including historical snapshots, PnL analysis, and configurable alerts.
- **Stress Testing**: Allows creation and execution of scenarios (e.g., Flash Crash, High Volatility, Liquidity Crisis, Chain Congestion, Oracle Failure, MEV Attack) to detect realistic vulnerabilities and evaluate portfolio impact.
- **Agent Stress Lab**: Advanced stress testing engine that simulates extreme market scenarios (flash crash, liquidity rug, volatility spike, oracle failure, gas explosion, chain congestion, yield drain, governance attack, MEV attack) to evaluate agent resilience. Tracks agent reactions in real-time, calculates metrics (risk accuracy, meta stability, reaction speed, execution safety), and provides resilience scores with recommendations.
- **Parliament Governance System**: Multi-agent governance with quorum-based voting, weighted votes (based on credit score and accuracy), live debate simulation, and Meta orchestration summary. Parliament sessions are persisted to PostgreSQL, surviving server restarts.
- **Alert System**: Configurable email and webhook notifications for critical system events with severity thresholds and cooldown periods.
- **Strategy Backtesting**: Historical replay through agent decision-making cycles, providing performance metrics and strategy comparison.
- **Multi-Wallet Support**: Tracks wallets and token holdings across Ethereum, Base, Fraxtal, and Solana with an aggregate portfolio view.

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