import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Coins, TrendingUp, Wallet, Layers, RefreshCw, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SolanaMetrics, MarinadeStakingMetrics, OrcaPoolInfo, JupiterSwapQuote } from "@shared/schema";

interface SolanaMetricsDashboardProps {
  walletAddress?: string;
}

export function SolanaMetricsDashboard({ walletAddress }: SolanaMetricsDashboardProps) {
  const { data: solanaMetrics, isLoading: metricsLoading, refetch: refetchMetrics } = useQuery<SolanaMetrics>({
    queryKey: ["/api/solana/metrics", walletAddress],
    refetchInterval: 30000,
  });

  const { data: marinadeMetrics, isLoading: marinadeLoading } = useQuery<MarinadeStakingMetrics>({
    queryKey: ["/api/solana/marinade/metrics"],
    refetchInterval: 60000,
  });

  const { data: orcaPools, isLoading: poolsLoading } = useQuery<OrcaPoolInfo[]>({
    queryKey: ["/api/solana/orca/pools"],
    refetchInterval: 60000,
  });

  const formatUsd = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatSol = (value: number) => {
    return value.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 });
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-purple-400" />
              <CardTitle className="text-lg" data-testid="text-solana-title">Solana Ecosystem</CardTitle>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => refetchMetrics()}
              data-testid="button-refresh-solana"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
          <CardDescription>
            Real-time Solana metrics powered by Helius RPC
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {metricsLoading ? (
            <div className="space-y-2">
              <div className="h-4 bg-muted animate-pulse rounded" />
              <div className="h-4 bg-muted animate-pulse rounded w-3/4" />
            </div>
          ) : solanaMetrics ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-400" data-testid="text-sol-price">
                    {formatUsd(solanaMetrics.solPriceUsd)}
                  </p>
                  <p className="text-xs text-muted-foreground">SOL Price</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold" data-testid="text-sol-balance">
                    {formatSol(solanaMetrics.walletBalanceSol)}
                  </p>
                  <p className="text-xs text-muted-foreground">SOL Balance</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-400" data-testid="text-total-value">
                    {formatUsd(solanaMetrics.totalValueUsd)}
                  </p>
                  <p className="text-xs text-muted-foreground">Total Value</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-400" data-testid="text-slot">
                    {solanaMetrics.slot.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground">Current Slot</p>
                </div>
              </div>

              {solanaMetrics.tokenBalances.length > 0 && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <p className="text-sm font-medium flex items-center gap-2">
                      <Wallet className="w-4 h-4" />
                      Token Balances
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {solanaMetrics.tokenBalances.slice(0, 6).map((token, index) => (
                        <div 
                          key={token.mint} 
                          className="p-2 bg-muted/50 rounded-md"
                          data-testid={`token-balance-${index}`}
                        >
                          <p className="text-sm font-medium">
                            {token.symbol || token.mint.slice(0, 8) + "..."}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {token.amount.toLocaleString(undefined, { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: token.decimals 
                            })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">
              Connect a Solana wallet to view metrics
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              <CardTitle className="text-base" data-testid="text-marinade-title">Marinade Staking</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {marinadeLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded" />
                <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
              </div>
            ) : marinadeMetrics ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-lg font-bold text-orange-400" data-testid="text-marinade-apy">
                      {marinadeMetrics.apy.toFixed(2)}%
                    </p>
                    <p className="text-xs text-muted-foreground">APY</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold" data-testid="text-msol-price">
                      {marinadeMetrics.msolPrice.toFixed(4)}
                    </p>
                    <p className="text-xs text-muted-foreground">mSOL/SOL</p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total Staked</p>
                    <p className="font-medium" data-testid="text-total-staked">
                      {(marinadeMetrics.totalStakedSol / 1e6).toFixed(2)}M SOL
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Validators</p>
                    <p className="font-medium" data-testid="text-validator-count">
                      {marinadeMetrics.validatorCount}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Unable to fetch Marinade data</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <CardTitle className="text-base" data-testid="text-orca-title">Orca Whirlpools</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {poolsLoading ? (
              <div className="space-y-2">
                <div className="h-4 bg-muted animate-pulse rounded" />
                <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
              </div>
            ) : orcaPools && orcaPools.length > 0 ? (
              <div className="space-y-2">
                {orcaPools.slice(0, 3).map((pool, index) => (
                  <div 
                    key={pool.poolAddress} 
                    className="p-2 bg-muted/50 rounded-md flex items-center justify-between gap-2"
                    data-testid={`orca-pool-${index}`}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {pool.tokenA}/{pool.tokenB}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        TVL: {formatUsd(pool.tvlUsd)}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-cyan-400">
                      {pool.feeApr.toFixed(2)}% APR
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No pool data available</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

interface JupiterQuoteDisplayProps {
  quote: JupiterSwapQuote;
}

export function JupiterQuoteDisplay({ quote }: JupiterQuoteDisplayProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ExternalLink className="w-4 h-4" />
          Jupiter Quote
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Input</p>
            <p className="font-medium" data-testid="text-input-amount">{quote.inAmount}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Output</p>
            <p className="font-medium text-green-400" data-testid="text-output-amount">{quote.outAmount}</p>
          </div>
        </div>
        <Separator />
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Price Impact</span>
            <span 
              className={quote.priceImpactPct > 1 ? "text-orange-400" : "text-green-400"}
              data-testid="text-price-impact"
            >
              {quote.priceImpactPct.toFixed(4)}%
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Route</span>
            <span className="text-xs" data-testid="text-route">{quote.routeDescription}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
