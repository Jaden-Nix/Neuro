import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
  isAdmin?: boolean;
  sessionId?: string;
}

const validApiKeys = new Set<string>();
let isProductionMode = false;

// Track failed auth attempts for brute force protection
const failedAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_FAILED_ATTEMPTS = 10;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

export function initializeApiKeys(): void {
  const configuredKey = process.env.API_KEY;
  isProductionMode = process.env.NODE_ENV === "production" || process.env.REPLIT_DEPLOYMENT === "1";
  
  if (configuredKey) {
    validApiKeys.add(configuredKey);
    console.log("[Auth] API key authentication enabled");
  } else if (isProductionMode) {
    console.error("[Auth] CRITICAL: No API_KEY configured in production mode!");
    console.error("[Auth] Set API_KEY environment variable to secure API endpoints");
  } else {
    console.warn("[Auth] No API_KEY configured - API endpoints are open (development mode)");
  }
}

function getClientIP(req: Request): string {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || 
         req.socket.remoteAddress || 
         "unknown";
}

function isLockedOut(ip: string): boolean {
  const attempts = failedAttempts.get(ip);
  if (!attempts) return false;
  
  if (Date.now() - attempts.lastAttempt > LOCKOUT_DURATION) {
    failedAttempts.delete(ip);
    return false;
  }
  
  return attempts.count >= MAX_FAILED_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
  const attempts = failedAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  attempts.count++;
  attempts.lastAttempt = Date.now();
  failedAttempts.set(ip, attempts);
}

function clearFailedAttempts(ip: string): void {
  failedAttempts.delete(ip);
}

// Timing-safe comparison to prevent timing attacks
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Still do a comparison to maintain constant time
    crypto.timingSafeEqual(Buffer.from(a), Buffer.from(a));
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

function validateApiKey(providedKey: string): boolean {
  for (const validKey of validApiKeys) {
    if (safeCompare(providedKey, validKey)) {
      return true;
    }
  }
  return false;
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const clientIP = getClientIP(req);
  
  // Check for lockout
  if (isLockedOut(clientIP)) {
    res.status(429).json({ 
      error: "Too Many Requests", 
      message: "Too many failed authentication attempts. Please try again later." 
    });
    return;
  }

  // In development mode without API_KEY, allow all requests
  if (validApiKeys.size === 0 && !isProductionMode) {
    next();
    return;
  }

  const apiKey = req.headers["x-api-key"] as string || 
                 req.headers["authorization"]?.replace("Bearer ", "");

  // Don't allow API key in query params (insecure - can be logged)
  if (req.query.apiKey) {
    console.warn(`[Auth] API key passed via query param from ${clientIP} - this is insecure`);
  }

  if (!apiKey) {
    res.status(401).json({ 
      error: "Unauthorized", 
      message: "API key required. Provide via X-API-Key header or Authorization: Bearer <key>" 
    });
    return;
  }

  if (!validateApiKey(apiKey)) {
    recordFailedAttempt(clientIP);
    console.warn(`[Auth] Invalid API key attempt from ${clientIP}`);
    res.status(403).json({ 
      error: "Forbidden", 
      message: "Invalid API key" 
    });
    return;
  }

  clearFailedAttempts(clientIP);
  req.apiKey = apiKey;
  req.isAdmin = true;
  next();
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-api-key"] as string || 
                 req.headers["authorization"]?.replace("Bearer ", "");

  if (apiKey && validateApiKey(apiKey)) {
    req.apiKey = apiKey;
    req.isAdmin = true;
  }

  next();
}

export function requireWriteAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const clientIP = getClientIP(req);
  
  // Check for lockout
  if (isLockedOut(clientIP)) {
    res.status(429).json({ 
      error: "Too Many Requests", 
      message: "Too many failed authentication attempts. Please try again later." 
    });
    return;
  }

  // In development mode without API_KEY, allow all requests
  if (validApiKeys.size === 0 && !isProductionMode) {
    next();
    return;
  }

  const apiKey = req.headers["x-api-key"] as string || 
                 req.headers["authorization"]?.replace("Bearer ", "");

  if (!apiKey || !validateApiKey(apiKey)) {
    if (apiKey) {
      recordFailedAttempt(clientIP);
      console.warn(`[Auth] Invalid write auth attempt from ${clientIP}`);
    }
    res.status(403).json({ 
      error: "Forbidden", 
      message: "Write operations require valid API key authentication" 
    });
    return;
  }

  clearFailedAttempts(clientIP);
  req.apiKey = apiKey;
  req.isAdmin = true;
  next();
}

// Security headers middleware
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Prevent clickjacking
  res.setHeader("X-Frame-Options", "DENY");
  
  // Prevent MIME type sniffing
  res.setHeader("X-Content-Type-Options", "nosniff");
  
  // Enable XSS filter
  res.setHeader("X-XSS-Protection", "1; mode=block");
  
  // Referrer policy
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  
  // Content Security Policy for API responses
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
  
  // Prevent caching of sensitive data
  if (_req.path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
  
  next();
}

// Cleanup old failed attempts periodically
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of failedAttempts.entries()) {
    if (now - attempts.lastAttempt > LOCKOUT_DURATION) {
      failedAttempts.delete(ip);
    }
  }
}, 60 * 1000); // Every minute
