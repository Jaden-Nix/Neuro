import type {
  BacktestScenario,
  BacktestRun,
  BacktestDecision,
  BacktestComparison,
  HistoricalDataPoint,
  AgentType,
} from "@shared/schema";

interface StrategyConfig {
  riskTolerance: "conservative" | "moderate" | "aggressive";
  maxPositionSize: number;
  stopLossPercent: number;
  takeProfitPercent: number;
  rebalanceThreshold: number;
}

interface SimulatedPosition {
  entryPrice: number;
  size: number;
  entryTimestamp: number;
  type: "long" | "short";
}

export class BacktestingEngine {
  private scenarios: Map<string, BacktestScenario> = new Map();
  private runs: Map<string, BacktestRun> = new Map();
  private comparisons: Map<string, BacktestComparison> = new Map();

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  async createScenario(
    name: string,
    description: string,
    chain: BacktestScenario["chain"],
    startDate: Date,
    endDate: Date
  ): Promise<BacktestScenario> {
    const dataPoints = this.generateHistoricalData(startDate, endDate);

    const scenario: BacktestScenario = {
      id: this.generateId(),
      name,
      description,
      startTimestamp: startDate.getTime(),
      endTimestamp: endDate.getTime(),
      dataPoints,
      chain,
      createdAt: Date.now(),
    };

    this.scenarios.set(scenario.id, scenario);
    console.log(`[BacktestingEngine] Created scenario: ${name} with ${dataPoints.length} data points`);
    return scenario;
  }

  private generateHistoricalData(startDate: Date, endDate: Date): HistoricalDataPoint[] {
    const dataPoints: HistoricalDataPoint[] = [];
    const intervalMs = 60 * 60 * 1000;

    let price = 2000 + Math.random() * 500;
    let tvl = 5000000 + Math.random() * 2000000;
    let volume = 100000 + Math.random() * 50000;

    for (let timestamp = startDate.getTime(); timestamp <= endDate.getTime(); timestamp += intervalMs) {
      const priceDrift = (Math.random() - 0.5) * 0.02;
      const priceVolatility = (Math.random() - 0.5) * 0.05;
      price = price * (1 + priceDrift + priceVolatility);
      price = Math.max(price, 100);

      tvl = tvl * (1 + (Math.random() - 0.5) * 0.01);
      volume = volume * (1 + (Math.random() - 0.5) * 0.2);

      const volatility = Math.abs(priceVolatility) * 100;
      const gasPrice = 20 + Math.random() * 100;

      dataPoints.push({
        timestamp,
        price: Math.round(price * 100) / 100,
        volume: Math.round(volume),
        tvl: Math.round(tvl),
        gasPrice: Math.round(gasPrice),
        volatility: Math.round(volatility * 100) / 100,
      });
    }

    return dataPoints;
  }

  getScenarios(): BacktestScenario[] {
    return Array.from(this.scenarios.values());
  }

  getScenario(id: string): BacktestScenario | undefined {
    return this.scenarios.get(id);
  }

  async runBacktest(
    scenarioId: string,
    strategyConfig: StrategyConfig,
    initialBalance: number,
    agentId?: string
  ): Promise<BacktestRun> {
    const scenario = this.scenarios.get(scenarioId);
    if (!scenario) {
      throw new Error(`Scenario not found: ${scenarioId}`);
    }

    const run: BacktestRun = {
      id: this.generateId(),
      scenarioId,
      agentId,
      strategyConfig,
      status: "running",
      startedAt: Date.now(),
      initialBalance,
      finalBalance: initialBalance,
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      profitFactor: 0,
      decisions: [],
    };

    this.runs.set(run.id, run);

    try {
      const result = await this.executeBacktest(run, scenario, strategyConfig);
      run.status = "completed";
      run.completedAt = Date.now();
      Object.assign(run, result);
      console.log(`[BacktestingEngine] Backtest completed: ${run.id}, Return: ${((run.finalBalance - run.initialBalance) / run.initialBalance * 100).toFixed(2)}%`);
    } catch (error: any) {
      run.status = "failed";
      run.errorMessage = error.message;
      run.completedAt = Date.now();
      console.error(`[BacktestingEngine] Backtest failed: ${error.message}`);
    }

    return run;
  }

  private async executeBacktest(
    run: BacktestRun,
    scenario: BacktestScenario,
    config: StrategyConfig
  ): Promise<Partial<BacktestRun>> {
    let balance = run.initialBalance;
    let position: SimulatedPosition | null = null;
    const decisions: BacktestDecision[] = [];
    const returns: number[] = [];
    let peakBalance = balance;
    let maxDrawdown = 0;
    let totalProfit = 0;
    let totalLoss = 0;

    const dataPoints = scenario.dataPoints;

    for (let i = 1; i < dataPoints.length; i++) {
      const current = dataPoints[i];
      const previous = dataPoints[i - 1];

      const priceChange = (current.price - previous.price) / previous.price;
      const volatilityHigh = current.volatility > 5;
      const volumeSpike = current.volume > previous.volume * 1.5;

      let action: BacktestDecision["action"] = "hold";
      let confidence = 0.5;
      let reason = "";
      let agentType: AgentType = "scout";

      if (!position) {
        const buySignal = this.evaluateBuySignal(current, previous, config, volatilityHigh);
        if (buySignal.shouldBuy) {
          const positionSize = balance * config.maxPositionSize;
          position = {
            entryPrice: current.price,
            size: positionSize / current.price,
            entryTimestamp: current.timestamp,
            type: "long",
          };
          balance -= positionSize;
          action = "buy";
          confidence = buySignal.confidence;
          reason = buySignal.reason;
          agentType = "scout";
        }
      } else {
        const currentValue = position.size * current.price;
        const entryValue = position.size * position.entryPrice;
        const pnlPercent = (currentValue - entryValue) / entryValue * 100;

        if (pnlPercent <= -config.stopLossPercent) {
          balance += currentValue;
          action = "sell";
          confidence = 0.9;
          reason = `Stop loss triggered at ${pnlPercent.toFixed(2)}%`;
          agentType = "risk";
          
          if (pnlPercent < 0) {
            totalLoss += Math.abs(currentValue - entryValue);
            run.losingTrades++;
          } else {
            totalProfit += currentValue - entryValue;
            run.winningTrades++;
          }
          run.totalTrades++;
          position = null;
        } else if (pnlPercent >= config.takeProfitPercent) {
          balance += currentValue;
          action = "sell";
          confidence = 0.85;
          reason = `Take profit triggered at ${pnlPercent.toFixed(2)}%`;
          agentType = "execution";
          totalProfit += currentValue - entryValue;
          run.winningTrades++;
          run.totalTrades++;
          position = null;
        } else if (volatilityHigh && pnlPercent > 0) {
          balance += currentValue;
          action = "sell";
          confidence = 0.7;
          reason = `Risk exit due to high volatility with ${pnlPercent.toFixed(2)}% profit`;
          agentType = "risk";
          totalProfit += currentValue - entryValue;
          run.winningTrades++;
          run.totalTrades++;
          position = null;
        }
      }

      const currentBalance = balance + (position ? position.size * current.price : 0);
      const periodReturn = (currentBalance - peakBalance) / peakBalance;
      returns.push(periodReturn);

      if (currentBalance > peakBalance) {
        peakBalance = currentBalance;
      }
      const drawdown = (peakBalance - currentBalance) / peakBalance * 100;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }

      if (action !== "hold") {
        decisions.push({
          timestamp: current.timestamp,
          action,
          amount: position ? position.size : 0,
          price: current.price,
          reason,
          agentType,
          confidence,
          pnl: action === "sell" ? (current.price - (position?.entryPrice || current.price)) * (position?.size || 0) : 0,
        });
      }
    }

    if (position) {
      const finalPrice = dataPoints[dataPoints.length - 1].price;
      balance += position.size * finalPrice;
    }

    const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((acc, r) => acc + Math.pow(r - meanReturn, 2), 0) / returns.length;
    const stdDev = Math.sqrt(variance);
    const sharpeRatio = stdDev > 0 ? (meanReturn / stdDev) * Math.sqrt(252) : 0;

    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 10 : 0;

    return {
      finalBalance: Math.round(balance * 100) / 100,
      decisions,
      maxDrawdown: Math.round(maxDrawdown * 100) / 100,
      sharpeRatio: Math.round(sharpeRatio * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
    };
  }

  private evaluateBuySignal(
    current: HistoricalDataPoint,
    previous: HistoricalDataPoint,
    config: StrategyConfig,
    volatilityHigh: boolean
  ): { shouldBuy: boolean; confidence: number; reason: string } {
    const priceChange = (current.price - previous.price) / previous.price;
    const volumeChange = (current.volume - previous.volume) / previous.volume;

    if (config.riskTolerance === "conservative") {
      if (!volatilityHigh && priceChange > 0 && priceChange < 0.02 && current.tvl > previous.tvl) {
        return { shouldBuy: true, confidence: 0.7, reason: "Conservative entry: stable uptrend with growing TVL" };
      }
    } else if (config.riskTolerance === "moderate") {
      if (priceChange > 0.01 && volumeChange > 0.1) {
        return { shouldBuy: true, confidence: 0.65, reason: "Moderate entry: positive momentum with volume confirmation" };
      }
    } else {
      if (priceChange < -0.03 && volumeChange > 0.2) {
        return { shouldBuy: true, confidence: 0.6, reason: "Aggressive entry: buying the dip with volume spike" };
      }
      if (volatilityHigh && priceChange > 0.02) {
        return { shouldBuy: true, confidence: 0.55, reason: "Aggressive entry: momentum in volatile market" };
      }
    }

    return { shouldBuy: false, confidence: 0, reason: "" };
  }

  getRuns(): BacktestRun[] {
    return Array.from(this.runs.values());
  }

  getRun(id: string): BacktestRun | undefined {
    return this.runs.get(id);
  }

  getRunsForScenario(scenarioId: string): BacktestRun[] {
    return Array.from(this.runs.values()).filter(r => r.scenarioId === scenarioId);
  }

  async compareRuns(runIds: string[]): Promise<BacktestComparison> {
    const runs = runIds.map(id => this.runs.get(id)).filter((r): r is BacktestRun => r !== undefined);
    
    if (runs.length < 2) {
      throw new Error("Need at least 2 completed runs to compare");
    }

    const metrics = runs.map(run => ({
      runId: run.id,
      totalReturn: ((run.finalBalance - run.initialBalance) / run.initialBalance) * 100,
      maxDrawdown: run.maxDrawdown,
      sharpeRatio: run.sharpeRatio,
      winRate: run.totalTrades > 0 ? (run.winningTrades / run.totalTrades) * 100 : 0,
    }));

    const best = metrics.reduce((a, b) => a.sharpeRatio > b.sharpeRatio ? a : b);

    const comparison: BacktestComparison = {
      id: this.generateId(),
      runIds,
      bestPerformingRun: best.runId,
      metrics,
      createdAt: Date.now(),
    };

    this.comparisons.set(comparison.id, comparison);
    console.log(`[BacktestingEngine] Comparison created: best performer is ${best.runId}`);
    return comparison;
  }

  getComparisons(): BacktestComparison[] {
    return Array.from(this.comparisons.values());
  }

  async deleteScenario(id: string): Promise<boolean> {
    const deleted = this.scenarios.delete(id);
    if (deleted) {
      for (const [runId, run] of this.runs.entries()) {
        if (run.scenarioId === id) {
          this.runs.delete(runId);
        }
      }
      console.log(`[BacktestingEngine] Deleted scenario: ${id}`);
    }
    return deleted;
  }

  getStats(): {
    totalScenarios: number;
    totalRuns: number;
    completedRuns: number;
    averageReturn: number;
    averageSharpe: number;
  } {
    const completedRuns = Array.from(this.runs.values()).filter(r => r.status === "completed");
    const returns = completedRuns.map(r => ((r.finalBalance - r.initialBalance) / r.initialBalance) * 100);
    const sharpes = completedRuns.map(r => r.sharpeRatio);

    return {
      totalScenarios: this.scenarios.size,
      totalRuns: this.runs.size,
      completedRuns: completedRuns.length,
      averageReturn: returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0,
      averageSharpe: sharpes.length > 0 ? sharpes.reduce((a, b) => a + b, 0) / sharpes.length : 0,
    };
  }
}

export const backtestingEngine = new BacktestingEngine();
