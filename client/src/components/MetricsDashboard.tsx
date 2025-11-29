import { TrendingUp, TrendingDown, Activity, Wallet, DollarSign, Gauge } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { LiveMetrics } from "@shared/schema";

interface MetricsDashboardProps {
  metrics: LiveMetrics;
}

export function MetricsDashboard({ metrics }: MetricsDashboardProps) {
  const formatCurrency = (value: number) => {
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

  const metricCards = [
    {
      icon: Wallet,
      label: "Wallet Balance",
      value: formatCurrency(metrics.walletBalanceEth),
      change: "+2.4%",
      positive: true,
      testId: "metric-wallet-balance"
    },
    {
      icon: DollarSign,
      label: "Total TVL",
      value: formatCurrency(metrics.tvlUsd),
      change: "+5.7%",
      positive: true,
      testId: "metric-total-tvl"
    },
    {
      icon: TrendingUp,
      label: "Current APY",
      value: `${metrics.currentAPY.toFixed(2)}%`,
      change: "+0.3%",
      positive: true,
      testId: "metric-current-apy"
    },
    {
      icon: Gauge,
      label: "Risk Level",
      value: `${metrics.riskLevel}%`,
      valueColor: getRiskColor(metrics.riskLevel),
      testId: "metric-risk-level"
    },
    {
      icon: Activity,
      label: "Active Opportunities",
      value: metrics.activeOpportunities.toString(),
      testId: "metric-active-opportunities"
    },
    {
      icon: Activity,
      label: "Pending Txs",
      value: metrics.pendingTransactions.toString(),
      testId: "metric-pending-transactions"
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4" data-testid="metrics-dashboard">
      {metricCards.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card key={metric.label} className="hover-elevate" data-testid={metric.testId}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <Icon className="w-4 h-4 text-muted-foreground" />
                {metric.change && (
                  <span
                    className={`text-xs font-medium flex items-center gap-0.5 ${
                      metric.positive ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {metric.positive ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {metric.change}
                  </span>
                )}
              </div>
              <div>
                <p className={`text-2xl font-bold font-display ${metric.valueColor || ""}`}>
                  {metric.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{metric.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
