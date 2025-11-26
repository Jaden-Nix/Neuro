import { EventEmitter } from "events";
import type { SimulationBranch, FutureForkPrediction } from "@shared/schema";

export interface SimulationConfig {
  timeHorizon: number; // minutes into future
  branchCount: number; // number of scenarios to explore
  predictionInterval: number; // minutes between predictions
}

export class SimulationEngine extends EventEmitter {
  private runningSimulations: Map<string, SimulationBranch> = new Map();

  public async runSimulation(config: SimulationConfig, marketData?: any): Promise<SimulationBranch[]> {
    const simulationId = `sim-${Date.now()}`;
    this.emit("simulationStarted", { simulationId, config });

    const branches: SimulationBranch[] = [];

    for (let i = 0; i < config.branchCount; i++) {
      const branch = await this.createBranch(simulationId, i, config, marketData);
      branches.push(branch);
    }

    // Calculate EV scores for all branches
    branches.forEach((branch) => {
      branch.evScore = this.calculateEV(branch);
    });

    // Sort by EV score
    branches.sort((a, b) => b.evScore - a.evScore);

    this.emit("simulationCompleted", { simulationId, branches });
    return branches;
  }

  private async createBranch(
    simulationId: string,
    branchIndex: number,
    config: SimulationConfig,
    marketData?: any
  ): Promise<SimulationBranch> {
    const branchId = `${simulationId}-branch-${branchIndex}`;
    const predictions: FutureForkPrediction[] = [];

    const basePrice = marketData?.currentPrice || 1800; // ETH price example
    const baseTVL = marketData?.currentTVL || 1000000;
    const baseYield = marketData?.currentYield || 5.5;

    // Generate predictions for each time interval
    const intervals = Math.ceil(config.timeHorizon / config.predictionInterval);
    for (let t = 0; t < intervals; t++) {
      const timestamp = Date.now() + t * config.predictionInterval * 60 * 1000;
      
      // Add randomness to create different branches
      const priceVariation = (Math.random() - 0.5) * 0.1 * (t + 1);
      const volatilityVariation = Math.random() * 0.05;
      const tvlVariation = (Math.random() - 0.5) * 0.05;
      const yieldVariation = (Math.random() - 0.5) * 0.02;

      predictions.push({
        timestamp,
        price: basePrice * (1 + priceVariation),
        volatility: 0.3 + volatilityVariation,
        tvl: baseTVL * (1 + tvlVariation),
        yield: baseYield + yieldVariation,
        pegDeviationFRAX: Math.abs(Math.random() - 0.5) * 0.02,
        pegDeviationKRWQ: Math.abs(Math.random() - 0.5) * 0.03,
        ev: 0, // Will be calculated
      });
    }

    // Calculate EV for each prediction
    predictions.forEach((pred, idx) => {
      const returnPercent = ((pred.price - basePrice) / basePrice) * 100;
      const yieldReturn = pred.yield * (idx + 1);
      const volatilityPenalty = pred.volatility * 10;
      const pegPenalty = (pred.pegDeviationFRAX + pred.pegDeviationKRWQ) * 100;
      
      pred.ev = returnPercent + yieldReturn - volatilityPenalty - pegPenalty;
    });

    // Determine outcome based on final EV
    const finalEV = predictions[predictions.length - 1].ev;
    const outcome = finalEV > 10 ? "success" : finalEV < -10 ? "failure" : "pending";

    return {
      id: branchId,
      parentId: null,
      predictions,
      outcome,
      evScore: 0, // Will be calculated
    };
  }

  private calculateEV(branch: SimulationBranch): number {
    // Weighted average of all predictions, with more weight on later predictions
    const totalWeight = branch.predictions.reduce((sum, _, idx) => sum + (idx + 1), 0);
    const weightedSum = branch.predictions.reduce((sum, pred, idx) => sum + pred.ev * (idx + 1), 0);
    
    return weightedSum / totalWeight;
  }

  public selectBestBranch(branches: SimulationBranch[]): SimulationBranch {
    return branches.reduce((best, current) => 
      current.evScore > best.evScore ? current : best
    );
  }
}
