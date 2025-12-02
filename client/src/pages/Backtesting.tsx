import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Play,
  Plus,
  Trash2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  Target,
  Scale,
  Activity,
  CheckCircle,
  XCircle,
  Loader2,
  Zap,
  Trophy,
  AlertTriangle,
  Bot,
  Lightbulb,
} from "lucide-react";
import type { 
  BacktestScenario, 
  BacktestRun, 
  QuickBacktestResult, 
  BacktestAgentName,
  BacktestInterval,
  AgentPerformance,
} from "@shared/schema";

const AVAILABLE_AGENTS: BacktestAgentName[] = ["Atlas", "Vega", "Nova", "Sentinel", "Arbiter"];
const INTERVALS: { value: BacktestInterval; label: string }[] = [
  { value: "1m", label: "1 Minute" },
  { value: "5m", label: "5 Minutes" },
  { value: "15m", label: "15 Minutes" },
  { value: "1h", label: "1 Hour" },
  { value: "4h", label: "4 Hours" },
  { value: "1d", label: "1 Day" },
];

const AGENT_DESCRIPTIONS: Record<BacktestAgentName, string> = {
  Atlas: "Momentum & mean reversion strategy",
  Vega: "Volatility-based trading",
  Nova: "Trend following with MA crossovers",
  Sentinel: "Conservative risk-first approach",
  Arbiter: "Statistical arbitrage (z-score)",
};

const AGENT_COLORS: Record<BacktestAgentName, string> = {
  Atlas: "bg-blue-500/10 text-blue-500 border-blue-500/30",
  Vega: "bg-purple-500/10 text-purple-500 border-purple-500/30",
  Nova: "bg-orange-500/10 text-orange-500 border-orange-500/30",
  Sentinel: "bg-green-500/10 text-green-500 border-green-500/30",
  Arbiter: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
};

export default function Backtesting() {
  const { toast } = useToast();
  const [showScenarioForm, setShowScenarioForm] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [showRunForm, setShowRunForm] = useState(false);
  const [activeTab, setActiveTab] = useState("quick");
  const [selectedResult, setSelectedResult] = useState<QuickBacktestResult | null>(null);

  const [scenarioForm, setScenarioForm] = useState({
    name: "",
    description: "",
    chain: "ethereum" as "ethereum" | "base" | "fraxtal" | "solana",
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
  });

  const [runForm, setRunForm] = useState({
    initialBalance: 10000,
    riskTolerance: "moderate" as "conservative" | "moderate" | "aggressive",
    maxPositionSize: 0.2,
    stopLossPercent: 5,
    takeProfitPercent: 15,
    rebalanceThreshold: 10,
  });

  const [quickForm, setQuickForm] = useState({
    symbol: "ETH-USD",
    interval: "1h" as BacktestInterval,
    from: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0],
    agents: ["Atlas", "Vega", "Nova"] as BacktestAgentName[],
    initialBalance: 10000,
  });

  const { data: scenarios = [], isLoading: scenariosLoading } = useQuery<BacktestScenario[]>({
    queryKey: ["/api/backtesting/scenarios"],
  });

  const { data: runs = [], isLoading: runsLoading } = useQuery<BacktestRun[]>({
    queryKey: ["/api/backtesting/runs"],
  });

  const { data: quickResults = [], isLoading: quickResultsLoading, refetch: refetchQuickResults } = useQuery<QuickBacktestResult[]>({
    queryKey: ["/api/backtest/results"],
  });

  const { data: stats } = useQuery<{
    totalScenarios: number;
    totalRuns: number;
    completedRuns: number;
    averageReturn: number;
    averageSharpe: number;
  }>({
    queryKey: ["/api/backtesting/stats"],
  });

  const createScenarioMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/backtesting/scenarios", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backtesting/scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/backtesting/stats"] });
      setShowScenarioForm(false);
      toast({ title: "Scenario created", description: "Backtest scenario has been created with historical data" });
    },
  });

  const deleteScenarioMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/backtesting/scenarios/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backtesting/scenarios"] });
      queryClient.invalidateQueries({ queryKey: ["/api/backtesting/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/backtesting/stats"] });
      toast({ title: "Scenario deleted", description: "Backtest scenario and its runs have been removed" });
    },
  });

  const runBacktestMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/backtesting/runs", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backtesting/runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/backtesting/stats"] });
      setShowRunForm(false);
      toast({ title: "Backtest complete", description: "Strategy has been tested against historical data" });
    },
    onError: (error: any) => {
      toast({ title: "Backtest failed", description: error.message, variant: "destructive" });
    },
  });

  const quickBacktestMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/backtest/start", data),
    onSuccess: (result: QuickBacktestResult) => {
      queryClient.invalidateQueries({ queryKey: ["/api/backtest/results"] });
      setSelectedResult(result);
      toast({ 
        title: "Backtest Complete", 
        description: `${result.totalTrades} trades executed with ${result.totalReturn >= 0 ? "+" : ""}${result.totalReturn.toFixed(1)}% return` 
      });
    },
    onError: (error: any) => {
      toast({ title: "Backtest failed", description: error.message, variant: "destructive" });
    },
  });

  const handleCreateScenario = () => {
    createScenarioMutation.mutate(scenarioForm);
  };

  const handleRunBacktest = () => {
    if (!selectedScenario) return;
    runBacktestMutation.mutate({
      scenarioId: selectedScenario,
      initialBalance: runForm.initialBalance,
      strategyConfig: {
        riskTolerance: runForm.riskTolerance,
        maxPositionSize: runForm.maxPositionSize,
        stopLossPercent: runForm.stopLossPercent,
        takeProfitPercent: runForm.takeProfitPercent,
        rebalanceThreshold: runForm.rebalanceThreshold,
      },
    });
  };

  const handleQuickBacktest = () => {
    if (quickForm.agents.length === 0) {
      toast({ title: "Select agents", description: "Please select at least one agent", variant: "destructive" });
      return;
    }
    quickBacktestMutation.mutate(quickForm);
  };

  const toggleAgent = (agent: BacktestAgentName) => {
    if (quickForm.agents.includes(agent)) {
      setQuickForm({ ...quickForm, agents: quickForm.agents.filter(a => a !== agent) });
    } else {
      setQuickForm({ ...quickForm, agents: [...quickForm.agents, agent] });
    }
  };

  const formatReturn = (initial: number, final: number) => {
    const ret = ((final - initial) / initial) * 100;
    return ret;
  };

  const chainColors: Record<string, string> = {
    ethereum: "bg-blue-500/10 text-blue-500",
    base: "bg-purple-500/10 text-purple-500",
    fraxtal: "bg-orange-500/10 text-orange-500",
    solana: "bg-green-500/10 text-green-500",
  };

  const statusColors: Record<string, string> = {
    pending: "bg-yellow-500/10 text-yellow-500",
    running: "bg-blue-500/10 text-blue-500",
    completed: "bg-green-500/10 text-green-500",
    failed: "bg-red-500/10 text-red-500",
  };

  const riskToleranceLabels = {
    conservative: { label: "Conservative", color: "text-green-500" },
    moderate: { label: "Moderate", color: "text-yellow-500" },
    aggressive: { label: "Aggressive", color: "text-red-500" },
  };

  const totalQuickBacktests = quickResults.length;
  const avgQuickReturn = quickResults.length > 0 
    ? quickResults.reduce((sum, r) => sum + r.totalReturn, 0) / quickResults.length 
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Strategy Backtesting</h1>
          <p className="text-muted-foreground">Replay historical data through agent decision-making</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Tests</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-quick-tests">{totalQuickBacktests}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Return</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${avgQuickReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
              {avgQuickReturn >= 0 ? "+" : ""}{avgQuickReturn.toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scenarios</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-scenarios">{stats?.totalScenarios ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-runs">{stats?.totalRuns ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Sharpe</CardTitle>
            <Scale className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-avg-sharpe">
              {(stats?.averageSharpe ?? 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="quick" data-testid="tab-quick">
            <Zap className="h-4 w-4 mr-2" />
            Quick Backtest
          </TabsTrigger>
          <TabsTrigger value="results" data-testid="tab-results">Results</TabsTrigger>
          <TabsTrigger value="scenarios" data-testid="tab-scenarios">Scenarios</TabsTrigger>
          <TabsTrigger value="runs" data-testid="tab-runs">Advanced Runs</TabsTrigger>
        </TabsList>

        <TabsContent value="quick" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-yellow-500" />
                  Quick Backtest
                </CardTitle>
                <CardDescription>Configure and run a backtest in seconds</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="symbol">Symbol</Label>
                    <Select
                      value={quickForm.symbol}
                      onValueChange={(v) => setQuickForm({ ...quickForm, symbol: v })}
                    >
                      <SelectTrigger data-testid="select-symbol">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ETH-USD">ETH-USD</SelectItem>
                        <SelectItem value="BTC-USD">BTC-USD</SelectItem>
                        <SelectItem value="SOL-USD">SOL-USD</SelectItem>
                        <SelectItem value="AVAX-USD">AVAX-USD</SelectItem>
                        <SelectItem value="MATIC-USD">MATIC-USD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="interval">Interval</Label>
                    <Select
                      value={quickForm.interval}
                      onValueChange={(v) => setQuickForm({ ...quickForm, interval: v as BacktestInterval })}
                    >
                      <SelectTrigger data-testid="select-interval">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTERVALS.map(int => (
                          <SelectItem key={int.value} value={int.value}>{int.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="from">From</Label>
                    <Input
                      id="from"
                      type="date"
                      value={quickForm.from}
                      onChange={(e) => setQuickForm({ ...quickForm, from: e.target.value })}
                      data-testid="input-from"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="to">To</Label>
                    <Input
                      id="to"
                      type="date"
                      value={quickForm.to}
                      onChange={(e) => setQuickForm({ ...quickForm, to: e.target.value })}
                      data-testid="input-to"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Initial Balance: ${quickForm.initialBalance.toLocaleString()}</Label>
                  <Slider
                    value={[quickForm.initialBalance]}
                    onValueChange={([v]) => setQuickForm({ ...quickForm, initialBalance: v })}
                    min={1000}
                    max={100000}
                    step={1000}
                    data-testid="slider-balance"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Agent Set</Label>
                  <div className="grid grid-cols-1 gap-2">
                    {AVAILABLE_AGENTS.map(agent => (
                      <div 
                        key={agent}
                        className={`flex items-center gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
                          quickForm.agents.includes(agent) 
                            ? AGENT_COLORS[agent] + " border-current" 
                            : "border-border hover-elevate"
                        }`}
                        onClick={() => toggleAgent(agent)}
                        data-testid={`agent-${agent.toLowerCase()}`}
                      >
                        <Checkbox 
                          checked={quickForm.agents.includes(agent)}
                          onCheckedChange={() => toggleAgent(agent)}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Bot className="h-4 w-4" />
                            <span className="font-medium">{agent}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{AGENT_DESCRIPTIONS[agent]}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  className="w-full" 
                  onClick={handleQuickBacktest}
                  disabled={quickBacktestMutation.isPending}
                  data-testid="button-run-quick"
                >
                  {quickBacktestMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Running Backtest...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Backtest
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>

            {selectedResult && selectedResult.status === "completed" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Backtest Results
                  </CardTitle>
                  <CardDescription>
                    {selectedResult.symbol} | {selectedResult.from} to {selectedResult.to}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Trades</p>
                      <p className="text-2xl font-bold">{selectedResult.totalTrades}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Win Rate</p>
                      <p className="text-2xl font-bold">{selectedResult.winRate.toFixed(1)}%</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Return</p>
                      <p className={`text-2xl font-bold ${selectedResult.totalReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                        {selectedResult.totalReturn >= 0 ? "+" : ""}{selectedResult.totalReturn.toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                      <p className="text-xl font-semibold">{selectedResult.sharpeRatio.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Max Drawdown</p>
                      <p className="text-xl font-semibold text-red-500">-{selectedResult.maxDrawdown.toFixed(1)}%</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Top Agent</span>
                      <Badge className={AGENT_COLORS[selectedResult.bestAgent]}>
                        {selectedResult.bestAgent} +{selectedResult.agentPerformance.find(a => a.agent === selectedResult.bestAgent)?.totalReturn.toFixed(1)}%
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Worst Agent</span>
                      <Badge variant="outline">
                        {selectedResult.worstAgent} {selectedResult.agentPerformance.find(a => a.agent === selectedResult.worstAgent)?.totalReturn.toFixed(1)}%
                      </Badge>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium">Insights</span>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      {selectedResult.insights.map((insight, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-muted-foreground">•</span>
                          {insight}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="text-xs text-muted-foreground text-center">
                    Completed in {selectedResult.durationMs}ms
                  </div>
                </CardContent>
              </Card>
            )}

            {!selectedResult && (
              <Card className="flex items-center justify-center">
                <CardContent className="py-16 text-center text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Run a backtest to see results here</p>
                </CardContent>
              </Card>
            )}
          </div>

          {selectedResult && selectedResult.agentPerformance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Agent Performance Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedResult.agentPerformance.map((perf, idx) => (
                    <Card key={perf.agent} className={idx === 0 ? "border-yellow-500/50" : ""}>
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-base">
                          <span className="flex items-center gap-2">
                            {idx === 0 && <Trophy className="h-4 w-4 text-yellow-500" />}
                            <Bot className="h-4 w-4" />
                            {perf.agent}
                          </span>
                          <Badge className={perf.totalReturn >= 0 ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}>
                            {perf.totalReturn >= 0 ? "+" : ""}{perf.totalReturn.toFixed(1)}%
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Trades</span>
                          <span>{perf.totalTrades} ({perf.winningTrades}W / {perf.losingTrades}L)</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Win Rate</span>
                          <span>{perf.winRate.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Avg ROI/Trade</span>
                          <span className={perf.avgRoiPerTrade >= 0 ? "text-green-500" : "text-red-500"}>
                            {perf.avgRoiPerTrade >= 0 ? "+" : ""}{perf.avgRoiPerTrade.toFixed(2)}%
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Sharpe</span>
                          <span>{perf.sharpeRatio.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Max DD</span>
                          <span className="text-red-500">-{perf.maxDrawdown.toFixed(1)}%</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {selectedResult && selectedResult.decisions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Decision Trace</CardTitle>
                <CardDescription>Recent trading decisions made by agents</CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-64">
                  <div className="space-y-2">
                    {selectedResult.decisions.slice(-20).reverse().map((decision, idx) => (
                      <div 
                        key={idx} 
                        className="flex items-start gap-3 p-2 rounded-md border text-sm"
                      >
                        <Badge className={AGENT_COLORS[decision.agent]}>
                          {decision.agent}
                        </Badge>
                        <Badge 
                          variant="outline"
                          className={decision.action === "BUY" ? "text-green-500 border-green-500/30" : "text-red-500 border-red-500/30"}
                        >
                          {decision.action}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-muted-foreground">{decision.reason}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            @ ${decision.price.toFixed(2)} | Confidence: {(decision.confidence * 100).toFixed(0)}%
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(decision.timestamp).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="results" className="space-y-4">
          {quickResultsLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                Loading results...
              </CardContent>
            </Card>
          ) : quickResults.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No backtest results yet. Run a quick backtest to get started.
              </CardContent>
            </Card>
          ) : (
            quickResults.map((result) => (
              <Card 
                key={result.id} 
                className="cursor-pointer hover-elevate"
                onClick={() => {
                  setSelectedResult(result);
                  setActiveTab("quick");
                }}
                data-testid={`result-${result.id}`}
              >
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {result.totalReturn >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-500" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-500" />
                      )}
                      {result.symbol}
                    </CardTitle>
                    <CardDescription>{result.from} to {result.to}</CardDescription>
                  </div>
                  <div className="text-right">
                    <p className={`text-xl font-bold ${result.totalReturn >= 0 ? "text-green-500" : "text-red-500"}`}>
                      {result.totalReturn >= 0 ? "+" : ""}{result.totalReturn.toFixed(1)}%
                    </p>
                    <p className="text-sm text-muted-foreground">{result.totalTrades} trades</p>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-2">
                    {result.agents.map(agent => (
                      <Badge key={agent} variant="outline" className="text-xs">
                        {agent}
                      </Badge>
                    ))}
                    <span className="text-sm text-muted-foreground ml-auto">
                      Win Rate: {result.winRate.toFixed(1)}% | Sharpe: {result.sharpeRatio.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="scenarios" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowScenarioForm(!showScenarioForm)} data-testid="button-new-scenario">
              <Plus className="h-4 w-4 mr-2" />
              New Scenario
            </Button>
          </div>

          {showScenarioForm && (
            <Card>
              <CardHeader>
                <CardTitle>Create Backtest Scenario</CardTitle>
                <CardDescription>Define a time period to generate historical market data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Scenario Name</Label>
                    <Input
                      id="name"
                      value={scenarioForm.name}
                      onChange={(e) => setScenarioForm({ ...scenarioForm, name: e.target.value })}
                      placeholder="e.g., Bull Market 2024"
                      data-testid="input-scenario-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="chain">Chain</Label>
                    <Select
                      value={scenarioForm.chain}
                      onValueChange={(v) => setScenarioForm({ ...scenarioForm, chain: v as any })}
                    >
                      <SelectTrigger data-testid="select-chain">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ethereum">Ethereum</SelectItem>
                        <SelectItem value="base">Base</SelectItem>
                        <SelectItem value="fraxtal">Fraxtal</SelectItem>
                        <SelectItem value="solana">Solana</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={scenarioForm.description}
                    onChange={(e) => setScenarioForm({ ...scenarioForm, description: e.target.value })}
                    placeholder="Describe market conditions"
                    data-testid="input-description"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Start Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={scenarioForm.startDate}
                      onChange={(e) => setScenarioForm({ ...scenarioForm, startDate: e.target.value })}
                      data-testid="input-start-date"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="endDate">End Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={scenarioForm.endDate}
                      onChange={(e) => setScenarioForm({ ...scenarioForm, endDate: e.target.value })}
                      data-testid="input-end-date"
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowScenarioForm(false)} data-testid="button-cancel-scenario">
                  Cancel
                </Button>
                <Button onClick={handleCreateScenario} disabled={createScenarioMutation.isPending} data-testid="button-create-scenario">
                  Create Scenario
                </Button>
              </CardFooter>
            </Card>
          )}

          {scenariosLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">Loading scenarios...</CardContent>
            </Card>
          ) : scenarios.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No scenarios. Create one to start backtesting strategies.
              </CardContent>
            </Card>
          ) : (
            scenarios.map((scenario) => (
              <Card key={scenario.id} data-testid={`card-scenario-${scenario.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4" />
                      {scenario.name}
                    </CardTitle>
                    <CardDescription>{scenario.description}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        setSelectedScenario(scenario.id);
                        setShowRunForm(true);
                      }}
                      data-testid={`button-run-${scenario.id}`}
                    >
                      <Play className="h-4 w-4 mr-1" />
                      Run
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => deleteScenarioMutation.mutate(scenario.id)}
                      data-testid={`button-delete-${scenario.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <Badge className={chainColors[scenario.chain]}>{scenario.chain}</Badge>
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(scenario.startTimestamp).toLocaleDateString()} - {new Date(scenario.endTimestamp).toLocaleDateString()}
                    </span>
                    <span className="text-muted-foreground">{scenario.dataPoints.length} data points</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="runs" className="space-y-4">
          {runsLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">Loading runs...</CardContent>
            </Card>
          ) : runs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No backtest runs yet. Select a scenario and run a backtest.
              </CardContent>
            </Card>
          ) : (
            runs.map((run) => {
              const returnPct = formatReturn(run.initialBalance, run.finalBalance);
              const winRate = run.totalTrades > 0 ? (run.winningTrades / run.totalTrades) * 100 : 0;

              return (
                <Card key={run.id} data-testid={`card-run-${run.id}`}>
                  <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {run.status === "running" && <Loader2 className="h-4 w-4 animate-spin" />}
                        {run.status === "completed" && (returnPct >= 0 ? <TrendingUp className="h-4 w-4 text-green-500" /> : <TrendingDown className="h-4 w-4 text-red-500" />)}
                        {run.status === "failed" && <XCircle className="h-4 w-4 text-red-500" />}
                        Backtest Run
                      </CardTitle>
                      <CardDescription>Initial: ${run.initialBalance.toLocaleString()}</CardDescription>
                    </div>
                    <Badge className={statusColors[run.status]}>{run.status}</Badge>
                  </CardHeader>
                  <CardContent>
                    {run.status === "completed" && (
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Final Balance</p>
                          <p className="text-lg font-bold">${run.finalBalance.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Return</p>
                          <p className={`text-lg font-bold ${returnPct >= 0 ? "text-green-500" : "text-red-500"}`}>
                            {returnPct >= 0 ? "+" : ""}{returnPct.toFixed(2)}%
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Win Rate</p>
                          <p className="text-lg font-bold">{winRate.toFixed(1)}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Max Drawdown</p>
                          <p className="text-lg font-bold text-red-500">-{run.maxDrawdown}%</p>
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Sharpe Ratio</p>
                          <p className="text-lg font-bold">{run.sharpeRatio}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Trades: {run.totalTrades} ({run.winningTrades}W / {run.losingTrades}L)
                      </span>
                      <span className="text-muted-foreground">
                        Profit Factor: {run.profitFactor}
                      </span>
                      <span className={riskToleranceLabels[run.strategyConfig?.riskTolerance as keyof typeof riskToleranceLabels]?.color}>
                        {riskToleranceLabels[run.strategyConfig?.riskTolerance as keyof typeof riskToleranceLabels]?.label || "N/A"} Strategy
                      </span>
                    </div>
                    {run.decisions.length > 0 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium mb-2">Recent Decisions</p>
                        <ScrollArea className="h-24">
                          <div className="space-y-1">
                            {run.decisions.slice(-5).map((decision, idx) => (
                              <div key={idx} className="flex items-center gap-2 text-xs">
                                <Badge variant="outline" className={decision.action === "buy" ? "text-green-500" : decision.action === "sell" ? "text-red-500" : ""}>
                                  {decision.action}
                                </Badge>
                                <span className="text-muted-foreground">{decision.reason}</span>
                                <span className={decision.pnl >= 0 ? "text-green-500" : "text-red-500"}>
                                  {decision.pnl >= 0 ? "+" : ""}{decision.pnl.toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    )}
                    {run.errorMessage && (
                      <p className="text-sm text-red-500 mt-2">Error: {run.errorMessage}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>

      {showRunForm && selectedScenario && (
        <Card className="fixed bottom-4 right-4 w-96 z-50 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Configure Backtest
            </CardTitle>
            <CardDescription>Set strategy parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Initial Balance: ${runForm.initialBalance.toLocaleString()}</Label>
              <Slider
                value={[runForm.initialBalance]}
                onValueChange={([v]) => setRunForm({ ...runForm, initialBalance: v })}
                min={1000}
                max={100000}
                step={1000}
                data-testid="slider-initial-balance"
              />
            </div>
            <div className="space-y-2">
              <Label>Risk Tolerance</Label>
              <Select
                value={runForm.riskTolerance}
                onValueChange={(v) => setRunForm({ ...runForm, riskTolerance: v as any })}
              >
                <SelectTrigger data-testid="select-risk-tolerance">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">Conservative</SelectItem>
                  <SelectItem value="moderate">Moderate</SelectItem>
                  <SelectItem value="aggressive">Aggressive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">Stop Loss %</Label>
                <Input
                  type="number"
                  value={runForm.stopLossPercent}
                  onChange={(e) => setRunForm({ ...runForm, stopLossPercent: parseFloat(e.target.value) || 5 })}
                  data-testid="input-stop-loss"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Take Profit %</Label>
                <Input
                  type="number"
                  value={runForm.takeProfitPercent}
                  onChange={(e) => setRunForm({ ...runForm, takeProfitPercent: parseFloat(e.target.value) || 15 })}
                  data-testid="input-take-profit"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Position Size: {(runForm.maxPositionSize * 100).toFixed(0)}%</Label>
              <Slider
                value={[runForm.maxPositionSize * 100]}
                onValueChange={([v]) => setRunForm({ ...runForm, maxPositionSize: v / 100 })}
                min={5}
                max={50}
                step={5}
                data-testid="slider-position-size"
              />
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowRunForm(false);
                setSelectedScenario(null);
              }}
              data-testid="button-cancel-run"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRunBacktest}
              disabled={runBacktestMutation.isPending}
              data-testid="button-run-backtest"
            >
              {runBacktestMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Run Backtest
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
