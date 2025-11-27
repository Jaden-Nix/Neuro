import type { Request, Response, NextFunction } from "express";

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const defaultConfig: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 100,
};

const writeConfig: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 20,
};

const strictConfig: RateLimitConfig = {
  windowMs: 60000,
  maxRequests: 10,
};

function getClientKey(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const ip = typeof forwarded === "string" 
    ? forwarded.split(",")[0].trim() 
    : req.socket.remoteAddress || "unknown";
  return ip;
}

function cleanupExpired(): void {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

setInterval(cleanupExpired, 60000);

export function createRateLimiter(config: RateLimitConfig = defaultConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientKey = getClientKey(req);
    const storeKey = `${clientKey}:${config.maxRequests}`;
    const now = Date.now();

    let entry = rateLimitStore.get(storeKey);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + config.windowMs,
      };
      rateLimitStore.set(storeKey, entry);
    }

    entry.count++;

    res.setHeader("X-RateLimit-Limit", config.maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, config.maxRequests - entry.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(entry.resetTime / 1000));

    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
      res.setHeader("Retry-After", retryAfter);
      res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`,
        retryAfter,
      });
      return;
    }

    next();
  };
}

export const rateLimit = createRateLimiter(defaultConfig);

export const writeLimiter = createRateLimiter(writeConfig);

export const strictLimiter = createRateLimiter(strictConfig);
