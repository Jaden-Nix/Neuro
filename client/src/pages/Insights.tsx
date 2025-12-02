import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Activity,
  AlertTriangle,
  Zap,
  Target,
  BarChart3,
  RefreshCw,
  Filter,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Waves,
  Anchor,
  Scale,
  GitBranch,
  Eye,
  Shield,
} from "lucide-react";

type PatternType =
  | "momentum_shift"
  | "whale_accumulation"
  | "volatility_cluster"
  | "trend_reversal"
  | "liquidity_squeeze"
  | "correlated_movement"
  | "breakout_signal"
  | "support_resistance"
  | "divergence";

type ImpactLevel = "Critical" | "High" | "Medium" | "Low";

type SuggestedAction =
  | "Increase position"
  | "Reduce risk"
  | "Hold"
  | "Exit position"
  | "Scale in"
  | "Scale out"
  | "Hedge"
  | "Wait for confirmation"
  | "Monitor closely";

interface AIInsight {
  id: string;
  pattern: PatternType;
  confidence: number;
  reason: string;
  impact: ImpactLevel;
  suggestedAction: SuggestedAction;
  symbol: string;
  timestamp: number;
  metadata: {
    priceChange?: number;
    volumeChange?: number;
    volatility?: number;
    correlatedAssets?: string[];
    timeframe?: string;
    supportLevel?: number;
    resistanceLevel?: number;
  };
}

interface InsightsStats {
  totalInsights: number;
  byPattern: Record<PatternType, number>;
  byImpact: Record<ImpactLevel, number>;
  avgConfidence: number;
}

const PATTERN_INFO: Record<PatternType, { label: string; icon: typeof Brain; color: string; description: string }> = {
  momentum_shift: {
    label: "Momentum Shift",
    icon: TrendingUp,
    color: "bg-blue-500/10 text-blue-500 border-blue-500/30",
    description: "Significant change in price momentum with volume confirmation",
  },
  whale_accumulation: {
    label: "Whale Activity",
    icon: Anchor,
    color: "bg-purple-500/10 text-purple-500 border-purple-500/30",
    description: "Large volume spikes indicating institutional activity",
  },
  volatility_cluster: {
    label: "Volatility Cluster",
    icon: Activity,
    color: "bg-orange-500/10 text-orange-500 border-orange-500/30",
    description: "Sudden increase in price variance and range expansion",
  },
  trend_reversal: {
    label: "Trend Reversal",
    icon: GitBranch,
    color: "bg-green-500/10 text-green-500 border-green-500/30",
    description: "Technical indicators suggesting trend direction change",
  },
  liquidity_squeeze: {
    label: "Liquidity Squeeze",
    icon: Waves,
    color: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
    description: "Thinning liquidity with reduced volume and range",
  },
  correlated_movement: {
    label: "Correlated Movement",
    icon: Scale,
    color: "bg-pink-500/10 text-pink-500 border-pink-500/30",
    description: "Strong correlation detected with other assets",
  },
  breakout_signal: {
    label: "Breakout Signal",
    icon: Zap,
    color: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
    description: "Price breaking through support or resistance levels",
  },
  support_resistance: {
    label: "Support/Resistance",
    icon: Shield,
    color: "bg-slate-500/10 text-slate-500 border-slate-500/30",
    description: "Key price levels identified",
  },
  divergence: {
    label: "Divergence",
    icon: Eye,
    color: "bg-indigo-500/10 text-indigo-500 border-indigo-500/30",
    description: "Price and indicator moving in opposite directions",
  },
};

const IMPACT_COLORS: Record<ImpactLevel, string> = {
  Critical: "bg-red-500/10 text-red-500 border-red-500/30",
  High: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  Medium: "bg-yellow-500/10 text-yellow-500 border-yellow-500/30",
  Low: "bg-green-500/10 text-green-500 border-green-500/30",
};

const ACTION_COLORS: Record<SuggestedAction, string> = {
  "Increase position": "text-green-500",
  "Reduce risk": "text-orange-500",
  "Hold": "text-slate-500",
  "Exit position": "text-red-500",
  "Scale in": "text-green-400",
  "Scale out": "text-orange-400",
  "Hedge": "text-yellow-500",
  "Wait for confirmation": "text-blue-500",
  "Monitor closely": "text-purple-500",
};

export default function Insights() {
  const { toast } = useToast();
  const [selectedPattern, setSelectedPattern] = useState<PatternType | "all">("all");
  const [selectedSymbol, setSelectedSymbol] = useState<string>("all");
  const [minConfidence, setMinConfidence] = useState(0);
  const [selectedInsight, setSelectedInsight] = useState<AIInsight | null>(null);

  const { data: insights = [], isLoading, refetch } = useQuery<AIInsight[]>({
    queryKey: ["/api/insights"],
  });

  const { data: stats } = useQuery<InsightsStats>({
    queryKey: ["/api/insights/stats"],
  });

  const { data: symbols = [] } = useQuery<string[]>({
    queryKey: ["/api/insights/symbols"],
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/insights/demo");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/insights/stats"] });
      toast({
        title: "Insights Generated",
        description: `Detected ${data.count} patterns across ${symbols.length} assets`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate insights",
        variant: "destructive",
      });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (symbol?: string) => {
      const response = await apiRequest("POST", "/api/insights/analyze", { symbol });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/insights"] });
      queryClient.invalidateQueries({ queryKey: ["/api/insights/stats"] });
      toast({
        title: "Analysis Complete",
        description: `Found ${data.count} new patterns`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to analyze market data",
        variant: "destructive",
      });
    },
  });

  const filteredInsights = insights.filter((insight) => {
    if (selectedPattern !== "all" && insight.pattern !== selectedPattern) return false;
    if (selectedSymbol !== "all" && insight.symbol !== selectedSymbol) return false;
    if (insight.confidence < minConfidence / 100) return false;
    return true;
  });

  const formatTimestamp = (ts: number) => {
    const date = new Date(ts);
    return date.toLocaleString();
  };

  const renderInsightCard = (insight: AIInsight) => {
    const patternInfo = PATTERN_INFO[insight.pattern];
    const PatternIcon = patternInfo.icon;

    return (
      <Card
        key={insight.id}
        data-testid={`card-insight-${insight.id}`}
        className={`cursor-pointer transition-all hover-elevate ${
          selectedInsight?.id === insight.id ? "ring-2 ring-primary" : ""
        }`}
        onClick={() => setSelectedInsight(insight)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className={`p-2 rounded-md ${patternInfo.color}`}>
                <PatternIcon className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">{patternInfo.label}</CardTitle>
                <CardDescription className="text-xs">{insight.symbol}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={IMPACT_COLORS[insight.impact]}>
                {insight.impact}
              </Badge>
              <Badge variant="secondary" className="font-mono">
                {(insight.confidence * 100).toFixed(0)}%
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm text-muted-foreground mb-3">{insight.reason}</p>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className={`flex items-center gap-1 text-sm font-medium ${ACTION_COLORS[insight.suggestedAction]}`}>
              <Target className="h-3 w-3" />
              {insight.suggestedAction}
            </div>
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(insight.timestamp)}
            </span>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderDetailPanel = () => {
    if (!selectedInsight) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
          <Brain className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Select an insight to view details</p>
          <p className="text-sm">Click on any insight card to see more information</p>
        </div>
      );
    }

    const patternInfo = PATTERN_INFO[selectedInsight.pattern];
    const PatternIcon = patternInfo.icon;
    const metadata = selectedInsight.metadata;

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-start gap-4">
          <div className={`p-3 rounded-lg ${patternInfo.color}`}>
            <PatternIcon className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold">{patternInfo.label}</h3>
            <p className="text-sm text-muted-foreground">{patternInfo.description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Symbol</p>
            <p className="text-lg font-semibold">{selectedInsight.symbol}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Confidence</p>
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary"
                  style={{ width: `${selectedInsight.confidence * 100}%` }}
                />
              </div>
              <span className="text-lg font-semibold">{(selectedInsight.confidence * 100).toFixed(0)}%</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Impact</p>
            <Badge variant="outline" className={`${IMPACT_COLORS[selectedInsight.impact]} text-base`}>
              {selectedInsight.impact}
            </Badge>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Detected At</p>
            <p className="text-sm">{formatTimestamp(selectedInsight.timestamp)}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Analysis</p>
          <div className="p-4 bg-muted/50 rounded-lg">
            <p className="text-sm">{selectedInsight.reason}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Recommended Action</p>
          <div className={`flex items-center gap-2 text-lg font-semibold ${ACTION_COLORS[selectedInsight.suggestedAction]}`}>
            <Target className="h-5 w-5" />
            {selectedInsight.suggestedAction}
          </div>
        </div>

        {Object.keys(metadata).length > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Metadata</p>
            <div className="grid grid-cols-2 gap-3">
              {metadata.priceChange !== undefined && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Price Change</p>
                  <div className={`flex items-center gap-1 text-lg font-semibold ${metadata.priceChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {metadata.priceChange >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {metadata.priceChange.toFixed(2)}%
                  </div>
                </div>
              )}
              {metadata.volumeChange !== undefined && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Volume Change</p>
                  <div className={`flex items-center gap-1 text-lg font-semibold ${metadata.volumeChange >= 0 ? "text-green-500" : "text-red-500"}`}>
                    {metadata.volumeChange >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                    {metadata.volumeChange.toFixed(0)}%
                  </div>
                </div>
              )}
              {metadata.volatility !== undefined && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Volatility Ratio</p>
                  <p className="text-lg font-semibold">{metadata.volatility.toFixed(2)}x</p>
                </div>
              )}
              {metadata.supportLevel !== undefined && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Support Level</p>
                  <p className="text-lg font-semibold">${metadata.supportLevel.toFixed(2)}</p>
                </div>
              )}
              {metadata.resistanceLevel !== undefined && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Resistance Level</p>
                  <p className="text-lg font-semibold">${metadata.resistanceLevel.toFixed(2)}</p>
                </div>
              )}
              {metadata.correlatedAssets && metadata.correlatedAssets.length > 0 && (
                <div className="p-3 bg-muted/50 rounded-lg col-span-2">
                  <p className="text-xs text-muted-foreground mb-2">Correlated Assets</p>
                  <div className="flex flex-wrap gap-2">
                    {metadata.correlatedAssets.map((asset) => (
                      <Badge key={asset} variant="secondary">{asset}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const patternCounts = stats?.byPattern || {};
  const impactCounts = stats?.byImpact || {};

  return (
    <div className="flex flex-col h-full" data-testid="page-insights">
      <div className="flex items-center justify-between gap-4 p-4 border-b flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            AI Insights
          </h1>
          <p className="text-sm text-muted-foreground">
            Advanced ML pattern recognition for market analysis
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            data-testid="button-refresh-insights"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={() => analyzeMutation.mutate()}
            disabled={analyzeMutation.isPending}
            data-testid="button-analyze"
          >
            {analyzeMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <BarChart3 className="h-4 w-4 mr-2" />
            )}
            Analyze Market
          </Button>
          <Button
            variant="secondary"
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            data-testid="button-generate-demo"
          >
            {generateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Zap className="h-4 w-4 mr-2" />
            )}
            Generate Demo
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Insights</p>
                <p className="text-2xl font-bold">{stats?.totalInsights || 0}</p>
              </div>
              <Brain className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg Confidence</p>
                <p className="text-2xl font-bold">{((stats?.avgConfidence || 0) * 100).toFixed(0)}%</p>
              </div>
              <Target className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Critical Alerts</p>
                <p className="text-2xl font-bold text-red-500">{impactCounts.Critical || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">High Priority</p>
                <p className="text-2xl font-bold text-orange-500">{impactCounts.High || 0}</p>
              </div>
              <Activity className="h-8 w-8 text-orange-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="flex-1 flex flex-col">
        <div className="px-4">
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">All Patterns</TabsTrigger>
            <TabsTrigger value="momentum" data-testid="tab-momentum">Momentum</TabsTrigger>
            <TabsTrigger value="whale" data-testid="tab-whale">Whale Activity</TabsTrigger>
            <TabsTrigger value="volatility" data-testid="tab-volatility">Volatility</TabsTrigger>
            <TabsTrigger value="reversal" data-testid="tab-reversal">Reversals</TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 p-4 overflow-hidden">
          <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <Select value={selectedSymbol} onValueChange={setSelectedSymbol}>
                  <SelectTrigger className="w-32" data-testid="select-symbol">
                    <SelectValue placeholder="Symbol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Symbols</SelectItem>
                    {symbols.map((sym) => (
                      <SelectItem key={sym} value={sym}>{sym}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Min Confidence:</span>
                <Slider
                  value={[minConfidence]}
                  onValueChange={([v]) => setMinConfidence(v)}
                  max={100}
                  step={5}
                  className="w-24"
                  data-testid="slider-confidence"
                />
                <span className="text-sm font-mono w-10">{minConfidence}%</span>
              </div>
              <Badge variant="secondary" className="ml-auto">
                {filteredInsights.length} results
              </Badge>
            </div>

            <ScrollArea className="flex-1">
              <TabsContent value="all" className="m-0 space-y-3">
                {isLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredInsights.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                    <Brain className="h-12 w-12 mb-4 opacity-50" />
                    <p>No insights detected yet</p>
                    <p className="text-sm">Click "Generate Demo" to create sample insights</p>
                  </div>
                ) : (
                  filteredInsights.map(renderInsightCard)
                )}
              </TabsContent>
              <TabsContent value="momentum" className="m-0 space-y-3">
                {insights
                  .filter((i) => i.pattern === "momentum_shift")
                  .filter((i) => i.confidence >= minConfidence / 100)
                  .map(renderInsightCard)}
              </TabsContent>
              <TabsContent value="whale" className="m-0 space-y-3">
                {insights
                  .filter((i) => i.pattern === "whale_accumulation")
                  .filter((i) => i.confidence >= minConfidence / 100)
                  .map(renderInsightCard)}
              </TabsContent>
              <TabsContent value="volatility" className="m-0 space-y-3">
                {insights
                  .filter((i) => i.pattern === "volatility_cluster")
                  .filter((i) => i.confidence >= minConfidence / 100)
                  .map(renderInsightCard)}
              </TabsContent>
              <TabsContent value="reversal" className="m-0 space-y-3">
                {insights
                  .filter((i) => i.pattern === "trend_reversal")
                  .filter((i) => i.confidence >= minConfidence / 100)
                  .map(renderInsightCard)}
              </TabsContent>
            </ScrollArea>
          </div>

          <Card className="overflow-hidden">
            <CardHeader className="border-b bg-muted/30">
              <CardTitle className="text-sm">Insight Details</CardTitle>
            </CardHeader>
            <ScrollArea className="h-[calc(100vh-400px)]">
              {renderDetailPanel()}
            </ScrollArea>
          </Card>
        </div>
      </Tabs>
    </div>
  );
}
