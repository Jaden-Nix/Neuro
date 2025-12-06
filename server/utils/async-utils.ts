export interface LimitFunction {
  <T>(fn: () => Promise<T>): Promise<T>;
  activeCount: number;
  pendingCount: number;
}

export function createLimit(concurrency: number): LimitFunction {
  const queue: Array<() => void> = [];
  let activeCount = 0;

  const next = () => {
    if (queue.length > 0 && activeCount < concurrency) {
      const run = queue.shift();
      if (run) {
        activeCount++;
        run();
      }
    }
  };

  const limit = <T>(fn: () => Promise<T>): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        try {
          const result = await fn();
          resolve(result);
        } catch (error) {
          reject(error);
        } finally {
          activeCount--;
          next();
        }
      };

      queue.push(run);
      next();
    });
  };

  Object.defineProperty(limit, 'activeCount', {
    get: () => activeCount
  });

  Object.defineProperty(limit, 'pendingCount', {
    get: () => queue.length
  });

  return limit as LimitFunction;
}

export class AbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AbortError';
  }
}

export interface RetryOptions {
  retries?: number;
  minTimeout?: number;
  maxTimeout?: number;
  factor?: number;
  onFailedAttempt?: (error: Error & { attemptNumber: number; retriesLeft: number }) => void | Promise<void>;
}

export async function retry<T>(
  fn: (attemptNumber: number) => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    retries = 3,
    minTimeout = 1000,
    maxTimeout = 30000,
    factor = 2,
    onFailedAttempt
  } = options;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      if (error instanceof AbortError) {
        throw error;
      }

      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt <= retries) {
        const errorWithAttempt = Object.assign(lastError, {
          attemptNumber: attempt,
          retriesLeft: retries - attempt + 1
        });

        if (onFailedAttempt) {
          await onFailedAttempt(errorWithAttempt);
        }

        const delay = Math.min(
          minTimeout * Math.pow(factor, attempt - 1),
          maxTimeout
        );
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
