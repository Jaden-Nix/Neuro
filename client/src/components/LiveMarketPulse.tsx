import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Activity, ChevronRight, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";

interface TokenPrice {
  symbol: string;
  name: string;
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  source: string;
  timestamp: number;
}

const TOP_TOKENS = ["BTC", "ETH", "SOL", "XRP", "DOGE", "AVAX", "LINK", "UNI"];

export function LiveMarketPulse() {
  const { data: pricesData, isLoading } = useQuery<Record<string, TokenPrice>>({
    queryKey: ["/api/ultron/prices"],
    refetchInterval: 3000,
  });

  const prices = pricesData || {};
  const topPrices = TOP_TOKENS
    .map(symbol => prices[`${symbol}USDT`] || prices[symbol])
    .filter(Boolean);

  const formatPrice = (price: number) => {
    if (price >= 10000) return `$${(price / 1000).toFixed(1)}K`;
    if (price >= 1000) return `$${price.toFixed(0)}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
  };

  const formatVolume = (volume: number) => {
    if (volume >= 1e9) return `$${(volume / 1e9).toFixed(1)}B`;
    if (volume >= 1e6) return `$${(volume / 1e6).toFixed(1)}M`;
    return `$${(volume / 1e3).toFixed(0)}K`;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Market Pulse</h3>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-muted/50 animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="live-market-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <Activity className="w-4 h-4 text-primary" />
          </motion.div>
          <h3 className="text-sm font-semibold">Market Pulse</h3>
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-green-500"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
          <span className="text-[10px] text-green-500 font-mono">LIVE</span>
        </div>
        <Link href="/ultron-signals" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1" data-testid="link-market-full-view">
          Full View <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <ScrollArea className="h-[140px]">
        <div className="grid grid-cols-2 gap-2 pr-2">
          {topPrices.length === 0 ? (
            <div className="col-span-2 text-center py-6">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Zap className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
              </motion.div>
              <p className="text-sm text-muted-foreground">Connecting to exchanges...</p>
            </div>
          ) : (
            topPrices.map((token, idx) => (
              <motion.div
                key={token.symbol}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: idx * 0.03 }}
                className={`p-2.5 rounded-md border hover-elevate ${
                  token.change24h >= 0
                    ? "bg-green-500/5 border-green-500/20"
                    : "bg-red-500/5 border-red-500/20"
                }`}
                data-testid={`token-${token.symbol}`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-xs">
                    {token.symbol.replace("USDT", "")}
                  </span>
                  <div className={`flex items-center gap-0.5 text-[10px] font-medium ${
                    token.change24h >= 0 ? "text-green-500" : "text-red-500"
                  }`}>
                    {token.change24h >= 0 ? (
                      <TrendingUp className="w-2.5 h-2.5" />
                    ) : (
                      <TrendingDown className="w-2.5 h-2.5" />
                    )}
                    {token.change24h >= 0 ? "+" : ""}{token.change24h.toFixed(1)}%
                  </div>
                </div>
                <p className="font-mono font-bold text-sm">{formatPrice(token.price)}</p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  Vol: {formatVolume(token.volume24h || 0)}
                </p>
              </motion.div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
