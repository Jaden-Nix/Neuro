# NeuroNet Governor

## Overview

NeuroNet Governor is an advanced multi-agent AI system designed for autonomous DeFi protocol governance. It orchestrates specialized AI agents (Meta, Scout, Risk, Execution) through an internal economy based on distinct personalities, credit scores, and responsibilities. The system features real-time market simulation, on-chain memory for continuous learning, 24/7 monitoring via a Sentinel system, and full decision replay capabilities. The project aims to provide an autonomous DeFi governance solution with a cinematic command center interface, supporting multiple chains including Ethereum, Base, and Fraxtal.

## Recent Changes (December 2025)

- **Parliament Debate System Fixes**:
  - **Timeout Handling**: 60-second debate timeout with proper cleanup prevents indefinite hanging
  - **Status Guard**: Both success and timeout paths reload session state before updating, preventing concluded sessions from being reverted to "voting" during concurrent manual overrides
  - **Manual Override**: Users can manually approve/reject proposals after agent voting with toast notifications for success/error states
  - **Log Persistence**: Thought stream uses compound keys (id+timestamp) for deduplication; historical logs reload on WebSocket reconnection
  - **MetaSummary Cloning**: Deep clones synthesized summary before mutation to preserve original analysis

- **LIVE AI Airdrop Discovery**: Pure AI-driven airdrop discovery with NO static/seeded data:
  - **Gemini + Claude Hybrid**: Gemini for fast discovery, Claude as fallback for reliability
  - **Robust JSON Parsing**: Multi-strategy extraction handles malformed AI responses
  - **Current Discoveries**: Berachain ($3k-$8k), Monad ($2.5k-$6k), Hyperliquid ($4k-$12k), Scroll ($1.5k-$4k)
  - **Auto-refresh**: Discovery runs every 3 minutes to catch new opportunities

- **Trading Signal Generation & Validation**:
  - **5+ Active Signals**: BTC, ETH, SOL, AVAX, OP with detailed reasoning
  - **Agent Debates**: Each signal is validated by 3+ agents who agree/disagree with comments
  - **Technical Analysis**: Pattern recognition, RSI, MACD, volume, key levels
  - **Risk Management**: Entry, stop-loss, 3 take-profit levels, position sizing

- **Agent Evolution System (Active)**:
  - Auto-evolution every 60 seconds (Arbiter_v2 → Arbiter_v3, Atlas_v2 → Atlas_v3)
  - Mutations: risk_rebalancing, volatility_adaptation, confidence_calibration
  - On-chain badge queuing via BlockchainSyncService

- **Hybrid AI System**: Full integration of both Gemini and Claude AI for different agent roles:
  - **Gemini AI** (via Replit AI Integrations): Scout and Execution agents for fast, real-time analysis
  - **Claude AI** (via Replit AI Integrations): Risk and Meta agents for complex reasoning and strategic decisions
  - **HybridAIService**: Intelligent routing between providers with automatic fallback, rate limiting (p-limit), and retry logic (p-retry)

- **Ultron Signals - Live Price Streaming**: Real-time price streaming for 103 tokens across 9 exchanges (KuCoin, MEXC, Gate, Bitget, Kraken, Bybit, OKX, Coinbase, Huobi). Features:
  - **CCXT Multi-Exchange Adapter**: Unified interface for fetching live prices with intelligent fallback chain
  - **103 Token Registry**: Covering Layer 1s (BTC, ETH, SOL, XRP, etc.), DeFi (AAVE, UNI, CRV), Memes (DOGE, SHIB, PEPE), AI tokens (RENDER, FET, TAO), and more
  - **Real-time WebSocket Updates**: Sub-2-second price updates with 24h change, high/low, volume
  - **Category Filtering**: Filter by Layer 1, Layer 2, DeFi, Meme, AI, Gaming, Infrastructure, etc.
  - **Fallback System**: CoinGecko → Exchange priority chain → Static prices for maximum reliability
  - **Onboarding Wizard**: Disabled in development mode for quick access to signals page

- **AI Trading Village**: Collaborative multi-agent ecosystem where 10 specialized AI trader agents (Atlas, Nova, Cipher, Vega, Orion, Nebula, Phoenix, Quantum, Echo, Apex) hunt for trading opportunities and share knowledge. Features include:
  - Agent roles: Hunter, Analyst, Strategist, Sentinel, Scout, Veteran
  - Personalities: Aggressive, Conservative, Balanced, Contrarian, Momentum, Experimental
  - Credit-based economy with rewards for wins and penalties for losses
  - **Trade Signals with Full Details**: Each signal includes entry price, stop loss, 3 take profit levels, risk:reward ratio, confidence %, timeframe, reasoning, technical analysis (pattern, indicators, key levels), and position sizing
  - **Signal Validation System**: Other agents review and validate trade signals using Claude AI, recording agree/disagree with comments
  - **Agent Collaboration**: Agents @mention each other, debate market topics, and share knowledge through a trust-based relationship network
  - **Memory System**: Each agent remembers successful/failed strategies, mentors, students, shared insights, and debate history
  - Evolution triggered by win/loss streaks using Claude AI
  - Experiment system for testing new strategies
  - Real-time thought stream showing agent reasoning
  - Leaderboard with rankings by credit score
  - **Data Export**: Download buttons for exporting agent data and thought streams as JSON files
  - API endpoints: /api/village/agents, /api/village/thoughts, /api/village/signals, /api/village/debates, /api/village/knowledge
  - **Data Storage**:
    - **Agent State**: Persisted to PostgreSQL (`village_agents` table) - survives restarts
    - **Birth Records**: Persisted to PostgreSQL (`agent_births` table) - historical record
    - **Trading Signals**: Persisted to PostgreSQL (`village_signals` table)
    - **Agent Thoughts**: In-memory only - use export button to download before restart
- **On-Chain Agent Identity System (LIVE on Base Sepolia)**: 
  - **NeuronBadge Contract**: `0xc4f97d52334f0de35fec958f24fc5af9c450f8dc` - Soulbound NFT for proving agent evolution
  - **Live Minting**: BlockchainSyncService uses viem to mint evolution badges on-chain in real-time
  - **Badge Types**: Evolution (mutations), Stress Test (resilience), Healing (self-recovery)
  - **BaseScan Verification**: All minted badges have clickable links to view transactions on BaseScan
  - **Environment Variables**: `BLOCKCHAIN_ENABLED=true`, `NEURON_BADGE_ADDRESS`, `DEPLOYER_PRIVATE_KEY`
  - **UI Integration**: Evolution page shows live/simulated status indicator and explorer links for verified proofs
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
- **Hybrid AI System**: Dual-provider architecture for optimal performance
  - **Anthropic Claude API**: Complex reasoning for Risk and Meta agents (`claude-sonnet-4-5` via Replit AI Integrations)
  - **Google Gemini API**: Fast analysis for Scout and Execution agents (`gemini-2.5-flash` via Replit AI Integrations)
  - **HybridAIService**: Intelligent routing with automatic fallback between providers
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