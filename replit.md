# NeuroNet Governor

## Overview
NeuroNet Governor is an advanced multi-agent AI system for autonomous DeFi protocol governance. It orchestrates specialized AI agents (Meta, Scout, Risk, Execution) using an internal economy, credit scores, and distinct responsibilities. Key features include real-time market simulation, on-chain memory for continuous learning, 24/7 monitoring via a Sentinel system, and full decision replay capabilities. The project aims to provide an autonomous DeFi governance solution with a cinematic command center interface, supporting multiple chains like Ethereum, Base, and Fraxtal, with a vision to enhance market potential through advanced AI-driven financial autonomy.

## Complete Documentation
For fully detailed documentation covering architecture, technical specifications, design system, API reference, smart contracts, all features, and the full 2025-2026 roadmap, see: **`docs/COMPLETE_DOCUMENTATION.md`**

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Agent Architecture
The system utilizes a four-tier agent structure: a Meta-Agent orchestrates Scout (opportunity detection), Risk (proposal evaluation and veto), and Execution (transaction creation/execution) agents. Agents negotiate based on personality traits and use Anthropic's Claude via Replit AI Integrations for decision-making. An internal credit economy rewards successful decisions and penalizes poor ones, facilitating self-healing through agent replacement.

### Frontend Architecture
Built with React, TypeScript, Vite, Wouter, shadcn/ui (on Radix UI), and Tailwind CSS, with Framer Motion for animations. It features a "command center" aesthetic with a 24-column grid, specific typography (Inter, JetBrains Mono, Space Grotesh), dark/light theme support, and agent-specific color coding. Core UI components include NeuroNetCore, LogStream, RiskHeatmap, MetricsDashboard, ControlPanel, TimeWarpSlider, and DeveloperPanel.

### Backend Architecture
The backend uses Express.js for REST APIs and WebSockets, developed in TypeScript. Core services include AgentOrchestrator, a SimulationEngine (for future fork predictions with Monte Carlo simulation), CreditEconomy, MemoryVault, SentinelMonitor, and ReplayEngine. The Simulation System integrates ML Pattern Recognition (K-means clustering, predictive models) and a Multi-Signature Governance System with Gnosis Safe integration.

### State Management
Frontend state uses React Query for server state and caching, with a WebSocket hook for real-time updates. Backend state relies on PostgreSQL with Drizzle ORM for type-safe operations, an event-driven architecture, and real-time broadcasting via WebSockets.

### Feature Specifications
- **AI Insights Engine**: Detects 9 pattern types (momentum_shift, whale_accumulation, volatility_cluster, trend_reversal, breakout_signal, divergence_detection, liquidity_squeeze, correlation_movement, support_resistance) using technical indicators with confidence scores, impact levels, and suggested actions. Integrates market regime detection and agent performance insights. Full documentation in NEURONET_GOVERNOR.md.
- **Evolution Tree System**: Tracks agent evolution across generations with 10 mutation types, including performance inheritance and integration with backtesting/stress testing. Includes on-chain identity for agents via soulbound NFTs on Base Sepolia.
- **Quick Backtest System**: Simulates historical data for various trading agents and tracks performance metrics.
- **Enhanced Wallet Tracking**: Multi-protocol DeFi monitoring across various platforms, offering historical snapshots, PnL analysis, and configurable alerts.
- **Stress Testing**: Allows execution of scenarios (e.g., Flash Crash, Liquidity Crisis) to evaluate portfolio impact and agent resilience.
- **Parliament Governance System**: Multi-agent governance with quorum-based voting, weighted votes, live debate simulation, and Meta orchestration summaries. Sessions are persisted to PostgreSQL.
- **Alert System**: Configurable email and webhook notifications for critical system events.
- **Strategy Backtesting**: Historical replay of agent decision-making cycles for performance metrics and strategy comparison.
- **Multi-Wallet Support**: Tracks wallets and token holdings across Ethereum, Base, Fraxtal, and Solana with an aggregate portfolio view.
- **AI Trading Village**: Collaborative multi-agent ecosystem where 10 specialized AI trader agents hunt for trading opportunities and share knowledge, featuring agent roles, personalities, a credit-based economy, detailed trade signals, signal validation, agent collaboration, memory systems, and a real-time thought stream with 12 thought types. Full documentation in NEURONET_GOVERNOR.md.
- **Trade History System**: Comprehensive trade tracking with database persistence (tradeHistory table). Features include:
  - Signal closing with timestamps (signal created, closed) and exit reasons (TP1/TP2/TP3/SL/Manual)
  - AI learning integration: wins confirm successful strategies, losses trigger detailed analysis
  - Agent evolution triggered after 3-loss streaks with AI-generated learning insights
  - Trade History page with filtering by outcome (all/wins/losses) and agent
  - Detailed trade cards showing entry/exit prices, P&L, technical analysis, validators, and lessons learned
  - API endpoints: `/api/village/signals/:id/close` and `/api/village/history`
- **Airdrop Opportunities (Coming Soon)**: AI-powered airdrop discovery and eligibility tracking. Planned features include:
  - Eligibility Checker: AI-powered scanning to check wallet eligibility across upcoming airdrops
  - Sybil Detection Avoidance: Smart strategies to ensure legitimate participation
  - Opportunity Ranking: Scout Agent ranks airdrops by expected value and effort required
  - Auto-Farming Tasks: Automated completion of on-chain interactions to maximize eligibility
  - Community Alerts: Early notifications from agent network monitoring new opportunities
  - Portfolio Tracking: Track claimed and unclaimed airdrops across all connected wallets

## Ultron 3-Layer Hybrid AI Architecture (NEW)

The system has been upgraded to an "Ultron-smart" autonomous multi-agent DeFi trading system using a 3-layer hybrid AI architecture:

### Layer 1: Fast Operations (Gemini Flash)
- Ultra-fast agent debates and discussions
- Real-time thought generation
- Cost-optimized for high-volume operations
- Used for: Signal analysis, market scanning, agent interactions

### Layer 2: Judge Arbitration (GPT-5)
- High-IQ decision making for conflicts
- Mathematical verification and safety checks
- Final authority on trade approvals
- Used for: Overruling agents, validating signals, risk verification

### Layer 3: Local Simulation (Free)
- Cost-free backtesting and stress testing
- Scenario simulation (flash crash, whale dump, etc.)
- No API costs for historical analysis
- Used for: Strategy validation, risk assessment

### Enhanced Agent Personalities
10 Ultron agents with dynamic personalities, emotions, and relationships:
- **Atlas** (Aggressive): Breakout Detection - First to spot momentum shifts
- **Nova** (Conservative): Risk Assessment - Spots danger before it materializes
- **Cipher** (Analytical): Position Sizing - Optimal bet sizing for any scenario
- **Vega** (Contrarian): Sentiment Reversal - Profits from crowd psychology
- **Orion** (Momentum): Early Detection - Spots emerging trends
- **Nebula** (Experimental): Pattern Memory - Recognizes historical market rhymes
- **Phoenix** (Aggressive): Recovery Master - Bounces back from losses stronger
- **Quantum** (Analytical): Pattern Recognition - Sees micro-patterns others miss
- **Echo** (Contrarian): Sentiment Analysis - Reads crowd psychology like a book
- **Apex** (Analytical): Macro Synthesis - Sees the big picture across all timeframes

### Agent Features
- **Emotional States**: confident, cautious, excited, frustrated, curious, skeptical, aggressive, fearful
- **Dynamic Moods**: Changes based on market conditions and interactions
- **Relationships**: Trust, respect, rivalry scores between agents
- **Memory System**: Remembers past trades, debates, and learned patterns
- **Credit Scores**: Performance-based reputation system

### Ultron API Endpoints
- `GET /api/ultron/status` - System status and configuration
- `GET /api/ultron/agents` - All agent statuses and emotions
- `GET /api/ultron/leaderboard` - Agent rankings by credit score
- `GET /api/ultron/thoughts` - Real-time thought stream
- `POST /api/ultron/debate` - Run a multi-agent debate
- `POST /api/ultron/analyze` - Full pipeline analysis for a symbol
- `POST /api/ultron/judge` - Request judge arbitration
- `POST /api/ultron/simulate` - Run stress test simulations

## External Dependencies

### AI Services
- **Ultron 3-Layer Hybrid AI**:
  - **Google Gemini API**: Layer 1 - Fast agent operations and debates via Replit AI Integrations.
  - **OpenAI GPT-5**: Layer 2 - High-IQ judge arbitration and conflict resolution.
  - **Anthropic Claude API**: Fallback for judge layer via Replit AI Integrations.
  - **Local Simulation**: Layer 3 - Free backtesting and stress testing.
- **HybridAIService**: Manages intelligent routing and fallbacks.
- **ADK-TS (IQ AI Agent Development Kit)**: Multi-agent framework.

### Blockchain Integration
- **RainbowKit**: Wallet connection UI.
- **wagmi**: React hooks for Ethereum interactions.
- **viem**: Low-level Ethereum utilities.

### Database
- **Drizzle ORM**: Type-safe ORM for PostgreSQL.
- **Neon Serverless**: PostgreSQL database driver.

### UI Libraries
- **Radix UI**: Headless component primitives.
- **shadcn/ui**: Pre-styled component system.
- **Lucide React**: Icon library.

### Session Management
- **express-session**: Session middleware.
- **connect-pg-simple**: PostgreSQL session store.

### Payment Processing
- **Stripe**: For marketplace agent rentals and NFT minting.
- **stripe-replit-sync**: Stripe schema management and data synchronization.

### Utilities
- **nanoid**: Unique ID generation.
- **date-fns**: Date manipulation.
- **zod**: Runtime type validation.
- **class-variance-authority**: CSS variant utilities.
- **clsx** + **tailwind-merge**: Conditional class name merging.