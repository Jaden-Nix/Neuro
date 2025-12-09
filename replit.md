# NeuroNet Governor

## Overview

NeuroNet Governor is an autonomous multi-agent AI system for DeFi protocol governance. It uses a hierarchical agent architecture (Meta, Scout, Risk, Execution agents) to scan markets, evaluate risks, and execute on-chain transactions. The system features self-evolution capabilities, internal credit economy, and on-chain memory storage through smart contracts deployed on Ethereum testnets.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with custom build script
- **UI Components**: shadcn/ui (Radix primitives) with Tailwind CSS
- **State Management**: TanStack React Query for server state
- **Web3**: RainbowKit + wagmi for wallet connections
- **Routing**: wouter (lightweight router)
- **Animations**: Framer Motion

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript (ESM modules)
- **API Pattern**: REST endpoints + WebSocket for real-time updates
- **Build**: esbuild for production bundling

### Multi-Agent System
Four specialized AI agents with distinct roles:
- **Meta Agent**: Central orchestrator, strategic decisions, ML-enhanced predictions
- **Scout Agent**: Market scanning, opportunity detection, yield analysis
- **Risk Agent**: Proposal evaluation, MEV protection, liquidation risk assessment
- **Execution Agent**: Transaction planning, gas optimization, on-chain execution

Agents communicate through a negotiation protocol (Scout→Risk→Execution→Meta) and maintain an internal credit economy where performance affects future decision weight.

### AI Integration
- **Hybrid AI approach**: Claude (Anthropic), Gemini (Google), and GPT (OpenAI) with automatic fallback
- **Replit AI Integrations**: Preferred provider for consolidated billing
- **Rate limiting and circuit breakers**: Built-in protection against API limits
- **Provider-specific routing**: Different agents can use different AI providers

### Database
- **ORM**: Drizzle ORM with PostgreSQL dialect
- **Provider**: Neon serverless PostgreSQL
- **Schema**: Defined in `shared/schema.ts` with agents, logs, credit scores, simulations, alerts, marketplace listings, and more

### Smart Contracts
Solidity contracts for on-chain components:
- **AgentNFT**: Mintable/rentable agent tokens
- **AgentRegistry**: On-chain agent registration and credit tracking
- **MemoryVault**: Persistent strategy storage
- **NeuronBadge**: Evolution proof NFTs (soulbound)
- **NeuroNetHeartbeat**: System liveness checkpoints

Contracts are compiled with solc and deployed via viem to Sepolia and Base Sepolia testnets.

#### Deployed Contract Addresses

**Sepolia (chainId: 11155111):**
- NeuroNetRegistry: `0xc4f97d52334f0de35fec958f24fc5af9c450f8dc`
- NeuroNetStorage: `0x7c2e91efeec7bf481a61a654f36fe6452ca16a07`
- NeuroNetHeartbeat: `0x7ab69aa7543e9ae43b5d01c5622868392252eaad`

**Base Sepolia (chainId: 84532):**
- MemoryVault: `0x12b67629cd47f3703dca82b3bec7e576b3a0fb8f`
- NeuronBadge: `0xb3d0b4aba1d5a482df702edf87dea8b146321d3b`

### Real-Time Features
- WebSocket server for live agent logs and status updates
- Sentinel monitoring for wallet health and anomaly detection
- Autonomous cycle manager for continuous market scanning

## External Dependencies

### AI Providers
- **Anthropic Claude**: Agent reasoning and complex decisions (claude-sonnet-4-5)
- **Google Gemini**: Fast market analysis and opportunity scanning (gemini-2.5-flash)
- **OpenAI GPT**: Additional reasoning layer (gpt-5)
- All configured through Replit AI Integrations or direct API keys

### Blockchain
- **Networks**: Ethereum Sepolia, Base Sepolia (testnets)
- **RPC**: Public nodes via viem chains
- **Contracts**: OpenZeppelin base contracts (ERC721, Ownable, ReentrancyGuard)

### Payments
- **Stripe**: Marketplace payments, agent rentals, Connect accounts for sellers
- **stripe-replit-sync**: Automatic schema sync and webhook management

### Database
- **Neon**: Serverless PostgreSQL (requires DATABASE_URL env var)

### Market Data
- **CCXT**: Cryptocurrency exchange integration for price feeds
- Custom market data service with fallback providers

### Authentication
- Wallet-based auth via RainbowKit/wagmi
- Session management with express-session