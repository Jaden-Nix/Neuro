import { Activity, Code } from "lucide-react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  systemHealth: number;
  activeAgents: number;
  chainStatus: "connected" | "disconnected" | "syncing";
  onOpenDevPanel: () => void;
}

export function Header({ systemHealth, activeAgents, chainStatus, onOpenDevPanel }: HeaderProps) {
  const getChainStatusColor = () => {
    switch (chainStatus) {
      case "connected":
        return "bg-green-500";
      case "syncing":
        return "bg-yellow-500";
      default:
        return "bg-red-500";
    }
  };

  const getHealthColor = () => {
    if (systemHealth >= 80) return "text-green-500";
    if (systemHealth >= 50) return "text-yellow-500";
    return "text-red-500";
  };

  return (
    <header
      className="fixed top-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-lg border-b border-border z-40"
      data-testid="header"
    >
      <div className="container mx-auto h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-display font-bold">NeuroNet Governor</h1>
        </div>

        <div className="flex items-center gap-6">
          {/* System Status Indicators */}
          <div className="hidden md:flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Health:</span>
              <span className={`font-mono font-semibold ${getHealthColor()}`}>
                {systemHealth}%
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Agents:</span>
              <Badge variant="secondary" className="font-mono" data-testid="badge-active-agents">
                {activeAgents}/4
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">Chain:</span>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${getChainStatusColor()}`} />
                <span className="text-xs capitalize" data-testid="text-chain-status">
                  {chainStatus}
                </span>
              </div>
            </div>
          </div>

          <div className="h-6 w-px bg-border hidden md:block" />

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button
              size="icon"
              variant="outline"
              onClick={onOpenDevPanel}
              data-testid="button-open-dev-panel"
              className="rounded-md"
            >
              <Code className="w-5 h-5" />
            </Button>

            <ThemeToggle />

            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus={{
                smallScreen: "avatar",
                largeScreen: "full",
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
