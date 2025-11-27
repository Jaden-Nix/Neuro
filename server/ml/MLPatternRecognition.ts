import { EventEmitter } from "events";
import type {
  MLFeatureVector,
  MarketCluster,
  MLPrediction,
  MLModelMetrics,
  TrainingDataPoint,
  MemoryEntry,
  CreditTransaction,
} from "@shared/schema";

interface KMeansConfig {
  k: number;
  maxIterations: number;
  tolerance: number;
}

interface PredictionModelWeights {
  volatilityWeight: number;
  tvlWeight: number;
  gasWeight: number;
  performanceWeight: number;
  sentimentWeight: number;
  liquidityWeight: number;
  volumeWeight: number;
  clusterBonusWeight: number;
}

export class MLPatternRecognition extends EventEmitter {
  private clusters: Map<string, MarketCluster> = new Map();
  private trainingData: TrainingDataPoint[] = [];
  private modelMetrics: MLModelMetrics;
  private modelWeights: PredictionModelWeights;
  private readonly modelVersion = "1.0.0";

  constructor() {
    super();
    
    this.modelMetrics = {
      modelId: `ml-model-${Date.now()}`,
      version: this.modelVersion,
      accuracy: 0,
      precision: 0,
      recall: 0,
      f1Score: 0,
      totalPredictions: 0,
      correctPredictions: 0,
      lastTrainedAt: Date.now(),
      trainingDataPoints: 0,
    };

    this.modelWeights = {
      volatilityWeight: -0.15,
      tvlWeight: 0.20,
      gasWeight: -0.10,
      performanceWeight: 0.25,
      sentimentWeight: 0.15,
      liquidityWeight: 0.10,
      volumeWeight: 0.05,
      clusterBonusWeight: 0.15,
    };
  }

  public extractFeatures(
    memoryEntries: MemoryEntry[],
    creditTransactions: CreditTransaction[],
    marketData?: {
      price?: number;
      previousPrice?: number;
      tvl?: number;
      previousTvl?: number;
      gasPrice?: number;
      volume?: number;
      previousVolume?: number;
    }
  ): MLFeatureVector {
    const agentPerformance = this.calculateAgentPerformance(creditTransactions);
    const priceVolatility = this.calculateVolatility(marketData?.price, marketData?.previousPrice);
    const tvlChange = this.calculateChange(marketData?.tvl, marketData?.previousTvl);
    const volumeChange = this.calculateChange(marketData?.volume, marketData?.previousVolume);
    const marketSentiment = this.analyzeMarketSentiment(memoryEntries);
    const liquidityDepth = this.estimateLiquidityDepth(marketData?.tvl, marketData?.volume);

    return {
      priceVolatility,
      tvlChange,
      gasPrice: marketData?.gasPrice || 50,
      agentPerformance,
      marketSentiment,
      liquidityDepth,
      volumeChange,
      timestamp: Date.now(),
    };
  }

  private calculateAgentPerformance(transactions: CreditTransaction[]): number {
    if (transactions.length === 0) return 50;

    const recentTransactions = transactions.slice(-100);
    const positiveSum = recentTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const negativeSum = Math.abs(
      recentTransactions
        .filter(t => t.amount < 0)
        .reduce((sum, t) => sum + t.amount, 0)
    );

    const total = positiveSum + negativeSum;
    if (total === 0) return 50;

    return Math.min(100, Math.max(0, (positiveSum / total) * 100));
  }

  private calculateVolatility(current?: number, previous?: number): number {
    if (!current || !previous || previous === 0) return 0;
    return Math.abs((current - previous) / previous) * 100;
  }

  private calculateChange(current?: number, previous?: number): number {
    if (!current || !previous || previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  private analyzeMarketSentiment(entries: MemoryEntry[]): number {
    if (entries.length === 0) return 50;

    const recentEntries = entries.slice(-50);
    let sentimentScore = 50;

    for (const entry of recentEntries) {
      if (entry.strategyType === "successful") {
        sentimentScore += 2;
      } else if (entry.strategyType === "blocked" || entry.strategyType === "high-risk") {
        sentimentScore -= 2;
      }
    }

    return Math.min(100, Math.max(0, sentimentScore));
  }

  private estimateLiquidityDepth(tvl?: number, volume?: number): number {
    if (!tvl || tvl === 0) return 50;
    if (!volume) return 50;

    const ratio = volume / tvl;
    return Math.min(100, Math.max(0, 100 - (ratio * 100)));
  }

  public performKMeansClustering(
    dataPoints: MLFeatureVector[],
    config: KMeansConfig = { k: 5, maxIterations: 100, tolerance: 0.001 }
  ): MarketCluster[] {
    if (dataPoints.length < config.k) {
      return this.createDefaultClusters();
    }

    let centroids = this.initializeCentroids(dataPoints, config.k);
    let assignments: number[] = new Array(dataPoints.length).fill(0);
    let previousCentroids: MLFeatureVector[] = [];

    for (let iteration = 0; iteration < config.maxIterations; iteration++) {
      assignments = this.assignPointsToClusters(dataPoints, centroids);
      
      const newCentroids = this.recalculateCentroids(dataPoints, assignments, config.k);
      
      if (this.hasConverged(centroids, newCentroids, config.tolerance)) {
        centroids = newCentroids;
        break;
      }

      previousCentroids = centroids;
      centroids = newCentroids;
    }

    const clusters: MarketCluster[] = [];
    for (let i = 0; i < config.k; i++) {
      const memberIndices = assignments
        .map((a, idx) => a === i ? idx : -1)
        .filter(idx => idx !== -1);
      
      const members = memberIndices.map(idx => `datapoint-${idx}`);
      const label = this.classifyCluster(centroids[i]);
      const confidence = this.calculateClusterConfidence(dataPoints, memberIndices, centroids[i]);

      clusters.push({
        id: `cluster-${i}-${Date.now()}`,
        centroid: centroids[i],
        members,
        label,
        confidence,
        timestamp: Date.now(),
      });
    }

    clusters.forEach(cluster => this.clusters.set(cluster.id, cluster));
    this.emit("clusteringCompleted", { clusters });

    return clusters;
  }

  private initializeCentroids(dataPoints: MLFeatureVector[], k: number): MLFeatureVector[] {
    const indices = new Set<number>();
    while (indices.size < k) {
      indices.add(Math.floor(Math.random() * dataPoints.length));
    }
    return Array.from(indices).map(i => ({ ...dataPoints[i] }));
  }

  private assignPointsToClusters(
    dataPoints: MLFeatureVector[],
    centroids: MLFeatureVector[]
  ): number[] {
    return dataPoints.map(point => {
      let minDistance = Infinity;
      let closestCluster = 0;

      centroids.forEach((centroid, idx) => {
        const distance = this.euclideanDistance(point, centroid);
        if (distance < minDistance) {
          minDistance = distance;
          closestCluster = idx;
        }
      });

      return closestCluster;
    });
  }

  private recalculateCentroids(
    dataPoints: MLFeatureVector[],
    assignments: number[],
    k: number
  ): MLFeatureVector[] {
    const centroids: MLFeatureVector[] = [];

    for (let i = 0; i < k; i++) {
      const clusterPoints = dataPoints.filter((_, idx) => assignments[idx] === i);
      
      if (clusterPoints.length === 0) {
        centroids.push(this.createEmptyFeatureVector());
        continue;
      }

      centroids.push({
        priceVolatility: this.average(clusterPoints.map(p => p.priceVolatility)),
        tvlChange: this.average(clusterPoints.map(p => p.tvlChange)),
        gasPrice: this.average(clusterPoints.map(p => p.gasPrice)),
        agentPerformance: this.average(clusterPoints.map(p => p.agentPerformance)),
        marketSentiment: this.average(clusterPoints.map(p => p.marketSentiment)),
        liquidityDepth: this.average(clusterPoints.map(p => p.liquidityDepth)),
        volumeChange: this.average(clusterPoints.map(p => p.volumeChange)),
        timestamp: Date.now(),
      });
    }

    return centroids;
  }

  private hasConverged(
    oldCentroids: MLFeatureVector[],
    newCentroids: MLFeatureVector[],
    tolerance: number
  ): boolean {
    for (let i = 0; i < oldCentroids.length; i++) {
      if (this.euclideanDistance(oldCentroids[i], newCentroids[i]) > tolerance) {
        return false;
      }
    }
    return true;
  }

  private euclideanDistance(a: MLFeatureVector, b: MLFeatureVector): number {
    const diffs = [
      (a.priceVolatility - b.priceVolatility) / 100,
      (a.tvlChange - b.tvlChange) / 100,
      (a.gasPrice - b.gasPrice) / 200,
      (a.agentPerformance - b.agentPerformance) / 100,
      (a.marketSentiment - b.marketSentiment) / 100,
      (a.liquidityDepth - b.liquidityDepth) / 100,
      (a.volumeChange - b.volumeChange) / 100,
    ];
    return Math.sqrt(diffs.reduce((sum, d) => sum + d * d, 0));
  }

  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  private classifyCluster(centroid: MLFeatureVector): MarketCluster["label"] {
    const { priceVolatility, tvlChange, marketSentiment, volumeChange } = centroid;

    if (priceVolatility > 10) return "volatile";
    if (tvlChange > 5 && marketSentiment > 60) return "bullish";
    if (tvlChange < -5 && marketSentiment < 40) return "bearish";
    if (Math.abs(tvlChange) < 2 && Math.abs(volumeChange) < 5) return "stable";
    return "sideways";
  }

  private calculateClusterConfidence(
    dataPoints: MLFeatureVector[],
    memberIndices: number[],
    centroid: MLFeatureVector
  ): number {
    if (memberIndices.length === 0) return 0;

    const distances = memberIndices.map(idx => 
      this.euclideanDistance(dataPoints[idx], centroid)
    );
    
    const avgDistance = this.average(distances);
    return Math.max(0, Math.min(100, 100 - (avgDistance * 50)));
  }

  private createDefaultClusters(): MarketCluster[] {
    const labels: MarketCluster["label"][] = ["bullish", "bearish", "sideways", "volatile", "stable"];
    return labels.map((label, i) => ({
      id: `default-cluster-${i}`,
      centroid: this.createEmptyFeatureVector(),
      members: [],
      label,
      confidence: 50,
      timestamp: Date.now(),
    }));
  }

  private createEmptyFeatureVector(): MLFeatureVector {
    return {
      priceVolatility: 0,
      tvlChange: 0,
      gasPrice: 50,
      agentPerformance: 50,
      marketSentiment: 50,
      liquidityDepth: 50,
      volumeChange: 0,
      timestamp: Date.now(),
    };
  }

  public predictSuccessProbability(
    opportunityId: string,
    features: MLFeatureVector
  ): MLPrediction {
    const clusterLabel = this.findNearestCluster(features);
    const clusterBonus = this.getClusterBonus(clusterLabel);

    const baseScore = 
      (features.priceVolatility * this.modelWeights.volatilityWeight) +
      (features.tvlChange * this.modelWeights.tvlWeight) +
      (features.gasPrice * this.modelWeights.gasWeight / 100) +
      (features.agentPerformance * this.modelWeights.performanceWeight) +
      (features.marketSentiment * this.modelWeights.sentimentWeight) +
      (features.liquidityDepth * this.modelWeights.liquidityWeight) +
      (features.volumeChange * this.modelWeights.volumeWeight);

    const normalizedScore = Math.min(100, Math.max(0, 50 + baseScore + (clusterBonus * this.modelWeights.clusterBonusWeight * 100)));
    
    const expectedReturn = this.calculateExpectedReturn(normalizedScore, features);
    const riskAdjustedScore = this.calculateRiskAdjustedScore(normalizedScore, features);

    const prediction: MLPrediction = {
      id: `pred-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      opportunityId,
      successProbability: Math.round(normalizedScore),
      expectedReturn: Math.round(expectedReturn * 100),
      riskAdjustedScore: Math.round(riskAdjustedScore),
      features,
      clusterLabel,
      modelVersion: this.modelVersion,
      timestamp: Date.now(),
    };

    this.modelMetrics.totalPredictions++;
    this.emit("predictionMade", prediction);

    return prediction;
  }

  private findNearestCluster(features: MLFeatureVector): MarketCluster["label"] {
    if (this.clusters.size === 0) {
      return this.classifyCluster(features);
    }

    let nearestLabel: MarketCluster["label"] = "sideways";
    let minDistance = Infinity;

    for (const cluster of this.clusters.values()) {
      const distance = this.euclideanDistance(features, cluster.centroid);
      if (distance < minDistance) {
        minDistance = distance;
        nearestLabel = cluster.label;
      }
    }

    return nearestLabel;
  }

  private getClusterBonus(label: MarketCluster["label"]): number {
    const bonusMap: Record<MarketCluster["label"], number> = {
      bullish: 0.15,
      stable: 0.10,
      sideways: 0,
      volatile: -0.10,
      bearish: -0.15,
    };
    return bonusMap[label];
  }

  private calculateExpectedReturn(successProbability: number, features: MLFeatureVector): number {
    const baseReturn = (successProbability / 100) * 0.15;
    const volatilityAdjustment = Math.min(0.05, features.priceVolatility * 0.002);
    const liquidityAdjustment = features.liquidityDepth > 70 ? 0.02 : -0.01;
    
    return baseReturn + volatilityAdjustment + liquidityAdjustment;
  }

  private calculateRiskAdjustedScore(successProbability: number, features: MLFeatureVector): number {
    const volatilityPenalty = features.priceVolatility * 0.5;
    const gasPenalty = features.gasPrice > 100 ? (features.gasPrice - 100) * 0.1 : 0;
    const liquidityBonus = features.liquidityDepth > 70 ? 5 : 0;
    
    return Math.max(0, Math.min(100, successProbability - volatilityPenalty - gasPenalty + liquidityBonus));
  }

  public train(newDataPoints: TrainingDataPoint[]): void {
    this.trainingData.push(...newDataPoints);
    
    if (this.trainingData.length < 10) {
      return;
    }

    const successfulPoints = this.trainingData.filter(p => p.outcome === "success");
    const failedPoints = this.trainingData.filter(p => p.outcome === "failure");

    if (successfulPoints.length > 0 && failedPoints.length > 0) {
      this.adjustWeights(successfulPoints, failedPoints);
    }

    const featureVectors = this.trainingData.map(p => p.features);
    this.performKMeansClustering(featureVectors, { k: 5, maxIterations: 50, tolerance: 0.01 });

    this.updateModelMetrics();
    this.emit("modelTrained", this.modelMetrics);
  }

  private adjustWeights(
    successfulPoints: TrainingDataPoint[],
    failedPoints: TrainingDataPoint[]
  ): void {
    const successAvg = this.averageFeatures(successfulPoints.map(p => p.features));
    const failedAvg = this.averageFeatures(failedPoints.map(p => p.features));

    const learningRate = 0.01;

    const diffs = {
      volatility: successAvg.priceVolatility - failedAvg.priceVolatility,
      tvl: successAvg.tvlChange - failedAvg.tvlChange,
      gas: successAvg.gasPrice - failedAvg.gasPrice,
      performance: successAvg.agentPerformance - failedAvg.agentPerformance,
      sentiment: successAvg.marketSentiment - failedAvg.marketSentiment,
      liquidity: successAvg.liquidityDepth - failedAvg.liquidityDepth,
      volume: successAvg.volumeChange - failedAvg.volumeChange,
    };

    this.modelWeights.volatilityWeight += Math.sign(diffs.volatility) * learningRate;
    this.modelWeights.tvlWeight += Math.sign(diffs.tvl) * learningRate;
    this.modelWeights.gasWeight += Math.sign(diffs.gas) * learningRate;
    this.modelWeights.performanceWeight += Math.sign(diffs.performance) * learningRate;
    this.modelWeights.sentimentWeight += Math.sign(diffs.sentiment) * learningRate;
    this.modelWeights.liquidityWeight += Math.sign(diffs.liquidity) * learningRate;
    this.modelWeights.volumeWeight += Math.sign(diffs.volume) * learningRate;

    this.normalizeWeights();
  }

  private averageFeatures(features: MLFeatureVector[]): MLFeatureVector {
    return {
      priceVolatility: this.average(features.map(f => f.priceVolatility)),
      tvlChange: this.average(features.map(f => f.tvlChange)),
      gasPrice: this.average(features.map(f => f.gasPrice)),
      agentPerformance: this.average(features.map(f => f.agentPerformance)),
      marketSentiment: this.average(features.map(f => f.marketSentiment)),
      liquidityDepth: this.average(features.map(f => f.liquidityDepth)),
      volumeChange: this.average(features.map(f => f.volumeChange)),
      timestamp: Date.now(),
    };
  }

  private normalizeWeights(): void {
    const sum = Math.abs(this.modelWeights.volatilityWeight) +
                Math.abs(this.modelWeights.tvlWeight) +
                Math.abs(this.modelWeights.gasWeight) +
                Math.abs(this.modelWeights.performanceWeight) +
                Math.abs(this.modelWeights.sentimentWeight) +
                Math.abs(this.modelWeights.liquidityWeight) +
                Math.abs(this.modelWeights.volumeWeight) +
                Math.abs(this.modelWeights.clusterBonusWeight);

    if (sum > 0) {
      this.modelWeights.volatilityWeight /= sum;
      this.modelWeights.tvlWeight /= sum;
      this.modelWeights.gasWeight /= sum;
      this.modelWeights.performanceWeight /= sum;
      this.modelWeights.sentimentWeight /= sum;
      this.modelWeights.liquidityWeight /= sum;
      this.modelWeights.volumeWeight /= sum;
      this.modelWeights.clusterBonusWeight /= sum;
    }
  }

  private updateModelMetrics(): void {
    const recentData = this.trainingData.slice(-100);
    let correctPredictions = 0;
    let truePositives = 0;
    let falsePositives = 0;
    let falseNegatives = 0;

    for (const dataPoint of recentData) {
      const prediction = this.predictSuccessProbability("test", dataPoint.features);
      const predictedSuccess = prediction.successProbability >= 50;
      const actualSuccess = dataPoint.outcome === "success";

      if (predictedSuccess === actualSuccess) {
        correctPredictions++;
      }

      if (predictedSuccess && actualSuccess) truePositives++;
      if (predictedSuccess && !actualSuccess) falsePositives++;
      if (!predictedSuccess && actualSuccess) falseNegatives++;
    }

    this.modelMetrics.correctPredictions = correctPredictions;
    this.modelMetrics.accuracy = Math.round((correctPredictions / recentData.length) * 100);
    
    const precision = truePositives / (truePositives + falsePositives) || 0;
    const recall = truePositives / (truePositives + falseNegatives) || 0;
    
    this.modelMetrics.precision = Math.round(precision * 100);
    this.modelMetrics.recall = Math.round(recall * 100);
    this.modelMetrics.f1Score = precision + recall > 0 
      ? Math.round((2 * precision * recall) / (precision + recall) * 100) 
      : 0;
    
    this.modelMetrics.lastTrainedAt = Date.now();
    this.modelMetrics.trainingDataPoints = this.trainingData.length;
  }

  public recordOutcome(opportunityId: string, outcome: "success" | "failure", actualReturn: number): void {
    const recentPrediction = Array.from(this.clusters.values())
      .flatMap(c => c.members)
      .find(m => m.includes(opportunityId));

    if (recentPrediction) {
      this.modelMetrics.totalPredictions++;
      if (outcome === "success") {
        this.modelMetrics.correctPredictions++;
      }
    }

    this.emit("outcomeRecorded", { opportunityId, outcome, actualReturn });
  }

  public getModelMetrics(): MLModelMetrics {
    return { ...this.modelMetrics };
  }

  public getClusters(): MarketCluster[] {
    return Array.from(this.clusters.values());
  }

  public getModelWeights(): PredictionModelWeights {
    return { ...this.modelWeights };
  }

  public saveToJSON(): string {
    return JSON.stringify({
      clusters: Array.from(this.clusters.entries()),
      trainingData: this.trainingData,
      modelMetrics: this.modelMetrics,
      modelWeights: this.modelWeights,
    });
  }

  public loadFromJSON(json: string): void {
    const data = JSON.parse(json);
    this.clusters = new Map(data.clusters || []);
    this.trainingData = data.trainingData || [];
    this.modelMetrics = data.modelMetrics || this.modelMetrics;
    this.modelWeights = data.modelWeights || this.modelWeights;
  }
}

export const mlPatternRecognition = new MLPatternRecognition();
