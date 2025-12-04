import { Button } from "@/components/ui/button";
import { Wallet, Rocket } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function SolanaWalletButton() {
  const { toast } = useToast();

  const handleClick = () => {
    toast({
      title: "Auto-Trade Coming Soon",
      description: "Wallet connection for automated trading is currently in development. Stay tuned!",
    });
  };

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleClick}
      data-testid="button-connect-solana-wallet"
      className="gap-2"
    >
      <Wallet className="w-4 h-4" />
      <span className="hidden sm:inline">Connect Solana</span>
      <Rocket className="w-3 h-3 text-muted-foreground" />
    </Button>
  );
}
