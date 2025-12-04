import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Award,
  Shield,
  Zap,
  Brain,
  Target,
  Clock,
  Copy,
  CheckCircle,
  AlertCircle,
  Sparkles,
  FileCheck,
  Trophy,
  Activity,
  Dna,
  Link2,
  ExternalLink
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const getExplorerUrl = (network: string, txHash: string): string | null => {
  if (network === 'base-sepolia' && txHash.length === 66) {
    return `https://sepolia.basescan.org/tx/${txHash}`;
  }
  if (network === 'base' && txHash.length === 66) {
    return `https://basescan.org/tx/${txHash}`;
  }
  return null;
};

interface OnChainProof {
  badgeId: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
  network: string;
  verified: boolean;
}

interface AgentIdentity {
  agentId: string;
  agentName: string;
  generation: number;
  creditScore: number;
  badges: OnChainProof[];
  totalEvolutions: number;
  totalSuccesses: number;
  totalFailures: number;
  accuracyRate: number;
  lastEvolutionTimestamp: number;
  atpTokenId?: string;
}

interface BlockchainStatus {
  enabled: boolean;
  network: string;
  pendingMints: number;
  totalMinted: number;
  totalAgents: number;
  isLive?: boolean;
  contractAddress?: string;
  walletAddress?: string | null;
}

function ProofCard({ proof, index }: { proof: OnChainProof; index: number }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copyTxHash = () => {
    navigator.clipboard.writeText(proof.transactionHash);
    setCopied(true);
    toast({ title: "Copied", description: "Transaction hash copied to clipboard" });
    setTimeout(() => setCopied(false), 2000);
  };

  const truncateHash = (hash: string) => {
    if (hash.length <= 16) return hash;
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 200 }}
      className="relative p-4 rounded-lg border border-primary/20 bg-primary/5 overflow-visible"
      data-testid={`card-proof-${proof.badgeId}`}
    >
      <motion.div
        className="absolute -inset-px rounded-lg bg-gradient-to-br from-white/5 to-transparent"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 1 }}
      />

      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <motion.div
            className="p-2 rounded-full bg-background/50"
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 4, repeat: Infinity, repeatDelay: 2 }}
          >
            <Award className="w-5 h-5 text-primary" />
          </motion.div>
          <div>
            <p className="font-medium">Neuron Badge</p>
            <p className="text-xs text-muted-foreground">
              {new Date(proof.timestamp).toLocaleString()}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge variant={proof.verified ? "default" : "secondary"} className="text-xs">
            {proof.verified ? "Verified" : "Pending"}
          </Badge>
          <Badge variant="outline" className="text-xs capitalize">
            {proof.network}
          </Badge>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Badge ID</span>
          <code className="font-mono text-xs bg-background/50 px-1.5 py-0.5 rounded truncate max-w-[140px]">
            {proof.badgeId}
          </code>
        </div>

        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Block</span>
          <span className="font-mono text-foreground">
            {proof.blockNumber.toLocaleString()}
          </span>
        </div>

        <div className="flex items-center justify-between text-xs gap-2">
          <span className="text-muted-foreground">Tx Hash</span>
          <div className="flex items-center gap-1">
            <code className="font-mono text-xs bg-background/50 px-1.5 py-0.5 rounded">
              {truncateHash(proof.transactionHash)}
            </code>
            <Button 
              size="icon" 
              variant="ghost" 
              className="h-6 w-6" 
              onClick={copyTxHash}
              data-testid={`button-copy-tx-${proof.badgeId}`}
            >
              {copied ? <CheckCircle className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </Button>
            {getExplorerUrl(proof.network, proof.transactionHash) && (
              <Button 
                size="icon" 
                variant="ghost" 
                className="h-6 w-6" 
                asChild
                data-testid={`button-explorer-${proof.badgeId}`}
              >
                <a 
                  href={getExplorerUrl(proof.network, proof.transactionHash) || '#'} 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </Button>
            )}
          </div>
        </div>
      </div>

      <motion.div
        className="absolute top-2 right-2"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: index * 0.05 + 0.2, type: "spring" }}
      >
        <motion.div
          animate={{ 
            boxShadow: ["0 0 0 0 rgba(var(--primary), 0.4)", "0 0 0 8px rgba(var(--primary), 0)"]
          }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-2 h-2 rounded-full bg-green-500"
        />
      </motion.div>
    </motion.div>
  );
}

function AgentResume({ identity }: { identity: AgentIdentity }) {
  const successRate = identity.totalSuccesses + identity.totalFailures > 0
    ? (identity.totalSuccesses / (identity.totalSuccesses + identity.totalFailures)) * 100
    : 0;

  const totalBadges = identity.badges?.length || 0;
  const level = Math.floor(totalBadges / 5) + 1;
  const badgesToNextLevel = 5 - (totalBadges % 5);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center gap-4 mb-6">
        <motion.div
          className="w-16 h-16 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/20"
          animate={{ 
            boxShadow: ["0 0 20px rgba(var(--primary), 0.2)", "0 0 40px rgba(var(--primary), 0.4)", "0 0 20px rgba(var(--primary), 0.2)"]
          }}
          transition={{ duration: 3, repeat: Infinity }}
        >
          <Brain className="w-8 h-8 text-primary" />
        </motion.div>
        <div>
          <h3 className="text-xl font-bold">{identity.agentName}</h3>
          <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
            <Badge variant="outline">Generation {identity.generation}</Badge>
            {identity.atpTokenId && (
              <Badge variant="secondary" className="text-xs">
                ATP: {identity.atpTokenId.slice(0, 8)}...
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          className="p-4 rounded-lg bg-gradient-to-br from-yellow-500/10 to-transparent border border-yellow-500/20"
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-xs text-muted-foreground">Total Badges</span>
          </div>
          <motion.p 
            className="text-2xl font-bold"
            key={totalBadges}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
          >
            {totalBadges}
          </motion.p>
        </motion.div>

        <motion.div
          className="p-4 rounded-lg bg-gradient-to-br from-green-500/10 to-transparent border border-green-500/20"
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-green-500" />
            <span className="text-xs text-muted-foreground">Credit Score</span>
          </div>
          <motion.p 
            className="text-2xl font-bold"
            key={identity.creditScore}
            initial={{ scale: 1.2 }}
            animate={{ scale: 1 }}
          >
            {identity.creditScore}
          </motion.p>
        </motion.div>

        <motion.div
          className="p-4 rounded-lg bg-gradient-to-br from-blue-500/10 to-transparent border border-blue-500/20"
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-blue-500" />
            <span className="text-xs text-muted-foreground">Accuracy</span>
          </div>
          <p className="text-2xl font-bold">{identity.accuracyRate.toFixed(1)}%</p>
        </motion.div>

        <motion.div
          className="p-4 rounded-lg bg-gradient-to-br from-purple-500/10 to-transparent border border-purple-500/20"
          whileHover={{ scale: 1.02 }}
        >
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-4 h-4 text-purple-500" />
            <span className="text-xs text-muted-foreground">Success Rate</span>
          </div>
          <p className="text-2xl font-bold">{successRate.toFixed(1)}%</p>
        </motion.div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-muted-foreground mb-1">Total Evolutions</p>
          <p className="font-semibold text-lg">{identity.totalEvolutions}</p>
        </div>
        <div className="p-3 rounded-lg bg-muted/50">
          <p className="text-muted-foreground mb-1">Win/Loss</p>
          <p className="font-semibold text-lg">
            <span className="text-green-500">{identity.totalSuccesses}</span>
            {" / "}
            <span className="text-red-500">{identity.totalFailures}</span>
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Experience Progress</span>
          <span className="font-medium">Level {level}</span>
        </div>
        <Progress value={((5 - badgesToNextLevel) / 5) * 100} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {badgesToNextLevel} badges until next level
        </p>
      </div>

      {identity.lastEvolutionTimestamp && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-4 h-4" />
          <span>
            Last evolution: {new Date(identity.lastEvolutionTimestamp).toLocaleString()}
          </span>
        </div>
      )}
    </motion.div>
  );
}

export function EvolutionProofs() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const { data: status, isLoading: statusLoading } = useQuery<BlockchainStatus>({
    queryKey: ["/api/blockchain/status"],
    refetchInterval: 30000,
  });

  const { data: identities, isLoading: identitiesLoading } = useQuery<AgentIdentity[]>({
    queryKey: ["/api/blockchain/identities"],
    refetchInterval: 10000,
  });

  const { data: allProofs, isLoading: proofsLoading } = useQuery<OnChainProof[]>({
    queryKey: ["/api/blockchain/proofs"],
    refetchInterval: 10000,
  });

  const selectedIdentity = identities?.find(i => i.agentName === selectedAgent);

  useEffect(() => {
    if (identities && identities.length > 0 && !selectedAgent) {
      setSelectedAgent(identities[0].agentName);
    }
  }, [identities, selectedAgent]);

  if (statusLoading || identitiesLoading || proofsLoading) {
    return (
      <Card className="overflow-visible">
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Link2 className="w-8 h-8 text-muted-foreground" />
            </motion.div>
            <p className="text-muted-foreground">Loading on-chain data...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isConnected = status?.enabled;
  const proofCount = allProofs?.length || 0;
  const agentCount = identities?.length || 0;

  return (
    <div className="space-y-6">
      <Card className="overflow-visible border-primary/20">
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                <Link2 className="w-5 h-5 text-primary" />
              </motion.div>
              On-Chain Evolution Proofs
            </CardTitle>
            <CardDescription>
              Soulbound Neuron Badges proving agent learning and evolution
            </CardDescription>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Badge 
              variant={isConnected ? "default" : "secondary"}
              className="flex items-center gap-1"
            >
              {isConnected ? (
                <>
                  <motion.div
                    className="w-2 h-2 rounded-full bg-green-500"
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                  />
                  Live
                </>
              ) : (
                <>
                  <AlertCircle className="w-3 h-3" />
                  Simulated
                </>
              )}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {status?.network || "base"} network
            </Badge>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="proofs" className="w-full">
            <TabsList className="grid w-full grid-cols-3 mb-6">
              <TabsTrigger value="proofs" className="flex items-center gap-2" data-testid="tab-proofs">
                <FileCheck className="w-4 h-4" />
                All Proofs ({proofCount})
              </TabsTrigger>
              <TabsTrigger value="agents" className="flex items-center gap-2" data-testid="tab-agents">
                <Brain className="w-4 h-4" />
                Agents ({agentCount})
              </TabsTrigger>
              <TabsTrigger value="resume" className="flex items-center gap-2" data-testid="tab-resume">
                <Trophy className="w-4 h-4" />
                Resume
              </TabsTrigger>
            </TabsList>

            <TabsContent value="proofs">
              {!allProofs || allProofs.length === 0 ? (
                <div className="text-center py-12">
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <Award className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  </motion.div>
                  <h3 className="text-lg font-medium mb-2">No On-Chain Proofs Yet</h3>
                  <p className="text-muted-foreground text-sm">
                    Evolution badges will appear here as agents learn and mutate.
                  </p>
                  <p className="text-muted-foreground text-sm mt-2">
                    Click "Generate Evolution" on the Timeline tab to create demo data.
                  </p>
                </div>
              ) : (
                <ScrollArea className="h-[500px] pr-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <AnimatePresence mode="popLayout">
                      {allProofs.map((proof, index) => (
                        <ProofCard key={proof.badgeId} proof={proof} index={index} />
                      ))}
                    </AnimatePresence>
                  </div>
                </ScrollArea>
              )}
            </TabsContent>

            <TabsContent value="agents">
              {!identities || identities.length === 0 ? (
                <div className="text-center py-12">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ duration: 4, repeat: Infinity }}
                  >
                    <Brain className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  </motion.div>
                  <h3 className="text-lg font-medium mb-2">No Registered Agents</h3>
                  <p className="text-muted-foreground text-sm">
                    Agent identities will be registered as they evolve.
                  </p>
                  <p className="text-muted-foreground text-sm mt-2">
                    Generate evolution events to see agent identities here.
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence mode="popLayout">
                    {identities.map((identity, index) => (
                      <motion.div
                        key={identity.agentId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ delay: index * 0.1 }}
                        className={`p-4 rounded-lg border cursor-pointer transition-all ${
                          selectedAgent === identity.agentName
                            ? "border-primary bg-primary/5"
                            : "border-border hover-elevate"
                        }`}
                        onClick={() => setSelectedAgent(identity.agentName)}
                        data-testid={`card-agent-identity-${identity.agentName}`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <motion.div
                            className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center"
                            animate={{ rotate: selectedAgent === identity.agentName ? [0, 360] : 0 }}
                            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                          >
                            <Brain className="w-5 h-5 text-primary" />
                          </motion.div>
                          <div>
                            <p className="font-medium">{identity.agentName}</p>
                            <Badge variant="outline" className="text-xs">
                              Gen {identity.generation}
                            </Badge>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="p-2 rounded bg-background/50">
                            <p className="text-xs text-muted-foreground">Badges</p>
                            <p className="font-semibold">{identity.badges?.length || 0}</p>
                          </div>
                          <div className="p-2 rounded bg-background/50">
                            <p className="text-xs text-muted-foreground">Credits</p>
                            <p className="font-semibold">{identity.creditScore}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </TabsContent>

            <TabsContent value="resume">
              {!selectedIdentity ? (
                <div className="text-center py-12">
                  <Trophy className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">Select an Agent</h3>
                  <p className="text-muted-foreground text-sm">
                    Choose an agent from the Agents tab to view their resume
                  </p>
                </div>
              ) : (
                <AgentResume identity={selectedIdentity} />
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card className="overflow-visible">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Blockchain Sync Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground mb-1">Mode</p>
              <Badge variant={status?.enabled ? "default" : "secondary"}>
                {status?.enabled ? "Live" : "Simulated"}
              </Badge>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Network</p>
              <p className="font-medium capitalize">{status?.network || "base"}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Pending Mints</p>
              <p className="font-medium">{status?.pendingMints || 0}</p>
            </div>
            <div>
              <p className="text-muted-foreground mb-1">Total Minted</p>
              <p className="font-medium">{status?.totalMinted || proofCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
