import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Shield, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Users, 
  FileCheck,
  Wallet,
  Timer,
  Vote,
  Lock,
  Unlock,
  PenLine
} from "lucide-react";
import type { GovernanceProposal, GovernanceVote, MultiSigThreshold } from "@shared/schema";

interface ProposalWithVotes extends GovernanceProposal {
  votes?: GovernanceVote[];
  voteSummary?: {
    approve: number;
    reject: number;
    abstain: number;
    total: number;
  };
}

interface GovernanceStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  executed: number;
  expired: number;
  totalValuePending: number;
  totalValueExecuted: number;
}

function getStatusColor(status: GovernanceProposal["status"]): string {
  switch (status) {
    case "pending": return "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300";
    case "approved": return "bg-blue-500/20 text-blue-700 dark:text-blue-300";
    case "executed": return "bg-green-500/20 text-green-700 dark:text-green-300";
    case "rejected": return "bg-red-500/20 text-red-700 dark:text-red-300";
    case "expired": return "bg-muted text-muted-foreground";
    default: return "bg-muted";
  }
}

function formatTimeRemaining(timelockEnd: number): string {
  const now = Date.now();
  const remaining = timelockEnd - now;
  
  if (remaining <= 0) return "Ready to execute";
  
  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
  
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h remaining`;
  }
  
  return `${hours}h ${minutes}m remaining`;
}

function formatValue(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(2)}M`;
  } else if (value >= 1000) {
    return `$${(value / 1000).toFixed(1)}K`;
  }
  return `$${value}`;
}

export function GovernanceDashboard() {
  const { toast } = useToast();
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newProposal, setNewProposal] = useState({
    title: "",
    description: "",
    proposer: "",
    transactionValue: "",
    transactionTo: "",
    transactionData: "0x",
    chain: "ethereum" as const,
    threshold: "2-of-3" as MultiSigThreshold,
    signers: ["", "", ""],
  });

  const { data: proposals = [], isLoading: proposalsLoading } = useQuery<ProposalWithVotes[]>({
    queryKey: ["/api/governance/proposals"],
    refetchInterval: 10000,
  });

  const { data: stats } = useQuery<GovernanceStats>({
    queryKey: ["/api/governance/stats"],
    refetchInterval: 30000,
  });

  const { data: executableProposals = [] } = useQuery<GovernanceProposal[]>({
    queryKey: ["/api/governance/executable"],
    refetchInterval: 10000,
  });

  const createProposalMutation = useMutation({
    mutationFn: async (data: typeof newProposal) => {
      const signers = data.signers.filter(s => s.trim() !== "");
      const res = await apiRequest("POST", "/api/governance/proposals", {
        ...data,
        transactionValue: parseInt(data.transactionValue) || 0,
        signers,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/stats"] });
      setIsCreateOpen(false);
      setNewProposal({
        title: "",
        description: "",
        proposer: "",
        transactionValue: "",
        transactionTo: "",
        transactionData: "0x",
        chain: "ethereum",
        threshold: "2-of-3",
        signers: ["", "", ""],
      });
      toast({
        title: "Proposal Created",
        description: "Your governance proposal has been created successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create proposal",
        variant: "destructive",
      });
    },
  });

  const signProposalMutation = useMutation({
    mutationFn: async ({ proposalId, signerAddress }: { proposalId: string; signerAddress: string }) => {
      const mockSignature = "0x" + Array(128).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join("");
      const res = await apiRequest("POST", `/api/governance/proposals/${proposalId}/sign`, { 
        signerAddress, 
        signature: mockSignature 
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/proposals"] });
      toast({
        title: "Proposal Signed",
        description: "Your signature has been added to the proposal.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sign proposal",
        variant: "destructive",
      });
    },
  });

  const executeProposalMutation = useMutation({
    mutationFn: async (proposalId: string) => {
      const res = await apiRequest("POST", `/api/governance/proposals/${proposalId}/execute`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/governance/proposals"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/governance/executable"] });
      toast({
        title: "Proposal Executed",
        description: "The proposal has been executed successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to execute proposal",
        variant: "destructive",
      });
    },
  });

  const pendingProposals = proposals.filter(p => p.status === "pending");
  const approvedProposals = proposals.filter(p => p.status === "approved");

  const updateSignerCount = (threshold: MultiSigThreshold) => {
    const counts: Record<MultiSigThreshold, number> = {
      "2-of-3": 3,
      "3-of-5": 5,
      "4-of-7": 7,
    };
    setNewProposal(prev => ({
      ...prev,
      threshold,
      signers: Array(counts[threshold]).fill(""),
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold" data-testid="text-governance-title">Multi-Sig Governance</h2>
          <p className="text-muted-foreground">Manage high-value transactions with multi-signature approvals</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-proposal">
              <PenLine className="mr-2 h-4 w-4" />
              Create Proposal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Governance Proposal</DialogTitle>
              <DialogDescription>
                Create a new proposal for high-value transaction approval
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="Proposal title"
                  value={newProposal.title}
                  onChange={(e) => setNewProposal(prev => ({ ...prev, title: e.target.value }))}
                  data-testid="input-proposal-title"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the purpose of this transaction"
                  value={newProposal.description}
                  onChange={(e) => setNewProposal(prev => ({ ...prev, description: e.target.value }))}
                  data-testid="input-proposal-description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="proposer">Proposer Address</Label>
                  <Input
                    id="proposer"
                    placeholder="0x..."
                    value={newProposal.proposer}
                    onChange={(e) => setNewProposal(prev => ({ ...prev, proposer: e.target.value }))}
                    data-testid="input-proposal-proposer"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="value">Transaction Value (USD)</Label>
                  <Input
                    id="value"
                    type="number"
                    placeholder="50000"
                    value={newProposal.transactionValue}
                    onChange={(e) => setNewProposal(prev => ({ ...prev, transactionValue: e.target.value }))}
                    data-testid="input-proposal-value"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="to">Transaction To</Label>
                  <Input
                    id="to"
                    placeholder="0x..."
                    value={newProposal.transactionTo}
                    onChange={(e) => setNewProposal(prev => ({ ...prev, transactionTo: e.target.value }))}
                    data-testid="input-proposal-to"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="chain">Chain</Label>
                  <Select
                    value={newProposal.chain}
                    onValueChange={(value) => setNewProposal(prev => ({ ...prev, chain: value as typeof prev.chain }))}
                  >
                    <SelectTrigger data-testid="select-proposal-chain">
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
              </div>
              <div className="grid gap-2">
                <Label htmlFor="threshold">Approval Threshold</Label>
                <Select
                  value={newProposal.threshold}
                  onValueChange={(value) => updateSignerCount(value as MultiSigThreshold)}
                >
                  <SelectTrigger data-testid="select-proposal-threshold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2-of-3">2-of-3 Signatures</SelectItem>
                    <SelectItem value="3-of-5">3-of-5 Signatures</SelectItem>
                    <SelectItem value="4-of-7">4-of-7 Signatures</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Signers</Label>
                {newProposal.signers.map((signer, index) => (
                  <Input
                    key={index}
                    placeholder={`Signer ${index + 1} address (0x...)`}
                    value={signer}
                    onChange={(e) => {
                      const newSigners = [...newProposal.signers];
                      newSigners[index] = e.target.value;
                      setNewProposal(prev => ({ ...prev, signers: newSigners }));
                    }}
                    data-testid={`input-proposal-signer-${index}`}
                  />
                ))}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)} data-testid="button-cancel-proposal">
                Cancel
              </Button>
              <Button 
                onClick={() => createProposalMutation.mutate(newProposal)}
                disabled={createProposalMutation.isPending}
                data-testid="button-submit-proposal"
              >
                {createProposalMutation.isPending ? "Creating..." : "Create Proposal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Proposals</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-total-proposals">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.executed || 0} executed
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-pending-proposals">{stats?.pending || 0}</div>
            <p className="text-xs text-muted-foreground">
              {formatValue(stats?.totalValuePending || 0)} pending
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ready to Execute</CardTitle>
            <Unlock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-executable-proposals">{executableProposals.length}</div>
            <p className="text-xs text-muted-foreground">
              Timelock expired
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Value Executed</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="text-value-executed">{formatValue(stats?.totalValueExecuted || 0)}</div>
            <p className="text-xs text-muted-foreground">
              All time
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pending" className="space-y-4">
        <TabsList>
          <TabsTrigger value="pending" data-testid="tab-pending">
            Pending ({pendingProposals.length})
          </TabsTrigger>
          <TabsTrigger value="approved" data-testid="tab-approved">
            Approved ({approvedProposals.length})
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="tab-all">
            All Proposals
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="space-y-4">
          {proposalsLoading ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Loading proposals...
              </CardContent>
            </Card>
          ) : pendingProposals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No pending proposals
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4 pr-4">
                {pendingProposals.map((proposal) => (
                  <ProposalCard 
                    key={proposal.id} 
                    proposal={proposal}
                    onSign={(signerAddress) => signProposalMutation.mutate({ proposalId: proposal.id, signerAddress })}
                    isSignPending={signProposalMutation.isPending}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {approvedProposals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No approved proposals awaiting execution
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4 pr-4">
                {approvedProposals.map((proposal) => (
                  <ProposalCard 
                    key={proposal.id} 
                    proposal={proposal}
                    onExecute={() => executeProposalMutation.mutate(proposal.id)}
                    isExecutable={executableProposals.some(p => p.id === proposal.id)}
                    isExecutePending={executeProposalMutation.isPending}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        <TabsContent value="all" className="space-y-4">
          {proposals.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No proposals found
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-4 pr-4">
                {proposals.map((proposal) => (
                  <ProposalCard 
                    key={proposal.id} 
                    proposal={proposal}
                    onSign={(signerAddress) => signProposalMutation.mutate({ proposalId: proposal.id, signerAddress })}
                    onExecute={() => executeProposalMutation.mutate(proposal.id)}
                    isExecutable={executableProposals.some(p => p.id === proposal.id)}
                    isSignPending={signProposalMutation.isPending}
                    isExecutePending={executeProposalMutation.isPending}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

interface ProposalCardProps {
  proposal: ProposalWithVotes;
  onSign?: (signerAddress: string) => void;
  onExecute?: () => void;
  isExecutable?: boolean;
  isSignPending?: boolean;
  isExecutePending?: boolean;
}

function ProposalCard({ 
  proposal, 
  onSign, 
  onExecute, 
  isExecutable,
  isSignPending,
  isExecutePending 
}: ProposalCardProps) {
  const [signAddress, setSignAddress] = useState("");
  const signatureProgress = (proposal.currentSignatures / proposal.requiredSignatures) * 100;
  const timelockStatus = formatTimeRemaining(new Date(proposal.timelockEnd).getTime());
  const isTimelockExpired = new Date(proposal.timelockEnd).getTime() <= Date.now();

  return (
    <Card data-testid={`card-proposal-${proposal.id}`}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-lg truncate" data-testid={`text-proposal-title-${proposal.id}`}>
              {proposal.title}
            </CardTitle>
            <CardDescription className="line-clamp-2">
              {proposal.description}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={getStatusColor(proposal.status)} data-testid={`badge-proposal-status-${proposal.id}`}>
              {proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
            </Badge>
            <Badge variant="outline">
              {proposal.chain.charAt(0).toUpperCase() + proposal.chain.slice(1)}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Value</p>
            <p className="font-medium" data-testid={`text-proposal-value-${proposal.id}`}>
              {formatValue(proposal.transactionValue)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Threshold</p>
            <p className="font-medium">{proposal.threshold}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Signatures</p>
            <p className="font-medium" data-testid={`text-proposal-signatures-${proposal.id}`}>
              {proposal.currentSignatures}/{proposal.requiredSignatures}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Timelock</p>
            <p className={`font-medium ${isTimelockExpired ? "text-green-600 dark:text-green-400" : "text-yellow-600 dark:text-yellow-400"}`}>
              {timelockStatus}
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Approval Progress</span>
            <span>{signatureProgress.toFixed(0)}%</span>
          </div>
          <Progress value={signatureProgress} className="h-2" />
        </div>

        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Signers</p>
          <div className="flex flex-wrap gap-2">
            {proposal.signers.map((signer, index) => (
              <Badge 
                key={index}
                variant={signer.approved ? "default" : "outline"}
                className="gap-1"
              >
                {signer.approved ? (
                  <CheckCircle2 className="h-3 w-3" />
                ) : (
                  <Clock className="h-3 w-3" />
                )}
                {signer.address.slice(0, 6)}...{signer.address.slice(-4)}
              </Badge>
            ))}
          </div>
        </div>

        {proposal.status === "pending" && onSign && (
          <div className="flex items-center gap-2 pt-2 flex-wrap">
            <Input
              placeholder="Your signer address (0x...)"
              value={signAddress}
              onChange={(e) => setSignAddress(e.target.value)}
              className="flex-1 min-w-[200px]"
              data-testid={`input-sign-address-${proposal.id}`}
            />
            <Button
              onClick={() => {
                onSign(signAddress);
                setSignAddress("");
              }}
              disabled={!signAddress || isSignPending}
              data-testid={`button-sign-proposal-${proposal.id}`}
            >
              {isSignPending ? "Signing..." : "Sign"}
            </Button>
          </div>
        )}

        {proposal.status === "approved" && onExecute && (
          <div className="pt-2">
            <Button
              onClick={onExecute}
              disabled={!isExecutable || isExecutePending}
              className="w-full"
              data-testid={`button-execute-proposal-${proposal.id}`}
            >
              {isExecutePending ? "Executing..." : isExecutable ? "Execute Proposal" : "Timelock Active"}
              {!isExecutable && <Lock className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
