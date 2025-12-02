import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import {
  Wallet,
  Plus,
  Trash2,
  RefreshCw,
  Link2,
  Unlink,
  Star,
  ArrowUpRight,
  ArrowDownLeft,
  Coins,
  PieChart,
  Copy,
  Check,
  TrendingUp,
  TrendingDown,
  Shield,
  Gift,
  Landmark,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from "recharts";
import type {
  TrackedWallet,
  WalletAggregate,
  WalletTransaction,
  WalletChain,
  WalletProvider,
  DeFiPosition,
  WalletPnLSummary,
  WalletSnapshot,
} from "@shared/schema";

export default function Wallets() {
  const { toast } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [selectedWallet, setSelectedWallet] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    address: "",
    label: "",
    chain: "ethereum" as WalletChain,
    provider: "manual" as WalletProvider,
    isPrimary: false,
  });

  const { data: wallets = [], isLoading: walletsLoading } = useQuery<TrackedWallet[]>({
    queryKey: ["/api/wallets"],
  });

  const { data: aggregate } = useQuery<WalletAggregate>({
    queryKey: ["/api/wallets/aggregate"],
  });

  const { data: allTransactions = [] } = useQuery<WalletTransaction[]>({
    queryKey: ["/api/wallets-transactions"],
  });

  const { data: stats } = useQuery<{
    totalWallets: number;
    connectedWallets: number;
    totalBalanceUsd: number;
    walletsByChain: Record<WalletChain, number>;
  }>({
    queryKey: ["/api/wallets/stats"],
  });

  const { data: allDefiPositions = [] } = useQuery<DeFiPosition[]>({
    queryKey: ["/api/wallets-defi"],
  });

  const { data: selectedWalletDefi = [] } = useQuery<DeFiPosition[]>({
    queryKey: ["/api/wallets", selectedWallet, "defi"],
    enabled: !!selectedWallet,
  });

  const { data: selectedWalletPnl } = useQuery<WalletPnLSummary>({
    queryKey: ["/api/wallets", selectedWallet, "pnl"],
    enabled: !!selectedWallet,
  });

  const { data: selectedWalletSnapshots = [] } = useQuery<WalletSnapshot[]>({
    queryKey: ["/api/wallets", selectedWallet, "snapshots"],
    enabled: !!selectedWallet,
  });

  const addMutation = useMutation({
    mutationFn: async (data: any) => apiRequest("POST", "/api/wallets", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets/aggregate"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets/stats"] });
      setShowForm(false);
      resetForm();
      toast({ title: "Wallet added", description: "Wallet has been added to tracking" });
    },
    onError: (error: any) => {
      toast({ title: "Failed to add wallet", description: error.message, variant: "destructive" });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("DELETE", `/api/wallets/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets/aggregate"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets/stats"] });
      toast({ title: "Wallet removed", description: "Wallet has been removed from tracking" });
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/wallets/${id}/sync`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets/aggregate"] });
      toast({ title: "Wallet synced", description: "Balances have been updated" });
    },
  });

  const syncAllMutation = useMutation({
    mutationFn: async () => apiRequest("POST", "/api/wallets/sync-all"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets/aggregate"] });
      toast({ title: "All wallets synced", description: "All balances have been updated" });
    },
  });

  const connectMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/wallets/${id}/connect`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets/stats"] });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async (id: string) => apiRequest("POST", `/api/wallets/${id}/disconnect`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/wallets/stats"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TrackedWallet> }) =>
      apiRequest("PATCH", `/api/wallets/${id}`, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/wallets"] });
    },
  });

  const resetForm = () => {
    setFormData({
      address: "",
      label: "",
      chain: "ethereum",
      provider: "manual",
      isPrimary: false,
    });
  };

  const handleSubmit = () => {
    addMutation.mutate(formData);
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    setTimeout(() => setCopiedAddress(null), 2000);
    toast({ title: "Address copied", description: "Wallet address copied to clipboard" });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const chainColors: Record<WalletChain, string> = {
    ethereum: "bg-blue-500/10 text-blue-500",
    base: "bg-purple-500/10 text-purple-500",
    fraxtal: "bg-orange-500/10 text-orange-500",
    solana: "bg-green-500/10 text-green-500",
  };

  const chainIcons: Record<WalletChain, string> = {
    ethereum: "ETH",
    base: "BASE",
    fraxtal: "FRAX",
    solana: "SOL",
  };

  const providerLabels: Record<WalletProvider, string> = {
    metamask: "MetaMask",
    walletconnect: "WalletConnect",
    coinbase: "Coinbase",
    phantom: "Phantom",
    solflare: "Solflare",
    ledger: "Ledger",
    manual: "Manual",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" data-testid="text-page-title">Multi-Wallet Manager</h1>
          <p className="text-muted-foreground">Track multiple wallets across Ethereum, Base, Fraxtal, and Solana</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => syncAllMutation.mutate()}
            disabled={syncAllMutation.isPending}
            data-testid="button-sync-all"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${syncAllMutation.isPending ? "animate-spin" : ""}`} />
            Sync All
          </Button>
          <Button onClick={() => setShowForm(!showForm)} data-testid="button-add-wallet">
            <Plus className="h-4 w-4 mr-2" />
            Add Wallet
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Wallets</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-wallets">{stats?.totalWallets ?? 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.connectedWallets ?? 0} connected</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Token Balance</CardTitle>
            <Coins className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500" data-testid="text-total-balance">
              ${(aggregate?.totalBalanceUsd ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Wallet tokens</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">DeFi Value</CardTitle>
            <Landmark className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500" data-testid="text-defi-balance">
              ${(aggregate?.defiPositionsUsd ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{allDefiPositions.length} positions</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance by Chain</CardTitle>
            <PieChart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              {aggregate?.balanceByChain && Object.entries(aggregate.balanceByChain).map(([chain, balance]) => (
                <div key={chain} className="flex items-center gap-2">
                  <Badge className={chainColors[chain as WalletChain]}>{chainIcons[chain as WalletChain]}</Badge>
                  <span className="text-sm font-medium">${balance.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {aggregate?.topTokens && aggregate.topTokens.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Portfolio Allocation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {aggregate.topTokens.slice(0, 5).map((token) => (
              <div key={token.symbol} className="space-y-1">
                <div className="flex items-center justify-between gap-4 text-sm">
                  <span className="font-medium">{token.symbol}</span>
                  <span className="text-muted-foreground">
                    ${token.totalUsd.toLocaleString()} ({token.percentage.toFixed(1)}%)
                  </span>
                </div>
                <Progress value={token.percentage} className="h-1" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add Wallet</CardTitle>
            <CardDescription>Track a new wallet address</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="address">Wallet Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="0x... or Solana address"
                  data-testid="input-address"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="label">Label</Label>
                <Input
                  id="label"
                  value={formData.label}
                  onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                  placeholder="e.g., Main Wallet"
                  data-testid="input-label"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="chain">Chain</Label>
                <Select
                  value={formData.chain}
                  onValueChange={(v) => setFormData({ ...formData, chain: v as WalletChain })}
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
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Select
                  value={formData.provider}
                  onValueChange={(v) => setFormData({ ...formData, provider: v as WalletProvider })}
                >
                  <SelectTrigger data-testid="select-provider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="metamask">MetaMask</SelectItem>
                    <SelectItem value="walletconnect">WalletConnect</SelectItem>
                    <SelectItem value="coinbase">Coinbase</SelectItem>
                    <SelectItem value="phantom">Phantom</SelectItem>
                    <SelectItem value="solflare">Solflare</SelectItem>
                    <SelectItem value="ledger">Ledger</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Primary Wallet</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={formData.isPrimary}
                    onCheckedChange={(v) => setFormData({ ...formData, isPrimary: v })}
                    data-testid="switch-primary"
                  />
                  <span className="text-sm text-muted-foreground">Set as primary for this chain</span>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)} data-testid="button-cancel">
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={addMutation.isPending} data-testid="button-add">
              Add Wallet
            </Button>
          </CardFooter>
        </Card>
      )}

      <Tabs defaultValue="wallets">
        <TabsList>
          <TabsTrigger value="wallets" data-testid="tab-wallets">Wallets</TabsTrigger>
          <TabsTrigger value="defi" data-testid="tab-defi">DeFi Positions</TabsTrigger>
          <TabsTrigger value="transactions" data-testid="tab-transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="wallets" className="space-y-4">
          {walletsLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">Loading wallets...</CardContent>
            </Card>
          ) : wallets.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No wallets tracked. Add a wallet to start monitoring balances.
              </CardContent>
            </Card>
          ) : (
            wallets.map((wallet) => (
              <Card key={wallet.id} data-testid={`card-wallet-${wallet.id}`}>
                <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${chainColors[wallet.chain]}`}>
                      <Wallet className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {wallet.label}
                        {wallet.isPrimary && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <button
                          onClick={() => copyAddress(wallet.address)}
                          className="flex items-center gap-1 hover:text-foreground transition-colors"
                          data-testid={`button-copy-${wallet.id}`}
                        >
                          {formatAddress(wallet.address)}
                          {copiedAddress === wallet.address ? (
                            <Check className="h-3 w-3 text-green-500" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={chainColors[wallet.chain]}>{chainIcons[wallet.chain]}</Badge>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant={selectedWallet === wallet.id ? "default" : "outline"}
                          onClick={() => setSelectedWallet(selectedWallet === wallet.id ? null : wallet.id)}
                          data-testid={`button-details-${wallet.id}`}
                        >
                          <ChevronRight className={`h-4 w-4 transition-transform ${selectedWallet === wallet.id ? "rotate-90" : ""}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View DeFi details</TooltipContent>
                    </Tooltip>
                    {wallet.isConnected ? (
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => disconnectMutation.mutate(wallet.id)}
                        data-testid={`button-disconnect-${wallet.id}`}
                      >
                        <Unlink className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => connectMutation.mutate(wallet.id)}
                        data-testid={`button-connect-${wallet.id}`}
                      >
                        <Link2 className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => syncMutation.mutate(wallet.id)}
                      disabled={syncMutation.isPending}
                      data-testid={`button-sync-${wallet.id}`}
                    >
                      <RefreshCw className={`h-4 w-4 ${syncMutation.isPending ? "animate-spin" : ""}`} />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => removeMutation.mutate(wallet.id)}
                      data-testid={`button-delete-${wallet.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Native Balance</p>
                      <p className="text-lg font-bold">{parseFloat(wallet.balanceNative).toFixed(4)} {chainIcons[wallet.chain]}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Value</p>
                      <p className="text-lg font-bold text-green-500">${wallet.balanceUsd.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Provider</p>
                      <p className="text-lg font-bold">{providerLabels[wallet.provider]}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Last Synced</p>
                      <p className="text-sm">{new Date(wallet.lastSyncedAt).toLocaleString()}</p>
                    </div>
                  </div>
                  {wallet.tokenBalances.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">Token Balances</p>
                      <div className="flex flex-wrap gap-2">
                        {wallet.tokenBalances.map((token) => (
                          <Badge key={token.address} variant="secondary">
                            {token.symbol}: {parseFloat(token.balance).toFixed(2)} (${token.balanceUsd.toFixed(2)})
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="defi" className="space-y-4">
          {allDefiPositions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No DeFi positions tracked yet. Sync your wallets to fetch DeFi positions.
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {allDefiPositions.map((position) => {
                  const wallet = wallets.find(w => w.id === position.walletId);
                  return (
                    <Card key={position.id} data-testid={`card-defi-${position.id}`}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between gap-2">
                          <CardTitle className="text-sm font-medium">{position.name}</CardTitle>
                          <Badge variant="secondary" className="text-xs">
                            {position.protocol.toUpperCase()}
                          </Badge>
                        </div>
                        <CardDescription>
                          {wallet?.label || "Unknown Wallet"} - {position.chain.toUpperCase()}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-muted-foreground">Type</span>
                          <Badge
                            variant="outline"
                            className={
                              position.type === "staking" ? "text-blue-500 border-blue-500/30" :
                              position.type === "lending" ? "text-green-500 border-green-500/30" :
                              position.type === "borrowing" ? "text-red-500 border-red-500/30" :
                              position.type === "lp" ? "text-purple-500 border-purple-500/30" :
                              "text-muted-foreground"
                            }
                          >
                            {position.type === "lp" ? "Liquidity Pool" : position.type.charAt(0).toUpperCase() + position.type.slice(1)}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-muted-foreground">Value</span>
                          <span className="font-bold text-green-500">
                            ${position.stakedValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>

                        {position.borrowedValueUsd && position.borrowedValueUsd > 0 && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-muted-foreground">Borrowed</span>
                            <span className="font-bold text-red-500">
                              ${position.borrowedValueUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}

                        {position.apy && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-muted-foreground">APY</span>
                            <span className="font-medium text-purple-500">{position.apy.toFixed(2)}%</span>
                          </div>
                        )}

                        {position.healthFactor && (
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Shield className="h-3 w-3" />
                              Health Factor
                            </span>
                            <span className={`font-medium ${
                              position.healthFactor > 2 ? "text-green-500" :
                              position.healthFactor > 1.5 ? "text-yellow-500" :
                              "text-red-500"
                            }`}>
                              {position.healthFactor.toFixed(2)}
                            </span>
                          </div>
                        )}

                        {position.rewardsClaimable > 0 && (
                          <div className="flex items-center justify-between gap-2 pt-2 border-t">
                            <span className="text-sm text-muted-foreground flex items-center gap-1">
                              <Gift className="h-3 w-3" />
                              Rewards
                            </span>
                            <span className="font-medium text-green-500">
                              ${position.rewardsClaimable.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">DeFi Summary by Protocol</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Object.entries(
                      allDefiPositions.reduce((acc, pos) => {
                        const key = pos.protocol;
                        if (!acc[key]) acc[key] = { value: 0, count: 0, borrowed: 0 };
                        acc[key].value += pos.stakedValueUsd;
                        acc[key].borrowed += pos.borrowedValueUsd || 0;
                        acc[key].count++;
                        return acc;
                      }, {} as Record<string, { value: number; count: number; borrowed: number }>)
                    ).map(([protocol, data]) => (
                      <div key={protocol} className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-purple-500/10">
                            <Landmark className="h-4 w-4 text-purple-500" />
                          </div>
                          <div>
                            <p className="font-medium capitalize">{protocol}</p>
                            <p className="text-xs text-muted-foreground">{data.count} position{data.count > 1 ? "s" : ""}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-green-500">${data.value.toLocaleString()}</p>
                          {data.borrowed > 0 && (
                            <p className="text-xs text-red-500">-${data.borrowed.toLocaleString()} borrowed</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          {allTransactions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No transactions recorded yet.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-2">
                    {allTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between gap-4 p-3 rounded-lg bg-muted/50"
                        data-testid={`row-transaction-${tx.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${tx.type === "receive" ? "bg-green-500/10" : "bg-red-500/10"}`}>
                            {tx.type === "receive" ? (
                              <ArrowDownLeft className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowUpRight className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium capitalize">{tx.type}</p>
                            <p className="text-xs text-muted-foreground">{formatAddress(tx.hash)}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-bold ${tx.type === "receive" ? "text-green-500" : "text-red-500"}`}>
                            {tx.type === "receive" ? "+" : "-"}${tx.valueUsd.toLocaleString()}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.timestamp).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
