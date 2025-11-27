import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Brain, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  BarChart3,
  Target,
  Activity,
  Zap,
  RefreshCw,
  Network,
  Gauge,
  ChartLine
} from "lucide-react";
import type { MLModelMetrics, MarketCluster, MLPrediction, MLFeatureVector } from "@shared/schema";

interface ModelWeights {
  volatilityWeight: number;
  tvlWeight: number;
  gasWeight: number;
  performanceWeight: number;
  sentimentWeight: number;
  liquidityWeight: number;
  volumeWeight: number;
  clusterBonusWeight: number;
}

function getClusterColor(label: MarketCluster["label"]): string {
  switch (label) {
    case "bullish": return "bg-green-500/20 text-green-700 dark:text-green-300";
    case "bearish": return "bg-red-500/20 text-red-700 dark:text-red-300";
    case "volatile": return "bg-orange-500/20 text-orange-700 dark:text-orange-300";
    case "stable": return "bg-blue-500/20 text-blue-700 dark:text-blue-300";
    case "sideways": return "bg-muted text-muted-foreground";
    default: return "bg-muted";
  }
}

function getClusterIcon(label: MarketCluster["label"]) {
  switch (label) {
    case "bullish": return <TrendingUp className="h-4 w-4" />;
    case "bearish": return <TrendingDown className="h-4 w-4" />;
    case "volatile": return <Activity className="h-4 w-4" />;
    case "stable": return <Minus className="h-4 w-4" />;
    case "sideways": return <Minus className="h-4 w-4" />;
    default: return <Minus className="h-4 w-4" />;
  }
}

function formatPercentage(value: number, decimals: number = 1): string {
  return `${value.toFixed(decimals)}%`;
}

export function MLInsightsDashboard() {
  const { toast } = useToast();
  const [predictionInput, setPredictionInput] = useState({
    opportunityId: "",
    price: "",
    previousPrice: "",
    tvl: "",
    previousTvl: "",
    gasPrice: "",
  });
  const [latestPrediction, setLatestPrediction] = useState<MLPrediction | null>(null);

  const { data: metrics, isLoading: metricsLoading } = useQuery<MLModelMetrics>({
    queryKey: ["/api/ml/metrics"],
    refetchInterval: 30000,
  });

  const { data: clusters = [], isLoading: clustersLoading } = useQuery<MarketCluster[]>({
    queryKey: ["/api/ml/clusters"],
    refetchInterval: 30000,
  });

  const { data: weights } = useQuery<ModelWeights>({
    queryKey: ["/api/ml/weights"],
    refetchInterval: 60000,
  });

  const predictMutation = useMutation({
    mutationFn: async (data: typeof predictionInput) => {
      const res = await apiRequest("POST", "/api/ml/predict", {
        opportunityId: data.opportunityId || `opp-${Date.now()}`,
        marketData: {
          price: parseFloat(data.price) || undefined,
          previousPrice: parseFloat(data.previousPrice) || undefined,
          tvl: parseFloat(data.tvl) || undefined,
          previousTvl: parseFloat(data.previousTvl) || undefined,
          gasPrice: parseFloat(data.gasPrice) || undefined,
        },
      });
      return res.json();
    },
    onSuccess: (prediction: MLPrediction) => {
      setLatestPrediction(prediction);
      queryClient.invalidateQueries({ queryKey: ["/api/ml/metrics"] });
      toast({
        title: "Prediction Complete",
        description: `Success Probability: ${prediction.successProbability}%`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Prediction Failed",
        description: error.message || "Failed to make prediction",
        variant: "destructive",
      });
    },
  });

  const clusterMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ml/cluster", { k: 5, maxIterations: 100 });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ml/clusters"] });
      toast({
        title: "Clustering Complete",
        description: "Market clusters have been updated.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Clustering Failed",
        description: error.message || "Failed to perform clustering",
        variant: "destructive",
      });
    },
  });

  const accuracyScore = metrics?.accuracy || 0;
  const f1Score = metrics?.f1Score || 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-ml-title">ML Pattern Recognition</h2>
          <p className="text-muted-foreground">AI-powered market analysis and opportunity scoring</p>
        </div>
        <Button 
          onClick={() => clusterMutation.mutate()}
          disabled={clusterMutation.isPending}
          variant="outline"
          data-testid="button-refresh-clusters"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${clusterMutation.isPending ? "animate-spin" : ""}`} />
          {clusterMutation.isPending ? "Clustering..." : "Refresh Clusters"}
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Model Accuracy</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-model-accuracy">
              {formatPercentage(accuracyScore)}
            </div>
            <Progress value={accuracyScore} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">F1 Score</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-f1-score">
              {formatPercentage(f1Score)}
            </div>
            <Progress value={f1Score} className="mt-2 h-2" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Predictions</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-predictions">
              {metrics?.totalPredictions || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.correctPredictions || 0} correct
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Training Data</CardTitle>
            <Network className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-training-data">
              {metrics?.trainingDataPoints || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              v{metrics?.version || "1.0.0"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="predict" className="space-y-4">
        <TabsList>
          <TabsTrigger value="predict" data-testid="tab-predict">
            <Zap className="mr-2 h-4 w-4" />
            Predict
          </TabsTrigger>
          <TabsTrigger value="clusters" data-testid="tab-clusters">
            <Network className="mr-2 h-4 w-4" />
            Market Clusters ({clusters.length})
          </TabsTrigger>
          <TabsTrigger value="weights" data-testid="tab-weights">
            <Gauge className="mr-2 h-4 w-4" />
            Model Weights
          </TabsTrigger>
        </TabsList>

        <TabsContent value="predict" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Make Prediction</CardTitle>
                <CardDescription>
                  Enter market data to get ML-powered success probability
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="oppId">Opportunity ID (optional)</Label>
                    <Input
                      id="oppId"
                      placeholder="opp-12345"
                      value={predictionInput.opportunityId}
                      onChange={(e) => setPredictionInput(prev => ({ ...prev, opportunityId: e.target.value }))}
                      data-testid="input-opportunity-id"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="price">Current Price</Label>
                      <Input
                        id="price"
                        type="number"
                        placeholder="1850"
                        value={predictionInput.price}
                        onChange={(e) => setPredictionInput(prev => ({ ...prev, price: e.target.value }))}
                        data-testid="input-current-price"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="prevPrice">Previous Price</Label>
                      <Input
                        id="prevPrice"
                        type="number"
                        placeholder="1800"
                        value={predictionInput.previousPrice}
                        onChange={(e) => setPredictionInput(prev => ({ ...prev, previousPrice: e.target.value }))}
                        data-testid="input-previous-price"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="tvl">Current TVL</Label>
                      <Input
                        id="tvl"
                        type="number"
                        placeholder="8500000"
                        value={predictionInput.tvl}
                        onChange={(e) => setPredictionInput(prev => ({ ...prev, tvl: e.target.value }))}
                        data-testid="input-current-tvl"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="prevTvl">Previous TVL</Label>
                      <Input
                        id="prevTvl"
                        type="number"
                        placeholder="8000000"
                        value={predictionInput.previousTvl}
                        onChange={(e) => setPredictionInput(prev => ({ ...prev, previousTvl: e.target.value }))}
                        data-testid="input-previous-tvl"
                      />
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="gas">Gas Price (Gwei)</Label>
                    <Input
                      id="gas"
                      type="number"
                      placeholder="50"
                      value={predictionInput.gasPrice}
                      onChange={(e) => setPredictionInput(prev => ({ ...prev, gasPrice: e.target.value }))}
                      data-testid="input-gas-price"
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => predictMutation.mutate(predictionInput)}
                  disabled={predictMutation.isPending}
                  data-testid="button-make-prediction"
                >
                  {predictMutation.isPending ? "Analyzing..." : "Get Prediction"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Prediction Result</CardTitle>
                <CardDescription>
                  ML-powered analysis of opportunity success probability
                </CardDescription>
              </CardHeader>
              <CardContent>
                {latestPrediction ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Success Probability</span>
                      <span className={`text-2xl font-bold ${
                        latestPrediction.successProbability >= 70 
                          ? "text-green-600 dark:text-green-400" 
                          : latestPrediction.successProbability >= 40 
                            ? "text-yellow-600 dark:text-yellow-400"
                            : "text-red-600 dark:text-red-400"
                      }`} data-testid="text-success-probability">
                        {latestPrediction.successProbability}%
                      </span>
                    </div>
                    <Progress 
                      value={latestPrediction.successProbability} 
                      className="h-3" 
                    />
                    
                    <div className="grid grid-cols-2 gap-4 pt-4">
                      <div>
                        <p className="text-sm text-muted-foreground">Risk-Adjusted Score</p>
                        <p className="text-lg font-semibold" data-testid="text-risk-adjusted-score">
                          {latestPrediction.riskAdjustedScore}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Expected Return</p>
                        <p className="text-lg font-semibold" data-testid="text-expected-return">
                          {(latestPrediction.expectedReturn / 100).toFixed(2)}%
                        </p>
                      </div>
                    </div>

                    <div className="pt-2">
                      <p className="text-sm text-muted-foreground mb-2">Market Cluster</p>
                      <Badge className={`${getClusterColor(latestPrediction.clusterLabel)} gap-1`}>
                        {getClusterIcon(latestPrediction.clusterLabel)}
                        {latestPrediction.clusterLabel.charAt(0).toUpperCase() + latestPrediction.clusterLabel.slice(1)}
                      </Badge>
                    </div>

                    <div className="pt-2 space-y-2">
                      <p className="text-sm text-muted-foreground">Feature Analysis</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span>Volatility:</span>
                          <span>{latestPrediction.features.priceVolatility.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>TVL Change:</span>
                          <span>{latestPrediction.features.tvlChange.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Agent Perf:</span>
                          <span>{latestPrediction.features.agentPerformance.toFixed(0)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Sentiment:</span>
                          <span>{latestPrediction.features.marketSentiment.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Brain className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>Enter market data and click "Get Prediction"</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="clusters" className="space-y-4">
          {clustersLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading clusters...
              </CardContent>
            </Card>
          ) : clusters.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Network className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No clusters available. Click "Refresh Clusters" to generate them.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {clusters.map((cluster) => (
                <Card key={cluster.id} data-testid={`card-cluster-${cluster.id}`}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <Badge className={`${getClusterColor(cluster.label)} gap-1`}>
                        {getClusterIcon(cluster.label)}
                        {cluster.label.charAt(0).toUpperCase() + cluster.label.slice(1)}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {cluster.members.length} members
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Confidence</span>
                        <span>{cluster.confidence}%</span>
                      </div>
                      <Progress value={cluster.confidence} className="h-2" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Avg Volatility</p>
                        <p className="font-medium">{cluster.centroid.priceVolatility.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg TVL Change</p>
                        <p className="font-medium">{cluster.centroid.tvlChange.toFixed(2)}%</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg Sentiment</p>
                        <p className="font-medium">{cluster.centroid.marketSentiment.toFixed(0)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Avg Liquidity</p>
                        <p className="font-medium">{cluster.centroid.liquidityDepth.toFixed(0)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="weights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Model Feature Weights</CardTitle>
              <CardDescription>
                Current weights used by the ML model to score opportunities
              </CardDescription>
            </CardHeader>
            <CardContent>
              {weights ? (
                <div className="space-y-4">
                  <WeightBar label="Agent Performance" value={weights.performanceWeight} />
                  <WeightBar label="TVL Change" value={weights.tvlWeight} />
                  <WeightBar label="Market Sentiment" value={weights.sentimentWeight} />
                  <WeightBar label="Cluster Bonus" value={weights.clusterBonusWeight} />
                  <WeightBar label="Price Volatility" value={weights.volatilityWeight} negative />
                  <WeightBar label="Gas Price" value={weights.gasWeight} negative />
                  <WeightBar label="Liquidity Depth" value={weights.liquidityWeight} />
                  <WeightBar label="Volume Change" value={weights.volumeWeight} />
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  Loading weights...
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface WeightBarProps {
  label: string;
  value: number;
  negative?: boolean;
}

function WeightBar({ label, value, negative }: WeightBarProps) {
  const absValue = Math.abs(value);
  const percentage = absValue * 100;
  const isNegative = value < 0;
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={isNegative ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}>
          {isNegative ? "-" : "+"}{(absValue * 100).toFixed(1)}%
        </span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div 
          className={`h-full rounded-full transition-all ${
            isNegative 
              ? "bg-red-500/70" 
              : "bg-green-500/70"
          }`}
          style={{ width: `${Math.min(percentage * 4, 100)}%` }}
        />
      </div>
    </div>
  );
}
