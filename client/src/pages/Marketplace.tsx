import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  Bot, 
  TrendingUp, 
  Shield, 
  Zap, 
  Trophy, 
  Coins, 
  Clock, 
  Star,
  Filter,
  Sparkles,
  BarChart3,
  Target,
  Wallet
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { 
  SelectAgentTemplate, 
  SelectLeaderboard,
  RiskTolerance,
  StrategyType,
  PersonalityTrait
} from "@shared/schema";

const strategyIcons: Record<string, typeof TrendingUp> = {
  arbitrage: TrendingUp,
  yield_farming: Coins,
  liquidity_provision: BarChart3,
  market_making: Target,
  trend_following: Zap,
};

const riskColors: Record<string, string> = {
  conservative: "text-green-500",
  moderate: "text-yellow-500",
  aggressive: "text-red-500",
};

function AgentTemplateCard({ template, onMint, onRent }: { template: SelectAgentTemplate; onMint: () => void; onRent: () => void }) {
  const StrategyIcon = strategyIcons[template.strategyType] || Bot;
  
  return (
    <Card className="relative overflow-visible" data-testid={`card-template-${template.id}`}>
      {template.featured && (
        <Badge className="absolute -top-2 -right-2 z-10 gap-1" variant="default">
          <Star className="h-3 w-3" /> Featured
        </Badge>
      )}
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <Avatar className="h-12 w-12 rounded-md">
            <AvatarImage 
              src={template.imageUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${template.id}`} 
              alt={template.name}
            />
            <AvatarFallback className="rounded-md">
              <Bot className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <Badge variant="outline" className="shrink-0">
            {template.agentType}
          </Badge>
        </div>
        <CardTitle className="text-lg mt-3">{template.name}</CardTitle>
        <CardDescription className="line-clamp-2">{template.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="gap-1">
            <StrategyIcon className="h-3 w-3" />
            {template.strategyType.replace(/_/g, " ")}
          </Badge>
          <Badge variant="secondary" className={riskColors[template.riskTolerance]}>
            <Shield className="h-3 w-3 mr-1" />
            {template.riskTolerance}
          </Badge>
        </div>
        
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Performance Score</span>
            <span className="font-medium">{template.performanceScore}</span>
          </div>
          <Progress value={template.performanceScore} className="h-2" />
        </div>
        
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Success Rate</p>
            <p className="font-medium">{template.successRate}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Avg Return</p>
            <p className="font-medium text-green-500">+{template.avgReturn}%</p>
          </div>
          <div>
            <p className="text-muted-foreground">Deployments</p>
            <p className="font-medium">{template.totalDeployments}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Yield Share</p>
            <p className="font-medium">{template.yieldSharePercent}%</p>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex-col gap-3 pt-0">
        <div className="flex w-full justify-between items-center">
          <div>
            <p className="text-xs text-muted-foreground">Base Price</p>
            <p className="font-bold">${(template.basePrice / 100).toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Rental/Day</p>
            <p className="font-medium">${(template.rentalPricePerDay / 100).toFixed(2)}</p>
          </div>
        </div>
        <div className="flex w-full gap-2">
          <Button 
            variant="outline"
            className="flex-1 gap-2" 
            onClick={onRent}
            data-testid={`button-rent-${template.id}`}
          >
            <Clock className="h-4 w-4" />
            Rent
          </Button>
          <Button 
            className="flex-1 gap-2" 
            onClick={onMint}
            data-testid={`button-mint-${template.id}`}
          >
            <Sparkles className="h-4 w-4" />
            Mint NFT
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function LeaderboardTable({ entries }: { entries: SelectLeaderboard[] }) {
  if (entries.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No leaderboard data yet</p>
        <p className="text-sm">Agents will appear here as they perform trades</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {entries.map((entry, index) => (
        <Card key={entry.agentId} className="p-4" data-testid={`leaderboard-entry-${entry.agentId}`}>
          <div className="flex items-center gap-4">
            <div className={`text-2xl font-bold ${index === 0 ? 'text-yellow-500' : index === 1 ? 'text-gray-400' : index === 2 ? 'text-amber-600' : 'text-muted-foreground'}`}>
              #{entry.rank}
            </div>
            <Avatar className="h-10 w-10">
              <AvatarImage src={`https://api.dicebear.com/7.x/bottts/svg?seed=${entry.agentId}`} />
              <AvatarFallback><Bot className="h-5 w-5" /></AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{entry.agentId}</p>
              <p className="text-sm text-muted-foreground">{entry.totalTrades} trades</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-green-500">+{entry.totalReturn}%</p>
              <p className="text-sm text-muted-foreground">{entry.successRate}% win rate</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

function TemplatesSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <Card key={i}>
          <CardHeader>
            <div className="flex items-start gap-4">
              <Skeleton className="h-12 w-12 rounded-md" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-full" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Skeleton className="h-5 w-20" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-2 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
          <CardFooter>
            <Skeleton className="h-10 w-full" />
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}

export default function Marketplace() {
  const { toast } = useToast();
  const { address, isConnected } = useAccount();
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<string>("all_time");

  const { data: templates = [], isLoading: templatesLoading } = useQuery<SelectAgentTemplate[]>({
    queryKey: ["/api/marketplace/templates"],
  });

  const { data: leaderboard = [], isLoading: leaderboardLoading } = useQuery<SelectLeaderboard[]>({
    queryKey: ["/api/marketplace/leaderboard"],
  });

  const mintNFT = useMutation({
    mutationFn: async (templateId: string) => {
      if (!isConnected || !address) {
        throw new Error("Please connect your wallet first");
      }
      return apiRequest("POST", "/api/marketplace/nfts/mint", {
        templateId,
        ownerAddress: address,
        chain: "ethereum",
      });
    },
    onSuccess: () => {
      toast({
        title: "NFT Minted Successfully",
        description: "Your agent NFT has been minted and added to your wallet",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/nfts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/templates"] });
    },
    onError: (error) => {
      toast({
        title: "Minting Failed",
        description: error instanceof Error ? error.message : "Failed to mint NFT",
        variant: "destructive",
      });
    },
  });

  const rentAgent = useMutation({
    mutationFn: async (data: { templateId: string; durationDays: number }) => {
      if (!isConnected || !address) {
        throw new Error("Please connect your wallet first");
      }
      const template = templates.find(t => t.id === data.templateId);
      if (!template) throw new Error("Template not found");
      
      const startDate = Date.now();
      const endDate = startDate + (data.durationDays * 24 * 60 * 60 * 1000);
      
      return apiRequest("POST", "/api/marketplace/rentals", {
        templateId: data.templateId,
        agentId: `agent-${data.templateId.substring(0, 8)}`,
        renterId: address,
        ownerId: template.createdBy,
        dailyRate: template.rentalPricePerDay,
        yieldSharePercent: template.yieldSharePercent,
        startDate,
        endDate,
      });
    },
    onSuccess: () => {
      toast({
        title: "Rental Started Successfully",
        description: "You are now renting this agent. Check 'My Agents' to monitor.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/rentals"] });
    },
    onError: (error) => {
      toast({
        title: "Rental Failed",
        description: error instanceof Error ? error.message : "Failed to start rental",
        variant: "destructive",
      });
    },
  });

  const filteredTemplates = templates.filter((t) => {
    if (strategyFilter !== "all" && t.strategyType !== strategyFilter) return false;
    if (riskFilter !== "all" && t.riskTolerance !== riskFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-marketplace-title">Agent Marketplace</h1>
          <p className="text-muted-foreground">Discover, deploy, and trade AI trading agents</p>
        </div>
        {!isConnected && (
          <ConnectButton />
        )}
      </div>

      <Tabs defaultValue="browse" className="space-y-6">
        <TabsList>
          <TabsTrigger value="browse" data-testid="tab-browse">
            <Bot className="h-4 w-4 mr-2" />
            Browse Agents
          </TabsTrigger>
          <TabsTrigger value="leaderboard" data-testid="tab-leaderboard">
            <Trophy className="h-4 w-4 mr-2" />
            Leaderboard
          </TabsTrigger>
          <TabsTrigger value="my-agents" data-testid="tab-my-agents">
            <Wallet className="h-4 w-4 mr-2" />
            My Agents
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-6">
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={strategyFilter} onValueChange={setStrategyFilter}>
                <SelectTrigger className="w-[180px]" data-testid="select-strategy-filter">
                  <SelectValue placeholder="Strategy Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Strategies</SelectItem>
                  <SelectItem value="arbitrage">Arbitrage</SelectItem>
                  <SelectItem value="yield_farming">Yield Farming</SelectItem>
                  <SelectItem value="liquidity_provision">Liquidity Provision</SelectItem>
                  <SelectItem value="market_making">Market Making</SelectItem>
                  <SelectItem value="trend_following">Trend Following</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Select value={riskFilter} onValueChange={setRiskFilter}>
              <SelectTrigger className="w-[180px]" data-testid="select-risk-filter">
                <SelectValue placeholder="Risk Level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Risk Levels</SelectItem>
                <SelectItem value="conservative">Conservative</SelectItem>
                <SelectItem value="moderate">Moderate</SelectItem>
                <SelectItem value="aggressive">Aggressive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {templatesLoading ? (
            <TemplatesSkeleton />
          ) : filteredTemplates.length === 0 ? (
            <Card className="p-12 text-center">
              <Bot className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Agent Templates Found</h3>
              <p className="text-muted-foreground mb-4">
                {strategyFilter !== "all" || riskFilter !== "all" 
                  ? "Try adjusting your filters to see more agents"
                  : "Be the first to create an agent template"}
              </p>
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <AgentTemplateCard
                  key={template.id}
                  template={template}
                  onMint={() => mintNFT.mutate(template.id)}
                  onRent={() => rentAgent.mutate({ templateId: template.id, durationDays: 7 })}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="leaderboard" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Top Performing Agents</h2>
            <Select value={leaderboardPeriod} onValueChange={setLeaderboardPeriod}>
              <SelectTrigger className="w-[150px]" data-testid="select-leaderboard-period">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="all_time">All Time</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {leaderboardLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Card key={i} className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1">
                      <Skeleton className="h-4 w-32 mb-2" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-8 w-20" />
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <LeaderboardTable entries={leaderboard} />
          )}
        </TabsContent>

        <TabsContent value="my-agents" className="space-y-6">
          {!isConnected ? (
            <Card className="p-12 text-center">
              <Wallet className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">Connect Your Wallet</h3>
              <p className="text-muted-foreground mb-4">
                Connect your wallet to view your owned and rented agents
              </p>
              <ConnectButton />
            </Card>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Owned Agents
                  </CardTitle>
                  <CardDescription>NFT agents you own</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <Bot className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No owned agents yet</p>
                    <p className="text-sm">Mint an agent from the marketplace</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Rented Agents
                  </CardTitle>
                  <CardDescription>Agents you're currently renting</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No active rentals</p>
                    <p className="text-sm">Rent an agent to start earning yield</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
