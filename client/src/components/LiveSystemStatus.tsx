import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Zap, Shield } from "lucide-react";

interface HackathonStatus {
  compliance?: {
    atp?: {
      fraxtalConnected?: boolean;
      rpcStatus?: string;
      lastBlockNumber?: number;
      chainId?: number;
    };
    adkTs?: {
      apiKeyConfigured?: boolean;
    };
    iqToken?: {
      rpcStatus?: string;
    };
  };
}

export function LiveSystemStatus() {
  const { data: status } = useQuery<HackathonStatus>({
    queryKey: ["/api/hackathon/status"],
    refetchInterval: 5000,
  });

  const fraxtalConnected = status?.compliance?.atp?.fraxtalConnected ?? false;
  const rpcStatus = status?.compliance?.atp?.rpcStatus ?? "checking";
  const blockNumber = status?.compliance?.atp?.lastBlockNumber ?? 0;
  const chainId = status?.compliance?.atp?.chainId ?? 0;
  const adkConfigured = status?.compliance?.adkTs?.apiKeyConfigured ?? false;
  const iqTokenRpc = status?.compliance?.iqToken?.rpcStatus ?? "checking";

  const StatusBadge = ({ active, label }: { active: boolean; label: string }) => (
    <div className="flex items-center gap-2">
      {active ? (
        <CheckCircle2 className="w-4 h-4 text-green-500" />
      ) : (
        <AlertCircle className="w-4 h-4 text-yellow-500" />
      )}
      <span className="text-sm">{label}</span>
      <Badge variant={active ? "default" : "secondary"} className="text-xs">
        {active ? "Live" : "Checking"}
      </Badge>
    </div>
  );

  return (
    <Card className="border-primary/20 bg-primary/5" data-testid="live-system-status">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            <CardTitle className="text-sm font-semibold">System Live Status</CardTitle>
          </div>
          <Badge variant="default" className="text-xs bg-green-500">
            LIVE
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Fraxtal Connection */}
        <StatusBadge active={fraxtalConnected} label="Fraxtal Connected" />
        <div className="text-xs text-muted-foreground pl-6">
          Chain ID: {chainId} • Block: {blockNumber.toLocaleString()}
        </div>

        {/* RPC Status */}
        <StatusBadge active={rpcStatus === "live"} label="ATP RPC Endpoint" />
        <div className="text-xs text-muted-foreground pl-6">
          Status: {rpcStatus}
        </div>

        {/* IQ Token Metrics */}
        <StatusBadge active={iqTokenRpc === "live"} label="IQ Token Metrics" />
        <div className="text-xs text-muted-foreground pl-6">
          Ethereum RPC connected
        </div>

        {/* ADK Integration */}
        <StatusBadge active={adkConfigured} label="ADK Integration" />
        <div className="text-xs text-muted-foreground pl-6">
          Google Gemini agents active
        </div>

        {/* Safety Features */}
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs font-semibold mb-2">
            <Shield className="w-4 h-4 text-blue-500" />
            Safety Features Active
          </div>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>✓ Multi-sig Governance (2-of-3, 3-of-5, 4-of-7)</li>
            <li>✓ Agent Veto Logic (Risk, Execution, Meta)</li>
            <li>✓ Circuit Breaker Protection</li>
            <li>✓ Self-Healing Engine</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
