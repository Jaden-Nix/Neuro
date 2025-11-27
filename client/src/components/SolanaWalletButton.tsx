import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { SolanaWallet } from "@shared/schema";

export function SolanaWalletButton() {
  const { toast } = useToast();
  const [isConnecting, setIsConnecting] = useState(false);

  const { data: wallets = [] } = useQuery<SolanaWallet[]>({
    queryKey: ["/api/solana/wallets"],
    refetchInterval: 10000,
  });

  const connectWallet = useMutation({
    mutationFn: async () => {
      const provider = window.phantom?.solana;
      if (!provider?.isPhantom && !window.solflare) {
        throw new Error("No Solana wallet extension detected");
      }

      const wallet = provider?.isPhantom ? provider : window.solflare;
      if (!wallet?.connect) {
        throw new Error("Wallet extension not properly initialized");
      }

      const response = await wallet.connect();
      const address = response.publicKey.toString();
      const providerName = provider?.isPhantom ? "phantom" : "solflare";

      return await apiRequest("POST", "/api/solana/wallet/connect", {
        address,
        provider: providerName,
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Wallet Connected",
        description: `Connected to ${data.address.slice(0, 8)}...`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/solana/wallets"] });
    },
    onError: (error) => {
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect wallet",
        variant: "destructive",
      });
    },
  });

  const disconnectWallet = useMutation({
    mutationFn: async (address: string) => {
      return await apiRequest("POST", "/api/solana/wallet/disconnect", { address });
    },
    onSuccess: () => {
      toast({
        title: "Wallet Disconnected",
        description: "Solana wallet has been disconnected",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/solana/wallets"] });
    },
  });

  if (wallets.length > 0) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-card/50 rounded-md border border-border">
          <Wallet className="w-4 h-4 text-green-500" />
          <span className="text-xs font-mono">{wallets[0].address.slice(0, 8)}...</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => disconnectWallet.mutate(wallets[0].address)}
          data-testid="button-disconnect-solana-wallet"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => connectWallet.mutate()}
      disabled={isConnecting || connectWallet.isPending}
      data-testid="button-connect-solana-wallet"
      className="gap-2"
    >
      <Wallet className="w-4 h-4" />
      Connect Solana
    </Button>
  );
}
