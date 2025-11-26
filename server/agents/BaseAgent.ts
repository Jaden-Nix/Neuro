import { AgentType, AgentStatus, PersonalityTrait, type Agent } from "@shared/schema";
import { EventEmitter } from "events";

export interface AgentConfig {
  type: AgentType;
  personality: PersonalityTrait[];
  initialCredits?: number;
}

export abstract class BaseAgent extends EventEmitter {
  public id: string;
  public type: AgentType;
  public status: AgentStatus;
  public personality: PersonalityTrait[];
  public creditScore: number;
  public version: number;
  public spawnedAt: number;
  public deprecatedAt?: number;
  public currentTask?: string;
  public atpMetadata?: Record<string, any>;

  protected successfulActions: number = 0;
  protected failedActions: number = 0;

  constructor(config: AgentConfig) {
    super();
    this.id = `${config.type}-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    this.type = config.type;
    this.status = AgentStatus.IDLE;
    this.personality = config.personality;
    this.creditScore = config.initialCredits || 500;
    this.version = 1;
    this.spawnedAt = Date.now();
  }

  abstract process(input: any): Promise<any>;

  public setStatus(status: AgentStatus): void {
    this.status = status;
    this.emit("statusChange", { agentId: this.id, status });
  }

  protected setStatusActive(): void {
    this.setStatus(AgentStatus.ACTIVE);
  }

  protected setStatusIdle(): void {
    this.setStatus(AgentStatus.IDLE);
  }

  protected setStatusExecuting(): void {
    this.setStatus(AgentStatus.EXECUTING);
  }

  protected setStatusNegotiating(): void {
    this.setStatus(AgentStatus.NEGOTIATING);
  }

  public setTask(task?: string): void {
    this.currentTask = task;
    this.emit("taskChange", { agentId: this.id, task });
  }

  public clearTask(): void {
    this.currentTask = undefined;
    this.emit("taskChange", { agentId: this.id, task: undefined });
  }

  public addCredits(amount: number, reason: string): void {
    this.creditScore += amount;
    this.emit("creditChange", {
      agentId: this.id,
      amount,
      reason,
      newTotal: this.creditScore,
    });
  }

  public recordSuccess(): void {
    this.successfulActions++;
    this.addCredits(10, "Successful action");
  }

  public recordFailure(): void {
    this.failedActions++;
    this.addCredits(-5, "Failed action");
  }

  public getAccuracyRate(): number {
    const total = this.successfulActions + this.failedActions;
    return total > 0 ? this.successfulActions / total : 0;
  }

  public shouldDeprecate(): boolean {
    return (
      this.creditScore < 100 ||
      this.getAccuracyRate() < 0.6 ||
      (this.successfulActions + this.failedActions > 50 && this.failedActions / (this.successfulActions + this.failedActions) > 0.5)
    );
  }

  public deprecate(reason: string): void {
    this.deprecatedAt = Date.now();
    this.status = AgentStatus.DEPRECATED;
    this.emit("deprecated", { agentId: this.id, reason });
  }

  public toJSON(): Agent {
    return {
      id: this.id,
      type: this.type,
      status: this.status,
      personality: this.personality,
      creditScore: this.creditScore,
      version: this.version,
      spawnedAt: this.spawnedAt,
      deprecatedAt: this.deprecatedAt,
      currentTask: this.currentTask,
      atpMetadata: this.atpMetadata,
    };
  }
}
