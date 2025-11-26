import { EventEmitter } from "events";
import type { SimulationBranch, FutureForkPrediction } from "@shared/schema";
import { rpcClient } from "../blockchain/RPCClient";

export interface SimulationConfig {
  timeHorizon: number; // minutes into future
  branchCount: number; // number of scenarios to explore
  predictionInterval: number; // minutes between predictions
}

export interface MarketSnapshot {
  price: number;
  tvl: number;
  yield: number;
  gasPrice: number;
  volatility: number;
  timestamp: number;
}

interface PriceHistory {
  timestamp: number;
  price: number;
}

export class SimulationEngine extends EventEmitter {
  private runningSimulations: Map<string, SimulationBranch> = new Map();
  private priceHistory: PriceHistory[] = [];
  private volatilityWindow = 20; // samples for volatility calculation
  private lastMarketSnapshot: MarketSnapshot | null = null;

  public async runSimulation(config: SimulationConfig, marketData?: any): Promise<SimulationBranch[]> {
    const simulationId = `sim-${Date.now()}`;
    this.emit("simulationStarted", { simulationId, config });

    // Fetch real market data if not provided
    const realMarketData = await this.fetchRealMarketData(marketData);

    const branches: SimulationBranch[] = [];

    for (let i = 0; i < config.branchCount; i++) {
      const branch = await this.createBranch(simulationId, i, config, realMarketData);
      branches.push(branch);
    }

    // Calculate EV scores for all branches (rounded to integers for database persistence)
    branches.forEach((branch) => {
      const rawEV = this.calculateEV(branch);
      // Round to integer for database column compatibility (integer type)
      branch.evScore = Math.round(rawEV);
      
      // Validate evScore is finite
      if (!Number.isFinite(branch.evScore)) {
        console.warn(`Invalid evScore detected for branch ${branch.id}, defaulting to 0`);
        branch.evScore = 0;
      }
    });

    // Sort by EV score
    branches.sort((a, b) => b.evScore - a.evScore);

    this.emit("simulationCompleted", { simulationId, branches });
    return branches;
  }

  /**
   * Fetch real market data from on-chain sources
   */
  private async fetchRealMarketData(existingData?: any): Promise<MarketSnapshot> {
    try {
      // Fetch live on-chain metrics
      const [onChainMetrics, ethPrice, gasPriceGwei] = await Promise.all([
        rpcClient.getOnChainMetrics(),
        rpcClient.getETHUSDPrice(),
        rpcClient.getGasPriceGwei(),
      ]);
      
      // Convert TVL from ETH string to number
      const tvlEth = parseFloat(onChainMetrics.totalTVL) || 1000000;
      
      // Calculate historical volatility from price history
      const calculatedVolatility = this.calculateHistoricalVolatility();
      
      const snapshot: MarketSnapshot = {
        price: existingData?.currentPrice || ethPrice || 2000,
        tvl: tvlEth,
        yield: onChainMetrics.currentAPY || 3.5,
        gasPrice: gasPriceGwei || 20, // Already in Gwei
        volatility: calculatedVolatility || 0.25,
        timestamp: Date.now(),
      };

      // Update price history for volatility tracking
      this.updatePriceHistory(snapshot.price);
      this.lastMarketSnapshot = snapshot;

      return snapshot;
    } catch (error) {
      console.error("Failed to fetch real market data, using fallback:", error);
      
      return {
        price: existingData?.currentPrice || 2000,
        tvl: existingData?.currentTVL || 1000000,
        yield: existingData?.currentYield || 3.5,
        gasPrice: 20,
        volatility: 0.25,
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Update price history for volatility calculation
   */
  private updatePriceHistory(price: number): void {
    this.priceHistory.push({
      timestamp: Date.now(),
      price,
    });

    // Keep only recent history
    if (this.priceHistory.length > this.volatilityWindow * 2) {
      this.priceHistory = this.priceHistory.slice(-this.volatilityWindow);
    }
  }

  /**
   * Calculate historical volatility using log returns
   */
  private calculateHistoricalVolatility(): number {
    if (this.priceHistory.length < 3) {
      return 0.25; // Default volatility if insufficient data
    }

    // Calculate log returns
    const logReturns: number[] = [];
    for (let i = 1; i < this.priceHistory.length; i++) {
      const logReturn = Math.log(this.priceHistory[i].price / this.priceHistory[i - 1].price);
      logReturns.push(logReturn);
    }

    // Calculate mean
    const mean = logReturns.reduce((sum, r) => sum + r, 0) / logReturns.length;

    // Calculate variance
    const variance = logReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (logReturns.length - 1);

    // Standard deviation (volatility)
    const volatility = Math.sqrt(variance);

    // Annualize (assuming daily data, adjust for different timeframes)
    const annualizedVolatility = volatility * Math.sqrt(365);

    return Math.min(1, Math.max(0.05, annualizedVolatility));
  }

  /**
   * Generate price prediction using Geometric Brownian Motion model
   */
  private predictPrice(currentPrice: number, volatility: number, drift: number, timeStep: number): number {
    // GBM: S(t+dt) = S(t) * exp((drift - 0.5 * vol^2) * dt + vol * sqrt(dt) * Z)
    // Z is a standard normal random variable
    const z = this.boxMullerTransform();
    const dt = timeStep / 365; // Convert to annual fraction
    
    const logReturn = (drift - 0.5 * volatility * volatility) * dt + 
                      volatility * Math.sqrt(dt) * z;
    
    return currentPrice * Math.exp(logReturn);
  }

  /**
   * Box-Muller transform for generating standard normal random numbers
   * Uses (1 - Math.random()) to avoid u1=0 which would cause Math.log(0) = -Infinity
   */
  private boxMullerTransform(): number {
    // Ensure u1 is never 0 by using 1 - Math.random() (range becomes (0, 1])
    // This prevents Math.log(0) = -Infinity which would corrupt price paths
    const u1 = 1 - Math.random();
    const u2 = Math.random();
    
    // Additional safety: clamp u1 to ensure it's never exactly 0
    const safeU1 = Math.max(u1, Number.EPSILON);
    
    const z = Math.sqrt(-2 * Math.log(safeU1)) * Math.cos(2 * Math.PI * u2);
    
    // Validate output is finite (defense in depth)
    if (!Number.isFinite(z)) {
      console.warn("Box-Muller produced non-finite value, returning 0");
      return 0;
    }
    
    return z;
  }

  /**
   * Predict yield based on TVL changes and market conditions
   */
  private predictYield(baseYield: number, tvlChange: number, volatility: number): number {
    // Higher TVL typically means lower yields (dilution)
    // Higher volatility might attract more yield farming activity
    const tvlEffect = -tvlChange * 0.3; // TVL increase reduces yield
    const volatilityBonus = volatility * 2; // Higher vol = higher risk premium
    
    const predictedYield = baseYield * (1 + tvlEffect + volatilityBonus * 0.1);
    return Math.max(0.1, Math.min(50, predictedYield)); // Cap between 0.1% and 50%
  }

  /**
   * Predict peg deviation using mean reversion model
   */
  private predictPegDeviation(currentDeviation: number, meanReversionSpeed: number): number {
    // Stablecoins tend to mean-revert to 0 deviation
    const noise = (Math.random() - 0.5) * 0.005; // Small random perturbation
    const meanReverted = currentDeviation * (1 - meanReversionSpeed) + noise;
    
    return Math.max(0, Math.min(0.1, Math.abs(meanReverted)));
  }

  private async createBranch(
    simulationId: string,
    branchIndex: number,
    config: SimulationConfig,
    marketData: MarketSnapshot
  ): Promise<SimulationBranch> {
    const branchId = `${simulationId}-branch-${branchIndex}`;
    const predictions: FutureForkPrediction[] = [];

    // Branch-specific parameters (creates diversity between branches)
    const branchDrift = 0.05 + (branchIndex / config.branchCount - 0.5) * 0.2;
    const branchVolatilityFactor = 0.8 + (branchIndex / config.branchCount) * 0.4;

    let currentPrice = marketData.price;
    let currentTVL = marketData.tvl;
    let currentYield = marketData.yield;
    let currentFRAXPeg = 0.001;
    let currentKRWQPeg = 0.002;

    // Generate predictions for each time interval
    const intervals = Math.ceil(config.timeHorizon / config.predictionInterval);
    for (let t = 0; t < intervals; t++) {
      const timestamp = Date.now() + t * config.predictionInterval * 60 * 1000;
      const timeStep = config.predictionInterval / (24 * 60); // Convert minutes to days
      
      const adjustedVolatility = marketData.volatility * branchVolatilityFactor;
      
      // Predict next values using statistical models
      currentPrice = this.predictPrice(currentPrice, adjustedVolatility, branchDrift, timeStep);
      
      // TVL changes based on price movement (correlation)
      const priceChangeRatio = currentPrice / marketData.price;
      currentTVL = marketData.tvl * Math.pow(priceChangeRatio, 0.5) * (0.95 + Math.random() * 0.1);
      
      // Yield prediction
      const tvlChange = (currentTVL - marketData.tvl) / marketData.tvl;
      currentYield = this.predictYield(marketData.yield, tvlChange, adjustedVolatility);
      
      // Peg deviations with mean reversion
      currentFRAXPeg = this.predictPegDeviation(currentFRAXPeg, 0.3);
      currentKRWQPeg = this.predictPegDeviation(currentKRWQPeg, 0.2);

      predictions.push({
        timestamp,
        price: currentPrice,
        volatility: adjustedVolatility,
        tvl: currentTVL,
        yield: currentYield,
        pegDeviationFRAX: currentFRAXPeg,
        pegDeviationKRWQ: currentKRWQPeg,
        ev: 0, // Will be calculated
      });
    }

    // Calculate EV for each prediction with validation
    predictions.forEach((pred, idx) => {
      const returnPercent = ((pred.price - marketData.price) / marketData.price) * 100;
      const yieldReturn = pred.yield * (idx + 1) / 365; // Daily compounding
      const volatilityPenalty = pred.volatility * 8; // Risk-adjusted
      const pegPenalty = (pred.pegDeviationFRAX + pred.pegDeviationKRWQ) * 200;
      
      // Sharpe-like ratio: (return - risk) / volatility
      const riskAdjustedReturn = returnPercent + yieldReturn - volatilityPenalty - pegPenalty;
      
      // Validate and bound EV to reasonable range [-1000, 1000]
      // Round to integer for database compatibility
      let boundedEV = Math.max(-1000, Math.min(1000, riskAdjustedReturn));
      
      // Handle NaN/Infinity cases
      if (!Number.isFinite(boundedEV)) {
        console.warn(`Invalid EV value at prediction ${idx}, defaulting to 0`);
        boundedEV = 0;
      }
      
      pred.ev = Math.round(boundedEV);
    });

    // Determine outcome based on final EV and risk metrics
    const finalEV = predictions[predictions.length - 1].ev;
    const avgVolatility = predictions.reduce((sum, p) => sum + p.volatility, 0) / predictions.length;
    
    let outcome: "success" | "failure" | "pending";
    if (finalEV > 8 && avgVolatility < 0.5) {
      outcome = "success";
    } else if (finalEV < -8 || avgVolatility > 0.7) {
      outcome = "failure";
    } else {
      outcome = "pending";
    }

    return {
      id: branchId,
      parentId: null,
      predictions,
      outcome,
      evScore: 0, // Will be calculated
    };
  }

  private calculateEV(branch: SimulationBranch): number {
    // Time-weighted average with exponential decay (more weight on near-term)
    const lambda = 0.1; // Decay parameter
    let weightedSum = 0;
    let totalWeight = 0;

    branch.predictions.forEach((pred, idx) => {
      const weight = Math.exp(-lambda * idx);
      weightedSum += pred.ev * weight;
      totalWeight += weight;
    });
    
    return weightedSum / totalWeight;
  }

  public selectBestBranch(branches: SimulationBranch[]): SimulationBranch {
    return branches.reduce((best, current) => 
      current.evScore > best.evScore ? current : best
    );
  }

  /**
   * Get current market snapshot for external access
   */
  public getLastMarketSnapshot(): MarketSnapshot | null {
    return this.lastMarketSnapshot;
  }

  /**
   * Run Monte Carlo simulation for probability distribution
   */
  public async runMonteCarloSimulation(
    config: SimulationConfig,
    iterations: number = 1000
  ): Promise<{
    meanEV: number;
    stdEV: number;
    successProbability: number;
    confidenceInterval: [number, number];
  }> {
    const allEVs: number[] = [];
    let successCount = 0;

    // Run multiple simulation iterations
    for (let i = 0; i < iterations; i++) {
      const branches = await this.runSimulation({
        ...config,
        branchCount: 1, // Single branch per iteration for speed
      });

      if (branches.length > 0) {
        allEVs.push(branches[0].evScore);
        if (branches[0].outcome === "success") {
          successCount++;
        }
      }
    }

    // Calculate statistics
    const meanEV = allEVs.reduce((sum, ev) => sum + ev, 0) / allEVs.length;
    const variance = allEVs.reduce((sum, ev) => sum + Math.pow(ev - meanEV, 2), 0) / (allEVs.length - 1);
    const stdEV = Math.sqrt(variance);
    
    // Sort for percentile calculation
    allEVs.sort((a, b) => a - b);
    const lowerIdx = Math.floor(allEVs.length * 0.025);
    const upperIdx = Math.floor(allEVs.length * 0.975);

    return {
      meanEV,
      stdEV,
      successProbability: successCount / iterations,
      confidenceInterval: [allEVs[lowerIdx], allEVs[upperIdx]],
    };
  }
}
