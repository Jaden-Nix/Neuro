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

## External Dependencies

### AI Services
- **Anthropic Claude API**: Primary AI engine for all agent decision-making
  - Accessed through Replit AI Integrations (`AI_INTEGRATIONS_ANTHROPIC_API_KEY`, `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`)
  - Used by Meta, Scout, Risk, and Execution agents for natural language reasoning
  - Requires API key configuration through environment variables

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