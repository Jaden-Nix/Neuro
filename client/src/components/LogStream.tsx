import { useEffect, useRef, useState, useMemo, forwardRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Search, Shield, Zap, Info, AlertTriangle, XCircle, CheckCircle, Trash2, Terminal } from "lucide-react";
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
  [AgentType.META]: "text-meta bg-meta/10 border-meta/30",
  [AgentType.SCOUT]: "text-scout bg-scout/10 border-scout/30",
  [AgentType.RISK]: "text-risk bg-risk/10 border-risk/30",
  [AgentType.EXECUTION]: "text-execution bg-execution/10 border-execution/30",
};

const agentGlowColors = {
  [AgentType.META]: "shadow-meta/30",
  [AgentType.SCOUT]: "shadow-scout/30",
  [AgentType.RISK]: "shadow-risk/30",
  [AgentType.EXECUTION]: "shadow-execution/30",
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

function TypewriterText({ text = "", speed = 15, onComplete }: { text?: string; speed?: number; onComplete?: () => void }) {
  const safeText = text || "";
  const [displayedText, setDisplayedText] = useState("");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (isComplete || !safeText) return;
    
    let currentIndex = 0;
    const interval = setInterval(() => {
      if (currentIndex < safeText.length) {
        setDisplayedText(safeText.slice(0, currentIndex + 1));
        currentIndex++;
      } else {
        clearInterval(interval);
        setIsComplete(true);
        onComplete?.();
      }
    }, speed);

    return () => clearInterval(interval);
  }, [safeText, speed, isComplete, onComplete]);

  return (
    <span>
      {displayedText}
      {!isComplete && (
        <motion.span
          className="inline-block w-2 h-4 bg-current ml-0.5"
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.5, repeat: Infinity }}
        />
      )}
    </span>
  );
}

const LogEntryItem = forwardRef<HTMLDivElement, { log: LogEntry; isNew: boolean }>(
  function LogEntryItem({ log, isNew }, ref) {
    const [showTypewriter, setShowTypewriter] = useState(isNew);
    const AgentIcon = agentIcons[log.agentType] || Terminal;
    const LevelIcon = levelIcons[log.level] || Info;
    const agentColorClass = agentColors[log.agentType] || "text-muted-foreground bg-muted/10 border-muted/30";
    const glowColorClass = agentGlowColors[log.agentType] || "shadow-muted/30";
    const levelColorClass = levelColors[log.level] || "text-muted-foreground";

    const formatTimestamp = (timestamp: number) => {
      const now = Date.now();
      let ts = timestamp;
      if (!ts || isNaN(ts) || ts <= 0) {
        ts = now;
      }
      const date = new Date(ts);
      if (isNaN(date.getTime())) {
        ts = now;
      }
      
      const diffMs = now - ts;
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHour = Math.floor(diffMin / 60);
      
      let relative: string;
      if (diffSec < 5) {
        relative = "now";
      } else if (diffSec < 60) {
        relative = `${diffSec}s ago`;
      } else if (diffMin < 60) {
        relative = `${diffMin}m ago`;
      } else if (diffHour < 24) {
        relative = `${diffHour}h ago`;
      } else {
        relative = `${Math.floor(diffHour / 24)}d ago`;
      }
      
      const timeStr = new Date(ts).toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
      
      return `${timeStr} (${relative})`;
    };

    return (
      <motion.div
        ref={ref}
        initial={isNew ? { opacity: 0, x: -20, scale: 0.95 } : false}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className={`p-3 rounded-md bg-card/50 border hover-elevate space-y-1 ${agentColorClass} ${isNew ? `shadow-lg ${glowColorClass}` : ""}`}
        data-testid={`log-entry-${log.id}`}
      >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <motion.div
            initial={isNew ? { scale: 0 } : false}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 500 }}
            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${agentColorClass}`}
          >
            <AgentIcon className="w-3 h-3" />
          </motion.div>
          <span className="text-muted-foreground font-mono text-[11px]">
            {formatTimestamp(log.timestamp)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isNew && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1"
            >
              <motion.div
                className="w-1.5 h-1.5 rounded-full bg-green-500"
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1, repeat: 3 }}
              />
              <span className="text-[10px] text-green-500 font-mono">LIVE</span>
            </motion.div>
          )}
          <div className={`shrink-0 ${levelColorClass}`}>
            <LevelIcon className="w-4 h-4" />
          </div>
        </div>
      </div>
      
      <p className="text-foreground break-words leading-relaxed font-mono text-xs">
        {showTypewriter ? (
          <TypewriterText 
            text={log.message} 
            speed={8}
            onComplete={() => setShowTypewriter(false)}
          />
        ) : (
          log.message
        )}
      </p>
      
      {log.personality && (
        <motion.p 
          initial={isNew ? { opacity: 0 } : false}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-muted-foreground text-[10px] italic mt-0.5"
        >
          [{log.personality}]
        </motion.p>
      )}
    </motion.div>
    );
  }
);

export function LogStream({ logs, maxLogs = 5000, onClearLogs, isClearing }: LogStreamProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [seenLogIds, setSeenLogIds] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const displayLogs = logs.slice(-maxLogs);

  const newLogIds = useMemo(() => {
    const currentIds = new Set(displayLogs.map(l => l.id));
    const newIds = new Set<string>();
    currentIds.forEach(id => {
      if (!seenLogIds.has(id)) {
        newIds.add(id);
      }
    });
    return newIds;
  }, [displayLogs, seenLogIds]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSeenLogIds(new Set(displayLogs.map(l => l.id)));
    }, 3000);
    return () => clearTimeout(timer);
  }, [displayLogs]);

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  return (
    <div className="flex flex-col h-full" data-testid="log-stream">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Terminal className="w-4 h-4 text-primary" />
          </motion.div>
          <h3 className="text-sm font-display font-semibold">System Logs</h3>
          {displayLogs.length > 0 && (
            <motion.div
              className="w-2 h-2 rounded-full bg-green-500"
              animate={{ scale: [1, 1.2, 1], opacity: [1, 0.7, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </div>
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

      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="space-y-2 text-xs pr-4">
          {displayLogs.length === 0 ? (
            <div className="text-center py-8">
              <motion.div
                animate={{ opacity: [0.3, 0.7, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Terminal className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
              </motion.div>
              <p className="text-muted-foreground">Awaiting system events...</p>
              <p className="text-muted-foreground/50 text-[10px] mt-1 font-mono">
                Neural network standing by
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {displayLogs.map((log, index) => (
                <LogEntryItem 
                  key={`${log.id}-${log.timestamp}-${index}`} 
                  log={log} 
                  isNew={newLogIds.has(log.id)}
                />
              ))}
            </AnimatePresence>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
