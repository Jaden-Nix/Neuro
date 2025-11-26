# NeuroNet Governor Design Guidelines

## Design Approach

**Selected Approach**: Custom Futuristic Dashboard (Reference-based)
- **Primary References**: Linear (clean interface), Stripe Dashboard (data clarity), Coinbase Advanced Trading (technical precision)
- **Aesthetic Direction**: Ultra-clean, cinematic, minimal with sci-fi undertones
- **Key Principle**: Data-rich clarity meets cinematic motion design

## Core Design Philosophy

This is a **command center** for autonomous AI agents managing DeFi protocols. The interface must feel:
- **Sovereign**: User is overseeing powerful autonomous systems
- **Precise**: Every element communicates technical information clearly
- **Cinematic**: Motion and spatial design create immersive experience
- **Confident**: No apologetic design - bold, decisive layouts

## Layout System

**Spacing Primitives**: Use Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24
- Micro spacing: 2, 4 (internal component padding)
- Standard spacing: 6, 8, 12 (component margins, gaps)
- Section spacing: 16, 20, 24 (major layout divisions)

**Grid Structure**:
- Dashboard uses 24-column grid system for precise control panel layouts
- Central visualization: 60% width, side panels: 20% each
- Asymmetric layouts emphasize the central NeuroNet Core

## Typography Hierarchy

**Font Stack**: 
- **Primary**: Inter (system interface, data, logs) - weights 400, 500, 600, 700
- **Accent**: JetBrains Mono (code, addresses, technical data) - weight 400, 500
- **Display**: Space Grotesk (headers, agent names) - weights 500, 700

**Scale**:
- Hero/Core Title: text-4xl to text-5xl (Space Grotesk 700)
- Section Headers: text-xl to text-2xl (Space Grotesk 500)
- Agent Names: text-lg (Space Grotesk 500)
- Body/Interface: text-sm to text-base (Inter 400-500)
- Data/Logs: text-xs to text-sm (JetBrains Mono 400)
- Micro-labels: text-xs (Inter 500)

## Component Library

### Core Visualization
**NeuroNet Core (Central Node)**:
- Large circular visualization (400-600px diameter) at viewport center
- Pulsing glow effect with concentric rings
- Three orbiting sub-agent nodes (120-150px diameter each)
- Connecting lines with animated data flow particles
- Backdrop blur container (backdrop-blur-xl) with subtle border

**Sub-Agent Cards**:
- Circular avatars with agent type icon
- Floating card on hover showing: name, status, credit score, current task
- Personality-based micro-animations (Scout bounces, Risk is steady, Execution is rigid)

### Data Display Components

**Real-Time Log Stream**:
- Fixed-height scrollable container (h-96)
- Monospace font (JetBrains Mono)
- Timestamp + Agent Icon + Message format
- Auto-scroll with manual override
- Personality-colored accent per agent type

**Risk Heatmap**:
- Grid-based visualization (8x8 or 12x12 cells)
- Gradient intensity representing risk levels
- Hover tooltips with specific risk metrics
- Time-based animation showing evolution

**Metrics Dashboard**:
- Compact stat cards in grid (grid-cols-2 lg:grid-cols-4)
- Large number (text-3xl) + small label (text-xs)
- Trend indicators (↑↓ with percentage)
- Sparkline micro-charts where relevant

### Control Elements

**Primary Action Buttons**:
- Large, prominent (h-12 to h-14)
- Wide spacing (px-8)
- Icons + Text labels
- Glow effect on active state
- Examples: "Run Simulation", "Enter Autonomous Mode", "Manual Override"

**Time-Warp Slider**:
- Full-width component (w-full max-w-2xl)
- Thick track with timestamp markers
- Large draggable handle
- Real-time preview of simulated state
- Timeline visualization beneath slider

**Secondary Controls**:
- Compact icon buttons (h-10 w-10)
- Grouped in toolbars
- Tooltips on hover
- Examples: settings, refresh, expand/collapse

### Navigation

**Top Bar**:
- Fixed header (h-16)
- Logo + App Name (left)
- Wallet connection (RainbowKit) (right)
- Status indicators (center): System Status, Active Agents, Chain Health
- Backdrop blur background (backdrop-blur-lg)

**Side Panel (Developer Mode)**:
- Collapsible drawer (w-96)
- Tabbed interface: Logs / Simulation Trees / Credit Economy / Memory Vault
- Dense information display
- Resizable width

### Data Visualization

**Simulation Tree Viewer**:
- Hierarchical node graph
- Expandable/collapsable branches
- Color-coded outcomes (success/failure/pending)
- EV scores displayed on nodes
- Pan and zoom controls

**Credit Economy Display**:
- Agent comparison table
- Bar charts showing credit distribution
- Historical performance line graphs
- Transaction log

**Memory Vault Inspector**:
- Searchable/filterable strategy list
- Card-based layout for memories
- Tags: successful, blocked, high-risk, learned
- Timestamp and outcome indicators

## Animation Strategy

**Strategic Motion** (using Framer Motion sparingly):
1. **Core Visualization**: Continuous subtle rotation (slow), pulsing glow, orbital motion
2. **Connecting Lines**: Animated data particles flowing between nodes
3. **Mode Transitions**: Smooth fade/scale transitions when entering Autonomous Mode
4. **Page Transitions**: Minimal - prefer instant navigation with subtle fades
5. **Data Updates**: Number counters animate on change, new logs fade in

**Performance**: 
- Use CSS transforms (translate, scale, rotate)
- Avoid animating width/height
- Limit simultaneous animations to 3-4 major elements
- Disable motion if prefers-reduced-motion

## Responsive Behavior

**Desktop (1920px+)**: Full dashboard layout with side panels
**Laptop (1280-1919px)**: Condensed side panels, smaller Core visualization
**Tablet (768-1279px)**: Stack panels vertically, simplified Core, collapsible sections
**Mobile (< 768px)**: Single column, tabbed interface, Core becomes header element

## Special Considerations

**Web3 Integration**:
- Wallet button prominently placed (top-right)
- Network indicator always visible
- Transaction status toasts (top-right corner)
- Account balance and gas prices displayed

**Real-Time Updates**:
- WebSocket indicators showing connection status
- Pulsing dot for active monitoring
- Stale data warnings if connection lost

**Developer Panel**:
- Hidden by default (keyboard shortcut or icon to reveal)
- Technical aesthetic - dense data, no hand-holding
- Export/copy buttons for logs and data

## Personality Expression

Each agent type has visual personality:
- **Scout**: Energetic - faster animations, brighter accents, curious icons (🔍)
- **Risk**: Cautious - steady animations, warning indicators, shield icons (🛡️)
- **Execution**: Precise - rigid movements, success/failure states, gear icons (⚙️)
- **Meta-Agent**: Sovereign - slow, authoritative motion, crown/brain icons (🧠)

## Images

No hero images needed for this dashboard application. Focus on data visualization and iconography.

**Icon Strategy**:
- Use Heroicons for UI controls and navigation
- Custom SVG icons for agents and states
- Network/chain logos from official sources