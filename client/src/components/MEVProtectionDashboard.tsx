import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Shield, AlertTriangle, CheckCircle2, XCircle, Zap, Lock } from "lucide-react";
import type { MEVProtectionStatus, MEVRiskMetrics } from "@shared/schema";

interface MEVProtectionDashboardProps {
  txValue?: string;
  txTo?: string;
}

export function MEVProtectionDashboard({ txValue, txTo }: MEVProtectionDashboardProps) {
  const { data: protectionStatus, isLoading: statusLoading } = useQuery<MEVProtectionStatus>({
    queryKey: ["/api/mev/status"],
    refetchInterval: 30000,
  });

  const getRiskLevelColor = (level: string) => {
    switch (level) {
      case "low":
        return "bg-green-500/20 text-green-400 border-green-500/30";
      case "medium":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30";
      case "high":
        return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "critical":
        return "bg-red-500/20 text-red-400 border-red-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case "low":
        return <CheckCircle2 className="w-4 h-4" />;
      case "medium":
        return <AlertTriangle className="w-4 h-4" />;
      case "high":
      case "critical":
        return <XCircle className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              <CardTitle className="text-lg" data-testid="text-mev-title">MEV Protection</CardTitle>
            </div>
            {protectionStatus?.flashbotsEnabled ? (
              <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
                <Lock className="w-3 h-3 mr-1" />
                Protected
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                <AlertTriangle className="w-3 h-3 mr-1" />
                Unprotected
              </Badge>
            )}
          </div>
          <CardDescription>
            Flashbots-powered protection against MEV extraction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {statusLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-muted animate-pulse rounded" />
              <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Flashbots RPC</p>
                  <div className="flex items-center gap-2">
                    {protectionStatus?.flashbotsEnabled ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                    <span className="text-sm font-medium" data-testid="text-flashbots-status">
                      {protectionStatus?.flashbotsEnabled ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Private Mempool</p>
                  <div className="flex items-center gap-2">
                    {protectionStatus?.privateMempoolEnabled ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <XCircle className="w-4 h-4 text-yellow-400" />
                    )}
                    <span className="text-sm font-medium" data-testid="text-mempool-status">
                      {protectionStatus?.privateMempoolEnabled ? "Active" : "Public"}
                    </span>
                  </div>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="text-slippage">
                    {protectionStatus?.defaultSlippage || 0.5}%
                  </p>
                  <p className="text-xs text-muted-foreground">Default Slippage</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="text-protected-txs">
                    {protectionStatus?.protectedTransactions || 0}
                  </p>
                  <p className="text-xs text-muted-foreground">Protected Txs</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400" data-testid="text-mev-saved">
                    {protectionStatus?.mevSaved?.toFixed(4) || "0.0000"}
                  </p>
                  <p className="text-xs text-muted-foreground">ETH Saved</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface MEVRiskDisplayProps {
  riskMetrics: MEVRiskMetrics;
  showRecommendations?: boolean;
}

export function MEVRiskDisplay({ riskMetrics, showRecommendations = true }: MEVRiskDisplayProps) {
  const getRiskColor = (score: number) => {
    if (score < 25) return "text-green-400";
    if (score < 50) return "text-yellow-400";
    if (score < 75) return "text-orange-400";
    return "text-red-400";
  };

  const getProgressColor = (score: number) => {
    if (score < 25) return "bg-green-500";
    if (score < 50) return "bg-yellow-500";
    if (score < 75) return "bg-orange-500";
    return "bg-red-500";
  };

  const getRiskLevelBadge = (level: string) => {
    const styles: Record<string, string> = {
      low: "bg-green-500/20 text-green-400 border-green-500/30",
      medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
      critical: "bg-red-500/20 text-red-400 border-red-500/30",
    };
    return styles[level] || "bg-muted text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4" />
            MEV Risk Analysis
          </CardTitle>
          <Badge variant="outline" className={getRiskLevelBadge(riskMetrics.riskLevel)}>
            {riskMetrics.riskLevel.toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Sandwich Attack Risk</span>
              <span className={getRiskColor(riskMetrics.sandwichRisk)} data-testid="text-sandwich-risk">
                {riskMetrics.sandwichRisk}%
              </span>
            </div>
            <Progress 
              value={riskMetrics.sandwichRisk} 
              className="h-2"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Frontrun Risk</span>
              <span className={getRiskColor(riskMetrics.frontrunRisk)} data-testid="text-frontrun-risk">
                {riskMetrics.frontrunRisk}%
              </span>
            </div>
            <Progress 
              value={riskMetrics.frontrunRisk} 
              className="h-2"
            />
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Backrun Risk</span>
              <span className={getRiskColor(riskMetrics.backrunRisk)} data-testid="text-backrun-risk">
                {riskMetrics.backrunRisk}%
              </span>
            </div>
            <Progress 
              value={riskMetrics.backrunRisk} 
              className="h-2"
            />
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Overall Risk Score</p>
            <p className={`text-2xl font-bold ${getRiskColor(riskMetrics.overallRiskScore)}`} data-testid="text-overall-risk">
              {riskMetrics.overallRiskScore}%
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Estimated MEV Loss</p>
            <p className="text-2xl font-bold text-orange-400" data-testid="text-estimated-loss">
              {riskMetrics.estimatedMEVLoss.toFixed(4)} ETH
            </p>
          </div>
        </div>

        {showRecommendations && riskMetrics.recommendations.length > 0 && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-sm font-medium">Recommendations</p>
              <ul className="space-y-1">
                {riskMetrics.recommendations.map((rec, index) => (
                  <li 
                    key={index} 
                    className="text-sm text-muted-foreground flex items-start gap-2"
                    data-testid={`text-recommendation-${index}`}
                  >
                    <CheckCircle2 className="w-3 h-3 mt-1 text-primary shrink-0" />
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
