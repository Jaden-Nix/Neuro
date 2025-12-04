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
  Search,
  CheckCircle,
  XCircle,
  ArrowRight,
  Coins,
  TrendingUp as Yield,
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

interface DeFiOpportunity {
  id: string;
  protocol: string;
  type: "yield_farming" | "staking" | "liquidity_provision" | "lending";
  apy: number;
  tvl: number;
  risk: "low" | "medium" | "high";
  chain: string;
  token: string;
  scoutScore: number;
  riskScore: number;
  executionReady: boolean;
  agentFlow: {
    scout: { analyzed: boolean; confidence: number; notes: string };
    risk: { analyzed: boolean; approved: boolean; concerns: string[] };
    execution: { ready: boolean; estimatedGas: number; slippage: number };
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
  const [selectedOpportunity, setSelectedOpportunity] = useState<DeFiOpportunity | null>(null);
  const [activeTab, setActiveTab] = useState("opportunities");

  const { data: insights = [], isLoading, refetch } = useQuery<AIInsight[]>({
    queryKey: ["/api/insights"],
  });

  const { data: stats } = useQuery<InsightsStats>({
    queryKey: ["/api/insights/stats"],
  });

  const { data: symbols = [] } = useQuery<string[]>({
    queryKey: ["/api/insights/symbols"],
  });

  const { data: opportunities = [], isLoading: isLoadingOpportunities, refetch: refetchOpportunities } = useQuery<DeFiOpportunity[]>({
    queryKey: ["/api/defi/opportunities"],
    refetchInterval: 30000,
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

  const formatTVL = (tvl: number) => {
    if (tvl >= 1e9) return `$${(tvl / 1e9).toFixed(1)}B`;
    if (tvl >= 1e6) return `$${(tvl / 1e6).toFixed(1)}M`;
    return `$${tvl.toLocaleString()}`;
  };

  const renderOpportunityCard = (opp: DeFiOpportunity) => {
    const riskColors = {
      low: "text-green-500 bg-green-500/10",
      medium: "text-yellow-500 bg-yellow-500/10",
      high: "text-red-500 bg-red-500/10",
    };

    return (
      <Card
        key={opp.id}
        data-testid={`card-opportunity-${opp.id}`}
        className={`cursor-pointer transition-all hover-elevate ${
          selectedOpportunity?.id === opp.id ? "ring-2 ring-primary" : ""
        }`}
        onClick={() => setSelectedOpportunity(opp)}
      >
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-md bg-primary/10 text-primary">
                <Coins className="h-4 w-4" />
              </div>
              <div>
                <CardTitle className="text-sm font-medium">{opp.protocol}</CardTitle>
                <CardDescription className="text-xs">{opp.chain} - {opp.token}</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={riskColors[opp.risk]}>
                {opp.risk.toUpperCase()}
              </Badge>
              <Badge variant="secondary" className="font-mono text-green-500">
                {opp.apy.toFixed(1)}% APY
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground mb-3">
            <span>TVL: {formatTVL(opp.tvl)}</span>
            <span className="capitalize">{opp.type.replace("_", " ")}</span>
          </div>
          
          <div className="flex items-center gap-1 text-xs">
            <div className={`flex items-center gap-1 px-2 py-1 rounded ${opp.agentFlow.scout.analyzed ? "bg-blue-500/10 text-blue-500" : "bg-muted text-muted-foreground"}`}>
              <Search className="h-3 w-3" />
              <span>Scout</span>
              {opp.agentFlow.scout.analyzed && <CheckCircle className="h-3 w-3" />}
            </div>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <div className={`flex items-center gap-1 px-2 py-1 rounded ${opp.agentFlow.risk.analyzed ? (opp.agentFlow.risk.approved ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500") : "bg-muted text-muted-foreground"}`}>
              <Shield className="h-3 w-3" />
              <span>Risk</span>
              {opp.agentFlow.risk.analyzed && (opp.agentFlow.risk.approved ? <CheckCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />)}
            </div>
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
            <div className={`flex items-center gap-1 px-2 py-1 rounded ${opp.executionReady ? "bg-purple-500/10 text-purple-500" : "bg-muted text-muted-foreground"}`}>
              <Zap className="h-3 w-3" />
              <span>Exec</span>
              {opp.executionReady && <CheckCircle className="h-3 w-3" />}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderOpportunityDetails = () => {
    if (!selectedOpportunity) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-center p-6 text-muted-foreground">
          <Coins className="h-12 w-12 mb-4 opacity-50" />
          <p className="text-lg font-medium">Select an opportunity</p>
          <p className="text-sm">Click on any DeFi opportunity to see the agent analysis</p>
        </div>
      );
    }

    const opp = selectedOpportunity;

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <Coins className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-semibold">{opp.protocol}</h3>
            <p className="text-sm text-muted-foreground">{opp.chain} - {opp.type.replace("_", " ")}</p>
          </div>
          <Badge variant="secondary" className="text-lg font-mono text-green-500">
            {opp.apy.toFixed(1)}% APY
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Token</p>
            <p className="text-lg font-semibold">{opp.token}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">TVL</p>
            <p className="text-lg font-semibold">{formatTVL(opp.tvl)}</p>
          </div>
        </div>

        <div className="space-y-4">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">Agent Analysis Flow</p>
          
          <div className="space-y-3">
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Search className="h-4 w-4 text-blue-500" />
                  <span className="font-medium text-blue-500">Scout Agent</span>
                  <Badge variant="secondary" className="ml-auto">
                    {(opp.agentFlow.scout.confidence * 100).toFixed(0)}% confidence
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{opp.agentFlow.scout.notes}</p>
              </CardContent>
            </Card>

            <div className="flex justify-center">
              <ArrowDownRight className="h-5 w-5 text-muted-foreground rotate-45" />
            </div>

            <Card className={`${opp.agentFlow.risk.approved ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className={`h-4 w-4 ${opp.agentFlow.risk.approved ? "text-green-500" : "text-red-500"}`} />
                  <span className={`font-medium ${opp.agentFlow.risk.approved ? "text-green-500" : "text-red-500"}`}>Risk Agent</span>
                  <Badge variant={opp.agentFlow.risk.approved ? "default" : "destructive"} className="ml-auto">
                    {opp.agentFlow.risk.approved ? "APPROVED" : "BLOCKED"}
                  </Badge>
                </div>
                {opp.agentFlow.risk.concerns.length > 0 ? (
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {opp.agentFlow.risk.concerns.map((concern, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertTriangle className="h-3 w-3 mt-0.5 text-yellow-500 shrink-0" />
                        {concern}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No significant concerns identified</p>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-center">
              <ArrowDownRight className="h-5 w-5 text-muted-foreground rotate-45" />
            </div>

            <Card className={`${opp.executionReady ? "bg-purple-500/5 border-purple-500/20" : "bg-muted/50 border-border"}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className={`h-4 w-4 ${opp.executionReady ? "text-purple-500" : "text-muted-foreground"}`} />
                  <span className={`font-medium ${opp.executionReady ? "text-purple-500" : "text-muted-foreground"}`}>Execution Agent</span>
                  <Badge variant={opp.executionReady ? "default" : "secondary"} className="ml-auto">
                    {opp.executionReady ? "READY" : "BLOCKED"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Est. Gas:</span>
                    <span className="ml-2 font-mono">{opp.agentFlow.execution.estimatedGas} gwei</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Slippage:</span>
                    <span className="ml-2 font-mono">{opp.agentFlow.execution.slippage}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {opp.executionReady && (
          <Button className="w-full" data-testid="button-execute-opportunity">
            <Zap className="h-4 w-4 mr-2" />
            Execute Opportunity
          </Button>
        )}
      </div>
    );
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

  const renderInsightDetails = () => {
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
            </div>
          </div>
        )}
      </div>
    );
  };

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
            DeFi opportunities analyzed by Scout, Risk, and Execution agents
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
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">DeFi Opportunities</p>
                <p className="text-2xl font-bold">{isLoadingOpportunities ? "--" : opportunities.filter(o => o.executionReady).length}</p>
              </div>
              <Coins className="h-8 w-8 text-muted-foreground/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Avg APY</p>
                <p className="text-2xl font-bold text-green-500">
                  {isLoadingOpportunities || opportunities.length === 0 ? "N/A" : `${(opportunities.reduce((sum, o) => sum + o.apy, 0) / opportunities.length).toFixed(1)}%`}
                </p>
              </div>
              <Yield className="h-8 w-8 text-green-500/50" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pattern Insights</p>
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
                <p className="text-sm text-muted-foreground">Critical Alerts</p>
                <p className="text-2xl font-bold text-red-500">{impactCounts.Critical || 0}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-red-500/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-4">
          <TabsList>
            <TabsTrigger value="opportunities" data-testid="tab-opportunities">
              <Coins className="h-4 w-4 mr-2" />
              DeFi Opportunities
            </TabsTrigger>
            <TabsTrigger value="patterns" data-testid="tab-patterns">
              <Brain className="h-4 w-4 mr-2" />
              Pattern Insights
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="opportunities" className="flex-1 m-0 p-4 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
            <div className="lg:col-span-2 flex flex-col gap-4 overflow-hidden">
              <div className="flex items-center gap-4 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchOpportunities()}
                  disabled={isLoadingOpportunities}
                  data-testid="button-refresh-opportunities"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoadingOpportunities ? "animate-spin" : ""}`} />
                  Refresh
                </Button>
                <Badge variant="secondary" className="ml-auto">
                  {opportunities.length} opportunities
                </Badge>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-3">
                  {isLoadingOpportunities ? (
                    <div className="flex items-center justify-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : opportunities.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                      <Coins className="h-12 w-12 mb-4 opacity-50" />
                      <p>No opportunities available yet</p>
                      <p className="text-sm">Agent pipeline is analyzing markets...</p>
                    </div>
                  ) : (
                    opportunities.map(renderOpportunityCard)
                  )}
                </div>
              </ScrollArea>
            </div>

            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="border-b bg-muted/30 shrink-0">
                <CardTitle className="text-sm">Agent Analysis</CardTitle>
              </CardHeader>
              <ScrollArea className="flex-1">
                {renderOpportunityDetails()}
              </ScrollArea>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="patterns" className="flex-1 m-0 p-4 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
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
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => generateMutation.mutate()}
                  disabled={generateMutation.isPending}
                  data-testid="button-generate-demo"
                  className="ml-auto"
                >
                  {generateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4 mr-2" />
                  )}
                  Generate Demo
                </Button>
              </div>

              <ScrollArea className="flex-1">
                <div className="space-y-3">
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
                </div>
              </ScrollArea>
            </div>

            <Card className="flex flex-col overflow-hidden">
              <CardHeader className="border-b bg-muted/30 shrink-0">
                <CardTitle className="text-sm">Insight Details</CardTitle>
              </CardHeader>
              <ScrollArea className="flex-1">
                {renderInsightDetails()}
              </ScrollArea>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
