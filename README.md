# NeuroNet Governor

**Advanced Multi-Agent DeFi Governance System with On-Chain Execution**

NeuroNet Governor is a sophisticated autonomous AI system for managing DeFi protocols through a multi-agent architecture, self-evolution capabilities, and on-chain execution with ATP (Agent Transfer Protocol) integration.

## 🌟 Features

### Multi-Agent Architecture
- **Meta-Agent**: Central orchestrator and decision-maker
- **Scout Agent**: Scans liquidity, prices, and arbitrage opportunities
- **Risk Agent**: Evaluates proposals and blocks high-risk decisions
- **Execution Agent**: Creates and executes safe on-chain transactions

### Core Capabilities
- **Internal Credit Economy**: Agents earn/lose credits based on performance
- **Negotiation Protocol**: Structured Scout→Risk→Execution→Meta workflow
- **Future Fork Simulation**: Predicts price, volatility, TVL, yield, and peg deviations
- **Self-Healing Engine**: Automatically deprecates and replaces low-performing agents
- **On-Chain Memory Vault**: Stores strategies, patterns, and learning milestones
- **Sentinel Mode**: 24/7 monitoring of wallet health, liquidity, and anomalies
- **Replay Engine**: Complete decision timeline with visualization

### Frontend Features
- **Cinematic UI**: Animated NeuroNet Core with orbiting sub-agents
- **Real-Time Logs**: Live streaming with personality-based coloring
- **Risk Heatmap**: Visual grid representation of risk levels
- **Control Panel**: Run simulations, toggle autonomous mode, manual override
- **Time-Warp Slider**: Navigate through decision history
- **Developer Panel**: Advanced debugging with logs, simulations, credits, and memory vault
- **Multi-Chain Support**: Ethereum, Base, and Fraxtal networks
- **Dark/Light Mode**: Full theme support

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- Replit account (for AI Integrations)

### Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add:
- `VITE_WALLETCONNECT_PROJECT_ID`: Get from [WalletConnect Cloud](https://cloud.walletconnect.com/)
- `SESSION_SECRET`: Any random string for session management

4. Start the development server:
```bash
npm run dev
```

The app will be available at `http://localhost:5000`

## 🏗️ Architecture

### Frontend Stack
- **React 18** with TypeScript
- **Tailwind CSS** for styling
- **Framer Motion** for animations
- **Wagmi** + **Viem** for Web3 interactions
- **RainbowKit** for wallet connections
- **TanStack Query** for data fetching

### Backend Stack
- **Express.js** API server
- **WebSocket** for real-time updates
- **Anthropic AI** (via Replit AI Integrations - no API key needed)
- **Viem** for on-chain interactions
- **In-Memory Storage** (can be upgraded to PostgreSQL)

### Agent System
- **Multi-Agent Orchestration**: Custom framework for agent coordination
- **Personality Modules**: Each agent has distinct behavior patterns
- **Credit Economy**: JSON-based ledger tracking performance
- **ATP Integration**: Agent metadata and evolution protocol

## 📁 Project Structure

```
├── client/                 # Frontend application
│   ├── src/
│   │   ├── components/     # React components
│   │   │   ├── NeuroNetCore.tsx      # Central visualization
│   │   │   ├── LogStream.tsx         # Real-time logs
│   │   │   ├── RiskHeatmap.tsx       # Risk matrix
│   │   │   ├── MetricsDashboard.tsx  # Live metrics
│   │   │   ├── ControlPanel.tsx      # Action buttons
│   │   │   ├── TimeWarpSlider.tsx    # Timeline navigator
│   │   │   ├── DeveloperPanel.tsx    # Debug interface
│   │   │   └── Header.tsx            # App header
│   │   ├── pages/          # Page components
│   │   │   └── Dashboard.tsx         # Main dashboard
│   │   ├── contexts/       # React contexts
│   │   │   └── ThemeContext.tsx      # Dark/light mode
│   │   ├── lib/            # Utilities
│   │   │   ├── wagmi.ts              # Web3 config
│   │   │   └── queryClient.ts        # API client
│   │   └── App.tsx         # Root component
│   └── index.html
├── server/                 # Backend application
│   ├── agents/            # Agent implementations (to be built)
│   ├── simulation/        # Simulation engine (to be built)
│   ├── routes.ts          # API routes
│   └── storage.ts         # Data storage
├── shared/                # Shared types
│   └── schema.ts          # TypeScript interfaces
└── design_guidelines.md   # UI/UX specifications
```

## 🎨 Design System

The UI follows a **cinematic, minimal, sci-fi** aesthetic with:
- **Fonts**: Inter (body), Space Grotesk (headings), JetBrains Mono (code)
- **Colors**: Custom agent personality colors (Scout: green, Risk: orange, Execution: purple, Meta: blue)
- **Animations**: Subtle Framer Motion effects for Core visualization
- **Spacing**: Consistent 2, 4, 6, 8, 12, 16, 20, 24 units

See `design_guidelines.md` for complete specifications.

## 🔌 API Endpoints (Backend - Phase 2)

```
GET  /api/system/state      - System state and config
GET  /api/agents            - List all agents
GET  /api/metrics           - Live system metrics
GET  /api/logs              - Recent log entries
GET  /api/credits           - Agent credit scores
GET  /api/memory            - Memory vault entries
GET  /api/simulations       - Simulation tree data
GET  /api/replay/events     - Timeline events
POST /api/simulate          - Run new simulation
POST /api/autonomous/toggle - Toggle autonomous mode
POST /api/execute           - Manual execution
```

## 🧪 Testing

Run end-to-end tests:
```bash
npm run test
```

## 🌐 Multi-Chain Support

Supported networks:
- **Ethereum Mainnet**
- **Base**
- **Fraxtal**

Coming soon:
- **Solana** (via Helius RPC)

## 🔐 Security

- Environment variables for sensitive data
- Replit AI Integrations for API key management
- Session-based authentication
- Input validation with Zod schemas

## 📊 Agent Economy

Each agent earns credits based on:
- **Scout**: Accuracy of market predictions
- **Risk**: Quality of risk assessments and vetoes
- **Execution**: Successful transaction execution
- **Meta-Agent**: Overall system performance

Agents below a credit threshold are automatically deprecated and replaced with evolved versions.

## 🎯 Future Roadmap

Phase 2 (Backend):
- [ ] Complete multi-agent orchestration
- [ ] Negotiation protocol implementation
- [ ] Simulation engine with EV scoring
- [ ] Memory Vault smart contract deployment
- [ ] ATP integration

Phase 3 (Integration):
- [ ] WebSocket real-time updates
- [ ] Full wallet integration
- [ ] On-chain transaction execution
- [ ] E2E testing suite

Phase 4 (Advanced):
- [ ] Solana support
- [ ] MEV protection
- [ ] Machine learning layer
- [ ] Agent marketplace

## 🤝 Contributing

This is a hackathon/demo project. Contributions welcome!

## 📄 License

MIT License

## 🙏 Credits

Built with:
- [Anthropic Claude](https://www.anthropic.com/) via Replit AI Integrations
- [RainbowKit](https://www.rainbowkit.com/) for wallet connections
- [Wagmi](https://wagmi.sh/) for Web3 hooks
- [Framer Motion](https://www.framer.com/motion/) for animations

---

**NeuroNet Governor** - Where autonomous AI meets DeFi governance 🧠⚡
