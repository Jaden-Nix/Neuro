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
  private cachedMarketData: MarketSnapshot | null = null;
  private readonly MARKET_DATA_CACHE_TTL_MS = 30000; // 30 seconds

  private validateConfig(config: SimulationConfig): void {
    if (!config.branchCount || config.branchCount < 1) {
      throw new Error("branchCount must be at least 1");
    }
    if (!config.predictionInterval || config.predictionInterval <= 0) {
      throw new Error("predictionInterval must be positive");
    }
    if (config.timeHorizon < 0) {
      throw new Error("timeHorizon cannot be negative");
    }
  }

  public async runSimulation(config: SimulationConfig, marketData?: any): Promise<SimulationBranch[]> {
    this.validateConfig(config);
    
    const simulationId = `sim-${Date.now()}`;
    this.emit("simulationStarted", { simulationId, config });

    // Fetch real market data if not provided
    const realMarketData = await this.fetchRealMarketData(marketData);

    // Handle edge case of zero time horizon
    if (config.timeHorizon === 0) {
      return [];
    }

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
   * Fetch real market data from on-chain sources with caching for Monte Carlo
   * Uses single getOnChainMetrics call to avoid redundant RPC requests
   */
  private async fetchRealMarketData(existingData?: any, useCache: boolean = false): Promise<MarketSnapshot> {
    // Return cached data if valid and caching is requested (for Monte Carlo)
    if (useCache && this.cachedMarketData) {
      const age = Date.now() - this.cachedMarketData.timestamp;
      if (age < this.MARKET_DATA_CACHE_TTL_MS) {
        return this.cachedMarketData;
      }
    }

    try {
      // Fetch live on-chain metrics (single call that includes price, TVL, APY, gas)
      const onChainMetrics = await rpcClient.getOnChainMetrics();
      
      // Calculate historical volatility from price history (time-aware)
      const calculatedVolatility = this.calculateHistoricalVolatility();
      
      const snapshot: MarketSnapshot = {
        price: existingData?.currentPrice || onChainMetrics.ethPriceUsd || 2000,
        tvl: onChainMetrics.tvlUsd || 1000000,
        yield: onChainMetrics.currentAPY || 3.5,
        gasPrice: onChainMetrics.gasPriceGwei || 20, // In Gwei
        volatility: calculatedVolatility || 0.25,
        timestamp: Date.now(),
      };

      // Update price history for volatility tracking
      this.updatePriceHistory(snapshot.price);
      this.lastMarketSnapshot = snapshot;
      this.cachedMarketData = snapshot;

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
   * Calculate historical volatility using log returns with time-aware annualization
   * Uses actual time deltas between samples instead of assuming daily frequency
   */
  private calculateHistoricalVolatility(): number {
    if (this.priceHistory.length < 3) {
      return 0.25; // Default volatility if insufficient data
    }

    // Calculate log returns with their time deltas
    const logReturnsWithDt: { logReturn: number; dtYears: number }[] = [];
    for (let i = 1; i < this.priceHistory.length; i++) {
      const logReturn = Math.log(this.priceHistory[i].price / this.priceHistory[i - 1].price);
      const dtMs = this.priceHistory[i].timestamp - this.priceHistory[i - 1].timestamp;
      const dtYears = dtMs / (365.25 * 24 * 60 * 60 * 1000); // Convert ms to years
      
      // Skip invalid time deltas (negative or zero)
      if (dtYears > 0) {
        logReturnsWithDt.push({ logReturn, dtYears });
      }
    }

    if (logReturnsWithDt.length < 2) {
      return 0.25; // Fallback if not enough valid samples
    }

    // Calculate annualized returns for each interval: r_annual = r / sqrt(dt)
    const annualizedReturns = logReturnsWithDt.map(({ logReturn, dtYears }) => 
      logReturn / Math.sqrt(dtYears)
    );

    // Calculate mean of annualized returns
    const mean = annualizedReturns.reduce((sum, r) => sum + r, 0) / annualizedReturns.length;

    // Calculate variance of annualized returns
    const variance = annualizedReturns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / (annualizedReturns.length - 1);

    // Standard deviation is the annualized volatility
    const annualizedVolatility = Math.sqrt(variance);

    // Bound to reasonable range [0.05, 1.0] (5% to 100% annual volatility)
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

    // Guard against empty predictions array
    if (predictions.length === 0) {
      return {
        id: branchId,
        parentId: null,
        predictions: [],
        outcome: "pending",
        evScore: 0,
      };
    }

    // Determine outcome based on final EV and risk metrics
    const finalEV = predictions[predictions.length - 1].ev;
    const avgVolatility = predictions.reduce((sum, p) => sum + p.volatility, 0) / predictions.length;
    const avgYield = predictions.reduce((sum, p) => sum + p.yield, 0) / predictions.length;
    
    let outcome: "success" | "failure" | "pending";
    if (finalEV > 0 && avgYield > 3.0 && avgVolatility < 0.35) {
      outcome = "success";
    } else if (finalEV < -5 || avgVolatility > 0.5) {
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
    // Guard against empty predictions
    if (!branch.predictions || branch.predictions.length === 0) {
      return 0;
    }

    // Time-weighted average with exponential decay (more weight on near-term)
    const lambda = 0.1; // Decay parameter
    let weightedSum = 0;
    let totalWeight = 0;

    branch.predictions.forEach((pred, idx) => {
      const weight = Math.exp(-lambda * idx);
      weightedSum += pred.ev * weight;
      totalWeight += weight;
    });
    
    // Guard against division by zero
    if (totalWeight === 0) {
      return 0;
    }
    
    return weightedSum / totalWeight;
  }

  public selectBestBranch(branches: SimulationBranch[]): SimulationBranch | null {
    // Guard against empty branches array
    if (!branches || branches.length === 0) {
      return null;
    }
    
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
   * Calculate percentile from sorted array using linear interpolation
   */
  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    const weight = index - lower;
    
    if (upper >= sortedArray.length) return sortedArray[sortedArray.length - 1];
    if (lower < 0) return sortedArray[0];
    
    return sortedArray[lower] * (1 - weight) + sortedArray[upper] * weight;
  }

  /**
   * Calculate skewness of distribution
   */
  private calculateSkewness(values: number[], mean: number, std: number): number {
    if (std === 0 || values.length < 3) return 0;
    const n = values.length;
    const m3 = values.reduce((sum, v) => sum + Math.pow((v - mean) / std, 3), 0) / n;
    return m3;
  }

  /**
   * Calculate excess kurtosis of distribution
   */
  private calculateKurtosis(values: number[], mean: number, std: number): number {
    if (std === 0 || values.length < 4) return 0;
    const n = values.length;
    const m4 = values.reduce((sum, v) => sum + Math.pow((v - mean) / std, 4), 0) / n;
    return m4 - 3; // Excess kurtosis (normal distribution = 0)
  }

  /**
   * Calculate Conditional Value at Risk (Expected Shortfall)
   */
  private calculateCVaR(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const cutoffIndex = Math.floor((percentile / 100) * sortedArray.length);
    if (cutoffIndex === 0) return sortedArray[0];
    
    const tailValues = sortedArray.slice(0, cutoffIndex);
    return tailValues.reduce((sum, v) => sum + v, 0) / tailValues.length;
  }

  /**
   * Run Monte Carlo simulation with convergence checking and comprehensive statistics
   * 
   * @param config Simulation configuration
   * @param maxIterations Maximum iterations to run (default 1000)
   * @param minIterations Minimum iterations before checking convergence (default 100)
   * @param convergenceThreshold Standard error threshold for convergence (default 0.5)
   * @param checkInterval How often to check convergence (default 50)
   */
  public async runMonteCarloSimulation(
    config: SimulationConfig,
    maxIterations: number = 1000,
    minIterations: number = 100,
    convergenceThreshold: number = 0.5,
    checkInterval: number = 50
  ): Promise<{
    meanEV: number;
    medianEV: number;
    stdEV: number;
    successProbability: number;
    failureProbability: number;
    confidenceInterval95: [number, number];
    confidenceInterval99: [number, number];
    var95: number;
    var99: number;
    cvar95: number;
    percentiles: {
      p5: number;
      p10: number;
      p25: number;
      p50: number;
      p75: number;
      p90: number;
      p95: number;
    };
    converged: boolean;
    iterationsRun: number;
    convergenceMetric: number;
    sampleSize: number;
    skewness: number;
    kurtosis: number;
  }> {
    // Validate config before running Monte Carlo
    this.validateConfig(config);
    
    const allEVs: number[] = [];
    let successCount = 0;
    let failureCount = 0;
    let converged = false;
    let iterationsRun = 0;
    let lastMean = 0;
    let runningMean = 0;
    let runningM2 = 0; // For Welford's online variance algorithm

    // Emit start event
    this.emit("monteCarloStarted", { config, maxIterations });

    // Fetch baseline market data ONCE for all Monte Carlo iterations
    // This prevents RPC storms and ensures consistent baseline for statistical validity
    const baselineMarketData = await this.fetchRealMarketData(undefined, false);
    
    // Cache this baseline for subsequent iterations
    this.cachedMarketData = baselineMarketData;

    // Run simulation iterations with convergence checking
    for (let i = 0; i < maxIterations; i++) {
      iterationsRun = i + 1;

      // Use cached baseline market data (stochastic variation comes from GBM, not data fetching)
      const branch = await this.createBranch(`mc-${Date.now()}`, i, config, baselineMarketData);
      
      // Calculate EV for this path
      const rawEV = this.calculateEV(branch);
      const ev = Math.round(rawEV);
      
      // Validate EV
      if (!Number.isFinite(ev)) {
        console.warn(`Monte Carlo iteration ${i}: Invalid EV, skipping`);
        continue;
      }

      allEVs.push(ev);

      // Track outcomes
      if (branch.outcome === "success") {
        successCount++;
      } else if (branch.outcome === "failure") {
        failureCount++;
      }

      // Welford's online algorithm for mean and variance
      const n = allEVs.length;
      const delta = ev - runningMean;
      runningMean += delta / n;
      const delta2 = ev - runningMean;
      runningM2 += delta * delta2;

      // Check convergence periodically after minimum iterations
      if (n >= minIterations && n % checkInterval === 0) {
        const variance = runningM2 / (n - 1);
        const stdDev = Math.sqrt(variance);
        const standardError = stdDev / Math.sqrt(n);
        
        // Convergence check: standard error of mean below threshold
        if (standardError < convergenceThreshold) {
          converged = true;
          console.log(`Monte Carlo converged after ${n} iterations (SE: ${standardError.toFixed(4)})`);
          break;
        }

        // Also check if mean has stabilized (change < 1% over last interval)
        const meanChange = Math.abs(runningMean - lastMean);
        const meanChangePercent = lastMean !== 0 ? (meanChange / Math.abs(lastMean)) * 100 : 100;
        
        if (meanChangePercent < 1 && standardError < convergenceThreshold * 2) {
          converged = true;
          console.log(`Monte Carlo converged (mean stabilized) after ${n} iterations`);
          break;
        }
        
        lastMean = runningMean;
      }

      // Emit progress every 100 iterations
      if (iterationsRun % 100 === 0) {
        this.emit("monteCarloProgress", { 
          iteration: iterationsRun, 
          maxIterations, 
          currentMean: runningMean 
        });
      }
    }

    // Calculate final statistics
    const n = allEVs.length;
    
    if (n === 0) {
      // Return default values if no valid samples
      return {
        meanEV: 0,
        medianEV: 0,
        stdEV: 0,
        successProbability: 0,
        failureProbability: 0,
        confidenceInterval95: [0, 0],
        confidenceInterval99: [0, 0],
        var95: 0,
        var99: 0,
        cvar95: 0,
        percentiles: { p5: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p95: 0 },
        converged: false,
        iterationsRun,
        convergenceMetric: Infinity,
        sampleSize: 0,
        skewness: 0,
        kurtosis: 0,
      };
    }

    // Final mean and standard deviation
    const meanEV = runningMean;
    const variance = n > 1 ? runningM2 / (n - 1) : 0;
    const stdEV = Math.sqrt(variance);
    const standardError = stdEV / Math.sqrt(n);

    // Sort for percentile calculations
    const sortedEVs = [...allEVs].sort((a, b) => a - b);

    // Calculate percentiles
    const percentiles = {
      p5: this.calculatePercentile(sortedEVs, 5),
      p10: this.calculatePercentile(sortedEVs, 10),
      p25: this.calculatePercentile(sortedEVs, 25),
      p50: this.calculatePercentile(sortedEVs, 50), // Median
      p75: this.calculatePercentile(sortedEVs, 75),
      p90: this.calculatePercentile(sortedEVs, 90),
      p95: this.calculatePercentile(sortedEVs, 95),
    };

    // Confidence intervals
    const ci95Lower = this.calculatePercentile(sortedEVs, 2.5);
    const ci95Upper = this.calculatePercentile(sortedEVs, 97.5);
    const ci99Lower = this.calculatePercentile(sortedEVs, 0.5);
    const ci99Upper = this.calculatePercentile(sortedEVs, 99.5);

    // Value at Risk (worst case scenarios)
    const var95 = this.calculatePercentile(sortedEVs, 5);
    const var99 = this.calculatePercentile(sortedEVs, 1);
    
    // Conditional VaR (Expected Shortfall)
    const cvar95 = this.calculateCVaR(sortedEVs, 5);

    // Higher moments
    const skewness = this.calculateSkewness(allEVs, meanEV, stdEV);
    const kurtosis = this.calculateKurtosis(allEVs, meanEV, stdEV);

    const result = {
      meanEV: Math.round(meanEV),
      medianEV: Math.round(percentiles.p50),
      stdEV: Math.round(stdEV * 100) / 100, // 2 decimal places
      successProbability: Math.round((successCount / n) * 10000) / 10000, // 4 decimal places
      failureProbability: Math.round((failureCount / n) * 10000) / 10000,
      confidenceInterval95: [Math.round(ci95Lower), Math.round(ci95Upper)] as [number, number],
      confidenceInterval99: [Math.round(ci99Lower), Math.round(ci99Upper)] as [number, number],
      var95: Math.round(var95),
      var99: Math.round(var99),
      cvar95: Math.round(cvar95),
      percentiles: {
        p5: Math.round(percentiles.p5),
        p10: Math.round(percentiles.p10),
        p25: Math.round(percentiles.p25),
        p50: Math.round(percentiles.p50),
        p75: Math.round(percentiles.p75),
        p90: Math.round(percentiles.p90),
        p95: Math.round(percentiles.p95),
      },
      converged,
      iterationsRun,
      convergenceMetric: Math.round(standardError * 1000) / 1000, // 3 decimal places
      sampleSize: n,
      skewness: Math.round(skewness * 100) / 100,
      kurtosis: Math.round(kurtosis * 100) / 100,
    };

    // Emit completion event
    this.emit("monteCarloCompleted", result);

    return result;
  }

  /**
   * Run batch Monte Carlo with multiple scenarios for comparison
   */
  public async runBatchMonteCarloSimulation(
    configs: SimulationConfig[],
    iterationsPerConfig: number = 500
  ): Promise<Map<string, Awaited<ReturnType<typeof this.runMonteCarloSimulation>>>> {
    const results = new Map<string, Awaited<ReturnType<typeof this.runMonteCarloSimulation>>>();
    
    for (let i = 0; i < configs.length; i++) {
      const config = configs[i];
      const key = `scenario-${i}-h${config.timeHorizon}-b${config.branchCount}`;
      
      console.log(`Running Monte Carlo for scenario ${i + 1}/${configs.length}`);
      const result = await this.runMonteCarloSimulation(config, iterationsPerConfig);
      results.set(key, result);
    }
    
    return results;
  }
}
