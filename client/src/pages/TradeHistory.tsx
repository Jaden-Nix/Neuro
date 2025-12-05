import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  History, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  Brain, 
  Target,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  AlertTriangle,
  CheckCircle2,
  XCircle
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useState } from "react";
import type { SelectTradeHistory } from "@shared/schema";

interface VillageAgent {
  id: string;
  name: string;
  role: string;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  creditScore: number;
}

export default function TradeHistory() {
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const { data: history = [], isLoading, refetch } = useQuery<SelectTradeHistory[]>({
    queryKey: ["/api/village/history", selectedAgent],
  });

  const { data: agents = [] } = useQuery<VillageAgent[]>({
    queryKey: ["/api/village/agents"],
  });

  const totalTrades = history.length;
  const wins = history.filter(t => t.outcome === "win").length;
  const losses = history.filter(t => t.outcome === "loss").length;
  const winRate = totalTrades > 0 ? (wins / totalTrades * 100).toFixed(1) : "0";
  const totalPnL = history.reduce((sum, t) => sum + t.pnlPercent, 0);
  const avgPnL = totalTrades > 0 ? totalPnL / totalTrades : 0;

  const toggleExpand = (id: string) => {
    setExpandedTrade(expandedTrade === id ? null : id);
  };

  return (
    <div className="flex-1 overflow-hidden p-4 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <History className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Trade History</h1>
          <Badge variant="outline" className="ml-2" data-testid="badge-total-trades">
            {totalTrades} trades
          </Badge>
        </div>
        <Button 
          size="icon" 
          variant="outline" 
          onClick={() => refetch()}
          data-testid="button-refresh-history"
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Wins</span>
            </div>
            <p className="text-2xl font-bold text-green-500" data-testid="text-total-wins">{wins}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-red-500" />
              <span className="text-sm text-muted-foreground">Losses</span>
            </div>
            <p className="text-2xl font-bold text-red-500" data-testid="text-total-losses">{losses}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Win Rate</span>
            </div>
            <p className="text-2xl font-bold" data-testid="text-win-rate">{winRate}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total P&L</span>
            </div>
            <p className={`text-2xl font-bold ${totalPnL >= 0 ? "text-green-500" : "text-red-500"}`} data-testid="text-total-pnl">
              {totalPnL >= 0 ? "+" : ""}{totalPnL.toFixed(2)}%
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="all" className="flex-1">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All Trades</TabsTrigger>
          <TabsTrigger value="wins" data-testid="tab-wins">Wins</TabsTrigger>
          <TabsTrigger value="losses" data-testid="tab-losses">Losses</TabsTrigger>
          <TabsTrigger value="by-agent" data-testid="tab-by-agent">By Agent</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4">
          <TradeList 
            trades={history} 
            expandedTrade={expandedTrade}
            onToggle={toggleExpand}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="wins" className="mt-4">
          <TradeList 
            trades={history.filter(t => t.outcome === "win")} 
            expandedTrade={expandedTrade}
            onToggle={toggleExpand}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="losses" className="mt-4">
          <TradeList 
            trades={history.filter(t => t.outcome === "loss")} 
            expandedTrade={expandedTrade}
            onToggle={toggleExpand}
            isLoading={isLoading}
          />
        </TabsContent>

        <TabsContent value="by-agent" className="mt-4">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
            {agents.map(agent => (
              <Button
                key={agent.id}
                variant={selectedAgent === agent.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
                data-testid={`button-agent-filter-${agent.id}`}
              >
                {agent.name}
              </Button>
            ))}
          </div>
          <TradeList 
            trades={selectedAgent ? history.filter(t => t.agentId === selectedAgent) : history} 
            expandedTrade={expandedTrade}
            onToggle={toggleExpand}
            isLoading={isLoading}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface TradeListProps {
  trades: SelectTradeHistory[];
  expandedTrade: string | null;
  onToggle: (id: string) => void;
  isLoading: boolean;
}

function TradeList({ trades, expandedTrade, onToggle, isLoading }: TradeListProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (trades.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <History className="h-12 w-12 mb-4 opacity-50" />
          <p>No trade history yet</p>
          <p className="text-sm">Close some signals to see them here</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <ScrollArea className="h-[calc(100vh-380px)]">
      <div className="space-y-3 pr-4">
        {trades.map(trade => (
          <Card 
            key={trade.id} 
            className="hover-elevate cursor-pointer"
            onClick={() => onToggle(trade.id)}
            data-testid={`card-trade-${trade.id}`}
          >
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-md ${trade.outcome === "win" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                    {trade.outcome === "win" ? (
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    ) : (
                      <TrendingDown className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold" data-testid={`text-symbol-${trade.id}`}>{trade.symbol}</span>
                      <Badge variant={trade.direction === "long" ? "default" : "secondary"} className="text-xs">
                        {trade.direction.toUpperCase()}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {trade.exitReason.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>by {trade.agentName}</span>
                      <span>|</span>
                      <span>{trade.agentRole}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className={`font-bold ${trade.pnlPercent >= 0 ? "text-green-500" : "text-red-500"}`} data-testid={`text-pnl-${trade.id}`}>
                      {trade.pnlPercent >= 0 ? "+" : ""}{trade.pnlPercent.toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(trade.closedAt), { addSuffix: true })}
                    </p>
                  </div>
                  {trade.evolutionTriggered && (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-500 border-purple-500/30">
                      <Brain className="h-3 w-3 mr-1" />
                      Evolved
                    </Badge>
                  )}
                  {expandedTrade === trade.id ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>

              {expandedTrade === trade.id && (
                <div className="mt-4 pt-4 border-t space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Entry Price</p>
                      <p className="font-mono">${trade.entryPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Exit Price</p>
                      <p className="font-mono">${trade.exitPrice.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Stop Loss</p>
                      <p className="font-mono text-red-400">${trade.stopLoss.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Take Profit 1</p>
                      <p className="font-mono text-green-400">${trade.takeProfit1.toFixed(2)}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Confidence</p>
                      <p>{(trade.confidence * 100).toFixed(0)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Timeframe</p>
                      <p>{trade.timeframe}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Holding Time</p>
                      <p>{formatDuration(trade.holdingTimeMs)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Credit Change</p>
                      <p className={trade.agentCreditChange >= 0 ? "text-green-500" : "text-red-500"}>
                        {trade.agentCreditChange >= 0 ? "+" : ""}{trade.agentCreditChange}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Timestamps
                    </p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Signal Created</p>
                        <p>{format(new Date(trade.signalCreatedAt), "MMM d, yyyy HH:mm:ss")}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Trade Closed</p>
                        <p>{format(new Date(trade.closedAt), "MMM d, yyyy HH:mm:ss")}</p>
                      </div>
                    </div>
                  </div>

                  {trade.originalReasoning && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Target className="h-3 w-3" />
                        Original Reasoning
                      </p>
                      <p className="text-sm bg-muted/50 p-3 rounded-md">{trade.originalReasoning}</p>
                    </div>
                  )}

                  {trade.technicalAnalysis && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Brain className="h-3 w-3" />
                        Technical Analysis
                      </p>
                      <div className="text-sm bg-muted/50 p-3 rounded-md">
                        <p><strong>Pattern:</strong> {trade.technicalAnalysis.pattern}</p>
                        <p><strong>Indicators:</strong> {trade.technicalAnalysis.indicators?.join(", ")}</p>
                        <p><strong>Support:</strong> ${trade.technicalAnalysis.keyLevels?.support?.toFixed(2)} | <strong>Resistance:</strong> ${trade.technicalAnalysis.keyLevels?.resistance?.toFixed(2)}</p>
                      </div>
                    </div>
                  )}

                  {trade.validators && trade.validators.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Signal Validators
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {trade.validators.map((v, i) => (
                          <Badge 
                            key={i} 
                            variant="outline" 
                            className={v.agrees ? "border-green-500/50 text-green-500" : "border-red-500/50 text-red-500"}
                          >
                            {v.agentName}: {v.agrees ? "Agreed" : "Disagreed"}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {trade.lessonsLearned && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Lightbulb className="h-3 w-3" />
                        Lessons Learned
                      </p>
                      <div className={`text-sm p-3 rounded-md ${trade.outcome === "win" ? "bg-green-500/10 border border-green-500/20" : "bg-red-500/10 border border-red-500/20"}`}>
                        {trade.lessonsLearned}
                      </div>
                    </div>
                  )}

                  {trade.aiAnalysis && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Brain className="h-3 w-3" />
                        AI Analysis
                      </p>
                      <div className="text-sm bg-muted/50 p-3 rounded-md">
                        {trade.aiAnalysis}
                      </div>
                    </div>
                  )}

                  {trade.marketConditions && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Market Conditions
                      </p>
                      <div className="flex gap-2">
                        <Badge variant="outline">
                          Volatility: {trade.marketConditions.volatility}
                        </Badge>
                        <Badge variant="outline">
                          Trend: {trade.marketConditions.trend}
                        </Badge>
                        <Badge variant="outline">
                          Volume: {trade.marketConditions.volume}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </ScrollArea>
  );
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}
