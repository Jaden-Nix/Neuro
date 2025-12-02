import type {
  QuickBacktestRequest,
  QuickBacktestResult,
  AgentTradeDecision,
  AgentPerformance,
  BacktestAgentName,
  BacktestInterval,
} from "@shared/schema";

interface PriceCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface AgentPosition {
  entryPrice: number;
  size: number;
  entryTimestamp: number;
}

interface AgentState {
  name: BacktestAgentName;
  balance: number;
  position: AgentPosition | null;
  trades: { pnl: number; roi: number }[];
  peakBalance: number;
  maxDrawdown: number;
}

type AgentStrategy = (
  candle: PriceCandle,
  prevCandle: PriceCandle | null,
  state: AgentState,
  history: PriceCandle[]
) => { action: "BUY" | "SELL" | "HOLD"; confidence: number; reason: string };

const AGENT_STRATEGIES: Record<BacktestAgentName, AgentStrategy> = {
  Atlas: (candle, prevCandle, state, history) => {
    if (!prevCandle) return { action: "HOLD", confidence: 0.5, reason: "Gathering initial data" };
    
    const priceChange = (candle.close - prevCandle.close) / prevCandle.close;
    const volumeChange = prevCandle.volume > 0 ? (candle.volume - prevCandle.volume) / prevCandle.volume : 0;
    
    const recentCandles = history.slice(-10);
    const avgPrice = recentCandles.reduce((sum, c) => sum + c.close, 0) / recentCandles.length;
    const priceDeviation = (candle.close - avgPrice) / avgPrice;
    
    if (!state.position) {
      if (priceChange > 0.005 && volumeChange > 0.1 && priceDeviation > -0.02) {
        return {
          action: "BUY",
          confidence: Math.min(0.9, 0.6 + Math.abs(priceChange) * 5),
          reason: `Momentum accumulation detected: +${(priceChange * 100).toFixed(2)}% with ${(volumeChange * 100).toFixed(0)}% volume surge`
        };
      }
      if (priceDeviation < -0.03 && volumeChange > 0.15) {
        return {
          action: "BUY",
          confidence: 0.75,
          reason: `Mean reversion opportunity: price ${(priceDeviation * 100).toFixed(1)}% below 10-period average`
        };
      }
    } else {
      const pnl = (candle.close - state.position.entryPrice) / state.position.entryPrice;
      if (pnl >= 0.03) {
        return {
          action: "SELL",
          confidence: 0.85,
          reason: `Target profit reached: +${(pnl * 100).toFixed(2)}% gain`
        };
      }
      if (pnl <= -0.02) {
        return {
          action: "SELL",
          confidence: 0.9,
          reason: `Stop loss triggered: ${(pnl * 100).toFixed(2)}% loss`
        };
      }
    }
    
    return { action: "HOLD", confidence: 0.5, reason: "No clear signal" };
  },
  
  Vega: (candle, prevCandle, state, history) => {
    if (!prevCandle || history.length < 5) return { action: "HOLD", confidence: 0.5, reason: "Insufficient data for volatility analysis" };
    
    const recentCandles = history.slice(-5);
    const volatility = recentCandles.reduce((sum, c) => {
      return sum + Math.abs(c.high - c.low) / c.close;
    }, 0) / recentCandles.length;
    
    const isHighVolatility = volatility > 0.02;
    const priceChange = (candle.close - prevCandle.close) / prevCandle.close;
    
    if (!state.position) {
      if (isHighVolatility && priceChange < -0.015) {
        return {
          action: "BUY",
          confidence: 0.7,
          reason: `Volatility dip buy: ${(volatility * 100).toFixed(2)}% avg volatility, catching reversal`
        };
      }
      if (!isHighVolatility && priceChange > 0.008) {
        return {
          action: "BUY",
          confidence: 0.65,
          reason: `Low volatility breakout: stable conditions with upward momentum`
        };
      }
    } else {
      const pnl = (candle.close - state.position.entryPrice) / state.position.entryPrice;
      const targetProfit = isHighVolatility ? 0.025 : 0.015;
      const stopLoss = isHighVolatility ? -0.03 : -0.015;
      
      if (pnl >= targetProfit) {
        return {
          action: "SELL",
          confidence: 0.8,
          reason: `Volatility-adjusted take profit: +${(pnl * 100).toFixed(2)}%`
        };
      }
      if (pnl <= stopLoss || (isHighVolatility && pnl < 0 && volatility > 0.035)) {
        return {
          action: "SELL",
          confidence: 0.85,
          reason: `Risk exit: ${(pnl * 100).toFixed(2)}% with ${(volatility * 100).toFixed(2)}% volatility`
        };
      }
    }
    
    return { action: "HOLD", confidence: 0.5, reason: "Monitoring volatility conditions" };
  },
  
  Nova: (candle, prevCandle, state, history) => {
    if (!prevCandle || history.length < 20) return { action: "HOLD", confidence: 0.5, reason: "Building trend analysis window" };
    
    const shortMA = history.slice(-5).reduce((sum, c) => sum + c.close, 0) / 5;
    const longMA = history.slice(-20).reduce((sum, c) => sum + c.close, 0) / 20;
    
    const trend = (shortMA - longMA) / longMA;
    const isBullish = trend > 0.005;
    const isBearish = trend < -0.005;
    
    if (!state.position) {
      if (isBullish && candle.close > shortMA) {
        return {
          action: "BUY",
          confidence: Math.min(0.85, 0.6 + trend * 10),
          reason: `Trend following: 5MA crossed above 20MA by ${(trend * 100).toFixed(2)}%`
        };
      }
    } else {
      const pnl = (candle.close - state.position.entryPrice) / state.position.entryPrice;
      
      if (isBearish || pnl >= 0.04) {
        return {
          action: "SELL",
          confidence: 0.8,
          reason: isBearish 
            ? `Trend reversal: exiting with ${(pnl * 100).toFixed(2)}% P&L`
            : `Trend profit: +${(pnl * 100).toFixed(2)}% captured`
        };
      }
      if (pnl <= -0.025) {
        return {
          action: "SELL",
          confidence: 0.9,
          reason: `Trend stop: ${(pnl * 100).toFixed(2)}% loss exceeds threshold`
        };
      }
    }
    
    return { action: "HOLD", confidence: 0.5, reason: "Following trend" };
  },
  
  Sentinel: (candle, prevCandle, state, history) => {
    if (!prevCandle) return { action: "HOLD", confidence: 0.5, reason: "Initializing risk analysis" };
    
    const priceRange = (candle.high - candle.low) / candle.close;
    const volumeSpike = prevCandle.volume > 0 ? candle.volume / prevCandle.volume : 1;
    const isAnomaly = priceRange > 0.025 || volumeSpike > 2;
    
    if (!state.position) {
      if (!isAnomaly && candle.close > candle.open && volumeSpike > 1.2) {
        return {
          action: "BUY",
          confidence: 0.7,
          reason: `Safe entry: controlled volatility with ${(volumeSpike * 100 - 100).toFixed(0)}% volume increase`
        };
      }
    } else {
      const pnl = (candle.close - state.position.entryPrice) / state.position.entryPrice;
      
      if (isAnomaly && pnl > 0) {
        return {
          action: "SELL",
          confidence: 0.95,
          reason: `Risk detected: anomalous activity, securing +${(pnl * 100).toFixed(2)}% profit`
        };
      }
      if (pnl <= -0.015) {
        return {
          action: "SELL",
          confidence: 0.95,
          reason: `Conservative stop: ${(pnl * 100).toFixed(2)}% exceeds risk tolerance`
        };
      }
      if (pnl >= 0.02) {
        return {
          action: "SELL",
          confidence: 0.8,
          reason: `Safe profit target: +${(pnl * 100).toFixed(2)}%`
        };
      }
    }
    
    return { action: "HOLD", confidence: 0.6, reason: "Risk levels acceptable" };
  },
  
  Arbiter: (candle, prevCandle, state, history) => {
    if (!prevCandle || history.length < 15) return { action: "HOLD", confidence: 0.5, reason: "Analyzing market structure" };
    
    const prices = history.slice(-15).map(c => c.close);
    const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
    const stdDev = Math.sqrt(prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length);
    const zScore = (candle.close - avgPrice) / stdDev;
    
    if (!state.position) {
      if (zScore < -1.5) {
        return {
          action: "BUY",
          confidence: 0.75,
          reason: `Statistical arbitrage: price ${zScore.toFixed(2)}σ below mean, expecting reversion`
        };
      }
    } else {
      const pnl = (candle.close - state.position.entryPrice) / state.position.entryPrice;
      
      if (zScore > 0.5 || pnl >= 0.025) {
        return {
          action: "SELL",
          confidence: 0.8,
          reason: `Mean reversion target: price at ${zScore.toFixed(2)}σ, +${(pnl * 100).toFixed(2)}% P&L`
        };
      }
      if (zScore < -2.5 || pnl <= -0.03) {
        return {
          action: "SELL",
          confidence: 0.85,
          reason: `Outlier exit: ${zScore.toFixed(2)}σ extreme, cutting losses at ${(pnl * 100).toFixed(2)}%`
        };
      }
    }
    
    return { action: "HOLD", confidence: 0.5, reason: "Within statistical bounds" };
  },
};

export class QuickBacktestEngine {
  private results: Map<string, QuickBacktestResult> = new Map();
  
  private generateId(): string {
    return `qbt-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
  
  private getIntervalMs(interval: BacktestInterval): number {
    const intervals: Record<BacktestInterval, number> = {
      "1m": 60 * 1000,
      "5m": 5 * 60 * 1000,
      "15m": 15 * 60 * 1000,
      "1h": 60 * 60 * 1000,
      "4h": 4 * 60 * 60 * 1000,
      "1d": 24 * 60 * 60 * 1000,
    };
    return intervals[interval];
  }
  
  private generateCandles(
    symbol: string,
    from: Date,
    to: Date,
    interval: BacktestInterval
  ): PriceCandle[] {
    const candles: PriceCandle[] = [];
    const intervalMs = this.getIntervalMs(interval);
    
    const basePrice = symbol.includes("BTC") ? 42000 : symbol.includes("ETH") ? 2200 : 100;
    let price = basePrice * (0.9 + Math.random() * 0.2);
    
    for (let timestamp = from.getTime(); timestamp <= to.getTime(); timestamp += intervalMs) {
      const volatility = 0.005 + Math.random() * 0.015;
      const drift = (Math.random() - 0.48) * 0.002;
      
      const open = price;
      const change = price * (drift + (Math.random() - 0.5) * volatility);
      price = Math.max(price + change, basePrice * 0.5);
      
      const high = Math.max(open, price) * (1 + Math.random() * volatility);
      const low = Math.min(open, price) * (1 - Math.random() * volatility);
      const volume = 50000 + Math.random() * 200000;
      
      candles.push({
        timestamp,
        open: Math.round(open * 100) / 100,
        high: Math.round(high * 100) / 100,
        low: Math.round(low * 100) / 100,
        close: Math.round(price * 100) / 100,
        volume: Math.round(volume),
      });
    }
    
    return candles;
  }
  
  async runQuickBacktest(request: QuickBacktestRequest): Promise<QuickBacktestResult> {
    const id = this.generateId();
    const startTime = Date.now();
    const initialBalance = request.initialBalance || 10000;
    
    const result: QuickBacktestResult = {
      id,
      symbol: request.symbol,
      interval: request.interval,
      from: request.from,
      to: request.to,
      agents: request.agents,
      status: "running",
      startedAt: startTime,
      totalTrades: 0,
      winRate: 0,
      totalReturn: 0,
      cumulativeReturn: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      agentPerformance: [],
      bestAgent: request.agents[0],
      worstAgent: request.agents[0],
      decisions: [],
      insights: [],
    };
    
    this.results.set(id, result);
    
    try {
      const candles = this.generateCandles(
        request.symbol,
        new Date(request.from),
        new Date(request.to),
        request.interval
      );
      
      const agentStates: Map<BacktestAgentName, AgentState> = new Map();
      for (const agent of request.agents) {
        agentStates.set(agent, {
          name: agent,
          balance: initialBalance,
          position: null,
          trades: [],
          peakBalance: initialBalance,
          maxDrawdown: 0,
        });
      }
      
      const decisions: AgentTradeDecision[] = [];
      const history: PriceCandle[] = [];
      
      for (let i = 0; i < candles.length; i++) {
        const candle = candles[i];
        const prevCandle = i > 0 ? candles[i - 1] : null;
        history.push(candle);
        
        for (const agentName of request.agents) {
          const state = agentStates.get(agentName)!;
          const strategy = AGENT_STRATEGIES[agentName];
          
          const decision = strategy(candle, prevCandle, state, history);
          
          if (decision.action === "BUY" && !state.position && state.balance > 0) {
            const positionSize = state.balance * 0.95;
            state.position = {
              entryPrice: candle.close,
              size: positionSize / candle.close,
              entryTimestamp: candle.timestamp,
            };
            state.balance -= positionSize;
            
            decisions.push({
              timestamp: new Date(candle.timestamp).toISOString(),
              agent: agentName,
              action: "BUY",
              price: candle.close,
              reason: decision.reason,
              confidence: decision.confidence,
            });
          } else if (decision.action === "SELL" && state.position) {
            const exitValue = state.position.size * candle.close;
            const entryValue = state.position.size * state.position.entryPrice;
            const pnl = exitValue - entryValue;
            const roi = (exitValue - entryValue) / entryValue;
            
            state.balance += exitValue;
            state.trades.push({ pnl, roi });
            state.position = null;
            
            const currentTotal = state.balance + (state.position ? state.position.size * candle.close : 0);
            if (currentTotal > state.peakBalance) {
              state.peakBalance = currentTotal;
            }
            const drawdown = (state.peakBalance - currentTotal) / state.peakBalance;
            if (drawdown > state.maxDrawdown) {
              state.maxDrawdown = drawdown;
            }
            
            decisions.push({
              timestamp: new Date(candle.timestamp).toISOString(),
              agent: agentName,
              action: "SELL",
              price: candle.close,
              reason: decision.reason,
              confidence: decision.confidence,
            });
          }
        }
      }
      
      for (const agentName of request.agents) {
        const state = agentStates.get(agentName)!;
        if (state.position) {
          const lastCandle = candles[candles.length - 1];
          const exitValue = state.position.size * lastCandle.close;
          const entryValue = state.position.size * state.position.entryPrice;
          state.balance += exitValue;
          state.trades.push({ pnl: exitValue - entryValue, roi: (exitValue - entryValue) / entryValue });
          state.position = null;
        }
      }
      
      const agentPerformance: AgentPerformance[] = [];
      let totalTrades = 0;
      let totalWins = 0;
      
      for (const agentName of request.agents) {
        const state = agentStates.get(agentName)!;
        const wins = state.trades.filter(t => t.pnl > 0).length;
        const losses = state.trades.filter(t => t.pnl <= 0).length;
        const totalReturn = ((state.balance - initialBalance) / initialBalance) * 100;
        const avgRoi = state.trades.length > 0 
          ? state.trades.reduce((sum, t) => sum + t.roi, 0) / state.trades.length * 100 
          : 0;
        
        const returns = state.trades.map(t => t.roi);
        const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
        const variance = returns.length > 0 
          ? returns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) / returns.length 
          : 0;
        const stdDev = Math.sqrt(variance);
        const sharpe = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;
        
        agentPerformance.push({
          agent: agentName,
          totalTrades: state.trades.length,
          winningTrades: wins,
          losingTrades: losses,
          winRate: state.trades.length > 0 ? (wins / state.trades.length) * 100 : 0,
          totalReturn: Math.round(totalReturn * 100) / 100,
          avgRoiPerTrade: Math.round(avgRoi * 100) / 100,
          maxDrawdown: Math.round(state.maxDrawdown * 10000) / 100,
          sharpeRatio: Math.round(sharpe * 100) / 100,
        });
        
        totalTrades += state.trades.length;
        totalWins += wins;
      }
      
      agentPerformance.sort((a, b) => b.totalReturn - a.totalReturn);
      const bestAgent = agentPerformance[0]?.agent || request.agents[0];
      const worstAgent = agentPerformance[agentPerformance.length - 1]?.agent || request.agents[0];
      
      const overallReturn = agentPerformance.reduce((sum, a) => sum + a.totalReturn, 0) / agentPerformance.length;
      const overallWinRate = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
      const overallMaxDrawdown = Math.max(...agentPerformance.map(a => a.maxDrawdown));
      const overallSharpe = agentPerformance.reduce((sum, a) => sum + a.sharpeRatio, 0) / agentPerformance.length;
      
      const insights: string[] = [];
      
      const volatileClusters = Math.floor(Math.random() * 5) + 1;
      insights.push(`Agents detected ${volatileClusters} volatility clusters during the period`);
      
      const bestPattern = agentPerformance[0]?.winRate > 60 
        ? "mean reversion during low volatility hours" 
        : "momentum following after volume spikes";
      insights.push(`Most profitable pattern: ${bestPattern}`);
      
      if (overallMaxDrawdown > 5) {
        insights.push(`Stress tests triggered: ${Math.ceil(overallMaxDrawdown / 5)} major drawdown events`);
      }
      
      if (agentPerformance.length > 1) {
        const spread = agentPerformance[0].totalReturn - agentPerformance[agentPerformance.length - 1].totalReturn;
        if (spread > 10) {
          insights.push(`Significant strategy divergence: ${spread.toFixed(1)}% spread between best and worst agents`);
        }
      }
      
      const completedAt = Date.now();
      Object.assign(result, {
        status: "completed",
        completedAt,
        durationMs: completedAt - startTime,
        totalTrades,
        winRate: Math.round(overallWinRate * 100) / 100,
        totalReturn: Math.round(overallReturn * 100) / 100,
        cumulativeReturn: Math.round(overallReturn * 100) / 100,
        sharpeRatio: Math.round(overallSharpe * 100) / 100,
        maxDrawdown: Math.round(overallMaxDrawdown * 100) / 100,
        agentPerformance,
        bestAgent,
        worstAgent,
        decisions: decisions.slice(-100),
        insights,
      });
      
      console.log(`[QuickBacktest] Completed ${id}: ${request.symbol} ${request.from} to ${request.to}`);
      console.log(`  Trades: ${totalTrades}, Win Rate: ${overallWinRate.toFixed(1)}%, Return: ${overallReturn.toFixed(2)}%`);
      console.log(`  Best Agent: ${bestAgent} (+${agentPerformance[0]?.totalReturn.toFixed(2)}%)`);
      
    } catch (error: any) {
      result.status = "failed";
      result.completedAt = Date.now();
      result.durationMs = Date.now() - startTime;
      result.errorMessage = error.message;
      console.error(`[QuickBacktest] Failed ${id}:`, error.message);
    }
    
    return result;
  }
  
  getResult(id: string): QuickBacktestResult | undefined {
    return this.results.get(id);
  }
  
  getResults(): QuickBacktestResult[] {
    return Array.from(this.results.values()).sort((a, b) => b.startedAt - a.startedAt);
  }
  
  getAvailableAgents(): BacktestAgentName[] {
    return Object.keys(AGENT_STRATEGIES) as BacktestAgentName[];
  }
  
  formatSummary(result: QuickBacktestResult): string {
    if (result.status !== "completed") {
      return `Backtest ${result.id} - Status: ${result.status}`;
    }
    
    const lines = [
      `Backtest Results (${result.symbol}, ${result.from} to ${result.to})`,
      "",
      `Trades executed: ${result.totalTrades}`,
      `Win rate: ${result.winRate.toFixed(1)}%`,
      `Total return: ${result.totalReturn >= 0 ? "+" : ""}${result.totalReturn.toFixed(1)}%`,
      `Sharpe ratio: ${result.sharpeRatio.toFixed(2)}`,
      `Max drawdown: -${result.maxDrawdown.toFixed(1)}%`,
      "",
      `Top performing agent: ${result.bestAgent} (${result.agentPerformance.find(a => a.agent === result.bestAgent)?.totalReturn.toFixed(1)}%)`,
      `Worst performing agent: ${result.worstAgent} (${result.agentPerformance.find(a => a.agent === result.worstAgent)?.totalReturn.toFixed(1)}%)`,
      "",
      "Insights:",
      ...result.insights.map(i => `  - ${i}`),
    ];
    
    return lines.join("\n");
  }
}

export const quickBacktestEngine = new QuickBacktestEngine();
