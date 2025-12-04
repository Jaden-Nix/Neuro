import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, TrendingDown, Target, Shield, Clock, Zap, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "wouter";
import { formatCryptoPrice } from "@/lib/utils";

interface TradeSignal {
  id: string;
  agentId: string;
  agentName: string;
  token: string;
  direction: "long" | "short";
  entry: number;
  stopLoss: number;
  takeProfit: number[];
  confidence: number;
  riskReward: number;
  reasoning: string;
  timestamp: number;
  status: "pending" | "validated" | "rejected";
  validations: Array<{
    agentId: string;
    vote: "agree" | "disagree";
  }>;
}

export function TradingSignalsSummary() {
  const { data: signals = [], isLoading } = useQuery<TradeSignal[]>({
    queryKey: ["/api/village/signals"],
    refetchInterval: 10000,
  });

  const recentSignals = signals
    .filter(s => s.status === "validated" && s.confidence >= 70)
    .slice(0, 5);

  const formatPrice = (price: number) => formatCryptoPrice(price);

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return "text-green-500";
    if (confidence >= 70) return "text-yellow-500";
    return "text-orange-500";
  };

  const getTimeAgo = (timestamp: number) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">Trading Signals</h3>
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-muted/50 animate-pulse rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="trading-signals-summary">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Target className="w-4 h-4 text-primary" />
          </motion.div>
          <h3 className="text-sm font-semibold">AI Trading Signals</h3>
          {recentSignals.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {recentSignals.length} Active
            </Badge>
          )}
        </div>
        <Link href="/village" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1" data-testid="link-view-all-signals">
          View All <ChevronRight className="w-3 h-3" />
        </Link>
      </div>

      <ScrollArea className="h-[280px]">
        <div className="space-y-2 pr-2">
          {recentSignals.length === 0 ? (
            <div className="text-center py-8">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Target className="w-10 h-10 mx-auto mb-2 text-muted-foreground/30" />
              </motion.div>
              <p className="text-sm text-muted-foreground">Scanning for opportunities...</p>
              <p className="text-xs text-muted-foreground/50 mt-1">AI agents analyzing markets</p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {recentSignals.map((signal, idx) => (
                <motion.div
                  key={signal.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`p-3 rounded-md border hover-elevate ${
                    signal.direction === "long"
                      ? "bg-green-500/5 border-green-500/20"
                      : "bg-red-500/5 border-red-500/20"
                  }`}
                  data-testid={`signal-${signal.id}`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      {signal.direction === "long" ? (
                        <div className="p-1 rounded bg-green-500/20">
                          <TrendingUp className="w-3 h-3 text-green-500" />
                        </div>
                      ) : (
                        <div className="p-1 rounded bg-red-500/20">
                          <TrendingDown className="w-3 h-3 text-red-500" />
                        </div>
                      )}
                      <div>
                        <span className="font-semibold text-sm">{signal.token}</span>
                        <span className={`ml-2 text-xs font-medium ${
                          signal.direction === "long" ? "text-green-500" : "text-red-500"
                        }`}>
                          {signal.direction.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-xs font-bold ${getConfidenceColor(signal.confidence)}`}>
                        {signal.confidence}%
                      </span>
                      <Clock className="w-3 h-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">
                        {getTimeAgo(signal.timestamp)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div>
                      <p className="text-muted-foreground text-[10px]">Entry</p>
                      <p className="font-mono font-medium">${formatPrice(signal.entry)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] flex items-center gap-0.5">
                        <Shield className="w-2.5 h-2.5 text-red-400" /> SL
                      </p>
                      <p className="font-mono font-medium text-red-400">${formatPrice(signal.stopLoss)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px] flex items-center gap-0.5">
                        <Zap className="w-2.5 h-2.5 text-green-400" /> TP1
                      </p>
                      <p className="font-mono font-medium text-green-400">${formatPrice(signal.takeProfit[0] || 0)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">
                      by <span className="text-foreground font-medium">{signal.agentName}</span>
                    </span>
                    <Badge variant="outline" className="text-[9px] h-4">
                      R:R {signal.riskReward.toFixed(1)}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
