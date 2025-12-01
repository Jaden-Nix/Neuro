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
  ChevronRight
} from "lucide-react";
import type { ParliamentSession, ParliamentDebateEntry, ParliamentVote } from "@shared/schema";

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

function AgentAvatar({ agentType }: { agentType: AgentTypeKey }) {
  const Icon = agentIcons[agentType] || Brain;
  return (
    <div className={`flex items-center justify-center w-10 h-10 rounded-full border ${agentColors[agentType]}`}>
      <Icon className="w-5 h-5" />
    </div>
  );
}

function DebateStream({ debates }: { debates: ParliamentDebateEntry[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [debates]);

  if (debates.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
        <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
        <p>Waiting for debate to begin...</p>
        <p className="text-sm opacity-75">Agents are analyzing the proposal</p>
      </div>
    );
  }

  return (
    <ScrollArea ref={scrollRef} className="h-[400px] pr-4">
      <div className="space-y-4">
        {debates.map((entry, idx) => (
          <div
            key={idx}
            className={`p-4 rounded-lg bg-muted/30 ${positionStyles[entry.position]} animate-in fade-in slide-in-from-left-2 duration-300`}
          >
            <div className="flex items-start gap-3">
              <AgentAvatar agentType={entry.agentType as AgentTypeKey} />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-semibold capitalize">{entry.agentType} Agent</span>
                  <Badge variant="outline" className={entry.position === "for" ? "text-green-400" : entry.position === "against" ? "text-red-400" : "text-yellow-400"}>
                    {entry.position}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(entry.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm leading-relaxed">{entry.statement}</p>
                {entry.rebuttalTo && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Responding to previous argument
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

function VotingPanel({ votes, quorum }: { votes: ParliamentVote[]; quorum: number }) {
  const approves = votes.filter(v => v.vote === "approve").length;
  const rejects = votes.filter(v => v.vote === "reject").length;
  const abstains = votes.filter(v => v.vote === "abstain").length;
  const total = votes.length;
  const progress = (total / quorum) * 100;

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
          <div className="space-y-2 pt-2">
            <p className="text-sm font-medium">Recent Votes</p>
            {votes.slice(-3).map((vote, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                <div className="flex items-center gap-2">
                  <AgentAvatar agentType={vote.agentType as AgentTypeKey} />
                  <span className="capitalize">{vote.agentType}</span>
                </div>
                <Badge variant={vote.vote === "approve" ? "default" : vote.vote === "reject" ? "destructive" : "secondary"}>
                  {vote.vote}
                </Badge>
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
  const [open, setOpen] = useState(false);

  const createMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/parliament", { topic, description, proposalData: {} });
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
              placeholder="e.g., Increase risk threshold for arbitrage"
              data-testid="input-session-topic"
            />
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
  const concludeMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/parliament/${session.id}/conclude`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/parliament", session.id] });
    },
  });

  const simulateDebate = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/parliament/${session.id}/debate-live`);
      queryClient.invalidateQueries({ queryKey: ["/api/parliament", session.id] });
    },
  });

  const simulateVoting = useMutation({
    mutationFn: async () => {
      const agents: { id: string; type: AgentTypeKey }[] = [
        { id: "meta-001", type: "meta" },
        { id: "scout-001", type: "scout" },
        { id: "risk-001", type: "risk" },
        { id: "exec-001", type: "execution" },
      ];

      for (const agent of agents) {
        const voteOptions = ["approve", "reject", "abstain"];
        const weights = agent.type === "risk" ? [0.3, 0.5, 0.2] : [0.6, 0.2, 0.2];
        const randomVal = Math.random();
        let cumulative = 0;
        let vote = "abstain";
        for (let i = 0; i < weights.length; i++) {
          cumulative += weights[i];
          if (randomVal < cumulative) {
            vote = voteOptions[i];
            break;
          }
        }

        await apiRequest("POST", `/api/parliament/${session.id}/vote`, {
          agentId: agent.id,
          agentType: agent.type,
          vote,
          reasoning: `Based on my ${agent.type} analysis, I cast my vote as ${vote}.`,
          confidence: 0.7 + Math.random() * 0.25,
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      queryClient.invalidateQueries({ queryKey: ["/api/parliament", session.id] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack} data-testid="button-back-sessions">
          <ChevronRight className="w-4 h-4 mr-2 rotate-180" />
          Back to Sessions
        </Button>
        <div className="flex gap-2">
          {session.status === "deliberating" && (
            <>
              <Button
                variant="outline"
                onClick={() => simulateDebate.mutate()}
                disabled={simulateDebate.isPending}
                data-testid="button-simulate-debate"
              >
                <MessageCircle className="w-4 h-4 mr-2" />
                {simulateDebate.isPending ? "Simulating..." : "Simulate Debate"}
              </Button>
              <Button
                onClick={() => simulateVoting.mutate()}
                disabled={simulateVoting.isPending}
                data-testid="button-start-voting"
              >
                <Vote className="w-4 h-4 mr-2" />
                Start Voting
              </Button>
            </>
          )}
          {session.status === "voting" && (
            <Button
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
        <Card className="lg:col-span-2 border-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Gavel className="w-5 h-5 text-primary" />
                  {session.topic}
                </CardTitle>
                <CardDescription>{session.description}</CardDescription>
              </div>
              <Badge variant={session.status === "concluded" ? "secondary" : "default"} className="text-sm">
                {session.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <DebateStream debates={session.debates} />
          </CardContent>
        </Card>

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
                {(["meta", "scout", "risk", "execution"] satisfies AgentTypeKey[]).map((type) => (
                  <div key={type} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-3">
                      <AgentAvatar agentType={type} />
                      <span className="capitalize font-medium">{type} Agent</span>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {session.debates.filter(d => d.agentType === type).length} statements
                    </Badge>
                  </div>
                ))}
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3" data-testid="text-parliament-title">
            <Gavel className="w-8 h-8 text-primary" />
            Agent Parliament
          </h1>
          <p className="text-muted-foreground mt-1">
            Multi-agent governance with real-time debates and voting
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
                Start a new session to watch agents debate and vote on governance proposals
              </p>
              <NewSessionDialog onCreated={() => queryClient.invalidateQueries({ queryKey: ["/api/parliament"] })} />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
