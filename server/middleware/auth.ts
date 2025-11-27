import type { Request, Response, NextFunction } from "express";

export interface AuthenticatedRequest extends Request {
  apiKey?: string;
  isAdmin?: boolean;
}

const validApiKeys = new Set<string>();

export function initializeApiKeys(): void {
  const configuredKey = process.env.API_KEY;
  if (configuredKey) {
    validApiKeys.add(configuredKey);
    console.log("[Auth] API key authentication enabled");
  } else {
    console.warn("[Auth] No API_KEY configured - API endpoints are open (development mode)");
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (validApiKeys.size === 0) {
    next();
    return;
  }

  const apiKey = req.headers["x-api-key"] as string || 
                 req.headers["authorization"]?.replace("Bearer ", "") ||
                 req.query.apiKey as string;

  if (!apiKey) {
    res.status(401).json({ 
      error: "Unauthorized", 
      message: "API key required. Provide via X-API-Key header, Authorization: Bearer <key>, or ?apiKey= query parameter" 
    });
    return;
  }

  if (!validApiKeys.has(apiKey)) {
    res.status(403).json({ 
      error: "Forbidden", 
      message: "Invalid API key" 
    });
    return;
  }

  req.apiKey = apiKey;
  req.isAdmin = true;
  next();
}

export function optionalAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const apiKey = req.headers["x-api-key"] as string || 
                 req.headers["authorization"]?.replace("Bearer ", "") ||
                 req.query.apiKey as string;

  if (apiKey && validApiKeys.has(apiKey)) {
    req.apiKey = apiKey;
    req.isAdmin = true;
  }

  next();
}

export function requireWriteAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (validApiKeys.size === 0) {
    next();
    return;
  }

  const apiKey = req.headers["x-api-key"] as string || 
                 req.headers["authorization"]?.replace("Bearer ", "");

  if (!apiKey || !validApiKeys.has(apiKey)) {
    res.status(403).json({ 
      error: "Forbidden", 
      message: "Write operations require valid API key authentication" 
    });
    return;
  }

  req.apiKey = apiKey;
  req.isAdmin = true;
  next();
}
