import { EventEmitter } from "events";
import type { MemoryEntry } from "@shared/schema";

export class MemoryVault extends EventEmitter {
  private entries: Map<string, MemoryEntry> = new Map();

  public store(entry: Omit<MemoryEntry, "id">): MemoryEntry {
    const id = `mem-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const fullEntry: MemoryEntry = { ...entry, id };
    
    this.entries.set(id, fullEntry);
    this.emit("memoryStored", fullEntry);
    
    return fullEntry;
  }

  public retrieve(id: string): MemoryEntry | undefined {
    return this.entries.get(id);
  }

  public search(filters: {
    strategyType?: MemoryEntry["strategyType"];
    tags?: string[];
    minTimestamp?: number;
    maxTimestamp?: number;
  }): MemoryEntry[] {
    let results = Array.from(this.entries.values());

    if (filters.strategyType) {
      results = results.filter((e) => e.strategyType === filters.strategyType);
    }

    if (filters.tags && filters.tags.length > 0) {
      results = results.filter((e) => filters.tags!.some((tag) => e.tags.includes(tag)));
    }

    if (filters.minTimestamp) {
      results = results.filter((e) => e.timestamp >= filters.minTimestamp!);
    }

    if (filters.maxTimestamp) {
      results = results.filter((e) => e.timestamp <= filters.maxTimestamp!);
    }

    return results.sort((a, b) => b.timestamp - a.timestamp);
  }

  public getSuccessfulStrategies(limit: number = 10): MemoryEntry[] {
    return this.search({ strategyType: "successful" }).slice(0, limit);
  }

  public getBlockedStrategies(limit: number = 10): MemoryEntry[] {
    return this.search({ strategyType: "blocked" }).slice(0, limit);
  }

  public getRiskPatterns(): string[] {
    const patterns = new Set<string>();
    this.entries.forEach((entry) => patterns.add(entry.riskPattern));
    return Array.from(patterns);
  }

  public saveToJSON(): string {
    return JSON.stringify(Array.from(this.entries.values()));
  }

  public loadFromJSON(json: string): void {
    const entries: MemoryEntry[] = JSON.parse(json);
    this.entries.clear();
    entries.forEach((entry) => this.entries.set(entry.id, entry));
  }
}
