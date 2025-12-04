import { TrendingUp, TrendingDown, Activity, Bot, DollarSign, Gauge, Zap, Users, BarChart3, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { LiveMetrics } from "@shared/schema";

interface MetricsDashboardProps {
  metrics: LiveMetrics;
  previousMetrics?: LiveMetrics | null;
}

export function MetricsDashboard({ metrics, previousMetrics }: MetricsDashboardProps) {
  const formatCurrency = (value: number) => {
    if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
    if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
    return `$${value.toFixed(2)}`;
  };

  const getRiskColor = (level: number) => {
    if (level < 30) return "text-green-500";
    if (level < 70) return "text-yellow-500";
    return "text-red-500";
  };

  const getWinRateColor = (rate: number) => {
    if (rate >= 60) return "text-green-500";
    if (rate >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const calculateChange = (current: number, previous: number | undefined): { change: string; positive: boolean } | null => {
    if (!previous || previous === 0) return null;
    const delta = ((current - previous) / previous) * 100;
    return {
      change: `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`,
      positive: delta >= 0
    };
  };

  const ethPriceChange = calculateChange(metrics.ethPriceUsd, previousMetrics?.ethPriceUsd);
  const btcPriceChange = calculateChange(metrics.btcPriceUsd, previousMetrics?.btcPriceUsd);
  const tvlChange = calculateChange(metrics.totalTvlUsd, previousMetrics?.totalTvlUsd);

  const metricCards = [
    {
      icon: DollarSign,
      label: "ETH Price",
      value: formatCurrency(metrics.ethPriceUsd),
      change: ethPriceChange?.change,
      positive: ethPriceChange?.positive ?? true,
      testId: "metric-eth-price",
      source: "CCXT Multi-Exchange"
    },
    {
      icon: DollarSign,
      label: "BTC Price",
      value: formatCurrency(metrics.btcPriceUsd),
      change: btcPriceChange?.change,
      positive: btcPriceChange?.positive ?? true,
      testId: "metric-btc-price",
      source: "CCXT Multi-Exchange"
    },
    {
      icon: BarChart3,
      label: "DeFi TVL",
      value: formatCurrency(metrics.totalTvlUsd),
      change: tvlChange?.change,
      positive: tvlChange?.positive ?? true,
      testId: "metric-total-tvl",
      source: "DefiLlama"
    },
    {
      icon: Bot,
      label: "AI Agents",
      value: metrics.activeAgents.toString(),
      testId: "metric-active-agents",
      source: "Trading Village"
    },
    {
      icon: Zap,
      label: "Active Signals",
      value: metrics.totalSignals.toString(),
      testId: "metric-total-signals",
      source: "AI Agent Signals"
    },
    {
      icon: TrendingUp,
      label: "Win Rate",
      value: `${metrics.avgWinRate.toFixed(1)}%`,
      valueColor: getWinRateColor(metrics.avgWinRate),
      testId: "metric-win-rate",
      source: "Agent Performance"
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3" data-testid="metrics-dashboard">
      {metricCards.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card key={metric.label} className="hover-elevate" data-testid={metric.testId}>
            <CardContent className="p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <Icon className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                <div className="flex items-center gap-1 flex-shrink-0">
                  {metric.change && (
                    <span
                      className={`text-xs font-medium flex items-center gap-0.5 ${
                        metric.positive ? "text-green-500" : "text-red-500"
                      }`}
                    >
                      {metric.positive ? (
                        <TrendingUp className="w-2.5 h-2.5" />
                      ) : (
                        <TrendingDown className="w-2.5 h-2.5" />
                      )}
                      {metric.change}
                    </span>
                  )}
                </div>
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className={`text-xl font-bold font-display ${metric.valueColor || ""}`}>
                    {metric.value}
                  </p>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info 
                        className="w-3 h-3 text-muted-foreground/50 cursor-help" 
                        data-testid={`info-${metric.testId}`}
                      />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      <p className="text-xs" data-testid={`tooltip-${metric.testId}`}>Source: {metric.source}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{metric.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
