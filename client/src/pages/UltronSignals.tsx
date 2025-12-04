import { useState, useEffect, useMemo, forwardRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Target,
  RefreshCw,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Brain,
  Clock,
  ChevronRight,
  Shield,
  Sparkles,
  BarChart3,
  Search,
  Filter,
  Eye,
  X,
  CheckCircle2,
  AlertTriangle,
  DollarSign,
  Percent,
  Signal,
  Radio,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import type { LivePrice, AlphaSignal, TokenMetadata, SupportedExchange } from "@shared/schema";

interface TokenWithPrice extends TokenMetadata {
  livePrice?: LivePrice;
}

const CATEGORY_LABELS: Record<string, string> = {
  layer1: "Layer 1",
  layer2: "Layer 2",
  defi: "DeFi",
  gaming: "Gaming",
  meme: "Meme",
  ai: "AI",
  rwa: "RWA",
  stablecoin: "Stablecoin",
  infrastructure: "Infrastructure",
  exchange: "Exchange",
  privacy: "Privacy",
  storage: "Storage",
  oracle: "Oracle",
};

const CATEGORY_COLORS: Record<string, string> = {
  layer1: "bg-blue-500/10 text-blue-400 border-blue-500/30",
  layer2: "bg-purple-500/10 text-purple-400 border-purple-500/30",
  defi: "bg-green-500/10 text-green-400 border-green-500/30",
  gaming: "bg-pink-500/10 text-pink-400 border-pink-500/30",
  meme: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
  ai: "bg-cyan-500/10 text-cyan-400 border-cyan-500/30",
  rwa: "bg-orange-500/10 text-orange-400 border-orange-500/30",
  stablecoin: "bg-gray-500/10 text-gray-400 border-gray-500/30",
  infrastructure: "bg-indigo-500/10 text-indigo-400 border-indigo-500/30",
  exchange: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  privacy: "bg-red-500/10 text-red-400 border-red-500/30",
  storage: "bg-teal-500/10 text-teal-400 border-teal-500/30",
  oracle: "bg-violet-500/10 text-violet-400 border-violet-500/30",
};

function formatPrice(price: number): string {
  if (price >= 1000) return price.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (price >= 1) return price.toFixed(2);
  if (price >= 0.01) return price.toFixed(4);
  return price.toFixed(8);
}

function formatChange(change: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

function formatVolume(volume: number): string {
  if (volume >= 1e9) return `$${(volume / 1e9).toFixed(2)}B`;
  if (volume >= 1e6) return `$${(volume / 1e6).toFixed(2)}M`;
  if (volume >= 1e3) return `$${(volume / 1e3).toFixed(2)}K`;
  return `$${volume.toFixed(2)}`;
}

function ConfidenceGauge({ confidence }: { confidence: number }) {
  const color = confidence >= 80 ? "text-green-400" : confidence >= 60 ? "text-yellow-400" : "text-red-400";
  const bgColor = confidence >= 80 ? "bg-green-500/20" : confidence >= 60 ? "bg-yellow-500/20" : "bg-red-500/20";
  
  return (
    <div className="relative flex items-center justify-center">
      <div className={`absolute inset-0 rounded-full ${bgColor} blur-sm`} />
      <div className="relative flex flex-col items-center">
        <span className={`text-2xl font-bold ${color}`}>{confidence}</span>
        <span className="text-[10px] text-muted-foreground">/100</span>
      </div>
    </div>
  );
}

const LivePriceCard = forwardRef<HTMLDivElement, { token: TokenWithPrice; onSelect: () => void }>(
  function LivePriceCard({ token, onSelect }, ref) {
    const price = token.livePrice;
    const changePercent = price?.changePercent24h || 0;
    const isPositive = changePercent >= 0;

    return (
      <motion.div
        ref={ref}
        layout
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.2 }}
      >
        <Card 
          className="cursor-pointer hover-elevate border-border/50 bg-card/50 backdrop-blur-sm"
          onClick={onSelect}
          data-testid={`token-card-${token.symbol}`}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-lg" data-testid={`token-symbol-${token.symbol}`}>{token.symbol}</span>
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${CATEGORY_COLORS[token.category] || ""}`}>
                    {CATEGORY_LABELS[token.category] || token.category}
                  </Badge>
                </div>
                <div className="text-sm text-muted-foreground truncate">{token.name}</div>
              </div>
              
              <div className="text-right flex-shrink-0">
                <div className="font-mono font-semibold text-lg" data-testid={`token-price-${token.symbol}`}>
                  ${price ? formatPrice(price.price) : "--"}
                </div>
                <div className={`flex items-center justify-end gap-1 text-sm ${isPositive ? "text-green-400" : "text-red-400"}`}>
                  {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  <span data-testid={`token-change-${token.symbol}`}>{formatChange(changePercent)}</span>
                </div>
              </div>
            </div>

            {price && (
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">24h High</div>
                  <div className="font-mono">${formatPrice(price.high24h)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">24h Low</div>
                  <div className="font-mono">${formatPrice(price.low24h)}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Volume</div>
                  <div className="font-mono">{formatVolume(price.volumeUsd24h)}</div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }
);

function TokenDetailPanel({ token, onClose }: { token: TokenWithPrice; onClose: () => void }) {
  const { data: analysis, isLoading } = useQuery({
    queryKey: ["/api/prices", token.symbol, "analysis"],
    enabled: !!token.symbol,
  });

  const price = token.livePrice;
  const changePercent = price?.changePercent24h || 0;
  const isPositive = changePercent >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="fixed right-0 top-0 h-full w-full max-w-md bg-background border-l border-border shadow-2xl z-50 overflow-hidden"
    >
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-xl">{token.symbol}</span>
                <Badge variant="outline" className={CATEGORY_COLORS[token.category]}>
                  {CATEGORY_LABELS[token.category]}
                </Badge>
              </div>
              <div className="text-sm text-muted-foreground">{token.name}</div>
            </div>
          </div>
          <Button 
            size="icon" 
            variant="ghost" 
            onClick={onClose}
            data-testid="button-close-detail"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-mono text-3xl font-bold" data-testid="detail-price">
                  ${price ? formatPrice(price.price) : "--"}
                </div>
                <div className={`flex items-center gap-1 text-lg ${isPositive ? "text-green-400" : "text-red-400"}`}>
                  {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  <span>{formatChange(changePercent)}</span>
                  <span className="text-muted-foreground text-sm ml-1">24h</span>
                </div>
              </div>
              
              {price && (
                <div className="text-right text-sm">
                  <div className="flex items-center gap-1 text-green-400">
                    <Wifi className="w-3 h-3" />
                    <span>LIVE</span>
                  </div>
                  <div className="text-muted-foreground">{price.exchange}</div>
                </div>
              )}
            </div>

            <Separator />

            {price && (
              <div className="grid grid-cols-2 gap-4">
                <Card className="bg-card/50">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">24h High</div>
                    <div className="font-mono text-lg font-semibold text-green-400">
                      ${formatPrice(price.high24h)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card/50">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">24h Low</div>
                    <div className="font-mono text-lg font-semibold text-red-400">
                      ${formatPrice(price.low24h)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card/50">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">24h Volume</div>
                    <div className="font-mono text-lg font-semibold">
                      {formatVolume(price.volumeUsd24h)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-card/50">
                  <CardContent className="p-3">
                    <div className="text-xs text-muted-foreground">Spread</div>
                    <div className="font-mono text-lg font-semibold">
                      {price.spread ? `${price.spread.toFixed(3)}%` : "N/A"}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : analysis ? (
              <>
                <Card className="bg-card/50 border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="w-4 h-4 text-primary" />
                      AI Analysis
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="text-sm">Confluence Score</div>
                      <ConfidenceGauge confidence={analysis.confluenceScore || 50} />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Badge className={
                        analysis.signalStrength === "strong_buy" ? "bg-green-500/20 text-green-400" :
                        analysis.signalStrength === "buy" ? "bg-green-500/10 text-green-300" :
                        analysis.signalStrength === "strong_sell" ? "bg-red-500/20 text-red-400" :
                        analysis.signalStrength === "sell" ? "bg-red-500/10 text-red-300" :
                        "bg-gray-500/10 text-gray-400"
                      }>
                        {(analysis.signalStrength || "neutral").replace("_", " ").toUpperCase()}
                      </Badge>
                    </div>

                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {analysis.recommendation}
                    </p>
                  </CardContent>
                </Card>

                {analysis.indicators && (
                  <Card className="bg-card/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-cyan-400" />
                        Technical Indicators
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">RSI (14)</span>
                        <div className="flex items-center gap-2">
                          <Progress 
                            value={analysis.indicators.rsi} 
                            className="w-20 h-2"
                          />
                          <span className={`font-mono text-sm ${
                            analysis.indicators.rsi < 30 ? "text-green-400" :
                            analysis.indicators.rsi > 70 ? "text-red-400" : ""
                          }`}>
                            {analysis.indicators.rsi?.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm">MACD</span>
                        <Badge variant="outline" className={
                          analysis.indicators.macd?.trend === "bullish" ? "text-green-400 border-green-400/30" :
                          analysis.indicators.macd?.trend === "bearish" ? "text-red-400 border-red-400/30" :
                          ""
                        }>
                          {analysis.indicators.macd?.trend || "neutral"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <div className="text-muted-foreground">EMA 20</div>
                          <div className="font-mono">${analysis.indicators.ema20?.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">EMA 50</div>
                          <div className="font-mono">${analysis.indicators.ema50?.toFixed(2)}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">EMA 200</div>
                          <div className="font-mono">${analysis.indicators.ema200?.toFixed(2)}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-sm">ATR</span>
                        <span className="font-mono text-sm">
                          {analysis.indicators.atrPercent?.toFixed(2)}%
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {analysis.patterns && analysis.patterns.length > 0 && (
                  <Card className="bg-card/50">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-yellow-400" />
                        Detected Patterns
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {analysis.patterns.map((pattern: string, i: number) => (
                          <Badge 
                            key={i} 
                            variant="outline"
                            className={
                              pattern.toLowerCase().includes("bullish") ? "text-green-400 border-green-400/30" :
                              pattern.toLowerCase().includes("bearish") ? "text-red-400 border-red-400/30" :
                              ""
                            }
                          >
                            {pattern}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="bg-card/50">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>Analysis not available for this token</p>
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </div>
    </motion.div>
  );
}

function SignalCard({ signal }: { signal: AlphaSignal }) {
  const isLong = signal.direction === "long";
  
  return (
    <Card className={`border-l-4 ${isLong ? "border-l-green-500" : "border-l-red-500"} bg-card/50`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-lg">{signal.symbol}</span>
              <Badge className={isLong ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}>
                {isLong ? "LONG" : "SHORT"}
              </Badge>
              <Badge variant="outline" className="text-xs">
                {signal.timeframe}
              </Badge>
              {signal.status === "active" && (
                <Badge className="bg-primary/20 text-primary animate-pulse">
                  ACTIVE
                </Badge>
              )}
            </div>
            
            <div className="mt-2 grid grid-cols-4 gap-3 text-xs">
              <div>
                <div className="text-muted-foreground">Entry</div>
                <div className="font-mono font-semibold">${(signal.entry / 100).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Stop Loss</div>
                <div className="font-mono font-semibold text-red-400">${(signal.stopLoss / 100).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">TP1</div>
                <div className="font-mono font-semibold text-green-400">${(signal.takeProfit1 / 100).toFixed(2)}</div>
              </div>
              <div>
                <div className="text-muted-foreground">R:R</div>
                <div className="font-mono font-semibold">{(signal.riskRewardRatio / 100).toFixed(1)}</div>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center">
            <ConfidenceGauge confidence={signal.confidence} />
            <span className="text-[10px] text-muted-foreground mt-1">Confidence</span>
          </div>
        </div>

        <Separator className="my-3" />

        <div className="text-sm text-muted-foreground">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-3 h-3 text-primary" />
            <span className="font-medium">AI Reasoning</span>
          </div>
          <p className="line-clamp-2">{signal.reasoning}</p>
        </div>

        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span>{new Date(signal.createdAt).toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-1">
            <span>{signal.agentName}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function UltronSignals() {
  const [selectedToken, setSelectedToken] = useState<TokenWithPrice | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "change" | "volume">("change");
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(new Map());

  const { data: tokens = [] } = useQuery<TokenMetadata[]>({
    queryKey: ["/api/tokens"],
  });

  const { data: prices = [] } = useQuery<LivePrice[]>({
    queryKey: ["/api/prices/live"],
    refetchInterval: 5000,
  });

  const { data: signals = [] } = useQuery<AlphaSignal[]>({
    queryKey: ["/api/village/signals"],
  });

  const { isConnected, lastMessage } = useWebSocket();

  useEffect(() => {
    const priceMap = new Map<string, LivePrice>();
    prices.forEach(p => priceMap.set(p.symbol, p));
    setLivePrices(priceMap);
  }, [prices]);

  useEffect(() => {
    if (lastMessage?.type === "priceUpdate" && Array.isArray(lastMessage.data)) {
      setLivePrices(prev => {
        const newMap = new Map(prev);
        lastMessage.data.forEach((p: LivePrice) => newMap.set(p.symbol, p));
        return newMap;
      });
    }
  }, [lastMessage]);

  const tokensWithPrices: TokenWithPrice[] = useMemo(() => {
    return tokens.map(token => ({
      ...token,
      livePrice: livePrices.get(token.symbol),
    }));
  }, [tokens, livePrices]);

  const hasLivePrice = (token: TokenWithPrice): boolean => {
    const price = token.livePrice;
    if (!price) return false;
    return price.changePercent24h !== 0 || price.volumeUsd24h > 0;
  };

  const liveTokens = useMemo(() => {
    return tokensWithPrices.filter(t => t.isActive && hasLivePrice(t));
  }, [tokensWithPrices]);

  const pendingTokensCount = useMemo(() => {
    return tokensWithPrices.filter(t => t.isActive && !hasLivePrice(t)).length;
  }, [tokensWithPrices]);

  const filteredTokens = useMemo(() => {
    let result = liveTokens;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(t => 
        t.symbol.toLowerCase().includes(query) ||
        t.name.toLowerCase().includes(query)
      );
    }

    if (categoryFilter !== "all") {
      result = result.filter(t => t.category === categoryFilter);
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.symbol.localeCompare(b.symbol);
        case "change":
          return (b.livePrice?.changePercent24h || 0) - (a.livePrice?.changePercent24h || 0);
        case "volume":
          return (b.livePrice?.volumeUsd24h || 0) - (a.livePrice?.volumeUsd24h || 0);
        default:
          return (a.marketCapRank || 999) - (b.marketCapRank || 999);
      }
    });

    return result;
  }, [liveTokens, searchQuery, categoryFilter, sortBy]);

  const activeSignals = signals.filter(s => s.status === "active");

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-primary" />
              <h1 className="text-xl font-bold">Ultron Signals</h1>
            </div>
            <Badge variant="outline" className={isConnected ? "text-green-400 border-green-400/30" : "text-red-400 border-red-400/30"}>
              <Radio className={`w-3 h-3 mr-1 ${isConnected ? "animate-pulse" : ""}`} />
              {isConnected ? "LIVE" : "OFFLINE"}
            </Badge>
            <Badge variant="outline" className="text-green-400 border-green-400/30">
              {liveTokens.length} live tokens
            </Badge>
            {pendingTokensCount > 0 && (
              <Badge variant="outline" className="text-muted-foreground">
                +{pendingTokensCount} more coming soon
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tokens..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-48"
                data-testid="input-search"
              />
            </div>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-32" data-testid="select-category">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
              <SelectTrigger className="w-28" data-testid="select-sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="change">24h Change</SelectItem>
                <SelectItem value="volume">Volume</SelectItem>
                <SelectItem value="name">Name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Tabs defaultValue="prices" className="flex-1 flex flex-col overflow-hidden">
        <div className="px-4 pt-2">
          <TabsList>
            <TabsTrigger value="prices" data-testid="tab-prices">
              <Activity className="w-4 h-4 mr-2" />
              Live Prices ({filteredTokens.length})
            </TabsTrigger>
            <TabsTrigger value="signals" data-testid="tab-signals">
              <Signal className="w-4 h-4 mr-2" />
              Active Signals ({activeSignals.length})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="prices" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                <AnimatePresence mode="popLayout">
                  {filteredTokens.map(token => (
                    <LivePriceCard
                      key={token.id}
                      token={token}
                      onSelect={() => setSelectedToken(token)}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {filteredTokens.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No tokens found matching your criteria</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="signals" className="flex-1 overflow-hidden m-0">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {activeSignals.length > 0 ? (
                activeSignals.map(signal => (
                  <SignalCard key={signal.id} signal={signal} />
                ))
              ) : (
                <Card className="bg-card/50">
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Signal className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No Active Signals</p>
                    <p className="text-sm">AI agents are analyzing the market. New signals will appear here.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      <AnimatePresence>
        {selectedToken && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40"
              onClick={() => setSelectedToken(null)}
            />
            <TokenDetailPanel
              token={selectedToken}
              onClose={() => setSelectedToken(null)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
