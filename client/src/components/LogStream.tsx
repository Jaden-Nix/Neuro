import { useEffect, useRef, useState } from "react";
import { Brain, Search, Shield, Zap, Info, AlertTriangle, XCircle, CheckCircle, Trash2 } from "lucide-react";
import { AgentType, type LogEntry } from "@shared/schema";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface LogStreamProps {
  logs: LogEntry[];
  maxLogs?: number;
  onClearLogs?: () => void;
  isClearing?: boolean;
}

const agentIcons = {
  [AgentType.META]: Brain,
  [AgentType.SCOUT]: Search,
  [AgentType.RISK]: Shield,
  [AgentType.EXECUTION]: Zap,
};

const agentColors = {
  [AgentType.META]: "text-meta bg-meta/10",
  [AgentType.SCOUT]: "text-scout bg-scout/10",
  [AgentType.RISK]: "text-risk bg-risk/10",
  [AgentType.EXECUTION]: "text-execution bg-execution/10",
};

const levelIcons = {
  info: Info,
  warn: AlertTriangle,
  error: XCircle,
  success: CheckCircle,
};

const levelColors = {
  info: "text-primary",
  warn: "text-yellow-500",
  error: "text-destructive",
  success: "text-green-500",
};

export function LogStream({ logs, maxLogs = 100, onClearLogs, isClearing }: LogStreamProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayLogs = logs.slice(-maxLogs);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  return (
    <div className="flex flex-col h-full" data-testid="log-stream">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-display font-semibold">System Logs</h3>
        <div className="flex items-center gap-2">
          {onClearLogs && displayLogs.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearLogs}
              disabled={isClearing}
              className="h-6 text-xs"
              data-testid="button-clear-logs"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear
            </Button>
          )}
          <Badge 
            variant={autoScroll ? "default" : "secondary"}
            className="cursor-pointer text-xs"
            onClick={() => setAutoScroll(!autoScroll)}
            data-testid="button-autoscroll-toggle"
          >
            {autoScroll ? "Auto-scroll: ON" : "Auto-scroll: OFF"}
          </Badge>
          <span className="text-xs text-muted-foreground font-mono">
            {displayLogs.length} / {maxLogs}
          </span>
        </div>
      </div>

      <ScrollArea className="flex-1 h-96" ref={scrollRef}>
        <div className="space-y-2 font-mono text-xs pr-4">
          {displayLogs.map((log) => {
            const AgentIcon = agentIcons[log.agentType];
            const LevelIcon = levelIcons[log.level];
            const agentColorClass = agentColors[log.agentType];
            const levelColorClass = levelColors[log.level];

            return (
              <div
                key={log.id}
                className="flex items-start gap-2 p-2 rounded-md bg-card/50 border border-border/50 hover-elevate"
                data-testid={`log-entry-${log.id}`}
              >
                <span className="text-muted-foreground shrink-0 w-20">
                  {formatTimestamp(log.timestamp)}
                </span>
                
                <div className={`shrink-0 w-5 h-5 rounded flex items-center justify-center ${agentColorClass}`}>
                  <AgentIcon className="w-3 h-3" />
                </div>

                <div className={`shrink-0 ${levelColorClass}`}>
                  <LevelIcon className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-foreground break-words">{log.message}</p>
                  {log.personality && (
                    <p className="text-muted-foreground text-[10px] italic mt-0.5">
                      [{log.personality}]
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {displayLogs.length === 0 && (
            <div className="flex items-center justify-center h-32 text-muted-foreground">
              <p className="text-sm">No logs yet. Awaiting system activity...</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
