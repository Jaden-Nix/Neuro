import { EventEmitter } from "events";
import type { ReplayEvent } from "@shared/schema";

export class ReplayEngine extends EventEmitter {
  private events: ReplayEvent[] = [];

  public recordEvent(event: Omit<ReplayEvent, "id" | "timestamp">): void {
    const fullEvent: ReplayEvent = {
      id: `event-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      ...event,
      timestamp: Date.now(),
    };

    this.events.push(fullEvent);
    this.emit("eventRecorded", fullEvent);

    // Keep only last 1000 events
    if (this.events.length > 1000) {
      this.events = this.events.slice(-1000);
    }
  }

  public getEvents(filters?: {
    startTime?: number;
    endTime?: number;
    eventType?: ReplayEvent["eventType"];
    agentType?: ReplayEvent["agentType"];
  }): ReplayEvent[] {
    let results = [...this.events];

    if (filters?.startTime) {
      results = results.filter((e) => e.timestamp >= filters.startTime!);
    }

    if (filters?.endTime) {
      results = results.filter((e) => e.timestamp <= filters.endTime!);
    }

    if (filters?.eventType) {
      results = results.filter((e) => e.eventType === filters.eventType);
    }

    if (filters?.agentType) {
      results = results.filter((e) => e.agentType === filters.agentType);
    }

    return results.sort((a, b) => a.timestamp - b.timestamp);
  }

  public createTimeline(): Array<{ timestamp: number; description: string }> {
    return this.events.map((event) => ({
      timestamp: event.timestamp,
      description: this.formatEventDescription(event),
    }));
  }

  private formatEventDescription(event: ReplayEvent): string {
    const agentPrefix = event.agentType ? `[${event.agentType.toUpperCase()}] ` : "";
    const typeLabel = event.eventType.toUpperCase();
    
    switch (event.eventType) {
      case "decision":
        return `${agentPrefix}${typeLabel}: ${event.data.decision || "Decision made"}`;
      case "simulation":
        return `${agentPrefix}${typeLabel}: Simulation completed with EV ${event.data.evScore || "N/A"}`;
      case "negotiation":
        return `${agentPrefix}${typeLabel}: ${event.data.approved ? "APPROVED" : "REJECTED"}`;
      case "execution":
        return `${agentPrefix}${typeLabel}: Transaction ${event.data.hash || "pending"}`;
      case "alert":
        return `${agentPrefix}${typeLabel}: ${event.data.message || "Alert triggered"}`;
      default:
        return `${agentPrefix}${typeLabel}`;
    }
  }

  public clear(): void {
    this.events = [];
    this.emit("cleared");
  }
}
