# NeuroNet Governor

## Overview

NeuroNet Governor is an advanced multi-agent DeFi governance system with autonomous decision-making, on-chain execution, and self-evolution capabilities. The system orchestrates multiple AI agents (Scout, Risk, Execution, Meta) that collaborate through a negotiation protocol to identify opportunities, assess risks, and execute transactions across multiple blockchain networks (Ethereum, Base, Fraxtal).

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Multi-Agent Architecture
The system uses a hierarchical agent structure with specialized roles:
- **Meta Agent**: Central orchestrator making final decisions with ML insights
- **Scout Agent**: Market intelligence and opportunity detection using AI analysis
- **Risk Agent**: Safety evaluation with MEV protection and risk scoring
- **Execution Agent**: Transaction planning and on-chain execution

Agents communicate through a structured negotiation workflow (Scout→Risk→Execution→Meta) and maintain individual credit scores based on performance.

### AI Integration Layer
The system supports multiple AI providers with automatic fallback:
- **Primary**: Google Gemini (via Replit AI Integrations)
- **Secondary**: Anthropic Claude
- **Tertiary**: OpenAI GPT

AI services are accessed through `server/ai/` with rate limiting, circuit breakers, and retry logic. The `HybridAIService` and `UltronHybridAI` handle provider selection and failover.

### Frontend Architecture
- **Framework**: React with TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui with Radix primitives
- **Styling**: Tailwind CSS with dark/light theme support
- **State Management**: TanStack Query for server state
- **Web3**: RainbowKit + wagmi for wallet connections

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API**: REST endpoints with WebSocket for real-time updates
- **Build**: esbuild for production bundling

### Database
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL (Neon serverless)
- **Schema**: Defined in `shared/schema.ts`
- **Migrations**: Located in `migrations/` directory

### Smart Contracts
Solidity contracts deployed to testnets:
- **MemoryVault**: On-chain storage for strategies and learning milestones
- **NeuronBadge**: NFT badges for evolution events and achievements
- **NeuroNetRegistry/Storage/Heartbeat**: Agent registration and state management

Contracts are compiled with `scripts/compile.ts` and deployed via `scripts/deploy-viem.ts`.

## External Dependencies

### AI Services (via Replit AI Integrations)
- Google Gemini API for fast analysis
- Anthropic Claude for complex reasoning
- OpenAI GPT for additional coverage

### Blockchain Networks
- Ethereum Sepolia (testnet)
- Base Sepolia (testnet)
- Uses viem for blockchain interactions

### Payment Processing
- Stripe integration for marketplace payments
- Connected accounts for seller payouts

### Market Data
- CCXT adapter for exchange data
- Live price feeds for trading signals

### Database
- Neon PostgreSQL (serverless)
- WebSocket connection for real-time sync