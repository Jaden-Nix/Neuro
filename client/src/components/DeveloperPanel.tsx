import { useState } from "react";
import { X, Code, GitBranch, Coins, Database, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import type { LogEntry, AgentCreditScore, MemoryEntry, SimulationBranch } from "@shared/schema";

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

      <Tabs defaultValue="logs" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full grid grid-cols-4 rounded-none border-b border-border shrink-0">
          <TabsTrigger value="logs" data-testid="tab-logs">
            <Code className="w-4 h-4 mr-1" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="simulations" data-testid="tab-simulations">
            <GitBranch className="w-4 h-4 mr-1" />
            Sims
          </TabsTrigger>
          <TabsTrigger value="credits" data-testid="tab-credits">
            <Coins className="w-4 h-4 mr-1" />
            Credits
          </TabsTrigger>
          <TabsTrigger value="memory" data-testid="tab-memory">
            <Database className="w-4 h-4 mr-1" />
            Memory
          </TabsTrigger>
        </TabsList>

        <TabsContent value="logs" className="flex-1 p-4 min-h-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="space-y-2 font-mono text-xs pr-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-2 rounded bg-muted/50 border border-border"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-muted-foreground text-[10px]">
                      {new Date(log.timestamp).toISOString()}
                    </span>
                    <span
                      className={`text-[10px] uppercase ${
                        log.level === "error"
                          ? "text-destructive"
                          : log.level === "warn"
                          ? "text-yellow-500"
                          : log.level === "success"
                          ? "text-green-500"
                          : "text-primary"
                      }`}
                    >
                      {log.level}
                    </span>
                  </div>
                  <p className="text-foreground text-[11px] break-words">{log.message}</p>
                  <p className="text-muted-foreground text-[10px] mt-1">
                    Agent: {log.agentType}
                  </p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="simulations" className="flex-1 p-4 min-h-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-4">
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
                <div className="text-center text-muted-foreground py-8">
                  <p className="text-sm">No simulation data available</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="credits" className="flex-1 p-4 min-h-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-4">
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
                <div className="text-center text-muted-foreground py-8">
                  <p className="text-sm">No credit data available</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="memory" className="flex-1 p-4 min-h-0 flex flex-col">
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-4">
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
                <div className="text-center text-muted-foreground py-8">
                  <p className="text-sm">No memory entries available</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
}
