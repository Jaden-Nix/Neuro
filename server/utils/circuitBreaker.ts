export enum CircuitState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half_open",
}

interface CircuitBreakerConfig {
  failureThreshold: number;
  successThreshold: number;
  timeout: number;
  resetTimeout: number;
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 30000,
  resetTimeout: 60000,
};

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;
  private name: string;

  constructor(name: string, config: Partial<CircuitBreakerConfig> = {}) {
    this.name = name;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  async execute<T>(fn: () => Promise<T>, fallback?: () => T): Promise<T & { __degraded?: boolean }> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        console.log(`[CircuitBreaker:${this.name}] Transitioning to HALF_OPEN - attempting recovery`);
      } else {
        console.log(`[CircuitBreaker:${this.name}] Circuit OPEN, using fallback`);
        if (fallback) {
          const result = fallback() as T & { __degraded?: boolean };
          if (typeof result === 'object' && result !== null) {
            (result as any).__degraded = true;
          }
          return result;
        }
        throw new Error(`Circuit breaker ${this.name} is OPEN`);
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Operation timeout")), this.config.timeout)
        ),
      ]);

      this.onSuccess();
      return result as T & { __degraded?: boolean };
    } catch (error) {
      this.onFailure();
      
      if (fallback) {
        console.log(`[CircuitBreaker:${this.name}] Using fallback due to error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        const result = fallback() as T & { __degraded?: boolean };
        if (typeof result === 'object' && result !== null) {
          (result as any).__degraded = true;
        }
        return result;
      }
      throw error;
    }
  }

  private onSuccess(): void {
    const previousState = this.state;
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      console.log(`[CircuitBreaker:${this.name}] HALF_OPEN success ${this.successes}/${this.config.successThreshold}`);
      if (this.successes >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successes = 0;
        console.log(`[CircuitBreaker:${this.name}] Circuit CLOSED after recovery - service restored`);
      }
    } else if (previousState === CircuitState.CLOSED && this.successes === 0) {
      console.log(`[CircuitBreaker:${this.name}] Service operating normally`);
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    this.successes = 0;

    if (this.failures >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.log(`[CircuitBreaker:${this.name}] Circuit OPEN after ${this.failures} failures`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): {
    state: CircuitState;
    failures: number;
    successes: number;
    lastFailureTime: number;
  } {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailureTime = 0;
    console.log(`[CircuitBreaker:${this.name}] Circuit manually reset`);
  }
}

const circuitBreakers = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(name: string, config?: Partial<CircuitBreakerConfig>): CircuitBreaker {
  if (!circuitBreakers.has(name)) {
    circuitBreakers.set(name, new CircuitBreaker(name, config));
  }
  return circuitBreakers.get(name)!;
}

export const anthropicCircuitBreaker = new CircuitBreaker("anthropic", {
  failureThreshold: 3,
  successThreshold: 1,
  timeout: 30000,
  resetTimeout: 120000,
});
