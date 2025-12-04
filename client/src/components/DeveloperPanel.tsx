import { useState } from "react";
import { X, Code, GitBranch, Coins, Database, Copy, Check, Zap, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import type { LogEntry, AgentCreditScore, MemoryEntry, SimulationBranch } from "@shared/schema";
import { LiveSystemStatus } from "./LiveSystemStatus";
import { Badge } from "@/components/ui/badge";

interface DeveloperPanelProps {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
  creditScores: AgentCreditScore[];
  memoryEntries: MemoryEntry[];
  simulationTree?: SimulationBranch[];
}

export function DeveloperPanel({
  isOpen,
  onClose,
  logs,
  creditScores,
  memoryEntries,
  simulationTree = [],
}: DeveloperPanelProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed right-0 top-0 h-full w-96 bg-card border-l border-border shadow-2xl z-50 flex flex-col"
      data-testid="developer-panel"
    >
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Code className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-display font-bold">Developer Mode</h2>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={onClose}
          data-testid="button-close-dev-panel"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      <Tabs defaultValue="logs" className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <TabsList className="w-full grid grid-cols-5 rounded-none border-b border-border flex-shrink-0">
          <TabsTrigger value="logs" data-testid="tab-logs" className="text-xs">
            <Code className="w-3 h-3 mr-1" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="simulations" data-testid="tab-simulations" className="text-xs">
            <GitBranch className="w-3 h-3 mr-1" />
            Sims
          </TabsTrigger>
          <TabsTrigger value="credits" data-testid="tab-credits" className="text-xs">
            <Coins className="w-3 h-3 mr-1" />
            Credits
          </TabsTrigger>
          <TabsTrigger value="memory" data-testid="tab-memory" className="text-xs">
            <Database className="w-3 h-3 mr-1" />
            Memory
          </TabsTrigger>
          <TabsTrigger value="status" data-testid="tab-status" className="text-xs">
            <Zap className="w-3 h-3 mr-1" />
            Status
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="flex-1 p-4 overflow-y-auto min-h-0">
          <div className="space-y-2 text-xs">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No logs yet</p>
            ) : (
              logs.filter(log => log && log.level && log.agentType).map((log) => (
                <div
                  key={log.id || `log-${log.timestamp}`}
                  className="p-3 rounded bg-muted/50 border border-border/50 space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground text-[11px] font-mono">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {log.agentType}
                      </Badge>
                      <Badge 
                        className={`text-[10px] ${
                          log.level === "error"
                            ? "bg-destructive/20 text-destructive"
                            : log.level === "warn"
                            ? "bg-yellow-500/20 text-yellow-600"
                            : log.level === "success"
                            ? "bg-green-500/20 text-green-600"
                            : "bg-primary/20 text-primary"
                        }`}
                      >
                        {log.level.toUpperCase()}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-foreground text-xs break-words">{log.message}</p>
                </div>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="simulations" className="flex-1 p-4 overflow-y-auto min-h-0">
          <div className="space-y-3">
              {simulationTree.map((branch) => (
                <Card key={branch.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-muted-foreground">
                      ID: {branch.id.slice(0, 8)}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        branch.outcome === "success"
                          ? "bg-green-500/20 text-green-500"
                          : branch.outcome === "failure"
                          ? "bg-red-500/20 text-red-500"
                          : "bg-yellow-500/20 text-yellow-500"
                      }`}
                    >
                      {branch.outcome}
                    </span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">EV Score:</span>
                      <span className="font-mono font-semibold">
                        {branch.evScore.toFixed(4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Predictions:</span>
                      <span className="font-mono">{branch.predictions.length}</span>
                    </div>
                  </div>
                </Card>
              ))}

              {simulationTree.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">No simulations</p>
              )}
            </div>
        </TabsContent>

        <TabsContent value="credits" className="flex-1 p-4 overflow-y-auto min-h-0">
          <div className="space-y-3">
              {creditScores.map((score) => (
                <Card key={score.agentId} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-display font-semibold capitalize">
                      {score.agentType} Agent
                    </h4>
                    <span className="text-lg font-bold font-mono text-primary">
                      {score.totalCredits}
                    </span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Accuracy:</span>
                      <span className="font-mono">{(score.accuracyRate * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Successful:</span>
                      <span className="font-mono text-green-500">
                        {score.successfulActions}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Failed:</span>
                      <span className="font-mono text-red-500">{score.failedActions}</span>
                    </div>
                  </div>
                </Card>
              ))}

              {creditScores.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-8">No credits yet</p>
              )}
            </div>
        </TabsContent>

        <TabsContent value="memory" className="flex-1 p-4 overflow-y-auto min-h-0">
          <div className="space-y-3">
              {memoryEntries.map((entry) => (
                <Card key={entry.id} className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded ${
                        entry.strategyType === "successful"
                          ? "bg-green-500/20 text-green-500"
                          : entry.strategyType === "blocked"
                          ? "bg-red-500/20 text-red-500"
                          : entry.strategyType === "high-risk"
                          ? "bg-orange-500/20 text-orange-500"
                          : "bg-blue-500/20 text-blue-500"
                      }`}
                    >
                      {entry.strategyType}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(entry.id, entry.id)}
                    >
                      {copiedId === entry.id ? (
                        <Check className="w-3 h-3" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm mb-2">{entry.description}</p>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Pattern: {entry.riskPattern}</p>
                    <p className="font-mono">
                      {new Date(entry.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {entry.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              ))}

              {memoryEntries.length === 0 && (
                <div className="text-center py-8 space-y-2">
                  <Database className="w-8 h-8 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground text-sm">No memories yet</p>
                  <p className="text-muted-foreground/70 text-xs max-w-[250px] mx-auto">
                    Memory stores successful trading patterns, risk decisions, and learned strategies. Run simulations to build agent memory.
                  </p>
                </div>
              )}
            </div>
        </TabsContent>

        <TabsContent value="status" className="flex-1 p-4 overflow-y-auto min-h-0">
          <LiveSystemStatus />
        </TabsContent>
      </Tabs>
    </div>
  );
}
