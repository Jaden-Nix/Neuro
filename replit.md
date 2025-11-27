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

Frontend state is managed using React Query for server state and caching, with a WebSocket hook for real-time updates. Backend state uses in-memory storage with typed interfaces, an event-driven architecture, and real-time broadcasting via WebSockets. Drizzle ORM and Drizzle Kit are used for database schema management, prepared for PostgreSQL.

## External Dependencies

### AI Services
- **Anthropic Claude API**: Core AI engine for agent decision-making (`claude-sonnet-4-5`).

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

### November 27, 2025
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

- **UI Pages Added**:
  - `client/src/pages/Alerts.tsx`: Alert configuration and history
  - `client/src/pages/Backtesting.tsx`: Scenario management and run visualization
  - `client/src/pages/Wallets.tsx`: Multi-wallet dashboard with chain breakdown

- **Stripe Connect Seller Onboarding**: Added marketplace revenue splitting between platform and agent creators
  - `shared/schema.ts`: Added `sellerProfiles` table for Stripe Connect account tracking
  - `server/storage.ts`: Added IStorage interface and MemStorage implementation for seller profiles
  - `server/DatabaseStorage.ts`: Added PostgreSQL-backed seller profile CRUD operations
  - `server/routes.ts`: New seller endpoints:
    - `GET /api/sellers/:walletAddress` - Get seller profile
    - `POST /api/sellers/onboard` - Start Stripe Connect onboarding
    - `GET /api/sellers/:walletAddress/status` - Check onboarding status
    - `GET /api/sellers/:walletAddress/dashboard` - Get Stripe dashboard link
    - `GET /api/sellers/:walletAddress/balance` - Get seller balance

- **Stripe Payment Integration**: Added marketplace payment processing for agent rentals and NFT minting
  - `server/index.ts`: Stripe initialization BEFORE express.json() middleware, webhook handlers
  - `shared/schema.ts`: Added `stripePaymentIntentId` to AgentRental and AgentNFT tables
  - `server/routes.ts`: New payment endpoints (`/api/stripe/rental-payment`, `/api/stripe/mint-payment`, `/api/stripe/confirm-rental`, `/api/stripe/confirm-mint`)
  - `script/seed-stripe-products.ts`: Product seeding script for Stripe (run via `npx tsx script/seed-stripe-products.ts`)

## Important Implementation Notes

### Stripe Connect (Marketplace Revenue Splitting)
- Sellers must complete Stripe Connect onboarding before receiving marketplace payments
- Platform fee is configurable (default 15%) via `stripeService.getPlatformFeePercent()`
- Payment flow for marketplace sales:
  1. Seller completes Connect onboarding (once)
  2. Buyer initiates purchase via `/api/stripe/rental-payment` or `/api/stripe/mint-payment`
  3. `stripeService.createMarketplacePayment()` creates destination charge with application fee
  4. Stripe automatically splits payment: seller receives (100% - platform fee), platform receives fee
- Seller dashboard access via `/api/sellers/:walletAddress/dashboard` for payout management

### Stripe Integration
- Stripe webhook routes are registered BEFORE `express.json()` middleware to receive raw Buffer payloads
- stripe-replit-sync manages the `stripe.*` schema automatically - never manually insert into those tables
- Payment flow: Create payment intent → Frontend collects payment → Confirm endpoint creates rental/NFT record
- Webhook UUID is stored in `process.env.STRIPE_WEBHOOK_UUID` for handler reference