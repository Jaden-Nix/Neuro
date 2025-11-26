import { EventEmitter } from "events";
import pRetry from "p-retry";
import pLimit from "p-limit";
import { AgentOrchestrator } from "../agents/AgentOrchestrator";
import type { NegotiationResult } from "@shared/schema";

export interface CycleMetrics {
  totalCycles: number;
  successfulCycles: number;
  failedCycles: number;
  approvedProposals: number;
  rejectedProposals: number;
  averageCycleTime: number;
  lastCycleTime: number;
  isRunning: boolean;
}

export interface CycleConfig {
  intervalMs: number;
  maxConcurrentCycles: number;
  retryAttempts: number;
  retryDelayMs: number;
  timeoutMs: number;
}

const DEFAULT_CONFIG: CycleConfig = {
  intervalMs: 30000,
  maxConcurrentCycles: 1,
  retryAttempts: 3,
  retryDelayMs: 2000,
  timeoutMs: 60000,
};

export class AutonomousCycleManager extends EventEmitter {
  private orchestrator: AgentOrchestrator;
  private config: CycleConfig;
  private cycleInterval?: NodeJS.Timeout;
  private isRunning: boolean = false;
  private limiter: ReturnType<typeof pLimit>;
  
  private metrics: CycleMetrics = {
    totalCycles: 0,
    successfulCycles: 0,
    failedCycles: 0,
    approvedProposals: 0,
    rejectedProposals: 0,
    averageCycleTime: 0,
    lastCycleTime: 0,
    isRunning: false,
  };

  private cycleTimes: number[] = [];

  constructor(orchestrator: AgentOrchestrator, config?: Partial<CycleConfig>) {
    super();
    this.orchestrator = orchestrator;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.limiter = pLimit(this.config.maxConcurrentCycles);
  }

  public start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.metrics.isRunning = true;
    this.emit("started");

    this.runCycleWithRetry();

    this.cycleInterval = setInterval(() => {
      this.runCycleWithRetry();
    }, this.config.intervalMs);
  }

  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.cycleInterval) {
      clearInterval(this.cycleInterval);
      this.cycleInterval = undefined;
    }

    this.isRunning = false;
    this.metrics.isRunning = false;
    this.emit("stopped");
  }

  public getMetrics(): CycleMetrics {
    return { ...this.metrics };
  }

  public isActive(): boolean {
    return this.isRunning;
  }

  private async runCycleWithRetry(): Promise<void> {
    await this.limiter(async () => {
      const startTime = Date.now();
      this.metrics.totalCycles++;

      try {
        const result = await pRetry(
          async () => {
            return await this.runSingleCycle();
          },
          {
            retries: this.config.retryAttempts,
            minTimeout: this.config.retryDelayMs,
            maxTimeout: this.config.retryDelayMs * 2,
            onFailedAttempt: (error) => {
              this.emit("retryAttempt", {
                attempt: error.attemptNumber,
                retriesLeft: error.retriesLeft,
                error: String(error),
              });
            },
          }
        );

        const cycleTime = Date.now() - startTime;
        this.recordCycleTime(cycleTime);
        this.metrics.successfulCycles++;

        if (result.approved) {
          this.metrics.approvedProposals++;
        } else {
          this.metrics.rejectedProposals++;
        }

        this.emit("cycleCompleted", {
          result,
          cycleTime,
          metrics: this.getMetrics(),
        });

      } catch (error) {
        const cycleTime = Date.now() - startTime;
        this.recordCycleTime(cycleTime);
        this.metrics.failedCycles++;

        this.emit("cycleFailed", {
          error: error instanceof Error ? error.message : String(error),
          cycleTime,
          metrics: this.getMetrics(),
        });
      }
    });
  }

  private async runSingleCycle(): Promise<NegotiationResult> {
    this.emit("cycleStarted", {
      cycleNumber: this.metrics.totalCycles,
      timestamp: Date.now(),
    });

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Cycle timeout after ${this.config.timeoutMs}ms`));
      }, this.config.timeoutMs);
    });

    const cyclePromise = this.orchestrator.runNegotiationCycle({
      timestamp: Date.now(),
      cycleNumber: this.metrics.totalCycles,
    });

    return await Promise.race([cyclePromise, timeoutPromise]);
  }

  private recordCycleTime(time: number): void {
    this.metrics.lastCycleTime = time;
    this.cycleTimes.push(time);

    if (this.cycleTimes.length > 100) {
      this.cycleTimes.shift();
    }

    this.metrics.averageCycleTime = 
      this.cycleTimes.reduce((a, b) => a + b, 0) / this.cycleTimes.length;
  }

  public updateConfig(newConfig: Partial<CycleConfig>): void {
    const wasRunning = this.isRunning;
    
    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...newConfig };
    this.limiter = pLimit(this.config.maxConcurrentCycles);

    if (wasRunning) {
      this.start();
    }
  }

  public resetMetrics(): void {
    this.metrics = {
      totalCycles: 0,
      successfulCycles: 0,
      failedCycles: 0,
      approvedProposals: 0,
      rejectedProposals: 0,
      averageCycleTime: 0,
      lastCycleTime: 0,
      isRunning: this.isRunning,
    };
    this.cycleTimes = [];
  }
}
