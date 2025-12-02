import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Moon,
  Sun,
  Zap,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Shield,
  Activity,
  Target,
  Loader2,
  Sparkles,
  Brain,
  Eye,
  Scan,
  CheckCircle2,
  Info,
} from "lucide-react";
import { AgentType } from "@shared/schema";

interface DreamOpportunity {
  id: string;
  protocol: string;
  pool: string;
  chain: string;
  yield: number;
  riskScore: number;
  confidence: number;
  reasoning: string;
  tvl: number;
  volume24h: number;
  timestamp: number;
}

interface DreamInsight {
  id: string;
  type: "yield_opportunity" | "risk_warning" | "anomaly" | "correlation" | "volatility" | "tvl_change";
  summary: string;
  details: string;
  severity: "info" | "warning" | "critical" | "opportunity";
  confidence: number;
  timestamp: number;
  source: string;
  data?: Record<string, any>;
}

interface AgentDreamLog {
  agentType: AgentType;
  message: string;
  action?: string;
  timestamp: number;
}

interface MorningReport {
  id: string;
  sessionId: string;
  generatedAt: number;
  sleepDuration: number;
  summary: {
    totalScans: number;
    opportunitiesFound: number;
    passedRiskFilter: number;
    highConfidence: number;
  };
  topOpportunities: DreamOpportunity[];
  insights: DreamInsight[];
  agentLogs: AgentDreamLog[];
  recommendedAction: string;
  marketCondition: "bullish" | "bearish" | "sideways" | "volatile";
}

interface DreamStatus {
  isActive: boolean;
  session: any;
  cycleCount: number;
  insightsCount: number;
  opportunitiesCount: number;
}

const AGENT_COLORS: Record<AgentType, string> = {
  meta: "text-purple-500",
  scout: "text-blue-500",
  risk: "text-orange-500",
  execution: "text-green-500",
};

const AGENT_ICONS: Record<AgentType, typeof Brain> = {
  meta: Brain,
  scout: Scan,
  risk: Shield,
  execution: Zap,
};

const SEVERITY_STYLES: Record<string, { bg: string; icon: typeof Info }> = {
  info: { bg: "bg-blue-500/10 text-blue-500 border-blue-500/30", icon: Info },
  warning: { bg: "bg-orange-500/10 text-orange-500 border-orange-500/30", icon: AlertTriangle },
  critical: { bg: "bg-red-500/10 text-red-500 border-red-500/30", icon: AlertTriangle },
  opportunity: { bg: "bg-green-500/10 text-green-500 border-green-500/30", icon: TrendingUp },
};

const MARKET_CONDITION_STYLES: Record<string, { color: string; icon: typeof Activity }> = {
  bullish: { color: "text-green-500", icon: TrendingUp },
  bearish: { color: "text-red-500", icon: TrendingDown },
  sideways: { color: "text-yellow-500", icon: Activity },
  volatile: { color: "text-orange-500", icon: Zap },
};

export default function DreamMode() {
  const { toast } = useToast();
  const [report, setReport] = useState<MorningReport | null>(null);

  const { data: status } = useQuery<DreamStatus>({
    queryKey: ["/api/dream/engine/status"],
    refetchInterval: (query) => query.state.data?.isActive ? 5000 : false,
  });

  const startDreamMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/dream/engine/start", { depth: 5 });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dream/engine/status"] });
      toast({
        title: "Dream Mode Activated",
        description: "NeuroNet is now scanning while you're away...",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Start Dream Mode",
        description: error.message || "Could not enter dream state",
        variant: "destructive",
      });
    },
  });

  const stopDreamMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/dream/engine/stop");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/dream/engine/status"] });
      setReport(data.report);
      toast({
        title: "Good Morning!",
        description: "Your overnight report is ready",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to Wake",
        description: error.message || "Could not generate report",
        variant: "destructive",
      });
    },
  });

  const generateDemoMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/dream/engine/demo");
      return response.json();
    },
    onSuccess: (data) => {
      setReport(data);
      toast({
        title: "Demo Report Generated",
        description: `Found ${data.topOpportunities?.length || 0} opportunities overnight`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Demo Failed",
        description: error.message || "Could not generate demo report",
        variant: "destructive",
      });
    },
  });

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatNumber = (n: number) => {
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n.toFixed(0)}`;
  };

  const renderDreamingState = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
      <div className="relative">
        <div className="w-32 h-32 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 animate-pulse flex items-center justify-center">
          <Moon className="w-16 h-16 text-indigo-400 animate-bounce" style={{ animationDuration: "3s" }} />
        </div>
        <div className="absolute -top-2 -right-2">
          <Sparkles className="w-6 h-6 text-yellow-400 animate-pulse" />
        </div>
        <div className="absolute -bottom-1 -left-1">
          <Sparkles className="w-4 h-4 text-purple-400 animate-pulse" style={{ animationDelay: "0.5s" }} />
        </div>
      </div>
      
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">NeuroNet is Dreaming...</h2>
        <p className="text-muted-foreground max-w-md">
          Agents are scanning protocols, analyzing risks, and detecting opportunities while you're away.
        </p>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <Activity className="w-4 h-4" />
          <span>{status?.cycleCount || 0} cycles</span>
        </div>
        <div className="flex items-center gap-1">
          <Eye className="w-4 h-4" />
          <span>{status?.insightsCount || 0} insights</span>
        </div>
        <div className="flex items-center gap-1">
          <Target className="w-4 h-4" />
          <span>{status?.opportunitiesCount || 0} opportunities</span>
        </div>
      </div>

      <Button 
        onClick={() => stopDreamMutation.mutate()}
        disabled={stopDreamMutation.isPending}
        size="lg"
        className="mt-4"
        data-testid="button-wake-up"
      >
        {stopDreamMutation.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Sun className="w-4 h-4 mr-2" />
        )}
        Wake Up & Get Report
      </Button>
    </div>
  );

  const renderIdleState = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-6">
      <div className="w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center">
        <Moon className="w-12 h-12 text-muted-foreground" />
      </div>
      
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Enable Dream Mode</h2>
        <p className="text-muted-foreground max-w-md">
          Let NeuroNet work while you sleep. Agents will scan protocols, detect patterns, 
          and generate a comprehensive morning report.
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={() => startDreamMutation.mutate()}
          disabled={startDreamMutation.isPending}
          size="lg"
          data-testid="button-start-dream"
        >
          {startDreamMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Moon className="w-4 h-4 mr-2" />
          )}
          Enter Dream Mode
        </Button>
        <Button
          variant="outline"
          onClick={() => generateDemoMutation.mutate()}
          disabled={generateDemoMutation.isPending}
          size="lg"
          data-testid="button-generate-demo"
        >
          {generateDemoMutation.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          Generate Demo Report
        </Button>
      </div>
    </div>
  );

  const renderMorningReport = () => {
    if (!report) return null;

    const MarketIcon = MARKET_CONDITION_STYLES[report.marketCondition]?.icon || Activity;
    const marketColor = MARKET_CONDITION_STYLES[report.marketCondition]?.color || "text-muted-foreground";

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Sun className="w-6 h-6 text-yellow-500" />
              Good Morning!
            </h2>
            <p className="text-muted-foreground">
              Here's what NeuroNet discovered while you were away
            </p>
          </div>
          <Badge variant="outline" className={`${marketColor} text-base px-3 py-1`}>
            <MarketIcon className="w-4 h-4 mr-1" />
            {report.marketCondition.charAt(0).toUpperCase() + report.marketCondition.slice(1)} Market
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Scans</p>
                  <p className="text-2xl font-bold">{report.summary.totalScans}</p>
                </div>
                <Scan className="w-8 h-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Opportunities</p>
                  <p className="text-2xl font-bold">{report.summary.opportunitiesFound}</p>
                </div>
                <Target className="w-8 h-8 text-muted-foreground/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Passed Risk</p>
                  <p className="text-2xl font-bold text-green-500">{report.summary.passedRiskFilter}</p>
                </div>
                <Shield className="w-8 h-8 text-green-500/50" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">High Confidence</p>
                  <p className="text-2xl font-bold text-blue-500">{report.summary.highConfidence}</p>
                </div>
                <CheckCircle2 className="w-8 h-8 text-blue-500/50" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium mb-1">Recommended Action</p>
                <p className="text-sm text-muted-foreground">{report.recommendedAction}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="opportunities" className="space-y-4">
          <TabsList>
            <TabsTrigger value="opportunities" data-testid="tab-opportunities">
              Top Opportunities ({report.topOpportunities.length})
            </TabsTrigger>
            <TabsTrigger value="insights" data-testid="tab-insights">
              Night Insights ({report.insights.length})
            </TabsTrigger>
            <TabsTrigger value="agents" data-testid="tab-agents">
              Agent Logs ({report.agentLogs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="opportunities" className="space-y-3">
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {report.topOpportunities.map((opp, index) => (
                  <Card key={opp.id} data-testid={`card-opportunity-${index}`}>
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{opp.protocol}</span>
                            <Badge variant="secondary">{opp.pool}</Badge>
                            <Badge variant="outline">{opp.chain}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{opp.reasoning}</p>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-2xl font-bold text-green-500">{opp.yield.toFixed(1)}%</p>
                          <p className="text-xs text-muted-foreground">APY</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 mt-3 text-sm flex-wrap">
                        <div className="flex items-center gap-1">
                          <Shield className="w-3 h-3" />
                          <span className={opp.riskScore < 30 ? "text-green-500" : opp.riskScore < 50 ? "text-yellow-500" : "text-red-500"}>
                            Risk: {opp.riskScore}/100
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          <span>Confidence: {(opp.confidence * 100).toFixed(0)}%</span>
                        </div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Activity className="w-3 h-3" />
                          <span>TVL: {formatNumber(opp.tvl)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="insights" className="space-y-3">
            <ScrollArea className="h-[400px]">
              <div className="space-y-3 pr-4">
                {report.insights.map((insight, index) => {
                  const style = SEVERITY_STYLES[insight.severity] || SEVERITY_STYLES.info;
                  const SeverityIcon = style.icon;
                  
                  return (
                    <Card key={insight.id} data-testid={`card-insight-${index}`}>
                      <CardContent className="pt-4">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg ${style.bg}`}>
                            <SeverityIcon className="w-4 h-4" />
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="font-medium">{insight.summary}</p>
                              <Badge variant="outline" className="text-xs">
                                {insight.source}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{insight.details}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{formatTimestamp(insight.timestamp)}</span>
                              <span>Confidence: {(insight.confidence * 100).toFixed(0)}%</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="agents" className="space-y-3">
            <ScrollArea className="h-[400px]">
              <div className="space-y-2 pr-4">
                {report.agentLogs.map((log, index) => {
                  const AgentIcon = AGENT_ICONS[log.agentType] || Brain;
                  const agentColor = AGENT_COLORS[log.agentType] || "text-muted-foreground";
                  
                  return (
                    <div 
                      key={index} 
                      className="flex items-start gap-3 p-3 rounded-lg bg-muted/50"
                      data-testid={`log-agent-${index}`}
                    >
                      <AgentIcon className={`w-4 h-4 mt-0.5 ${agentColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`font-medium capitalize ${agentColor}`}>
                            [{log.agentType}]
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                        <p className="text-sm">{log.message}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <div className="flex justify-center gap-3 pt-4">
          <Button
            variant="outline"
            onClick={() => setReport(null)}
            data-testid="button-clear-report"
          >
            Clear Report
          </Button>
          <Button
            onClick={() => startDreamMutation.mutate()}
            disabled={startDreamMutation.isPending}
            data-testid="button-dream-again"
          >
            <Moon className="w-4 h-4 mr-2" />
            Enter Dream Mode Again
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full" data-testid="page-dream-mode">
      <div className="flex items-center justify-between gap-4 p-4 border-b flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Moon className="w-6 h-6 text-indigo-500" />
            Dream Mode
          </h1>
          <p className="text-sm text-muted-foreground">
            Autonomous overnight scanning and morning reports
          </p>
        </div>
        {status?.isActive && (
          <Badge variant="secondary" className="animate-pulse">
            <Activity className="w-3 h-3 mr-1" />
            Dreaming...
          </Badge>
        )}
      </div>

      <div className="flex-1 p-4 overflow-auto">
        {status?.isActive ? (
          renderDreamingState()
        ) : report ? (
          renderMorningReport()
        ) : (
          renderIdleState()
        )}
      </div>
    </div>
  );
}
