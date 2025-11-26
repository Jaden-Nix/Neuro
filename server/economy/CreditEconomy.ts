import { EventEmitter } from "events";
import type { CreditTransaction, AgentCreditScore } from "@shared/schema";
import { AgentType } from "@shared/schema";

export class CreditEconomy extends EventEmitter {
  private transactions: CreditTransaction[] = [];
  private scores: Map<string, AgentCreditScore> = new Map();

  public recordTransaction(transaction: CreditTransaction): void {
    this.transactions.push(transaction);
    this.updateScore(transaction);
    this.emit("transactionRecorded", transaction);
  }

  private updateScore(transaction: CreditTransaction): void {
    const existing = this.scores.get(transaction.agentId);
    
    if (existing) {
      existing.totalCredits += transaction.amount;
      
      if (transaction.amount > 0) {
        existing.successfulActions++;
      } else {
        existing.failedActions++;
      }
      
      existing.accuracyRate =
        existing.successfulActions / (existing.successfulActions + existing.failedActions);
    } else {
      this.scores.set(transaction.agentId, {
        agentId: transaction.agentId,
        agentType: transaction.agentType,
        totalCredits: transaction.amount,
        accuracyRate: transaction.amount > 0 ? 1 : 0,
        successfulActions: transaction.amount > 0 ? 1 : 0,
        failedActions: transaction.amount <= 0 ? 1 : 0,
      });
    }
  }

  public getScore(agentId: string): AgentCreditScore | undefined {
    return this.scores.get(agentId);
  }

  public getAllScores(): AgentCreditScore[] {
    return Array.from(this.scores.values());
  }

  public getTransactions(agentId?: string, limit: number = 100): CreditTransaction[] {
    let filtered = this.transactions;
    
    if (agentId) {
      filtered = filtered.filter((t) => t.agentId === agentId);
    }
    
    return filtered.slice(-limit);
  }

  public redistribute(): void {
    // Meta-agent redistributes credits based on performance
    const scores = Array.from(this.scores.values());
    const totalPerformance = scores.reduce(
      (sum, score) => sum + score.accuracyRate * score.totalCredits,
      0
    );

    scores.forEach((score) => {
      const performanceShare = (score.accuracyRate * score.totalCredits) / totalPerformance;
      const bonus = Math.floor(performanceShare * 100);
      
      if (bonus > 0) {
        this.recordTransaction({
          agentId: score.agentId,
          agentType: score.agentType,
          amount: bonus,
          reason: "Performance-based redistribution",
          timestamp: Date.now(),
        });
      }
    });

    this.emit("redistributionCompleted");
  }

  public saveToJSON(): string {
    return JSON.stringify({
      transactions: this.transactions,
      scores: Array.from(this.scores.entries()),
    });
  }

  public loadFromJSON(json: string): void {
    const data = JSON.parse(json);
    this.transactions = data.transactions || [];
    this.scores = new Map(data.scores || []);
  }
}
