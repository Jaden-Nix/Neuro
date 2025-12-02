import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { 
  Gavel, 
  Users, 
  Vote, 
  MessageCircle, 
  Brain, 
  CheckCircle, 
  XCircle, 
  Pause,
  Zap,
  Shield,
  Search,
  Target,
  Play,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Lightbulb,
  Database,
  Clock,
  BarChart3,
  Scale,
  ThumbsUp,
  ThumbsDown,
  ExternalLink
} from "lucide-react";
import type { ParliamentSession, ParliamentDebateEntry, ParliamentVote, MetaSummary } from "@shared/schema";

type AgentTypeKey = "meta" | "scout" | "risk" | "execution";

const agentIcons: Record<AgentTypeKey, typeof Brain> = {
  meta: Brain,
  scout: Search,
  risk: Shield,
  execution: Target,
};

const agentColors: Record<AgentTypeKey, string> = {
  meta: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  scout: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  risk: "bg-red-500/20 text-red-400 border-red-500/30",
  execution: "bg-green-500/20 text-green-400 border-green-500/30",
};

const positionStyles: Record<string, string> = {
  for: "border-l-4 border-l-green-500",
  against: "border-l-4 border-l-red-500",
  clarification: "border-l-4 border-l-yellow-500",
};

const dataSourceIcons: Record<string, string> = {
  "DefiLlama": "bg-emerald-500/20 text-emerald-400",
  "Coinbase": "bg-blue-500/20 text-blue-400",
  "Dune": "bg-orange-500/20 text-orange-400",
  "The Graph": "bg-purple-500/20 text-purple-400",
  "Nansen": "bg-pink-500/20 text-pink-400",
  "Token Terminal": "bg-cyan-500/20 text-cyan-400",
  "L2Beat": "bg-indigo-500/20 text-indigo-400",
  "Coingecko": "bg-yellow-500/20 text-yellow-400",
  "Immunefi": "bg-red-500/20 text-red-400",
  "CertiK": "bg-sky-500/20 text-sky-400",
  "OpenZeppelin": "bg-teal-500/20 text-teal-400",
  "Chainalysis": "bg-violet-500/20 text-violet-400",
  "Flashbots": "bg-amber-500/20 text-amber-400",
  "BlockNative": "bg-lime-500/20 text-lime-400",
  "Alchemy": "bg-fuchsia-500/20 text-fuchsia-400",
  "Etherscan": "bg-slate-500/20 text-slate-400",
};

function AgentAvatar({ agentType }: { agentType: AgentTypeKey }) {
  const Icon = agentIcons[agentType] || Brain;
  return (
    <div className={`flex items-center justify-center w-10 h-10 rounded-full border ${agentColors[agentType]}`}>
      <Icon className="w-5 h-5" />
    </div>
  );
}

function DataSourceBadges({ sources }: { sources?: string[] }) {
  if (!sources || sources.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1 mt-2">
      {sources.slice(0, 3).map((source, idx) => (
        <Badge 
          key={idx} 
          variant="outline" 
          className={`text-xs ${dataSourceIcons[source] || "bg-muted"}`}
        >
          <Database className="w-2.5 h-2.5 mr-1" />
          {source}
        </Badge>
      ))}
    </div>
  );
}

function ExpectedOutcomePanel({ outcome }: { outcome?: ParliamentVote["expectedOutcome"] }) {
  if (!outcome) return null;
  
  return (
    <div className="mt-3 p-3 rounded-lg bg-muted/50 border">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Expected Outcome</span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-3 h-3 text-green-400" />
          <span className="text-muted-foreground">Return:</span>
          <span className="font-medium text-green-400">+{outcome.returnPercent}%</span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span className="text-muted-foreground">Risk:</span>
          <span className="font-medium text-amber-400">{outcome.riskScore}%</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="w-3 h-3 text-blue-400" />
          <span className="text-muted-foreground">Horizon:</span>
          <span className="font-medium">{outcome.timeHorizon}</span>
        </div>
        <div className="flex items-center gap-2">
          <Scale className="w-3 h-3 text-purple-400" />
          <span className="text-muted-foreground">Confidence:</span>
          <span className="font-medium">{outcome.confidence}%</span>
        </div>
      </div>
    </div>
  );
}

function ProsConsList({ pros, cons }: { pros?: string[]; cons?: string[] }) {
  if ((!pros || pros.length === 0) && (!cons || cons.length === 0)) return null;
  
  return (
    <div className="mt-3 grid grid-cols-2 gap-3">
      {pros && pros.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-green-400 font-medium">
            <ThumbsUp className="w-3 h-3" />
            Pros
          </div>
          {pros.map((pro, idx) => (
            <p key={idx} className="text-xs text-muted-foreground pl-4">+ {pro}</p>
          ))}
        </div>
      )}
      {cons && cons.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center gap-1 text-xs text-red-400 font-medium">
            <ThumbsDown className="w-3 h-3" />
            Cons
          </div>
          {cons.map((con, idx) => (
            <p key={idx} className="text-xs text-muted-foreground pl-4">- {con}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function DebateStream({ debates, votes }: { debates: ParliamentDebateEntry[]; votes: ParliamentVote[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [debates, votes]);

  if (debates.length === 0 && votes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
        <p>Waiting for debate to begin...</p>
        <p className="text-sm opacity-75">Agents are analyzing the proposal</p>
      </div>
    );
  }

  const votesByAgent = new Map(votes.map(v => [v.agentType, v]));

  return (
    <ScrollArea ref={scrollRef} className="h-[500px] pr-4">
      <div className="space-y-4">
        {debates.map((entry, idx) => {
          const vote = votesByAgent.get(entry.agentType);
          return (
            <div
              key={idx}
              className={`p-4 rounded-lg bg-muted/30 ${positionStyles[entry.position]} animate-in fade-in slide-in-from-left-2 duration-300`}
              data-testid={`debate-entry-${idx}`}
            >
              <div className="flex items-start gap-3">
                <AgentAvatar agentType={entry.agentType as AgentTypeKey} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="font-semibold capitalize">{entry.agentType} Agent</span>
                    <Badge variant="outline" className={entry.position === "for" ? "text-green-400" : entry.position === "against" ? "text-red-400" : "text-yellow-400"}>
                      {entry.position}
                    </Badge>
                    {vote && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Badge variant={vote.vote === "approve" ? "default" : vote.vote === "reject" ? "destructive" : "secondary"}>
                              {vote.vote} ({vote.confidence}%)
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Weighted Vote Power: {(vote.voteWeight || 1).toFixed(2)}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed">{entry.statement}</p>
                  
                  <DataSourceBadges sources={entry.dataSourcesUsed} />
                  
                  {entry.simulationResults && (
                    <div className="mt-2 p-2 rounded bg-background/50 border text-xs">
                      <span className="text-muted-foreground">Simulation: </span>
                      <span className="font-medium">{entry.simulationResults.scenarioName}</span>
                      <span className="mx-2">-</span>
                      <span className={entry.simulationResults.outcome.includes("loss") ? "text-red-400" : "text-green-400"}>
                        {entry.simulationResults.outcome}
                      </span>
                    </div>
                  )}

                  {vote && <ProsConsList pros={vote.pros} cons={vote.cons} />}
                  {vote && <ExpectedOutcomePanel outcome={vote.expectedOutcome} />}
                  
                  {vote?.alternativeSuggestions && vote.alternativeSuggestions.length > 0 && (
                    <div className="mt-3 p-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <div className="flex items-center gap-1 text-xs text-amber-400 font-medium mb-1">
                        <Lightbulb className="w-3 h-3" />
                        Suggested Alternatives
                      </div>
                      {vote.alternativeSuggestions.map((alt, i) => (
                        <p key={i} className="text-xs text-muted-foreground">{i + 1}. {alt}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function MetaSummaryPanel({ summary }: { summary?: MetaSummary }) {
  if (!summary) return null;
  
  const recommendationColors = {
    approve: "bg-green-500/20 text-green-400 border-green-500/50",
    reject: "bg-red-500/20 text-red-400 border-red-500/50",
    defer: "bg-yellow-500/20 text-yellow-400 border-yellow-500/50",
  };
  
  const riskColors = {
    low: "text-green-400",
    medium: "text-yellow-400",
    high: "text-orange-400",
    critical: "text-red-400",
  };

  return (
    <Card className="border-2 border-purple-500/30 bg-purple-500/5">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="w-5 h-5 text-purple-400" />
          Meta Orchestration Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`p-4 rounded-lg border-2 ${recommendationColors[summary.recommendation]}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-lg capitalize">{summary.recommendation}</span>
            <Badge variant="outline">
              Confidence: {summary.confidenceScore}%
            </Badge>
          </div>
          <p className="text-sm opacity-90">{summary.synthesis}</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Vote className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">Voting Analysis</span>
            </div>
            <div className="text-sm space-y-1">
              <p>Weighted Approval: <span className="font-medium">{summary.weightedApprovalPct.toFixed(1)}%</span></p>
              <p>Quorum Status: <span className={summary.quorumReached ? "text-green-400" : "text-red-400"}>{summary.quorumReached ? "Reached" : "Not Reached"}</span></p>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className={`w-4 h-4 ${riskColors[summary.riskAssessment.overallRisk]}`} />
              <span className="text-sm font-medium">Risk Assessment</span>
            </div>
            <div>
              <Badge className={riskColors[summary.riskAssessment.overallRisk]}>
                {summary.riskAssessment.overallRisk.toUpperCase()}
              </Badge>
              {summary.riskAssessment.factors.slice(0, 2).map((factor, idx) => (
                <p key={idx} className="text-xs text-muted-foreground mt-1">{factor}</p>
              ))}
            </div>
          </div>
        </div>

        {summary.conflicts.length > 0 && (
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-medium text-amber-400">Detected Conflicts</span>
            </div>
            {summary.conflicts.map((conflict, idx) => (
              <p key={idx} className="text-xs text-muted-foreground">{conflict}</p>
            ))}
          </div>
        )}

        {summary.suggestedAmendments.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-medium">Suggested Amendments</span>
            </div>
            <div className="space-y-1">
              {summary.suggestedAmendments.map((amendment, idx) => (
                <p key={idx} className="text-sm text-muted-foreground pl-4">
                  {idx + 1}. {amendment}
                </p>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function VotingPanel({ votes, quorum }: { votes: ParliamentVote[]; quorum: number }) {
  const approves = votes.filter(v => v.vote === "approve").length;
  const rejects = votes.filter(v => v.vote === "reject").length;
  const abstains = votes.filter(v => v.vote === "abstain").length;
  const total = votes.length;
  const progress = (total / quorum) * 100;
  
  const totalWeight = votes.reduce((sum, v) => sum + (v.voteWeight || 1), 0);
  const approveWeight = votes.filter(v => v.vote === "approve").reduce((sum, v) => sum + (v.voteWeight || 1), 0);
  const rejectWeight = votes.filter(v => v.vote === "reject").reduce((sum, v) => sum + (v.voteWeight || 1), 0);
  const weightedApprovalPct = totalWeight > 0 ? (approveWeight / totalWeight) * 100 : 0;

  return (
    <Card className="border-2">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Vote className="w-5 h-5" />
          Voting Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Quorum Progress</span>
            <span>{total}/{quorum}</span>
          </div>
          <Progress value={Math.min(progress, 100)} className="h-2" />
        </div>
        
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/30">
            <CheckCircle className="w-6 h-6 mx-auto mb-1 text-green-400" />
            <p className="text-2xl font-bold text-green-400">{approves}</p>
            <p className="text-xs text-muted-foreground">Approve</p>
          </div>
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30">
            <XCircle className="w-6 h-6 mx-auto mb-1 text-red-400" />
            <p className="text-2xl font-bold text-red-400">{rejects}</p>
            <p className="text-xs text-muted-foreground">Reject</p>
          </div>
          <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
            <Pause className="w-6 h-6 mx-auto mb-1 text-yellow-400" />
            <p className="text-2xl font-bold text-yellow-400">{abstains}</p>
            <p className="text-xs text-muted-foreground">Abstain</p>
          </div>
        </div>

        {votes.length > 0 && (
          <div className="p-3 rounded-lg bg-muted/50 space-y-2">
            <p className="text-sm font-medium">Weighted Analysis</p>
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-primary" />
              <div className="flex-1">
                <Progress 
                  value={weightedApprovalPct} 
                  className="h-2" 
                />
              </div>
              <span className="text-sm font-medium">{weightedApprovalPct.toFixed(1)}%</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Approve Weight: {approveWeight.toFixed(2)}</span>
              <span>Reject Weight: {rejectWeight.toFixed(2)}</span>
            </div>
          </div>
        )}

        {votes.length > 0 && (
          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium">Vote Details</p>
            {votes.map((vote, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                <div className="flex items-center gap-2">
                  <AgentAvatar agentType={vote.agentType as AgentTypeKey} />
                  <div>
                    <span className="capitalize font-medium">{vote.agentType}</span>
                    <p className="text-xs text-muted-foreground">
                      Weight: {(vote.voteWeight || 1).toFixed(2)} | Credit: {vote.creditScore || 100}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={vote.vote === "approve" ? "default" : vote.vote === "reject" ? "destructive" : "secondary"}>
                    {vote.vote}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{vote.confidence}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SessionCard({ session, onSelect }: { session: ParliamentSession; onSelect: () => void }) {
  const statusColors = {
    deliberating: "bg-blue-500/20 text-blue-400",
    voting: "bg-yellow-500/20 text-yellow-400",
    concluded: session.outcome === "approved" ? "bg-green-500/20 text-green-400" : session.outcome === "rejected" ? "bg-red-500/20 text-red-400" : "bg-gray-500/20 text-gray-400",
  };

  return (
    <Card className="hover-elevate cursor-pointer transition-all" onClick={onSelect} data-testid={`card-session-${session.id}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Gavel className="w-4 h-4 text-primary" />
              <h3 className="font-semibold truncate" data-testid={`text-session-topic-${session.id}`}>{session.topic}</h3>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{session.description}</p>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1" data-testid={`text-debate-count-${session.id}`}>
                <MessageCircle className="w-3 h-3" />
                {session.debates.length} debates
              </span>
              <span className="flex items-center gap-1" data-testid={`text-vote-count-${session.id}`}>
                <Vote className="w-3 h-3" />
                {session.votes.length} votes
              </span>
            </div>
          </div>
          <Badge className={statusColors[session.status]} data-testid={`badge-session-status-${session.id}`}>
            {session.status === "concluded" && session.outcome ? session.outcome : session.status}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

function NewSessionDialog({ onCreated }: { onCreated: () => void }) {
  const [topic, setTopic] = useState("");
  const [description, setDescription] = useState("");
  const [actionType, setActionType] = useState("governance");
  const [open, setOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/parliament", { 
        topic, 
        description, 
        proposalData: { actionType },
        quorum: 4,
        requiredMajority: 60,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parliament"] });
      setOpen(false);
      setTopic("");
      setDescription("");
      onCreated();
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button data-testid="button-new-session">
          <Gavel className="w-4 h-4 mr-2" />
          New Session
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Parliament Session</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <label className="text-sm font-medium">Topic</label>
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Deploy 50% of treasury to Aave V3"
              data-testid="input-session-topic"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Action Type</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full mt-1 p-2 rounded-md border bg-background"
              data-testid="select-action-type"
            >
              <option value="yield_deployment">Yield Deployment</option>
              <option value="risk_rebalance">Risk Rebalance</option>
              <option value="protocol_rotation">Protocol Rotation</option>
              <option value="governance">Governance Parameter</option>
              <option value="emergency">Emergency Action</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed proposal description..."
              data-testid="input-session-description"
            />
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-sm">
            <p className="font-medium mb-1">Session Parameters</p>
            <p className="text-muted-foreground">Quorum: 4 agents | Majority: 60%</p>
          </div>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!topic || !description || createMutation.isPending}
            className="w-full"
            data-testid="button-create-session"
          >
            {createMutation.isPending ? "Creating..." : "Create Session"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LiveSessionView({ session, onBack }: { session: ParliamentSession; onBack: () => void }) {
  const [metaSummary, setMetaSummary] = useState<MetaSummary | undefined>(session.metaSummary);
  
  const concludeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/parliament/${session.id}/conclude`);
      return response;
    },
    onSuccess: (data) => {
      if (data.metaSummary) {
        setMetaSummary(data.metaSummary);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/parliament", session.id] });
    },
  });

  const simulateDebate = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", `/api/parliament/${session.id}/debate-live`);
      if (response.metaSummary) {
        setMetaSummary(response.metaSummary);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/parliament", session.id] });
      return response;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <Button variant="ghost" onClick={onBack} data-testid="button-back-sessions">
          <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
          Back to Sessions
        </Button>
        <div className="flex gap-2 flex-wrap">
          {session.status === "deliberating" && (
            <Button
              onClick={() => simulateDebate.mutate()}
              disabled={simulateDebate.isPending}
              data-testid="button-start-debate"
            >
              <Play className="w-4 h-4 mr-2" />
              {simulateDebate.isPending ? "Running Debate..." : "Run Full Debate"}
            </Button>
          )}
          {(session.status === "deliberating" || session.status === "voting") && session.votes.length >= session.quorum && (
            <Button
              variant="outline"
              onClick={() => concludeMutation.mutate()}
              disabled={concludeMutation.isPending}
              data-testid="button-conclude"
            >
              <Gavel className="w-4 h-4 mr-2" />
              Conclude Session
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Gavel className="w-5 h-5 text-primary" />
                    {session.topic}
                  </CardTitle>
                  <CardDescription>{session.description}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {(session.proposalData as any)?.actionType || session.actionType || "governance"}
                  </Badge>
                  <Badge variant={session.status === "concluded" ? "secondary" : "default"} className="text-sm">
                    {session.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="debate">
                <TabsList className="mb-4">
                  <TabsTrigger value="debate">
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Debate ({session.debates.length})
                  </TabsTrigger>
                  <TabsTrigger value="votes">
                    <Vote className="w-4 h-4 mr-2" />
                    Votes ({session.votes.length})
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="debate">
                  <DebateStream debates={session.debates} votes={session.votes} />
                </TabsContent>
                <TabsContent value="votes">
                  <VotingPanel votes={session.votes} quorum={session.quorum} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {(metaSummary || session.metaSummary) && (
            <MetaSummaryPanel summary={metaSummary || session.metaSummary} />
          )}
        </div>

        <div className="space-y-6">
          <VotingPanel votes={session.votes} quorum={session.quorum} />

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Users className="w-5 h-5" />
                Participants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(["meta", "scout", "risk", "execution"] satisfies AgentTypeKey[]).map((type) => {
                  const vote = session.votes.find(v => v.agentType === type);
                  return (
                    <div key={type} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <AgentAvatar agentType={type} />
                        <div>
                          <span className="capitalize font-medium">{type} Agent</span>
                          {vote && (
                            <p className="text-xs text-muted-foreground">
                              Credit: {vote.creditScore || 100}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="text-xs">
                          {session.debates.filter(d => d.agentType === type).length} statements
                        </Badge>
                        {vote && (
                          <Badge variant={vote.vote === "approve" ? "default" : vote.vote === "reject" ? "destructive" : "secondary"} className="text-xs">
                            {vote.vote}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {session.status === "concluded" && session.outcome && (
        <Card className={`border-2 ${session.outcome === "approved" ? "border-green-500/50 bg-green-500/5" : session.outcome === "rejected" ? "border-red-500/50 bg-red-500/5" : "border-yellow-500/50 bg-yellow-500/5"}`}>
          <CardContent className="py-6">
            <div className="flex items-center justify-center gap-4">
              {session.outcome === "approved" ? (
                <CheckCircle className="w-12 h-12 text-green-400" />
              ) : session.outcome === "rejected" ? (
                <XCircle className="w-12 h-12 text-red-400" />
              ) : (
                <Pause className="w-12 h-12 text-yellow-400" />
              )}
              <div className="text-center">
                <h3 className="text-2xl font-bold capitalize">{session.outcome}</h3>
                <p className="text-muted-foreground">
                  Session concluded with {session.votes.filter(v => v.vote === "approve").length} approvals, {session.votes.filter(v => v.vote === "reject").length} rejections
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function Parliament() {
  const [selectedSession, setSelectedSession] = useState<string | null>(null);

  const { data: sessions = [], isLoading } = useQuery<ParliamentSession[]>({
    queryKey: ["/api/parliament"],
    refetchInterval: 3000,
  });

  const { data: activeSession } = useQuery<ParliamentSession>({
    queryKey: ["/api/parliament", selectedSession],
    enabled: !!selectedSession,
    refetchInterval: 2000,
  });

  if (selectedSession && activeSession) {
    return (
      <div className="space-y-6">
        <LiveSessionView session={activeSession} onBack={() => setSelectedSession(null)} />
      </div>
    );
  }

  const activeSessions = sessions.filter(s => s.status !== "concluded");
  const pastSessions = sessions.filter(s => s.status === "concluded");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" data-testid="text-parliament-title">
            <Gavel className="w-8 h-8 text-primary" />
            Agent Parliament
          </h1>
          <p className="text-muted-foreground mt-1">
            Multi-agent governance with weighted voting and Meta orchestration
          </p>
        </div>
        <NewSessionDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/parliament"] })} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Gavel className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sessions.length}</p>
                <p className="text-sm text-muted-foreground">Total Sessions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <MessageCircle className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeSessions.length}</p>
                <p className="text-sm text-muted-foreground">Active</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pastSessions.filter(s => s.outcome === "approved").length}</p>
                <p className="text-sm text-muted-foreground">Approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pastSessions.filter(s => s.outcome === "rejected").length}</p>
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {activeSessions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Active Sessions
          </h2>
          <div className="grid gap-4 md:grid-cols-2">
            {activeSessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onSelect={() => setSelectedSession(session.id)}
              />
            ))}
          </div>
        </div>
      )}

      {pastSessions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Past Sessions</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pastSessions.slice(0, 6).map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                onSelect={() => setSelectedSession(session.id)}
              />
            ))}
          </div>
        </div>
      )}

      {sessions.length === 0 && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="py-12">
            <div className="text-center">
              <Gavel className="w-12 h-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-semibold mb-2">No Parliament Sessions Yet</h3>
              <p className="text-muted-foreground mb-4">
                Start a new session to watch agents debate and vote with weighted voting power
              </p>
              <NewSessionDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/parliament"] })} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
