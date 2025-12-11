const DAILY_BUDGET_LIMIT = 5.00;

const MODEL_COSTS = {
  "claude-sonnet-4-5": { input: 3.00, output: 15.00 },
  "claude-haiku-4-5": { input: 1.00, output: 5.00 },
  "gemini-2.5-flash": { input: 0.50, output: 1.50 },
  "gpt-4o-mini": { input: 0.15, output: 0.60 },
  "gpt-4o": { input: 2.50, output: 10.00 },
} as const;

type ModelName = keyof typeof MODEL_COSTS;

interface UsageEntry {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  timestamp: number;
  source: string;
}

class CostTracker {
  private dailyUsage: UsageEntry[] = [];
  private dailyTotal: number = 0;
  private lastResetDate: string = "";
  private budgetExceeded: boolean = false;
  private reducedMode: boolean = false;
  private manuallyPaused: boolean = false;
  private pausedAt: number | null = null;
  private resumeCount: number = 0;

  constructor() {
    this.checkAndResetDaily();
    console.log(`[CostTracker] Initialized with $${DAILY_BUDGET_LIMIT.toFixed(2)} daily limit`);
  }

  private checkAndResetDaily() {
    const today = new Date().toISOString().split("T")[0];
    if (this.lastResetDate !== today) {
      this.dailyUsage = [];
      this.dailyTotal = 0;
      this.budgetExceeded = false;
      this.reducedMode = false;
      this.manuallyPaused = false;
      this.pausedAt = null;
      this.resumeCount = 0;
      this.lastResetDate = today;
      console.log(`[CostTracker] Daily reset - new budget cycle started`);
    }
  }

  calculateCost(model: string, inputTokens: number, outputTokens: number): number {
    const costs = MODEL_COSTS[model as ModelName] || MODEL_COSTS["gemini-2.5-flash"];
    const inputCost = (inputTokens / 1_000_000) * costs.input;
    const outputCost = (outputTokens / 1_000_000) * costs.output;
    return inputCost + outputCost;
  }

  trackUsage(model: string, inputTokens: number, outputTokens: number, source: string): void {
    this.checkAndResetDaily();
    
    const cost = this.calculateCost(model, inputTokens, outputTokens);
    
    const entry: UsageEntry = {
      model,
      inputTokens,
      outputTokens,
      cost,
      timestamp: Date.now(),
      source,
    };
    
    this.dailyUsage.push(entry);
    this.dailyTotal += cost;

    if (this.dailyTotal >= DAILY_BUDGET_LIMIT * 0.8 && !this.reducedMode) {
      this.reducedMode = true;
      console.log(`[CostTracker] WARNING: 80% of daily budget used ($${this.dailyTotal.toFixed(4)}). Entering reduced mode.`);
    }

    if (this.dailyTotal >= DAILY_BUDGET_LIMIT && !this.budgetExceeded) {
      this.budgetExceeded = true;
      this.manuallyPaused = true;
      this.pausedAt = Date.now();
      console.log(`[CostTracker] PAUSED: Daily budget limit of $${DAILY_BUDGET_LIMIT.toFixed(2)} reached. AI calls paused.`);
    }
  }

  canMakeCall(estimatedCost: number = 0.01): boolean {
    this.checkAndResetDaily();
    
    if (this.manuallyPaused) {
      return false;
    }
    
    return (this.dailyTotal + estimatedCost) <= DAILY_BUDGET_LIMIT;
  }

  resume(): { success: boolean; message: string } {
    this.checkAndResetDaily();
    
    if (!this.manuallyPaused && !this.budgetExceeded) {
      return { success: false, message: "AI is already running" };
    }
    
    this.manuallyPaused = false;
    this.budgetExceeded = false;
    this.dailyTotal = 0;
    this.dailyUsage = [];
    this.reducedMode = false;
    this.resumeCount++;
    this.pausedAt = null;
    
    console.log(`[CostTracker] RESUMED: AI calls enabled. Budget reset to $${DAILY_BUDGET_LIMIT.toFixed(2)}. Resume count: ${this.resumeCount}`);
    
    return { 
      success: true, 
      message: `AI resumed! New $${DAILY_BUDGET_LIMIT.toFixed(2)} budget active. Will pause again when limit is reached.` 
    };
  }

  pause(): { success: boolean; message: string } {
    this.checkAndResetDaily();
    
    if (this.manuallyPaused) {
      return { success: false, message: "AI is already paused" };
    }
    
    this.manuallyPaused = true;
    this.pausedAt = Date.now();
    
    console.log(`[CostTracker] MANUALLY PAUSED: AI calls disabled by user.`);
    
    return { 
      success: true, 
      message: "AI paused. Click Resume to enable AI features again." 
    };
  }

  isPaused(): boolean {
    this.checkAndResetDaily();
    return this.manuallyPaused || this.budgetExceeded;
  }

  isReducedMode(): boolean {
    this.checkAndResetDaily();
    return this.reducedMode;
  }

  isBudgetExceeded(): boolean {
    this.checkAndResetDaily();
    return this.budgetExceeded;
  }

  getDailyTotal(): number {
    this.checkAndResetDaily();
    return this.dailyTotal;
  }

  getRemainingBudget(): number {
    this.checkAndResetDaily();
    return Math.max(0, DAILY_BUDGET_LIMIT - this.dailyTotal);
  }

  getStatus(): {
    isPaused: boolean;
    dailySpent: number;
    dailyLimit: number;
    remaining: number;
    callCount: number;
    reducedMode: boolean;
    budgetExceeded: boolean;
    pausedAt: number | null;
    resumeCount: number;
    message: string;
  } {
    this.checkAndResetDaily();
    
    const isPaused = this.isPaused();
    let message = "";
    
    if (isPaused) {
      if (this.budgetExceeded) {
        message = `AI paused - Daily $${DAILY_BUDGET_LIMIT.toFixed(2)} budget reached. Click Resume to restart with a new budget.`;
      } else {
        message = "AI manually paused. Click Resume to enable AI features.";
      }
    } else if (this.reducedMode) {
      message = `AI running in reduced mode - 80%+ of daily budget used ($${this.dailyTotal.toFixed(2)}/$${DAILY_BUDGET_LIMIT.toFixed(2)})`;
    } else {
      message = `AI running - $${this.dailyTotal.toFixed(2)} of $${DAILY_BUDGET_LIMIT.toFixed(2)} daily budget used`;
    }
    
    return {
      isPaused,
      dailySpent: this.dailyTotal,
      dailyLimit: DAILY_BUDGET_LIMIT,
      remaining: this.getRemainingBudget(),
      callCount: this.dailyUsage.length,
      reducedMode: this.reducedMode,
      budgetExceeded: this.budgetExceeded,
      pausedAt: this.pausedAt,
      resumeCount: this.resumeCount,
      message,
    };
  }

  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }
}

export const costTracker = new CostTracker();
export { DAILY_BUDGET_LIMIT, MODEL_COSTS };
