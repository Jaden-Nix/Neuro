import { useEffect, useState, useCallback, useRef } from "react";
import type { WSMessage, LogEntry, LiveMetrics, SentinelAlert, SimulationBranch } from "@shared/schema";

interface WebSocketState {
  connected: boolean;
  logs: LogEntry[];
  metrics: LiveMetrics | null;
  alerts: SentinelAlert[];
  simulations: SimulationBranch[];
  credits: import("@shared/schema").AgentCreditScore[];
}

const MAX_LOGS = 5000;

export function useWebSocket() {
  const logsRef = useRef<LogEntry[]>([]);
  
  const [state, setState] = useState<WebSocketState>({
    connected: false,
    logs: [],
    metrics: null,
    alerts: [],
    simulations: [],
    credits: [],
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttempts = useRef(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

      ws.onopen = async () => {
        console.log("WebSocket connected");
        reconnectAttempts.current = 0;
        
        if (logsRef.current.length === 0) {
          try {
            const response = await fetch("/api/logs?limit=100");
            if (response.ok) {
              const historicalLogs: LogEntry[] = await response.json();
              logsRef.current = historicalLogs;
              console.log(`Loaded ${historicalLogs.length} historical logs`);
            }
          } catch (error) {
            console.error("Failed to load historical logs:", error);
          }
        }
        
        setState((prev) => ({ ...prev, connected: true, logs: logsRef.current }));

        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);

          switch (message.type) {
            case "log":
              const newLog = message.data as LogEntry;
              const logKey = `${newLog.id}-${newLog.timestamp}`;
              const existingKeys = new Set(logsRef.current.map(l => `${l.id}-${l.timestamp}`));
              if (!existingKeys.has(logKey)) {
                logsRef.current = [...logsRef.current.slice(-(MAX_LOGS - 1)), newLog];
                setState((prev) => ({
                  ...prev,
                  logs: logsRef.current,
                }));
              }
              break;

            case "metrics":
              setState((prev) => ({
                ...prev,
                metrics: message.data as LiveMetrics,
              }));
              break;

            case "alert":
              setState((prev) => ({
                ...prev,
                alerts: [...prev.alerts.slice(-49), message.data as SentinelAlert],
              }));
              break;

            case "simulation":
              const simData = message.data as any;
              if (simData.branches) {
                setState((prev) => ({
                  ...prev,
                  simulations: simData.branches,
                }));
              }
              break;

            case "agent_update":
              // Agent updates handled by queries
              break;

            case "credits":
              setState((prev) => ({
                ...prev,
                credits: message.data as import("@shared/schema").AgentCreditScore[],
              }));
              break;

            case "transaction":
              // Transaction updates handled by queries
              break;
          }
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected, reconnecting...");
        setState((prev) => ({ ...prev, connected: false }));

        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }

        // Exponential backoff with jitter
        reconnectAttempts.current++;
        const baseDelay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        const jitter = Math.random() * 1000;
        const delay = baseDelay + jitter;

        console.log(`Reconnecting in ${(delay / 1000).toFixed(1)}s... (attempt ${reconnectAttempts.current})`);
        
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Failed to create WebSocket:", error);
      
      // Retry connection
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  return state;
}
